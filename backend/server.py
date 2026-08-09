from dotenv import load_dotenv
load_dotenv()

import os
import asyncio
import random
import secrets
import json
import base64
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, Depends, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import uuid

try:
    from pywebpush import webpush, WebPushException
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    PUSH_AVAILABLE = True
except Exception:
    PUSH_AVAILABLE = False

# ------------------ Config ------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ------------------ Utils ------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Ikke innlogget")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Bruker ikke funnet")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        # ensure default role
        user.setdefault("role", "user")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token utløpt")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ugyldig token")


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


# ------------------ Models ------------------
class RegisterRequest(BaseModel):
    fullName: str
    email: str
    phone: Optional[str] = None
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class TripRequest(BaseModel):
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    vehicle_type: Literal["ai-first", "enkelt", "trygg", "premium"] = "ai-first"


class RateTripRequest(BaseModel):
    rating: int
    feedback: Optional[str] = ""


class PaymentMethodRequest(BaseModel):
    type: Literal["vipps", "visa", "mastercard"]
    label: str
    last4: str
    is_default: bool = False


class NearbyCarsRequest(BaseModel):
    lat: float
    lng: float


class EstimateRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float


class SettingsUpdate(BaseModel):
    ai_voice: Optional[str] = None
    notifications: Optional[bool] = None
    trip_updates: Optional[bool] = None
    auto_booking: Optional[bool] = None
    price_alerts: Optional[bool] = None
    language: Optional[str] = None
    theme: Optional[str] = None


# ------------------ Trip simulator ------------------


def haversine_km(lat1, lng1, lat2, lng2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    la1, lo1, la2, lo2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


async def osrm_route(plat, plng, dlat, dlng):
    """Real driving distance + duration + polyline via public OSRM API. Returns None on failure."""
    url = f"https://router.project-osrm.org/route/v1/driving/{plng},{plat};{dlng},{dlat}"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, params={"overview": "full", "geometries": "geojson"})
            data = r.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                return None
            route = data["routes"][0]
            return {
                "distance_km": round(route["distance"] / 1000.0, 2),
                "duration_min": max(1, int(round(route["duration"] / 60.0))),
                "geometry": route["geometry"],
            }
    except Exception:
        return None


def send_email(to_email: str, subject: str, html: str) -> bool:
    """Send email via SendGrid if configured, else log to console."""
    api_key = os.environ.get("SENDGRID_API_KEY", "").strip()
    sender = os.environ.get("SENDER_EMAIL", "noreply@kjapp.no").strip()
    if not api_key:
        print(f"[EMAIL/no-key] to={to_email} subj={subject}\n{html[:200]}")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        msg = Mail(from_email=sender, to_emails=to_email, subject=subject, html_content=html)
        sg = SendGridAPIClient(api_key)
        res = sg.send(msg)
        return 200 <= res.status_code < 300
    except Exception as e:
        print(f"[EMAIL/error] {e}")
        return False


