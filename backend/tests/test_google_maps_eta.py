"""Road ETA direction, traffic duration, cache/batching and no fabricated fallback."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import httpx
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from google_maps_eta import GoogleMapsEta
from test_live_cars import fleet, snapshot, server, TestClient


def car(index=0):
    return {'id': str(index), 'lat': 59.91 + index * .001, 'lng': 10.75, 'distance_km': 1}

@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('GOOGLE_MAPS_SERVER_API_KEY', 'test-server-only-key')
    monkeypatch.setenv('GOOGLE_MAPS_MATRIX_PROVIDER', 'distance_matrix')
    http = SimpleNamespace(get=AsyncMock(), post=AsyncMock())
    transport = AsyncMock(); transport.__aenter__.return_value = http
    monkeypatch.setattr('google_maps_eta.httpx.AsyncClient', Mock(return_value=transport))
    return http


def response(data):
    return httpx.Response(200, json=data, request=httpx.Request('GET', 'https://maps.googleapis.com'))


def test_driver_is_origin_customer_is_destination_and_traffic_rounds_up(provider):
    provider.get.return_value = response({'status':'OK', 'rows':[{'elements':[{'status':'OK', 'duration':{'value':5}, 'duration_in_traffic':{'value':121}}]}]})
    async def run():
        eta = GoogleMapsEta(); rows = [car()]
        eta.enrich(rows, (59.92, 10.76))
        assert rows[0]['eta_min'] is None # immediately returns live GPS while Google works
        await asyncio.gather(*eta.tasks)
        eta.enrich(rows, (59.92, 10.76))
        assert rows[0]['eta_min'] == 3 and rows[0]['eta_source'] == 'google_distance_matrix'
        params = provider.get.call_args.kwargs['params']
        assert params['origins'] == '59.91,10.75' and params['destinations'] == '59.92,10.76'
        assert params['departure_time'] == 'now' and params['mode'] == 'driving'
        assert provider.get.await_count == 1
    asyncio.run(run())


def test_missing_key_qa_does_not_inherit_production_key(provider, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'qa'); monkeypatch.delenv('QA_GOOGLE_MAPS_SERVER_API_KEY', raising=False)
    rows = [car()]; GoogleMapsEta().enrich(rows, (59.92,10.76))
    assert rows[0]['eta_min'] is None and rows[0]['eta_status'] == 'not_configured'
    provider.get.assert_not_awaited()

@pytest.mark.parametrize('data', [
    {'status':'REQUEST_DENIED'}, {'status':'OVER_QUERY_LIMIT'},
    {'status':'OK','rows':[{'elements':[{'status':'ZERO_RESULTS'}]}]},
    {'status':'OK','rows':[{'elements':[{'status':'OK','duration':{'value':-1}}]}]},
])
def test_failure_does_not_fall_back_to_air_distance(provider, data):
    provider.get.return_value = response(data)
    async def run():
        eta = GoogleMapsEta(); rows = [car()]
        eta.enrich(rows, (59.92,10.76)); await asyncio.gather(*eta.tasks)
        eta.enrich(rows, (59.92,10.76))
        assert rows[0]['eta_min'] is None and rows[0]['eta_status'] == 'unavailable'
        assert provider.get.await_count == 1
    asyncio.run(run())


def test_request_batches_at_most_25_origins_and_deduplicates_in_flight(provider):
    provider.get.return_value = response({'status':'OK','rows':[]})
    async def run():
        eta = GoogleMapsEta(); rows = [car(i) for i in range(30)]
        eta.enrich(rows, (59.92,10.76)); eta.enrich(rows, (59.92,10.76))
        assert len(eta.tasks) == 2
        await asyncio.gather(*eta.tasks)
        assert provider.get.await_count == 2
        assert all(len(call.kwargs['params']['origins'].split('|')) <= 25 for call in provider.get.call_args_list)
    asyncio.run(run())


def test_routes_matrix_is_explicit_and_reads_origin_indices(provider, monkeypatch):
    monkeypatch.setenv('GOOGLE_MAPS_MATRIX_PROVIDER', 'routes')
    provider.post.return_value = response([{'originIndex':1,'destinationIndex':0,'condition':'ROUTE_EXISTS','duration':'61s'},{'originIndex':0,'condition':'ROUTE_EXISTS','duration':'179s'}])
    async def run():
        eta = GoogleMapsEta(); rows = [car(), car(1)]
        eta.enrich(rows, (59.92,10.76)); await asyncio.gather(*eta.tasks); eta.enrich(rows, (59.92,10.76))
        assert [row['eta_min'] for row in rows] == [3,2]
        assert rows[0]['eta_source'] == 'google_routes_matrix'
        provider.get.assert_not_awaited()
    asyncio.run(run())

@pytest.mark.parametrize('changes', [
    {'absent':True}, {'on_break':True}, {'away':True}, {'available':False},
    {'availability_status':'busy'}, {'availability_status':'absent'},
])
def test_absent_and_unavailable_drivers_hidden_even_if_online(fleet, changes):
    _, driver, token = fleet
    eligible = driver(); driver(**changes)
    with TestClient(server.app) as client:
        result = snapshot(client, token)
    assert [row['id'] for row in result.json()['cars']] == [str(eligible['_id'])]
