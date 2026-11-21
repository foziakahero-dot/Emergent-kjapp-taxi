"""SNAR support policy, provider calls and authenticated case intake."""
import hashlib
import os
import re
from datetime import datetime, timezone

from bson import ObjectId

import httpx


FAQ = {
    "hvordan fungerer fastpris": "Du ser prisen før du bestiller. Velg bilen du vil reise med for å se hva som er inkludert og hva eventuell ventetid koster.",
    "jeg glemte noe i bilen": "Åpne Turer og finn turen der du glemte noe. Send kundestøtte turreferansen og en kort beskrivelse av det du savner.",
    "endre destinasjon underveis": "Snakk med sjåføren før dere endrer ruten. Kundestøtte kan hjelpe hvis du har spørsmål om prisen etterpå.",
    "refusjon og klage på en tur": "Finn turen under Turer. Send kundestøtte turreferansen og fortell hva som skjedde, så kan de vurdere saken.",
    "how does fixed pricing work": "You can see the fare before you book. Select a car to see what is included and how much waiting time may cost.",
    "i left something in the car": "Open Trips and find the ride where you left the item. Send support the trip reference and a short description of what you lost.",
    "change destination during a trip": "Talk to your driver before changing the route. If you have a question about the final fare, contact support after the trip.",
    "refunds and trip complaints": "Find the ride under Trips. Send support the trip reference and explain what happened so they can review your request.",
}

URGENT = re.compile(
    r"\b(?:nød(?:situasjon)?|akutt fare|ulykk(?:e|en)|påkjørt|truet|trusler|vold(?:elig)?|"
    r"overgrep|overfalt|trakasser(?:t|ing)|bortført|skadet|slår meg|bilen brenner|ikke trygg|usikker på om jeg er trygg|emergency|"
    r"accident|assault(?:ed)?|threat(?:ened|s)?|harassment|injured|unsafe)\b",
    re.IGNORECASE,
)
OUT_OF_SCOPE = re.compile(
    r"\b(?:sex|seksuell(?:e)?|seksuelt|pornografi|porno|barn(?:et|a|ene)?|mindreårig(?:e)?|"
    r"lønn|inntekt(?:er|en)?|baksnakk(?:ing|e)?|minor(?:s)?|child(?:ren)?|"
    r"sexual|salary|income|gossip|porn(?:ography)?)\b",
    re.IGNORECASE,
)
CONTACT_VALUES = re.compile(
    r"\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b|https?://\S+|"
    r"\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|"
    r"(?<!\d)\+?(?:\d[ -]?){8,19}(?![ -]?\d)",
    re.IGNORECASE,
)
SECRET_VALUE = re.compile(
    r"\b(?:passord|password|cvc|cvv|otp|engangskode|pin)\s*[:=]\s*\S+",
    re.IGNORECASE,
)
TRIP_STATUS_QUESTION = re.compile(
    r"^\s*(?:status|turstatus)[?.!\s]*$|\b(?:status på (?:turen|min tur)|hvor er (?:sjåføren|bilen)|where is (?:my |the )?driver)\b",
    re.IGNORECASE,
)
TRIP_STATUS = {
    "searching": "Vi leter etter en sjåfør til turen din.",
    "booking": "Vi leter etter en sjåfør til turen din.",
    "driver_on_way": "Sjåføren er på vei til hentestedet.",
    "at_pickup": "Sjåføren er ved hentestedet.",
    "in_trip": "Turen pågår.",
    "arrived": "Turen er registrert som fremme.",
    "completed": "Turen er fullført. Du finner detaljer under Turer.",
    "rated": "Turen er fullført. Du finner detaljer under Turer.",
    "cancelled": "Turen er avbestilt.",
}
SCOPE_REPLY = "Jeg kan hjelpe med bestilling, turer, betaling og bruk av SNAR. Du kan også skrive til kundestøtte."
URGENT_REPLY = "Ved akutt fare, ring 112 direkte. Saken er sendt til SNARs kundestøtte."


def faq_answer(message):
    return FAQ.get(" ".join(message.casefold().split()).rstrip("?.!"))


def redact_message(text):
    return CONTACT_VALUES.sub("[skjult]", SECRET_VALUE.sub("[skjult]", text))


def customer_trip_reply(message, trip):
    if trip and TRIP_STATUS_QUESTION.search(message):
        return TRIP_STATUS.get(trip.get("status"))
    return None


async def create_case(collection, owner, session, text, *, urgent=False, trip_id=None):
    safe_text = redact_message(text)
    # Retries or a second tap on the same case in this chat resolve to one admin ticket.
    ref = ObjectId(hashlib.sha256(f"{owner['id']}\0{session}\0{trip_id or ''}\0{safe_text}".encode()).hexdigest()[:24])
    await collection.update_one(
        {"_id": ref},
        {"$setOnInsert": {
            "subject": "Kritisk henvendelse fra kundeappen" if urgent else "Henvendelse fra kundeappen",
            "category": "tur" if trip_id else "annet",
            "priority": "kritisk" if urgent else "normal",
            "status": "open",
            "body": safe_text,
            "contact_name": owner.get("fullName"),
            "contact_email": owner.get("email"),
            "contact": owner.get("email") or owner.get("phone"),
            "created_by": owner["id"],
            "trip_id": trip_id,
            "source": "customer_app",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "notes": [],
        }},
        upsert=True,
    )
    return str(ref)


def openai_key(environment):
    if environment == "qa":
        if os.getenv("QA_AI_ENABLED") != "true":
            return ""
        return os.getenv("QA_SUPPORT_OPENAI_API_KEY", "").strip()
    if environment == "production":
        return os.getenv("SNAR_SUPPORT_OPENAI_API_KEY", "").strip()
    return ""


def gateway_key(environment):
    if environment == "qa":
        if os.getenv("QA_AI_ENABLED") != "true":
            return ""
        return os.getenv("QA_AI_GATEWAY_API_KEY", "").strip()
    return os.getenv("AI_GATEWAY_API_KEY", "").strip()


async def support_messages(collection, owner, session, message_id, text):
    cursor = collection.find(
        {"user_id": owner, "session_id": session, "_id": {"$lt": message_id}},
        {"role": 1, "content": 1},
    ).sort("_id", -1).limit(8)
    history = [
        {"role": item["role"], "content": redact_message(item["content"][:4000])}
        async for item in cursor
        if item.get("role") in {"assistant", "user"} and isinstance(item.get("content"), str)
        and not URGENT.search(item["content"]) and not OUT_OF_SCOPE.search(item["content"])
    ]
    return [*reversed(history), {"role": "user", "content": redact_message(text)}]


async def openai_reply(key, system, collection, owner, session, message_id, text):
    messages = await support_messages(collection, owner, session, message_id, text)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": "gpt-4.1-mini",
                "instructions": system,
                "input": messages,
                "max_output_tokens": 320,
                "store": False,
            },
        )
        response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "completed":
        return ""
    return "\n".join(
        part["text"]
        for item in payload.get("output", []) if item.get("type") == "message" and item.get("role") == "assistant"
        for part in item.get("content", []) if part.get("type") == "output_text" and isinstance(part.get("text"), str)
    ).strip()


async def gateway_reply(key, system, collection, owner, session, message_id, text):
    history = await support_messages(collection, owner, session, message_id, text)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://ai-gateway.vercel.sh/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": "openai/gpt-4.1-mini", "messages": [{"role": "system", "content": system}, *history], "max_tokens": 280},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