def email_driver_invite_html(car: str, plate: str, invite_url: str, note: str = "") -> str:
    note_html = f"<p style='color:#a1a7ab;font-size:13px'>Notat fra flåte-eier: {note}</p>" if note else ""
    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#050708;color:#e6ecef;padding:32px;border-radius:16px;max-width:520px;margin:auto;">
      <div style="font-weight:700;font-size:26px;letter-spacing:0.5px;">KJ<span style="color:#2fe08c">A</span>PP</div>
      <div style="font-size:11px;letter-spacing:4px;color:#2fe08c;text-transform:uppercase;margin-top:4px">Sjåfør-invitasjon</div>
      <h1 style="font-size:22px;color:#fff;margin-top:24px;line-height:1.3">Velkommen til KJAPP-flåten</h1>
      <p style="color:#a1a7ab;font-size:14px;line-height:1.6">
        Du har blitt invitert til å kjøre for KJAPP. Bilen som er tildelt deg:
      </p>
      <div style="background:#0e1113;border:1px solid #1c2124;border-radius:12px;padding:16px;margin:16px 0;">
        <div style="color:#2fe08c;font-size:11px;letter-spacing:2px;text-transform:uppercase">Bil</div>
        <div style="color:#fff;font-size:16px;margin-top:4px">{car} · {plate}</div>
      </div>
      {note_html}
      <p style="color:#a1a7ab;font-size:14px;line-height:1.6">Klikk lenken under for å fullføre registreringen. Kontoen din må godkjennes før du kan motta turer.</p>
      <a href="{invite_url}" style="display:inline-block;background:#2fe08c;color:#04120a;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600;margin-top:12px">Fullfør registrering</a>
      <p style="color:#5a6166;font-size:11px;margin-top:32px;line-height:1.5">
        Hvis du ikke forventet denne invitasjonen kan du trygt ignorere e-posten. Lenken utløper om 14 dager.
      </p>
    </div>
    """


def price_for(distance_km: float, vehicle_type: str, duration_min: float = None) -> int:
    """Norwegian taxi rates (based on Oslo Taxi 2024/2025 tariffs):
    startpris + km-pris + minutt-pris (tidstillegg)."""
    if duration_min is None:
        duration_min = max(3, distance_km * 2.2)
    rates = {
        "ai-first": {"start": 70, "km": 16.0, "min": 4.0},   # Standard
        "enkelt":   {"start": 55, "km": 14.0, "min": 3.5},   # Beste pris
        "trygg":    {"start": 90, "km": 22.0, "min": 5.0},   # Familie / XL / 7 seter
        "premium":  {"start": 120, "km": 28.0, "min": 6.0},  # Business
    }
    r = rates.get(vehicle_type, rates["ai-first"])
    return int(round(r["start"] + distance_km * r["km"] + duration_min * r["min"]))


async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/app"):
    """Send push notifications to all subscriptions of a user."""
    if not PUSH_AVAILABLE:
        return
    vapid = await db.vapid.find_one({"_id": "keys"})
    if not vapid:
        return
    subs = []
    async for s in db.push_subscriptions.find({"user_id": user_id}):
        subs.append(s)
    for s in subs:
        try:
            webpush(
                subscription_info=s["subscription"],
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=vapid["private_pem"],
                vapid_claims={"sub": "mailto:noreply@kjapp.no"},
            )
        except WebPushException as e:
            # if subscription is gone (410) remove it
            if getattr(e.response, "status_code", None) in (404, 410):
                await db.push_subscriptions.delete_one({"_id": s["_id"]})
        except Exception:
            pass


async def progress_trip(trip_id: str):
    """Background task that moves trip through lifecycle statuses."""
    try:
        # searching -> booking (waiting for a driver to accept)
        await asyncio.sleep(3)
        await db.trips.update_one(
            {"trip_id": trip_id, "status": "searching"},
            {"$set": {"status": "booking", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        # Wait up to 12 seconds for a driver to accept manually via /api/driver/accept.
        # If no driver has accepted, auto-assign a random driver so the passenger flow keeps working.
        for _ in range(12):
            await asyncio.sleep(1)
            t = await db.trips.find_one({"trip_id": trip_id})
            if not t or t.get("status") != "booking":
                break
        t = await db.trips.find_one({"trip_id": trip_id})
        if t and t.get("status") == "booking":
            drv = await db.drivers.aggregate([{"$match": {"active": True}}, {"$sample": {"size": 1}}]).to_list(1)
            if drv:
                d = drv[0]
                driver = {"name": d["name"], "car": d["car"], "plate": d["plate"], "rating": d["rating"], "photo": d["name"][:2].upper()}
                eta = random.randint(2, 6)
                await db.trips.update_one(
                    {"trip_id": trip_id, "status": "booking"},
                    {"$set": {
                        "status": "driver_on_way",
                        "driver": driver,
                        "driver_id": d["driver_id"],
                        "eta_min": eta,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                t = await db.trips.find_one({"trip_id": trip_id})
                if t:
                    await send_push_to_user(t["user_id"], "Sjåfør på vei 🚗", f"{driver['name']} kommer om {eta} min.", f"/app/booking/{trip_id}")
        # driver_on_way -> in_trip
        await asyncio.sleep(8)
        t = await db.trips.find_one({"trip_id": trip_id})
        if t and t.get("status") == "driver_on_way":
            await db.trips.update_one(
                {"trip_id": trip_id, "status": "driver_on_way"},
                {"$set": {"status": "in_trip", "trip_started_at": datetime.now(timezone.utc).isoformat()}},
            )
            await send_push_to_user(t["user_id"], "Turen har startet ✨", "Nyt reisen med KJAPP.", f"/app/booking/{trip_id}")
        # in_trip -> arrived
        await asyncio.sleep(10)
        t = await db.trips.find_one({"trip_id": trip_id})
        if t and t.get("status") == "in_trip":
            await db.trips.update_one(
                {"trip_id": trip_id, "status": "in_trip"},
                {"$set": {"status": "arrived", "arrived_at": datetime.now(timezone.utc).isoformat()}},
            )
            await send_push_to_user(t["user_id"], "Du er fremme! 🎯", f"Takk for turen — {t.get('price')} kr.", f"/app/receipt/{trip_id}")
    except Exception as e:
        print(f"progress_trip err: {e}")


# ------------------ Lifespan ------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index("email", unique=True)
    await db.trips.create_index("user_id")
    await db.trips.create_index("trip_id", unique=True)
    await db.drivers.create_index("driver_id", unique=True)
    await db.places.create_index("slug", unique=True)
    await db.push_subscriptions.create_index("user_id")

    # generate VAPID keys once
    if PUSH_AVAILABLE and not await db.vapid.find_one({"_id": "keys"}):
        priv = ec.generate_private_key(ec.SECP256R1())
        priv_pem = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        pub_numbers = priv.public_key().public_numbers()
        # Raw uncompressed public key: 0x04 || X (32 bytes) || Y (32 bytes) — VAPID applicationServerKey
        raw = b"\x04" + pub_numbers.x.to_bytes(32, "big") + pub_numbers.y.to_bytes(32, "big")
        pub_b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
        await db.vapid.insert_one({"_id": "keys", "private_pem": priv_pem, "public_key": pub_b64})

    # seed drivers fleet
    if await db.drivers.count_documents({}) == 0:
        await db.drivers.insert_many([
            {"driver_id": "car-1", "name": "Ola N.", "car": "Tesla Model Y", "plate": "EL12345", "rating": 4.9, "type": "ai-first", "active": True},
            {"driver_id": "car-2", "name": "Kari H.", "car": "Tesla Model 3", "plate": "EL54321", "rating": 4.8, "type": "enkelt", "active": True},
            {"driver_id": "car-3", "name": "Erik B.", "car": "Polestar 2", "plate": "EL77777", "rating": 5.0, "type": "trygg", "active": True},
            {"driver_id": "car-4", "name": "Ingrid S.", "car": "Audi e-tron", "plate": "EL22222", "rating": 4.7, "type": "premium", "active": True},
            {"driver_id": "car-5", "name": "Jens P.", "car": "Volvo XC40", "plate": "EL33333", "rating": 4.8, "type": "trygg", "active": True},
            {"driver_id": "car-6", "name": "Linn M.", "car": "Kia EV6", "plate": "EL44444", "rating": 4.9, "type": "enkelt", "active": True},
            {"driver_id": "car-7", "name": "Sofie L.", "car": "Tesla Model S", "plate": "EL55555", "rating": 5.0, "type": "premium", "active": True},
            {"driver_id": "car-8", "name": "Anders K.", "car": "Hyundai Ioniq 5", "plate": "EL66666", "rating": 4.7, "type": "ai-first", "active": True},
        ])

    # seed places
    if await db.places.count_documents({}) == 0:
        await db.places.insert_many([
            {"slug": "karl-johans", "name": "Karl Johans gate 1", "lat": 59.9127, "lng": 10.7461, "label": "Hjem", "icon": "home", "featured": True},
            {"slug": "aker-brygge", "name": "Aker Brygge", "lat": 59.9106, "lng": 10.7285, "label": "Jobb", "icon": "briefcase", "featured": True},
            {"slug": "oslo-s", "name": "Oslo S", "lat": 59.9110, "lng": 10.7530, "label": "Sentralstasjon", "icon": "map-pin", "featured": True},
            {"slug": "vigelandsparken", "name": "Vigelandsparken", "lat": 59.9268, "lng": 10.7005, "label": "Park", "icon": "map-pin", "featured": False},
            {"slug": "grunerlokka", "name": "Grünerløkka", "lat": 59.9250, "lng": 10.7580, "label": "Restauranter", "icon": "map-pin", "featured": False},
            {"slug": "bislett", "name": "Bislett Stadion", "lat": 59.9250, "lng": 10.7331, "label": "Stadion", "icon": "map-pin", "featured": False},
            {"slug": "gardermoen", "name": "Gardermoen (OSL)", "lat": 60.1975, "lng": 11.1004, "label": "Flyplass", "icon": "map-pin", "featured": False},
            {"slug": "sandvika", "name": "Sandvika", "lat": 59.8909, "lng": 10.5245, "label": "Kjøpesenter", "icon": "map-pin", "featured": False},
        ])
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@kjapp.no")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "fullName": "Admin",
            "phone": "+4700000000",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    # seed test user
    test_email = "ola@kjapp.no"
    if not await db.users.find_one({"email": test_email}):
        uid = await db.users.insert_one({
            "email": test_email,
            "password_hash": hash_password("test1234"),
            "fullName": "Ola Nordmann",
            "phone": "+4791234567",
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # seed default payment methods for test user
        await db.payment_methods.insert_many([
            {"user_id": str(uid.inserted_id), "type": "vipps", "label": "Vipps", "last4": "12345", "is_default": True, "created_at": datetime.now(timezone.utc).isoformat()},
            {"user_id": str(uid.inserted_id), "type": "visa", "label": "Visa", "last4": "4242", "is_default": False, "created_at": datetime.now(timezone.utc).isoformat()},
            {"user_id": str(uid.inserted_id), "type": "mastercard", "label": "Mastercard", "last4": "8888", "is_default": False, "created_at": datetime.now(timezone.utc).isoformat()},
        ])

    # seed driver user linked to fleet
    driver_email = "sjafor@kjapp.no"
    if not await db.users.find_one({"email": driver_email}):
        await db.users.insert_one({
            "email": driver_email,
            "password_hash": hash_password("sjafor1234"),
            "fullName": "Ola Sjåfør",
            "phone": "+4790000001",
            "role": "driver",
            "driver_id": "car-1",
            "approved": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # using Authorization header, not cookies for cross-origin
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ------------------ Routes ------------------
@api.get("/")
async def root():
    return {"app": "KJAPP", "status": "ok"}


# ---- Available cars nearby (real driver fleet from DB) ----


@api.post("/cars/nearby")
async def cars_nearby(body: NearbyCarsRequest):
    import hashlib
    cars = []
    async for c in db.drivers.find({"active": True}):
        h = hashlib.md5(c["driver_id"].encode()).digest()
        dx = ((h[0] - 128) / 128) * 0.02
        dy = ((h[1] - 128) / 128) * 0.02
        eta = int(2 + (h[2] % 8))
        cars.append({
            "id": c["driver_id"],
            "name": c["name"],
            "car": c["car"],
            "plate": c["plate"],
            "rating": c["rating"],
            "type": c["type"],
            "lat": body.lat + dx,
            "lng": body.lng + dy,
            "eta_min": eta,
            "distance_km": round(abs(dx) * 111 + abs(dy) * 60, 1),
        })
    cars.sort(key=lambda x: x["eta_min"])
    return {"cars": cars}


@api.get("/places")
async def list_places(featured_only: bool = False):
    q = {"featured": True} if featured_only else {}
    places = []
    async for p in db.places.find(q):
        p.pop("_id", None)
        places.append(p)
    return {"places": places}


@api.post("/trips/estimate")
async def trip_estimate(body: EstimateRequest):
    route = await osrm_route(body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng)
    if route:
        est = route["distance_km"]
        duration = route["duration_min"]
        geometry = route["geometry"]
    else:
        est = round(haversine_km(body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng), 1)
        duration = max(3, int(est * 2.2))
        geometry = None
    options = []
    for vt, mult in [("ai-first", 1.0), ("enkelt", 0.85), ("trygg", 1.2), ("premium", 1.8)]:
        options.append({
            "vehicle_type": vt,
            "price": int(price_for(est, vt, duration)),
            "eta_min": duration,
        })
    return {"distance_km": est, "duration_min": duration, "options": options, "geometry": geometry}



@api.post("/auth/register")
async def register(body: RegisterRequest, response: Response):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-post er allerede registrert")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Passord må ha minst 6 tegn")
    result = await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(body.password),
        "fullName": body.fullName,
        "phone": body.phone or "",
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    uid = str(result.inserted_id)
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return {"token": token, "user": {"id": uid, "email": email, "fullName": body.fullName, "phone": body.phone or ""}}


@api.post("/auth/login")
async def login(body: LoginRequest, response: Response):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Feil e-post eller passord")
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return {"token": token, "user": {"id": uid, "email": email, "fullName": user.get("fullName", ""), "phone": user.get("phone", ""), "role": user.get("role", "user"), "driver_id": user.get("driver_id")}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


# ---- Trips ----
@api.post("/trips/request")
async def request_trip(body: TripRequest, current=Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    route = await osrm_route(body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng)
    if route:
        est = route["distance_km"]
        eta_min = route["duration_min"]
        geometry = route["geometry"]
    else:
        est = round(haversine_km(body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng), 1)
        eta_min = max(3, int(est * 2.2))
        geometry = None
    price = price_for(est, body.vehicle_type, eta_min)
    trip = {
        "trip_id": trip_id,
        "user_id": current["id"],
        "pickup_address": body.pickup_address,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "dropoff_address": body.dropoff_address,
        "dropoff_lat": body.dropoff_lat,
        "dropoff_lng": body.dropoff_lng,
        "vehicle_type": body.vehicle_type,
        "distance_km": est,
        "duration_min": eta_min,
        "price": price,
        "geometry": geometry,
        "status": "searching",
        "driver_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trips.insert_one(trip)
    asyncio.create_task(progress_trip(trip_id))
    trip.pop("_id", None)
    return trip


@api.get("/trips/active")
async def active_trip(current=Depends(get_current_user)):
    trip = await db.trips.find_one(
        {"user_id": current["id"], "status": {"$in": ["searching", "booking", "driver_on_way", "in_trip", "arrived"]}},
        sort=[("created_at", -1)],
    )
    if not trip:
        return None
    trip["id"] = str(trip["_id"])
    trip.pop("_id", None)
    return trip


@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current=Depends(get_current_user)):
    trip = await db.trips.find_one({"trip_id": trip_id, "user_id": current["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Tur ikke funnet")
    trip["id"] = str(trip["_id"])
    trip.pop("_id", None)
    return trip


@api.post("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, current=Depends(get_current_user)):
    await db.trips.update_one(
        {"trip_id": trip_id, "user_id": current["id"]},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    trip = await db.trips.find_one({"trip_id": trip_id})
    trip["id"] = str(trip["_id"])
    trip.pop("_id", None)
    return trip


@api.post("/trips/{trip_id}/rate")
async def rate_trip(trip_id: str, body: RateTripRequest, current=Depends(get_current_user)):
    await db.trips.update_one(
        {"trip_id": trip_id, "user_id": current["id"]},
        {"$set": {"rating": body.rating, "feedback": body.feedback, "status": "rated"}},
    )
    return {"ok": True}


@api.post("/trips/{trip_id}/cancel")
async def cancel_trip(trip_id: str, current=Depends(get_current_user)):
    await db.trips.update_one(
        {"trip_id": trip_id, "user_id": current["id"]},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api.get("/trips")
async def list_trips(current=Depends(get_current_user)):
    cursor = db.trips.find({"user_id": current["id"]}).sort("created_at", -1).limit(50)
    trips = []
    async for t in cursor:
        t["id"] = str(t["_id"])
        t.pop("_id", None)
        trips.append(t)
    return trips


# ---- Payment methods ----
@api.get("/payment-methods")
async def list_payment_methods(current=Depends(get_current_user)):
    cursor = db.payment_methods.find({"user_id": current["id"]})
    methods = []
    async for m in cursor:
        m["id"] = str(m["_id"])
        m.pop("_id", None)
        methods.append(m)
    return methods


@api.post("/payment-methods")
async def add_payment_method(body: PaymentMethodRequest, current=Depends(get_current_user)):
    if body.is_default:
        await db.payment_methods.update_many({"user_id": current["id"]}, {"$set": {"is_default": False}})
    doc = {
        "user_id": current["id"],
        "type": body.type,
        "label": body.label,
        "last4": body.last4,
        "is_default": body.is_default,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.payment_methods.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return doc


# ---- Settings ----
@api.get("/settings")
async def get_settings(current=Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": current["id"]})
    if not settings:
        settings = {
            "user_id": current["id"],
            "ai_voice": "Nora (Standard)",
            "notifications": True,
            "trip_updates": True,
            "auto_booking": False,
            "price_alerts": True,
            "language": "Norsk",
            "theme": "Mørk",
        }
        await db.settings.insert_one(settings)
    settings.pop("_id", None)
    return settings


@api.patch("/settings")
async def update_settings(body: SettingsUpdate, current=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": current["id"]}, {"$set": upd}, upsert=True)
    settings = await db.settings.find_one({"user_id": current["id"]})
    settings.pop("_id", None)
    return settings


# ---- AI Chat ----
AI_SYSTEM = """Du er KJAPP AI — en vennlig, hjelpsom AI-assistent for KJAPP, et smart AI-drevet norsk taxi-selskap.
Du hjelper kunder med:
- Å bestille taxi (spør om hentested og destinasjon)
- Estimere pris og reisetid
- Svare på spørsmål om reisen deres
- Gi råd om transport i Norge
- Være selskap under reisen

