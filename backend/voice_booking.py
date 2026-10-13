"""Controlled voice proposal workflow. The model never receives mutation tools."""
from datetime import datetime, timedelta, timezone
import uuid
from typing import Literal

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
from byteplus_voice import BytePlusIntent, BytePlusSpeech, require_enabled, enabled


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Position(StrictBody):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class VoiceInput(StrictBody):
    transcript: str | None = Field(default=None, min_length=2, max_length=2000)
    audio_base64: str | None = Field(default=None, max_length=5592416)
    mime_type: Literal["audio/m4a", "audio/mp4", "audio/webm", "audio/wav", "audio/mpeg"] = "audio/m4a"
    language: Literal["no-NO", "en-US"] = "no-NO"
    location: Position | None = None

    @model_validator(mode="after")
    def one_input(self):
        if bool(self.transcript) == bool(self.audio_base64):
            raise ValueError("Provide transcript OR audio")
        return self


class ProposalInput(StrictBody):
    session_id: str = Field(min_length=20, max_length=64)
    pickup_id: str = Field(min_length=20, max_length=64)
    destination_id: str = Field(min_length=20, max_length=64)
    vehicle_type: Literal["ai-first", "trygg", "premium"]


class ConfirmInput(StrictBody):
    proposal_id: str = Field(min_length=20, max_length=64)
    confirmed: Literal[True]
    waiting_policy_accepted: Literal[True]

    @field_validator("confirmed", "waiting_policy_accepted", mode="before")
    @classmethod
    def explicit_true(cls, value):
        if value is not True:
            raise ValueError("Explicit boolean confirmation required")
        return value


def utcnow():
    return datetime.now(timezone.utc)


def unexpired(doc):
    stamp = doc.get("expires_at")
    if stamp and stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp is not None and stamp > utcnow()


def recommend(intent):
    mapping = {"standard": "ai-first", "xl": "trygg", "premium": "premium"}
    return mapping.get(intent.vehicle_preference) or ("trygg" if (intent.passenger_count or 1) > 4 or intent.large_luggage else "ai-first")


