"""Account-owned business card selection with a paid receipt for work rides."""
import os

import httpx
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from payment_modes import method_scope, payment_config


class BusinessProfileInput(BaseModel):
    organisation_number: str = Field(pattern=r"^\d{9}$")
    payment_method_id: str = Field(pattern=r"^[a-fA-F0-9]{24}$")


def business_payments_enabled(stripe):
    config = payment_config(stripe)
    return os.getenv("APP_ENV") == "qa" and config["enabled"] and config["test_mode"]


async def business_card(db, stripe, user_id, payment_method_id):
    if not ObjectId.is_valid(payment_method_id):
        return None
    return await db.payment_methods.find_one({
        "_id": ObjectId(payment_method_id), "user_id": user_id,
        **method_scope(stripe), "verified": True, "setup_status": "succeeded",
        "wallet": None, "stripe_payment_method_id": {"$type": "string"},
    })


async def current_business_profile(db, user_id):
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"business_billing": 1})
    return (user or {}).get("business_billing")


async def registered_company(org_number):
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(6, connect=3)) as client:
            response = await client.get(f"https://data.brreg.no/enhetsregisteret/api/enheter/{org_number}")
            if response.status_code in (404, 410):
                raise HTTPException(422, "Organisasjonsnummeret finnes ikke som aktiv enhet.")
            response.raise_for_status()
        company = response.json()
        if company.get("organisasjonsnummer") != org_number or not company.get("navn") or company.get("slettedato"):
            raise HTTPException(422, "Organisasjonsnummeret finnes ikke som aktiv enhet.")
        return {"organisation_number": org_number, "company_name": company["navn"]}
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        raise HTTPException(503, "Kunne ikke bekrefte virksomheten hos Brønnøysundregistrene.") from exc


def install_business_payment(api, db, stripe, require_customer, rate_limit):
    @api.get("/me/business-payment")
    async def get_business_payment(current=Depends(require_customer)):
        if not business_payments_enabled(stripe):
            return {"enabled": False, "profile": None, "card_ready": False}
        profile = await current_business_profile(db, current["id"])
        card = await business_card(db, stripe, current["id"], profile["payment_method_id"]) if profile else None
        return {"enabled": True, "profile": profile, "card_ready": bool(card)}

    @api.put("/me/business-payment")
    async def set_business_payment(body: BusinessProfileInput, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "business-payment-profile", 10, 60)
        if not business_payments_enabled(stripe):
            raise HTTPException(503, "Bedriftskort er midlertidig utilgjengelig.")
        if not await business_card(db, stripe, current["id"], body.payment_method_id):
            raise HTTPException(422, "Velg et av dine verifiserte betalingskort.")
        profile = {**await registered_company(body.organisation_number), "payment_method_id": body.payment_method_id}
        await db.users.update_one({"_id": ObjectId(current["id"])}, {"$set": {"business_billing": profile}})
        return {"enabled": True, "profile": profile, "card_ready": True}
