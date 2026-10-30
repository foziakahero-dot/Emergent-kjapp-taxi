"""Explicit, isolated Resend delivery. Secrets and message bodies never enter logs."""
import os
import httpx
from email_delivery import resend_envelope


def resend_config():
    qa = os.getenv("APP_ENV", "").strip().lower() == "qa"
    prefix = "QA_" if qa else ""
    key = os.getenv(prefix + "RESEND_API_KEY", "").strip()
    sender = os.getenv(prefix + "RESEND_FROM_EMAIL", "").strip()
    enabled = bool(key and sender) and (not qa or os.getenv("QA_RESEND_ENABLED") == "true")
    return {"enabled": enabled, "key": key if enabled else "", "sender": sender if enabled else ""}


def send_resend_email(to_email, subject, html, *, idempotency_key):
    config = resend_config()
    if not config["enabled"]:
        return False
    try:
        payload = resend_envelope(config["sender"], to_email, subject, html, message_type="welcome")
        with httpx.Client(timeout=15, trust_env=False) as client:
            response = client.post("https://api.resend.com/emails", headers={
                "Authorization": f"Bearer {config['key']}",
                "Idempotency-Key": idempotency_key,
            }, json=payload)
        return response.status_code in (200, 201) and bool(response.json().get("id"))
    except Exception:
        return False
