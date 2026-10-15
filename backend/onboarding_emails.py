"""Durable confirmations with retries. Never stores login tokens or bank information."""
import asyncio
import html
import logging
import os
from datetime import datetime, timedelta, timezone
from pymongo import ReturnDocument
from email_delivery import email_configured


async def queue_confirmation(db, kind, entity_id, recipient, name, notes=""):
    if not recipient:
        return "not_requested"
    messages = {
        "customer": ("Velkommen til SNAR", "Kundekontoen din er opprettet. Du kan nå logge inn i SNAR-appen med innloggingsmetoden du valgte. Tilgjengelige biler og tjenester avhenger av området du befinner deg i. Vi gleder oss til å ha deg med."),
        "beta": ("Velkommen til SNAR-betaen", "Takk for at du vil teste SNAR! Interessen din er registrert. Vi sender informasjon om tilgang når neste testgruppe åpner. Dette er en bekreftelse på registreringen, ikke en aktiv brukerkonto."),
        "fleet": ("SNAR: Vi har mottatt partnersøknaden", "Virksomheten og dokumentene dine er sendt til SNAR for kontroll. Du får et eget svar når søknaden er behandlet. Flåtetilgang åpnes etter godkjenning."),
        "driver": ("SNAR: Sjåførregistreringen er mottatt", "Profilbilde, førerkort og kjøreseddel er sendt til kontroll. Registreringen er knyttet til flåten som inviterte deg. Du kan motta turer først når nødvendige godkjenninger er på plass."),
        "driver-approved": ("SNAR: Sjåførkontoen er godkjent", "SNAR har godkjent sjåførkontoen din. Åpne sjåførappen med e-postadressen du registrerte, velg en bil du har tilgang til og kontroller at bil- og dokumentstatus er klar før du går online."),
        "fleet-approved": ("SNAR: Partnersøknaden er godkjent", "Din egen flåte er opprettet. Åpne https://fleet.snarapp.no/login og logg inn med e-postadressen fra søknaden. Har du ikke et passord, velg «Glemt passord». Fullfør firma-, identitets- og bankkontroll under Økonomi i Fleet før Stripe-utbetalinger kan starte."),
        "fleet-rejected": ("SNAR: Svar på partnersøknaden", "Partnersøknaden din er behandlet og ikke godkjent. Du har ikke fått tilgang til Fleet. Kontakt SNAR dersom du trenger hjelp med dokumentasjonen eller ønsker å sende en ny søknad."),
        "fleet-admin": ("SNAR: Ny partnersøknad til kontroll", "En ny partnersøknad er sendt inn med dokumentasjon. Åpne https://admin.snarapp.no/fleet-applications for å kontrollere dokumentene og behandle søknaden. Søknaden gir ikke Fleet-tilgang før du godkjenner den."),
    }
    subject, message = messages[kind]
    note_html = f'<p>{html.escape(notes)}</p>' if notes else ""
    body = f'<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px"><h1>SNAR</h1><p>Hei {html.escape(name or "")}.</p><p>{message}</p>{note_html}<p>SNAR kobler kunder med selvstendige løyvehavere gjennom appen.</p></div>'
    now = datetime.now(timezone.utc)
    await db.onboarding_email_outbox.update_one({"_id": f"{kind}:{entity_id}"}, {"$setOnInsert": {
        "recipient": recipient, "subject": subject, "html": body, "kind": kind,
        "entity_id": str(entity_id), "status": "pending", "attempts": 0,
        "created_at": now, "next_attempt_at": now,
    }}, upsert=True)
    return "queued" if email_configured() else "not_configured"


async def deliver_one(db, send_email, prepare_email=None):
    now = datetime.now(timezone.utc)
    job = await db.onboarding_email_outbox.find_one_and_update({
        "attempts": {"$lt": 8}, "$or": [
            {"status": "pending", "next_attempt_at": {"$lte": now}},
            {"status": "sending", "lease_until": {"$lte": now}},
        ],
    }, {"$set": {"status": "sending", "lease_until": now + timedelta(minutes=2)}, "$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER)
    if not job:
        return False
    try:
        body = await prepare_email(job) if prepare_email else job["html"]
        sent = bool(await asyncio.to_thread(send_email, job["recipient"], job["subject"], body))
    except Exception:
        sent = False
    if sent:
        fields = {"status": "sent", "sent_at": datetime.now(timezone.utc)}
    else:
        fields = {"status": "pending" if job["attempts"] < 8 else "failed",
                  "next_attempt_at": now + timedelta(minutes=min(60, 2 ** job["attempts"]))}
    await db.onboarding_email_outbox.update_one({"_id": job["_id"], "attempts": job["attempts"]}, {"$set": fields, "$unset": {"lease_until": ""}})
    return True


async def confirmation_loop(db, send_email, prepare_email=None, invite_sender=None):
    while True:
        try:
            await recover_customer_welcomes(db)
            if email_configured():
                for _ in range(20):
                    if not await deliver_one(db, send_email, prepare_email):
                        break
                if invite_sender:
                    for _ in range(20):
                        if not await deliver_invite(db, invite_sender):
                            break
        except Exception:
            logging.warning("SNAR confirmation email delivery needs retry")
        await asyncio.sleep(30)


async def deliver_invite(db, invite_sender):
    """Retry live invitations by reference; do not copy their tokens into another store."""
    now = datetime.now(timezone.utc)
    invite = await db.driver_invites.find_one_and_update({
        "used": {"$ne": True}, "email_sent": {"$ne": True},
        "email": {"$exists": True, "$nin": [None, ""]},
        "expires_at": {"$gt": now.isoformat()},
        "$and": [
            {"$or": [{"email_attempts": {"$exists": False}}, {"email_attempts": {"$lt": 8}}]},
            {"$or": [{"email_next_attempt_at": {"$exists": False}}, {"email_next_attempt_at": {"$lte": now}}]},
            {"$or": [{"email_lease_until": {"$exists": False}}, {"email_lease_until": {"$lte": now}}]},
        ],
    }, {"$set": {"email_lease_until": now + timedelta(minutes=2)}, "$inc": {"email_attempts": 1}}, return_document=ReturnDocument.AFTER)
    if not invite:
        return False
    try:
        result = await invite_sender(invite)
        sent = bool(result.get("email_sent"))
    except Exception:
        sent = False
    fields = {"email_sent": sent, "email_next_attempt_at": now + timedelta(minutes=min(60, 2 ** invite["email_attempts"]))}
    await db.driver_invites.update_one({"_id": invite["_id"], "email_attempts": invite["email_attempts"]},
                                      {"$set": fields, "$unset": {"email_lease_until": ""}})
    return True


async def recover_customer_welcomes(db):
    """Queue only newly created customer accounts, once per account, after crashes too."""
    async for user in db.users.find({"role": "user", "welcome_email_pending": True}).limit(20):
        if user.get("disabled") or not user.get("email"):
            await db.users.update_one({"_id": user["_id"]}, {"$unset": {"welcome_email_pending": ""}})
            continue
        await queue_confirmation(db, "customer", str(user["_id"]), user["email"], user.get("fullName", ""))
        await db.users.update_one({"_id": user["_id"]}, {"$unset": {"welcome_email_pending": ""}})
