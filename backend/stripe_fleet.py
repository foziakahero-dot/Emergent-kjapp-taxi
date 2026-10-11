"""Shared, idempotent Stripe account setup. No bank data or onboarding links in email."""
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Stripe Checkout setup-mode compatibility.
# The deployed Stripe API rejects setup_intent_data[usage]. Checkout mode="setup"
# already creates a SetupIntent suitable for saving the card, so strip only that
# unsupported nested field. server.py imports this module at startup, making this
# patch deterministic on Render without exposing or changing any secret values.
try:
    import stripe as _stripe

    _original_checkout_session_create = _stripe.checkout.Session.create

    def _checkout_session_create_compat(*args, **kwargs):
        if kwargs.get("mode") == "setup":
            setup_data = kwargs.get("setup_intent_data")
            if isinstance(setup_data, dict) and "usage" in setup_data:
                sanitized = dict(setup_data)
                sanitized.pop("usage", None)
                if sanitized:
                    kwargs["setup_intent_data"] = sanitized
                else:
                    kwargs.pop("setup_intent_data", None)
        return _original_checkout_session_create(*args, **kwargs)

    _stripe.checkout.Session.create = _checkout_session_create_compat
    print("[stripe-compat] saved-card Checkout compatibility enabled")
except Exception as exc:
    print(f"[stripe-compat] compatibility patch unavailable: {type(exc).__name__}")


async def ensure_fleet_account(db, stripe, fleet, owner_email=None):
    if not stripe.api_key:
        raise HTTPException(503, "Stripe er ikke konfigurert")
    if fleet.get("active") is False or fleet.get("status") == "suspended":
        raise HTTPException(403, "Løyvehaveren er ikke aktiv")
    if fleet.get("stripe_account_id"):
        return fleet["stripe_account_id"]
    fleet_id = str(fleet["_id"])
    try:
        account = await asyncio.to_thread(
            stripe.Account.create,
            type="express", country="NO", email=owner_email or fleet.get("contact_email"),
            capabilities={"transfers": {"requested": True}},
            metadata={"kjapp_fleet_id": fleet_id, "kjapp_org_number": fleet.get("org_number") or ""},
            idempotency_key=f"kjapp-fleet-account-v1-{fleet_id}",
        )
    except Exception as exc:
        error = (getattr(exc, "json_body", None) or {}).get("error", {})
        if not isinstance(error, dict):
            error = {}
        logger.warning(
            "Stripe Connect account creation failed: fleet=%s type=%s request_id=%s",
            fleet_id, type(exc).__name__, getattr(exc, "request_id", None),
        )
        message = str(error.get("message") or "").lower()
        if "signed up for connect" in message or "connect is not enabled" in message:
            raise HTTPException(
                503,
                "Stripe Connect er ikke aktivert på SNARs plattformkonto. "
                "Aktiver Connect for riktig konto og testmodus i Stripe Dashboard. "
                "Løyvehaverkontoen er allerede opprettet; ikke opprett den på nytt.",
            ) from None
        raise HTTPException(502, "Stripe-konto kunne ikke opprettes. Prøv igjen senere.")
    await db.fleets.update_one({"_id": fleet["_id"]}, {"$set": {
        "stripe_account_id": account.id, "stripe_connect_status": "onboarding",
        "stripe_payout_schedule": "stripe_default",
        "stripe_connected_at": datetime.now(timezone.utc).isoformat(),
    }})
    try:
        await asyncio.to_thread(stripe.Account.modify, account.id,
            settings={"payouts": {"schedule": {"interval": "weekly", "weekly_anchor": "friday"}}})
        await db.fleets.update_one({"_id": fleet["_id"]}, {"$set": {"stripe_payout_schedule": "weekly_friday"}})
    except Exception:
        pass  # Never promise a schedule that Stripe has not accepted.
    return account.id
