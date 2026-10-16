"""OpenAI speech-to-text compatibility wrapper used by backend/server.py."""
from __future__ import annotations

import os
from typing import Any

import httpx


class OpenAISpeechToText:
    def __init__(self, api_key: str):
        self.api_key = str(api_key or "").strip()

    async def transcribe(
        self,
        *,
        file,
        model: str = "whisper-1",
        response_format: str = "json",
        language: str | None = None,
        **_: Any,
    ):
        if not self.api_key:
            raise RuntimeError("OpenAI API-nøkkel mangler.")
        data = {
            "model": (
                os.environ.get("SNAR_OPENAI_TRANSCRIBE_MODEL")
                or ("gpt-transcribe" if model == "whisper-1" else model)
            ),
            "response_format": response_format,
        }
        if language:
            data["language"] = language

        position = file.tell() if hasattr(file, "tell") else None
        if hasattr(file, "seek"):
            file.seek(0)
        raw = file.read()
        if position is not None and hasattr(file, "seek"):
            file.seek(position)

        filename = getattr(file, "name", "audio.webm")
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                data=data,
                files={"file": (filename, raw, "application/octet-stream")},
            )
        response.raise_for_status()
        return response.json()


__all__ = ["OpenAISpeechToText"]
