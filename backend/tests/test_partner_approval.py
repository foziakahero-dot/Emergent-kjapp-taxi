"""Exercise real application, approval and document authorization handlers offline."""
import asyncio
import os
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import mongomock
import pytest
from bson import ObjectId
from fastapi import HTTPException, Request

os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'isolated_test')
os.environ.setdefault('JWT_SECRET', 'isolated-development-key-for-import')
os.environ.setdefault('APP_ENV', 'development')
sys.path.insert(0, str(Path(__file__).parents[1]))
import server
from test_fleet_invitation_delivery import Collection


@pytest.fixture
def state(monkeypatch):
    raw = mongomock.MongoClient(tz_aware=True).db
    db = SimpleNamespace(**{n: Collection(raw[n]) for n in ('users', 'fleets', 'trips', 'fleet_vehicles', 'fleet_applications', 'uploaded_files', 'document_blobs', 'onboarding_email_outbox', 'platform_settings', 'password_reset_tokens')})
    monkeypatch.setattr(server, 'db', db)
    monkeypatch.setattr(server.stripe, 'api_key', '')
    monkeypatch.setattr(server, 'EMERGENT_LLM_KEY', '')
    monkeypatch.setenv('SENDGRID_API_KEY', '')
    async def rate(*a): pass
    monkeypatch.setattr(server, '_enforce_rate_limit', rate)
    raw.platform_settings.insert_one({'_id': 'singleton', 'default_commission': .12})
    request = Request({'type': 'http', 'headers': []})
    return raw, db, request


async def submitted(state):
    raw, db, request = state
    draft = await server.create_fleet_application_draft(server.FleetApplicationDraftRequest(
        company_name='Test Fleet', org_number='123456789', contact_name='Owner',
        contact_email='owner@example.com', contact_phone='+4799999999', license_count=2, vehicle_count=2,
        bank_account='NO9386011117947', accepted_terms=True), request)
    token = draft['upload_token']
    docs = {}
    for kind in ('firmaattest', 'loyvebevis', 'vognkort', 'forsikring', 'bank'):
        path=f'application/{token}/{kind}'
        await server.put_stored_document(path, b'%PDF-test', 'application/pdf')
        raw.uploaded_files.insert_one({'storage_path': path, 'application_token': token, 'scope': 'fleet-applications'})
        docs[kind]={'path': path, 'content_type': 'application/pdf', 'original_filename': kind+'.pdf'}
    result=await server.submit_fleet_application(server.FleetApplicationSubmitRequest(upload_token=token, documents=docs), request)
    assert result['status']=='pending' and result['confirmation_email_status']=='not_configured'
    return raw.fleet_applications.find_one({'upload_token': token})


def test_application_docs_and_own_fleet_access_after_approval(state):
    raw, db, _ = state
    async def check():
        application=await submitted(state)
        assert raw.fleets.count_documents({})==0 and raw.users.count_documents({})==0
        result=await server.superadmin_approve_application(str(application['_id']), server.FleetApplicationDecisionRequest(), {'id': str(ObjectId())})
        fleet=raw.fleets.find_one()
        assert fleet['commission_rate']==.12 and fleet['bank_account']=='86011117947'
        owner=raw.users.find_one({'_id': ObjectId(result['fleet_owner_user_id'])})
        assert owner['role']=='fleet_owner' and owner['fleet_id']==result['fleet_id']
        assert raw.fleet_applications.find_one()['status']=='approved'
        doc=application['documents']['firmaattest']['path']
        response=await server.download_file(doc, {'id': str(owner['_id']), 'role': 'fleet_owner'})
        assert response.body==b'%PDF-test'
        outsider=ObjectId(); raw.users.insert_one({'_id': outsider, 'role': 'fleet_owner', 'fleet_id': str(ObjectId())})
        with pytest.raises(HTTPException) as caught: await server.download_file(doc, {'id': str(outsider), 'role': 'fleet_owner'})
        assert caught.value.status_code==403
        with pytest.raises(HTTPException): await server.superadmin_approve_application(str(application['_id']), server.FleetApplicationDecisionRequest(), {'id': str(ObjectId())})
        assert raw.fleets.count_documents({})==1
        assert raw.onboarding_email_outbox.count_documents({})==2
        assert not any(result['temp_password'] in job['html'] for job in raw.onboarding_email_outbox.find())
    asyncio.run(check())


