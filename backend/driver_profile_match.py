"""One-to-one comparison of a verified selfie with two driver-owned image uploads."""
import asyncio
import re
import time
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException

MAX_BYTES = 5 * 1024 * 1024
PHOTO_FIELDS = {"profile_photo_path": "profile_photo", "drivers_license_path": "drivers_license"}


def match_photos(client, selfie, images):
    for image in images:
        if not image or len(image) > MAX_BYTES:
            return False
        faces = client.detect_faces(Image={"Bytes": image})["FaceDetails"]
        if len(faces) != 1:
            return False
        comparison = client.compare_faces(SourceImage={"Bytes": selfie}, TargetImage={"Bytes": image},
                                          SimilarityThreshold=99, QualityFilter="HIGH")
        if len(comparison["FaceMatches"]) != 1 or comparison.get("UnmatchedFaces"):
            return False
    return len(images) == 2


def compare_report(stripe_client, session, images):
    report_id = session.get("last_verification_report")
    if not isinstance(report_id, str) or not report_id.startswith("vr_"):
        return False
    report = stripe_client.v1.identity.verification_reports.retrieve(report_id)
    document, face = report.get("document") or {}, report.get("selfie") or {}
    if (report.get("verification_session") != session["id"] or report.get("livemode") is not session["livemode"]
            or document.get("type") != "driving_license" or document.get("status") != "verified"
            or face.get("status") != "verified" or not re.fullmatch(r"file_[A-Za-z0-9]+", face.get("selfie") or "")):
        return False
    link = stripe_client.v1.file_links.create({"file": face["selfie"], "expires_at": int(time.time()) + 25})
    url = link.get("url") or ""
    origin = urlsplit(url)
    if origin.scheme != "https" or origin.netloc != "files.stripe.com" or not origin.path.startswith("/links/"):
        raise ValueError("Ugyldig filvert fra ID-leverandøren")
    with requests.get(url, stream=True, allow_redirects=False, timeout=(4, 8)) as response:
        if response.status_code != 200:
            raise OSError("Verifisert ansiktsbilde er midlertidig utilgjengelig")
        selfie = bytearray()
        for chunk in response.iter_content(65536):
            selfie.extend(chunk)
            if len(selfie) > MAX_BYTES:
                return False
    if not selfie:
        return False
    client = boto3.client("rekognition", region_name="eu-west-1",
                          config=Config(connect_timeout=3, read_timeout=8, retries={"total_max_attempts": 2}))
    try:
        return match_photos(client, bytes(selfie), images)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "InvalidParameterException":
            return False
        raise


async def compare_driver_files(db, driver, read_file, stripe_client, session):
    images = []
    for field, doc_type in PHOTO_FIELDS.items():
        path = driver.get(field)
        if not path or not await db.uploaded_files.find_one({
            "storage_path": path, "scope": "driver-docs", "doc_type": doc_type,
            "owner_user_id": str(driver["_id"]), "is_deleted": {"$ne": True},
        }, {"_id": 1}):
            return False
        data, mime = await read_file(path)
        if mime not in ("image/jpeg", "image/png") or not data or len(data) > MAX_BYTES:
            return False
        images.append(data)
    try:
        return await asyncio.to_thread(compare_report, stripe_client, session, images)
    except Exception:
        # A provider failure must be retryable; third-party errors can contain private URLs.
        raise HTTPException(503, "Bildekontrollen må prøves igjen.") from None
