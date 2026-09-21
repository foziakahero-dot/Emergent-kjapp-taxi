"""KJAPP Admin Control Center extensions.

Focused admin-only capabilities:
- Stripe Connect onboarding/status/payout visibility for fleets
- Fleet driver/vehicle onboarding actions
- Broadcast communications
- Action center
- Integration health
- Staff permission management

All routes reuse the existing FastAPI/MongoDB/auth/audit infrastructure.
"""
from __future__ import annotations

import asyncio
import html
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Literal, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field


ADMIN_PERMISSIONS = ("operations", "finance", "support", "communications", "system")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(400, "Ugyldig id")


def _stripe_snapshot(account: Any) -> dict:
    req = account.get("requirements") or {}
    return {
        "account_id": account.get("id"),
        "details_submitted": bool(account.get("details_submitted")),
        "charges_enabled": bool(account.get("charges_enabled")),
        "payouts_enabled": bool(account.get("payouts_enabled")),
        "currently_due": list(req.get("currently_due") or []),
        "eventually_due": list(req.get("eventually_due") or []),
        "disabled_reason": req.get("disabled_reason"),
        "ready": bool(account.get("details_submitted") and account.get("payouts_enabled")),
    }


async def stripe_destination_for_trip(db, stripe, trip: dict) -> Optional[dict]:
    """Resolve a safe destination-charge target.

    Failure to resolve Connect never blocks the customer's payment. The checkout
    falls back to the platform account and Action Center will flag the fleet.
    """
    driver_id = trip.get("driver_user_id") or trip.get("driver_id")
    if not driver_id or not stripe.api_key:
        return None
    try:
        driver = await db.users.find_one({"_id": ObjectId(str(driver_id)), "role": "driver"})
    except Exception:
        return None
    fleet_id = (driver or {}).get("fleet_id")
    if not fleet_id:
        return None
    try:
        fleet = await db.fleets.find_one({"_id": ObjectId(str(fleet_id))})
    except Exception:
        return None
    account_id = (fleet or {}).get("stripe_account_id")
    if not account_id:
        return None
    try:
        account = await asyncio.to_thread(stripe.Account.retrieve, account_id)
        snap = _stripe_snapshot(account)
    except Exception:
        return None
    await db.fleets.update_one(
        {"_id": ObjectId(str(fleet_id))},
        {"$set": {
            "stripe_details_submitted": snap["details_submitted"],
            "stripe_charges_enabled": snap["charges_enabled"],
            "stripe_payouts_enabled": snap["payouts_enabled"],
            "stripe_connect_status": "ready" if snap["ready"] else "restricted",
            "stripe_status_checked_at": _now(),
        }},
    )
    if not snap["ready"]:
        return None
    rate = float((fleet or {}).get("commission_rate", 0.10) or 0.10)
    rate = max(0.0, min(rate, 0.50))
    return {
        "fleet_id": str(fleet_id),
        "stripe_account_id": account_id,
        "commission_rate": rate,
    }


