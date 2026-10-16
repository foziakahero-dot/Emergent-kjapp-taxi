import os

import pytest

from ai_configuration import configured_ai_key, provider_chat_session
from emergentintegrations.llm.chat import (
    _astra_settings,
    _extract_output_text,
    _model_name,
    _session_parts,
)


def test_qa_key_is_explicitly_gated():
    env = {"APP_ENV": "qa", "QA_SNAR_AI_KEY": "test-key", "QA_AI_ENABLED": "false"}
    assert configured_ai_key(env) == ""
    env["QA_AI_ENABLED"] = "true"
    assert configured_ai_key(env) == "test-key"


def test_provider_session_preserves_owner_without_raw_client_session():
    user_id = "0123456789abcdef01234567"
    session = provider_chat_session("qa", user_id, "customer-visible-session")
    assert session.startswith(f"snar:qa:{user_id}:")
    assert "customer-visible-session" not in session
    assert _session_parts(session)["user_id"] == user_id


def test_same_client_session_cannot_cross_customer_history():
    first = provider_chat_session("qa", "0123456789abcdef01234567", "same")
    second = provider_chat_session("qa", "89abcdef0123456701234567", "same")
    assert first != second


def test_legacy_model_names_map_to_current_openai_models(monkeypatch):
    monkeypatch.delenv("SNAR_OPENAI_CHAT_MODEL", raising=False)
    monkeypatch.delenv("SNAR_OPENAI_FAST_MODEL", raising=False)
    assert _model_name("gpt-5.6-sol") == "gpt-6.1-sol"
    assert _model_name("gpt-5.6-luna") == "gpt-6-luna"


def test_responses_output_text_extraction():
    payload = {
        "output": [
            {"content": [{"type": "output_text", "text": "Hei fra SNAR"}]}
        ]
    }
    assert _extract_output_text(payload) == "Hei fra SNAR"


def test_customer_chat_fails_closed_without_astra(monkeypatch):
    for key in (
        "ASTRA_DB_API_ENDPOINT",
        "ASTRA_DB_APPLICATION_TOKEN",
        "ASTRA_DB_KEYSPACE",
        "ASTRA_DB_CHAT_COLLECTION",
    ):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(RuntimeError, match="Astra DB er ikke konfigurert"):
        _astra_settings(required=True)


def test_astra_settings_never_require_secret_in_source(monkeypatch):
    monkeypatch.setenv("ASTRA_DB_API_ENDPOINT", "https://example.apps.astra.datastax.com")
    monkeypatch.setenv("ASTRA_DB_APPLICATION_TOKEN", "runtime-secret")
    settings = _astra_settings(required=True)
    assert settings["token"] == "runtime-secret"
    assert settings["endpoint"].startswith("https://")
