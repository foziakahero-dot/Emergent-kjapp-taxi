"""Direct OpenAI Responses adapter for SNAR Assist.

This module preserves the old ``LlmChat``/``UserMessage`` import surface so the
large FastAPI application does not need a risky rewrite during the beta release.
No Emergent proxy is used here.

For customer chat sessions (``snar:<env>:<user_id>:<digest>``) the adapter:
* mirrors every user/assistant turn to Astra DB Data API,
* rebuilds short conversation context from Astra,
* injects canonical active-trip/payment data from the SNAR MongoDB backend,
* resolves "fra A til B" price questions through SNAR's own geocoding and
  /trips/estimate endpoint,
* creates a real support ticket when the customer explicitly asks for a human.

If QA AI is enabled but Astra is not configured, customer chat fails closed
instead of silently storing history somewhere else.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient


@dataclass(frozen=True)
class UserMessage:
    text: str


_SESSION_RE = re.compile(
    r"^snar:(?P<environment>[a-z0-9_-]+):(?P<user_id>[0-9a-fA-F]{24}):(?P<digest>[0-9a-f]{64})$"
)
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


def _mongo():
    global _MONGO_CLIENT
    url = (os.environ.get("MONGO_URL") or "").strip()
    name = (os.environ.get("DB_NAME") or "").strip()
    if not url or not name:
        return None
    if _MONGO_CLIENT is None:
        _MONGO_CLIENT = AsyncIOMotorClient(
            url,
            serverSelectionTimeoutMS=6000,
            connectTimeoutMS=6000,
            socketTimeoutMS=10000,
            maxPoolSize=10,
        )
    return _MONGO_CLIENT[name]


def _session_parts(session_id: str) -> Optional[dict[str, str]]:
    match = _SESSION_RE.fullmatch(str(session_id or ""))
    return match.groupdict() if match else None


def _model_name(requested: str) -> str:
    requested = str(requested or "").strip()
    if requested in {"gpt-5.6-sol", "gpt-6-sol", "gpt-6.1-sol"}:
        return (os.environ.get("SNAR_OPENAI_CHAT_MODEL") or "gpt-6.1-sol").strip()
    if requested in {"gpt-5.6-luna", "gpt-6-luna"}:
        return (os.environ.get("SNAR_OPENAI_FAST_MODEL") or "gpt-6-luna").strip()
    return requested or (os.environ.get("SNAR_OPENAI_CHAT_MODEL") or "gpt-6.1-sol").strip()


def _public_api_base(environment: str) -> str:
    configured = (
        os.environ.get("SNAR_PUBLIC_API_URL")
        or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
        or ""
    ).strip().rstrip("/")
    if configured:
        return configured
    return "https://api-qa.snarapp.no" if environment == "qa" else "https://api.kjappapp.no"


def _astra_settings(required: bool = False) -> Optional[dict[str, str]]:
    endpoint = (os.environ.get("ASTRA_DB_API_ENDPOINT") or "").strip().rstrip("/")
    token = (os.environ.get("ASTRA_DB_APPLICATION_TOKEN") or "").strip()
    keyspace = (os.environ.get("ASTRA_DB_KEYSPACE") or "default_keyspace").strip()
    collection = (os.environ.get("ASTRA_DB_CHAT_COLLECTION") or "snar_ai_chat").strip()
    if endpoint and token and keyspace and collection:
        return {
            "endpoint": endpoint,
            "token": token,
            "keyspace": keyspace,
            "collection": collection,
        }
    if required:
        raise RuntimeError(
            "Astra DB er ikke konfigurert: ASTRA_DB_API_ENDPOINT og "
            "ASTRA_DB_APPLICATION_TOKEN må settes før SNAR AI-chat aktiveres."
        )
    return None


async def _astra_post(
    settings: dict[str, str],
    payload: dict[str, Any],
    *,
    collection: bool = True,
) -> dict[str, Any]:
    suffix = f"/api/json/v1/{settings['keyspace']}"
    if collection:
        suffix += f"/{settings['collection']}"
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.post(
            settings["endpoint"] + suffix,
            headers={
                "Token": settings["token"],
                "Content-Type": "application/json",
            },
            json=payload,
        )
    response.raise_for_status()
    data = response.json()
    if data.get("errors"):
        raise RuntimeError("Astra Data API returnerte en feil.")
    return data


async def _astra_insert(settings: dict[str, str], document: dict[str, Any]) -> None:
    payload = {"insertOne": {"document": document}}
    try:
        await _astra_post(settings, payload)
        return
    except (httpx.HTTPStatusError, RuntimeError) as first_error:
        try:
            await _astra_post(
                settings,
                {
                    "createCollection": {
                        "name": settings["collection"],
                        "options": {"defaultId": {"type": "uuidv7"}},
                    }
                },
                collection=False,
            )
            await _astra_post(settings, payload)
            return
        except Exception:
            raise first_error


async def _astra_history(
    settings: dict[str, str],
    user_id: str,
    session_key: str,
    limit: int = 20,
) -> list[dict[str, str]]:
    data = await _astra_post(
        settings,
        {
            "find": {
                "filter": {"user_id": user_id, "session_key": session_key},
                "sort": {"created_at": 1},
                "options": {"limit": max(1, min(int(limit), 40))},
                "projection": {"role": 1, "content": 1, "created_at": 1},
            }
        },
    )
    documents = ((data.get("data") or {}).get("documents") or [])
    history: list[dict[str, str]] = []
    for doc in documents:
        role = doc.get("role")
        content = doc.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            history.append({"role": role, "content": content.strip()})
    return history[-limit:]


def _clean_address(value: str) -> str:
    value = re.sub(r"\s+", " ", str(value or "")).strip(" \t\r\n,;:")
    return value[:160]


async def _real_price_context(environment: str, message: str) -> Optional[dict[str, Any]]:
    match = _PRICE_RE.search(message)
    if not match:
        return None
    pickup = _clean_address(match.group("pickup"))
    dropoff = _clean_address(match.group("dropoff"))
    if not pickup or not dropoff:
        return None

    base = _public_api_base(environment)
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        p_resp, d_resp = await __import__("asyncio").gather(
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
                "pickup_lat": p["lat"],
                "pickup_lng": p["lng"],
                "dropoff_lat": d["lat"],
                "dropoff_lng": d["lng"],
                "stops": [],
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


async def _active_customer_context(user_id: str) -> dict[str, Any]:
    database = _mongo()
    if database is None:
        return {"backend_context": "unavailable"}

    try:
        oid = ObjectId(user_id)
    except Exception:
        return {"backend_context": "invalid_user"}

    user = await database.users.find_one(
        {"_id": oid},
        {
            "email": 1,
            "fullName": 1,
            "phone": 1,
            "default_payment_method_id": 1,
            "stripe_customer_id": 1,
        },
    ) or {}
    trip = await database.trips.find_one(
        {"user_id": user_id, "status": {"$in": list(_ACTIVE_TRIP_STATUSES)}},
        sort=[("created_at", -1)],
    )
    verified_cards = await database.payment_methods.count_documents(
        {
            "user_id": user_id,
            "verified": True,
            "setup_status": "succeeded",
            "stripe_payment_method_id": {"$type": "string"},
        }
    )

    out: dict[str, Any] = {
        "customer": {
            "name": user.get("fullName"),
            "has_verified_payment_method": verified_cards > 0,
        },
        "active_trip": None,
    }
    if trip:
        driver = trip.get("driver") or {}
        out["active_trip"] = {
            "trip_id": trip.get("trip_id"),
            "status": trip.get("status"),
            "pickup_address": trip.get("pickup_address"),
            "dropoff_address": trip.get("dropoff_address"),
            "vehicle_type": trip.get("vehicle_type"),
            "price_nok": trip.get("price"),
            "payment_status": trip.get("payment_status"),
            "eta_min": trip.get("eta_min") or trip.get("driver_eta_min") or trip.get("duration_min"),
            "driver": {
                "name": driver.get("name"),
                "car": driver.get("car"),
                "plate": driver.get("plate"),
                "rating": driver.get("rating"),
            } if driver else None,
        }
    return out


async def _maybe_create_support_ticket(user_id: str, message: str) -> Optional[str]:
    if not _SUPPORT_RE.search(message):
        return None
    database = _mongo()
    if database is None:
        return None
    try:
        user = await database.users.find_one(
            {"_id": ObjectId(user_id)},
            {"email": 1, "fullName": 1},
        ) or {}
    except Exception:
        return None

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    existing = await database.support_tickets.find_one(
        {
            "created_by": user_id,
            "source": "snar_ai",
            "status": "open",
            "created_at": {"$gte": cutoff},
        },
        {"_id": 1},
    )
    if existing:
        return str(existing["_id"])

    now = datetime.now(timezone.utc).isoformat()
    result = await database.support_tickets.insert_one(
        {
            "subject": "SNAR Assist · kunden ber om menneskelig support",
            "body": message[:4000],
            "message": message[:4000],
            "category": "annet",
            "priority": "normal",
            "status": "open",
            "name": user.get("fullName"),
            "contact_email": user.get("email"),
            "created_by": user_id,
            "created_by_email": user.get("email"),
            "source": "snar_ai",
            "created_at": now,
            "notes": [],
        }
    )
    return str(result.inserted_id)


async def _live_context(parts: dict[str, str], message: str) -> dict[str, Any]:
    context = await _active_customer_context(parts["user_id"])
    try:
        price = await _real_price_context(parts["environment"], message)
    except Exception as exc:
        price = {
            "resolved": False,
            "reason": "pricing_service_unavailable",
            "error_type": type(exc).__name__,
        }
    if price is not None:
        context["requested_price_estimate"] = price

    ticket_id = await _maybe_create_support_ticket(parts["user_id"], message)
    if ticket_id:
        context["support_handoff"] = {
            "created": True,
            "ticket_id": ticket_id,
            "message": "Menneskelig kundestøtte er varslet.",
        }
    return context


def _extract_output_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    chunks: list[str] = []
    for item in payload.get("output") or []:
        for content in item.get("content") or []:
            if content.get("type") in {"output_text", "text"} and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(x.strip() for x in chunks if x.strip()).strip()


class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = str(api_key or "").strip()
        self.session_id = str(session_id or "").strip()
        self.system_message = str(system_message or "").strip()
        self.model = "gpt-6.1-sol"

    def with_model(self, provider: str, model: str):
        if str(provider or "").lower() != "openai":
            raise ValueError("SNAR AI støtter bare OpenAI i denne adapteren.")
        self.model = _model_name(model)
        return self

    async def send_message(self, message: UserMessage) -> str:
        if not self.api_key:
            raise RuntimeError("OpenAI API-nøkkel mangler.")
        text = str(getattr(message, "text", "") or "").strip()
        if not text:
            raise ValueError("Tom AI-melding.")

        parts = _session_parts(self.session_id)
        history: list[dict[str, str]] = []
        live_context: dict[str, Any] = {}
        astra = None

        if parts:
            astra = _astra_settings(required=True)
            history = await _astra_history(
                astra, parts["user_id"], self.session_id, limit=20
            )
            live_context = await _live_context(parts, text)
            await _astra_insert(
                astra,
                {
                    "user_id": parts["user_id"],
                    "session_key": self.session_id,
                    "environment": parts["environment"],
                    "role": "user",
                    "content": text,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        instructions = self.system_message
        if live_context:
            instructions += (
                "\n\nREELL SNAR-DATA FRA BACKEND (autoritative data; ikke dikt opp manglende verdier):\n"
                + json.dumps(live_context, ensure_ascii=False, default=str)
                + "\nBruk disse dataene når spørsmålet gjelder pris, aktiv tur, betaling, sjåfør eller support. "
                  "Hvis requested_price_estimate.resolved er false, si at adressen/prisen må avklares i appen."
            )

        input_items = history + [{"role": "user", "content": text}]
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "instructions": instructions,
                    "input": input_items,
                    "store": False,
                },
            )
        response.raise_for_status()
        reply = _extract_output_text(response.json())
        if not reply:
            raise RuntimeError("OpenAI returnerte tomt svar.")

        if parts and astra:
            await _astra_insert(
                astra,
                {
                    "user_id": parts["user_id"],
                    "session_key": self.session_id,
                    "environment": parts["environment"],
                    "role": "assistant",
                    "content": reply,
                    "model": self.model,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        return reply


__all__ = [
    "LlmChat",
    "UserMessage",
    "_model_name",
    "_session_parts",
    "_extract_output_text",
]
