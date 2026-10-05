"""Execute production invite handlers with an isolated Mongo-compatible database.

No real email, production account, storage upload or network request is performed.
Run: python -m unittest discover -s backend/tests -p test_fleet_invitation_delivery.py -v
"""
import ast
import asyncio
import html
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Optional, List, Literal
from unittest.mock import Mock, patch

import mongomock
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field


class Cursor:
    def __init__(self, cursor): self.cursor = cursor
    def sort(self, *args): self.cursor.sort(*args); return self
    def limit(self, *args): self.cursor.limit(*args); return self
    def __aiter__(self): return self
    async def __anext__(self):
        try: return next(self.cursor)
        except StopIteration: raise StopAsyncIteration


class Collection:
    def __init__(self, collection): self.collection = collection
    def find(self, *args): return Cursor(self.collection.find(*args))
    def __getattr__(self, name):
        async def call(*args, **kwargs): return getattr(self.collection, name)(*args, **kwargs)
        return call


class InviteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = patch.dict(os.environ, {"SENDGRID_API_KEY": "", "KJAPP_FLEET_URL": "https://fleet.kjappapp.no"})
        self.env.start(); self.addCleanup(self.env.stop)
        raw = mongomock.MongoClient().db
        self.raw = raw
        self.db = SimpleNamespace(**{n: Collection(raw[n]) for n in ('users', 'fleets', 'fleet_vehicles', 'driver_invites', 'uploaded_files')})
        async def rate(*args): pass
        self.mail = Mock(return_value=False)
        self.ns = dict(asyncio=asyncio, os=os, secrets=secrets, html_escape=html,
                       datetime=datetime, timezone=timezone, timedelta=timedelta,
                       ObjectId=ObjectId, InvalidId=InvalidId, HTTPException=HTTPException,
                       Request=Request, Response=Response, BaseModel=BaseModel,
                       Field=Field, EmailStr=EmailStr, Optional=Optional, List=List, Literal=Literal,
                       SpecialNeed=str, CURRENT_LEGAL_VERSION='2026-09',
                       Depends=lambda _: None, require_fleet_owner=None, require_admin=None,
                       db=self.db, send_email=self.mail, _enforce_rate_limit=rate,
                       hash_password=lambda _: 'test-hash', create_access_token=lambda *a:'test-token',
                       set_auth_cookie=lambda *a: None)
        names = {'DriverInviteRequest','DriverSignupRequest','_invite_expired','email_driver_invite_html',
                 '_driver_invite_url','_driver_invite_result','_deliver_driver_invite',
                 'fleet_create_driver_invite','fleet_list_driver_invites','fleet_resend_driver_invite',
                 'get_driver_invite','accept_driver_invite','admin_list_pending_drivers','user_public'}
        tree = ast.parse((Path(__file__).parents[1] / 'server.py').read_text())
        nodes = []
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(isinstance(t,ast.Name) and t.id == 'USER_RESPONSE_FIELDS' for t in node.targets): nodes.append(node)
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) and node.name in names:
                node.decorator_list=[]; nodes.append(node)
        exec(compile(ast.Module(body=nodes,type_ignores=[]), 'server.py', 'exec'), self.ns)
        self.owner_id, self.fleet_id, self.vehicle_id = ObjectId(), ObjectId(), ObjectId()
        raw.users.insert_one({'_id':self.owner_id,'fleet_id':str(self.fleet_id),'role':'fleet_owner'})
        raw.fleets.insert_one({'_id':self.fleet_id,'name':'Test Fleet','active':True})
        raw.fleet_vehicles.insert_one({'_id':self.vehicle_id,'fleet_id':str(self.fleet_id),'car':'Test car','plate':'TEST01','active':True})
        self.current={'id':str(self.owner_id),'role':'fleet_owner'}
        self.request=Request({'type':'http','headers':[(b'origin',b'https://wrong.example'),(b'referer',b'https://wrong.example/sjaforer')]})

    async def create(self):
        return await self.ns['fleet_create_driver_invite'](self.ns['DriverInviteRequest'](vehicle_id=str(self.vehicle_id),email='driver@example.com'),self.request,self.current)

    async def test_missing_email_configuration_returns_actionable_link(self):
        result=await self.create()
        self.assertEqual(result['email_status'],'not_configured')
        self.assertFalse(result['email_sent'])
        self.assertTrue(result['invite_url'].startswith('https://fleet.kjappapp.no/driver-signup/'))
        self.assertEqual(result['fleet_id'],str(self.fleet_id))
        listing=await self.ns['fleet_list_driver_invites'](self.current)
        self.assertEqual(listing['invites'][0]['invite_url'],result['invite_url'])

    async def test_delivery_success_and_provider_failure(self):
        os.environ['SENDGRID_API_KEY']='test-placeholder'
        self.mail.return_value=True
        result=await self.create()
        self.assertEqual(result['email_status'],'sent')
        self.assertIn(result['invite_url'],self.mail.call_args.args[2])
        self.mail.return_value=False
        result=await self.ns['fleet_resend_driver_invite'](result['token'],self.request,self.current)
        self.assertEqual(result['email_status'],'failed')
        self.assertFalse(self.raw.driver_invites.find_one()['email_sent'])

    async def test_resend_cannot_cross_fleet_boundary(self):
        result=await self.create(); other=ObjectId()
        self.raw.users.insert_one({'_id':other,'fleet_id':str(ObjectId())})
        with self.assertRaises(HTTPException) as caught:
            await self.ns['fleet_resend_driver_invite'](result['token'],self.request,{'id':str(other)})
        self.assertEqual(caught.exception.status_code,404)
        self.assertEqual(self.mail.call_count,1)

    async def test_uploaded_documents_reach_admin_pending_with_fleet(self):
        invite=await self.create()
        public=await self.ns['get_driver_invite'](invite['token'])
        self.assertEqual(public['fleet_name'],'Test Fleet')
        self.assertEqual(public['email'],'driver@example.com')
        data=dict(token=invite['token'],fullName='Test Driver',email='driver@example.com',phone='+4799999999',password='test-password',accepted_terms=True)
        for kind in ['drivers_license','taxi_license','profile_photo']:
            path='test/'+kind
            self.raw.uploaded_files.insert_one({'storage_path':path,'invite_token':invite['token'],'doc_type':kind,'scope':'driver-docs','owner_user_id':None})
            data[kind+'_path']=path
        result=await self.ns['accept_driver_invite'](self.ns['DriverSignupRequest'](**data),self.request,Response())
        self.assertTrue(result['pending_approval'])
        pending=await self.ns['admin_list_pending_drivers']()
        self.assertEqual(len(pending['drivers']),1)
        driver=pending['drivers'][0]
        self.assertEqual(driver['fleet_id'],str(self.fleet_id))
        self.assertFalse(driver['approved']); self.assertFalse(driver['online'])
        self.assertEqual(driver['phone'],'+4799999999')
        self.assertEqual(self.raw.uploaded_files.count_documents({'owner_user_id':result['user']['id']}),3)
        self.assertEqual(driver['drivers_license_path'],'test/drivers_license')
        with self.assertRaises(HTTPException) as caught: await self.ns['get_driver_invite'](invite['token'])
        self.assertEqual(caught.exception.status_code,410)

    async def test_expired_invite_cannot_be_resent(self):
        invite=await self.create()
        self.raw.driver_invites.update_one({'token':invite['token']},{'$set':{'expires_at':'2020-01-01T00:00:00+00:00'}})
        with self.assertRaises(HTTPException) as caught: await self.ns['fleet_resend_driver_invite'](invite['token'],self.request,self.current)
        self.assertEqual(caught.exception.status_code,410)

    def test_email_escapes_owner_supplied_markup(self):
        rendered=self.ns['email_driver_invite_html']('<script>','TEST','https://fleet.kjappapp.no/driver-signup/test','<img src=x>')
        self.assertNotIn('<script>',rendered);self.assertNotIn('<img src=x>',rendered)


if __name__ == '__main__': unittest.main()
