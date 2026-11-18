"""Trace public registration, normal role logins and Admin controls using one isolated database."""

import asyncio
from datetime import datetime, timezone
import pyotp
from unittest.mock import AsyncMock, Mock

import httpx
import mongomock
import pytest

from test_fleet_invitation_delivery import Collection
from test_partner_approval import server


@pytest.fixture
def panel_db(monkeypatch):
    raw = mongomock.MongoClient(tz_aware=True).db

    class Database:
        def __getattr__(self, name):
            return Collection(raw[name])

    monkeypatch.setattr(server, "db", Database())
    monkeypatch.setattr(server, "APP_ENV", "qa")
    monkeypatch.setattr(server.stripe, "api_key", "")
    monkeypatch.setattr(server, "EMERGENT_LLM_KEY", "")
    monkeypatch.setattr(server, "send_email", Mock(return_value=True))
    monkeypatch.setattr(server, "send_push_to_user", AsyncMock())
    monkeypatch.setattr(server, "osrm_route_points", AsyncMock(return_value=None))
    monkeypatch.setattr(server, "KJAPP_DRIVER_IDENTITY_REQUIRED", False)
    admin = {
        "email": "admin@example.com",
        "role": "superadmin",
        "approved": True,
        "totp_secret": pyotp.random_base32(),
        "totp_enabled": True,
        "password_hash": server.hash_password("panel-test-password"),
    }
    raw.users.insert_one(admin)
    raw.platform_settings.insert_one({"_id": "singleton", "default_commission": 0.12})
    return raw


async def sign_in(session, email, password, **extra):
    session.cookies.clear()
    response = await session.post(
        "/api/auth/login", json=dict(email=email, password=password, **extra)
    )
    assert response.status_code == 200, response.text
    if response.json().get("twofa_required"):
        record = await server.db.users.find_one({"email": email})
        response = await session.post(
            "/api/auth/2fa/verify-login",
            json={
                "twofa_token": response.json()["twofa_token"],
                "code": pyotp.TOTP(record["totp_secret"]).now(),
            },
        )
        response.raise_for_status()
    return {"Authorization": "Bearer " + response.json()["token"]}


