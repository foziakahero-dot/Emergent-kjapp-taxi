"""Server-side transactional email transport. No credentials or message bodies in logs."""
import hashlib
import logging
import os
import httpx


def email_provider():
    explicit = os.getenv('EMAIL_PROVIDER', '').strip().lower()
    if explicit:
        return explicit
    # Preserve an existing SendGrid deployment until Resend is explicitly selected.
    return 'sendgrid' if os.getenv('SENDGRID_API_KEY', '').strip() else 'resend'


def email_configured():
    if os.getenv('APP_ENV', '').strip().lower() == 'qa':
        return False
    provider = email_provider()
    if provider == 'resend':
        return bool(os.getenv('RESEND_API_KEY', '').strip() and os.getenv('RESEND_FROM_EMAIL', '').strip())
    return provider == 'sendgrid' and bool(os.getenv('SENDGRID_API_KEY', '').strip())


def send_transactional_email(to_email, subject, html):
    if not email_configured():
        logging.info('Transactional email disabled or not configured')
        return False
    provider = email_provider()
    try:
        if provider == 'resend':
            # Stable for a retry of the same message; never contains a raw address/token.
            key = hashlib.sha256((to_email + '\0' + subject + '\0' + html).encode()).hexdigest()
            payload = {'from': os.environ['RESEND_FROM_EMAIL'].strip(), 'to': [to_email], 'subject': subject, 'html': html}
            response = httpx.post('https://api.resend.com/emails', json=payload, timeout=15,
                headers={'Authorization': 'Bearer ' + os.environ['RESEND_API_KEY'].strip(), 'Idempotency-Key': 'snar-' + key})
            if response.status_code == 200 and response.json().get('id'):
                return True
        else:
            response = httpx.post('https://api.sendgrid.com/v3/mail/send', timeout=15,
                headers={'Authorization': 'Bearer ' + os.environ['SENDGRID_API_KEY'].strip()},
                json={'personalizations': [{'to': [{'email': to_email}]}],
                      'from': {'email': os.getenv('SENDER_EMAIL', 'noreply@kjappapp.no').strip()},
                      'subject': subject, 'content': [{'type': 'text/html', 'value': html}]})
            if response.status_code == 202:
                return True
        logging.warning('Transactional email provider=%s status=%s', provider, response.status_code)
    except Exception:
        logging.warning('Transactional email provider=%s request failed', provider)
    return False