def install_admin_control_center(
    api,
    db,
    *,
    require_admin,
    require_superadmin,
    stripe,
    send_push_to_user,
    send_email,
    hash_password,
    audit,
):
    class BroadcastRequest(BaseModel):
        title: str = Field(min_length=2, max_length=120)
        body: str = Field(min_length=2, max_length=2000)
        audience: Literal["all", "customers", "drivers", "fleet_owners", "fleet"]
        fleet_id: Optional[str] = None
        channels: list[Literal["push", "email"]] = ["push"]
        url: Optional[str] = "/app"

    class AdminUserCreate(BaseModel):
        email: str
        full_name: str
        permissions: list[str] = list(ADMIN_PERMISSIONS)

    class AdminUserUpdate(BaseModel):
        full_name: Optional[str] = None
        permissions: Optional[list[str]] = None
        disabled: Optional[bool] = None

    class FleetDriverInvite(BaseModel):
        email: str
        car: str
        plate: str
        vehicle_type: str = "ai-first"
        note: Optional[str] = ""

    class FleetVehicleUpdate(BaseModel):
        driver_user_id: str
        car: str
        plate: str
        vehicle_type: str = "ai-first"

    def clean_permissions(values: list[str]) -> list[str]:
        unknown = sorted(set(values) - set(ADMIN_PERMISSIONS))
        if unknown:
            raise HTTPException(400, f"Ukjente tilganger: {', '.join(unknown)}")
        return [p for p in ADMIN_PERMISSIONS if p in values]

    async def fleet_or_404(fleet_id: str):
        fleet = await db.fleets.find_one({"_id": _oid(fleet_id)})
        if not fleet:
            raise HTTPException(404, "Fant ikke løyvehaver")
        return fleet

    async def owner_for(fleet: dict):
        owner_id = fleet.get("owner_user_id")
        if not owner_id:
            return None
        try:
            return await db.users.find_one({"_id": ObjectId(str(owner_id))})
        except Exception:
            return None

    # ---------------- Action Center ----------------
    @api.get("/admin/control/action-center")
    async def action_center(current=Depends(require_admin)):
        pending_apps = await db.fleet_applications.count_documents({
            "status": {"$in": ["pending", "submitted", "under_review", "documents_required"]}
        })
        pending_drivers = await db.users.count_documents({
            "role": "driver",
            "$or": [{"approved": False}, {"approved": {"$exists": False}}],
        })
        open_support = await db.support_tickets.count_documents({
            "status": {"$in": ["open", "in_progress", "waiting_for_user"]}
        })
        failed_payments = await db.payment_transactions.count_documents({
            "$or": [{"payment_status": "failed"}, {"status": "failed"}]
        })
        failed_payouts = await db.fleet_payouts.count_documents({"status": "failed"})
        today = datetime.now(timezone.utc).date().isoformat()
        expiry_limit = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
        expired_documents = await db.uploaded_files.count_documents({
            "is_deleted": {"$ne": True},
            "review_status": "valid",
            "review_expiry": {"$ne": None, "$lt": today},
        })
        expiring_documents = await db.uploaded_files.count_documents({
            "is_deleted": {"$ne": True},
            "review_status": "valid",
            "review_expiry": {"$gte": today, "$lte": expiry_limit},
        })
        stripe_pending = await db.fleets.count_documents({
            "active": {"$ne": False},
            "$or": [
                {"stripe_account_id": {"$exists": False}},
                {"stripe_account_id": None},
                {"stripe_payouts_enabled": {"$ne": True}},
            ],
        })

        items = []
        if pending_apps:
            items.append({"type": "fleet_applications", "severity": "amber", "count": pending_apps,
                          "title": "Løyvesøknader venter", "detail": "Gjennomgå dokumenter og godkjenn/avvis.", "href": "/fleet-applications"})
        if pending_drivers:
            items.append({"type": "drivers", "severity": "amber", "count": pending_drivers,
                          "title": "Sjåfører venter på godkjenning", "detail": "Kontroller førerkort, kjøreseddel og profil.", "href": "/drivers"})
        if failed_payments:
            items.append({"type": "payments", "severity": "red", "count": failed_payments,
                          "title": "Betalinger har feilet", "detail": "Kontroller transaksjonene før oppgjør.", "href": "/payments"})
        if failed_payouts:
            items.append({"type": "payouts", "severity": "red", "count": failed_payouts,
                          "title": "Oppgjør har feilet", "detail": "Kontroller Stripe/bankstatus for løyvehaver.", "href": "/payments"})
        if stripe_pending:
            items.append({"type": "stripe_connect", "severity": "amber", "count": stripe_pending,
                          "title": "Stripe Connect ikke ferdigstilt", "detail": "Løyvehavere uten klar bank/KYC kan ikke motta automatiske oppgjør.", "href": "/fleets"})
        if expired_documents or expiring_documents:
            items.append({
                "type": "documents",
                "severity": "red" if expired_documents else "amber",
                "count": expired_documents + expiring_documents,
                "title": "Dokumenter krever oppfølging",
                "detail": f"{expired_documents} utløpt · {expiring_documents} utløper innen 30 dager",
                "href": "/documents",
            })
        if open_support:
            items.append({"type": "support", "severity": "blue", "count": open_support,
                          "title": "Åpne supportsaker", "detail": "Saker som fortsatt krever behandling.", "href": "/support"})
        return {
            "as_of": _now(),
            "summary": {
                "pending_applications": pending_apps,
                "pending_drivers": pending_drivers,
                "failed_payments": failed_payments,
                "failed_payouts": failed_payouts,
                "expired_documents": expired_documents,
                "expiring_documents": expiring_documents,
                "stripe_pending": stripe_pending,
                "open_support": open_support,
            },
            "items": items,
        }

    # ---------------- Integration health ----------------
    @api.get("/admin/control/integrations")
    async def integration_status(current=Depends(require_admin)):
        total_fleets = await db.fleets.count_documents({"active": {"$ne": False}})
        connect_ready = await db.fleets.count_documents({"stripe_payouts_enabled": True})
        stripe_key = bool(getattr(stripe, "api_key", None))
        key = str(getattr(stripe, "api_key", "") or "")
        return {
            "as_of": _now(),
            "integrations": [
                {
                    "id": "backend", "name": "KJAPP API / MongoDB", "status": "operational",
                    "detail": "FastAPI og database svarer.", "configured": True,
                },
                {
                    "id": "stripe", "name": "Stripe", "status": "operational" if stripe_key else "warning",
                    "detail": ("Live-modus" if key.startswith("sk_live_") else "Test-modus") if stripe_key else "STRIPE_SECRET_KEY mangler",
                    "configured": stripe_key,
                },
                {
                    "id": "stripe_connect", "name": "Stripe Connect", "status": "operational" if total_fleets and connect_ready == total_fleets else "warning",
                    "detail": f"{connect_ready} av {total_fleets} aktive løyvehavere klare for utbetaling",
                    "configured": stripe_key,
                },
                {
                    "id": "fcm", "name": "Firebase push", "status": "operational" if (os.getenv("FCM_SERVICE_ACCOUNT_JSON") or os.getenv("FCM_SERVICE_ACCOUNT_FILE")) else "warning",
                    "detail": "Native push til Customer/Driver", "configured": bool(os.getenv("FCM_SERVICE_ACCOUNT_JSON") or os.getenv("FCM_SERVICE_ACCOUNT_FILE")),
                },
                {
                    "id": "sendgrid", "name": "SendGrid e-post", "status": "operational" if os.getenv("SENDGRID_API_KEY") else "warning",
                    "detail": "E-post til sjåfører, løyvehavere og brukere", "configured": bool(os.getenv("SENDGRID_API_KEY")),
                },
                {
                    "id": "maps_routing", "name": "Kart & routing",
                    "status": "operational",
                    "detail": ("OSRM routing aktiv · MapTiler konfigurert" if os.getenv("MAPTILER_API_KEY") else "OSRM routing aktiv · kart bruker nøkkelfri/fallback der MapTiler ikke er satt"),
                    "configured": True,
                },
                {
                    "id": "ai", "name": "KJAPP Assist / AI",
                    "status": "operational" if os.getenv("EMERGENT_LLM_KEY") else "warning",
                    "detail": "Emergent LLM-integrasjon konfigurert" if os.getenv("EMERGENT_LLM_KEY") else "EMERGENT_LLM_KEY mangler",
                    "configured": bool(os.getenv("EMERGENT_LLM_KEY")),
                },
            ],
        }

    # ---------------- Stripe Connect ----------------
    @api.get("/admin/control/stripe-fleets")
    async def stripe_fleets(current=Depends(require_admin)):
        rows = []
        async for fleet in db.fleets.find({}).sort("created_at", -1).limit(300):
            owner = await owner_for(fleet)
            rows.append({
                "id": str(fleet["_id"]),
                "name": fleet.get("name"),
                "org_number": fleet.get("org_number"),
                "owner_email": (owner or {}).get("email"),
                "commission_rate": fleet.get("commission_rate", 0.10),
                "stripe_account_id": fleet.get("stripe_account_id"),
                "stripe_connect_status": fleet.get("stripe_connect_status", "not_connected"),
                "details_submitted": fleet.get("stripe_details_submitted", False),
                "charges_enabled": fleet.get("stripe_charges_enabled", False),
                "payouts_enabled": fleet.get("stripe_payouts_enabled", False),
                "payout_schedule": fleet.get("stripe_payout_schedule", "stripe_default"),
            })
        return {"fleets": rows}

    @api.post("/admin/control/fleets/{fleet_id}/stripe-connect")
    async def create_stripe_connect(fleet_id: str, current=Depends(require_superadmin)):
        if not getattr(stripe, "api_key", None):
            raise HTTPException(503, "Stripe er ikke konfigurert")
        fleet = await fleet_or_404(fleet_id)
        owner = await owner_for(fleet)
        owner_email = (owner or {}).get("email") or fleet.get("contact_email")
        account_id = fleet.get("stripe_account_id")
        created = False
        if not account_id:
            try:
                account = await asyncio.to_thread(
                    stripe.Account.create,
                    type="express",
                    country="NO",
                    email=owner_email,
                    capabilities={"transfers": {"requested": True}},
                    metadata={"kjapp_fleet_id": fleet_id, "kjapp_org_number": fleet.get("org_number") or ""},
                )
            except Exception as exc:
                raise HTTPException(502, f"Stripe Connect kunne ikke opprettes: {type(exc).__name__}")
            account_id = account.id
            created = True
            await db.fleets.update_one({"_id": _oid(fleet_id)}, {"$set": {
                "stripe_account_id": account_id,
                "stripe_connect_status": "onboarding",
                "stripe_payout_schedule": "stripe_default",
                "stripe_connected_at": _now(),
            }})
            try:
                await asyncio.to_thread(
                    stripe.Account.modify,
                    account_id,
                    settings={"payouts": {"schedule": {"interval": "weekly", "weekly_anchor": "friday"}}},
                )
                await db.fleets.update_one(
                    {"_id": _oid(fleet_id)},
                    {"$set": {"stripe_payout_schedule": "weekly_friday", "stripe_payout_schedule_updated_at": _now()}},
                )
            except Exception:
                # Connected account remains usable; display Stripe's default schedule until confirmed.
                pass
        public_admin = os.getenv("ADMIN_PUBLIC_URL", "https://admin.kjappapp.no").rstrip("/")
        try:
            link = await asyncio.to_thread(
                stripe.AccountLink.create,
                account=account_id,
                refresh_url=f"{public_admin}/#/fleets?stripe=refresh&fleet={fleet_id}",
                return_url=f"{public_admin}/#/fleets?stripe=return&fleet={fleet_id}",
                type="account_onboarding",
            )
        except Exception as exc:
            raise HTTPException(502, f"Stripe onboarding-lenke feilet: {type(exc).__name__}")
        if created:
            await audit(current, "fleet.stripe_connect_create", "fleet", fleet_id, None, {"stripe_account_id": account_id})
        return {"ok": True, "account_id": account_id, "onboarding_url": link.url}

    @api.get("/admin/control/fleets/{fleet_id}/stripe-status")
    async def get_stripe_status(fleet_id: str, current=Depends(require_admin)):
        fleet = await fleet_or_404(fleet_id)
        account_id = fleet.get("stripe_account_id")
        if not account_id:
            return {"connected": False, "ready": False, "status": "not_connected"}
        if not getattr(stripe, "api_key", None):
            raise HTTPException(503, "Stripe er ikke konfigurert")
        try:
            account = await asyncio.to_thread(stripe.Account.retrieve, account_id)
            snap = _stripe_snapshot(account)
        except Exception as exc:
            raise HTTPException(502, f"Stripe-status kunne ikke hentes: {type(exc).__name__}")
        payout_schedule = fleet.get("stripe_payout_schedule", "stripe_default")
        if snap["ready"] and payout_schedule != "weekly_friday":
            try:
                await asyncio.to_thread(
                    stripe.Account.modify,
                    account_id,
                    settings={"payouts": {"schedule": {"interval": "weekly", "weekly_anchor": "friday"}}},
                )
                payout_schedule = "weekly_friday"
            except Exception:
                payout_schedule = "stripe_default"
        await db.fleets.update_one({"_id": _oid(fleet_id)}, {"$set": {
            "stripe_details_submitted": snap["details_submitted"],
            "stripe_charges_enabled": snap["charges_enabled"],
            "stripe_payouts_enabled": snap["payouts_enabled"],
            "stripe_connect_status": "ready" if snap["ready"] else "restricted",
            "stripe_payout_schedule": payout_schedule,
            "stripe_status_checked_at": _now(),
        }})
        return {"connected": True, **snap, "payout_schedule": payout_schedule}

    @api.get("/admin/control/payouts")
    async def stripe_payouts(current=Depends(require_admin)):
        rows = []
        if not getattr(stripe, "api_key", None):
            return {"configured": False, "payouts": rows}
        async for fleet in db.fleets.find({"stripe_account_id": {"$exists": True, "$ne": None}}).limit(100):
            fid = str(fleet["_id"])
            try:
                plist = await asyncio.to_thread(
                    stripe.Payout.list,
                    limit=10,
                    stripe_account=fleet["stripe_account_id"],
                )
                for p in list(plist.data):
                    arrival = p.get("arrival_date")
                    rows.append({
                        "id": p.get("id"),
                        "fleet_id": fid,
                        "fleet_name": fleet.get("name"),
                        "amount": (p.get("amount") or 0) / 100,
                        "currency": str(p.get("currency") or "nok").upper(),
                        "status": p.get("status"),
                        "arrival_date": datetime.fromtimestamp(arrival, tz=timezone.utc).isoformat() if arrival else None,
                        "created": datetime.fromtimestamp(p.get("created"), tz=timezone.utc).isoformat() if p.get("created") else None,
                    })
            except Exception:
                continue
        rows.sort(key=lambda x: x.get("created") or "", reverse=True)
        return {"configured": True, "payouts": rows[:200]}

    # ---------------- Fleet onboarding actions ----------------
    @api.post("/admin/control/fleets/{fleet_id}/driver-invites")
    async def invite_driver_for_fleet(fleet_id: str, body: FleetDriverInvite, current=Depends(require_admin)):
        fleet = await fleet_or_404(fleet_id)
        token = secrets.token_urlsafe(24)
        email = body.email.strip().lower()
        doc = {
            "token": token,
            "car": body.car.strip(),
            "plate": body.plate.strip().upper(),
            "vehicle_type": body.vehicle_type,
            "note": body.note or "",
            "email": email,
            "created_by": current["id"],
            "fleet_id": fleet_id,
            "created_at": _now(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "used": False,
            "email_sent": False,
        }
        await db.driver_invites.insert_one(doc)
        base = os.getenv("FLEET_PUBLIC_URL", "https://fleet.kjappapp.no").rstrip("/")
        invite_url = f"{base}/driver-signup/{token}"
        safe_name = html.escape(str(fleet.get("name") or "KJAPP-flåten"))
        safe_car = html.escape(body.car)
        safe_plate = html.escape(body.plate.upper())
        mail = (
            "<div style='font-family:Arial,sans-serif;background:#071015;color:#e9edf1;padding:28px'>"
            "<h2 style='color:#72dce8'>KJAPP sjåførinvitasjon</h2>"
            f"<p>Du er invitert til <b>{safe_name}</b>.</p>"
            f"<p>Kjøretøy: <b>{safe_car} · {safe_plate}</b></p>"
            f"<p><a href='{html.escape(invite_url)}' style='color:#72dce8'>Fullfør registreringen</a></p>"
            "<p>Lenken utløper om 14 dager. Kontoen må godkjennes før du kan motta turer.</p></div>"
        )
        sent = await asyncio.to_thread(send_email, email, "Invitasjon: Bli sjåfør for KJAPP", mail)
        if sent:
            await db.driver_invites.update_one({"token": token}, {"$set": {"email_sent": True}})
        await audit(current, "fleet.driver_invite", "fleet", fleet_id, None, {"email": email, "plate": body.plate.upper()})
        return {"ok": True, "email_sent": bool(sent), "expires_at": doc["expires_at"]}

    @api.post("/admin/control/fleets/{fleet_id}/vehicle")
    async def update_fleet_vehicle(fleet_id: str, body: FleetVehicleUpdate, current=Depends(require_admin)):
        await fleet_or_404(fleet_id)
        driver = await db.users.find_one({"_id": _oid(body.driver_user_id), "role": "driver", "fleet_id": fleet_id})
        if not driver:
            raise HTTPException(404, "Sjåføren tilhører ikke denne løyvehaveren")
        before = {"car": driver.get("car"), "plate": driver.get("plate"), "vehicle_type": driver.get("vehicle_type")}
        after = {"car": body.car.strip(), "plate": body.plate.strip().upper(), "vehicle_type": body.vehicle_type}
        await db.users.update_one({"_id": driver["_id"]}, {"$set": after})
        await audit(current, "fleet.vehicle_update", "fleet", fleet_id, before, after)
        return {"ok": True}

    # ---------------- Communications ----------------
    async def recipient_users(audience: str, fleet_id: Optional[str]):
        query: dict = {"disabled": {"$ne": True}}
        if audience == "customers":
            query["role"] = {"$in": [None, "user", "customer"]}
        elif audience == "drivers":
            query["role"] = "driver"
        elif audience == "fleet_owners":
            query["role"] = "fleet_owner"
        elif audience == "fleet":
            if not fleet_id:
                raise HTTPException(400, "Velg løyvehaver")
            fleet = await fleet_or_404(fleet_id)
            owner_id = fleet.get("owner_user_id")
            ors = [{"fleet_id": fleet_id}]
            if owner_id:
                try:
                    ors.append({"_id": ObjectId(str(owner_id))})
                except Exception:
                    pass
            query["$or"] = ors
        else:
            query["role"] = {"$in": [None, "user", "customer", "driver", "fleet_owner"]}
        return await db.users.find(query, {"email": 1, "role": 1, "fleet_id": 1}).limit(5000).to_list(length=5000)

    @api.get("/admin/control/communication-fleets")
    async def communication_fleets(current=Depends(require_admin)):
        """Minimal fleet directory for staff who only have communications access."""
        fleets = []
        async for fleet in db.fleets.find({}, {"name": 1}).sort("name", 1).limit(500):
            fleets.append({"id": str(fleet["_id"]), "name": fleet.get("name") or "Uten navn"})
        return {"fleets": fleets}

    @api.get("/admin/control/communications")
    async def communication_history(limit: int = 50, current=Depends(require_admin)):
        limit = max(1, min(limit, 200))
        items = []
        async for item in db.admin_broadcasts.find({}).sort("created_at", -1).limit(limit):
            item["id"] = str(item["_id"]); item.pop("_id", None)
            items.append(item)
        return {"broadcasts": items}

    @api.post("/admin/control/communications")
    async def send_broadcast(body: BroadcastRequest, current=Depends(require_admin)):
        if not body.channels:
            raise HTTPException(400, "Velg minst én kanal")
        users = await recipient_users(body.audience, body.fleet_id)
        sem = asyncio.Semaphore(20)
        push_targets = 0
        email_sent = 0
        email_failed = 0

        async def deliver(user):
            nonlocal push_targets, email_sent, email_failed
            uid = str(user["_id"])
            async with sem:
                if "push" in body.channels:
                    has_native = await db.native_push_tokens.find_one({"user_id": uid}, {"_id": 1})
                    has_web = await db.push_subscriptions.find_one({"user_id": uid}, {"_id": 1})
                    if has_native or has_web:
                        push_targets += 1
                    await send_push_to_user(uid, body.title.strip(), body.body.strip(), body.url or "/app", "admin_broadcast")
                if "email" in body.channels and user.get("email"):
                    safe_title = html.escape(body.title.strip())
                    safe_body = html.escape(body.body.strip()).replace("\n", "<br>")
                    ok = await asyncio.to_thread(
                        send_email,
                        user["email"],
                        body.title.strip(),
                        f"<div style='font-family:Arial,sans-serif'><h2>{safe_title}</h2><p>{safe_body}</p></div>",
                    )
                    if ok: email_sent += 1
                    else: email_failed += 1

        await asyncio.gather(*(deliver(u) for u in users))
        doc = {
            "title": body.title.strip(),
            "body": body.body.strip(),
            "audience": body.audience,
            "fleet_id": body.fleet_id,
            "channels": list(body.channels),
            "recipient_count": len(users),
            "push_targeted": push_targets,
            "email_sent": email_sent,
            "email_failed": email_failed,
            "created_by": current["id"],
            "created_by_email": current.get("email"),
            "created_at": _now(),
        }
        result = await db.admin_broadcasts.insert_one(doc)
        await audit(current, "communication.broadcast", "broadcast", str(result.inserted_id), None,
                    {"audience": body.audience, "recipients": len(users), "channels": list(body.channels)})
        return {"ok": True, **{k: v for k, v in doc.items() if k != "_id"}}

    # ---------------- Admin users / permissions ----------------
    @api.get("/admin/control/admin-users")
    async def list_admin_users(current=Depends(require_superadmin)):
        users = []
        async for user in db.users.find({"role": {"$in": ["admin", "superadmin"]}}, {"password_hash": 0}).sort("created_at", 1):
            users.append({
                "id": str(user["_id"]),
                "email": user.get("email"),
                "fullName": user.get("fullName"),
                "role": user.get("role"),
                "disabled": user.get("disabled", False),
                "permissions": user.get("permissions"),
                "totp_enabled": user.get("totp_enabled", False),
                "created_at": user.get("created_at"),
            })
        return {"users": users, "available_permissions": list(ADMIN_PERMISSIONS)}

    @api.post("/admin/control/admin-users")
    async def create_admin_user(body: AdminUserCreate, current=Depends(require_superadmin)):
        email = body.email.strip().lower()
        if not email or "@" not in email:
            raise HTTPException(400, "Ugyldig e-post")
        if await db.users.find_one({"email": email}):
            raise HTTPException(409, "E-post er allerede registrert")
        perms = clean_permissions(body.permissions)
        temp_password = secrets.token_urlsafe(12)
        doc = {
            "email": email,
            "fullName": body.full_name.strip(),
            "phone": "",
            "role": "admin",
            "permissions": perms,
            "password_hash": hash_password(temp_password),
            "approved": True,
            "disabled": False,
            "must_reset_password": True,
            "created_at": _now(),
        }
        result = await db.users.insert_one(doc)
        uid = str(result.inserted_id)
        await audit(current, "admin_user.create", "admin_user", uid, None, {"email": email, "permissions": perms})
        return {"ok": True, "id": uid, "email": email, "temp_password": temp_password, "permissions": perms}

    @api.patch("/admin/control/admin-users/{user_id}")
    async def update_admin_user(user_id: str, body: AdminUserUpdate, current=Depends(require_superadmin)):
        if user_id == current.get("id") and body.disabled is True:
            raise HTTPException(400, "Du kan ikke deaktivere din egen konto")
        target = await db.users.find_one({"_id": _oid(user_id), "role": {"$in": ["admin", "superadmin"]}})
        if not target:
            raise HTTPException(404, "Fant ikke administrator")
        if target.get("role") == "superadmin" and body.permissions is not None:
            raise HTTPException(400, "Superadmin har alltid full tilgang")
        sets = {}
        if body.full_name is not None:
            sets["fullName"] = body.full_name.strip()
        if body.permissions is not None:
            sets["permissions"] = clean_permissions(body.permissions)
        if body.disabled is not None:
            sets["disabled"] = bool(body.disabled)
        if not sets:
            return {"ok": True}
        before = {k: target.get(k) for k in sets}
        await db.users.update_one({"_id": target["_id"]}, {"$set": sets})
        await audit(current, "admin_user.update", "admin_user", user_id, before, sets)
        return {"ok": True}
