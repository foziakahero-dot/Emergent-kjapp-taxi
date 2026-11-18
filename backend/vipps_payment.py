"""Isolated Vipps/MobilePay ePayment reservation flow for QA rides."""
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse
from pymongo.errors import DuplicateKeyError


API = "https://apitest.vipps.no"
QA_ORIGIN = "https://api-qa.snarapp.no"
TERMINAL = {"ABORTED", "EXPIRED", "TERMINATED"}
CANCELLED = {"cancelled", "cancelled_by_driver"}
FINISHED = {"arrived", "completed", "rated"}
SECRETS = (
    "QA_VIPPS_CLIENT_ID", "QA_VIPPS_CLIENT_SECRET", "QA_VIPPS_SUBSCRIPTION_KEY",
    "QA_VIPPS_MERCHANT_SERIAL_NUMBER", "QA_VIPPS_WEBHOOK_SECRET",
)


def credentials_present():
    return (os.getenv("APP_ENV", "").strip().lower() == "qa"
            and all(os.getenv(key, "").strip() for key in SECRETS)
            and bool(re.fullmatch(r"\d{4,10}", os.getenv(SECRETS[3], "").strip())))


def vipps_configured():
    return credentials_present() and os.getenv("QA_VIPPS_ENABLED", "").strip().lower() == "true"


def merchant_number():
    return os.getenv(SECRETS[3], "").strip()


def valid_reference(value):
    try:
        return str(UUID(value)) == value
    except (ValueError, TypeError, AttributeError):
        return False


def redirect_url(value):
    try:
        url = urlsplit(value)
        if (url.scheme == "https" and not (url.username or url.password or url.port)
                and url.hostname and re.fullmatch(r"(?:[a-z0-9-]+\.)*(?:vipps\.no|mobilepay\.dk|vippsmobilepay\.com)", url.hostname)):
            return value
    except (ValueError, TypeError, AttributeError):
        pass
    raise HTTPException(503, "Vipps/MobilePay svarte med en ugyldig betalingslenke.")


def retry_payment(reference):
    return HTTPException(503, {"code": "vipps_retry_pending", "trip_id": reference,
                               "message": "Venter på svar fra Vipps/MobilePay. Prøv igjen fra den aktive turen."})


class VippsClient:
    def __init__(self):
        self.token = None
        self.expires_at = 0.0
        self.token_scope = None

    async def request(self, method, reference, path="", *, payload=None, operation=None, missing_ok=False):
        if not credentials_present() or not valid_reference(reference):
            raise HTTPException(503, "Vipps/MobilePay er utilgjengelig i QA.")
        subscription_key = os.environ[SECRETS[2]].strip()
        scope = (merchant_number(), os.environ[SECRETS[0]].strip())
        headers = {"Ocp-Apim-Subscription-Key": subscription_key, "Merchant-Serial-Number": scope[0],
                   "Vipps-System-Name": "SNAR", "Vipps-System-Version": "1.0.1"}
        try:
            async with httpx.AsyncClient(base_url=API, timeout=httpx.Timeout(8, connect=3)) as client:
                if not self.token or time.monotonic() >= self.expires_at or self.token_scope != scope:
                    response = await client.post("/accesstoken/get", headers={
                        **headers, "client_id": scope[1], "client_secret": os.environ[SECRETS[1]].strip(),
                    })
                    response.raise_for_status()
                    auth = response.json()
                    self.token = auth["access_token"]
                    self.token_scope = scope
                    self.expires_at = time.monotonic() + max(0, int(auth.get("expires_in", 3600)) - 60)
                headers["Authorization"] = f"Bearer {self.token}"
                if operation:
                    headers["Idempotency-Key"] = hashlib.sha256(operation.encode()).hexdigest()[:40]
                endpoint = "/epayment/v1/payments"
                if operation != f"create-{reference}":
                    endpoint += f"/{reference}{path}"
                response = await client.request(method, endpoint, headers=headers, json=payload)
                if response.status_code == 404 and missing_ok:
                    return None
                if response.status_code == 401:
                    self.token = None
                response.raise_for_status()
                result = response.json()
                if not isinstance(result, dict):
                    raise ValueError("unexpected payment response")
                return result
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise retry_payment(reference) from exc


