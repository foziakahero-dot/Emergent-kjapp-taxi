"""Actual settings schema/endpoint and push orchestration without external delivery."""
import ast
from pathlib import Path
from types import SimpleNamespace
from typing import Literal, Optional
import unittest
from unittest.mock import AsyncMock
from pydantic import BaseModel, ValidationError

SOURCE = ast.parse(Path(__file__).resolve().parents[1].joinpath('server.py').read_text())


def actual(names, context):
    nodes = []
    for node in SOURCE.body:
        name = getattr(node, 'name', None)
        if isinstance(node, ast.Assign):
            name = getattr(node.targets[0], 'id', None)
        if name in names:
            if isinstance(node, ast.AsyncFunctionDef):
                node = ast.parse(ast.unparse(node)).body[0]
                node.decorator_list = []
            nodes.append(node)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'actual-server-settings-notifications', 'exec'), context)
    return context


class SettingsContractTests(unittest.IsolatedAsyncioTestCase):
    def context(self):
        collection = SimpleNamespace(update_one=AsyncMock(), find_one=AsyncMock(return_value={'req_sound': False, '_id': 'internal'}))
        return actual({'SettingsUpdate', 'update_settings'}, {'Optional': Optional, 'Literal': Literal, 'BaseModel': BaseModel,
                      'Depends': lambda dependency: None, 'get_current_user': None, 'db': SimpleNamespace(settings=collection)}), collection

    async def test_false_driver_preference_survives_schema_and_is_written_only_for_authenticated_owner(self):
        ctx, collection = self.context()
        body = ctx['SettingsUpdate'](req_sound=False, req_vibrate=True, notif_requests=False, user_id='forged-user')
        result = await ctx['update_settings'](body, {'id': 'actual-owner'})
        scope, mutation = collection.update_one.call_args.args
        self.assertEqual(scope, {'user_id': 'actual-owner'})
        self.assertEqual(mutation, {'$set': {'notif_requests': False, 'req_sound': False, 'req_vibrate': True}})
        self.assertNotIn('_id', result)

    async def test_customer_preferences_still_serialize_false(self):
        ctx, collection = self.context()
        await ctx['update_settings'](ctx['SettingsUpdate'](notifications=False, trip_updates=False), {'id': 'customer'})
        self.assertEqual(collection.update_one.call_args.args[1], {'$set': {'notifications': False, 'trip_updates': False}})

    def test_invalid_navigation_is_rejected_before_write(self):
        ctx, _ = self.context()
        with self.assertRaises(ValidationError):
            ctx['SettingsUpdate'](navigation_app='untrusted-navigation')


