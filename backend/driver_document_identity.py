"""Stripe-hosted document proof for new drivers. Driver approval stays in SNAR."""

import asyncio
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlsplit
from uuid import uuid4

import stripe
from bson import ObjectId
from driver_profile_match import PHOTO_FIELDS, compare_driver_files
from pydantic import BaseModel, StrictBool
from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pymongo import ReturnDocument


PROOF = "driver_document_identity"
RETURN_ORIGINS = {"qa": "https://api-qa.snarapp.no", "production": "https://api.kjappapp.no"}
RESULTS = {"requires_input", "processing", "verified", "canceled"}
EVENTS = {f"identity.verification_session.{status}" for status in RESULTS}
FIRST_CHECK_ONLY = {
    "identity_verified_at": None,
    "identity_recheck_reason": None,
    "identity_recheck_pending_reason": None,
    "active_trip_id": None,
}


@dataclass(frozen=True)
class IdentityConfig:
    key: str = field(repr=False)
    webhook_secret: str = field(repr=False)
    live: bool
    return_url: str

    def stripe_client(self):
        return stripe.StripeClient(
            self.key,
            max_network_retries=1,
            http_client=stripe.RequestsClient(timeout=8),
        )

    def client(self):
        return self.stripe_client().v1.identity.verification_sessions


def identity_config(environment):
    origin = RETURN_ORIGINS.get(environment)
    if origin is None:
        return None
    live = environment == "production"
    prefix = "SNAR_DRIVER_IDENTITY" if live else "QA_DRIVER_IDENTITY"
    key = os.getenv(f"{prefix}_STRIPE_KEY", "").strip()
    secret = os.getenv(f"{prefix}_STRIPE_WEBHOOK_SECRET", "").strip()
    key_prefix = "rk_live_" if live else "rk_test_"
    if os.getenv(f"{prefix}_ENABLED") != "true" or not key.startswith(key_prefix) or not secret.startswith("whsec_"):
        return None
    return IdentityConfig(key, secret, live, f"{origin}/api/driver/identity-verification/document/return")


def proof_summary(proof):
    if not proof or proof.get("status") not in RESULTS | {"creating"}:
        return None
    return {
        "provider": "stripe_identity",
        "profile_match": proof.get("profile_match"),
        "mode": "live" if proof.get("livemode") is True else "test",
        "status": proof["status"],
        "updated_at": proof.get("updated_at"),
    }


def eligible_driver(user_id):
    return {"_id": ObjectId(user_id), "role": "driver", "approved": {"$ne": True}, "disabled": {"$ne": True}}


def first_check_driver(user_id):
    return {
        **eligible_driver(user_id),
        **FIRST_CHECK_ONLY,
        "identity_verification_status": {"$in": [None, "not_submitted"]},
    }


def reviewable_session(driver):
    if (driver.get("approved") or driver.get("disabled")
            or driver.get("identity_verification_status") not in (None, "not_submitted")
            or any(driver.get(field) is not None for field in FIRST_CHECK_ONLY)):
        return None
    proof = driver.get(PROOF) or {}
    if proof.get("status") == "verified" and proof.get("livemode") is True:
        return proof.get("session_id")
    return None


async def confirm_live_proof(users, user_id, session_id, admin_id, next_check_at, *, evidence=None):
    reviewed_at = datetime.now(timezone.utc).isoformat()
    return await users.find_one_and_update(
        {
            **first_check_driver(user_id),
            **(evidence or {}),
            f"{PROOF}.session_id": session_id,
            f"{PROOF}.livemode": True,
            f"{PROOF}.status": "verified",
        },
        {"$set": {
            "identity_verification_status": "verified",
            "identity_verification_updated_at": reviewed_at,
            "identity_verified_at": reviewed_at,
            "next_identity_check_at": next_check_at,
            f"{PROOF}.reviewed_at": reviewed_at,
            f"{PROOF}.reviewed_by": admin_id,
        }},
        projection={"identity_verified_at": 1},
        return_document=ReturnDocument.AFTER,
    )


def _session_state(session, proof, config):
    document = (session.get("options") or {}).get("document") or {}
    session_id = session.get("id")
    if (
        not isinstance(session_id, str) or not session_id.startswith("vs_")
        or (proof.get("session_id") and session_id != proof["session_id"])
        or session.get("object") != "identity.verification_session"
        or session.get("type") != "document" or document.get("require_matching_selfie") is not True
        or session.get("livemode") is not config.live or proof.get("livemode") is not config.live
        or session.get("client_reference_id") != proof["attempt"]
        or session.get("status") not in RESULTS
    ):
        raise HTTPException(502, "ID-resultatet kunne ikke knyttes til denne kontrollen.")
    return session["status"], session_id