Svar alltid på norsk, med en varm og profesjonell tone. Vær kortfattet og direkte — svar bør være 1-3 setninger med mindre brukeren ber om mer detaljer. Bruk enkle, korte setninger."""


@api.post("/ai/chat")
async def ai_chat(body: ChatRequest, current=Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    session_id = body.session_id or f"user_{current['id']}"

    # store user message
    await db.chat_messages.insert_one({
        "user_id": current["id"],
        "session_id": session_id,
        "role": "user",
        "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # fetch history for this session
    history = []
    async for m in db.chat_messages.find({"user_id": current["id"], "session_id": session_id}).sort("created_at", 1):
        history.append(m)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=AI_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        # replay previous turns except the just-added user message
        for m in history[:-1]:
            if m["role"] == "user":
                await chat.send_message(UserMessage(text=m["content"]))
                # not ideal but keeps memory consistent
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI feil: {str(e)}")

    await db.chat_messages.insert_one({
        "user_id": current["id"],
        "session_id": session_id,
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"reply": reply, "session_id": session_id}


@api.get("/ai/history")
async def ai_history(session_id: Optional[str] = None, current=Depends(get_current_user)):
    sid = session_id or f"user_{current['id']}"
    msgs = []
    async for m in db.chat_messages.find({"user_id": current["id"], "session_id": sid}).sort("created_at", 1).limit(200):
        m["id"] = str(m["_id"])
        m.pop("_id", None)
        msgs.append(m)
    return {"session_id": sid, "messages": msgs}


# ---- Daily summary (driver-style stub) ----
@api.get("/summary/today")
async def summary_today(current=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    cursor = db.trips.find({"user_id": current["id"], "created_at": {"$gte": today}})
    trips = 0
    total = 0
    async for t in cursor:
        trips += 1
        total += t.get("price", 0)
    return {"trips": trips, "spent": total, "satisfaction": 98}


# ---- Driver endpoints ----
def require_driver(current=Depends(get_current_user)):
    if current.get("role") not in ("driver", "admin"):
        raise HTTPException(status_code=403, detail="Kun for sjåfører")
    if current.get("role") == "driver" and current.get("approved") is False:
        raise HTTPException(status_code=403, detail="Sjåfør-kontoen din venter på godkjenning fra flåte-eier")
    return current


class AcceptTripRequest(BaseModel):
    trip_id: str


@api.get("/driver/pending")
async def driver_pending(current=Depends(require_driver)):
    """Trips waiting to be accepted (status=booking, no driver assigned yet)."""
    trips = []
    async for t in db.trips.find({"status": "booking", "driver_id": None}).sort("created_at", 1).limit(10):
        t["id"] = str(t["_id"])
        t.pop("_id", None)
        trips.append(t)
    return {"trips": trips}


@api.post("/driver/accept")
async def driver_accept(body: AcceptTripRequest, current=Depends(require_driver)):
    driver_id = current.get("driver_id") or "car-1"
    d = await db.drivers.find_one({"driver_id": driver_id})
    if not d:
        raise HTTPException(status_code=400, detail="Sjåføren har ingen bil tildelt")
    driver = {"name": d["name"], "car": d["car"], "plate": d["plate"], "rating": d["rating"], "photo": d["name"][:2].upper()}
    eta = random.randint(2, 6)
    result = await db.trips.update_one(
        {"trip_id": body.trip_id, "status": "booking", "driver_id": None},
        {"$set": {
            "status": "driver_on_way",
            "driver": driver,
            "driver_id": driver_id,
            "eta_min": eta,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Turen er ikke lenger tilgjengelig")
    t = await db.trips.find_one({"trip_id": body.trip_id})
    await send_push_to_user(t["user_id"], "Sjåfør på vei 🚗", f"{driver['name']} kommer om {eta} min.", f"/app/booking/{body.trip_id}")
    t["id"] = str(t["_id"]); t.pop("_id", None)
    return t


@api.get("/driver/current")
async def driver_current(current=Depends(require_driver)):
    driver_id = current.get("driver_id") or "car-1"
    t = await db.trips.find_one(
        {"driver_id": driver_id, "status": {"$in": ["driver_on_way", "in_trip", "arrived"]}},
        sort=[("created_at", -1)],
    )
    if not t:
        return None
    t["id"] = str(t["_id"]); t.pop("_id", None)
    return t


@api.post("/driver/trip/{trip_id}/start")
async def driver_start(trip_id: str, current=Depends(require_driver)):
    driver_id = current.get("driver_id") or "car-1"
    result = await db.trips.update_one(
        {"trip_id": trip_id, "driver_id": driver_id, "status": "driver_on_way"},
        {"$set": {"status": "in_trip", "trip_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Kunne ikke starte turen")
    t = await db.trips.find_one({"trip_id": trip_id})
    await send_push_to_user(t["user_id"], "Turen har startet ✨", "Nyt reisen med KJAPP.", f"/app/booking/{trip_id}")
    return {"ok": True}


@api.post("/driver/trip/{trip_id}/arrive")
async def driver_arrive(trip_id: str, current=Depends(require_driver)):
    driver_id = current.get("driver_id") or "car-1"
    result = await db.trips.update_one(
        {"trip_id": trip_id, "driver_id": driver_id, "status": "in_trip"},
        {"$set": {"status": "arrived", "arrived_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Kunne ikke avslutte turen")
    t = await db.trips.find_one({"trip_id": trip_id})
    await send_push_to_user(t["user_id"], "Du er fremme! 🎯", f"Takk for turen — {t.get('price')} kr.", f"/app/receipt/{trip_id}")
    return {"ok": True}


@api.get("/driver/summary/today")
async def driver_summary(current=Depends(require_driver)):
    driver_id = current.get("driver_id") or "car-1"
    today = datetime.now(timezone.utc).date().isoformat()
    total = 0
    trips = 0
    async for t in db.trips.find({
        "driver_id": driver_id,
        "created_at": {"$gte": today},
        "status": {"$in": ["arrived", "completed", "rated"]},
    }):
        trips += 1
        total += t.get("price", 0)
    return {"income": total, "trips": trips, "satisfaction": 98}


# ---- Push endpoints ----
class PushSubscribeRequest(BaseModel):
    subscription: dict


@api.get("/push/vapid-public-key")
async def get_vapid_public_key():
    if not PUSH_AVAILABLE:
        return {"public_key": None}
    v = await db.vapid.find_one({"_id": "keys"})
    return {"public_key": v["public_key"] if v else None}


@api.post("/push/subscribe")
async def push_subscribe(body: PushSubscribeRequest, current=Depends(get_current_user)):
    endpoint = body.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    await db.push_subscriptions.update_one(
        {"user_id": current["id"], "endpoint": endpoint},
        {"$set": {
            "user_id": current["id"],
            "endpoint": endpoint,
            "subscription": body.subscription,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@api.post("/push/test")
async def push_test(current=Depends(get_current_user)):
    await send_push_to_user(current["id"], "KJAPP", "Push-varsler er slått på ✨", "/app")
    return {"ok": True}


# ============================================================
# Google Sign-In via Emergent-managed auth
# ============================================================
class GoogleSessionRequest(BaseModel):
    session_id: str


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionRequest, response: Response):
    """Exchange Emergent session_id for our JWT token, linking to existing user by email or creating one."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Ugyldig Google-økt")
        data = r.json()
    email = (data.get("email") or "").strip().lower()
    name = data.get("name") or email
    if not email:
        raise HTTPException(status_code=400, detail="Ingen e-post fra Google")
    user = await db.users.find_one({"email": email})
    if not user:
        result = await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(secrets.token_hex(16)),  # random password, unused
            "fullName": name,
            "phone": "",
            "picture": data.get("picture"),
            "role": "user",
            "google_linked": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        uid = str(result.inserted_id)
        role = "user"
        driver_id = None
    else:
        uid = str(user["_id"])
        role = user.get("role", "user")
        driver_id = user.get("driver_id")
        if not user.get("google_linked"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"google_linked": True, "picture": data.get("picture")}})
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return {"token": token, "user": {"id": uid, "email": email, "fullName": name, "phone": user.get("phone", "") if user else "", "role": role, "driver_id": driver_id}}


