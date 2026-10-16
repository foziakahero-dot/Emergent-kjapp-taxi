"""Direct OpenAI Responses adapter for SNAR Assist.

Preserves the legacy ``LlmChat``/``UserMessage`` import surface while routing
SNAR customer AI directly to OpenAI and storing customer chat history in Astra DB.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from .astra_store import astra_settings as _astra_settings
from .astra_store import history as _astra_history
from .astra_store import insert_turn as _astra_insert_turn
from .context import live_context as _live_context
from .context import _PRICE_RE


@dataclass(frozen=True)
class UserMessage:
    text: str


_SESSION_RE = re.compile(
    r"^snar:(?P<environment>[a-z0-9_-]+):(?P<user_id>[0-9a-fA-F]{24}):(?P<digest>[0-9a-f]{64})$"
)


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
        context: dict[str, Any] = {}
        astra = None

        if parts:
            astra = _astra_settings(required=True)
            history = await _astra_history(
                astra, user_id=parts["user_id"], session_key=self.session_id, limit=20,
            )
            context = await _live_context(parts, text)
            await _astra_insert_turn(
                astra,
                user_id=parts["user_id"],
                session_key=self.session_id,
                environment=parts["environment"],
                role="user",
                content=text,
            )

        instructions = self.system_message
        if context:
            instructions += (
                "\n\nREELL SNAR-DATA FRA BACKEND (autoritative data; ikke dikt opp manglende verdier):\n"
                + json.dumps(context, ensure_ascii=False, default=str)
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
            await _astra_insert_turn(
                astra,
                user_id=parts["user_id"],
                session_key=self.session_id,
                environment=parts["environment"],
                role="assistant",
                content=reply,
                model=self.model,
            )
        return reply


__all__ = [
    "LlmChat", "UserMessage", "_model_name", "_session_parts",
    "_extract_output_text", "_astra_settings", "_PRICE_RE",
]