async def _save_result(users, owner, proof, session, config):
    status, session_id = _session_state(session, proof, config)
    if proof["status"] in {"verified", "canceled"}:
        return proof
    new_proof = {**proof, "status": status, "session_id": session_id, "updated_at": datetime.now(timezone.utc).isoformat()}
    result = await users.find_one_and_update(
        {
            **eligible_driver(owner),
            f"{PROOF}.attempt": proof["attempt"],
            f"{PROOF}.status": {"$nin": ["verified", "canceled"]},
        },
        {"$set": {PROOF: new_proof}},
        projection={PROOF: 1},
        return_document=ReturnDocument.AFTER,
    )
    if result:
        return result[PROOF]
    latest = await users.find_one(eligible_driver(owner), {PROOF: 1})
    if not latest or (latest.get(PROOF) or {}).get("attempt") != proof["attempt"]:
        raise HTTPException(409, "ID-kontrollen har endret seg. Hent status på nytt.")
    return latest[PROOF]


def _hosted_url(url):
    if not isinstance(url, str):
        return None
    try:
        target = urlsplit(url)
    except ValueError:
        return None
    if target.scheme == "https" and target.netloc == "verify.stripe.com":
        return url
    return None


class DocumentStart(BaseModel):
    profile_match_consent: StrictBool = False


def profile_match_enabled(environment):
    prefix = {"qa": "QA", "production": "SNAR"}.get(environment)
    return bool(prefix and os.getenv(f"{prefix}_DRIVER_PROFILE_MATCH_ENABLED") == "true")


async def _reserve_attempt(users, owner, config, consent=False):
    proof = {"attempt": uuid4().hex, "status": "creating", "livemode": config.live}
    driver = first_check_driver(owner)
    if consent:
        registered = await users.find_one(driver, {field: 1 for field in PHOTO_FIELDS}) or {}
        if not all(registered.get(field) for field in PHOTO_FIELDS):
            raise HTTPException(409, "Profilbilde og førerkort må være registrert først.")
        proof["comparison_inputs"] = {field: registered[field] for field in PHOTO_FIELDS}
        proof["consent_version"] = "profile-license-v1"
        proof["consented_at"] = datetime.now(timezone.utc).isoformat()
        driver.update(proof["comparison_inputs"])
    # One local slot per new driver. Stripe reuses the same idempotency key after network or DB failures.
    row = await users.find_one_and_update(
        {
            **driver,
            "$or": [{PROOF: {"$exists": False}}, {f"{PROOF}.status": "canceled"}],
        },
        {"$set": {PROOF: proof}},
        projection={PROOF: 1},
        return_document=ReturnDocument.AFTER,
    )
    if not row:
        row = await users.find_one(driver, {PROOF: 1})
    if not row:
        raise HTTPException(409, "Dokumentkontrollen gjelder nye sjåfører som venter på godkjenning.")
    proof = row.get(PROOF) or {}
    if proof.get("livemode") is not config.live or not proof.get("attempt"):
        raise HTTPException(409, "En annen ID-kontroll er registrert for kontoen.")
    if consent and proof.get("comparison_inputs") != {field: registered[field] for field in PHOTO_FIELDS}:
        raise HTTPException(409, "En tidligere ID-kontroll må fullføres eller behandles manuelt.")
    return proof


def profile_binding_current(driver):
    proof = driver.get(PROOF) or {}
    if proof.get("reviewed_by") != "stripe_identity_profile_match":
        return True
    inputs = proof.get("comparison_inputs") or {}
    return all(inputs.get(field) and inputs[field] == driver.get(field) for field in PHOTO_FIELDS)


