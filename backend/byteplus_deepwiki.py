"""BytePlus ModelArk + DeepWiki MCP integration for isolated KJAPP testing.

This module intentionally keeps the BytePlus API key server-side and exposes the
integration only to authenticated KJAPP superadmins.
"""
from __future__ import annotations

import os
import re
from typing import Optional

import httpx
from fastapi import Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

BYTEPLUS_RESPONSES_URL = os.environ.get(
    "BYTEPLUS_RESPONSES_URL",
    "https://ark.ap-southeast.bytepluses.com/api/v3/responses",
).strip()
BYTEPLUS_MODEL = os.environ.get(
    "BYTEPLUS_MODEL",
    "dola-seed-2-1-turbo-260628",
).strip()
DEEPWIKI_MCP_URL = os.environ.get(
    "DEEPWIKI_MCP_URL",
    "https://mcp.deepwiki.com/mcp",
).strip()

_REPOSITORY_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class DeepWikiRepositoryRequest(BaseModel):
    repository: str = Field(
        default="expressjs/express",
        min_length=3,
        max_length=200,
        description="GitHub repository in owner/name form.",
    )
    instruction: Optional[str] = Field(
        default=None,
        max_length=4000,
        description="Optional instruction appended to the repository analysis request.",
    )


def build_deepwiki_payload(body: DeepWikiRepositoryRequest) -> dict:
    repository = body.repository.strip()
    if not _REPOSITORY_RE.fullmatch(repository):
        raise HTTPException(
            status_code=400,
            detail="repository må være i formatet owner/name",
        )

    instruction = (body.instruction or "").strip()
    if not instruction:
        instruction = (
            "Inspect the repository structure, identify the important directories, "
            "entry points, backend/frontend boundaries, tests, deployment files and "
            "the main application flow. Return a concise engineering-oriented summary."
        )

    return {
        "model": BYTEPLUS_MODEL,
        "stream": True,
        "tools": [
            {
                "type": "mcp",
                "server_label": "deepwiki",
                "server_url": DEEPWIKI_MCP_URL,
                "require_approval": "never",
            }
        ],
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"{instruction}\n\nRepository: {repository}",
                    }
                ],
            }
        ],
    }


async def _close_stream(response: httpx.Response, client: httpx.AsyncClient) -> None:
    try:
        await response.aclose()
    finally:
        await client.aclose()


async def _proxy_stream(response: httpx.Response, client: httpx.AsyncClient):
    try:
        async for chunk in response.aiter_raw():
            if chunk:
                yield chunk
    finally:
        await _close_stream(response, client)


def install_byteplus_deepwiki(api, *, require_superadmin) -> None:
    @api.post(
        "/admin/dev/deepwiki/repo-structure",
        summary="Analyze a GitHub repository through BytePlus + DeepWiki MCP",
        response_class=StreamingResponse,
    )
    async def deepwiki_repo_structure(
        body: DeepWikiRepositoryRequest,
        current=Depends(require_superadmin),
    ):
        # Read the secret at request time so secret rotation does not require a code change.
        api_key = (os.environ.get("BYTEPLUS_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="BYTEPLUS_API_KEY er ikke konfigurert i backend-miljøet",
            )

        payload = build_deepwiki_payload(body)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "ark-beta-mcp": "true",
            "Accept": "text/event-stream",
        }

        client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=15.0, read=None, write=30.0, pool=15.0)
        )
        try:
            request = client.build_request(
                "POST",
                BYTEPLUS_RESPONSES_URL,
                headers=headers,
                json=payload,
            )
            response = await client.send(request, stream=True)
        except httpx.HTTPError as exc:
            await client.aclose()
            raise HTTPException(
                status_code=502,
                detail=f"Kunne ikke kontakte BytePlus ModelArk: {exc.__class__.__name__}",
            ) from exc

        if response.status_code >= 400:
            raw = await response.aread()
            await _close_stream(response, client)
            upstream_detail = raw.decode("utf-8", errors="replace")[:1200]
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "BytePlus ModelArk avviste forespørselen",
                    "upstream_status": response.status_code,
                    "upstream_detail": upstream_detail,
                },
            )

        return StreamingResponse(
            _proxy_stream(response, client),
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "text/event-stream"),
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )
