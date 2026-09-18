"""Admin response boundaries and durable, single-document refund coordination."""
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from pymongo import ReturnDocument
from fastapi.responses import JSONResponse

# Public profile fields only. Authentication secrets must never enter API responses.
PUBLIC_USER_FIELDS = frozenset('id email fullName phone role driver_id fleet_id car plate vehicle_type rating approved online disabled created_at last_lat last_lng last_heading last_location_at online_at drivers_license_path taxi_license_path profile_photo_path picture google_linked totp_enabled must_reset_password language'.split())


def public_user(user):
    result = {k: v for k, v in user.items() if k in PUBLIC_USER_FIELDS}
    if '_id' in user:
        result['id'] = str(user['_id'])
    return result


class PublicJSONResponse(JSONResponse):
    def render(self, content):
        private = {'password_hash', 'totp_secret', 'totp_secret_pending', 'totp_backup_codes', 'refund_lock', 'admin_refunds'}
        def clean(value):
            if isinstance(value, dict):
                return {k: clean(v) for k, v in value.items() if k not in private}
            if isinstance(value, list):
                return [clean(v) for v in value]
            return value
        return super().render(clean(content))


def payment_status(trip):
    return trip.get('payment_status') or 'unknown'


def bonus_transaction(bonus):
    return {'id': f"bonus_{bonus['_id']}", 'type': 'PAYOUT', 'ride': None,
            'recipient': bonus.get('driver_id'), 'amount': -int(bonus.get('amount') or 0),
            'provider': 'bonus', 'status': 'paid' if bonus.get('paid_out') is True else 'pending',
            'fleet_id': bonus.get('fleet_id'),
            'timestamp': bonus.get('paid_at') or bonus.get('earned_at')}


