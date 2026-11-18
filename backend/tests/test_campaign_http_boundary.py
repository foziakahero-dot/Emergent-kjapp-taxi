"""Campaign settlement is an internal operation, never an anonymous HTTP API."""
from unittest.mock import AsyncMock

import pytest
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

import beta_campaign


@pytest.mark.parametrize("operation", ["reserve", "complete", "cancel"])
@pytest.mark.parametrize("authorization", [None, "Bearer synthetic-customer", "Bearer synthetic-driver"])
def test_http_cannot_fabricate_campaign_settlement(monkeypatch, operation, authorization):
    reserve = AsyncMock(return_value=(True, 180, "synthetic-attempt"))
    complete = AsyncMock(return_value=(True, 180, 0))
    cancel = AsyncMock(return_value=True)
    monkeypatch.setattr(beta_campaign, "reserve_campaign_ride", reserve)
    monkeypatch.setattr(beta_campaign, "complete_campaign_ride", complete)
    monkeypatch.setattr(beta_campaign, "cancel_campaign_reservation", cancel)

    async def require_admin(request: Request):
        raise HTTPException(403 if request.headers.get("authorization") else 401)

    app, router = FastAPI(), APIRouter(prefix="/api")
    beta_campaign.install_beta_campaign(router, object(), require_admin, AsyncMock())
    app.include_router(router)
    client = TestClient(app)
    headers = {} if authorization is None else {"authorization": authorization}
    response = client.post(f"/api/internal/beta-campaign/{operation}", params={
        "customer_id": "synthetic-customer", "trip_id": "synthetic-trip",
        "estimated_price_kr": 180, "actual_price_kr": 180, "commission_rate": 0.12,
    }, headers=headers)
    assert response.status_code == 404
    for helper in (reserve, complete, cancel):
        helper.assert_not_awaited()
    # Existing administrative routes still enforce their own access boundary.
    assert client.get("/api/admin/beta-campaign/status", headers=headers).status_code in (401, 403)