# ============================================================
# Admin dashboard
# ============================================================
def require_admin(current=Depends(get_current_user)):
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Kun for admin")
    return current


@api.get("/admin/overview")
async def admin_overview(current=Depends(require_admin)):
    users_total = await db.users.count_documents({"role": "user"})
    drivers_total = await db.users.count_documents({"role": "driver"})
    drivers_pending = await db.users.count_documents({"role": "driver", "approved": False})
    trips_today = 0
    revenue_today = 0
    today = datetime.now(timezone.utc).date().isoformat()
    async for t in db.trips.find({"created_at": {"$gte": today}}):
        trips_today += 1
        if t.get("status") in ("arrived", "completed", "rated"):
            revenue_today += t.get("price", 0)
    trips_total = await db.trips.count_documents({})
    return {
        "users": users_total,
        "drivers": drivers_total,
        "drivers_pending": drivers_pending,
        "trips_today": trips_today,
        "revenue_today": revenue_today,
        "trips_total": trips_total,
    }


@api.get("/admin/users")
async def admin_users(current=Depends(require_admin)):
    out = []
    async for u in db.users.find({}, {"password_hash": 0}).sort("created_at", -1).limit(200):
        u["id"] = str(u["_id"])
        u.pop("_id", None)
        out.append(u)
    return {"users": out}