@dataclass(frozen=True)
class PaymentState:
    state: str
    authorized: int
    captured: int
    cancelled: int
    refunded: int

    @property
    def remaining(self):
        return self.authorized - self.captured - self.cancelled


def read_payment(response, reference, amount):
    def ore(value):
        if (not isinstance(value, dict) or value.get("currency") != "NOK"
                or type(value.get("value")) is not int or value["value"] < 0):
            raise ValueError("invalid amount")
        return value["value"]

    try:
        state = response["state"]
        if response["reference"] != reference or ore(response["amount"]) != amount:
            raise ValueError("unexpected payment")
        if state == "CREATED" or state in TERMINAL:
            return PaymentState(state, 0, 0, 0, 0)
        aggregate = response["aggregate"]
        payment = PaymentState(state, *(ore(aggregate[key]) for key in (
            "authorizedAmount", "capturedAmount", "cancelledAmount", "refundedAmount",
        )))
        if state != "AUTHORIZED" or payment.authorized != amount or payment.remaining < 0 or payment.refunded > payment.captured:
            raise ValueError("invalid payment totals")
        return payment
    except (TypeError, ValueError, KeyError) as exc:
        raise HTTPException(409, "Vipps-reservasjonen samsvarer ikke med turen.") from exc


class VippsReservations:
    def __init__(self, db, *, dispatch, mark_paid, receipts, client=None):
        self.db, self.dispatch, self.mark_paid, self.receipts = db, dispatch, mark_paid, receipts
        self.client = client or VippsClient()

    def record_query(self, trip):
        return {"trip_id": trip["trip_id"], "kind": "ride_reservation", "user_id": trip["user_id"], "payment_provider": "vipps"}

    async def record(self, trip):
        record = await self.db.payment_transactions.find_one(self.record_query(trip))
        if record and (record.get("merchant_serial_number") != merchant_number() or record.get("test_mode") is not True):
            raise HTTPException(409, "Reservasjonen tilhører et annet betalingsmiljø.")
        return record

    async def state(self, record, *, missing_ok=False):
        response = await self.client.request("GET", record["trip_id"], missing_ok=missing_ok)
        return read_payment(response, record["trip_id"], record["authorized_amount_ore"]) if response is not None else None

    async def authorize(self, trip):
        reference = trip["trip_id"]
        if not vipps_configured():
            raise HTTPException(503, "Vipps/MobilePay er utilgjengelig i QA.")
        if not await self.db.trips.find_one({"trip_id": reference, "user_id": trip["user_id"], "status": "payment_authorizing"}):
            raise HTTPException(409, "Turen venter ikke på betalingsgodkjenning.")
        amount = int(trip["reservation_limit_ore"])
        query = self.record_query(trip)
        record = await self.record(trip)
        if not record:
            try:
                await self.db.payment_transactions.update_one(query, {"$setOnInsert": {
                    **query, "session_id": f"vipps:{reference}", "authorized_amount_ore": amount,
                    "merchant_serial_number": merchant_number(), "test_mode": True,
                    "status": "authorizing", "created_at": datetime.now(timezone.utc).isoformat(),
                }}, upsert=True)
            except DuplicateKeyError:
                pass
            record = await self.record(trip)
        if not record or record["authorized_amount_ore"] != amount:
            raise HTTPException(409, "Reservasjonsbeløpet er endret.")
        payment = await self.state(record, missing_ok=True)
        if payment and payment.state != "CREATED":
            return await self.confirm(trip, record, payment)
        url = record.get("redirect_url")
        if not url or not payment:
            if not await self.db.trips.find_one({"trip_id": reference, "status": "payment_authorizing"}):
                raise HTTPException(409, "Turen er avbestilt.")
            await self.db.payment_transactions.update_one(query, {"$set": {"create_attempted_at": datetime.now(timezone.utc).isoformat()}})
            created = await self.client.request("POST", reference, operation=f"create-{reference}", payload={
                "reference": reference, "amount": {"currency": "NOK", "value": amount},
                "paymentMethod": {"type": "WALLET"}, "userFlow": "WEB_REDIRECT",
                "returnUrl": f"{QA_ORIGIN}/api/payments/vipps/return?trip_id={reference}",
                "paymentDescription": "SNAR QA – reservasjon for tur",
            })
            if created.get("reference") != reference:
                raise retry_payment(reference)
            url = redirect_url(created.get("redirectUrl"))
            await self.db.payment_transactions.update_one(query, {"$set": {"redirect_url": url}})
            if not await self.db.trips.find_one({"trip_id": reference, "status": "payment_authorizing"}):
                await self.release(trip)
                raise HTTPException(409, "Turen er avbestilt.")
        raise HTTPException(402, {"code": "vipps_redirect_required", "trip_id": reference, "redirect_url": redirect_url(url)})

    async def confirm(self, trip, record=None, payment=None):
        record = record or await self.record(trip)
        if not record:
            raise HTTPException(409, "Vipps-reservasjonen finnes ikke.")
        payment = payment or await self.state(record)
        reference = trip["trip_id"]
        query = {"trip_id": reference, "user_id": trip["user_id"]}
        if payment.state in TERMINAL:
            await self.db.trips.update_one({**query, "status": "payment_authorizing"}, {"$set": {
                "status": "cancelled", "cancel_reason": "payment_authorization_failed", "cancelled_by": "system",
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
            }})
            await self.release(trip, record, payment)
            raise HTTPException(402, "Vipps/MobilePay godkjente ikke reservasjonen.")
        if payment.state != "AUTHORIZED" or payment.captured or payment.remaining != record["authorized_amount_ore"]:
            raise HTTPException(402, "Turbeløpet venter på godkjenning i Vipps/MobilePay.")
        updated = await self.db.trips.update_one({**query, "status": "payment_authorizing"}, {"$set": {
            "status": "searching", "payment_status": "reserved", "reservation_status": "authorized",
            "authorized_amount_ore": payment.authorized, "authorized_at": datetime.now(timezone.utc).isoformat(),
        }})
        fresh = await self.db.trips.find_one(query)
        if fresh and fresh.get("status") in CANCELLED:
            await self.release(fresh)
            raise HTTPException(409, "Turen er avbestilt.")
        if updated.modified_count:
            try:
                await self.dispatch(fresh)
            except Exception:
                logging.warning("Vipps QA dispatch pending: %s", reference)
            fresh = await self.db.trips.find_one(query)
        if not fresh:
            raise HTTPException(404, "Tur ikke funnet.")
        fresh.pop("_id", None)
        return fresh

    async def require_reserved(self, trip):
        record = await self.record(trip)
        payment = await self.state(record) if record else None
        if (not payment or payment.state != "AUTHORIZED" or payment.captured
                or payment.remaining < int(trip["price"]) * 100):
            raise HTTPException(402, "Vipps-reservasjonen er ikke gyldig. Turen kan ikke startes.")

    async def capture(self, trip):
        reference = trip["trip_id"]
        trip = await self.db.trips.find_one({"trip_id": reference}) or trip
        if trip.get("status") not in FINISHED:
            raise HTTPException(409, "Turen må være avsluttet før beløpet trekkes.")
        if trip.get("payment_status") == "paid":
            return {"attempted": False, "paid": True}
        amount = int(trip["price"]) * 100
        try:
            record = await self.record(trip)
            if not record or amount <= 0 or amount > record["authorized_amount_ore"]:
                raise HTTPException(409, "Turprisen samsvarer ikke med reservasjonen.")
            payment = await self.state(record)
            if payment.state != "AUTHORIZED" or payment.refunded:
                raise HTTPException(409, "Vipps-reservasjonen er ikke gyldig.")
            if not payment.captured and payment.remaining >= amount:
                await self.client.request("POST", reference, "/capture", operation=f"capture-{reference}-{amount}",
                                          payload={"modificationAmount": {"currency": "NOK", "value": amount}})
                payment = await self.state(record)
            if payment.captured != amount or payment.refunded:
                raise HTTPException(409, "Vipps/MobilePay har ikke bekreftet turbeløpet.")
            if payment.remaining:
                await self.client.request("POST", reference, "/cancel", operation=f"release-{reference}")
                payment = await self.state(record)
            if payment.remaining or payment.refunded or payment.captured != amount:
                raise HTTPException(409, "Vipps/MobilePay har ikke frigitt ubenyttet reservasjon.")
            await self.db.payment_transactions.update_one(self.record_query(trip), {"$set": {
                "status": "completed", "payment_status": "paid", "amount": amount / 100,
                "settlement_model": "vipps_qa", "updated_at": datetime.now(timezone.utc),
            }})
            await self.db.trips.update_one({"trip_id": reference}, {"$set": {
                "reservation_status": "captured", "price_review_required": False, "requires_manual_settlement": True,
            }})
            await self.mark_paid(reference, trip["user_id"])
            await self.receipts(reference)
            return {"attempted": True, "paid": True}
        except HTTPException:
            await self.db.trips.update_one({"trip_id": reference, "payment_status": {"$ne": "paid"}}, {"$set": {
                "payment_status": "capture_pending", "capture_failure_code": "vipps_capture_unconfirmed",
                "requires_manual_settlement": True,
            }})
            return {"attempted": True, "paid": False, "reason": "capture_pending"}

    async def release(self, trip, record=None, payment=None):
        reference = trip["trip_id"]
        try:
            record = record or await self.record(trip)
            if record:
                payment = payment or await self.state(record, missing_ok=True)
                if payment and (payment.state == "CREATED" or payment.remaining):
                    await self.client.request("POST", reference, "/cancel", operation=f"release-{reference}")
                    payment = await self.state(record)
                if payment and (payment.state == "CREATED" or payment.remaining or payment.captured):
                    return
                attempted = record.get("create_attempted_at")
                if payment is None and attempted and datetime.now(timezone.utc) - datetime.fromisoformat(attempted) < timedelta(seconds=45):
                    return
                await self.db.payment_transactions.update_one(self.record_query(trip), {"$set": {"status": "canceled", "payment_status": "released"}})
            await self.db.trips.update_one({"trip_id": reference, "status": {"$in": list(CANCELLED)}}, {"$set": {
                "reservation_status": "released", "payment_status": "not_due",
            }})
        except HTTPException:
            logging.warning("Vipps QA release pending: %s", reference)


