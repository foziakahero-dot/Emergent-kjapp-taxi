"""Private driver imagery projected only to an authenticated nearby customer."""
import asyncio
import hashlib
import io
import uuid
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
import document_storage

MAX_IMAGE_BYTES = 3 * 1024 * 1024


def media_version(path, updated=''):
    return hashlib.sha256((str(path) + str(updated)).encode()).hexdigest()[:20] if path else None


def media_versions(driver, vehicle):
    vehicle_id = str(vehicle.get('_id') or vehicle.get('vehicle_id') or '')
    return {
        'photo_version': media_version(driver.get('profile_photo_path'), driver.get('profile_photo_updated_at')),
        'car_icon_version': media_version(driver.get('car_icon_path'), driver.get('car_icon_updated_at'))
            if vehicle_id and driver.get('car_icon_vehicle_id') == vehicle_id else None,
    }


def clean_image(data, size=512):
    """Decode/re-encode a bounded bitmap; remove EXIF, GPS and embedded content."""
    try:
        with Image.open(io.BytesIO(data)) as original:
            if original.format not in ('JPEG', 'PNG', 'WEBP') or original.width * original.height > 12_000_000:
                raise ValueError()
            image = ImageOps.exif_transpose(original).convert('RGBA')
            image.thumbnail((size, size))
            clean = Image.new('RGBA', image.size); clean.paste(image)
            out = io.BytesIO(); clean.save(out, format='PNG')
            return out.getvalue()
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError):
        raise HTTPException(415, 'Bruk et gyldig JPG-, PNG- eller WebP-bilde på maks 12 megapiksler.')


def install_driver_media(api, db, *, require_driver, require_customer, assigned_vehicle, snapshot, parse_circle, read_document):
    @api.post('/driver/car-icon')
    async def upload_car_icon(file: UploadFile = File(...), current=Depends(require_driver)):
        if file.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
            raise HTTPException(415, 'Bilikonet må være JPG, PNG eller WebP.')
        data = await file.read(MAX_IMAGE_BYTES + 1)
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, 'Bilikonet kan være maks 3 MB.')
        vehicle = await assigned_vehicle(current, required=True)
        safe = await asyncio.to_thread(clean_image, data)
        path = f'driver-car-icons/{current["id"]}/{uuid.uuid4().hex}.png'
        await document_storage.put_document(db, path, safe, 'image/png')
        now = datetime.now(timezone.utc).isoformat()
        await db.uploaded_files.insert_one({'storage_path': path, 'owner_user_id': current['id'],
            'vehicle_id': str(vehicle['_id']), 'scope': 'driver-car-icons', 'doc_type': 'car_icon',
            'content_type': 'image/png', 'size': len(safe), 'is_deleted': False, 'created_at': now})
        previous = await db.users.find_one({'_id': ObjectId(current['id'])}, {'car_icon_path': 1}) or {}
        await db.users.update_one({'_id': ObjectId(current['id']), 'role': 'driver'}, {'$set': {
            'car_icon_path': path, 'car_icon_updated_at': now, 'car_icon_vehicle_id': str(vehicle['_id'])}})
        if previous.get('car_icon_path'):
            await db.uploaded_files.update_many({'storage_path': previous['car_icon_path'], 'owner_user_id': current['id']},
                {'$set': {'is_deleted': True, 'deleted_at': now}})
        return {'uploaded': True, 'car_icon_version': media_version(path, now)}

    @api.get('/cars/{driver_id}/media/{kind}')
    async def nearby_media(driver_id: str, kind: Literal['profile', 'car-icon'],
            lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180),
            v: str = Query(min_length=1, max_length=64), current=Depends(require_customer)):
        # No arbitrary document URL. Reapply the exact online/session/GPS/5 km
        # policy at fetch time, even if the customer retained an older URL.
        supply = await snapshot(parse_circle({'lat': lat, 'lng': lng}), current)
        car = next((car for car in supply['cars'] if car['id'] == driver_id), None)
        version_key = 'photo_version' if kind == 'profile' else 'car_icon_version'
        if not car or car.get(version_key) != v:
            raise HTTPException(404, 'Bildet er ikke tilgjengelig.')
        try:
            driver = await db.users.find_one({'_id': ObjectId(driver_id), 'role': 'driver'}) or {}
        except InvalidId:
            raise HTTPException(404, 'Bildet er ikke tilgjengelig.')
        path = driver.get('profile_photo_path' if kind == 'profile' else 'car_icon_path')
        meta = await db.uploaded_files.find_one({'storage_path': path, 'owner_user_id': driver_id,
            'scope': 'driver-docs' if kind == 'profile' else 'driver-car-icons',
            'doc_type': 'profile_photo' if kind == 'profile' else 'car_icon', 'is_deleted': {'$ne': True}})
        if not path or not meta:
            raise HTTPException(404, 'Bildet er ikke tilgjengelig.')
        data, _ = await read_document(path)
        safe = await asyncio.to_thread(clean_image, data, 256)
        return Response(safe, media_type='image/png', headers={'Cache-Control': 'private, max-age=30',
            'X-Content-Type-Options': 'nosniff'})
