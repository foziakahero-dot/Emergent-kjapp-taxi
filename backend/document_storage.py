"""Private, bounded document storage in the platform's existing durable Mongo database.

Each file is at most 8 MiB, below Mongo's 16 MiB BSON document limit. The HTTP
handlers retain their existing ownership checks; this module never creates public URLs.
"""
from datetime import datetime, timezone
from fastapi import HTTPException

MAX_DOCUMENT_BYTES = 8 * 1024 * 1024


async def put_document(db, path, data, content_type):
    if not data or len(data) > MAX_DOCUMENT_BYTES:
        raise HTTPException(413, "Dokumentet kan være maks 8 MB")
    await db.document_blobs.insert_one({"_id": path, "data": data,
        "content_type": content_type, "created_at": datetime.now(timezone.utc)})
    return {"path": path, "size": len(data)}


async def get_document(db, path):
    record = await db.document_blobs.find_one({"_id": path})
    return (bytes(record["data"]), record["content_type"]) if record else None


async def delete_document(db, path):
    result = await db.document_blobs.delete_one({"_id": path})
    return result.deleted_count == 1
