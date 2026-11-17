import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import './AiChat.css';

const API = import.meta.env.VITE_API_BASE_URL;

// Example questions shown as clickable chips, different for every role.
const SUGGESTIONS = {
  customer: [
    'What is your return policy?',
    'Show me kitchen products under $200',
    'Where are my orders?',
  ],
  product_owner: [
    'How are my sales in the last 30 days?',
    'Which of my products are low on stock?',
    'What are the rules for listing products?',
  ],
  root_admin: [
    'Give me a sales summary for the last 30 days',
    'What is the refund approval limit?',
    'Which products are low on stock?',
  ],
};

// Read a Server-Sent-Events response: "event: x\ndata: {...}\n\n"
async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      const event = (part.match(/^event: (.*)$/m) || [])[1];
      const data = (part.match(/^data: (.*)$/m) || [])[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

const TOOL_LABELS = {
  search_knowledge_base: 'Reading policy documents...',
  search_products: 'Searching products...',
  get_product_details: 'Looking up the product...',
  get_my_orders: 'Checking your orders...',
  get_order_status: 'Checking the order...',
  get_sales_insights: 'Analysing sales data...',
  get_low_stock_items: 'Checking stock levels...',
  place_order: 'Preparing your order...',
  cancel_order: 'Preparing the cancellation...',
  update_stock: 'Preparing the stock change...',
};

const AiChat = () => {
  useLocation(); // re-render on navigation so login/logout is noticed
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [setup, setSetup] = useState(null); // result of /api/ai/status
  const [conversationId, setConversationId] = useState(sessionStorage.getItem('aiConversationId'));
  const bottomRef = useRef(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (open && token && !setup) {
      axios.get(`${API}/api/ai/status`, auth).then((r) => setSetup(r.data)).catch(() => setSetup({ enabled: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, statusText]);

  // A different user logged in? Start a fresh chat.
  useEffect(() => {
    if (!token) { setMessages([]); setConversationId(null); sessionStorage.removeItem('aiConversationId'); }
  }, [token]);

  if (!token || !user) return null;

  const addMessage = (m) => setMessages((prev) => [...prev, m]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    addMessage({ role: 'user', text: message });
    setBusy(true);
    setStatusText('Thinking...');

    try {
      const response = await fetch(`${API}/api/ai/chat?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, conversationId }),
      });
      if (response.status === 401) throw new Error('Please log in again.');
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await response.json();
        throw new Error(data.reply || data.message || 'Something went wrong.');
      }

      await readEventStream(response, (event, data) => {
        if (event === 'status') setStatusText(data.message);
        if (event === 'tool') setStatusText(TOOL_LABELS[data.name] || 'Working...');
        if (event === 'final') {
          if (data.blocked) addMessage({ role: 'blocked', text: data.reply, stage: data.stage });
          else if (data.error) addMessage({ role: 'error', text: data.reply });
          else {
            if (data.conversationId) {
              setConversationId(data.conversationId);
              sessionStorage.setItem('aiConversationId', data.conversationId);
            }
            addMessage({
              role: 'assistant', text: data.reply, sources: data.sources || [],
              pending: (data.pendingActions || []).map((p) => ({ ...p, state: 'waiting' })),
              masked: (data.guardrails?.piiMasked || []).map((p) => p.type),
            });
          }
        }
      });
    } catch (err) {
      addMessage({ role: 'error', text: err.message || 'Could not reach the assistant.' });
    } finally {
      setBusy(false);
      setStatusText('');
    }
  };

  // The user presses Confirm or Cancel on a prepared action.
  const decide = async (messageIndex, actionId, decision) => {
    const update = (state, note) => setMessages((prev) => prev.map((m, i) => (i !== messageIndex ? m : {
      ...m, pending: m.pending.map((p) => (p.actionId === actionId ? { ...p, state, note } : p)),
    })));
    update('working');
    try {
      const res = await axios.post(`${API}/api/ai/confirm`, { actionId, decision }, auth);
      update(res.data.status === 'executed' ? 'done' : 'cancelled', res.data.message);
    } catch (err) {
      update('failed', err.response?.data?.message || 'Could not complete the action.');
    }
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    sessionStorage.removeItem('aiConversationId');
  };

  const suggestions = SUGGESTIONS[user.role] || SUGGESTIONS.customer;

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Open AI assistant">
          <span aria-hidden="true">✦</span> Ask AI
        </button>
      )}

      {open && (
        <section className="ai-panel" aria-label="AI assistant">
          <header className="ai-header">
            <div>
              <strong>Marketplace Assistant</strong>
              <small>{user.role.replace('_', ' ')} access</small>
            </div>
            <div>
              <button className="ai-icon-btn" onClick={newChat} title="Start a new chat">New</button>
              <button className="ai-icon-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </header>

          <div className="ai-messages">
            {setup && (!setup.enabled || !setup.configured) && (
              <div className="ai-notice">
                {!setup.enabled ? 'The AI assistant is switched off.' : 'The assistant is not configured yet: an administrator must add LLM_API_KEY to the backend.'}
              </div>
            )}
            {setup && setup.enabled && setup.knowledgeChunks === 0 && (
              <div className="ai-notice">Policy documents are not indexed yet. Run <code>npm run ai:ingest</code> in the backend.</div>
            )}

            {messages.length === 0 && (
              <div className="ai-welcome">
                <p>Hi {user.name.split(' ')[0]}! I can answer policy questions, find products and help with orders.</p>
                <div className="ai-chips">
                  {suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-${m.role}`}>
                {m.role === 'blocked' && <div className="ai-tag">Blocked by security filter</div>}
                <div className="ai-text">{m.text}</div>

                {m.masked?.length > 0 && (
                  <div className="ai-meta">Private data hidden from the AI: {m.masked.join(', ')}</div>
                )}
                {m.sources?.length > 0 && (
                  <div className="ai-sources">{m.sources.map((s) => <span key={s}>{s}</span>)}</div>
                )}

                {m.pending?.map((p) => (
                  <div key={p.actionId} className={`ai-action ai-action-${p.state}`}>
                    <div className="ai-action-title">Action waiting for your approval</div>
                    <div>{p.summary}</div>
                    {p.state === 'waiting' && (
                      <div className="ai-action-buttons">
                        <button className="btn-success" onClick={() => decide(i, p.actionId, 'confirm')}>Confirm</button>
                        <button className="btn-secondary" onClick={() => decide(i, p.actionId, 'cancel')}>Cancel</button>
                      </div>
                    )}
                    {p.state === 'working' && <div className="ai-meta">Working...</div>}
                    {p.state === 'done' && <div className="ai-result-ok">✓ {p.note}</div>}
                    {p.state === 'cancelled' && <div className="ai-meta">Cancelled. Nothing was changed.</div>}
                    {p.state === 'failed' && <div className="ai-result-bad">{p.note}</div>}
                  </div>
                ))}
              </div>
            ))}

            {busy && <div className="ai-status">{statusText}</div>}
            <div ref={bottomRef} />
          </div>

          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, products or policies..."
              maxLength={2000}
              disabled={busy}
              aria-label="Your message"
            />
            <button className="btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
          </form>
          <footer className="ai-footer">AI can make mistakes. Never share card numbers or passwords here.</footer>
        </section>
      )}
    </>
  );
};

export default AiChat;
