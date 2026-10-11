"""Isolated HTTP/security tests; these are fixtures, not a live Customer E2E test."""
import asyncio
import base64
import io
import sys
from pathlib import Path
from unittest.mock import AsyncMock
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from PIL import Image
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from customer_profile import install_customer_profile, export_customer_photo, delete_customer_photo, normalize_photo, MAX_UPLOAD
from test_mobile_commerce import Database, Collection

async def delete_one(self, query): return self.raw.delete_one(query)
Collection.delete_one = delete_one


def picture():
    out = io.BytesIO()
    image = Image.new('RGB', (40, 40), 'red')
    exif = image.getexif(); exif[270] = 'private metadata'
    image.save(out, format='JPEG', exif=exif)
    return out.getvalue()


@pytest.fixture
def system():
    db = Database(); app = FastAPI()
    async def customer(request: Request):
        uid = request.headers.get('x-fixture-user')
        if not uid: raise HTTPException(401)
        if request.headers.get('x-fixture-role', 'user') != 'user': raise HTTPException(403)
        return {'id': uid, 'role': 'user'}
    install_customer_profile(app, db, require_customer=customer, rate_limit=AsyncMock())
    return TestClient(app), db


def test_authenticated_scoped_atomic_photo_replace_and_delete(system):
    client, db = system
    first, second = str(ObjectId()), str(ObjectId())
    assert client.get('/me/profile-photo').status_code == 401
    assert client.post('/me/profile-photo', files={'file': ('x.jpg', picture(), 'image/jpeg')}, headers={'x-fixture-user': first, 'x-fixture-role': 'driver'}).status_code == 403
    headers = {'x-fixture-user': first}
    upload = client.post('/me/profile-photo', files={'file': ('x.jpg', picture(), 'image/jpeg')}, headers=headers)
    assert upload.status_code == 200
    version = upload.json()['customer_photo_version']
    read = client.get('/me/profile-photo', headers=headers)
    assert read.status_code == 200 and read.headers['cache-control'] == 'private, no-store'
    assert not Image.open(io.BytesIO(read.content)).getexif()
    assert client.get('/me/profile-photo', headers={'x-fixture-user': second}).status_code == 404
    replaced = client.post('/me/profile-photo', files={'file': ('x.jpg', picture(), 'image/jpeg')}, headers=headers)
    assert replaced.json()['customer_photo_version'] != version
    assert db.raw.customer_photos.count_documents({}) == 1
    exported = asyncio.run(export_customer_photo(db, first))
    assert base64.b64decode(exported['data_base64']) == client.get('/me/profile-photo', headers=headers).content
    assert client.delete('/me/profile-photo', headers=headers).status_code == 200
    assert client.get('/me/profile-photo', headers=headers).status_code == 404
    assert client.delete('/me/profile-photo', headers=headers).status_code == 200


@pytest.mark.parametrize('data,mime,code', [(b'not an image', 'image/jpeg', 415), (picture(), 'image/png', 415), (picture(), 'image/svg+xml', 415), (b'x'*(MAX_UPLOAD+1),'image/jpeg',413)])
def test_untrusted_image_validation(data,mime,code):
    with pytest.raises(HTTPException) as error: normalize_photo(data,mime)
    assert error.value.status_code == code


def test_gdpr_photo_erasure(system):
    client, db = system; uid = str(ObjectId())
    client.post('/me/profile-photo', files={'file':('x.jpg',picture(),'image/jpeg')},headers={'x-fixture-user':uid})
    asyncio.run(delete_customer_photo(db, uid))
    assert asyncio.run(export_customer_photo(db,uid)) is None
