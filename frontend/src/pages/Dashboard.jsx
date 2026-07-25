import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [messages, setMessages] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, table, ai
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());

  // Message compose modal
  const [isComposing, setIsComposing] = useState(false);
  const [msgBody, setMsgBody] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  useEffect(() => {
    if (!user || (user.role !== 'root_admin' && user.role !== 'product_owner')) {
      navigate('/');
    } else {
      fetchInitialData();
      const interval = setInterval(pollUpdates, 7000 + Math.random() * 1000); // ~7s + jitter
      return () => clearInterval(interval);
    }
  }, [user, navigate]);

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const fetchInitialData = async () => {
    try {
      const msgRes = await axios.get('http://localhost:5000/api/messaging', getHeaders());
      setMessages(msgRes.data);
      setLastPoll(new Date().toISOString());

      const stockRes = await axios.get('http://localhost:5000/api/inventory/low-stock', getHeaders());
      setLowStock(stockRes.data);

      const analyticsRes = await axios.get('http://localhost:5000/api/analytics', getHeaders());
      setAnalytics(analyticsRes.data);

      if (user.role === 'root_admin') {
        const aiRes = await axios.get('http://localhost:5000/api/analytics/ai-summary', getHeaders());
        setAiSummary(aiRes.data.summary);
      }

      const usersRes = await axios.get('http://localhost:5000/api/auth/users', getHeaders());
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const pollUpdates = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/dashboard/updates?since=${lastPoll}`, getHeaders());
      if (res.data.newMessages && res.data.newMessages.length > 0) {
        setMessages(prev => [...res.data.newMessages, ...prev]);
      }
      setLastPoll(res.data.timestamp);
    } catch (err) {
      console.error('Polling error', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      if (selectedRecipients.length === 0) {
        alert('Please select at least one recipient.');
        return;
      }
      await axios.post('http://localhost:5000/api/messaging', { recipients: selectedRecipients, body: msgBody }, getHeaders());
      setIsComposing(false);
      setMsgBody('');
      setSelectedRecipients([]);
      alert('Message sent');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>Dashboard ({user?.role})</h2>
      
      {/* Top Panels */}
      <div style={{ display: 'flex', gap: '20px', height: '300px' }}>
        
        {/* Messages Panel */}
        <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3>Messages</h3>
            <button className="btn-primary" onClick={() => setIsComposing(true)}>Send Message</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {messages.length === 0 ? <p>No messages.</p> : messages.map(msg => (
              <div key={msg._id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                <strong>From: {msg.senderId === 'system' ? 'System' : 'User'}</strong>
                <span style={{ float: 'right', fontSize: '12px', color: '#888' }}>{new Date(msg.createdAt).toLocaleString()}</span>
                <p style={{ margin: '5px 0' }}>{msg.body}</p>
                {msg.metadata?.type === 'low_stock' && <span style={{ color: 'var(--error)', fontSize: '12px' }}>[Low Stock Alert]</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Low Inventory Panel */}
        <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
          <h3>Low Inventory Alerts</h3>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
            {lowStock.length === 0 ? <p>No low stock products.</p> : lowStock.map(p => (
              <div key={p._id} style={{ marginBottom: '10px', color: 'var(--error)' }}>
                <strong>{p.name}</strong> - Stock: {p.stock} (Threshold: {p.lowStockThreshold})
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
          <button style={tabStyle(activeTab === 'analytics')} onClick={() => setActiveTab('analytics')}>Analytics (Charts)</button>
          <button style={tabStyle(activeTab === 'table')} onClick={() => setActiveTab('table')}>Tabular View</button>
          {user?.role === 'root_admin' && (
            <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>AI Analytics</button>
          )}
        </div>

        {/* Tab Content */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {activeTab === 'analytics' && (
            <div>
              <h3>Daily Sales Chart</h3>
              <div style={{ height: '350px', marginBottom: '40px', marginTop: '20px' }}>
                {analytics?.dailySales ? (
                  <Line 
                    data={{
                      labels: analytics.dailySales.map(d => d._id),
                      datasets: [
                        {
                          label: 'Sales Revenue ($)',
                          data: analytics.dailySales.map(d => d.totalSales),
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99,102,241,0.25)',
                          fill: true,
                          tension: 0.4
                        }
                      ]
                    }} 
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                  />
                ) : <p>No data</p>}
              </div>

              <h3>Orders per Location</h3>
              <div style={{ height: '300px', marginBottom: '20px', marginTop: '20px' }}>
                {analytics?.deliveryPlace ? (
                  <Bar 
                    data={{
                      labels: analytics.deliveryPlace.map(d => d._id || 'Unknown'),
                      datasets: [
                        {
                          label: 'Total Orders',
                          data: analytics.deliveryPlace.map(d => d.totalOrders),
                          backgroundColor: '#10b981',
                        }
                      ]
                    }} 
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                  />
                ) : <p>No data</p>}
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <div>
              <h3>Daily Sales Table</h3>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '40px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px' }}>Date</th>
                    <th style={{ padding: '10px' }}>Orders</th>
                    <th style={{ padding: '10px' }}>Sales Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.dailySales?.map(d => (
                    <tr key={d._id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{d._id}</td>
                      <td style={{ padding: '10px' }}>{d.totalOrders}</td>
                      <td style={{ padding: '10px' }}>${d.totalSales.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Top Delivery Locations</h3>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px' }}>City</th>
                    <th style={{ padding: '10px' }}>Total Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.deliveryPlace?.map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{d._id || 'Unknown'}</td>
                      <td style={{ padding: '10px' }}>{d.totalOrders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'ai' && user?.role === 'root_admin' && (
            <div>
              <h3>AI Summary</h3>
              <p style={{ lineHeight: '1.6' }}>{aiSummary || 'Loading AI summary...'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal (Blurred Background) */}
      {isComposing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '400px' }}>
            <h3>Send Message</h3>
            <form onSubmit={handleSendMessage}>
              <div style={{ marginBottom: '15px' }}>
                <label>Select Recipients:</label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                  {allUsers.map(u => (
                    <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input 
                        type="checkbox" 
                        id={`user_${u._id}`}
                        checked={selectedRecipients.includes(u._id)}
                        onChange={() => {
                          setSelectedRecipients(prev => 
                            prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id]
                          );
                        }}
                      />
                      <label htmlFor={`user_${u._id}`} style={{ margin: 0, fontWeight: 'normal', color: '#333' }}>{u.name} ({u.role})</label>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label>Message:</label>
                <textarea rows="4" value={msgBody} onChange={e => setMsgBody(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsComposing(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const tabStyle = (isActive) => ({
  padding: '10px 20px',
  cursor: 'pointer',
  backgroundColor: isActive ? '#fff' : 'transparent',
  border: 'none',
  borderBottom: isActive ? '2px solid var(--accent)' : 'none',
  fontWeight: isActive ? 'bold' : 'normal',
  fontSize: '16px'
});

export default Dashboard;
