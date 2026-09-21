"""Superadmin-only KJAPP AI assistant.

The assistant is deliberately isolated from the customer-facing /ai/* endpoints.
It stores an audit record for every request, keeps conversation history scoped to
the authenticated superadmin, and proxies provider calls server-side.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field


KJAPP_AI_CONTEXT = """Du er CodeX, fast backend-ingeniør for KJAPP – en norsk rideshare-app. Du kjenner hele systemet ditt.

Teknologistack:
- Customer / Driver app: Expo SDK 57, React Native 0.86, Expo Router, TypeScript
- Backend: FastAPI + MongoDB
- Adminpanel: React + TypeScript
- Betaling: Stripe Connect
- Kart: MapTiler, OSRM
- Push: Firebase FCM
- Sanntid: polling, jobber med WebSocket

KJENTE FEIL OG PRIORITERINGER SIDEN 2025:
- Startup-crash i Customer er fikset i build 66d85b84, Driver trenger samme herding
- Trip state machine mangler atomiske overganger
- Driver godkjennelse sjekker ikke dokumenter
- JWT ligger i AsyncStorage, skal flyttes til SecureStore
- FCM konfigurasjon mangler på Android
- Ventetidspris er konfigurert men ikke brukt
- Vipps er stub, ikke ferdig
- Admin kart viser bare online biler

Din jobb:
1. Forstå hva admin vil ha med én gang
2. Gi konkret, ferdig kode som kan limes inn direkte
3. Ikke spør om ting du allerede vet om KJAPP
4. Skreddersy svarene til KJAPPs faktiske React Native-, FastAPI-, MongoDB- og adminstruktur
5. Hvis informasjon mangler, spør spesifikt etter den

