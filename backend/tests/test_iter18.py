"""Iter 18 backend tests — Whisper STT, Translate, Native Push, Fleet Excel export, regressions."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mobile-forge-1487.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USERS = {
    "passenger": ("ola@kjapp.no", "test1234"),
    "driver": ("sjafor@kjapp.no", "sjafor1234"),
    "fleet_owner": ("floteier1@kjapp.no", "fleet1234"),
    "admin": ("admin@kjapp.no", "admin123"),
}


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {email} → {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in USERS.items()}


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("db") is True
    assert "time" in j and "app" in j


# ---------- Translate ----------
def test_translate_no_auth():
    r = requests.post(f"{API}/ai/translate", json={"text": "Hei", "target_lang": "en"}, timeout=15)
    assert r.status_code == 401


def test_translate_empty_text(tokens):
    r = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]),
                      json={"text": "  ", "target_lang": "en"}, timeout=15)
    assert r.status_code == 400


def test_translate_unsupported_lang(tokens):
    r = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]),
                      json={"text": "Hei", "target_lang": "xx"}, timeout=15)
    assert r.status_code == 400


def test_translate_no_to_en_and_cache(tokens):
    payload = {"text": "Jeg er på vei", "target_lang": "en"}
    r1 = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]), json=payload, timeout=30)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert isinstance(j1.get("translation"), str) and len(j1["translation"]) > 0
    assert j1.get("target_lang") == "en"
    # 2nd call — should be cached
    r2 = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]), json=payload, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("cached") is True


def test_translate_no_to_pl(tokens):
    r = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]),
                      json={"text": "God morgen", "target_lang": "pl"}, timeout=30)
    assert r.status_code == 200
    assert len(r.json().get("translation", "")) > 0


# ---------- Transcribe ----------
def test_transcribe_no_auth():
    r = requests.post(f"{API}/ai/transcribe", json={"audio_base64": "x"}, timeout=10)
    assert r.status_code == 401


def test_transcribe_missing_audio(tokens):
    r = requests.post(f"{API}/ai/transcribe", headers=_h(tokens["passenger"]),
                      json={"audio_base64": ""}, timeout=10)
    assert r.status_code == 400


def test_transcribe_invalid_base64(tokens):
    r = requests.post(f"{API}/ai/transcribe", headers=_h(tokens["passenger"]),
                      json={"audio_base64": "!!!not-base64!!!"}, timeout=10)
    # invalid b64 → 400 ("Ugyldig lyd") OR too-short after decode
    assert r.status_code == 400


def test_transcribe_short_audio(tokens):
    # Valid base64 but <500 bytes decoded
    small = base64.b64encode(b"tinyaudio" * 10).decode()
    r = requests.post(f"{API}/ai/transcribe", headers=_h(tokens["passenger"]),
                      json={"audio_base64": small, "mime_type": "audio/webm"}, timeout=10)
    assert r.status_code == 400


# ---------- Native push subscribe ----------
def test_native_push_no_auth():
    r = requests.post(f"{API}/push/native-subscribe", json={"platform": "ios", "token": "abc"}, timeout=10)
    assert r.status_code == 401


def test_native_push_invalid_platform(tokens):
    r = requests.post(f"{API}/push/native-subscribe", headers=_h(tokens["passenger"]),
                      json={"platform": "blackberry", "token": "abc"}, timeout=10)
    assert r.status_code == 422


def test_native_push_ios_ok(tokens):
    r = requests.post(f"{API}/push/native-subscribe", headers=_h(tokens["passenger"]),
                      json={"platform": "ios", "token": "TEST_apns_token_abc123"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_native_push_android_ok(tokens):
    r = requests.post(f"{API}/push/native-subscribe", headers=_h(tokens["driver"]),
                      json={"platform": "android", "token": "TEST_fcm_token_xyz"}, timeout=10)
    assert r.status_code == 200


# ---------- Fleet monthly export ----------
def test_fleet_export_as_fleet_owner(tokens):
    r = requests.get(f"{API}/fleet/export/monthly", headers=_h(tokens["fleet_owner"]),
                     params={"year": 2026, "month": 2}, timeout=30)
    assert r.status_code == 200, r.text
    ct = r.headers.get("content-type", "")
    assert "spreadsheetml" in ct or "xlsx" in ct or "octet-stream" in ct, f"CT={ct}"
    assert len(r.content) > 500
    # xlsx magic bytes: PK\x03\x04
    assert r.content[:2] == b"PK"


def test_fleet_export_as_passenger_403(tokens):
    r = requests.get(f"{API}/fleet/export/monthly", headers=_h(tokens["passenger"]),
                     params={"year": 2026, "month": 2}, timeout=15)
    assert r.status_code == 403


def test_fleet_export_invalid_params(tokens):
    r = requests.get(f"{API}/fleet/export/monthly", headers=_h(tokens["fleet_owner"]),
                     params={"year": 1999, "month": 13}, timeout=15)
    assert r.status_code == 400


# ---------- Regressions ----------
def test_auth_login_all_roles():
    for k, (e, p) in USERS.items():
        r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=15)
        assert r.status_code == 200, f"{k}: {r.status_code}"


def test_cars_nearby(tokens):
    r = requests.post(f"{API}/cars/nearby", headers=_h(tokens["passenger"]),
                      json={"lat": 59.9139, "lng": 10.7522}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json().get("cars"), list)


def test_trips_estimate(tokens):
    r = requests.post(f"{API}/trips/estimate", headers=_h(tokens["passenger"]),
                      json={"pickup_lat": 59.9139, "pickup_lng": 10.7522,
                            "dropoff_lat": 59.9450, "dropoff_lng": 10.7200}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "price" in j or "estimate" in j or "options" in j


def test_driver_pending(tokens):
    r = requests.get(f"{API}/driver/pending", headers=_h(tokens["driver"]), timeout=15)
    assert r.status_code in (200, 403)


def test_superadmin_fleet_applications(tokens):
    r = requests.get(f"{API}/superadmin/fleet-applications", headers=_h(tokens["admin"]), timeout=15)
    assert r.status_code == 200


def test_fleet_overview(tokens):
    r = requests.get(f"{API}/fleet/overview", headers=_h(tokens["fleet_owner"]), timeout=15)
    assert r.status_code == 200


def test_fleet_drivers(tokens):
    r = requests.get(f"{API}/fleet/drivers", headers=_h(tokens["fleet_owner"]), timeout=15)
    assert r.status_code == 200


def test_fleet_payouts(tokens):
    r = requests.get(f"{API}/fleet/payouts", headers=_h(tokens["fleet_owner"]), timeout=15)
    assert r.status_code == 200