async def process_refund(db, stripe, body, current):
    """Serialize different operations per trip. Retries use a durable UUID and Stripe key.

    The trip lock and completed receipt are stored on the SAME Mongo document as the
    balance. No replica-set transaction requirement. A crash never expires the lock:
    retry that operation (not a new key); unknown provider outcomes stay reserved.
    The refunds/audit collections are repairable projections of the embedded receipt.
    """
    trip_id, op = body.trip_id, str(body.operation_id)
    fingerprint = {'amount': body.amount, 'reason': body.reason.strip(), 'mode': body.mode}
    key = f'{trip_id}:{op}'

    async def project(receipt):
        clean = {k: v for k, v in receipt.items() if k != 'request'}
        await db.refunds.update_one({'_id': key}, {'$set': clean}, upsert=True)
        await db.audit_events.update_one({'_id': 'refund:' + key}, {'$setOnInsert': {
            'admin_id': clean['admin_id'], 'admin_email': clean.get('admin_email'),
            'action': 'refund.create', 'entity_type': 'trip', 'entity_id': trip_id,
            'at': clean['created_at'], 'reason': clean['reason'],
            'after': {'amount': clean['amount'], 'provider': clean['provider'], 'status': clean['status']},
        }}, upsert=True)
        return clean

    trip = await db.trips.find_one({'trip_id': trip_id})
    if not trip:
        raise HTTPException(404, 'Fant ikke tur')
    for receipt in trip.get('admin_refunds', []):
        if receipt['id'] == op:
            if receipt['request'] != fingerprint:
                raise HTTPException(409, 'Operasjons-ID er allerede brukt med andre verdier')
            return await project(receipt)

    lock = trip.get('refund_lock')
    if lock and (lock['id'] != op or lock['request'] != fingerprint):
        raise HTTPException(409, 'Turen har en pågående refusjon. Fullfør eller avstem denne først.')
    if not lock:
        if trip.get('status') not in ('arrived', 'completed', 'rated'):
            raise HTTPException(400, 'Kan bare refundere fullførte turer')
        gross, already = int(trip.get('price') or 0), int(trip.get('refunded_total') or 0)
        eligible = gross - already
        amount = body.amount if body.amount is not None else eligible
        if amount <= 0 or amount > eligible:
            raise HTTPException(400, f'Ugyldig beløp. Maks refunderbart: {max(eligible, 0)} kr')
        charge = trip.get('stripe_payment_intent') or trip.get('payment_intent_id') or trip.get('charge_id')
        if body.mode == 'stripe' and (not charge or not stripe.api_key or payment_status(trip) not in ('paid', 'captured')):
            raise HTTPException(400, 'Stripe-refusjon krever en bekreftet betaling og tilknyttet betalingsreferanse')
        lock = {'id': op, 'request': fingerprint, 'trip_id': trip_id, 'user_id': trip.get('user_id'),
                'amount': amount, 'currency': 'NOK', 'reason': body.reason.strip(),
                'provider': body.mode, 'provider_ref': None, 'status': 'processing',
                'admin_id': current['id'], 'admin_email': current.get('email'),
                'created_at': datetime.now(timezone.utc).isoformat(), 'previous_total': already,
                'charge': charge, 'fleet_id': (trip.get('accounting') or {}).get('fleet_id')}
        claimed = await db.trips.find_one_and_update(
            {'trip_id': trip_id, 'refund_lock': {'$exists': False},
             'refunded_total': trip.get('refunded_total'), 'admin_refunds.id': {'$ne': op}},
            {'$set': {'refund_lock': lock}}, return_document=ReturnDocument.AFTER)
        if not claimed:
            # Another request won. Re-read once, returning its receipt or same lock.
            latest = await db.trips.find_one({'trip_id': trip_id})
            for receipt in latest.get('admin_refunds', []):
                if receipt['id'] == op and receipt['request'] == fingerprint:
                    return await project(receipt)
            lock = latest.get('refund_lock')
            if not lock or lock['id'] != op or lock['request'] != fingerprint:
                raise HTTPException(409, 'Refusjonsgrunnlaget ble endret. Oppdater turen og prøv igjen.')

    # Persist the outstanding operation before contacting a provider, so it is visible.
    await db.refunds.update_one({'_id': key}, {'$setOnInsert': {
        k: v for k, v in lock.items() if k not in ('request', 'charge', 'previous_total')
    }}, upsert=True)
    status, provider_ref = 'recorded', None
    if lock['provider'] == 'stripe':
        # Stripe may discard idempotency keys after 24h. Never retry blindly after that.
        age = datetime.now(timezone.utc) - datetime.fromisoformat(lock['created_at'])
        if age >= timedelta(hours=23):
            raise HTTPException(409, 'Refusjonen må avstemmes hos Stripe før videre behandling. Ikke opprett ny operasjon.')
        kwargs = {'amount': lock['amount'] * 100, 'reason': 'requested_by_customer',
                  'idempotency_key': 'kjapp-refund:' + key}
        kwargs['charge' if str(lock['charge']).startswith('ch_') else 'payment_intent'] = lock['charge']
        try:
            result = await asyncio.to_thread(stripe.Refund.create, **kwargs)
            status, provider_ref = result.get('status') or 'pending', result.get('id')
        except Exception:
            # Unknown outcome: preserve lock and balance. A retry must use the same key.
            await db.refunds.update_one({'_id': key}, {'$set': {'status': 'reconciliation_required'}})
            raise HTTPException(502, 'Uavklart Stripe-resultat. Prøv samme operasjon igjen; ikke opprett en ny refusjon.')

    receipt = {k: v for k, v in lock.items() if k not in ('charge', 'previous_total')}
    receipt.update(status=status, provider_ref=provider_ref)
    total = lock['previous_total'] + (0 if status in ('failed', 'canceled') else lock['amount'])
    finalized = await db.trips.find_one_and_update(
        {'trip_id': trip_id, 'refund_lock.id': op},
        {'$set': {'refunded_total': total, 'refund_status': 'full' if total >= int(trip.get('price') or 0) else 'partial'},
         '$push': {'admin_refunds': receipt}, '$unset': {'refund_lock': ''}},
        return_document=ReturnDocument.AFTER)
    if not finalized:
        latest = await db.trips.find_one({'trip_id': trip_id})
        receipt = next((r for r in latest.get('admin_refunds', []) if r['id'] == op), None)
        if not receipt:
            raise HTTPException(409, 'Refusjonen må avstemmes før videre behandling')
    return await project(receipt)