@api.get("/admin/drivers")
async def admin_drivers(current=Depends(require_admin)):
    out = []
    async for u in db.users.find({"role": "driver"}, {"password_hash": 0}).sort("created_at", -1):
        u["id"] = str(u["_id"])
        u.pop("_id", None)
        out.append(u)
    return {"drivers": out}


@api.get("/admin/trips")
async def admin_trips(current=Depends(require_admin), limit: int = 100):
    out = []
    async for t in db.trips.find({}).sort("created_at", -1).limit(limit):
        t["id"] = str(t["_id"])
        t.pop("_id", None)
        out.append(t)
    return {"trips": out}


class ApproveDriverRequest(BaseModel):
    approved: bool = True


@api.post("/admin/drivers/{user_id}/approve")
async def admin_approve_driver(user_id: str, body: ApproveDriverRequest, current=Depends(require_admin)):
    await db.users.update_one({"_id": ObjectId(user_id), "role": "driver"}, {"$set": {"approved": body.approved}})
    return {"ok": True}


# ============================================================
# Driver invitation flow (fleet owner / admin invites drivers)
# ============================================================
class DriverInviteRequest(BaseModel):
    driver_id: str  # which fleet car
    note: Optional[str] = ""
    email: Optional[str] = None  # if set, send invite via SendGrid


