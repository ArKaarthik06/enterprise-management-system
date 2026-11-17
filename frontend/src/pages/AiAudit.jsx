import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../components/AiChat.css';

const API = import.meta.env.VITE_API_BASE_URL;

// Small horizontal bar list, e.g. "injection ▇▇▇▇ 5"
const BarList = ({ items, labelKey, empty }) => {
  if (!items.length) return <div className="ai-meta">{empty}</div>;
  const max = Math.max(...items.map((i) => i.count));
  return items.map((i) => (
    <div className="aiaudit-row" key={i[labelKey]}>
      <span style={{ width: 130 }}>{i[labelKey]}</span>
      <div className="bar" style={{ width: `${Math.max(6, (i.count / max) * 100)}px` }} />
      <b>{i.count}</b>
    </div>
  ));
};

// Admin-only page: what is the AI doing, what was blocked, and is prompt caching saving money?
const AiAudit = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ai/audit?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the audit data.');
    }
  }, [days, token]);

  useEffect(() => {
    if (!token || user?.role !== 'root_admin') return navigate('/');
    load();
  }, [load, navigate, token, user?.role]);

  const reindex = async () => {
    setIngesting(true);
    setIngestMsg('');
    try {
      const res = await axios.post(`${API}/api/ai/ingest`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIngestMsg(`Indexed ${res.data.documents} documents into ${res.data.chunks} chunks (${res.data.provider} embeddings).`);
    } catch (err) {
      setIngestMsg(err.response?.data?.message || 'Indexing failed.');
    } finally {
      setIngesting(false);
    }
  };

  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!data) return <p>Loading...</p>;

  const pct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="aiaudit">
      <h1>AI Assistant Audit</h1>
      <p className="aiaudit-sub">
        Security and cost overview of the AI layer.{' '}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>{' '}
        <button className="btn-secondary" onClick={reindex} disabled={ingesting}>
          {ingesting ? 'Indexing...' : 'Re-index policy documents'}
        </button>{' '}
        <span className="ai-meta">{ingestMsg}</span>
      </p>

      <div className="aiaudit-stats">
        <div className="aiaudit-stat"><b>{data.requests}</b><span>Requests</span></div>
        <div className="aiaudit-stat"><b>{data.blocked}</b><span>Blocked by guardrails</span></div>
        <div className="aiaudit-stat"><b>{pct(data.cacheHitRate)}</b><span>Input tokens served from prompt cache</span></div>
        <div className="aiaudit-stat"><b>{(data.tokens.input + data.tokens.cacheRead + data.tokens.cacheCreation).toLocaleString()}</b><span>Input tokens (total)</span></div>
        <div className="aiaudit-stat"><b>{data.tokens.output.toLocaleString()}</b><span>Output tokens</span></div>
        <div className="aiaudit-stat"><b>{data.avgLatencyMs} ms</b><span>Average response time</span></div>
      </div>

      <div className="aiaudit-grid">
        <div className="aiaudit-card"><h3>Blocked, by guardrail stage</h3><BarList items={data.blockedByStage} labelKey="stage" empty="Nothing blocked." /></div>
        <div className="aiaudit-card"><h3>Tool usage</h3><BarList items={data.toolUsage.map((t) => ({ ...t, stage: t.tool }))} labelKey="stage" empty="No tools used yet." /></div>
        <div className="aiaudit-card"><h3>Private data masked</h3><BarList items={data.piiMasked} labelKey="type" empty="No private data detected." /></div>
      </div>

      <h3 style={{ marginBottom: 8 }}>Recent requests</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="aiaudit-table">
          <thead><tr><th>When</th><th>User</th><th>Message (masked)</th><th>Result</th><th>Tools</th><th>ms</th></tr></thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleString()}</td>
                <td>{r.user || '-'}<br /><small>{r.role}</small></td>
                <td style={{ maxWidth: 320 }}>{r.input}</td>
                <td>
                  <span className={`pill ${r.outcome === 'allowed' ? 'pill-ok' : 'pill-bad'}`}>{r.outcome}</span>
                  {r.stage && <><br /><small>{r.stage}: {r.reason}</small></>}
                </td>
                <td>{r.tools.join(', ')}</td>
                <td>{r.latencyMs}</td>
              </tr>
            ))}
            {data.recent.length === 0 && <tr><td colSpan="6">No AI activity in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AiAudit;
