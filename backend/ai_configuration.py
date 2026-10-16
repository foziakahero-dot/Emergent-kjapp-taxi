"""SNAR AI configuration with isolated QA credentials and local session ownership."""
import hashlib
import re


def configured_ai_key(env, app_env=None):
    environment = (app_env if app_env is not None else env.get("APP_ENV", "")).strip().lower()
    if environment == "qa":
        return env.get("QA_SNAR_AI_KEY", "").strip() if env.get("QA_AI_ENABLED") == "true" else ""
    return env.get("SNAR_AI_KEY", "").strip() or env.get("OPENAI_API_KEY", "").strip() or env.get("EMERGENT_LLM_KEY", "").strip()


def provider_chat_session(environment, user_id, client_session):
    """Return a non-guessable local session key that still carries canonical ownership.

    The raw client session ID is never embedded. The local OpenAI/Astra adapter
    needs the authenticated Mongo user id to fetch that customer's real SNAR
    context; OpenAI never receives this session key.
    """
    env = re.sub(r"[^a-z0-9_-]", "", str(environment or "unknown").strip().lower()) or "unknown"
    uid = str(user_id or "").strip()
    if not re.fullmatch(r"[0-9a-fA-F]{24}", uid):
        uid = hashlib.sha256(uid.encode()).hexdigest()[:24]
    value = f"{env}\0{user_id}\0{client_session}".encode()
    digest = hashlib.sha256(value).hexdigest()
    return f"snar:{env}:{uid}:{digest}"
