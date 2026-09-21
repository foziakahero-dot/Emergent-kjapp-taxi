import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, apiError } from './api';

type Message = {
  id?: string;
  message_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  file_paths?: string[];
};

type Conversation = { conversation_id: string; title: string; updated_at: string };

const fencedCode = /```[\w-]*\n?([\s\S]*?)```/g;

function codeFromMessage(content: string) {
  return [...content.matchAll(fencedCode)].map((match) => match[1].trim()).filter(Boolean).join('\n\n');
}

function MessageBody({ content, onCopyCode }: { content: string; onCopyCode: (code: string) => void }) {
  const parts = content.split(fencedCode);
  if (!content.includes('```')) return <div className="ai-message-text">{content}</div>;
  return (
    <div className="ai-message-text">
      {parts.map((part, index) => {
        if (index % 2 === 0) return <span key={index}>{part}</span>;
        return (
          <div className="ai-code-block" key={index}>
            <div className="ai-code-head"><span>Kode</span><button className="btn sm ghost" onClick={() => onCopyCode(part.trim())}>Kopier</button></div>
            <pre><code>{part.trim()}</code></pre>
          </div>
        );
      })}
    </div>
  );
}

export default function AIAssistant() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('byteplus');
  const [providers, setProviders] = useState<string[]>(['byteplus', 'openai', 'anthropic']);
  const [files, setFiles] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [versions, setVersions] = useState({ production: 'ukjent', staging: 'ukjent' });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentTitle = useMemo(() => conversations.find((c) => c.conversation_id === conversationId)?.title || 'Ny KJAPP-samtale', [conversations, conversationId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [bootstrap, history, projectFiles] = await Promise.all([api.aiBootstrap(), api.aiConversations(), api.aiFiles()]);
        if (!active) return;
        setProvider(bootstrap.provider || 'byteplus');
        setProviders(bootstrap.providers || providers);
        setVersions({ production: bootstrap.production_version || 'ukjent', staging: bootstrap.staging_version || 'ukjent' });
        setFiles(projectFiles.files || []);
        setConversations(history.conversations || []);
        const first = history.conversations?.[0];
        if (first) setConversationId(first.conversation_id);
        else {
          const created = await api.createAIConversation();
          if (!active) return;
          setConversations([created]);
          setConversationId(created.conversation_id);
        }
      } catch (e) {
        if (active) setError(apiError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setMessages([]);
    api.getAIConversation(conversationId).then((data) => {
      if (active) setMessages(data.messages || []);
    }).catch((e) => { if (active) setError(apiError(e)); });
    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice('Kopiert til utklippstavlen.'); }
    catch { setNotice('Kunne ikke kopiere i denne nettleseren.'); }
    window.setTimeout(() => setNotice(''), 2500);
  };

  const newConversation = async () => {
    try {
      const created = await api.createAIConversation();
      setConversations((items) => [created, ...items]);
      setConversationId(created.conversation_id);
      setAttached([]);
      setError('');
      inputRef.current?.focus();
    } catch (e) { setError(apiError(e)); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !conversationId) return;
    setError('');
    setInput('');
    setSending(true);
    const optimistic: Message = { role: 'user', content: text, file_paths: attached };
    setMessages((items) => [...items, optimistic]);
    const selectedFiles = attached;
    setAttached([]);
    try {
      const data = await api.sendAIMessage(conversationId, { message: text, provider, file_paths: selectedFiles });
      setMessages((items) => [...items, data.message]);
      setConversations((items) => items.map((item) => item.conversation_id === conversationId ? { ...item, title: text.slice(0, 80), updated_at: new Date().toISOString() } : item));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const requestChange = async (message: Message) => {
    const request = window.prompt('Hva skal endres i KJAPP?', 'Lag en konkret endringsforespørsel basert på denne meldingen.');
    if (!request?.trim()) return;
    try {
      await api.createAIChangeRequest({ conversation_id: conversationId, message_id: message.message_id || message.id || '', request });
      setNotice('Endringsforespørselen er lagret i admin-køen.');
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <div className="center"><div className="spinner" /></div>;

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-head">
        <div>
          <div className="page-title">🤖 AI Assistent</div>
          <div className="page-sub">Superadmin · {currentTitle}</div>
        </div>
        <div className="ai-head-actions">
          <label className="ai-provider">Leverandør
            <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={sending}>
              {providers.map((item) => <option key={item} value={item}>{item === 'byteplus' ? 'BytePlus' : item === 'openai' ? 'OpenAI GPT-4o' : 'Anthropic Claude'}</option>)}
            </select>
          </label>
          <button className="btn" onClick={newConversation}>＋ Ny samtale</button>
        </div>
      </div>
      <div className="ai-meta"><span>Produksjon: <strong>{versions.production}</strong></span><span>Staging: <strong>{versions.staging}</strong></span><span className="dim">Kontekst KJAPP v1</span></div>
      <div className="ai-workspace">
        <aside className="ai-conversations">
          <div className="ai-side-title">Samtaler</div>
          {conversations.map((item) => <button key={item.conversation_id} className={`ai-conversation ${item.conversation_id === conversationId ? 'active' : ''}`} onClick={() => setConversationId(item.conversation_id)}>{item.title || 'Ny samtale'}</button>)}
        </aside>
        <section className="ai-chat" aria-label="KJAPP AI Assistent">
          <div className="ai-messages" ref={scrollRef}>
            {!messages.length && <div className="ai-empty"><div className="ai-empty-icon">🤖</div><h2>KJAPP AI Assistent</h2><p>Spør om kode, feil eller konkrete endringer i KJAPP-systemet.</p></div>}
            {messages.map((message, index) => <article className={`ai-message ${message.role}`} key={message.message_id || message.id || `${message.role}-${index}`}>
              <div className="ai-message-avatar">{message.role === 'user' ? 'SA' : 'AI'}</div>
              <div className="ai-message-main">
                <div className="ai-message-meta"><strong>{message.role === 'user' ? 'Du' : 'CodeX'}</strong><span>{message.created_at ? new Date(message.created_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                <MessageBody content={message.content} onCopyCode={copy} />
                {message.file_paths?.length ? <div className="ai-file-tags">Vedlegg: {message.file_paths.join(', ')}</div> : null}
                <div className="ai-message-actions">
                  <button className="btn sm ghost" onClick={() => copy(codeFromMessage(message.content) || message.content)}>Kopier all kode</button>
                  <button className="btn sm ghost" onClick={() => requestChange(message)}>Lag endringsforespørsel</button>
                </div>
              </div>
            </article>)}
            {sending && <div className="ai-typing"><span /><span /><span /> CodeX skriver…</div>}
          </div>
          {error && <div className="error-banner ai-error" role="alert">{error}</div>}
          {notice && <div className="ok-banner ai-notice" role="status">{notice}</div>}
          <div className="ai-composer">
            {attached.length > 0 && <div className="ai-attached">{attached.map((file) => <button key={file} className="ai-file-chip" onClick={() => setAttached((items) => items.filter((item) => item !== file))}>{file} ×</button>)}</div>}
            <div className="ai-compose-row">
              <textarea ref={inputRef} className="textarea ai-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Skriv til CodeX om KJAPP…" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={sending} />
              <button className="btn primary ai-send" onClick={send} disabled={sending || !input.trim()}>{sending ? '…' : 'Send'}</button>
            </div>
            <div className="ai-compose-footer"><label className="ai-file-select">＋ Legg ved prosjektfil<select value="" onChange={(e) => { if (e.target.value && !attached.includes(e.target.value)) setAttached((items) => [...items, e.target.value]); }}><option value="">Velg fil…</option>{files.map((file) => <option key={file} value={file}>{file}</option>)}</select></label><span className="dim">Enter sender · Shift+Enter gir ny linje</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