class DriverSignupRequest(BaseModel):
    token: str
    fullName: str
    email: str
    phone: str
    password: str


@api.post("/admin/driver-invites")
async def create_driver_invite(body: DriverInviteRequest, request: Request, current=Depends(require_admin)):
    token = secrets.token_urlsafe(24)
    d = await db.drivers.find_one({"driver_id": body.driver_id})
    if not d:
        raise HTTPException(status_code=404, detail="Bil (driver_id) finnes ikke")
    doc = {
        "token": token,
        "driver_id": body.driver_id,
        "note": body.note or "",
        "email": (body.email or "").strip().lower() or None,
        "created_by": current["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "used": False,
        "email_sent": False,
    }
    await db.driver_invites.insert_one(doc)
    # send email if requested
    if body.email:
        # Build signup URL from request origin
        origin = str(request.base_url).rstrip("/").replace("/api", "")
        # Prefer Origin header (frontend URL) if present
        frontend = request.headers.get("origin") or request.headers.get("referer", "").split("/api")[0] or origin
        invite_url = f"{frontend.rstrip('/')}/driver-signup/{token}"
        ok = send_email(
            body.email,
            "Invitasjon: Bli sjåfør for KJAPP",
            email_driver_invite_html(d["car"], d["plate"], invite_url, body.note or ""),
        )
        if ok:
            await db.driver_invites.update_one({"token": token}, {"$set": {"email_sent": True}})
            doc["email_sent"] = True
    doc.pop("_id", None)
    return doc


@api.get("/admin/driver-invites")
async def list_driver_invites(current=Depends(require_admin)):
    out = []
    async for i in db.driver_invites.find({}).sort("created_at", -1).limit(100):
        i["id"] = str(i["_id"])
        i.pop("_id", None)
        out.append(i)
    return {"invites": out}


@api.get("/driver-invites/{token}")
async def get_driver_invite(token: str):
    inv = await db.driver_invites.find_one({"token": token})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitasjon ikke funnet")
    if inv.get("used"):
        raise HTTPException(status_code=410, detail="Invitasjon allerede brukt")
    expires = inv.get("expires_at")
    if expires and expires < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="Invitasjon utløpt")
    d = await db.drivers.find_one({"driver_id": inv["driver_id"]})
    return {
        "token": inv["token"],
        "driver_id": inv["driver_id"],
        "car": d["car"] if d else None,
        "plate": d["plate"] if d else None,
        "note": inv.get("note", ""),
    }


