"""Execute the actual support/AI endpoints without provider calls or real tickets."""
import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace, ModuleType
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch
from typing import Optional

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail

def endpoints(key='fixture-key'):
    source = ast.parse(Path(__file__).resolve().parents[1].joinpath('server.py').read_text())
    nodes = []
    for node in source.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name in {'ai_chat', 'create_public_support_ticket', 'admin_tickets'}:
            node.decorator_list = []
            nodes.append(node)
    chats = SimpleNamespace(insert_one=AsyncMock())
    tickets = SimpleNamespace(insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id='confirmed-ticket')))
    context = {'AI_LLM_KEY':key, 'AI_SYSTEM':'fixture-system', 'ChatRequest':object, 'PublicSupportRequest':object,
               'Request':object, 'Depends':lambda value:None, 'get_current_user':None,
               'HTTPException':HTTPException, '_enforce_rate_limit':AsyncMock(),
               'db':SimpleNamespace(chat_messages=chats, support_tickets=tickets),
               'datetime':datetime, 'timezone':timezone, 'asyncio':asyncio,
               'Optional':Optional, 'require_admin':None,
               '_page_params':lambda page,size:(page,size,(page-1)*size),
               '_paged':lambda rows,total,page,size,key:{key:rows,'total':total}}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'actual-support-chat-endpoints', 'exec'), context)
    return context, chats, tickets

class SupportChatTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, ctx, text=' Actual support question '):
        return await ctx['ai_chat'](SimpleNamespace(message=text,session_id='support-session'),None,{'id':'actual-user'})

    async def test_qa_missing_key_returns_clear_503_without_provider_or_chat_write(self):
        ctx,chats,_=endpoints('')
        with self.assertRaises(HTTPException) as error:
            await self.invoke(ctx)
        self.assertEqual(error.exception.status_code,503)
        self.assertIn('kundestøtte',error.exception.detail)
        chats.insert_one.assert_not_awaited()

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
