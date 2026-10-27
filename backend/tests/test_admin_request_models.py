"""Regression: locally scoped Admin request models must be actual JSON bodies."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.testclient import TestClient
from admin_control_center import install_admin_control_center
from test_phase2c_dispatch_identity_projection import server


def test_complete_api_schema_generates_and_admin_requests_are_json_bodies():
    server.app.openapi_schema = None
    schema = server.app.openapi()
    for path, methods in schema['paths'].items():
        if path.startswith('/api/admin/control/'):
            for operation in methods.values():
                assert not any(p.get('name') == 'body' and p.get('in') == 'query' for p in operation.get('parameters', []))
    operation = schema['paths']['/api/admin/control/fleets/{fleet_id}/driver-invites']['post']
    assert 'application/json' in operation['requestBody']['content']


def test_fleet_driver_invite_validates_body_and_keeps_admin_authorization():
    app, api = FastAPI(), APIRouter()
    allowed = False
    async def require_admin():
        if not allowed:
            raise HTTPException(401, 'Ikke innlogget')
        return {'id': 'fixture-admin'}
    fleets = SimpleNamespace(find_one=AsyncMock(return_value=None))
    install_admin_control_center(api, SimpleNamespace(fleets=fleets),
        require_admin=require_admin, require_superadmin=require_admin,
        stripe=SimpleNamespace(), send_push_to_user=AsyncMock(), send_email=lambda *_: False,
        hash_password=lambda _: 'fixture', audit=AsyncMock())
    app.include_router(api)
    client = TestClient(app)
    endpoint = '/admin/control/fleets/507f1f77bcf86cd799439011/driver-invites'
    assert client.post(endpoint, json={'email': 'fixture@example.test'}).status_code == 401
    fleets.find_one.assert_not_awaited()
    allowed = True
    # Missing/invalid fleet is reached after a JSON body is correctly parsed.
    assert client.post(endpoint, json={'email': 'fixture@example.test'}).status_code == 404
    response = client.post(endpoint, json={})
    assert response.status_code == 422
    assert response.json()['detail'][0]['loc'] == ['body', 'email']