def install_document_identity(api, db, require_driver, rate_limit, environment, schedule_recheck=None, read_file=None):
    def configured():
        config = identity_config(environment)
        if config is None:
            raise HTTPException(503, "Dokumentkontroll er ikke tilgjengelig i dette miljøet.")
        return config

    @api.post("/driver/identity-verification/document/start")
    async def start(request: Request, response: Response, body: DocumentStart | None = None, current=Depends(require_driver)):
        await rate_limit(request, "driver-document-id-start", 8, 3600)
        config = configured()
        proof = await _reserve_attempt(db.users, current["id"], config,
                                       bool(body and body.profile_match_consent and profile_match_enabled(environment)))
        response.headers["Cache-Control"] = "no-store"
        if proof["status"] == "verified":
            return {"proof": proof_summary(proof), "verification_url": None}
        sessions = config.client()
        try:
            if proof.get("session_id"):
                session = await asyncio.to_thread(sessions.retrieve, proof["session_id"])
            else:
                session = await asyncio.to_thread(sessions.create, {
                    "type": "document",
                    "client_reference_id": proof["attempt"],
                    "return_url": config.return_url,
                    "options": {"document": {"allowed_types": ["driving_license"], "require_matching_selfie": True}},
                }, {"idempotency_key": f"snar-driver-id-{proof['attempt']}"})
        except stripe.StripeError:
            raise HTTPException(502, "Kunne ikke åpne ID-kontrollen hos Stripe. Prøv igjen.") from None
        latest = await _save_result(db.users, current["id"], proof, session, config)
        url = _hosted_url(session.get("url")) if latest["status"] == session.get("status") == "requires_input" else None
        if latest["status"] == "requires_input" and url is None:
            raise HTTPException(502, "Stripe ga ingen gyldig lenke for ID-kontroll. Prøv igjen.")
        return {"proof": proof_summary(latest), "verification_url": url}

    @api.get("/driver/identity-verification/document/return", response_class=HTMLResponse)
    async def return_to_driver():
        return HTMLResponse(
            '<html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>SNAR · ID-kontroll</title><h1>Fortsett i SNAR Sjåfør</h1>'
            '<p>Gå tilbake til appen for å se status på ID-kontrollen.</p></html>',
            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
        )

    @api.post("/webhooks/stripe/driver-identity")
    async def identity_webhook(request: Request):
        config = configured()
        payload = bytearray()
        async for chunk in request.stream():
            if len(payload) + len(chunk) > 64_000:
                raise HTTPException(413, "Hendelsen er for stor.")
            payload.extend(chunk)
        try:
            event = stripe.Webhook.construct_event(bytes(payload), request.headers.get("Stripe-Signature", ""), config.webhook_secret)
        except (ValueError, stripe.SignatureVerificationError):
            raise HTTPException(400, "Ugyldig Stripe-signatur.") from None
        if event.get("livemode") is not config.live:
            raise HTTPException(400, "Stripe-hendelsen tilhører et annet miljø.")
        if event.get("type") not in EVENTS:
            return {"received": True}
        session = (event.get("data") or {}).get("object") or {}
        session_id = session.get("id")
        attempt = session.get("client_reference_id")
        if not isinstance(session_id, str) or not isinstance(attempt, str):
            raise HTTPException(400, "Stripe-hendelsen mangler referanse.")
        driver = await db.users.find_one({"role": "driver", f"{PROOF}.attempt": attempt},
                                         {PROOF: 1, "approved": 1, "disabled": 1})
        if not driver or driver.get("approved") is True or driver.get("disabled") is True:
            return {"received": True}
        proof = driver[PROOF]
        inputs = proof.get("comparison_inputs") or {}
        should_compare = (profile_match_enabled(environment) and read_file is not None
                          and proof.get("consent_version") == "profile-license-v1" and set(inputs) == set(PHOTO_FIELDS))
        if proof["status"] == "canceled" or (proof["status"] == "verified" and not should_compare):
            return {"received": True}
        # A queued event can arrive out of order. The session API gives the current result.
        try:
            latest = await asyncio.to_thread(config.client().retrieve, session_id)
        except stripe.StripeError:
            raise HTTPException(502, "Kunne ikke hente ID-resultatet hos Stripe.") from None
        saved = await _save_result(db.users, str(driver["_id"]), proof, latest, config)
        if should_compare and latest.get("status") == "verified" and saved["status"] == "verified":
            owner = str(driver["_id"])
            binding = {**first_check_driver(owner), **inputs, f"{PROOF}.attempt": attempt,
                       f"{PROOF}.session_id": session_id}
            bound = await db.users.find_one(binding)
            if not bound:
                await db.users.update_one({**first_check_driver(owner), f"{PROOF}.attempt": attempt,
                                           f"{PROOF}.profile_match": None},
                                          {"$set": {f"{PROOF}.profile_match": "manual_review"}})
            if bound:
                decision = bound[PROOF].get("profile_match")
                if decision is None:
                    matched = await compare_driver_files(db, bound, read_file, config.stripe_client(), latest)
                    decision = "matched" if matched else "manual_review"
                    await db.users.update_one({**binding, f"{PROOF}.profile_match": None},
                                              {"$set": {f"{PROOF}.profile_match": decision}})
                if config.live and decision == "matched" and schedule_recheck:
                    await confirm_live_proof(db.users, owner, session_id, "stripe_identity_profile_match",
                                             schedule_recheck(), evidence={**inputs, f"{PROOF}.profile_match": "matched"})
        return {"received": True}
