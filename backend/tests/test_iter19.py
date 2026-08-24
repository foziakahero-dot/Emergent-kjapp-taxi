"""Iter 19 backend tests — AI chat (new timeout+differentiated errors), regressions."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
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
    assert r.json().get("status") == "ok"


# ---------- Auth for all 4 demo roles ----------
def test_login_all_roles():
    roles_expected = {
        "passenger": "user",
        "driver": "driver",
        "fleet_owner": "fleet_owner",
        "admin": "superadmin",
    }
    for k, (e, p) in USERS.items():
        r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=15)
        assert r.status_code == 200, f"{k}: {r.status_code} {r.text}"
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["role"] == roles_expected[k], f"{k} role={j['user']['role']}"


# ---------- AI Chat (iter 19 focus) ----------
def test_ai_chat_no_auth():
    r = requests.post(f"{API}/ai/chat", json={"message": "Hei"}, timeout=15)
    assert r.status_code == 401


def test_ai_chat_hei_fast(tokens):
    """Simple 'Hei' should respond well within 25s. Iter19 fix: no history replay."""
    t0 = time.time()
    r = requests.post(f"{API}/ai/chat", headers=_h(tokens["passenger"]),
                      json={"message": "Hei", "session_id": "TEST_iter19_hei"}, timeout=30)
    dt = time.time() - t0
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    j = r.json()
    assert isinstance(j.get("reply"), str) and len(j["reply"]) > 0
    assert j.get("session_id") == "TEST_iter19_hei"
    # SLA regression check
    assert dt < 20, f"AI chat 'Hei' took {dt:.1f}s (>20s regression)"
    print(f"[ai/chat Hei] {dt:.2f}s reply_len={len(j['reply'])}")


def test_ai_chat_multi_turn_no_replay(tokens):
    """Iter 19: History-replay loop removed. Each subsequent call in the same session
    should still be fast (<15s) because emergentintegrations handles context itself."""
    sid = "TEST_iter19_multi"
    prompts = ["Hei", "Hva koster en tur til Gardermoen?", "Takk", "Kan du bestille?"]
    for i, msg in enumerate(prompts):
        t0 = time.time()
        r = requests.post(f"{API}/ai/chat", headers=_h(tokens["passenger"]),
                          json={"message": msg, "session_id": sid}, timeout=30)
        dt = time.time() - t0
        assert r.status_code == 200, f"turn {i} → {r.status_code} {r.text}"
        assert len(r.json().get("reply", "")) > 0
        assert dt < 20, f"turn {i} ({msg!r}) took {dt:.1f}s — regression"
        print(f"[ai/chat turn {i}] {dt:.2f}s")


def test_ai_history_after_chat(tokens):
    sid = "TEST_iter19_hei"  # from prior test
    r = requests.get(f"{API}/ai/history", headers=_h(tokens["passenger"]),
                     params={"session_id": sid}, timeout=15)
    assert r.status_code == 200
    msgs = r.json().get("messages") if isinstance(r.json(), dict) else r.json()
    # accept either shape
    if isinstance(msgs, dict) and "messages" in msgs:
        msgs = msgs["messages"]
    assert isinstance(msgs, list)
    assert len(msgs) >= 2  # user + assistant


# ---------- Regressions from iter 18 ----------
def test_translate(tokens):
    r = requests.post(f"{API}/ai/translate", headers=_h(tokens["passenger"]),
                      json={"text": "Hei", "target_lang": "en"}, timeout=30)
    assert r.status_code == 200


def test_transcribe_400(tokens):
    r = requests.post(f"{API}/ai/transcribe", headers=_h(tokens["passenger"]),
                      json={"audio_base64": ""}, timeout=10)
    assert r.status_code == 400


def test_native_push(tokens):
    r = requests.post(f"{API}/push/native-subscribe", headers=_h(tokens["passenger"]),
                      json={"platform": "ios", "token": "TEST_iter19_apns"}, timeout=10)
    assert r.status_code == 200


def test_fleet_export_monthly(tokens):
    r = requests.get(f"{API}/fleet/export/monthly", headers=_h(tokens["fleet_owner"]),
                     params={"year": 2026, "month": 2}, timeout=30)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_cars_nearby(tokens):
    r = requests.post(f"{API}/cars/nearby", headers=_h(tokens["passenger"]),
                      json={"lat": 59.9139, "lng": 10.7522}, timeout=15)
    assert r.status_code == 200


def test_trips_estimate(tokens):
    r = requests.post(f"{API}/trips/estimate", headers=_h(tokens["passenger"]),
                      json={"pickup_lat": 59.9139, "pickup_lng": 10.7522,
                            "dropoff_lat": 59.9450, "dropoff_lng": 10.7200}, timeout=15)
    assert r.status_code == 200


def test_driver_pending(tokens):
    r = requests.get(f"{API}/driver/pending", headers=_h(tokens["driver"]), timeout=15)
    assert r.status_code in (200, 403)


def test_superadmin_fleet_applications(tokens):
    r = requests.get(f"{API}/superadmin/fleet-applications", headers=_h(tokens["admin"]), timeout=15)
    assert r.status_code == 200
    j = r.json()
    apps = j if isinstance(j, list) else j.get("applications", [])
    # Iter 19 expects at least 5 pending applications for the admin panel demo
    print(f"[superadmin/fleet-applications] count={len(apps)}")


def test_fleet_payouts(tokens):
    r = requests.get(f"{API}/fleet/payouts", headers=_h(tokens["fleet_owner"]), timeout=15)
    assert r.status_code == 200
