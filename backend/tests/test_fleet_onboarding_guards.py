"""Real public onboarding/password handlers against isolated database adapters."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import jwt
import pytest
from bson import ObjectId
from fastapi import HTTPException, Response
from test_partner_approval import state, server, submitted


def draft_body(org='923609016'):
    return server.FleetApplicationDraftRequest(company_name='Fixture Fleet', org_number=org,
        contact_name='Fixture Owner', contact_email='fixture@example.com', contact_phone='+4791234567',
        license_count=1, vehicle_count=1, bank_account='NO9386011117947', accepted_terms=True)


def test_existing_pending_or_registered_company_cannot_open_duplicate(state):
    raw, _, request = state
    async def run():
        await submitted(state)
        with pytest.raises(HTTPException) as error:
            await server.create_fleet_application_draft(draft_body('923 609 016'), request)
        assert error.value.status_code == 409
        raw.fleet_applications.delete_many({})
        raw.fleets.insert_one({'org_number': '923.609.016'})
        with pytest.raises(HTTPException) as error:
            await server.create_fleet_application_draft(draft_body(), request)
        assert error.value.status_code == 409
    asyncio.run(run())


def test_parallel_drafts_for_same_company_only_submit_one_application(state, monkeypatch):
    raw, _, request = state
    async def run():
        bodies=[]
        for _ in range(2):
            draft=await server.create_fleet_application_draft(draft_body(), request)
            token=draft['upload_token'];docs={}
            for kind in ('firmaattest','loyvebevis','vognkort','forsikring','bank'):
                path=f'application/{token}/{kind}'
                raw.uploaded_files.insert_one({'storage_path':path,'application_token':token,'scope':'fleet-applications'})
                docs[kind]={'path':path}
            bodies.append(server.FleetApplicationSubmitRequest(upload_token=token,documents=docs))
        original=server._ensure_no_duplicate_fleet_application
        arrivals=0; ready=asyncio.Event()
        async def simultaneous(*args, **kwargs):
            nonlocal arrivals
            await original(*args, **kwargs)
            arrivals+=1
            if arrivals<=2:
                if arrivals==2:ready.set()
                await ready.wait()
        monkeypatch.setattr(server,'_ensure_no_duplicate_fleet_application',simultaneous)
        results=await asyncio.gather(*(server.submit_fleet_application(body,request) for body in bodies),return_exceptions=True)
        assert sum(isinstance(result,dict) for result in results)==1
        rejected=next(result for result in results if isinstance(result,HTTPException))
        assert rejected.status_code==409
        assert raw.fleet_applications.count_documents({'status':'pending'})==1
        assert raw.rate_limit_buckets.count_documents({})==0
    asyncio.run(run())


def test_authenticated_password_change_revokes_old_tokens_without_email(state):
    raw, _, request=state;uid=ObjectId()
    raw.users.insert_one({'_id':uid,'email':'fixture@example.com','role':'fleet_owner',
        'password_hash':server.hash_password('old-fixture-password'),'must_reset_password':True})
    old=server.create_access_token(str(uid),'fixture@example.com')
    response=Response()
    result=asyncio.run(server.change_password(server.ChangePasswordRequest(current_password='old-fixture-password',
        new_password='new-fixture-password'),request,response,{'id':str(uid)}))
    user=raw.users.find_one({'_id':uid})
    assert server.verify_password('new-fixture-password',user['password_hash'])
    assert 'must_reset_password' not in user
    decode=lambda token:jwt.decode(token,server.JWT_SECRET,algorithms=[server.JWT_ALGORITHM])
    assert server._session_is_current(decode(old),user) is False
    assert server._session_is_current(decode(result['token']),user) is True
    assert 'access_token=' in response.headers['set-cookie']
    assert raw.onboarding_email_outbox.count_documents({})==0


def test_wrong_current_password_never_changes_credentials_or_session_cutoff(state):
    raw, _, request=state;uid=ObjectId();hashed=server.hash_password('correct-fixture-password')
    raw.users.insert_one({'_id':uid,'password_hash':hashed,'must_reset_password':True})
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.change_password(server.ChangePasswordRequest(current_password='incorrect',
            new_password='new-fixture-password'),request,Response(),{'id':str(uid)}))
    assert error.value.status_code==400
    user=raw.users.find_one({'_id':uid})
    assert user['password_hash']==hashed and user['must_reset_password'] is True
    assert 'tokens_valid_after' not in user
