import ast
import secrets
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import mongomock
from bson import ObjectId
from fastapi import HTTPException
from test_fleet_invitation_delivery import Collection


class ManualFleetOnboardingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.raw = mongomock.MongoClient().db
        self.queued = []
        async def confirmation(*args):
            self.queued.append(args)
            return 'not_configured'
        async def audit(*args): pass
        self.namespace = {
            'db': SimpleNamespace(users=Collection(self.raw.users), fleets=Collection(self.raw.fleets)),
            'FleetCreateRequest': object, 'Depends': lambda _: None, 'require_admin': None,
            'HTTPException': HTTPException, 'secrets': secrets, 'datetime': datetime,
            'timezone': timezone, 'ObjectId': ObjectId, 'stripe': SimpleNamespace(api_key=None),
            'hash_password': lambda _: 'hashed-generated-password',
            'queue_confirmation': confirmation, '_audit': audit,
        }
        tree = ast.parse((Path(__file__).parents[1] / 'server.py').read_text())
        function = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == 'admin_create_fleet')
        function.decorator_list = []
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'server.py', 'exec'), self.namespace)
        self.body = SimpleNamespace(name='Ahmad Transport QA', org_number='',
                                    owner_email='Owner@Example.no', commission_rate=0.10)

    async def test_manual_creation_queues_durable_setup_without_legacy_raw_reset_token(self):
        result = await self.namespace['admin_create_fleet'](self.body, {'id': 'admin'})
        assert result['confirmation_email_status'] == 'not_configured'
        assert result['onboarding_email_sent'] is False
        owner = self.raw.users.find_one({'email': 'owner@example.no'})
        assert owner['role'] == 'fleet_owner' and owner['fleet_id'] == result['id']
        assert owner['must_reset_password'] is True
        assert self.queued[0][1:4] == ('fleet-approved', result['id'], 'owner@example.no')
        assert self.raw.password_reset_tokens.count_documents({}) == 0

    async def test_existing_customer_keeps_password_and_gets_setup_email(self):
        self.raw.users.insert_one({'email': 'owner@example.no', 'role': 'user', 'password_hash': 'existing'})
        await self.namespace['admin_create_fleet'](self.body, {'id': 'admin'})
        assert self.raw.users.find_one()['password_hash'] == 'existing'
        assert len(self.queued) == 1

    async def test_privileged_disabled_or_already_linked_accounts_are_not_reassigned(self):
        for details in [{'role': 'superadmin'}, {'role': 'driver'}, {'role': 'user', 'disabled': True},
                        {'role': 'fleet_owner', 'fleet_id': 'existing-fleet'}]:
            self.raw.users.delete_many({})
            self.raw.users.insert_one({'email': 'owner@example.no', **details})
            with self.assertRaises(HTTPException) as error:
                await self.namespace['admin_create_fleet'](self.body, {'id': 'admin'})
            assert error.exception.status_code == 409
            assert self.raw.fleets.count_documents({}) == 0