@pytest.mark.parametrize('locked', [False, True])
def test_rejection_cannot_revoke_approved_or_in_progress_application(state, locked):
    raw, _, _ = state
    async def check():
        application = await submitted(state)
        fields = {'approval_lock': 'active-approval'} if locked else {'status': 'approved', 'fleet_id': str(ObjectId())}
        raw.fleet_applications.update_one({'_id': application['_id']}, {'$set': fields})
        with pytest.raises(HTTPException) as caught:
            await server.superadmin_reject_application(str(application['_id']), server.FleetApplicationDecisionRequest(), {'id': str(ObjectId())})
        assert caught.value.status_code == 409
        saved = raw.fleet_applications.find_one({'_id': application['_id']})
        assert saved['status'] == ('pending' if locked else 'approved')
        assert raw.onboarding_email_outbox.count_documents({'kind': 'fleet-rejected'}) == 0
    asyncio.run(check())


def test_vehicle_access_setter_restricts_own_fleet_and_offline_driver(state, monkeypatch):
    raw, _, _ = state
    owner_id, driver_id = ObjectId(), ObjectId()
    fleet_id, foreign_fleet_id = str(ObjectId()), str(ObjectId())
    own_vehicle, foreign_vehicle = ObjectId(), ObjectId()
    raw.users.insert_many([
        {'_id': owner_id, 'role': 'fleet_owner', 'fleet_id': fleet_id},
        {'_id': driver_id, 'role': 'driver', 'fleet_id': fleet_id, 'online': False},
    ])
    raw.fleet_vehicles.insert_many([
        {'_id': own_vehicle, 'fleet_id': fleet_id, 'active': True},
        {'_id': foreign_vehicle, 'fleet_id': foreign_fleet_id, 'active': True},
    ])
    async def audit(*args): pass
    monkeypatch.setattr(server, '_audit', audit)
    current = {'id': str(owner_id), 'role': 'fleet_owner'}
    async def check():
        with pytest.raises(HTTPException) as caught:
            await server.fleet_driver_vehicle_access(str(driver_id), server.FleetDriverVehicleAccessRequest(mode='selected', vehicle_ids=[str(foreign_vehicle)]), current)
        assert caught.value.status_code == 400
        result = await server.fleet_driver_vehicle_access(str(driver_id), server.FleetDriverVehicleAccessRequest(mode='selected', vehicle_ids=[str(own_vehicle)]), current)
        assert result['allowed_vehicle_ids'] == [str(own_vehicle)]
        saved = raw.users.find_one({'_id': driver_id})
        assert saved['vehicle_access_mode'] == 'selected' and saved['vehicle_id'] == str(own_vehicle)
        raw.users.update_one({'_id': driver_id}, {'$set': {'online': True}})
        with pytest.raises(HTTPException) as caught:
            await server.fleet_driver_vehicle_access(str(driver_id), server.FleetDriverVehicleAccessRequest(mode='all'), current)
        assert caught.value.status_code == 409
        outsider = ObjectId()
        raw.users.insert_one({'_id': outsider, 'role': 'fleet_owner', 'fleet_id': foreign_fleet_id})
        with pytest.raises(HTTPException) as caught:
            await server.fleet_driver_vehicle_access(str(driver_id), server.FleetDriverVehicleAccessRequest(mode='all'), {'id': str(outsider), 'role': 'fleet_owner'})
        assert caught.value.status_code == 404
    asyncio.run(check())


def test_approval_does_not_take_over_admin_or_other_fleet_account(state):
    raw, _, _ = state
    async def check():
        application=await submitted(state)
        raw.users.insert_one({'email': application['contact_email'], 'role': 'superadmin'})
        with pytest.raises(HTTPException) as caught: await server.superadmin_approve_application(str(application['_id']), server.FleetApplicationDecisionRequest(), {'id': str(ObjectId())})
        assert caught.value.status_code==409 and raw.fleets.count_documents({})==0
        assert raw.users.find_one()['role']=='superadmin'
    asyncio.run(check())


