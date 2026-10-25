import os
import sys
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import byteplus_deepwiki as mod


def test_build_deepwiki_payload_matches_modelark_mcp_shape():
    body = mod.DeepWikiRepositoryRequest(repository="expressjs/express")
    payload = mod.build_deepwiki_payload(body)

    assert payload["stream"] is True
    assert payload["tools"] == [
        {
            "type": "mcp",
            "server_label": "deepwiki",
            "server_url": mod.DEEPWIKI_MCP_URL,
            "require_approval": "never",
        }
    ]
    assert payload["input"][0]["role"] == "user"
    text = payload["input"][0]["content"][0]["text"]
    assert "expressjs/express" in text


def test_build_deepwiki_payload_rejects_non_owner_name_repository():
    with pytest.raises(Exception) as exc:
        mod.build_deepwiki_payload(
            mod.DeepWikiRepositoryRequest(repository="not a github repo")
        )
    assert getattr(exc.value, "status_code", None) == 400


def test_route_requires_server_side_api_key(monkeypatch):
    monkeypatch.delenv("BYTEPLUS_API_KEY", raising=False)

    api = APIRouter(prefix="/api")

    def superadmin():
        return {"id": "test-superadmin", "role": "superadmin"}

    mod.install_byteplus_deepwiki(api, require_superadmin=superadmin)
    app = FastAPI()
    app.include_router(api)

    client = TestClient(app)
    response = client.post(
        "/api/admin/dev/deepwiki/repo-structure",
        json={"repository": "expressjs/express"},
    )

    assert response.status_code == 503
    assert "BYTEPLUS_API_KEY" in response.json()["detail"]
