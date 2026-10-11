"""Fail-closed configuration checks for isolated QA deployments."""
from __future__ import annotations

import re
from urllib.parse import urlsplit
from typing import Mapping


PRODUCTION_WEB_HOSTS = {
    "snarapp.no",
    "admin.snarapp.no",
    "fleet.snarapp.no",
    "kjappapp.no",
    "admin.kjappapp.no",
    "fleet.kjappapp.no",
}
PRODUCTION_DATABASE_NAMES = {
    "kjapp",
    "kjapp_prod",
    "kjapp_production",
    "prod",
    "production",
}
PRODUCTION_HOST_TOKEN = re.compile(r"(?:^|[.-])prod(?:uction)?\d*(?:[.-]|$)", re.IGNORECASE)


def is_safe_qa_web_origin(value: str) -> bool:
    """Require a single HTTPS QA origin and reject known production web hosts."""
    origin = (value or "").strip()
    try:
        parsed = urlsplit(origin)
        hostname = (parsed.hostname or "").lower()
        return (
            parsed.scheme == "https"
            and bool(hostname)
            and hostname not in PRODUCTION_WEB_HOSTS
            and not PRODUCTION_HOST_TOKEN.search(hostname)
            and parsed.path in ("", "/")
            and not parsed.query
            and not parsed.fragment
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        return False


def validate_qa_stripe_configuration(env: Mapping[str, str]) -> None:
    """Reject live-mode or mismatched Stripe keys without exposing their values."""
    secret_key = (env.get("STRIPE_SECRET_KEY") or "").strip()
    publishable_key = (env.get("STRIPE_PUBLISHABLE_KEY") or "").strip()

    if secret_key and not secret_key.startswith(("sk_test_", "rk_test_")):
        raise RuntimeError("APP_ENV=qa only permits Stripe test-mode secret keys.")
    if publishable_key and not publishable_key.startswith("pk_test_"):
        raise RuntimeError("APP_ENV=qa only permits Stripe test-mode publishable keys.")
    if secret_key and publishable_key and (
        (secret_key.startswith("sk_test_") and not publishable_key.startswith("pk_test_"))
        or (secret_key.startswith("rk_test_") and not publishable_key.startswith("pk_test_"))
    ):
        raise RuntimeError("APP_ENV=qa Stripe keys must both use test mode.")


def validate_qa_configuration(env: Mapping[str, str]) -> None:
    """Require an explicitly QA-named database and reject clearly production targets."""
    if (env.get("APP_ENV") or "").strip().lower() != "qa":
        return

    database_name = (env.get("DB_NAME") or "").strip()
    normalized_name = database_name.lower()
    if normalized_name in PRODUCTION_DATABASE_NAMES or not re.search(
        r"(?:^|[_-])qa(?:$|[_-])", normalized_name
    ):
        raise RuntimeError("APP_ENV=qa requires a separate QA-named MongoDB database.")

    mongo_url = (env.get("MONGO_URL") or "").strip()
    try:
        mongo_host = (urlsplit(mongo_url).hostname or "").lower()
    except ValueError:
        mongo_host = ""
    if not mongo_host:
        raise RuntimeError("APP_ENV=qa requires a valid MongoDB URI.")
    if PRODUCTION_HOST_TOKEN.search(mongo_host):
        raise RuntimeError("APP_ENV=qa cannot use a MongoDB host identified as production.")

    validate_qa_stripe_configuration(env)
    for name in (
        "FRONTEND_URL",
        "KJAPP_PUBLIC_WEB_ORIGIN",
        "PASSWORD_RESET_WEB_BASE",
        "FLEET_PUBLIC_URL",
    ):
        configured_origin = (env.get(name) or "").strip()
        if configured_origin and not is_safe_qa_web_origin(configured_origin):
            raise RuntimeError(f"APP_ENV=qa requires a non-production HTTPS origin for {name}.")
    checkout_origins = (env.get("KJAPP_CHECKOUT_ALLOWED_ORIGINS") or "").strip()
    if checkout_origins and any(
        not is_safe_qa_web_origin(origin)
        for origin in checkout_origins.split(",")
        if origin.strip()
    ):
        raise RuntimeError("APP_ENV=qa checkout origins must all be isolated HTTPS origins.")


def reject_live_qa_stripe_event(app_env: str, event: Mapping[str, object]) -> bool:
    """Return true for a live-mode event that must not be processed by the QA API."""
    return app_env.strip().lower() == "qa" and event.get("livemode") is True
