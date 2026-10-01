"""Exercise the real settings model/handlers without starting MongoDB or other services."""
import ast
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Literal, Optional

import pytest
from fastapi import APIRouter, Depends, FastAPI, Header
from fastapi.testclient import TestClient
from pydantic import BaseModel


class SettingsCollection:
    def __init__(self):
        self.docs = {}

    async def find_one(self, query):
        return deepcopy(self.docs.get(query["user_id"]))

    async def insert_one(self, doc):
        self.docs[doc["user_id"]] = deepcopy(doc)

    async def update_one(self, query, update, upsert=False):
        doc = self.docs.setdefault(query["user_id"], dict(query))
        doc.update(deepcopy(update["$set"]))


@pytest.fixture
def client():
    async def current_user(x_test_user: str = Header(default="driver-a")):
        return {"id": x_test_user}

    tree = ast.parse((Path(__file__).parents[1] / "server.py").read_text())
    names = {"SettingsUpdate", "get_settings", "update_settings"}
    nodes = [node for node in tree.body if getattr(node, "name", None) in names]
    assert len(nodes) == 3
    router = APIRouter()
    namespace = {
        "BaseModel": BaseModel, "Optional": Optional, "Literal": Literal,
        "Depends": Depends, "api": router, "get_current_user": current_user,
        "db": SimpleNamespace(settings=SettingsCollection()),
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "settings_handlers", "exec"), namespace)
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.mark.parametrize("choice", ["google", "waze", "apple"])
def test_navigation_choice_survives_server_reload(client, choice):
    assert client.patch("/settings", json={"navigation_app": choice}).json()["navigation_app"] == choice
    assert client.get("/settings").json()["navigation_app"] == choice


def test_navigation_choice_is_isolated_per_authenticated_user(client):
    client.patch("/settings", json={"navigation_app": "waze"})
    other = {"x-test-user": "driver-b"}
    assert client.get("/settings", headers=other).json()["navigation_app"] == "google"
    client.patch("/settings", headers=other, json={"navigation_app": "apple"})
    assert client.get("/settings").json()["navigation_app"] == "waze"


@pytest.mark.parametrize("choice", ["arbitrary://", "", 123, {"app": "waze"}])
def test_invalid_choice_is_rejected_without_overwriting_saved_choice(client, choice):
    client.patch("/settings", json={"navigation_app": "waze"})
    assert client.patch("/settings", json={"navigation_app": choice}).status_code == 422
    assert client.get("/settings").json()["navigation_app"] == "waze"


def test_navigation_patch_preserves_existing_settings(client):
    client.patch("/settings", json={"language": "English", "notifications": False})
    client.patch("/settings", json={"navigation_app": "waze"})
    saved = client.get("/settings").json()
    assert saved["language"] == "English"
    assert saved["notifications"] is False
