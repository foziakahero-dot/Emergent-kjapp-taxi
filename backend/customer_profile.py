"""Customer-only, bounded and authenticated photo storage in the existing Mongo database.

Re-encoding strips EXIF/GPS. A single document per customer makes replacement atomic
and keeps photos durable across Render restarts without a public storage URL.
"""
import asyncio
import base64
import io
import uuid
import warnings
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import Depends, File, HTTPException, Request, Response, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
ALLOWED = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def normalize_photo(data: bytes, content_type: str) -> bytes:
    if content_type not in ALLOWED:
        raise HTTPException(415, "Velg JPEG, PNG eller WebP")
    if not data or len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Bildet kan være maks 5 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format != ALLOWED[content_type] or image.width * image.height > MAX_PIXELS:
                    raise HTTPException(415, "Ugyldig eller for stort bilde")
                if getattr(image, "n_frames", 1) != 1:
                    raise HTTPException(415, "Velg et stillbilde")
                image.load()
                clean = ImageOps.exif_transpose(image).convert("RGB")
                clean.thumbnail((768, 768))
                out = io.BytesIO()
                clean.save(out, format="JPEG", quality=85, optimize=True)
                return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(415, "Bildet kunne ikke leses")


async def export_customer_photo(db, uid):
    doc = await db.customer_photos.find_one({"_id": uid})
    if not doc:
        return None
    return {"content_type": "image/jpeg", "updated_at": doc["updated_at"],
            "data_base64": base64.b64encode(doc["data"]).decode("ascii")}


async def delete_customer_photo(db, uid):
    await db.customer_photos.delete_one({"_id": uid})
    await db.users.update_one({"_id": ObjectId(uid)}, {"$unset": {"customer_photo_version": ""}})


def install_customer_profile(api, db, *, require_customer, rate_limit):
    @api.post("/me/profile-photo")
    async def upload_photo(request: Request, file: UploadFile = File(...), current=Depends(require_customer)):
        await rate_limit(request, "customer-photo", 20, 900)
        data = await file.read(MAX_UPLOAD + 1)
        clean = await asyncio.to_thread(normalize_photo, data, file.content_type)
        version = uuid.uuid4().hex
        # The photo version returned by /auth/me is the persisted document version.
        # This avoids cache races when two uploads replace the image concurrently.
        await db.customer_photos.update_one({"_id": current["id"]}, {"$set": {
            "data": clean, "version": version, "updated_at": datetime.now(timezone.utc).isoformat(),
        }}, upsert=True)
        return {"customer_photo_version": version}

    @api.get("/me/profile-photo")
    async def read_photo(current=Depends(require_customer)):
        doc = await db.customer_photos.find_one({"_id": current["id"]})
        if not doc:
            raise HTTPException(404, "Profilbilde mangler")
        return Response(content=doc["data"], media_type="image/jpeg", headers={
            "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        })

    @api.delete("/me/profile-photo")
    async def remove_photo(current=Depends(require_customer)):
        await delete_customer_photo(db, current["id"])
        return {"deleted": True}
