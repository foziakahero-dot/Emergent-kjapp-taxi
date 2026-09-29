"""KJAPP Operations OS.

Safe control plane for post-launch changes:
- Public runtime configuration consumed by mobile/web clients.
- Versioned remote config + feature flags with rollback.
- Release registry for OTA/native/backend/admin releases.
- AI change planner with explicit approval gate.

The AI planner NEVER executes shell/GitHub/deploy operations. It may only propose an
allow-listed runtime/feature patch. A superadmin must approve and then explicitly
apply a config-class plan. Code/OTA/native/backend plans remain advisory and must
go through the normal repository/release pipeline.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Literal, Optional

import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError


DEFAULT_RUNTIME_CONFIG = {
    "shared": {
        "help_url": "https://kjappapp.no/help",
        "privacy_url": "https://kjappapp.no/personvern",
        "terms_url": "https://kjappapp.no/vilkar",
        "support_email": "support@kjappapp.no",
        "support_phone": "",
        "status_message": "",
    },
    "customer": {
        "home_prompt": "Hvor skal du?",
        "home_hint": "Søk adresse, sted eller flyplass",
        "maintenance_mode": False,
        "maintenance_message": "",
        "force_update": False,
        "min_supported_version": "",
    },
    "driver": {
        "maintenance_mode": False,
        "maintenance_message": "",
        "force_update": False,
        "min_supported_version": "",
    },
}

_RUNTIME_SCHEMA = {
    "shared": {
        "help_url": "url", "privacy_url": "url", "terms_url": "url",
        "support_email": "email", "support_phone": "short", "status_message": "text",
    },
    "customer": {
        "home_prompt": "short", "home_hint": "text",
        "maintenance_mode": "bool", "maintenance_message": "text",
        "force_update": "bool", "min_supported_version": "version",
    },
    "driver": {
        "maintenance_mode": "bool", "maintenance_message": "text",
        "force_update": "bool", "min_supported_version": "version",
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_doc(doc: Optional[dict]) -> dict:
    out = dict(doc or {})
    out.pop("_id", None)
    return out


async def _ensure_baseline_version(platform_settings) -> None:
    """Best-effort legacy migration to an explicit runtime_config_version=1.

    DuplicateKeyError means another publisher already touched the singleton.
    That is safe: callers re-read state and continue through compare-and-swap.
    """
    try:
        await platform_settings.update_one(
            {"_id": "singleton", "runtime_config_version": {"$exists": False}},
            {"$set": {"runtime_config_version": 1}},
            upsert=True,
        )
    except DuplicateKeyError:
        pass


def _merge_runtime(base: Optional[dict], patch: Optional[dict] = None) -> dict:
    out = deepcopy(DEFAULT_RUNTIME_CONFIG)
    for section, values in (base or {}).items():
        if section in out and isinstance(values, dict):
            out[section].update(values)
    for section, values in (patch or {}).items():
        if section in out and isinstance(values, dict):
            out[section].update(values)
    return out


def _validate_scalar(kind: str, value: Any, field_name: str) -> Any:
    if kind == "bool":
        if not isinstance(value, bool):
            raise HTTPException(400, f"{field_name} må være true/false")
        return value
    if not isinstance(value, str):
        raise HTTPException(400, f"{field_name} må være tekst")
    value = value.strip()
    if kind == "url":
        if value and not value.startswith("https://"):
            raise HTTPException(400, f"{field_name} må bruke https://")
        if len(value) > 500:
            raise HTTPException(400, f"{field_name} er for lang")
        return value
    if kind == "email":
        if value and (len(value) > 254 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value)):
            raise HTTPException(400, f"{field_name} er ikke en gyldig e-post")
        return value
    if kind == "version":
        if value and (len(value) > 32 or not re.match(r"^[0-9A-Za-z._+-]+$", value)):
            raise HTTPException(400, f"{field_name} har ugyldig versjonsformat")
        return value
    max_len = 120 if kind == "short" else 500
    if len(value) > max_len:
        raise HTTPException(400, f"{field_name} er for lang")
    return value


def validate_runtime_patch(patch: dict) -> dict:
    if not isinstance(patch, dict):
        raise HTTPException(400, "runtime_patch må være et objekt")
    cleaned = {}
    unknown_sections = set(patch) - set(_RUNTIME_SCHEMA)
    if unknown_sections:
        raise HTTPException(400, "Ukjente runtime-seksjoner: " + ", ".join(sorted(unknown_sections)))
    for section, values in patch.items():
        if not isinstance(values, dict):
            raise HTTPException(400, f"{section} må være et objekt")
        allowed = _RUNTIME_SCHEMA[section]
        unknown = set(values) - set(allowed)
        if unknown:
            raise HTTPException(400, f"Ukjente {section}-felt: " + ", ".join(sorted(unknown)))
        cleaned[section] = {
            key: _validate_scalar(allowed[key], value, f"{section}.{key}")
            for key, value in values.items()
        }
    return cleaned


def validate_feature_patch(patch: dict, default_features: dict) -> dict:
    if not isinstance(patch, dict):
        raise HTTPException(400, "feature_patch må være et objekt")
    unknown = set(patch) - set(default_features)
    if unknown:
        raise HTTPException(400, "Ukjente feature-flagg: " + ", ".join(sorted(unknown)))
    if any(not isinstance(v, bool) for v in patch.values()):
        raise HTTPException(400, "Feature-flagg må være true/false")
    cleaned = dict(patch)
    if cleaned.get("demo_trips") is True:
        raise HTTPException(400, "demo_trips kan ikke aktiveres i Operations OS")
    return cleaned


# Operations OS is intentionally narrower than the full Settings/Pricing surfaces.
# Pricing/payment switches must use their dedicated audited workflows.
OPS_FEATURE_ALLOWLIST = {"booking_enabled", "ai_chat"}
AI_FEATURE_ALLOWLIST = OPS_FEATURE_ALLOWLIST


def validate_ops_feature_patch(patch: dict, default_features: dict) -> dict:
    cleaned = validate_feature_patch(patch, default_features)
    blocked = set(cleaned) - OPS_FEATURE_ALLOWLIST
    if blocked:
        raise HTTPException(
            400,
            "Bruk dedikert Settings/Pricing for disse feature-flaggene: " + ", ".join(sorted(blocked)),
        )
    return cleaned


def validate_ai_feature_patch(patch: dict, default_features: dict) -> dict:
    cleaned = validate_feature_patch(patch, default_features)
    blocked = set(cleaned) - AI_FEATURE_ALLOWLIST
    if blocked:
        raise HTTPException(400, "AI kan ikke endre disse feature-flaggene: " + ", ".join(sorted(blocked)))
    return cleaned


class RuntimePatchRequest(BaseModel):
    runtime_patch: dict = Field(default_factory=dict)
    feature_patch: dict = Field(default_factory=dict)
    reason: str = Field(min_length=3, max_length=500)


class RuntimeRollbackRequest(BaseModel):
    version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)


class ReleaseCreateRequest(BaseModel):
    app: Literal["customer", "driver", "admin", "fleet", "backend", "all"]
    kind: Literal["config", "ota", "native", "backend", "web"]
    channel: Literal["staging", "production"]
    version: str = Field(min_length=1, max_length=80)
    source_ref: Optional[str] = Field(default=None, max_length=200)
    notes: str = Field(default="", max_length=2000)


class ReleaseTransitionRequest(BaseModel):
    status: Literal["planned", "approved", "publishing", "published", "failed", "rolled_back"]
    note: str = Field(default="", max_length=1000)


class AIPlanRequest(BaseModel):
    request: str = Field(min_length=3, max_length=2000)


class AIApproveRequest(BaseModel):
    note: str = Field(default="", max_length=1000)


class AIApplyRequest(BaseModel):
    confirmation: Literal["APPLY"]


def _extract_response_text(payload: dict) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    chunks = []
    for item in payload.get("output") or []:
        for part in item.get("content") or []:
            value = part.get("text")
            if isinstance(value, str):
                chunks.append(value)
    return "\n".join(chunks).strip()


def _fallback_plan(request_text: str) -> dict:
    text = request_text.strip()
    low = text.lower()
    runtime_patch = {}
    feature_patch = {}

    m = re.search(r"(?:hvor skal du|hjem(?:me)?[- ]?tekst|home prompt).*?(?:til|=|:)\s*[\"“]?([^\"”\n]{2,100})", text, re.I)
    if m:
        runtime_patch.setdefault("customer", {})["home_prompt"] = m.group(1).strip(" .\"“”")

    email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    if email and ("support" in low or "e-post" in low or "epost" in low):
        runtime_patch.setdefault("shared", {})["support_email"] = email.group(0).lower()

    if "booking" in low or "bestilling" in low:
        if any(x in low for x in ("slå av", "deaktiver", "stopp", "pause")):
            feature_patch["booking_enabled"] = False
        elif any(x in low for x in ("slå på", "aktiver", "åpne")):
            feature_patch["booking_enabled"] = True

    if "ai chat" in low or "ai-chat" in low or "kjapp assist" in low:
        if any(x in low for x in ("slå av", "deaktiver", "stopp")):
            feature_patch["ai_chat"] = False
        elif any(x in low for x in ("slå på", "aktiver")):
            feature_patch["ai_chat"] = True

    if runtime_patch or feature_patch:
        return {
            "summary": "Kan gjennomføres som serverstyrt konfigurasjon uten ny app-build.",
            "change_type": "config", "risk": "low",
            "runtime_patch": runtime_patch, "feature_patch": feature_patch,
            "requires_build": False, "requires_ota": False,
            "notes": ["Krever eksplisitt superadmin-godkjenning før publisering."],
        }

    native_terms = ("permission", "firebase", "bundle", "native", "apple sign", "google sign", "sdk")
    if any(t in low for t in native_terms):
        change_type = "native"
    elif any(t in low for t in ("layout", "knapp", "tekst i app", "react native", "skjerm", "css", "design")):
        change_type = "ota"
    elif any(t in low for t in ("backend", "api", "database", "mongo", "stripe", "dispatch")):
        change_type = "backend"
    else:
        change_type = "code"
    return {
        "summary": "Endringen krever kode/release-pipeline og kan ikke kjøres direkte fra Admin.",
        "change_type": change_type, "risk": "medium",
        "runtime_patch": {}, "feature_patch": {},
        "requires_build": change_type == "native", "requires_ota": change_type == "ota",
        "notes": ["Operations OS oppretter plan og godkjenning, men kjører aldri vilkårlig kode i produksjon."],
    }


async def _ai_plan(request_text: str):
    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not key:
        return _fallback_plan(request_text), "rules"

    model = (os.getenv("KJAPP_ADMIN_AI_MODEL") or "gpt-5.6-sol").strip()
    system = """Du er KJAPP Senior Engineer Change Planner. Svar KUN med gyldig JSON.
