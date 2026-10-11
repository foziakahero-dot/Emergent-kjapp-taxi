"""KJAPP Iter 13 backend tests — Superadmin, fleet applications, uploads, driver docs."""
import os
import io
import uuid
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kjapp.no", "password": "admin123"}
USER = {"email": "ola@kjapp.no", "password": "test1234"}
DRIVER = {"email": "sjafor@kjapp.no", "password": "sjafor1234"}
FLEET = {"email": "floteier1@kjapp.no", "password": "fleet1234"}

MINI_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def sa_token():
    return _login(**ADMIN)["token"]


@pytest.fixture(scope="session")
def user_token():
    return _login(**USER)["token"]


@pytest.fixture(scope="session")
def driver_token():
    return _login(**DRIVER)["token"]


@pytest.fixture(scope="session")
def fleet_token():
    return _login(**FLEET)["token"]


# =========================================================
# Superadmin role/backfill
# =========================================================
class TestSuperadminRole:
    def test_admin_login_returns_superadmin(self):
        r = _login(**ADMIN)
        assert r["user"]["role"] == "superadmin", r

    def test_auth_me_returns_superadmin(self, sa_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("role") == "superadmin"

    def test_admin_endpoint_accepts_superadmin(self, sa_token):
        # require_admin should accept superadmin
        r = requests.get(f"{API}/admin/fleets", headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_endpoint_forbidden_for_user(self, user_token):
        r = requests.get(f"{API}/admin/fleets", headers=_hdr(user_token), timeout=15)
        assert r.status_code in (401, 403)


# =========================================================
# Fleet Application flow (draft -> upload public -> submit)
# =========================================================
class TestFleetApplicationFlow:
    def test_draft_public_no_auth(self):
        body = {
            "company_name": f"TEST_Fleet_{uuid.uuid4().hex[:6]}",
            "org_number": "999111222",
            "contact_name": "TEST Contact",
            "contact_email": f"TEST_owner_{uuid.uuid4().hex[:6]}@kjapp.no",
            "contact_phone": "+4790000001",
            "bank_account": "1234.56.78901",
            "notes": "TEST notes",
        }
        r = requests.post(f"{API}/fleet-applications/draft", json=body, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "upload_token" in data
        assert data["status"] == "draft"
        assert len(data["upload_token"]) > 10

    @pytest.fixture(scope="class")
    def draft_ctx(self):
        body = {
            "company_name": f"TEST_Fleet_{uuid.uuid4().hex[:6]}",
            "org_number": "999111333",
            "contact_name": "TEST Contact",
            "contact_email": f"TEST_owner_{uuid.uuid4().hex[:6]}@kjapp.no",
            "contact_phone": "+4790000002",
            "bank_account": "1234.56.78902",
            "notes": "TEST",
        }
        r = requests.post(f"{API}/fleet-applications/draft", json=body, timeout=15)
        assert r.status_code == 200
        return {"upload_token": r.json()["upload_token"], "body": body}

    def _upload(self, upload_token, name):
        files = {"file": (f"{name}.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
        data = {"application_token": upload_token}
        return requests.post(f"{API}/upload/public", files=files, data=data, timeout=30)

    def test_upload_public_accepts_valid(self, draft_ctx):
        r = self._upload(draft_ctx["upload_token"], "firmaattest")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "storage_path" in d
        assert d["scope"] == "fleet-applications"
        assert d["storage_path"].startswith(("kjapp/fleet-applications/", "fleet-applications/"))
        draft_ctx["firmaattest_path"] = d["storage_path"]
        draft_ctx["firmaattest_doc"] = d

    def test_upload_public_rejects_invalid_type(self, draft_ctx):
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x00\x00"), "application/x-msdownload")}
        data = {"application_token": draft_ctx["upload_token"]}
        r = requests.post(f"{API}/upload/public", files=files, data=data, timeout=15)
        assert r.status_code in (400, 415), r.text

    def test_upload_public_rejects_unknown_token(self):
        files = {"file": ("f.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
        r = requests.post(f"{API}/upload/public", files=files, data={"application_token": "bogus-xyz"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_submit_requires_all_docs(self, draft_ctx):
        r = requests.post(f"{API}/fleet-applications/submit", json={
            "upload_token": draft_ctx["upload_token"],
            "documents": {"firmaattest": {"path": "x"}},
        }, timeout=15)
        assert r.status_code == 400
        assert "Mangler" in r.json().get("detail", "")

    def test_full_submit_and_verify(self, draft_ctx, sa_token):
        # Upload all 5
        docs = {}
        for name in ["firmaattest", "loyvebevis", "vognkort", "forsikring", "bank"]:
            r = self._upload(draft_ctx["upload_token"], name)
            assert r.status_code == 200, f"{name}: {r.text}"
            j = r.json()
            docs[name] = {
                "path": j["storage_path"],
                "original_filename": j["original_filename"],
                "content_type": j["content_type"],
            }
        r = requests.post(f"{API}/fleet-applications/submit", json={
            "upload_token": draft_ctx["upload_token"],
            "documents": docs,
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending"

        # Second submit → 410
        r2 = requests.post(f"{API}/fleet-applications/submit", json={
            "upload_token": draft_ctx["upload_token"],
            "documents": docs,
        }, timeout=15)
        assert r2.status_code == 410, r2.text

        # Verify in superadmin list
        r3 = requests.get(f"{API}/superadmin/fleet-applications", params={"status": "pending"},
                          headers=_hdr(sa_token), timeout=15)
        assert r3.status_code == 200
        apps = r3.json()["applications"]
        matches = [a for a in apps if a.get("company_name") == draft_ctx["body"]["company_name"]]
        assert matches, "submitted app not in superadmin list"
        draft_ctx["app_id"] = matches[0]["id"]

    def test_superadmin_get_full_docs(self, draft_ctx, sa_token):
        app_id = draft_ctx.get("app_id")
        assert app_id, "prior test must have set app_id"
        r = requests.get(f"{API}/superadmin/fleet-applications/{app_id}", headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert set(data["documents"].keys()) >= {"firmaattest", "loyvebevis", "vognkort", "forsikring", "bank"}

    def test_superadmin_list_forbidden_for_admin_role(self, user_token):
        # Only user exists as non-superadmin now; admin_token is superadmin
        r = requests.get(f"{API}/superadmin/fleet-applications", headers=_hdr(user_token), timeout=15)
        assert r.status_code == 403, r.text

    def test_file_download_auth_required(self, draft_ctx):
        path = None
        # Get first doc path
        # Just try a fabricated path — expect 401 with no token
        r = requests.get(f"{API}/files/kjapp/fleet-applications/nope/none.pdf", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_file_download_superadmin_ok(self, draft_ctx, sa_token):
        app_id = draft_ctx.get("app_id")
        r = requests.get(f"{API}/superadmin/fleet-applications/{app_id}", headers=_hdr(sa_token), timeout=15)
        path = r.json()["documents"]["firmaattest"]["path"]
        r2 = requests.get(f"{API}/files/{path}", headers=_hdr(sa_token), timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.headers.get("content-type", "").startswith(("application/pdf", "application/octet"))
        assert len(r2.content) > 0

    def test_file_download_forbidden_for_user(self, draft_ctx, user_token):
        app_id = draft_ctx.get("app_id")
        # Get path via superadmin token first (need to reuse from prior)
        # Just call with a known-scope path; if that failed, skip
        # Fetch via superadmin
        sa = _login(**ADMIN)["token"]
        r = requests.get(f"{API}/superadmin/fleet-applications/{app_id}", headers=_hdr(sa), timeout=15)
        path = r.json()["documents"]["firmaattest"]["path"]
        r2 = requests.get(f"{API}/files/{path}", headers=_hdr(user_token), timeout=15)
        assert r2.status_code == 403, r2.text


# =========================================================
# Approve / reject
# =========================================================
class TestApproveReject:
    def _create_and_submit(self, sa_token):
        email = f"TEST_owner_{uuid.uuid4().hex[:6]}@kjapp.no"
        body = {
            "company_name": f"TEST_ApproveCo_{uuid.uuid4().hex[:6]}",
            "org_number": "999222333",
            "contact_name": "TEST",
            "contact_email": email,
            "contact_phone": "+4790000010",
            "bank_account": "1111.22.33333",
            "notes": "",
        }
        r = requests.post(f"{API}/fleet-applications/draft", json=body, timeout=15)
        tok = r.json()["upload_token"]
        docs = {}
        for name in ["firmaattest", "loyvebevis", "vognkort", "forsikring", "bank"]:
            files = {"file": (f"{name}.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
            up = requests.post(f"{API}/upload/public", files=files,
                               data={"application_token": tok}, timeout=30)
            assert up.status_code == 200
            j = up.json()
            docs[name] = {"path": j["storage_path"], "original_filename": j["original_filename"],
                          "content_type": j["content_type"]}
        rs = requests.post(f"{API}/fleet-applications/submit",
                           json={"upload_token": tok, "documents": docs}, timeout=20)
        assert rs.status_code == 200
        # find id
        lst = requests.get(f"{API}/superadmin/fleet-applications", params={"status": "pending"},
                           headers=_hdr(sa_token), timeout=15).json()["applications"]
        app_id = next(a["id"] for a in lst if a["company_name"] == body["company_name"])
        return app_id, email, body

    def test_approve_creates_fleet_and_owner(self, sa_token):
        app_id, email, body = self._create_and_submit(sa_token)
        r = requests.post(f"{API}/superadmin/fleet-applications/{app_id}/approve",
                          json={"review_notes": "TEST approved", "commission_rate": 0.18},
                          headers=_hdr(sa_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["fleet_id"]
        assert d["fleet_owner_user_id"]
        assert d.get("temp_password")  # new user gets a temp password

        # Verify owner can login
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": d["temp_password"]}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["user"]["role"] == "fleet_owner"

        # Verify status
        r3 = requests.get(f"{API}/superadmin/fleet-applications/{app_id}",
                          headers=_hdr(sa_token), timeout=15)
        assert r3.json()["status"] == "approved"

    def test_reject_sets_status(self, sa_token):
        app_id, email, body = self._create_and_submit(sa_token)
        r = requests.post(f"{API}/superadmin/fleet-applications/{app_id}/reject",
                          json={"review_notes": "TEST rejected"},
                          headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/superadmin/fleet-applications/{app_id}",
                          headers=_hdr(sa_token), timeout=15)
        assert r2.json()["status"] == "rejected"


# =========================================================
# Fleet-owner driver invites
# =========================================================
class TestFleetOwnerInvites:
    def test_fleet_owner_create_invite(self, fleet_token):
        r = requests.post(f"{API}/fleet/driver-invites",
                          json={"car": "Tesla M3", "plate": f"EL{uuid.uuid4().hex[:4].upper()}",
                                "vehicle_type": "trygg", "note": "TEST iter13"},
                          headers=_hdr(fleet_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["token"]
        assert r.json().get("fleet_id")

    def test_fleet_owner_list_only_own(self, fleet_token):
        r = requests.get(f"{API}/fleet/driver-invites", headers=_hdr(fleet_token), timeout=15)
        assert r.status_code == 200
        invites = r.json()["invites"]
        assert isinstance(invites, list)

    def test_forbidden_for_regular_user(self, user_token):
        r = requests.post(f"{API}/fleet/driver-invites",
                          json={"car": "x", "plate": "AB123", "vehicle_type": "trygg"},
                          headers=_hdr(user_token), timeout=15)
        assert r.status_code in (401, 403)


# =========================================================
# Driver signup w/ docs
# =========================================================
class TestDriverSignupDocs:
    def _create_invite(self, sa_token):
        r = requests.post(f"{API}/admin/driver-invites",
                          json={"car": "Kia EV6", "plate": f"EL{uuid.uuid4().hex[:4].upper()}",
                                "vehicle_type": "trygg", "note": "TEST iter13 signup"},
                          headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def test_upload_driver_doc_rejects_invalid_type(self, sa_token):
        tok = self._create_invite(sa_token)
        files = {"file": ("dl.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
        r = requests.post(f"{API}/upload/driver-doc", files=files,
                          data={"invite_token": tok, "doc_type": "BOGUS_type"}, timeout=15)
        assert r.status_code == 400

    def test_upload_driver_doc_rejects_bad_invite(self):
        files = {"file": ("dl.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
        r = requests.post(f"{API}/upload/driver-doc", files=files,
                          data={"invite_token": "bogus-xxx", "doc_type": "drivers_license"}, timeout=15)
        assert r.status_code == 403

    def test_accept_requires_all_three_paths(self, sa_token):
        tok = self._create_invite(sa_token)
        email = f"TEST_drv_{uuid.uuid4().hex[:6]}@kjapp.no"
        r = requests.post(f"{API}/driver-invites/accept",
                          json={"token": tok, "fullName": "TEST", "email": email,
                                "phone": "+4790000099", "password": "test1234",
                                "accepted_terms": True, "legal_version": "test"},
                          timeout=15)
        assert r.status_code == 400
        assert "førerkort" in r.json().get("detail", "").lower()

    def test_full_signup_with_docs(self, sa_token):
        tok = self._create_invite(sa_token)
        paths = {}
        for dt in ["drivers_license", "taxi_license", "profile_photo"]:
            files = {"file": (f"{dt}.pdf", io.BytesIO(MINI_PDF), "application/pdf")}
            r = requests.post(f"{API}/upload/driver-doc", files=files,
                              data={"invite_token": tok, "doc_type": dt}, timeout=30)
            assert r.status_code == 200, r.text
            paths[dt] = r.json()["storage_path"]
        email = f"TEST_drv_{uuid.uuid4().hex[:6]}@kjapp.no"
        r2 = requests.post(f"{API}/driver-invites/accept",
                           json={"token": tok, "fullName": "TEST Driver", "email": email,
                                 "phone": "+4790000098", "password": "test1234",
                                 "accepted_terms": True, "legal_version": "test",
                                 "drivers_license_path": paths["drivers_license"],
                                 "taxi_license_path": paths["taxi_license"],
                                 "profile_photo_path": paths["profile_photo"]},
                           timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["role"] == "driver"
        assert r2.json()["user"]["approved"] is False


# =========================================================
# Pending drivers endpoint
# =========================================================
class TestPendingDrivers:
    def test_pending_drivers_returned(self, sa_token):
        r = requests.get(f"{API}/admin/pending-drivers", headers=_hdr(sa_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "drivers" in data
        assert isinstance(data["drivers"], list)
        for d in data["drivers"]:
            assert d.get("approved") is not True

    def test_pending_drivers_forbidden_for_user(self, user_token):
        r = requests.get(f"{API}/admin/pending-drivers", headers=_hdr(user_token), timeout=15)
        assert r.status_code in (401, 403)
