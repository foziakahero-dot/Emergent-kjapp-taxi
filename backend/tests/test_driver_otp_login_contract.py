import re
from pathlib import Path
from typing import Optional

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _section(start: str, end: str) -> str:
    begin = SOURCE.index(start)
    return SOURCE[begin:SOURCE.index(end, begin)]


def _load_phone_normalizer():
    code = _section("def _norwegian_local_phone", "async def _find_driver_by_phone")
    scope = {"re": re, "Optional": Optional}
    exec(code, scope)
    return scope["_norwegian_local_phone"]


def test_norwegian_phone_normalization():
    norm = _load_phone_normalizer()
    assert norm("+47 912 34 567") == "91234567"
    assert norm("0047 91234567") == "91234567"
    assert norm("4791234567") == "91234567"
    assert norm("91234567") == "91234567"
    assert norm("1234567") is None
    assert norm("01234567") is None
    assert norm("+46 70 123 45 67") is None


def test_otp_only_logs_in_drivers():
    lookup = _section("async def _find_driver_by_phone", "TWILIO_VERIFY_BASE")
    assert '"role": "driver"' in lookup


def test_otp_start_does_not_reveal_registered_numbers():
    start = _section('@api.post("/auth/driver/otp/start")', '@api.post("/auth/driver/otp/verify")')
    assert "return generic" in start
    assert start.count("return generic") >= 2
    assert "_enforce_key_rate_limit" in start
    assert "status_code=503" in start


def test_otp_verify_reuses_password_login_safeguards():
    verify = _section('@api.post("/auth/driver/otp/verify")', '@api.get("/auth/driver/otp/config")')
    for guard in ("_login_blocked", "_record_failed_login", "_clear_failed_logins",
                  "_apply_driver_identity_risk", "totp_enabled", 'status") == "approved"'):
        assert guard in verify, guard


def test_twilio_secrets_only_come_from_environment():
    for name in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"):
        assert f'os.environ.get("{name}"' in SOURCE
    assert "logger = logging.getLogger(" in SOURCE
