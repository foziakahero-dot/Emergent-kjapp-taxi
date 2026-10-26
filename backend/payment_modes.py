"""Keep Stripe test instruments out of live bookings and expose explicit activation."""
import asyncio
import os
import re
from bson import ObjectId
from fastapi import HTTPException


def is_live(stripe):
    return str(stripe.api_key or '').startswith(('sk_live_', 'rk_live_'))


def method_scope(stripe):
    return {'stripe_livemode': True if is_live(stripe) else {'$ne': True}}


def payment_config(stripe):
    key = os.getenv('STRIPE_PUBLISHABLE_KEY', '').strip()
    live = is_live(stripe)
    qa = os.getenv('APP_ENV', '').strip().lower() == 'qa' or os.getenv('QA_MODE', '').lower() == 'true'
    matching = key.startswith('pk_live_' if live else 'pk_test_') and str(stripe.api_key or '').startswith(('sk_live_', 'rk_live_') if live else ('sk_test_', 'rk_test_'))
    database = os.getenv('DB_NAME', '').strip().lower()
    production_data = bool(database and not re.search(r'(?:^|[_-])(?:qa|test|dev|development)(?:$|[_-])', database))
    live_allowed = (production_data and not qa and os.getenv('APP_ENV', '').strip().lower() == 'production'
                    and os.getenv('NATIVE_PAYMENTS_LIVE_ENABLED', '').lower() == 'true'
                    and bool(os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()))
    enabled = (os.getenv('NATIVE_PAYMENTS_ENABLED', '').lower() == 'true'
               and matching and (not live or live_allowed))
    return {'enabled': bool(enabled), 'publishable_key': key if enabled else '',
            'test_mode': not live, 'apple_merchant_id': os.getenv('APPLE_PAY_MERCHANT_ID', '').strip(),
            'google_pay_enabled': bool(enabled and os.getenv('GOOGLE_PAY_ENABLED', '').lower() == 'true')}


def stripe_client(stripe):
    return stripe.StripeClient(stripe.api_key, max_network_retries=1,
                               http_client=stripe.RequestsClient(timeout=15))


async def customer_for_user(db, stripe, user_id):
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(404, 'Bruker ikke funnet')
    live = is_live(stripe)
    field = 'stripe_customer_id_live' if live else 'stripe_customer_id_test'
    customer_id = user.get(field)
    if not customer_id and bool(user.get('stripe_customer_livemode', False)) == live:
        customer_id = user.get('stripe_customer_id')
    if not customer_id:
        customer = await asyncio.to_thread(stripe_client(stripe).v1.customers.create, {
            'email': user.get('email'), 'name': user.get('fullName') or user.get('email'),
            'metadata': {'user_id': user_id},
        }, {'idempotency_key': f'snar-customer-{user_id}-{"live" if live else "test"}'})
        customer_id = customer.id
    await db.users.update_one({'_id': user['_id']}, {'$set': {
        field: customer_id, 'stripe_customer_id': customer_id, 'stripe_customer_livemode': live,
    }})
    return customer_id
