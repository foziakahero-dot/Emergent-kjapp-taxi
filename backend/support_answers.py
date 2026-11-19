"""Answers for the four customer support shortcuts and the optional chat provider."""
import os

import httpx


FAQ = {
    "hvordan fungerer fastpris": "Du ser prisen før du bestiller. Velg bilen du vil reise med for å se hva som er inkludert og hva eventuell ventetid koster.",
    "jeg glemte noe i bilen": "Åpne Turer og finn turen der du glemte noe. Send kundestøtte turreferansen og en kort beskrivelse av det du savner.",
    "endre destinasjon underveis": "Snakk med sjåføren før dere endrer ruten. Kundestøtte kan hjelpe hvis du har spørsmål om prisen etterpå.",
    "refusjon og klage på en tur": "Finn turen under Turer. Send kundestøtte turreferansen og fortell hva som skjedde, så kan de vurdere saken.",
}


def faq_answer(message):
    return FAQ.get(" ".join(message.casefold().split()).rstrip("?.!"))


def gateway_key(environment):
    if environment == "qa":
        if os.getenv("QA_AI_ENABLED") != "true":
            return ""
        return os.getenv("QA_AI_GATEWAY_API_KEY", "").strip()
    return os.getenv("AI_GATEWAY_API_KEY", "").strip()


async def gateway_reply(key, system, collection, owner, session, message_id, text):
    cursor = collection.find(
        {"user_id": owner, "session_id": session, "_id": {"$lt": message_id}},
        {"role": 1, "content": 1},
    ).sort("_id", -1).limit(8)
    history = [
        {"role": item["role"], "content": item["content"][:4000]}
        async for item in cursor
        if item.get("role") in {"assistant", "user"} and isinstance(item.get("content"), str)
    ]
    messages = [{"role": "system", "content": system}, *reversed(history), {"role": "user", "content": text}]
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://ai-gateway.vercel.sh/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": "openai/gpt-4.1-mini", "messages": messages, "max_tokens": 280},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