def valid_webhook(headers, path, body, secret, now):
    try:
        date, host = headers["x-ms-date"], headers["host"]
        if abs((now - parsedate_to_datetime(date)).total_seconds()) > 300:
            return False
        content_hash = base64.b64encode(hashlib.sha256(body).digest()).decode()
        if not hmac.compare_digest(headers["x-ms-content-sha256"], content_hash):
            return False
        signature = hmac.new(secret.encode(), f"POST\n{path}\n{date};{host};{content_hash}".encode(), hashlib.sha256).digest()
        expected = "HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=" + base64.b64encode(signature).decode()
        return hmac.compare_digest(headers["authorization"], expected)
    except (KeyError, TypeError, ValueError, OverflowError):
        return False


def install_vipps(api, reservations):
    @api.get("/payments/vipps/config")
    async def vipps_config():
        return {"enabled": vipps_configured(), "provider": "Vipps"}

    @api.get("/payments/vipps/return", response_class=HTMLResponse)
    async def vipps_return(trip_id: str):
        if not credentials_present() or not valid_reference(trip_id):
            raise HTTPException(404, "Betalingsreturen er utilgjengelig.")
        return HTMLResponse(f'<!doctype html><html lang="nb"><meta charset="utf-8"><title>SNAR</title>'
                            f'<p>Åpne SNAR for å se status på bestillingen.</p><a href="kjapp://booking/{trip_id}">Åpne SNAR</a>',
                            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})

    @api.post("/payments/vipps/webhook")
    async def vipps_webhook(request: Request):
        if not credentials_present():
            raise HTTPException(404, "Vipps/MobilePay er utilgjengelig.")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                raise HTTPException(413, "Meldingen er for stor.")
        path = request.url.path + (f"?{request.url.query}" if request.url.query else "")
        if not valid_webhook(request.headers, path, body, os.environ[SECRETS[4]].strip(), datetime.now(timezone.utc)):
            raise HTTPException(401, "Ugyldig Vipps-signatur.")
        try:
            event = json.loads(body)
            reference = event.get("reference")
        except (ValueError, AttributeError) as exc:
            raise HTTPException(400, "Ugyldig Vipps-melding.") from exc
        if not valid_reference(reference) or str(event.get("msn", "")) != merchant_number():
            return {"ok": True}
        trip = await reservations.db.trips.find_one({"trip_id": reference, "payment_provider": "vipps"})
        if trip and trip.get("status") in CANCELLED:
            await reservations.release(trip)
        elif trip and trip.get("status") == "payment_authorizing":
            try:
                await reservations.confirm(trip)
            except HTTPException as exc:
                if exc.status_code not in {402, 409}:
                    raise
        return {"ok": True}
