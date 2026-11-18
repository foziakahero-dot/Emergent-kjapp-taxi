"""Public travel information used by the customer booking screen."""
import asyncio
import math
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field


ENTUR_URL = "https://api.entur.io/journey-planner/v3/graphql"
WEATHER_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
AVINOR_URL = "https://asrv.avinor.no/XmlFeed/v1.0"
OSLO = ZoneInfo("Europe/Oslo")
CLIENT_NAME = "SNAR/1.0 https://snarapp.no"
TIMEOUT = httpx.Timeout(6, connect=3)
TRANSIT_MODES = {"bus", "tram", "metro", "rail", "water", "coach", "cableway", "funicular"}
ENTUR_TRIP = """
query SnarTransit($fromLat: Float!, $fromLng: Float!, $toLat: Float!, $toLng: Float!) {
  trip(from: {coordinates: {latitude: $fromLat, longitude: $fromLng}},
       to: {coordinates: {latitude: $toLat, longitude: $toLng}}, numTripPatterns: 5) {
    tripPatterns {
      startTime endTime duration
      legs {
        mode expectedStartTime
        line { publicCode }
        fromEstimatedCall { realtime quay { name } }
      }
    }
  }
}
"""


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class TransitRequest(BaseModel):
    pickup: Point
    dropoff: Point