@api.post("/driver-invites/accept")
async def accept_driver_invite(body: DriverSignupRequest, response: Response):
    inv = await db.driver_invites.find_one({"token": body.token})
    if not inv or inv.get("used"):
        raise HTTPException(status_code=410, detail="Invitasjon ugyldig")
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-post er allerede registrert")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Passord må ha minst 6 tegn")
    result = await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(body.password),
        "fullName": body.fullName,
        "phone": body.phone,
        "role": "driver",
        "driver_id": inv["driver_id"],
        "approved": False,  # requires admin approval before pending trips visible
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    uid = str(result.inserted_id)
    await db.driver_invites.update_one({"token": body.token}, {"$set": {"used": True, "used_by": uid, "used_at": datetime.now(timezone.utc).isoformat()}})
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return {
        "token": token,
        "user": {"id": uid, "email": email, "fullName": body.fullName, "phone": body.phone, "role": "driver", "driver_id": inv["driver_id"], "approved": False},
        "pending_approval": True,
    }


# ============================================================
# Apple Sign In
# ============================================================
class AppleSignInRequest(BaseModel):
    identity_token: str
    fullName: Optional[str] = None
    email: Optional[str] = None  # Apple only provides this on first login


APPLE_KEYS_CACHE = {"keys": None, "fetched_at": None}