class VoiceBooking:
    def __init__(self, db, *, search, reverse, estimate, book, get_trip, estimate_model, trip_model, speech=None, model=None):
        self.db, self.search, self.reverse = db, search, reverse
        self.estimate, self.book, self.get_trip = estimate, book, get_trip
        self.estimate_model, self.trip_model = estimate_model, trip_model
        self.speech, self.model = speech or BytePlusSpeech(), model or BytePlusIntent()

    async def indexes(self):
        await self.db.voice_booking_sessions.create_index("cleanup_at", expireAfterSeconds=0)
        await self.db.voice_booking_proposals.create_index("cleanup_at", expireAfterSeconds=0)

    async def candidates(self, query, request):
        found = (await self.search(query, request, 5)).get("results") or []
        result = []
        for item in found:
            try:
                point = Position.model_validate({"lat": item["lat"], "lng": item["lng"]})
                name = str(item["name"]).strip()[:200]
                if not name:
                    continue
                result.append({"id": str(uuid.uuid4()), "name": name, **point.model_dump()})
            except (KeyError, ValueError, TypeError):
                continue
        return result[:5]

    async def prepare(self, body, request, current):
        require_enabled()
        transcript = body.transcript.strip() if body.transcript else await self.speech.transcribe(body.audio_base64, body.mime_type, body.language)
        intent = await self.model.extract(transcript)
        # These contracts do not exist yet; never silently book them as a ride now.
        if intent.intent != "book_trip":
            return {"status": "clarification", "transcript": transcript, "message": "Skriv hentested og destinasjon for turen."}
        if intent.scheduled or intent.multiple_stops or intent.unsupported_requirements:
            return {"status": "clarification", "transcript": transcript, "message": "Denne bestillingen trenger flere valg. Bruk vanlig bestilling eller beskriv en direkte tur nå."}
        pickup = await self.candidates(intent.pickup, request) if intent.pickup else []
        if not pickup and not intent.pickup and intent.use_current_location and body.location:
            rev = await self.reverse(body.location.lat, body.location.lng)
            pickup = [{"id": str(uuid.uuid4()), "name": (rev.get("label") or "Din posisjon")[:200], **body.location.model_dump()}]
        destination = await self.candidates(intent.destination, request) if intent.destination else []
        if not pickup or not destination:
            return {"status": "clarification", "transcript": transcript, "message": "Oppgi et tydelig hentested og en destinasjon. For eksempel: Hent meg ved Oslo S og kjør til Gardermoen."}
        session_id = str(uuid.uuid4())
        await self.db.voice_booking_sessions.insert_one({"_id": session_id, "user_id": current["id"], "intent": intent.model_dump(),
            "pickup_candidates": pickup, "destination_candidates": destination, "expires_at": utcnow() + timedelta(minutes=5), "cleanup_at": utcnow() + timedelta(minutes=10)})
        return {"status": "select_addresses", "session_id": session_id, "transcript": transcript,
                "intent": intent.model_dump(), "pickup_candidates": pickup, "destination_candidates": destination,
                "recommended_vehicle_type": recommend(intent), "requires_confirmation": True}

    async def proposal(self, body, current):
        require_enabled()
        session = await self.db.voice_booking_sessions.find_one({"_id": body.session_id, "user_id": current["id"]})
        if not session or not unexpired(session):
            raise HTTPException(410, "Taleøkten er utløpt. Start på nytt.")
        pickup = next((p for p in session["pickup_candidates"] if p["id"] == body.pickup_id), None)
        dest = next((p for p in session["destination_candidates"] if p["id"] == body.destination_id), None)
        if not pickup or not dest:
            raise HTTPException(400, "Velg adressene fra denne taleøkten.")
        intent = session["intent"]
        if (intent.get("passenger_count") or 1) > (7 if body.vehicle_type == "trygg" else 4):
            raise HTTPException(422, "Velg SNAR XL for mer enn fire passasjerer.")
        route = dict(pickup_lat=pickup["lat"], pickup_lng=pickup["lng"], dropoff_lat=dest["lat"], dropoff_lng=dest["lng"])
        quote = await self.estimate(self.estimate_model(**route))
        option = next((o for o in quote.get("options", []) if o["vehicle_type"] == body.vehicle_type), None)
        if not quote.get("geometry") or not option or not option.get("waiting_policy", {}).get("token"):
            raise HTTPException(503, "Kunne ikke beregne en trygg kjørerute og pris. Bruk vanlig bestilling.")
        needs = list(dict.fromkeys(intent.get("special_requirements") or []))
        if intent.get("large_luggage") and "large_luggage" not in needs:
            needs.append("large_luggage")
        counts = []
        if intent.get("passenger_count") is not None:
            counts.append(f"{intent['passenger_count']} passasjerer")
        if intent.get("luggage") is not None:
            counts.append(f"{intent['luggage']} kolli bagasje")
        payload = {**route, "pickup_address": pickup["name"], "dropoff_address": dest["name"], "vehicle_type": body.vehicle_type,
                   "special_needs": needs, "note": ", ".join(counts) or None, "waiting_policy_token": option["waiting_policy"]["token"],
                   "quoted_price": option["price"], "quoted_pricing_version": option["pricing_version"]}
        # Validate using the real booking model, before persistence.
        payload = self.trip_model(**payload).model_dump()
        proposal_id, expiry = str(uuid.uuid4()), utcnow() + timedelta(minutes=2)
        await self.db.voice_booking_proposals.insert_one({"_id": proposal_id, "user_id": current["id"], "state": "pending",
            "payload": payload, "expires_at": expiry, "cleanup_at": utcnow() + timedelta(minutes=30)})
        return {"status": "proposal", "proposal_id": proposal_id, "pickup": pickup, "destination": dest, "vehicle_type": body.vehicle_type,
                "estimated_price": option["price"], "currency": "NOK", "waiting_policy": option["waiting_policy"],
                "distance_km": quote["distance_km"], "duration_min": quote["duration_min"], "intent": intent,
                "expires_at": expiry.isoformat(), "requires_confirmation": True}

    async def confirm(self, body, current):
        require_enabled()
        owned = {"_id": body.proposal_id, "user_id": current["id"]}
        proposal = await self.db.voice_booking_proposals.find_one(owned)
        if not proposal:
            raise HTTPException(404, "Bestillingsforslaget finnes ikke.")
        if proposal.get("trip_id"):
            return await self.get_trip(proposal["trip_id"], current)
        if not unexpired(proposal):
            raise HTTPException(410, "Pristilbudet er utløpt. Beregn på nytt.")
        # Atomic across workers; no retries of uncertain trip creation.
        claim = await self.db.voice_booking_proposals.update_one({**owned, "state": "pending", "expires_at": {"$gt": utcnow()}}, {"$set": {"state": "confirming"}})
        if claim.modified_count != 1:
            raise HTTPException(409, "Bekreftelsen behandles eller er allerede forsøkt. Åpne aktiv tur før du prøver igjen.")
        try:
            trip = await self.book(self.trip_model(**proposal["payload"]), current)
            await self.db.voice_booking_proposals.update_one(owned, {"$set": {"state": "completed", "trip_id": trip["trip_id"]}})
            return trip
        except HTTPException as exc:
            # 3DS continues through the existing mobile reservation flow.
            trip_id = exc.detail.get("trip_id") if isinstance(exc.detail, dict) else None
            await self.db.voice_booking_proposals.update_one(owned, {"$set": {"state": "attempted", **({"trip_id": trip_id} if trip_id else {})}})
            raise
        except Exception:
            # Leave confirming when result is unknown. Never repeat the mutation.
            raise HTTPException(503, "Bestillingsstatus kunne ikke bekreftes. Åpne aktiv tur før du bestiller på nytt.") from None


def install_voice_booking(api, service, *, require_customer, rate_limit):
    @api.get("/ai/voice/config")
    async def config(current=Depends(require_customer)):
        return {"enabled": enabled(), "tts_enabled": False, "max_recording_seconds": 30}

    @api.post("/ai/voice/booking")
    async def prepare(body: VoiceInput, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "voice-booking", 10, 60)
        return await service.prepare(body, request, current)

    @api.post("/ai/voice/booking/proposal")
    async def proposal(body: ProposalInput, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "voice-proposal", 20, 60)
        return await service.proposal(body, current)

    @api.post("/ai/voice/booking/confirm")
    async def confirm(body: ConfirmInput, request: Request, current=Depends(require_customer)):
        await rate_limit(request, "voice-confirm", 10, 60)
        return await service.confirm(body, current)
