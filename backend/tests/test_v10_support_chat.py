"""Execute the actual support/AI endpoints without provider calls or real tickets."""
import ast
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace, ModuleType
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch
from typing import Optional
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import support_answers
from ai_configuration import provider_chat_session

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail

def endpoints(key='fixture-key'):
    source = ast.parse(Path(__file__).resolve().parents[1].joinpath('server.py').read_text())
    nodes = []
    for node in source.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name in {
            'ai_chat', 'create_public_support_ticket', 'create_customer_support_case', '_owned_support_trip', 'admin_tickets',
        }:
            node.decorator_list = []
            nodes.append(node)
    chats = SimpleNamespace(insert_one=AsyncMock())
    tickets = SimpleNamespace(insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id='confirmed-ticket')),
                              update_one=AsyncMock())
    context = {'support_answers':support_answers, 'AI_LLM_KEY':key, 'AI_SYSTEM':'fixture-system', 'APP_ENV':'qa', 'provider_chat_session':provider_chat_session,
               'logging':logging, 'ChatRequest':object, 'PublicSupportRequest':object,
               'Request':object, 'Depends':lambda value:None, 'get_current_user':None, 'require_customer':None,
               'HTTPException':HTTPException, '_enforce_rate_limit':AsyncMock(),
               'db':SimpleNamespace(chat_messages=chats, support_tickets=tickets,
                                    trips=SimpleNamespace(find_one=AsyncMock(return_value=None))),
               '_real_trip_filter':lambda query:query,
               'datetime':datetime, 'timezone':timezone, 'asyncio':asyncio,
               'Optional':Optional, 'require_admin':None,
               '_page_params':lambda page,size:(page,size,(page-1)*size),
               '_paged':lambda rows,total,page,size,key:{key:rows,'total':total}}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'actual-support-chat-endpoints', 'exec'), context)
    return context, chats, tickets

class SupportChatTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, ctx, text=' Actual support question ', trip_id=None):
        return await ctx['ai_chat'](SimpleNamespace(message=text, session_id='support-session', trip_id=trip_id),
                                    None, {'id':'actual-user'})

    async def test_qa_missing_key_returns_clear_503_without_provider_or_chat_write(self):
        ctx,chats,_=endpoints('')
        with self.assertRaises(HTTPException) as error:
            await self.invoke(ctx)
        self.assertEqual(error.exception.status_code,503)
        self.assertIn('kundestøtte',error.exception.detail)
        chats.insert_one.assert_not_awaited()

    async def test_support_shortcuts_work_with_provider_disabled(self):
        ctx,chats,_=endpoints('')
        with patch.dict('os.environ', {'QA_AI_ENABLED':'false'}):
            for question, answer in support_answers.FAQ.items():
                result=await self.invoke(ctx,question.upper()+'?')
                self.assertEqual(result['reply'],answer)
        self.assertEqual(chats.insert_one.await_count,2*len(support_answers.FAQ))

    async def test_qa_gateway_never_uses_the_shared_provider_key(self):
        with patch.dict('os.environ', {'AI_GATEWAY_API_KEY':'shared'}, clear=True):
            self.assertEqual(support_answers.gateway_key('qa'),'')
            with patch.dict('os.environ', {'QA_AI_ENABLED':'true','QA_AI_GATEWAY_API_KEY':'dedicated'}):
                self.assertEqual(support_answers.gateway_key('qa'),'dedicated')

    async def test_free_text_goes_to_the_configured_qa_gateway(self):
        ctx,chats,_=endpoints('')
        with patch.dict('os.environ', {'QA_AI_ENABLED':'true','QA_AI_GATEWAY_API_KEY':'dedicated'}), patch.object(support_answers,'gateway_reply',new=AsyncMock(return_value='Svar på spørsmålet')) as gateway:
            result=await self.invoke(ctx)
        self.assertEqual(result['reply'],'Svar på spørsmålet')
        self.assertEqual(gateway.await_args.args[3:5],('actual-user','support-session'))
        self.assertEqual(chats.insert_one.await_count,2)

    async def test_gateway_request_uses_only_prior_turns_in_this_customers_session(self):
        collection=Mock()
        class History:
            async def __aiter__(self):
                for row in [{"role":"assistant","content":"Forrige svar"},{"role":"user","content":"Første spørsmål"}]:
                    yield row
        collection.find.return_value.sort.return_value.limit.return_value=History()
        client=AsyncMock()
        response=Mock()
        response.json.return_value={"choices":[{"message":{"content":"Nytt svar"}}]}
        client.post.return_value=response
        with patch.object(support_answers.httpx, "AsyncClient") as factory:
            factory.return_value.__aenter__.return_value=client
            reply=await support_answers.gateway_reply("qa-test","Regler",collection,"eier","økt",12,"Oppfølging")
        self.assertEqual(reply,"Nytt svar")
        self.assertEqual(collection.find.call_args.args[0],{"user_id":"eier","session_id":"økt","_id":{"$lt":12}})
        payload=client.post.await_args.kwargs["json"]
        self.assertEqual([msg["content"] for msg in payload["messages"]],["Regler","Første spørsmål","Forrige svar","Oppfølging"])

    async def test_openai_receives_sanitized_context_and_excludes_restricted_conversation(self):
        collection = Mock()

        class History:
            async def __aiter__(self):
                for row in [
                    {"role": "user", "content": "Sjåføren truet meg"},
                    {"role": "user", "content": "Kvittering til kunde@example.test"},
                ]:
                    yield row

        collection.find.return_value.sort.return_value.limit.return_value = History()
        client = AsyncMock()
        response = Mock()
        response.json.return_value = {
            "status": "completed", "output": [{"type": "message", "role": "assistant",
                                                "content": [{"type": "output_text", "text": "Svar"}]}],
        }
        client.post.return_value = response
        with patch.object(support_answers.httpx, "AsyncClient") as factory:
            factory.return_value.__aenter__.return_value = client
            reply = await support_answers.openai_reply(
                "fixture", "Regler", collection, "eier", "økt", 12, "Kvittering. Passord: testverdi",
            )
        self.assertEqual(reply, "Svar")
        args, kwargs = client.post.await_args
        self.assertEqual(args[0], "https://api.openai.com/v1/responses")
        self.assertFalse(kwargs["json"]["store"])
        self.assertEqual([row["content"] for row in kwargs["json"]["input"]],
                         ["Kvittering til [skjult]", "Kvittering. [skjult]"])
        self.assertEqual(collection.find.call_args.args[0], {"user_id": "eier", "session_id": "økt", "_id": {"$lt": 12}})

    async def test_critical_cases_go_to_admin_before_any_ai_call_and_are_retry_safe(self):
        ctx, chats, tickets = endpoints('')
        message = "Sjåføren truet meg. Kontakt kunde@example.test."
        with patch.object(support_answers, "openai_key", return_value="configured"), \
                patch.object(support_answers, "openai_reply", new_callable=AsyncMock) as provider:
            first = await self.invoke(ctx, message, "someone-elses-trip")
            second = await self.invoke(ctx, message, "someone-elses-trip")
            provider.assert_not_awaited()
        self.assertEqual(first["ticket_id"], second["ticket_id"])
        self.assertIn("112", first["reply"])
        case = tickets.update_one.await_args.args[1]["$setOnInsert"]
        self.assertEqual(case["priority"], "kritisk")
        self.assertEqual(case["created_by"], "actual-user")
        self.assertIsNone(case["trip_id"])
        self.assertNotIn("kunde@example.test", str(chats.insert_one.await_args_list))

    async def test_owned_trip_status_uses_the_server_lookup_without_accessing_ai(self):
        ctx, _, tickets = endpoints('')
        trips = ctx["db"].trips
        trips.find_one.return_value = {"trip_id": "my-trip", "status": "driver_on_way"}
        answer = await self.invoke(ctx, "Hvor er sjåføren?", "my-trip")
        self.assertEqual(answer["reply"], support_answers.TRIP_STATUS["driver_on_way"])
        self.assertEqual(trips.find_one.await_args.args[0], {"trip_id": "my-trip", "user_id": "actual-user"})
        case = await ctx['create_customer_support_case'](
            SimpleNamespace(message="Jeg trenger hjelp med turen", session_id="support-session", trip_id="my-trip"),
            None, {"id": "actual-user"},
        )
        self.assertTrue(case["ticket_id"])
        self.assertEqual(tickets.update_one.await_args.args[1]["$setOnInsert"]["trip_id"], "my-trip")

    async def test_restricted_topic_does_not_go_to_the_provider(self):
        ctx, _, _ = endpoints('')
        with patch.object(support_answers, "openai_key", return_value="configured"), \
                patch.object(support_answers, "openai_reply", new_callable=AsyncMock) as provider:
            result = await self.invoke(ctx, "Hvor mye får sjåføren i lønn?")
            self.assertEqual(result["reply"], support_answers.SCOPE_REPLY)
            provider.assert_not_awaited()

    async def test_blank_or_oversized_message_rejected_before_provider_or_write(self):
        for text in ['   ','x'*4001]:
            ctx,chats,_=endpoints()
            with self.assertRaises(HTTPException) as error:
                await self.invoke(ctx,text)
            self.assertEqual(error.exception.status_code,400)
            chats.insert_one.assert_not_awaited()

    def provider(self, reply='Confirmed provider reply', construction_error=None):
        chat=SimpleNamespace(send_message=AsyncMock(return_value=reply))
        factory=Mock(side_effect=construction_error,return_value=SimpleNamespace(with_model=Mock(return_value=chat)))
        module=ModuleType('emergentintegrations.llm.chat')
        module.LlmChat=factory
        module.UserMessage=lambda **values:SimpleNamespace(**values)
        return module,chat

    async def test_constructor_failure_is_handled_as_502(self):
        ctx,chats,_=endpoints();module,_=self.provider(construction_error=RuntimeError('fixture-provider-init'))
        with patch.dict(sys.modules,{'emergentintegrations.llm.chat':module}):
            with self.assertRaises(HTTPException) as error:
                await self.invoke(ctx)
        self.assertEqual(error.exception.status_code,502)
        self.assertEqual(chats.insert_one.await_count,1)

    async def test_empty_provider_reply_is_not_success_or_stored_as_assistant(self):
        ctx,chats,_=endpoints();module,_=self.provider(reply='  ')
        with patch.dict(sys.modules,{'emergentintegrations.llm.chat':module}):
            with self.assertRaises(HTTPException) as error:
                await self.invoke(ctx)
        self.assertEqual(error.exception.status_code,502)
        self.assertEqual(chats.insert_one.await_count,1)

    async def test_confirmed_provider_reply_and_trimmed_user_message_are_stored_under_owner(self):
        ctx,chats,_=endpoints();module,chat=self.provider()
        with patch.dict(sys.modules,{'emergentintegrations.llm.chat':module}):
            response=await self.invoke(ctx)
        self.assertEqual(response,{'reply':'Confirmed provider reply','session_id':'support-session'})
        self.assertEqual(chat.send_message.call_args.args[0].text,'Actual support question')
        rows=[call.args[0] for call in chats.insert_one.call_args_list]
        self.assertEqual([row['role'] for row in rows],['user','assistant'])
        self.assertTrue(all(row['user_id']=='actual-user' for row in rows))

    async def test_provider_timeout_is_visible_504(self):
        ctx,_,_=endpoints();module,chat=self.provider()
        chat.send_message.side_effect=asyncio.TimeoutError()
        with patch.dict(sys.modules,{'emergentintegrations.llm.chat':module}):
            with self.assertRaises(HTTPException) as error:
                await self.invoke(ctx)
        self.assertEqual(error.exception.status_code,504)

    async def test_human_ticket_intake_works_without_ai_key_and_returns_actual_id(self):
        ctx,_,tickets=endpoints('')
        response=await ctx['create_public_support_ticket'](SimpleNamespace(topic='annet',name='QA customer',contact='qa@example.test',message='Actual issue description'),None)
        self.assertEqual(response,{'ok':True,'ticket_id':'confirmed-ticket'})
        self.assertEqual(tickets.insert_one.call_args.args[0]['message'],'Actual issue description')
        self.assertEqual(tickets.insert_one.call_args.args[0]['body'],'Actual issue description')
        self.assertEqual(tickets.insert_one.call_args.args[0]['contact_email'],'qa@example.test')

    async def test_admin_reads_existing_public_ticket_body_and_contact_without_migration(self):
        ctx,_,tickets=endpoints('')
        rows=[{'_id':'existing-public-ticket','message':'Customer support issue','contact':'qa@example.test','name':'QA Customer'},
              {'_id':'canonical-ticket','body':'Canonical issue','contact_email':'other@example.test','message':'Old text','contact':'old@example.test'}]
        class Cursor:
            def sort(self,*args): return self
            def skip(self,*args): return self
            def limit(self,*args): return self
            def __aiter__(self): self.items=iter(rows); return self
            async def __anext__(self):
                try: return dict(next(self.items))
                except StopIteration: raise StopAsyncIteration
        tickets.count_documents=AsyncMock(return_value=2)
        tickets.find=Mock(return_value=Cursor())
        response=await ctx['admin_tickets'](status='open',category=None,current={'id':'admin'})
        first,second=response['tickets']
        self.assertEqual(first['body'],'Customer support issue')
        self.assertEqual(first['contact_email'],'qa@example.test')
        self.assertEqual(first['contact_name'],'QA Customer')
        self.assertEqual(first['id'],'existing-public-ticket')
        self.assertNotIn('_id',first)
        self.assertEqual(second['body'],'Canonical issue')
        self.assertEqual(second['contact_email'],'other@example.test')

if __name__=='__main__':
    unittest.main()