async def _get_apple_keys():
    now = datetime.now(timezone.utc)
    if APPLE_KEYS_CACHE["keys"] and APPLE_KEYS_CACHE["fetched_at"] and (now - APPLE_KEYS_CACHE["fetched_at"]).seconds < 3600:
        return APPLE_KEYS_CACHE["keys"]
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get("https://appleid.apple.com/auth/keys")
        keys = r.json().get("keys", [])
    APPLE_KEYS_CACHE["keys"] = keys
    APPLE_KEYS_CACHE["fetched_at"] = now
    return keys


@api.post("/auth/apple")
async def apple_signin(body: AppleSignInRequest, response: Response):
    """Verify Apple identity_token and log user in.
    Requires APPLE_CLIENT_ID env var to be set (App Store Service ID / Bundle ID)."""
    apple_client_id = os.environ.get("APPLE_CLIENT_ID", "").strip()
    if not apple_client_id:
        raise HTTPException(status_code=501, detail="Apple Sign In er ikke konfigurert. Sett APPLE_CLIENT_ID.")
    try:
        # Get unverified header to find kid
        header = jwt.get_unverified_header(body.identity_token)
        kid = header.get("kid")
        apple_keys = await _get_apple_keys()
        key_data = next((k for k in apple_keys if k.get("kid") == kid), None)
        if not key_data:
            raise HTTPException(status_code=401, detail="Ukjent Apple-nøkkel")
        # Verify token using PyJWT with JWK
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
        payload = jwt.decode(
            body.identity_token, public_key, algorithms=["RS256"],
            audience=apple_client_id, issuer="https://appleid.apple.com",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Ugyldig Apple-token: {e}")

    apple_sub = payload.get("sub")
    email = (body.email or payload.get("email") or "").strip().lower()
    if not email:
        # Apple hides email after first login — need to find user by apple_sub
        existing = await db.users.find_one({"apple_sub": apple_sub})
        if not existing:
            raise HTTPException(status_code=400, detail="Ingen e-post fra Apple ved første innlogging")
        uid = str(existing["_id"])
        email = existing["email"]
        role = existing.get("role", "user")
        driver_id = existing.get("driver_id")
    else:
        user = await db.users.find_one({"email": email}) or await db.users.find_one({"apple_sub": apple_sub})
        if not user:
            name = body.fullName or email.split("@")[0]
            result = await db.users.insert_one({
                "email": email,
                "password_hash": hash_password(secrets.token_hex(16)),
                "fullName": name,
                "phone": "",
                "apple_sub": apple_sub,
                "apple_linked": True,
                "role": "user",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            uid = str(result.inserted_id)
            role = "user"
            driver_id = None
        else:
            uid = str(user["_id"])
            role = user.get("role", "user")
            driver_id = user.get("driver_id")
            if not user.get("apple_sub"):
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"apple_sub": apple_sub, "apple_linked": True}})
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return {"token": token, "user": {"id": uid, "email": email, "fullName": body.fullName or "", "phone": "", "role": role, "driver_id": driver_id}}


@api.get("/auth/apple/config")
async def apple_config():
    """Expose the Apple Client ID so the frontend can init Apple JS SDK."""
    return {"client_id": os.environ.get("APPLE_CLIENT_ID", ""), "enabled": bool(os.environ.get("APPLE_CLIENT_ID"))}


app.include_router(api)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
