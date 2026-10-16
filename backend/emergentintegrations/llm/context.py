"""Canonical SNAR backend context used by the customer AI assistant."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

_PRICE_RE = re.compile(
    r"(?:pris|koster|kostnad|prisestimat|tur).{0,80}?\bfra\s+"
    r"(?P<pickup>.{2,140}?)\s+til\s+(?P<dropoff>.{2,140}?)(?:[?!.]|$)",
    re.IGNORECASE | re.DOTALL,
)
_SUPPORT_RE = re.compile(
    r"\b(menneskelig|menneske|kundeservice|support|snakke med noen|kontakt(?:e)? support|"
    r"kontakt(?:e)? kundeservice|kundebehandler)\b",
    re.IGNORECASE,
)
_ACTIVE_TRIP_STATUSES = {
    "payment_authorizing", "searching", "booking", "driver_on_way",
    "at_pickup", "in_trip", "arrived",
}
_MONGO_CLIENT: Optional[AsyncIOMotorClient] = None


def mongo_db():
    global _MONGO_CLIENT
    url = (os.environ.get("MONGO_URL") or "").strip()
    name = (os.environ.get("DB_NAME") or "").strip()
    if not url or not name:
        return None
    if _MONGO_CLIENT is None:
        _MONGO_CLIENT = AsyncIOMotorClient(
            url, serverSelectionTimeoutMS=6000, connectTimeoutMS=6000,
            socketTimeoutMS=10000, maxPoolSize=10,
        )
    return _MONGO_CLIENT[name]


def public_api_base(environment: str) -> str:
    configured = (
        os.environ.get("SNAR_PUBLIC_API_URL")
        or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
        or ""
    ).strip().rstrip("/")
    if configured:
        return configured
    return "https://api-qa.snarapp.no" if environment == "qa" else "https://api.kjappapp.no"


def clean_address(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip(" \t\r\n,;:")[:160]


async def real_price_context(environment: str, message: str) -> Optional[dict[str, Any]]:
    match = _PRICE_RE.search(message)
    if not match:
        return None
    pickup = clean_address(match.group("pickup"))
    dropoff = clean_address(match.group("dropoff"))
    if not pickup or not dropoff:
        return None

    base = public_api_base(environment)
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        import asyncio
        p_resp, d_resp = await asyncio.gather(
            client.get(f"{base}/api/places/search", params={"q": pickup, "limit": 1}),
            client.get(f"{base}/api/places/search", params={"q": dropoff, "limit": 1}),
        )
        p_resp.raise_for_status()
        d_resp.raise_for_status()
        p_items = (p_resp.json() or {}).get("results") or []
        d_items = (d_resp.json() or {}).get("results") or []
        if not p_items or not d_items:
            return {
                "requested": {"pickup": pickup, "dropoff": dropoff},
                "resolved": False,
                "reason": "address_not_resolved",
            }
        p = p_items[0]
        d = d_items[0]
        estimate_resp = await client.post(
            f"{base}/api/trips/estimate",
            json={
                "pickup_lat": p["lat"], "pickup_lng": p["lng"],
                "dropoff_lat": d["lat"], "dropoff_lng": d["lng"], "stops": [],
            },
        )
        estimate_resp.raise_for_status()
        estimate = estimate_resp.json()
    return {
        "requested": {"pickup": pickup, "dropoff": dropoff},
        "resolved": True,
        "pickup": {"name": p.get("name"), "lat": p.get("lat"), "lng": p.get("lng")},
        "dropoff": {"name": d.get("name"), "lat": d.get("lat"), "lng": d.get("lng")},
        "estimate": {
            "distance_km": estimate.get("distance_km"),
            "duration_min": estimate.get("duration_min"),
            "pricing_area": estimate.get("pricing_area"),
            "pricing_version": estimate.get("pricing_version"),
            "options": estimate.get("options") or [],
        },
    }


async def active_customer_context(user_id: str) -> dict[str, Any]:
    database = mongo_db()
    if database is None:
        return {"backend_context": "unavailable"}
    try:
        oid = ObjectId(user_id)
    except Exception:
        return {"backend_context": "invalid_user"}

    user = await database.users.find_one(
        {"_id": oid}, {"fullName": 1, "default_payment_method_id": 1, "stripe_customer_id": 1},
    ) or {}
    trip = await database.trips.find_one(
        {"user_id": user_id, "status": {"$in": list(_ACTIVE_TRIP_STATUSES)}},
        sort=[("created_at", -1)],
    )
    verified_cards = await database.payment_methods.count_documents(
        {
            "user_id": user_id, "verified": True, "setup_status": "succeeded",
            "stripe_payment_method_id": {"$type": "string"},
        }
    )
    out: dict[str, Any] = {
        "customer": {"name": user.get("fullName"), "has_verified_payment_method": verified_cards > 0},
        "active_trip": None,
    }
    if trip:
        driver = trip.get("driver") or {}
        out["active_trip"] = {
            "trip_id": trip.get("trip_id"), "status": trip.get("status"),
            "pickup_address": trip.get("pickup_address"), "dropoff_address": trip.get("dropoff_address"),
            "vehicle_type": trip.get("vehicle_type"), "price_nok": trip.get("price"),
            "payment_status": trip.get("payment_status"),
            "eta_min": trip.get("eta_min") or trip.get("driver_eta_min") or trip.get("duration_min"),
            "driver": {
                "name": driver.get("name"), "car": driver.get("car"),
                "plate": driver.get("plate"), "rating": driver.get("rating"),
            } if driver else None,
        }
    return out


async def maybe_create_support_ticket(user_id: str, message: str) -> Optional[str]:
    if not _SUPPORT_RE.search(message):
        return None
    database = mongo_db()
    if database is None:
        return None
    try:
        user = await database.users.find_one(
            {"_id": ObjectId(user_id)}, {"email": 1, "fullName": 1}
        ) or {}
    except Exception:
        return None

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    existing = await database.support_tickets.find_one(
        {"created_by": user_id, "source": "snar_ai", "status": "open", "created_at": {"$gte": cutoff}},
        {"_id": 1},
    )
    if existing:
        return str(existing["_id"])

    now = datetime.now(timezone.utc).isoformat()
    result = await database.support_tickets.insert_one(
        {
            "subject": "SNAR Assist · kunden ber om menneskelig support",
            "body": message[:4000], "message": message[:4000], "category": "annet",
            "priority": "normal", "status": "open", "name": user.get("fullName"),
            "contact_email": user.get("email"), "created_by": user_id,
            "created_by_email": user.get("email"), "source": "snar_ai",
            "created_at": now, "notes": [],
        }
    )
    return str(result.inserted_id)


async def live_context(parts: dict[str, str], message: str) -> dict[str, Any]:
    context = await active_customer_context(parts["user_id"])
    try:
        price = await real_price_context(parts["environment"], message)
    except Exception as exc:
        price = {"resolved": False, "reason": "pricing_service_unavailable", "error_type": type(exc).__name__}
    if price is not None:
        context["requested_price_estimate"] = price

    ticket_id = await maybe_create_support_ticket(parts["user_id"], message)
    if ticket_id:
        context["support_handoff"] = {
            "created": True, "ticket_id": ticket_id, "message": "Menneskelig kundestøtte er varslet."
        }
    return context


__all__ = ["live_context", "_PRICE_RE"]