Klassifiser forespørselen som config, ota, native, backend eller code.
Direkte runtime_patch er KUN tillatt for:
shared: help_url, privacy_url, terms_url, support_email, support_phone, status_message
customer: home_prompt, home_hint, maintenance_mode, maintenance_message, force_update, min_supported_version
driver: maintenance_mode, maintenance_message, force_update, min_supported_version
feature_patch: ai_chat, booking_enabled
surge, vipps og demo_trips er ALDRI tillatt i en AI-applisert patch.
Penge-/prisendringer, betalingsmetoder, auth, database, Stripe, dispatch og kode skal aldri bli config-patch.
Returner JSON med summary, change_type, risk, runtime_patch, feature_patch, requires_build, requires_ota, notes.
Ingen markdown, hemmeligheter eller shell-kommandoer."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "input": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": request_text},
                    ],
                },
            )
        response.raise_for_status()
        parsed = json.loads(_extract_response_text(response.json()))
        if not isinstance(parsed, dict):
            raise ValueError("AI plan is not an object")
        return parsed, model
    except Exception:
        return _fallback_plan(request_text), "rules-fallback"


def install_kjapp_operations_os(api, db, *, require_admin, require_superadmin, audit, default_features: dict):
    async def state():
        raw = await db.platform_settings.find_one({"_id": "singleton"}) or {}
        runtime = _merge_runtime(raw.get("runtime_config"))
        features = {**default_features, **(raw.get("features") or {})}
        features["demo_trips"] = False
        return {
            "runtime_config": runtime,
            "features": features,
            "version": int(raw.get("runtime_config_version") or 1),
            "updated_at": raw.get("runtime_config_updated_at"),
        }

    async def write_version(current_user, runtime_config, features, reason, source):
        previous = await state()
        current_version = int(previous["version"])

        # Establish an explicit v1 baseline before the first publish. This makes the
        # original configuration rollbackable and normalizes legacy documents that
        # pre-date Operations OS.
        if current_version == 1:
            await _ensure_baseline_version(db.platform_settings)
            previous = await state()
            current_version = int(previous["version"])

        baseline = {
            "version": current_version,
            "runtime_config": previous["runtime_config"],
            "features": previous["features"],
            "reason": "Baseline før Operations OS-endring",
            "source": "baseline",
            "saved_at": previous.get("updated_at") or _now(),
            "saved_by": "system",
        }
        await db.operations_config_versions.update_one(
            {"version": current_version}, {"$setOnInsert": baseline}, upsert=True,
        )

        version = current_version + 1
        now = _now()
        operation_id = str(uuid.uuid4())
        snapshot = {
            "version": version, "runtime_config": runtime_config, "features": features,
            "reason": reason, "source": source, "saved_at": now,
            "saved_by": current_user.get("email"), "operation_id": operation_id,
        }

        # Reserve the history version first. The unique index makes concurrent
        # publishers fail closed instead of silently sharing the same version.
        try:
            await db.operations_config_versions.insert_one(dict(snapshot))
        except DuplicateKeyError:
            raise HTTPException(409, "Konfigurasjonen ble endret samtidig. Oppdater siden og prøv igjen.")

        # Compare-and-swap the live document. Exactly one writer may advance a
        # specific runtime_config_version.
        result = await db.platform_settings.update_one(
            {"_id": "singleton", "runtime_config_version": current_version},
            {"$set": {
                "runtime_config": runtime_config,
                "runtime_config_version": version,
                "runtime_config_updated_at": now,
                "features": features,
            }},
        )
        if result.matched_count != 1:
            await db.operations_config_versions.delete_one(
                {"version": version, "operation_id": operation_id}
            )
            raise HTTPException(409, "Konfigurasjonen ble endret samtidig. Oppdater siden og prøv igjen.")

        await audit(
            current_user, "operations.config.publish", "operations_config", str(version),
            {"version": current_version}, {"version": version, "source": source}, reason,
        )
        return snapshot

    @api.get("/config/runtime")
    async def public_runtime_config(app: Literal["customer", "driver"] = "customer"):
        current = await state()
        return {
            "version": current["version"], "app": app,
            "shared": current["runtime_config"]["shared"],
            "config": current["runtime_config"][app],
            "features": current["features"],
            "updated_at": current["updated_at"],
        }

    @api.get("/admin/operations/runtime-config")
    async def admin_runtime_config(current=Depends(require_admin)):
        return await state()

    @api.patch("/admin/operations/runtime-config")
    async def admin_patch_runtime_config(body: RuntimePatchRequest, current=Depends(require_superadmin)):
        current_state = await state()
        runtime_patch = validate_runtime_patch(body.runtime_patch)
        feature_patch = validate_ops_feature_patch(body.feature_patch, default_features)
        runtime = _merge_runtime(current_state["runtime_config"], runtime_patch)
        features = {**current_state["features"], **feature_patch}
        features["demo_trips"] = False
        saved = await write_version(current, runtime, features, body.reason, "admin")
        return {"ok": True, **saved}

    @api.get("/admin/operations/runtime-config/history")
    async def admin_runtime_history(limit: int = 30, current=Depends(require_admin)):
        limit = max(1, min(int(limit or 30), 100))
        rows = []
        async for row in db.operations_config_versions.find({}).sort("version", -1).limit(limit):
            rows.append(_clean_doc(row))
        return {"versions": rows}

    @api.post("/admin/operations/runtime-config/rollback")
    async def admin_runtime_rollback(body: RuntimeRollbackRequest, current=Depends(require_superadmin)):
        snapshot = await db.operations_config_versions.find_one({"version": body.version})
        if not snapshot:
            raise HTTPException(404, "Fant ikke konfigurasjonsversjonen")
        runtime = _merge_runtime(snapshot.get("runtime_config"))
        features = {**default_features, **(snapshot.get("features") or {})}
        features = validate_feature_patch(features, default_features)
        features["demo_trips"] = False
        saved = await write_version(current, runtime, features, body.reason, f"rollback:{body.version}")
        return {"ok": True, "rolled_back_from": body.version, **saved}

    @api.get("/admin/operations/releases")
    async def admin_releases(limit: int = 50, current=Depends(require_admin)):
        limit = max(1, min(int(limit or 50), 200))
        rows = []
        async for row in db.release_registry.find({}).sort("created_at", -1).limit(limit):
            rows.append(_clean_doc(row))
        return {
            "releases": rows,
            "automation": {
                "remote_config": True, "ota": "not_configured",
                "native": "eas_build", "approval_required": True,
            },
        }

    @api.post("/admin/operations/releases")
    async def admin_create_release(body: ReleaseCreateRequest, current=Depends(require_superadmin)):
        release_id = str(uuid.uuid4())
        doc = {
            "id": release_id, **body.model_dump(), "status": "planned",
            "created_at": _now(), "created_by": current.get("email"),
        }
        await db.release_registry.insert_one(dict(doc))
        await audit(current, "release.plan", "release", release_id, None, doc, body.notes or None)
        return doc

    @api.post("/admin/operations/releases/{release_id}/transition")
    async def admin_transition_release(release_id: str, body: ReleaseTransitionRequest, current=Depends(require_superadmin)):
        existing = await db.release_registry.find_one({"id": release_id})
        if not existing:
            raise HTTPException(404, "Fant ikke releasen")
        allowed = {
            "planned": {"approved", "failed"}, "approved": {"publishing", "failed"},
            "publishing": {"published", "failed"}, "published": {"rolled_back"},
            "failed": {"planned"}, "rolled_back": set(),
        }
        old_status = existing.get("status", "planned")
        if body.status != old_status and body.status not in allowed.get(old_status, set()):
            raise HTTPException(409, f"Ugyldig release-overgang: {old_status} → {body.status}")
        now = _now()
        updates = {"status": body.status, "updated_at": now}
        if body.status == "approved":
            updates.update({"approved_at": now, "approved_by": current.get("email")})
        if body.status == "published":
            updates["published_at"] = now
        if body.note:
            updates["last_note"] = body.note
        await db.release_registry.update_one({"id": release_id}, {"$set": updates})
        await audit(current, "release.transition", "release", release_id, {"status": old_status}, {"status": body.status}, body.note or None)
        return {"ok": True, "id": release_id, **updates}

    @api.post("/admin/operations/ai/plan")
    async def admin_ai_plan(body: AIPlanRequest, current=Depends(require_admin)):
        plan, provider = await _ai_plan(body.request)
        change_type = str(plan.get("change_type") or "code").lower()
        if change_type not in {"config", "ota", "native", "backend", "code"}:
            change_type = "code"
        risk = str(plan.get("risk") or "medium").lower()
        if risk not in {"low", "medium", "high"}:
            risk = "medium"

        raw_notes = plan.get("notes")
        notes = [str(x)[:500] for x in raw_notes[:10]] if isinstance(raw_notes, list) else []

        # Non-config plans are advisory by definition. Ignore any model-supplied
        # patch before validation so a backend/code plan can always be recorded.
        runtime_patch, feature_patch = {}, {}
        if change_type == "config":
            try:
                runtime_patch = validate_runtime_patch(plan.get("runtime_patch") or {})
                feature_patch = validate_ai_feature_patch(plan.get("feature_patch") or {}, default_features)
            except HTTPException:
                change_type = "code"
                risk = "high"
                runtime_patch, feature_patch = {}, {}
                notes.append("AI foreslo en endring utenfor direkte allow-list; planen er derfor kun rådgivende.")

        plan_id = str(uuid.uuid4())
        doc = {
            "id": plan_id, "request": body.request,
            "summary": str(plan.get("summary") or "Endringsplan")[:1000],
            "change_type": change_type, "risk": risk,
            "runtime_patch": runtime_patch, "feature_patch": feature_patch,
            "requires_build": bool(plan.get("requires_build")),
            "requires_ota": bool(plan.get("requires_ota")),
            "notes": notes,
            "status": "proposed", "provider": provider,
            "created_at": _now(), "created_by": current.get("email"),
        }
        await db.ai_change_plans.insert_one(dict(doc))
        await audit(current, "ai.plan.create", "ai_change_plan", plan_id, None, {
            "change_type": change_type, "risk": risk, "provider": provider,
        }, body.request[:500])
        return doc

    @api.get("/admin/operations/ai/plans")
    async def admin_ai_plans(limit: int = 30, current=Depends(require_admin)):
        limit = max(1, min(int(limit or 30), 100))
        rows = []
        async for row in db.ai_change_plans.find({}).sort("created_at", -1).limit(limit):
            rows.append(_clean_doc(row))
        return {"plans": rows, "ai_configured": bool((os.getenv("OPENAI_API_KEY") or "").strip())}

    @api.post("/admin/operations/ai/plans/{plan_id}/approve")
    async def admin_ai_approve(plan_id: str, body: AIApproveRequest, current=Depends(require_superadmin)):
        plan = await db.ai_change_plans.find_one({"id": plan_id})
        if not plan:
            raise HTTPException(404, "Fant ikke planen")
        if plan.get("status") not in ("proposed", "approved"):
            raise HTTPException(409, "Planen kan ikke godkjennes i nåværende status")
        now = _now()
        await db.ai_change_plans.update_one({"id": plan_id}, {"$set": {
            "status": "approved", "approved_at": now,
            "approved_by": current.get("email"), "approval_note": body.note,
        }})
        await audit(current, "ai.plan.approve", "ai_change_plan", plan_id, {"status": plan.get("status")}, {"status": "approved"}, body.note or None)
        return {"ok": True, "id": plan_id, "status": "approved"}

    @api.post("/admin/operations/ai/plans/{plan_id}/apply")
    async def admin_ai_apply(plan_id: str, body: AIApplyRequest, current=Depends(require_superadmin)):
        plan = await db.ai_change_plans.find_one({"id": plan_id})
        if not plan:
            raise HTTPException(404, "Fant ikke planen")
        if plan.get("status") != "approved":
            raise HTTPException(409, "Planen må godkjennes først")
        if plan.get("change_type") != "config":
            raise HTTPException(409, "Kode/OTA/native/backend-endringer kan ikke kjøres direkte fra Admin")
        current_state = await state()
        runtime_patch = validate_runtime_patch(plan.get("runtime_patch") or {})
        feature_patch = validate_ai_feature_patch(plan.get("feature_patch") or {}, default_features)
        if not runtime_patch and not feature_patch:
            raise HTTPException(409, "Planen inneholder ingen publiserbar konfigurasjon")
        runtime = _merge_runtime(current_state["runtime_config"], runtime_patch)
        features = {**current_state["features"], **feature_patch}
        features["demo_trips"] = False
        saved = await write_version(current, runtime, features, f"AI-plan {plan_id}: {plan.get('summary', '')}"[:500], f"ai:{plan_id}")
        await db.ai_change_plans.update_one({"id": plan_id}, {"$set": {
            "status": "applied", "applied_at": _now(),
            "applied_by": current.get("email"), "applied_version": saved["version"],
        }})
        await audit(current, "ai.plan.apply", "ai_change_plan", plan_id, {"status": "approved"}, {"status": "applied", "version": saved["version"]})
        return {"ok": True, "id": plan_id, "status": "applied", "version": saved["version"]}
