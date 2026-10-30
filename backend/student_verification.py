"""Customer student eligibility with private, short-lived proof and explicit review.

This does not grant a discount: pricing policy is a separate owner decision.
No email domain, client flag or upload alone is proof of student eligibility.
"""
import asyncio
import base64
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from bson import ObjectId

from fastapi import Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field
from customer_profile import MAX_UPLOAD, normalize_photo


def student_public(row, now=None):
    now = now or datetime.now(timezone.utc)
    row = row or {}
    status = row.get("status", "not_submitted")
    if status == "verified" and (row.get("valid_until") or "") < now.date().isoformat():
        status = "expired"
    if status == "pending" and ((row.get("proof_expires_at") or "") <= now.isoformat()
                                or (row.get("valid_until") or "") < now.date().isoformat()):
        status = "needs_resubmission"
    return {key: row.get(key) for key in (
        "institution", "valid_until", "submitted_at", "reviewed_at", "reason", "revision"
    )} | {"status": status, "eligible": status == "verified", "benefit_configured": False}


class Review(BaseModel):
    revision: str = Field(min_length=1, max_length=64)
    decision: Literal["verified", "rejected", "revoked"]
    reason: str = Field(min_length=3, max_length=300)


async def erase_student_verification(db, uid):
    await db.student_verifications.delete_one({"_id": uid})
    await db.student_proofs.delete_many({"user_id": uid})


async def export_student_verification(db, uid):
    row = await db.student_verifications.find_one({"_id": uid})
    if not row:
        return None
    proof = await db.student_proofs.find_one({"_id": row["revision"], "user_id": uid,
        "expires_at": {"$gt": datetime.now(timezone.utc)}})
    return student_public(row) | {"proof_jpeg_base64": base64.b64encode(proof["data"]).decode("ascii") if proof else None}


def install_student_verification(api, db, *, require_customer, require_admin, rate_limit, audit):
    @api.get("/me/student-verification")
    async def status(current=Depends(require_customer)):
        return student_public(await db.student_verifications.find_one({"_id": current["id"]}))

    @api.post("/me/student-verification")
    async def submit(request: Request, institution: str = Form(..., min_length=2, max_length=120),
                     valid_until: date = Form(...), consent: bool = Form(...),
                     file: UploadFile = File(...), current=Depends(require_customer)):
        await rate_limit(request, "student-proof", 5, 3600)
        now = datetime.now(timezone.utc)
        if not consent:
            raise HTTPException(422, "Du må godta dokumentkontrollen")
        if not institution.strip() or not now.date() < valid_until <= now.date() + timedelta(days=366):
            raise HTTPException(422, "Velg studiested og gyldighetsdato innen ett år")
        clean = await asyncio.to_thread(normalize_photo, await file.read(MAX_UPLOAD + 1), file.content_type, max_dimension=1600)
        revision = uuid.uuid4().hex
        expires = now + timedelta(days=7)
        # Proofs have random revision IDs, so simultaneous uploads cannot overwrite
        # the evidence an administrator is reviewing. Orphans expire via Mongo TTL.
        await db.student_proofs.insert_one({"_id": revision, "user_id": current["id"],
            "data": clean, "expires_at": expires})
        row = {"status": "pending", "revision": revision, "institution": institution.strip(),
               "valid_until": valid_until.isoformat(), "submitted_at": now.isoformat(),
               "proof_expires_at": expires.isoformat(), "consented_at": now.isoformat()}
        await db.student_verifications.update_one({"_id": current["id"]},
            {"$set": row, "$unset": {"reason": "", "reviewed_at": "", "reviewed_by": ""}}, upsert=True)
        return student_public(row, now)

    @api.delete("/me/student-verification")
    async def withdraw(current=Depends(require_customer)):
        await erase_student_verification(db, current["id"])
        return {"deleted": True}

    @api.get("/admin/student-verifications")
    async def applications(status: Literal["pending", "verified", "rejected", "revoked"] = "pending",
                           current=Depends(require_admin)):
        rows = await db.student_verifications.find({"status": status}).sort("submitted_at", -1).limit(100).to_list(100)
        ids = [ObjectId(row["_id"]) for row in rows if ObjectId.is_valid(row["_id"])]
        users = await db.users.find({"_id": {"$in": ids}}, {"fullName": 1}).to_list(100)
        names = {str(user["_id"]): user.get("fullName") or "" for user in users}
        return {"applications": [student_public(row) | {"customer_id": row["_id"],
            "customer_name": names.get(row["_id"], "")} for row in rows]}

    @api.get("/admin/student-verifications/{uid}/proof")
    async def proof(uid: str, revision: str, current=Depends(require_admin)):
        row = await db.student_verifications.find_one({"_id": uid, "revision": revision, "status": "pending"})
        if not row or student_public(row)["status"] != "pending":
            raise HTTPException(404, "Dokumentet finnes ikke eller er utløpt")
        doc = await db.student_proofs.find_one({"_id": revision, "user_id": uid,
                                               "expires_at": {"$gt": datetime.now(timezone.utc)}})
        if not doc:
            raise HTTPException(404, "Dokumentet er slettet; kunden må sende på nytt")
        return Response(content=doc["data"], media_type="image/jpeg", headers={
            "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="student-proof.jpg"'})

    @api.post("/admin/student-verifications/{uid}/review")
    async def review(uid: str, body: Review, current=Depends(require_admin)):
        row = await db.student_verifications.find_one({"_id": uid, "revision": body.revision})
        expected = "verified" if body.decision == "revoked" else "pending"
        if not row or student_public(row)["status"] != expected:
            raise HTTPException(409, "Søknaden er endret eller utløpt. Last listen på nytt")
        if body.decision == "verified":
            doc = await db.student_proofs.find_one({"_id": body.revision, "user_id": uid,
                                                   "expires_at": {"$gt": datetime.now(timezone.utc)}})
            if not doc:
                raise HTTPException(409, "Gyldig dokumentasjon mangler")
        updates = {"status": body.decision, "reason": body.reason.strip(),
                   "reviewed_at": datetime.now(timezone.utc).isoformat(), "reviewed_by": current["id"]}
        if len(updates["reason"]) < 3:
            raise HTTPException(422, "Skriv en begrunnelse")
        result = await db.student_verifications.update_one(
            {"_id": uid, "revision": body.revision, "status": expected}, {"$set": updates})
        if result.modified_count != 1:
            raise HTTPException(409, "Søknaden er allerede behandlet")
        await db.student_proofs.delete_one({"_id": body.revision, "user_id": uid})
        await audit(current, "student." + body.decision, "student_verifications", uid,
                    {"status": expected}, {"status": body.decision, "revision": body.revision})
        return student_public(row | updates)
