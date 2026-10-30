"""Transactional mail with explicit provider selection and isolated QA credentials."""
import hashlib
import logging
import os
from email.utils import parseaddr

import httpx


def resend_envelope(sender, to_email, subject, html, *, message_type="notifications"):
    """Choose an environment-local sender and route human replies to a real mailbox."""
    if message_type not in {"notifications", "welcome", "security", "receipts"}:
        raise ValueError("Unknown transactional email type")
    qa = os.getenv("APP_ENV", "").strip().lower() == "qa"
    prefix = "QA_" if qa else ""
    override = os.getenv(prefix + "RESEND_" + message_type.upper() + "_FROM_EMAIL", "").strip()
    reply_to = os.getenv(prefix + "RESEND_REPLY_TO", "").strip()
    sender = override or sender
    for address in (sender, reply_to):
        if address and ("\r" in address or "\n" in address or "@" not in parseaddr(address)[1]):
            raise ValueError("Invalid transactional email address configuration")
    payload = {"from": sender, "to": [to_email], "subject": ("[QA] " if qa else "") + subject, "html": html}
    if reply_to:
        payload["reply_to"] = reply_to
    return payload


def email_config():
    if os.getenv("APP_ENV", "").strip().lower() == "qa":
        key = os.getenv("QA_RESEND_API_KEY", "").strip()
        sender = os.getenv("QA_RESEND_FROM_EMAIL", "").strip()
        enabled = os.getenv("QA_RESEND_ENABLED", "").strip().lower() == "true"
        return "resend", key, sender, bool(enabled and key and sender)
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    provider = provider or ("sendgrid" if os.getenv("SENDGRID_API_KEY", "").strip() else "resend")
    if provider == "resend":
        key = os.getenv("RESEND_API_KEY", "").strip()
        sender = os.getenv("RESEND_FROM_EMAIL", "").strip()
    elif provider == "sendgrid":
        key = os.getenv("SENDGRID_API_KEY", "").strip()
        sender = os.getenv("SENDER_EMAIL", "noreply@kjappapp.no").strip()
    else:
        return provider, "", "", False
    return provider, key, sender, bool(key and sender)


def email_configured():
    return email_config()[3]


def send_transactional_email(to_email, subject, html, *, message_type="notifications"):
    provider, key, sender, enabled = email_config()
    if not enabled:
        return False
    try:
        with httpx.Client(timeout=15, trust_env=False) as client:
            if provider == "resend":
                payload = resend_envelope(sender, to_email, subject, html, message_type=message_type)
                identity = hashlib.sha256((to_email + "\0" + subject + "\0" + html).encode()).hexdigest()
                response = client.post("https://api.resend.com/emails", headers={
                    "Authorization": "Bearer " + key, "Idempotency-Key": "snar-" + identity,
                }, json=payload)
                if response.status_code in (200, 201) and response.json().get("id"):
                    return True
            else:
                response = client.post("https://api.sendgrid.com/v3/mail/send", headers={
                    "Authorization": "Bearer " + key,
                }, json={"personalizations": [{"to": [{"email": to_email}]}],
                         "from": {"email": sender}, "subject": subject,
                         "content": [{"type": "text/html", "value": html}]})
                if response.status_code == 202:
                    return True
            logging.warning("Transactional email provider=%s status=%s", provider, response.status_code)
    except Exception:
        logging.warning("Transactional email provider=%s request failed", provider)
    return False
