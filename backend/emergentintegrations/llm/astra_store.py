"""Astra DB persistence for SNAR Assist chat history."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

_ASTRA_READY: set[tuple[str, str, str]] = set()


def astra_settings(required: bool = False) -> Optional[dict[str, str]]:
    endpoint = (os.environ.get("ASTRA_DB_API_ENDPOINT") or "").strip().rstrip("/")
    token = (os.environ.get("ASTRA_DB_APPLICATION_TOKEN") or "").strip()
    keyspace = (os.environ.get("ASTRA_DB_KEYSPACE") or "default_keyspace").strip()
    collection = (os.environ.get("ASTRA_DB_CHAT_COLLECTION") or "snar_ai_chat").strip()
    if endpoint and token and keyspace and collection:
        return {"endpoint": endpoint, "token": token, "keyspace": keyspace, "collection": collection}
    if required:
        raise RuntimeError(
            "Astra DB er ikke konfigurert: ASTRA_DB_API_ENDPOINT og "
            "ASTRA_DB_APPLICATION_TOKEN må settes før SNAR AI-chat aktiveres."
        )
    return None


def _collection_url(settings: dict[str, str]) -> str:
    return f"{settings['endpoint']}/api/json/v1/{settings['keyspace']}/{settings['collection']}"


def _keyspace_url(settings: dict[str, str]) -> str:
    return f"{settings['endpoint']}/api/json/v1/{settings['keyspace']}"


def _error_text(data: dict[str, Any]) -> str:
    return json.dumps(data.get("errors") or [], ensure_ascii=False, default=str)[:1000]


async def _post(url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.post(
            url,
            headers={"Token": token, "Content-Type": "application/json"},
            json=payload,
        )
    response.raise_for_status()
    data = response.json()
    if data.get("errors"):
        raise RuntimeError("Astra Data API error: " + _error_text(data))
    return data


async def ensure_collection(settings: dict[str, str]) -> None:
    """Create the fixed chat collection once, accepting an already-existing result."""
    key = (settings["endpoint"], settings["keyspace"], settings["collection"])
    if key in _ASTRA_READY:
        return
    payload = {
        "createCollection": {
            "name": settings["collection"],
            "options": {"defaultId": {"type": "uuidv7"}},
        }
    }
    try:
        await _post(_keyspace_url(settings), settings["token"], payload)
    except RuntimeError as exc:
        message = str(exc).lower()
        if "already" not in message and "exist" not in message:
            raise
    _ASTRA_READY.add(key)


async def insert_turn(
    settings: dict[str, str], *, user_id: str, session_key: str,
    environment: str, role: str, content: str, model: str | None = None,
) -> None:
    await ensure_collection(settings)
    document = {
        "user_id": user_id,
        "session_key": session_key,
        "environment": environment,
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if model:
        document["model"] = model
    await _post(
        _collection_url(settings), settings["token"],
        {"insertOne": {"document": document}},
    )


async def history(
    settings: dict[str, str], *, user_id: str, session_key: str, limit: int = 20,
) -> list[dict[str, str]]:
    await ensure_collection(settings)
    data = await _post(
        _collection_url(settings), settings["token"],
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
    out: list[dict[str, str]] = []
    for doc in documents:
        role = doc.get("role")
        content = doc.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            out.append({"role": role, "content": content.strip()})
    return out[-limit:]


__all__ = ["astra_settings", "ensure_collection", "insert_turn", "history"]