class NotificationDeliveryTests(unittest.IsolatedAsyncioTestCase):
    def context(self, preferences=None, qa=False, fail=False):
        settings = SimpleNamespace(find_one=AsyncMock(side_effect=RuntimeError('database down') if fail else None, return_value=preferences))
        native = AsyncMock()
        vapid = SimpleNamespace(find_one=AsyncMock(return_value=None))
        ctx = actual({'_TRIP_NOTIFICATION_TAGS', '_OPTIONAL_NOTIFICATION_TAGS', '_notification_preference_allows', '_driver_offer_push_options', 'send_push_to_user'},
                     {'db': SimpleNamespace(settings=settings, vapid=vapid), 'APP_ENV': 'qa' if qa else 'production', 'PUSH_AVAILABLE': True,
                      'send_native_push': native})
        return ctx['send_push_to_user'], settings, native, vapid

    async def test_customer_opt_out_blocks_native_and_web_trip_update(self):
        send, settings, native, vapid = self.context({'notifications': False})
        await send('owner', 'Title', 'Body', tag='driver_assigned')
        settings.find_one.assert_awaited_once_with({'user_id': 'owner'})
        native.assert_not_awaited()
        vapid.find_one.assert_not_awaited()

    async def test_trip_update_opt_out_does_not_suppress_trip_messages(self):
        send, _, native, _ = self.context({'trip_updates': False})
        await send('owner', 'Title', 'Body', tag='trip_started')
        native.assert_not_awaited()
        await send('owner', 'Title', 'Body', tag='trip_message')
        self.assertEqual(native.await_count, 1)

    async def test_driver_offer_opt_out_is_independent_of_customer_switch(self):
        send, _, native, _ = self.context({'notifications': False, 'notif_requests': True})
        await send('driver', 'Title', 'Body', tag='kjapp-new-trip')
        self.assertEqual(native.await_count, 1)
        send, _, native, _ = self.context({'notif_requests': False})
        await send('driver', 'Title', 'Body', tag='kjapp-new-trip')
        native.assert_not_awaited()

    async def test_driver_offer_sound_and_vibration_choose_existing_native_channel(self):
        for preferences, sound, channel in [({}, 'default', 'kjapp_trips'), ({'req_sound': False}, None, 'kjapp_trips_vibrate'), ({'req_vibrate': False}, 'default', 'kjapp_trips_sound'), ({'req_sound': False, 'req_vibrate': False}, None, 'kjapp_trips_quiet')]:
            with self.subTest(preferences=preferences):
                send, _, native, _ = self.context(preferences)
                await send('driver', 'Title', 'Body', tag='kjapp-new-trip')
                self.assertEqual(native.call_args.kwargs, {'offer_options': {'sound': sound, 'channelId': channel}})

    async def test_missing_preferences_preserve_existing_delivery(self):
        send, _, native, vapid = self.context()
        await send('owner', 'Title', 'Body', tag='trip_payment_paid')
        self.assertEqual(native.await_count, 1)
        vapid.find_one.assert_awaited_once()

    async def test_identity_recheck_remains_delivered_even_when_optional_notifications_are_off(self):
        send, settings, native, _ = self.context({'notifications': False, 'notif_requests': False})
        await send('driver', 'Title', 'Body', tag='driver_identity_recheck')
        settings.find_one.assert_not_awaited()
        self.assertEqual(native.await_count, 1)

    async def test_qa_still_disables_all_external_delivery_before_preference_lookup(self):
        send, settings, native, vapid = self.context(qa=True)
        await send('owner', 'Title', 'Body', tag='trip_message')
        settings.find_one.assert_not_awaited()
        native.assert_not_awaited()
        vapid.find_one.assert_not_awaited()

    async def test_preference_read_failure_does_not_fail_a_committed_message_or_ride(self):
        send, _, native, vapid = self.context(fail=True)
        await send('owner', 'Title', 'Body', tag='trip_message')
        native.assert_not_awaited()
        vapid.find_one.assert_not_awaited()


class ExpoOfferPayloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_actual_expo_request_uses_silent_registered_android_channel_and_keeps_trip_data(self):
        post = AsyncMock()
        response = SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'data': [{'status': 'ok'}]})
        post.return_value = response

        class Client:
            def __init__(self, **kwargs):
                pass

            async def __aenter__(self):
                return SimpleNamespace(post=post)

            async def __aexit__(self, *args):
                pass

        ctx = actual({'_expo_send'}, {'httpx': SimpleNamespace(AsyncClient=Client), 'Optional': Optional})
        await ctx['_expo_send'](['ExpoPushToken[fixture]'], 'Offer', 'Body', {'url': '/driver', 'tag': 'kjapp-new-trip'},
                                delivery_options={'sound': None, 'channelId': 'kjapp_trips_quiet'})
        payload = post.call_args.kwargs['json'][0]
        self.assertIsNone(payload['sound'])
        self.assertEqual(payload['channelId'], 'kjapp_trips_quiet')
        self.assertEqual(payload['data'], {'url': '/driver', 'tag': 'kjapp-new-trip'})
        self.assertEqual(payload['priority'], 'high')

    async def test_native_dispatch_passes_offer_options_only_to_registered_owner_expo_tokens(self):
        class Tokens:
            def __init__(self):
                self.query = None

            def find(self, query, projection):
                self.query = query

                async def cursor():
                    yield {'token': 'ExpoPushToken[fixture]', 'provider': 'expo'}
                return cursor()

        tokens, expo = Tokens(), AsyncMock(return_value=[])
        ctx = actual({'_is_expo_push_token', 'send_native_push'}, {'db': SimpleNamespace(native_push_tokens=tokens),
                     'Optional': Optional, '_expo_send': expo})
        options = {'sound': None, 'channelId': 'kjapp_trips_vibrate'}
        await ctx['send_native_push']('actual-owner', 'Offer', 'Body', '/driver', 'kjapp-new-trip', offer_options=options)
        self.assertEqual(tokens.query, {'user_id': 'actual-owner'})
        self.assertEqual(expo.call_args.args[0], ['ExpoPushToken[fixture]'])
        self.assertEqual(expo.call_args.kwargs, {'delivery_options': options})


if __name__ == '__main__':
    unittest.main()
