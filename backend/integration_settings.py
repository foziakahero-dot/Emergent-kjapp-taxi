"""Write-only, encrypted integration configuration for the SNAR superadmin.

Provider credentials never appear in summaries or audit records. The wrapping
key belongs to the hosting environment, not MongoDB or the repository.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError


GROUPS = {
    "stripe": [("STRIPE_SECRET_KEY", "Hemmelig API-nøkkel", True),
               ("STRIPE_PUBLISHABLE_KEY", "Publiserbar API-nøkkel", False),
               ("STRIPE_WEBHOOK_SECRET", "Webhook-signeringsnøkkel", True)],
    "sendgrid": [("SENDGRID_API_KEY", "SendGrid API-nøkkel", True),
                 ("SENDER_EMAIL", "Verifisert avsenderadresse", False)],
    "maps_routing": [("MAPTILER_API_KEY", "MapTiler API-nøkkel", True)],
    "fcm": [("FCM_SERVICE_ACCOUNT_JSON", "Firebase tjenestekonto (JSON)", True)],
    "google": [("GOOGLE_CLIENT_ID", "Google klient-ID", False),
               ("GOOGLE_CLIENT_SECRET", "Google klienthemmelighet", True)],
    "ai": [("SNAR_AI_KEY", "Emergent AI-nøkkel", True)],
}


class IntegrationSettings:
    def __init__(self, db, apply, verify_stripe=None):
        self.collection = db.integration_settings
        self.apply = apply
        self.verify_stripe = verify_stripe or self._verify_stripe
        self.lock = asyncio.Lock()
        self.revisions = {}
        self.baseline = {key: os.getenv(key, "") for fields in GROUPS.values() for key, _, _ in fields}
        self.baseline["SNAR_AI_KEY"] = self.baseline["SNAR_AI_KEY"] or os.getenv("EMERGENT_LLM_KEY", "")

    def cipher(self):
        key = os.getenv("SNAR_INTEGRATION_ENCRYPTION_KEY", "")
        if not key:
            raise HTTPException(503, "Sikker nøkkellagring er ikke konfigurert på serveren.")
        try:
            return Fernet(key.encode())
        except (ValueError, TypeError):
            raise HTTPException(503, "Serverens nøkkellagring må kontrolleres.") from None

    def decode(self, doc):
        if not doc:
            return {}
        try:
            return json.loads(self.cipher().decrypt(doc["encrypted"].encode()))
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "Lagrede integrasjonsinnstillinger kunne ikke åpnes.") from None

    async def refresh(self):
        async with self.lock:
            for doc in await self.collection.find({}).to_list(length=20):
                group = doc.get("_id")
                if group in GROUPS and self.revisions.get(group) != doc["revision"]:
                    values = self.decode(doc)
                    self.apply(values)
                    self.revisions[group] = doc["revision"]

    async def sync_loop(self):
        while True:
            try:
                await self.refresh()
            except Exception:
                logging.error("Integration settings refresh failed; existing configuration retained")
            await asyncio.sleep(5)

    async def summary(self):
        await self.refresh()
        docs = {d["_id"]: d for d in await self.collection.find({}).to_list(length=20)}
        try:
            self.cipher()
            writable = True
        except HTTPException:
            writable = False
        return {"writable": writable, "groups": {
            group: {"revision": docs.get(group, {}).get("revision", 0),
                    "updated_at": docs.get(group, {}).get("updated_at"),
                    "stripe_account_id": docs.get(group, {}).get("stripe_account_id"),
                    "fields": [{"key": key, "label": label, "secret": secret,
                                "configured": bool(os.getenv(key) or (self.baseline[key] if key == "SNAR_AI_KEY" else "")),
                                "value": None if secret else os.getenv(key, ""),
                                "source": "admin" if key in self.decode(docs.get(group)) else "server"}
                               for key, label, secret in fields]}
            for group, fields in GROUPS.items()}}

    @staticmethod
    async def _verify_stripe(key):
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                response = await client.get("https://api.stripe.com/v1/account", auth=(key, ""))
            if response.status_code != 200:
                raise ValueError()
            account = response.json().get("id", "")
            if not account.startswith("acct_"):
                raise ValueError()
            return account
        except Exception:
            raise HTTPException(400, "Stripe-nøkkelen kunne ikke verifiseres. Kontroller nøkkel og kontotilgang.") from None

    async def save(self, group, body, current):
        if group not in GROUPS:
            raise HTTPException(404, "Denne integrasjonen kan ikke konfigureres her.")
        cipher = self.cipher()
        if not isinstance(body, dict) or set(body) - {"values", "revision", "acknowledge_stripe_change"}:
            raise HTTPException(400, "Ugyldige innstillinger.")
        changes = body.get("values")
        allowed = {key for key, _, _ in GROUPS[group]}
        if (not isinstance(changes, dict) or not changes or set(changes) - allowed
                or any(not isinstance(v, str) or not v.strip() or len(v) > 32000 for v in changes.values())):
            raise HTTPException(400, "Oppgi gyldige verdier. Tomme felt beholder eksisterende verdi.")
        if type(body.get("revision")) is not int:
            raise HTTPException(400, "Last inn innstillingene på nytt før lagring.")
        changes = {k: v.strip() for k, v in changes.items()}
        async with self.lock:
            doc = await self.collection.find_one({"_id": group})
            revision = doc.get("revision", 0) if doc else 0
            if body["revision"] != revision:
                raise HTTPException(409, "Innstillingene er endret av en annen administrator. Last inn på nytt.")
            values = {k: self.baseline[k] for k in allowed}
            values.update(self.decode(doc))
            values.update(changes)
            account_id = (doc or {}).get("stripe_account_id")
            if group == "stripe":
                if body.get("acknowledge_stripe_change") is not True:
                    raise HTTPException(400, "Bekreft at alle Stripe-nøkler tilhører samme konto og modus.")
                if "STRIPE_SECRET_KEY" in changes and not allowed.issubset(changes):
                    raise HTTPException(400, "Ved bytte av hemmelig Stripe-nøkkel må alle tre nøklene oppgis samlet.")
                sk, pk, wh = (values[k] for k in ("STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"))
                mode = "test" if sk.startswith("sk_test_") else "live" if sk.startswith("sk_live_") else ""
                if not mode or not pk.startswith(f"pk_{mode}_") or not wh.startswith("whsec_"):
                    raise HTTPException(400, "Stripe krever hemmelig og publiserbar nøkkel i samme modus samt webhook-nøkkel.")
                # Production mode also controls legal/payment gates. Changing keys alone
                # must never silently activate live charges in a beta environment.
                if mode == "live" and os.getenv("APP_ENV", "").lower() != "production":
                    raise HTTPException(400, "Live-nøkler krever at serveren er konfigurert for produksjon. Beta bruker testnøkler.")
                account_id = await self.verify_stripe(sk)
            if group == "sendgrid":
                if not values["SENDGRID_API_KEY"].startswith("SG."):
                    raise HTTPException(400, "Oppgi en SendGrid API-nøkkel.")
                from email_validator import validate_email, EmailNotValidError
                try:
                    validate_email(values["SENDER_EMAIL"], check_deliverability=False)
                except EmailNotValidError:
                    raise HTTPException(400, "Oppgi en gyldig, verifisert avsenderadresse.") from None
            if group == "fcm":
                try:
                    from firebase_admin import credentials
                    credentials.Certificate(json.loads(values["FCM_SERVICE_ACCOUNT_JSON"]))
                except Exception:
                    raise HTTPException(400, "Firebase krever gyldig tjenestekonto-JSON med privat nøkkel.") from None
            saved = {"_id": group, "revision": revision + 1,
                     "encrypted": cipher.encrypt(json.dumps(values).encode()).decode(),
                     "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current["id"],
                     "stripe_account_id": account_id}
            if doc:
                result = await self.collection.replace_one({"_id": group, "revision": revision}, saved)
                if result.modified_count != 1:
                    raise HTTPException(409, "Innstillingene ble endret samtidig. Last inn på nytt.")
            else:
                try:
                    await self.collection.insert_one(saved)
                except DuplicateKeyError:
                    raise HTTPException(409, "Innstillingene ble endret samtidig. Last inn på nytt.") from None
            self.apply(values)
            self.revisions[group] = revision + 1
        return {"ok": True, "revision": revision + 1, "stripe_account_id": account_id,
                "updated_at": saved["updated_at"]}


def install_integration_settings(api, settings, require_superadmin, audit):
    @api.get("/admin/control/integration-settings")
    async def summary(current=Depends(require_superadmin)):
        return await settings.summary()

    @api.put("/admin/control/integration-settings/{group}")
    async def save(group: str, request: Request, current=Depends(require_superadmin)):
        raw = await request.body()
        if len(raw) > 64000:
            raise HTTPException(400, "Innstillingene er for store.")
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, "Ugyldige innstillinger.") from None
        result = await settings.save(group, body, current)
        await audit(current, "integration_configuration_updated", "integration", group,
                    after={"revision": result["revision"], "fields": sorted(body["values"]),
                           "stripe_account_id": result["stripe_account_id"]})
        return result
