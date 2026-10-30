"""Exercise real Resend request payloads without sending mail or using real keys."""
import json

import httpx
import pytest

from email_delivery import send_transactional_email
from resend_email import send_resend_email


@pytest.fixture
def mail(monkeypatch):
    monkeypatch.setenv("APP_ENV", "qa")
    monkeypatch.setenv("QA_RESEND_ENABLED", "true")
    monkeypatch.setenv("QA_RESEND_API_KEY", "synthetic-qa-key")
    monkeypatch.setenv("QA_RESEND_FROM_EMAIL", "SNAR QA <post@qa.example.test>")
    monkeypatch.setenv("QA_RESEND_WELCOME_FROM_EMAIL", "SNAR QA <velkommen@qa.example.test>")
    monkeypatch.setenv("QA_RESEND_SECURITY_FROM_EMAIL", "SNAR QA <sikkerhet@qa.example.test>")
    monkeypatch.setenv("QA_RESEND_RECEIPTS_FROM_EMAIL", "SNAR QA <kvittering@qa.example.test>")
    monkeypatch.setenv("QA_RESEND_REPLY_TO", "support@example.test")
    requests = []

    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={"id": "synthetic-message"})

    client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: client(transport=httpx.MockTransport(handle), **kwargs))
    return requests


@pytest.mark.parametrize("kind,local_part", [("notifications", "post"), ("security", "sikkerhet"), ("receipts", "kvittering")])
def test_transactional_payload_routes_sender_and_replies(mail, kind, local_part):
    assert send_transactional_email("recipient@example.test", "SNAR", "<p>Hei</p>", message_type=kind)
    payload = json.loads(mail[0].content)
    assert payload["from"] == f"SNAR QA <{local_part}@qa.example.test>"
    assert payload["reply_to"] == "support@example.test"
    assert payload["subject"] == "[QA] SNAR"
    assert mail[0].headers["authorization"] == "Bearer synthetic-qa-key"


def test_customer_welcome_uses_same_qa_reply_settings(mail):
    assert send_resend_email("recipient@example.test", "Velkommen", "<p>Hei</p>", idempotency_key="synthetic/welcome")
    payload = json.loads(mail[0].content)
    assert payload["from"] == "SNAR QA <velkommen@qa.example.test>"
    assert payload["reply_to"] == "support@example.test"
    assert payload["subject"] == "[QA] Velkommen"
    assert mail[0].headers["idempotency-key"] == "synthetic/welcome"


def test_qa_never_inherits_production_sender_or_reply_to(mail, monkeypatch):
    monkeypatch.delenv("QA_RESEND_RECEIPTS_FROM_EMAIL")
    monkeypatch.delenv("QA_RESEND_REPLY_TO")
    monkeypatch.setenv("RESEND_RECEIPTS_FROM_EMAIL", "billing@production.example.test")
    monkeypatch.setenv("RESEND_REPLY_TO", "support@production.example.test")
    assert send_transactional_email("recipient@example.test", "Receipt", "body", message_type="receipts")
    payload = json.loads(mail[0].content)
    assert payload["from"] == "SNAR QA <post@qa.example.test>"
    assert "reply_to" not in payload


def test_production_never_inherits_qa_sender_or_subject_prefix(mail, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "synthetic-production-key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "SNAR <post@example.test>")
    monkeypatch.setenv("RESEND_RECEIPTS_FROM_EMAIL", "SNAR <kvittering@example.test>")
    monkeypatch.setenv("RESEND_REPLY_TO", "post@example.test")
    assert send_transactional_email("recipient@example.test", "Receipt", "body", message_type="receipts")
    payload = json.loads(mail[0].content)
    assert payload["from"] == "SNAR <kvittering@example.test>"
    assert payload["subject"] == "Receipt" and payload["reply_to"] == "post@example.test"
    assert mail[0].headers["authorization"] == "Bearer synthetic-production-key"


@pytest.mark.parametrize("setting", ["QA_RESEND_REPLY_TO", "QA_RESEND_RECEIPTS_FROM_EMAIL"])
def test_bad_address_configuration_never_sends(mail, monkeypatch, setting):
    monkeypatch.setenv(setting, "sender@example.test\r\nBcc:other@example.test")
    assert not send_transactional_email("recipient@example.test", "Receipt", "body", message_type="receipts")
    assert mail == []


def test_disabled_qa_never_sends_even_with_configured_envelopes(mail, monkeypatch):
    monkeypatch.setenv("QA_RESEND_ENABLED", "false")
    assert not send_transactional_email("recipient@example.test", "Receipt", "body", message_type="receipts")
    assert not send_resend_email("recipient@example.test", "Welcome", "body", idempotency_key="synthetic/disabled")
    assert mail == []