def test_owner_and_driver_through_public_api(panel_db):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="https://qa.example"
        ) as c:
            draft = await c.post(
                "/api/fleet-applications/draft",
                json=dict(
                    company_name="Test Fleet",
                    org_number="923609016",
                    contact_name="Test Owner",
                    contact_email="owner@example.com",
                    contact_phone="00000000",
                    license_count=1,
                    vehicle_count=1,
                    bank_account="00000000019",
                    accepted_terms=True,
                ),
            )
            draft.raise_for_status()
            token = draft.json()["upload_token"]
            docs = {}
            for kind in ("firmaattest", "loyvebevis", "vognkort", "forsikring", "bank"):
                r = await c.post(
                    "/api/upload/public",
                    data={"application_token": token},
                    files={"file": (kind + ".pdf", b"%PDF-QA TEST", "application/pdf")},
                )
                r.raise_for_status()
                docs[kind] = {"path": r.json()["storage_path"]}
            submit = await c.post(
                "/api/fleet-applications/submit",
                json={"upload_token": token, "documents": docs},
            )
            assert submit.json()["status"] == "pending"
            assert (await c.get("/api/fleet/me")).status_code == 401
            admin = await sign_in(c, "admin@example.com", "panel-test-password")
            apps = (
                await c.get("/api/superadmin/fleet-applications", headers=admin)
            ).json()["applications"]
            result = await c.post(
                "/api/superadmin/fleet-applications/" + apps[0]["id"] + "/approve",
                headers=admin,
                json={},
            )
            result.raise_for_status()
            owner = await sign_in(
                c, "owner@example.com", result.json()["temp_password"]
            )
            change = await c.post(
                "/api/auth/change-password",
                headers=owner,
                json={
                    "current_password": result.json()["temp_password"],
                    "new_password": "owner-fixture-new",
                },
            )
            change.raise_for_status()
            owner = await sign_in(c, "owner@example.com", "owner-fixture-new")
            fleet_id = result.json()["fleet_id"]
            assert (await c.get("/api/fleet/me", headers=owner)).json()[
                "id"
            ] == fleet_id
            assert (
                await c.get("/api/superadmin/fleet-applications", headers=owner)
            ).status_code == 403
            car = await c.post(
                "/api/fleet/vehicles",
                headers=owner,
                json={"plate": "QATEST", "car": "Testbil"},
            )
            car.raise_for_status()
            invite = await c.post(
                "/api/fleet/driver-invites",
                headers=owner,
                json={"vehicle_id": car.json()["id"], "email": "driver@example.com"},
            )
            invite.raise_for_status()
            link = invite.json()["invite_url"]
            assert link.startswith(server.QA_FLEET_URL + "/driver-signup/")
            assert link in server.send_email.call_args.args[2]
            token = invite.json()["token"]
            invite_path = "/api/driver-invites/" + token
            assert (await c.get(invite_path)).json()["fleet_name"] == "Test Fleet"
            signup = dict(
                token=token,
                fullName="Test Driver",
                email="driver@example.com",
                password="driver-fixture-pw",
                phone="00000000",
                accepted_terms=True,
            )
            ids = []
            for kind in ("drivers_license", "taxi_license", "profile_photo"):
                r = await c.post(
                    "/api/upload/driver-doc",
                    data={"invite_token": token, "doc_type": kind},
                    files={"file": (kind + ".png", b"QA TEST IMAGE", "image/png")},
                )
                r.raise_for_status()
                signup[kind + "_path"] = r.json()["storage_path"]
                ids.append(r.json()["id"])
            accepted = await c.post("/api/driver-invites/accept", json=signup)
            accepted.raise_for_status()
            assert accepted.json()["pending_approval"]
            assert (await c.get(invite_path)).status_code == 410
            uid = accepted.json()["user"]["id"]
            queue = (await c.get("/api/admin/pending-drivers", headers=admin)).json()[
                "drivers"
            ]
            assert any(d["id"] == uid and d["fleet_id"] == fleet_id for d in queue)
            decision = "/api/admin/drivers/" + uid + "/set-status"
            assert (
                await c.post(decision, headers=admin, json={"approved": True})
            ).status_code == 409
            for file_id in ids[:2]:
                r = await c.post(
                    "/api/admin/documents/" + file_id + "/review",
                    headers=admin,
                    json={"status": "valid", "expiry": "2099-01-01"},
                )
                r.raise_for_status()
            (
                await c.post(decision, headers=admin, json={"approved": True})
            ).raise_for_status()
            driver = await sign_in(
                c, "driver@example.com", "driver-fixture-pw", client="driver"
            )
            assert (await c.get("/api/auth/me", headers=driver)).json()["approved"]
            assert (await c.get("/api/fleet/me", headers=driver)).status_code == 403
            campaign = await c.post(
                "/api/admin/bonus-campaigns",
                headers=admin,
                json={
                    "name": "Oslo kveld",
                    "trips_required": 1,
                    "bonus_kr": 80,
                    "active": False,
                },
            )
            campaign.raise_for_status()
            await c.patch(
                "/api/admin/bonus-campaigns/" + campaign.json()["id"],
                headers=admin,
                json={"active": True},
            )
            visible = await c.get("/api/driver/bonus", headers=driver)
            assert visible.json()["campaigns"][0]["name"] == "Oslo kveld"
            now = datetime.now(timezone.utc).isoformat()
            panel_db.trips.insert_one(
                {
                    "trip_id": "fixture-ride",
                    "driver_id": uid,
                    "user_id": "passenger",
                    "arrived_at": now,
                    "status": "arrived",
                    "payment_status": "reserved",
                    "price": 190,
                }
            )
            assert visible.json()["earned_today"] == 0
            await server._mark_trip_paid_and_complete("fixture-ride", "passenger", now)
            await server._mark_trip_paid_and_complete("fixture-ride", "passenger", now)
            assert (await c.get("/api/driver/bonus", headers=driver)).json()[
                "earned_today"
            ] == 80
            assert panel_db.bonus_payouts.count_documents({}) == 1
            assert panel_db.trips.find_one({"trip_id": "fixture-ride"})["price"] == 190
            customer = (
                await c.post(
                    "/api/auth/register",
                    json=dict(
                        email="customer@example.com",
                        password="customer-fixture-pw",
                        fullName="Fixture Customer",
                        accepted_terms=True,
                    ),
                )
            ).json()
            passenger = {"Authorization": "Bearer " + customer["token"]}
            status = "/api/admin/users/" + customer["user"]["id"] + "/set-status"
            (
                await c.post(status, headers=admin, json={"disabled": True})
            ).raise_for_status()
            assert (await c.get("/api/auth/me", headers=passenger)).status_code == 401
            (
                await c.post(status, headers=admin, json={"disabled": False})
            ).raise_for_status()
            passenger = await sign_in(
                c, "customer@example.com", "customer-fixture-pw", client="customer"
            )
            assert (await c.get("/api/auth/me", headers=passenger)).status_code == 200
            prefix = "/api/admin/fleets/" + fleet_id
            (
                await c.post(
                    prefix + "/suspend", headers=admin, json={"reason": "QA test"}
                )
            ).raise_for_status()
            assert (await c.get("/api/fleet/me", headers=owner)).status_code == 403
            assert (await c.get("/api/driver/bonus", headers=driver)).status_code == 403
            (await c.post(prefix + "/reactivate", headers=admin)).raise_for_status()
            assert (await c.get("/api/fleet/me", headers=owner)).status_code == 200

    asyncio.run(run())


