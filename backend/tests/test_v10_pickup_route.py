"""Run with unittest or pytest; exercises the actual ETA helper without production IO."""
import ast
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock


class PickupRouteExposureTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self, trip, route):
        source = Path(__file__).resolve().parents[1].joinpath('server.py').read_text()
        function = next(node for node in ast.parse(source).body if isinstance(node, ast.AsyncFunctionDef) and node.name == '_refresh_driver_pickup_eta')
        collection = SimpleNamespace(find_one=AsyncMock(return_value=trip), update_one=AsyncMock(return_value=SimpleNamespace(modified_count=0)))
        routing = AsyncMock(return_value=route)
        context = {'db': SimpleNamespace(trips=collection), 'datetime': datetime, 'timezone': timezone, 'DRIVER_ETA_REFRESH_SECONDS': 10,
                   '_real_trip_filter': lambda query: query, 'osrm_route': routing, 'haversine_km': lambda *args: 1.5,
                   'send_push_to_user': AsyncMock()}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'actual-server-eta-helper', 'exec'), context)
        return context['_refresh_driver_pickup_eta'], collection, routing

    async def test_exposes_actual_road_geometry_from_driver_to_pickup(self):
        geometry = {'type': 'LineString', 'coordinates': [[10.73, 59.90], [10.74, 59.91]]}
        update, collection, routing = self.fixture({'pickup_lat': 59.91, 'pickup_lng': 10.74}, {'duration_min': 4, 'distance_km': 1.2, 'geometry': geometry})
        await update('ride', 'assigned-driver', 59.90, 10.73)
        routing.assert_awaited_once_with(59.90, 10.73, 59.91, 10.74)
        scope, payload = collection.update_one.call_args.args
        self.assertEqual(scope, {'trip_id': 'ride', 'driver_id': 'assigned-driver', 'status': 'driver_on_way'})
        self.assertEqual(payload['$set']['driver_pickup_geometry'], geometry)

    async def test_unavailable_road_route_clears_geometry_instead_of_fabricating_line(self):
        update, collection, _ = self.fixture({'pickup_lat': 59.91, 'pickup_lng': 10.74}, None)
        await update('ride', 'assigned-driver', 59.90, 10.73)
        self.assertIsNone(collection.update_one.call_args.args[1]['$set']['driver_pickup_geometry'])

    async def test_ended_or_other_driver_trip_does_not_route_or_write(self):
        update, collection, routing = self.fixture(None, None)
        await update('ride', 'wrong-driver', 59.90, 10.73)
        routing.assert_not_awaited()
        collection.update_one.assert_not_awaited()

    async def test_existing_eta_throttle_is_preserved(self):
        update, collection, routing = self.fixture({'pickup_lat': 59.91, 'pickup_lng': 10.74, 'eta_updated_at': (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}, None)
        await update('ride', 'assigned-driver', 59.90, 10.73)
        routing.assert_not_awaited()
        collection.update_one.assert_not_awaited()


class PickupPreferenceTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self, matches=1):
        source = Path(__file__).resolve().parents[1].joinpath('server.py').read_text()
        function = next(node for node in ast.parse(source).body if isinstance(node, ast.AsyncFunctionDef) and node.name == 'update_trip_pickup_preference')
        function.decorator_list = []
        collection = SimpleNamespace(update_one=AsyncMock(return_value=SimpleNamespace(matched_count=matches)))
        class Rejected(Exception):
            def __init__(self, status_code, detail):
                self.status_code = status_code
                super().__init__(detail)
        context = {'db': SimpleNamespace(trips=collection), 'datetime': datetime, 'timezone': timezone,
                   '_real_trip_filter': lambda query: query, 'TripPickupPreferenceUpdate': SimpleNamespace,
                   'Depends': lambda dependency: None, 'require_customer': None, 'HTTPException': Rejected}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'actual-server-pickup-preference', 'exec'), context)
        return context['update_trip_pickup_preference'], collection, Rejected

    async def test_inside_preference_is_owned_and_limited_to_pickup_states(self):
        update, collection, _ = self.fixture()
        response = await update('ride', SimpleNamespace(waiting_inside=True), {'id': 'owner'})
        scope, payload = collection.update_one.call_args.args
        self.assertEqual(scope['user_id'], 'owner')
        self.assertEqual(scope['trip_id'], 'ride')
        self.assertEqual(scope['status']['$in'], ['driver_on_way', 'at_pickup'])
        self.assertEqual(scope['driver_id']['$nin'], [None, ''])
        self.assertEqual(set(payload['$set']), {'pickup_waiting_inside', 'pickup_preference_updated_at'})
        self.assertTrue(payload['$set']['pickup_waiting_inside'])
        self.assertTrue(response['waiting_inside'])

    async def test_repeat_or_cleared_preference_remains_idempotent(self):
        update, collection, _ = self.fixture()
        response = await update('ride', SimpleNamespace(waiting_inside=False), {'id': 'owner'})
        self.assertFalse(response['waiting_inside'])
        self.assertFalse(collection.update_one.call_args.args[1]['$set']['pickup_waiting_inside'])

    async def test_changed_trip_or_other_owner_is_rejected(self):
        update, _, Rejected = self.fixture(matches=0)
        with self.assertRaises(Rejected) as error:
            await update('ride', SimpleNamespace(waiting_inside=True), {'id': 'wrong-owner'})
        self.assertEqual(error.exception.status_code, 409)


if __name__ == '__main__':
    unittest.main()