def test_zero_fee_and_concurrent_approval(state, monkeypatch):
    raw, _, _ = state
    original=server.hash_password
    async def check():
        application=await submitted(state)
        owner=ObjectId(); raw.users.insert_one({'_id': owner, 'email': application['contact_email'], 'role': 'user'})
        # Force a real scheduling boundary after acquiring the application lease.
        original_insert=server.db.fleets.insert_one
        async def delayed_insert(*args):
            await asyncio.sleep(0)
            return await original_insert(*args)
        monkeypatch.setattr(server.db.fleets, 'insert_one', delayed_insert)
        async def approve(): return await server.superadmin_approve_application(str(application['_id']), server.FleetApplicationDecisionRequest(commission_rate=0), {'id': str(ObjectId())})
        results=await asyncio.gather(approve(), approve(), return_exceptions=True)
        assert sum(isinstance(r, HTTPException) for r in results)==1
        assert raw.fleets.count_documents({})==1 and raw.fleets.find_one()['commission_rate']==0
        assert await server._commission_for_trip({'commission_rate': 0})==0
    asyncio.run(check())


def test_active_admin_driver_status_route_preserves_document_guard_and_email(state, monkeypatch):
    raw, _, _ = state
    driver_id = ObjectId()
    photo = f'driver/{driver_id}/photo.jpg'
    raw.users.insert_one({'_id': driver_id, 'role': 'driver', 'email': 'driver@example.com',
                          'approved': False, 'profile_photo_path': photo, 'fullName': 'Driver'})
    raw.uploaded_files.insert_one({'storage_path': photo, 'owner_user_id': str(driver_id),
                                  'scope': 'driver-docs', 'doc_type': 'profile_photo'})
    operational = False
    async def compliance(*args):
        return {'operational': operational, 'missing': [] if operational else ['drivers_license'], 'statuses': {}}
    async def audit(*args): pass
    monkeypatch.setattr(server, '_driver_document_compliance', compliance)
    monkeypatch.setattr(server, '_audit', audit)
    monkeypatch.setattr(server, '_enforce_identity_before_driver_approval', lambda *args: None)
    async def check():
        nonlocal operational
        body = server.ApproveDriverRequest(approved=True)
        current = {'id': str(ObjectId()), 'role': 'superadmin'}
        with pytest.raises(HTTPException) as caught:
            await server.admin_set_driver_status(str(driver_id), body, current)
        assert caught.value.status_code == 409
        assert raw.users.find_one({'_id': driver_id})['approved'] is False
        assert raw.onboarding_email_outbox.count_documents({}) == 0
        operational = True
        result = await server.admin_set_driver_status(str(driver_id), body, current)
        assert result['ok'] is True
        assert raw.users.find_one({'_id': driver_id})['approved'] is True
        assert raw.onboarding_email_outbox.count_documents({'kind': 'driver-approved'}) == 1
        # Clicking approve a second time must not duplicate the notification.
        await server.admin_set_driver_status(str(driver_id), body, current)
        assert raw.onboarding_email_outbox.count_documents({'kind': 'driver-approved'}) == 1
    asyncio.run(check())


def test_fleet_setup_email_generates_private_one_time_link_only_at_delivery(state):
    from onboarding_emails import deliver_one
    raw, db, request = state
    delivered = []
    def mock_send(recipient, subject, body):
        delivered.append((recipient, subject, body))
        return True
    async def check():
        application = await submitted(state)
        result = await server.superadmin_approve_application(str(application['_id']), server.FleetApplicationDecisionRequest(), {'id': str(ObjectId())})
        raw.onboarding_email_outbox.delete_many({'kind': {'$ne': 'fleet-approved'}})
        before = raw.onboarding_email_outbox.find_one()
        assert before['status'] == 'pending'
        assert raw.password_reset_tokens.count_documents({}) == 0
        assert '/reset-password/' not in before['html']
        assert await deliver_one(db, mock_send, prepare_email=server._prepare_onboarding_email) is True
        assert len(delivered) == 1 and delivered[0][0] == application['contact_email']
        match = re.search(r'https://fleet\.snarapp\.no/reset-password/([A-Za-z0-9_-]+)', delivered[0][2])
        assert match, 'The delivered email must open the actual Fleet password setup page'
        token = match.group(1)
        saved = raw.password_reset_tokens.find_one()
        assert saved['token_hash'] == server._password_reset_token_hash(token)
        assert 'token' not in saved and saved['user_id'] == result['fleet_owner_user_id']
        assert await server.check_reset_token(token, request) == {'valid': True}
        job = raw.onboarding_email_outbox.find_one()
        assert job['status'] == 'sent' and token not in job['html']
        assert not any(token in str(record) for record in raw.password_reset_tokens.find())
        # The persisted job cannot deliver a second successful copy or mint another token.
        assert await deliver_one(db, mock_send, prepare_email=server._prepare_onboarding_email) is False
        assert raw.password_reset_tokens.count_documents({}) == 1
    asyncio.run(check())
