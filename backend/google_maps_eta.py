"""Google road ETA without blocking live availability snapshots.

Origins are drivers; the sole destination is the customer's current GPS. Live
positions never come from this cache. Only road durations are cached for 30s
and within ~100m coordinate cells. When Google is pending or unavailable, the
API returns a conservative distance-based ETA explicitly labelled approximate;
an exact Google duration always replaces it as soon as it is available.
"""
import asyncio
import math
import os
import time
from collections import OrderedDict
from datetime import datetime, timezone
import httpx


class GoogleMapsEta:
    TTL = 30
    MAX_CACHE = 4096
    MAX_BATCHES = 4

    def __init__(self):
        self.cache = OrderedDict()
        self.pending = set()
        self.tasks = set()
        self.backoff_until = 0

    def settings(self):
        qa = os.getenv('APP_ENV', '').strip().lower() == 'qa'
        prefix = 'QA_' if qa else ''
        key = os.getenv(prefix + 'GOOGLE_MAPS_SERVER_API_KEY', '').strip()
        # Explicit Routes support for projects where Google won't enable Legacy.
        provider = os.getenv(prefix + 'GOOGLE_MAPS_MATRIX_PROVIDER', 'distance_matrix').strip()
        return key, provider

    @staticmethod
    def cell(lat, lng):
        return round(lat, 3), round(lng, 3)

    @staticmethod
    def approximate(distance_km, provider_status='pending'):
        """Conservative Oslo pickup ETA used only until a road ETA is available.

        Straight-line distance is inflated 25% for urban road geometry and
        converted using 25 km/h. The source/status make this explicitly
        approximate so clients never present it as a Google road duration.
        """
        try:
            distance = float(distance_km)
        except (TypeError, ValueError):
            distance = float('nan')
        if not math.isfinite(distance) or distance < 0:
            return {'eta_min': None, 'eta_source': None, 'eta_status': provider_status}
        road_km = distance * 1.25
        minutes = max(2, math.ceil((road_km / 25.0) * 60))
        return {
            'eta_min': minutes,
            'eta_source': 'distance_fallback',
            'eta_status': 'approximate',
            'eta_provider_status': provider_status,
            'eta_updated_at': datetime.now(timezone.utc).isoformat(),
        }

    def enrich(self, cars, destination):
        key, provider = self.settings()
        now = time.monotonic()
        missing = []
        for car in cars:
            cache_key = (provider, self.cell(car['lat'], car['lng']), self.cell(*destination))
            entry = self.cache.get(cache_key)
            if entry and entry['expires'] > now and key:
                data = entry['data']
                car.update(data if data.get('eta_min') is not None else self.approximate(car.get('distance_km'), data.get('eta_status') or 'unavailable'))
                self.cache.move_to_end(cache_key)
            else:
                car.update(self.approximate(car.get('distance_km'), 'loading' if key else 'not_configured'))
                if key and now >= self.backoff_until and cache_key not in self.pending:
                    missing.append((cache_key, car['lat'], car['lng']))
        # Each request has <=25 origins and 1 destination, with traffic enabled.
        for offset in range(0, len(missing), 25):
            if len(self.tasks) >= self.MAX_BATCHES:
                break
            batch = missing[offset:offset + 25]
            # Deduplicate drivers occupying the same cell in this snapshot.
            batch = list({item[0]: item for item in batch}.values())
            self.pending.update(item[0] for item in batch)
            task = asyncio.create_task(self._load(batch, destination, key, provider))
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        return cars

    @staticmethod
    def result(seconds, source):
        if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds < 0:
            return {'eta_min': None, 'eta_source': None, 'eta_status': 'unavailable'}
        return {'eta_min': max(1, math.ceil(seconds / 60)), 'eta_source': source, 'eta_status': 'ok',
                'eta_updated_at': datetime.now(timezone.utc).isoformat()}

    async def _load(self, batch, destination, key, provider):
        unavailable = {'eta_min': None, 'eta_source': None, 'eta_status': 'unavailable'}
        values = [dict(unavailable) for _ in batch]
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                if provider == 'routes':
                    def point(lat, lng):
                        return {'waypoint': {'location': {'latLng': {'latitude': lat, 'longitude': lng}}}}
                    response = await client.post('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
                        headers={'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,duration'},
                        json={'origins': [point(lat, lng) for _, lat, lng in batch],
                              'destinations': [point(*destination)], 'travelMode': 'DRIVE', 'routingPreference': 'TRAFFIC_AWARE'})
                    response.raise_for_status()
                    for element in response.json():
                        index = element.get('originIndex', 0)
                        if (not isinstance(index, int) or not 0 <= index < len(batch)
                                or element.get('condition') != 'ROUTE_EXISTS' or element.get('status', {}).get('code', 0)):
                            continue
                        duration = element.get('duration', '')
                        if isinstance(duration, str) and duration.endswith('s'):
                            values[index] = self.result(float(duration[:-1]), 'google_routes_matrix')
                elif provider == 'distance_matrix':
                    response = await client.get('https://maps.googleapis.com/maps/api/distancematrix/json', params={
                        'origins': '|'.join(f'{lat},{lng}' for _, lat, lng in batch),
                        'destinations': f'{destination[0]},{destination[1]}', 'mode': 'driving',
                        'departure_time': 'now', 'traffic_model': 'best_guess', 'language': 'no', 'key': key})
                    response.raise_for_status()
                    data = response.json()
                    if data.get('status') != 'OK':
                        self.backoff_until = time.monotonic() + self.TTL
                    else:
                        for index, row in enumerate(data.get('rows', [])[:len(batch)]):
                            element = (row.get('elements') or [{}])[0]
                            if element.get('status') == 'OK':
                                duration = element.get('duration_in_traffic') or element.get('duration') or {}
                                values[index] = self.result(duration.get('value'), 'google_distance_matrix')
                else:
                    self.backoff_until = time.monotonic() + self.TTL
        except (httpx.HTTPError, ValueError, TypeError, KeyError, AttributeError):
            self.backoff_until = time.monotonic() + self.TTL
        finally:
            for (cache_key, _, _), value in zip(batch, values):
                self.cache[cache_key] = {'expires': time.monotonic() + self.TTL, 'data': value}
                self.cache.move_to_end(cache_key)
                self.pending.discard(cache_key)
            while len(self.cache) > self.MAX_CACHE:
                self.cache.popitem(last=False)

    async def close(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
