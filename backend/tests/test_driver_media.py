import io
import sys
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from driver_media import install_driver_media, media_versions, MAX_IMAGE_BYTES
import document_storage


class Collection:
    def __init__(self, raw): self.raw = raw
    async def find_one(self, *args, **kwargs): return self.raw.find_one(*args, **kwargs)
    async def insert_one(self, *args, **kwargs): return self.raw.insert_one(*args, **kwargs)
    async def update_one(self, *args, **kwargs): return self.raw.update_one(*args, **kwargs)
    async def update_many(self, *args, **kwargs): return self.raw.update_many(*args, **kwargs)


def png():
    out = io.BytesIO(); Image.new('RGBA', (800, 400), 'red').save(out, 'PNG'); return out.getvalue()


@pytest.fixture
def env():
    raw = mongomock.MongoClient().db
    db = SimpleNamespace(**{name: Collection(raw[name]) for name in ('users', 'uploaded_files', 'document_blobs')})
    uid, vid = ObjectId(), ObjectId()
    raw.users.insert_one({'_id': uid, 'role': 'driver'})
    active = {'value': True}; assigned = {'value': True}
    def customer(request: Request):
        if request.headers.get('Authorization') != 'Bearer customer': raise HTTPException(403)
        return {'id': 'customer', 'role': 'user'}
    def driver(request: Request):
        if request.headers.get('Authorization') != 'Bearer driver': raise HTTPException(403)
        return {'id': str(uid), 'role': 'driver'}
    async def vehicle(*args, **kwargs):
        if not assigned['value']: raise HTTPException(403)
        return {'_id': vid, 'vehicle_type': 'suv'}
    async def snapshot(body, user):
        row = raw.users.find_one({'_id': uid})
        return {'cars': [{'id': str(uid), **media_versions(row, {'_id': vid})}] if active['value'] else []}
    async def read(path): return await document_storage.get_document(db, path)
    app = FastAPI()
    install_driver_media(app, db, require_driver=driver, require_customer=customer,
        assigned_vehicle=vehicle, snapshot=snapshot, parse_circle=lambda body: body, read_document=read)
    return SimpleNamespace(client=TestClient(app), raw=raw, uid=uid, vid=vid, active=active, assigned=assigned)


def upload(env, data=None, mime='image/png', token='driver'):
    return env.client.post('/driver/car-icon', headers={'Authorization': 'Bearer ' + token}, files={'file': ('car.png', data if data is not None else png(), mime)})


def image_url(env, version): return f'/cars/{env.uid}/media/car-icon?lat=59.91&lng=10.75&v={version}'


def test_driver_upload_is_private_sanitized_and_bound_to_actual_vehicle(env):
    result = upload(env); assert result.status_code == 200
    row = env.raw.users.find_one({'_id': env.uid}); assert row['car_icon_vehicle_id'] == str(env.vid)
    blob = env.raw.document_blobs.find_one({'_id': row['car_icon_path']})
    with Image.open(io.BytesIO(blob['data'])) as image:
        assert max(image.size) <= 512 and image.format == 'PNG' and not image.getexif()
    assert env.raw.uploaded_files.find_one()['owner_user_id'] == str(env.uid)
    url = image_url(env, result.json()['car_icon_version'])
    response = env.client.get(url, headers={'Authorization': 'Bearer customer'})
    assert response.status_code == 200 and response.headers['content-type'] == 'image/png'
    assert response.headers['cache-control'].startswith('private')
    assert env.client.get(url).status_code == 403
    assert env.client.get(url, headers={'Authorization': 'Bearer driver'}).status_code == 403
    env.active['value'] = False
    assert env.client.get(url, headers={'Authorization': 'Bearer customer'}).status_code == 404


@pytest.mark.parametrize('data,mime,status', [(b'<svg><script/></svg>', 'image/svg+xml', 415), (b'not an image', 'image/png', 415), (b'x' * (MAX_IMAGE_BYTES + 1), 'image/png', 413), (b'', 'image/png', 413)])
def test_upload_rejects_active_content_invalid_and_oversized_files(env, data, mime, status):
    assert upload(env, data, mime).status_code == status
    assert env.raw.document_blobs.count_documents({}) == 0


def test_customer_and_unassigned_driver_cannot_upload(env):
    assert upload(env, token='customer').status_code == 403
    env.assigned['value'] = False
    assert upload(env).status_code == 403


def test_replacement_invalidates_old_version_and_wrong_vehicle_hides_icon(env):
    first = upload(env).json()['car_icon_version']; second = upload(env).json()['car_icon_version']
    assert first != second
    assert env.raw.uploaded_files.count_documents({'is_deleted': True}) == 1
    assert env.client.get(image_url(env, first), headers={'Authorization': 'Bearer customer'}).status_code == 404
    row = env.raw.users.find_one({'_id': env.uid})
    assert media_versions(row, {'_id': ObjectId()})['car_icon_version'] is None
