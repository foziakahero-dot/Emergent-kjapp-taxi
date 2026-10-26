"""Retain the existing Emergent integration with isolated QA credentials/sessions."""
import hashlib


def configured_ai_key(env, app_env=None):
    environment = (app_env if app_env is not None else env.get('APP_ENV', '')).strip().lower()
    if environment == 'qa':
        return env.get('QA_SNAR_AI_KEY', '').strip() if env.get('QA_AI_ENABLED') == 'true' else ''
    return env.get('SNAR_AI_KEY', '').strip() or env.get('EMERGENT_LLM_KEY', '').strip()


def provider_chat_session(environment, user_id, client_session):
    # Provider-managed history must never be addressable by another customer,
    # even when they choose the same client-side session ID.
    value = f'{environment}\0{user_id}\0{client_session}'.encode()
    return 'snar-' + hashlib.sha256(value).hexdigest()