def parsed_time(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else None
    except ValueError:
        return None


def transit_options(payload, now):
    if payload.get("errors"):
        raise ValueError("Entur rejected the trip query")
    patterns = ((payload.get("data") or {}).get("trip") or {}).get("tripPatterns") or []
    options = []
    for pattern in patterns:
        legs = [leg for leg in pattern.get("legs", []) if str(leg.get("mode")).lower() in TRANSIT_MODES]
        if not legs:
            continue
        first = legs[0]
        starts = parsed_time(first.get("expectedStartTime"))
        arrival = parsed_time(pattern.get("endTime"))
        if not starts or not arrival or starts < now or arrival <= starts:
            continue
        call = first.get("fromEstimatedCall") or {}
        options.append({
            "departure_at": starts.isoformat(),
            "arrival_at": arrival.isoformat(),
            "minutes_until_departure": max(0, math.ceil((starts - now).total_seconds() / 60)),
            "journey_minutes": max(1, math.ceil((arrival - now).total_seconds() / 60)),
            "transfers": len(legs) - 1,
            "mode": str(first["mode"]).lower(),
            "line": (first.get("line") or {}).get("publicCode"),
            "departure_stop": (call.get("quay") or {}).get("name"),
            "realtime": call.get("realtime") is True,
        })
    return sorted(options, key=lambda option: parsed_time(option["arrival_at"]))[:3]


def weather_hint(payload, now):
    for period in payload["properties"]["timeseries"]:
        stamp = parsed_time(period.get("time"))
        if stamp is None or not (now - timedelta(hours=1) <= stamp <= now + timedelta(hours=2)):
            continue
        data = period.get("data") or {}
        hour = data.get("next_1_hours") or {}
        symbol = (hour.get("summary") or {}).get("symbol_code")
        temperature = ((data.get("instant") or {}).get("details") or {}).get("air_temperature")
        if not isinstance(temperature, (int, float)) or isinstance(temperature, bool) or not math.isfinite(temperature):
            continue
        return {
            "valid_at": stamp.isoformat(),
            "degrees_c": round(temperature),
            "symbol": symbol if isinstance(symbol, str) else None,
        }
    return None


def expires_at(header, now):
    try:
        expires = parsedate_to_datetime(header)
        return max(expires, now + timedelta(minutes=1))
    except (ValueError, TypeError, OverflowError):
        return now + timedelta(minutes=30)


def parse_flights(xml):
    if len(xml) > 2_000_000 or any(marker in xml.upper() for marker in (b"<!DOCTYPE", b"<!ENTITY")):
        raise ValueError("Unexpected Avinor feed")
    root = ElementTree.fromstring(xml)
    flights = root.find("flights")
    if flights is None:
        raise ValueError("Avinor feed has no flights element")
    rows = []
    for flight in flights.findall("flight"):
        scheduled = parsed_time(flight.findtext("schedule_time"))
        if scheduled is None:
            continue
        status = flight.find("status")
        status_code = status.get("code") if status is not None else None
        status_time = parsed_time(status.get("time")) if status is not None else None
        rows.append({
            "number": (flight.findtext("flightId") or flight.findtext("flight_id") or "").strip().upper(),
            "scheduled_at": scheduled.isoformat(),
            "status_code": status_code,
            "estimated_at": status_time.isoformat() if status_time and status_code in {"A", "D", "E"} else None,
            "direction": flight.findtext("arr_dep"),
            "other_airport": flight.findtext("airport"),
        })
    return rows


class PublicTravel:
    def __init__(self, client_factory=httpx.AsyncClient):
        self.client_factory = client_factory
        self.weather_cache = OrderedDict()
        self.weather_lock = asyncio.Lock()
        self.flights = {}
        self.flight_lock = asyncio.Lock()

    async def transit(self, pickup, dropoff):
        variables = {
            "fromLat": round(pickup.lat, 4), "fromLng": round(pickup.lng, 4),
            "toLat": round(dropoff.lat, 4), "toLng": round(dropoff.lng, 4),
        }
        async with self.client_factory(timeout=httpx.Timeout(12, connect=4)) as client:
            response = await client.post(ENTUR_URL, headers={"ET-Client-Name": "snar-booking"},
                                         json={"query": ENTUR_TRIP, "variables": variables})
            response.raise_for_status()
        now = datetime.now(timezone.utc)
        return {"source": "Entur", "as_of": now.isoformat(), "options": transit_options(response.json(), now)}

    async def weather(self, lat, lng):
        # A neighbourhood-sized cell gives useful weather without sending precise GPS to MET.
        key = (round(lat, 2), round(lng, 2))
        async with self.weather_lock:
            now = datetime.now(timezone.utc)
            cached = self.weather_cache.get(key)
            if cached is not None and now < cached[0]:
                return weather_hint(cached[2], now)
            headers = {"User-Agent": CLIENT_NAME}
            if cached is not None and cached[1]:
                headers["If-Modified-Since"] = cached[1]
            async with self.client_factory(timeout=TIMEOUT) as client:
                response = await client.get(WEATHER_URL, headers=headers, params={"lat": key[0], "lon": key[1]})
                if response.status_code == 304 and cached is not None:
                    data = cached[2]
                else:
                    response.raise_for_status()
                    series = response.json()["properties"]["timeseries"]
                    data = {"properties": {"timeseries": series[:8]}}
            hint = weather_hint(data, now)
            self.weather_cache[key] = (expires_at(response.headers.get("expires"), now),
                                       response.headers.get("last-modified") or (cached[1] if cached and response.status_code == 304 else None), data)
            self.weather_cache.move_to_end(key)
            if len(self.weather_cache) > 128:
                self.weather_cache.popitem(last=False)
            return hint

    async def flight(self, number, direction, day):
        async with self.flight_lock:
            now = datetime.now(timezone.utc)
            cached = self.flights.get(direction)
            if cached is None or now >= cached[0]:
                async with self.client_factory(timeout=TIMEOUT) as client:
                    response = await client.get(AVINOR_URL, headers={"User-Agent": CLIENT_NAME},
                                                params={"airport": "OSL", "TimeFrom": 18, "TimeTo": 36, "direction": direction})
                    response.raise_for_status()
                cached = (now + timedelta(minutes=3), parse_flights(response.content))
                self.flights[direction] = cached
        matches = [flight for flight in cached[1] if flight["number"] == number and flight["direction"] == direction
                   and parsed_time(flight["scheduled_at"]).astimezone(OSLO).date().isoformat() == day]
        if not matches:
            return None
        return min(matches, key=lambda flight: abs((parsed_time(flight["scheduled_at"]) - now).total_seconds()))


def install_travel_context(api, require_customer, rate_limit):
    travel = PublicTravel()

    @api.post("/travel/transit")
    async def transit(body: TransitRequest, request: Request, _=Depends(require_customer)):
        await rate_limit(request, "travel-transit", 20, 60)
        try:
            return await travel.transit(body.pickup, body.dropoff)
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            raise HTTPException(503, "Kunne ikke hente kollektivruter fra Entur akkurat nå.") from exc

    @api.get("/travel/weather")
    async def weather(request: Request, lat: float = Query(ge=-90, le=90),
                      lng: float = Query(ge=-180, le=180), _=Depends(require_customer)):
        await rate_limit(request, "travel-weather", 30, 60)
        try:
            return {"source": "MET Norge", "weather": await travel.weather(lat, lng)}
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
            raise HTTPException(503, "Kunne ikke hente værvarsel akkurat nå.") from exc

    @api.get("/travel/flight")
    async def flight(request: Request, number: str = Query(pattern=r"^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$"),
                     direction: str = Query(pattern=r"^[AD]$"), day: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
                     _=Depends(require_customer)):
        await rate_limit(request, "travel-flight", 20, 60)
        today = datetime.now(OSLO).date()
        if day not in {today.isoformat(), (today + timedelta(days=1)).isoformat()}:
            raise HTTPException(422, "Velg i dag eller i morgen for flystatus.")
        try:
            result = await travel.flight(number, direction, day)
        except (httpx.HTTPError, ValueError, ElementTree.ParseError) as exc:
            raise HTTPException(503, "Kunne ikke hente flystatus fra Avinor akkurat nå.") from exc
        return {"source": "Avinor", "airport": "OSL", "flight": result}