def test_admin_tariff_reaches_customer_estimate(panel_db):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="https://qa.example"
        ) as c:
            admin = await sign_in(c, "admin@example.com", "panel-test-password")
            route = {
                "pickup_lat": 59.91,
                "pickup_lng": 10.75,
                "dropoff_lat": 59.93,
                "dropoff_lng": 10.71,
            }

            async def quote(base, surge, multiplier):
                settings = {
                    "base_fare": base,
                    "per_km": 0,
                    "per_minute": 0,
                    "minimum_fare": 0,
                    "surge": {
                        "enabled": surge,
                        "manual_multiplier": multiplier,
                        "max_multiplier": 1.6,
                    },
                }
                (
                    await c.patch(
                        "/api/admin/settings", headers=admin, json={"pricing": settings}
                    )
                ).raise_for_status()
                result = await c.post("/api/trips/estimate", json=route)
                result.raise_for_status()
                standard = next(
                    o
                    for o in result.json()["options"]
                    if o["vehicle_type"] == "ai-first"
                )
                global_surge = (await c.get("/api/pricing/surge")).json()
                assert standard["surge_multiplier"] == global_surge["multiplier"]
                return standard["price"], standard["pricing_version"]

            first, v1 = await quote(100, False, 1)
            second, v2 = await quote(130, False, 1)
            peak, v3 = await quote(130, True, 1.6)
            assert (first, second, peak) == (100, 130, 208)
            assert v1 < v2 < v3

    asyncio.run(run())


def test_qa_owner_recovery_stays_on_fleet_and_only_serves_active_owners(
    panel_db, monkeypatch
):
    monkeypatch.setattr(server, "email_configured", lambda: True)
    panel_db.users.insert_one(
        {
            "email": "owner@example.com",
            "role": "fleet_owner",
            "approved": True,
            "fleet_id": "test-fleet",
        }
    )

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="https://qa.example"
        ) as client:
            for email in (
                "admin@example.com",
                "unknown@example.com",
                "owner@example.com",
            ):
                r = await client.post(
                    "/api/auth/forgot-password", json={"email": email}
                )
                assert r.json() == {"ok": True}
            assert server.send_email.call_count == 1
            assert (
                server.QA_FLEET_URL + "/reset-password/"
                in server.send_email.call_args.args[2]
            )
            assert panel_db.password_reset_tokens.count_documents({}) == 1

    asyncio.run(run())