Sikkerhetsregler:
- Behandle brukerens prosjektdata som konfidensielle.
- Ikke foreslå å eksponere API-nøkler, JWT-er eller persondata i frontend.
- Når kode foreslås, si hvilke filer og tester som skal endres.
- Svar på norsk med konkrete, korte forklaringer. Hvis du ikke vet, si det tydelig.
"""

PROVIDERS = ("byteplus", "openai", "anthropic")
MAX_MESSAGE_CHARS = 20_000
MAX_FILE_CHARS = 120_000
MAX_TOTAL_FILE_CHARS = 300_000
ALLOWED_FILE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".yml", ".yaml", ".toml", ".txt",
}
BLOCKED_PARTS = {".git", "node_modules", "dist", "build", ".env", ".venv", "__pycache__"}
BLOCKED_FILE_MARKERS = {"credential", "service-account", "secret", "private", "google-services", ".pem", ".key", ".crt"}


class AdminAIMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    provider: Optional[str] = None
    file_paths: list[str] = Field(default_factory=list, max_length=10)


class AdminAIConversationRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class AdminAIChangeRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=100)
    message_id: str = Field(min_length=1, max_length=100)
    request: str = Field(min_length=1, max_length=8_000)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_doc(doc: dict[str, Any]) -> dict[str, Any]:
    result = dict(doc)
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    return result


def _project_root() -> Path:
    configured = os.environ.get("KJAPP_PROJECT_ROOT", "").strip()
    return Path(configured).resolve() if configured else Path(__file__).resolve().parent.parent


def _safe_project_path(relative_path: str) -> Path:
    rel = Path(str(relative_path or "").strip())
    lowered_name = rel.name.lower()
    if not relative_path or rel.is_absolute() or any(part in BLOCKED_PARTS or part.startswith(".") for part in rel.parts) or any(marker in lowered_name for marker in BLOCKED_FILE_MARKERS):
        raise HTTPException(status_code=400, detail="Ugyldig eller blokkert prosjektfil")
    if rel.suffix.lower() not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Filtypen kan ikke legges ved")
    root = _project_root()
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Prosjektfilen ligger utenfor prosjektet")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Prosjektfilen finnes ikke")
    return candidate


def _read_project_files(file_paths: list[str]) -> tuple[str, list[str]]:
    chunks: list[str] = []
    accepted: list[str] = []
    total = 0
    for relative in file_paths:
        path = _safe_project_path(relative)
        if path.stat().st_size > MAX_FILE_CHARS:
            raise HTTPException(status_code=413, detail=f"Filen er for stor: {relative}")
        text = path.read_text(encoding="utf-8", errors="replace")
        total += len(text)
        if total > MAX_TOTAL_FILE_CHARS:
            raise HTTPException(status_code=413, detail="Vedlagt prosjektkode er for omfattende")
        accepted.append(relative)
        chunks.append(f"\n--- FIL: {relative} ---\n{text}\n--- SLUTT FIL: {relative} ---\n")
    return "".join(chunks), accepted


def _provider_from_env(requested: Optional[str]) -> str:
    provider = (requested or os.environ.get("KJAPP_AI_PROVIDER", "byteplus")).strip().lower()
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Ukjent AI-leverandør. Velg: {', '.join(PROVIDERS)}")
    return provider


def _provider_settings(provider: str) -> tuple[str, str, str]:
    if provider == "byteplus":
        key = os.environ.get("BYTEPLUS_API_KEY", "").strip()
        base = os.environ.get("BYTEPLUS_BASE_URL", "https://ark.ap-southeast.bytepluses.com/api/v3").strip().rstrip("/")
        model = os.environ.get("BYTEPLUS_MODEL", "").strip()
        if not key or not model:
            raise HTTPException(status_code=503, detail="BytePlus er ikke konfigurert. Sett BYTEPLUS_API_KEY og BYTEPLUS_MODEL.")
        return key, base, model
    if provider == "openai":
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        model = os.environ.get("OPENAI_MODEL", "gpt-4o").strip()
        if not key:
            raise HTTPException(status_code=503, detail="OpenAI er ikke konfigurert. Sett OPENAI_API_KEY.")
        return key, os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/"), model
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    model = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Anthropic er ikke konfigurert. Sett ANTHROPIC_API_KEY.")
    return key, "https://api.anthropic.com/v1", model


async def _call_provider(provider: str, messages: list[dict[str, str]]) -> str:
    key, base, model = _provider_settings(provider)
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if provider == "anthropic":
            system = messages[0]["content"] if messages and messages[0]["role"] == "system" else KJAPP_AI_CONTEXT
            response = await client.post(
                f"{base}/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": model, "max_tokens": 4_000, "system": system, "messages": [m for m in messages if m["role"] != "system"]},
            )
            response.raise_for_status()
            data = response.json()
            return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text").strip()
        response = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
            json={"model": model, "messages": messages, "temperature": 0.2},
        )
        response.raise_for_status()
        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        return str(content).strip()


async def ensure_admin_ai_indexes(db) -> None:
    await db.admin_ai_conversations.create_index([("owner_id", 1), ("updated_at", -1)])
    await db.admin_ai_messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.admin_ai_audit.create_index([("admin_id", 1), ("created_at", -1)])
    await db.admin_ai_change_requests.create_index([("conversation_id", 1), ("created_at", -1)])


def install_admin_ai_assistant(api: APIRouter, db, require_superadmin) -> None:
    async def owned_conversation(conversation_id: str, current: dict) -> dict:
        conversation = await db.admin_ai_conversations.find_one({"conversation_id": conversation_id, "owner_id": current["id"]})
        if not conversation:
            raise HTTPException(status_code=404, detail="Samtalen finnes ikke")
        return conversation

    @api.get("/admin/ai-assistant/bootstrap")
    async def ai_bootstrap(current=Depends(require_superadmin)):
        count = await db.admin_ai_conversations.count_documents({"owner_id": current["id"]})
        return {
            "provider": os.environ.get("KJAPP_AI_PROVIDER", "byteplus").strip().lower(),
            "providers": list(PROVIDERS),
            "production_version": os.environ.get("KJAPP_PRODUCTION_VERSION", os.environ.get("APP_VERSION", "ukjent")),
            "staging_version": os.environ.get("KJAPP_STAGING_VERSION", "ukjent"),
            "conversation_count": count,
            "context_version": "kjapp-admin-v1",
        }

    @api.get("/admin/ai-assistant/files")
    async def ai_project_files(current=Depends(require_superadmin)):
        root = _project_root()
        files: list[str] = []
        if root.is_dir():
            for path in root.rglob("*"):
                if len(files) >= 500 or not path.is_file() or path.suffix.lower() not in ALLOWED_FILE_EXTENSIONS:
                    continue
                relative = path.relative_to(root)
                if any(part in BLOCKED_PARTS or part.startswith(".") for part in relative.parts) or any(marker in path.name.lower() for marker in BLOCKED_FILE_MARKERS):
                    continue
                files.append(relative.as_posix())
        return {"files": sorted(files)}

    @api.get("/admin/ai-assistant/conversations")
    async def ai_conversations(current=Depends(require_superadmin)):
        items = []
        async for doc in db.admin_ai_conversations.find({"owner_id": current["id"]}).sort("updated_at", -1).limit(100):
            items.append(_public_doc(doc))
        return {"conversations": items}

    @api.post("/admin/ai-assistant/conversations")
    async def ai_create_conversation(body: AdminAIConversationRequest, current=Depends(require_superadmin)):
        now = _now()
        doc = {
            "conversation_id": uuid4().hex,
            "owner_id": current["id"],
            "title": (body.title or "Ny KJAPP-samtale").strip()[:120],
            "created_at": now,
            "updated_at": now,
        }
        await db.admin_ai_conversations.insert_one(doc)
        return _public_doc(doc)

    @api.get("/admin/ai-assistant/conversations/{conversation_id}")
    async def ai_get_conversation(conversation_id: str, current=Depends(require_superadmin)):
        conversation = await owned_conversation(conversation_id, current)
        messages = []
        async for message in db.admin_ai_messages.find({"conversation_id": conversation_id, "owner_id": current["id"]}).sort("created_at", 1).limit(300):
            messages.append(_public_doc(message))
        return {"conversation": _public_doc(conversation), "messages": messages}

    @api.post("/admin/ai-assistant/conversations/{conversation_id}/messages")
    async def ai_send_message(conversation_id: str, body: AdminAIMessageRequest, request: Request, current=Depends(require_superadmin)):
        await owned_conversation(conversation_id, current)
        provider = _provider_from_env(body.provider)
        file_context, accepted_files = _read_project_files(body.file_paths)
        user_content = body.message.strip()
        enriched = user_content + (f"\n\nVedlagt prosjektinnhold:{file_context}" if file_context else "")
        now = _now()
        audit = {
            "admin_id": current["id"], "admin_email": current.get("email"), "conversation_id": conversation_id,
            "provider": provider, "content": user_content, "file_paths": accepted_files,
            "created_at": now, "ip": request.client.host if request.client else None,
        }
        await db.admin_ai_audit.insert_one(audit)
        user_doc = {"message_id": uuid4().hex, "conversation_id": conversation_id, "owner_id": current["id"], "role": "user", "content": user_content, "file_paths": accepted_files, "provider": provider, "created_at": now}
        await db.admin_ai_messages.insert_one(user_doc)
        history = [{"role": "system", "content": KJAPP_AI_CONTEXT}]
        async for message in db.admin_ai_messages.find({"conversation_id": conversation_id, "owner_id": current["id"]}).sort("created_at", 1).limit(80):
            history.append({"role": message["role"], "content": message["content"] + (f"\n\nVedlagt prosjektinnhold:{file_context}" if message.get("message_id") == user_doc["message_id"] and file_context else "")})
        try:
            reply = await _call_provider(provider, history)
        except HTTPException:
            raise
        except httpx.HTTPStatusError as exc:
            detail = "AI-leverandøren avviste forespørselen"
            if exc.response.status_code in (401, 403):
                detail = "AI-leverandørens API-nøkkel eller tilgang er ugyldig"
            raise HTTPException(status_code=502, detail=detail)
        except Exception:
            raise HTTPException(status_code=502, detail="AI-tjenesten er midlertidig utilgjengelig")
        if not reply:
            raise HTTPException(status_code=502, detail="AI-tjenesten returnerte et tomt svar")
        assistant_doc = {"message_id": uuid4().hex, "conversation_id": conversation_id, "owner_id": current["id"], "role": "assistant", "content": reply, "provider": provider, "created_at": _now()}
        await db.admin_ai_messages.insert_one(assistant_doc)
        await db.admin_ai_conversations.update_one({"conversation_id": conversation_id, "owner_id": current["id"]}, {"$set": {"updated_at": assistant_doc["created_at"], "title": user_content[:80]}})
        return {"message": _public_doc(assistant_doc), "conversation_id": conversation_id, "provider": provider}

    @api.post("/admin/ai-assistant/change-requests")
    async def ai_change_request(body: AdminAIChangeRequest, request: Request, current=Depends(require_superadmin)):
        await owned_conversation(body.conversation_id, current)
        now = _now()
        doc = {"request_id": uuid4().hex, "conversation_id": body.conversation_id, "message_id": body.message_id, "admin_id": current["id"], "admin_email": current.get("email"), "request": body.request.strip(), "status": "open", "created_at": now, "ip": request.client.host if request.client else None}
        await db.admin_ai_change_requests.insert_one(doc)
        await db.admin_ai_audit.insert_one({"admin_id": current["id"], "admin_email": current.get("email"), "conversation_id": body.conversation_id, "event": "change_request", "content": body.request.strip(), "created_at": now, "ip": request.client.host if request.client else None})
        return _public_doc(doc)
