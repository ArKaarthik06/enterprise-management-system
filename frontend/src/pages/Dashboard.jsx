import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  const [sentimentReport, setSentimentReport] = useState(null); // { summary, negativeProducts }
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, table, ai, sentiment, approval
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());

  // Analytics Filters
  const [analyticsFilters, setAnalyticsFilters] = useState({
    startDate: '',
    endDate: '',
    category: 'all',
    interval: 'day'
  });
  
  // Orders Table State
  const [ordersData, setOrdersData] = useState({ orders: [], total: 0, page: 1, pages: 1 });

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
      const msgRes = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/messaging', getHeaders());
      setMessages(msgRes.data);
      setLastPoll(new Date().toISOString());

      const stockRes = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/inventory/low-stock', getHeaders());
      setLowStock(stockRes.data);

      fetchAnalyticsData();
      fetchOrdersData(1);

      if (user.role === 'root_admin') {
        const aiRes = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/analytics/ai-summary', getHeaders());
        setAiSummary(aiRes.data.summary);
      }

      const usersRes = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/auth/users', getHeaders());
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const { startDate, endDate, category, interval } = analyticsFilters;
      let query = `?interval=${interval}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      if (category !== 'all') query += `&category=${category}`;
      
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/analytics${query}`, getHeaders());
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  };

  const fetchOrdersData = async (page = 1) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/analytics/orders?page=${page}&limit=10`, getHeaders());
      setOrdersData(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    if (user && (user.role === 'root_admin' || user.role === 'product_owner')) {
      fetchAnalyticsData();
    }
  }, [analyticsFilters]);

  const pollUpdates = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/updates?since=${lastPoll}`, getHeaders());
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
      await axios.post(import.meta.env.VITE_API_BASE_URL + '/api/messaging', { recipients: selectedRecipients, body: msgBody }, getHeaders());
      setIsComposing(false);
      setMsgBody('');
      setSelectedRecipients([]);
      alert('Message sent');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    }
  };

  const handleApprove = async (ownerId) => {
    try {
      await axios.post(import.meta.env.VITE_API_BASE_URL + '/api/auth/approve-owner', { ownerId }, getHeaders());
      alert('Approved successfully!');
      // Refresh user list
      const usersRes = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/auth/users', getHeaders());
      setAllUsers(usersRes.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
  };

  const fetchSentimentReport = async () => {
    setSentimentLoading(true);
    try {
      const res = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/analytics/sentiment-report', getHeaders());
      setSentimentReport(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate sentiment report');
    } finally {
      setSentimentLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Dashboard ({user?.role})</h2>
        {user?.role === 'product_owner' && (
          <button className="btn-primary" onClick={() => navigate('/products')}>Manage Products</button>
        )}
      </div>
      
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
                <strong>From: {msg.senderId === 'system' ? 'System' : (allUsers.find(u => u._id === msg.senderId)?.name || 'User')}</strong>
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
            <>
              <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>AI Analytics</button>
              <button style={tabStyle(activeTab === 'sentiment')} onClick={() => setActiveTab('sentiment')}>Sentiment Analysis</button>
              <button style={tabStyle(activeTab === 'approval')} onClick={() => setActiveTab('approval')}>Pending Approvals</button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {activeTab === 'analytics' && (
            <div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Start Date</label>
                  <input type="date" value={analyticsFilters.startDate} onChange={e => setAnalyticsFilters(prev => ({...prev, startDate: e.target.value}))} style={{ padding: '5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>End Date</label>
                  <input type="date" value={analyticsFilters.endDate} onChange={e => setAnalyticsFilters(prev => ({...prev, endDate: e.target.value}))} style={{ padding: '5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Category</label>
                  <select value={analyticsFilters.category} onChange={e => setAnalyticsFilters(prev => ({...prev, category: e.target.value}))} style={{ padding: '5px' }}>
                    <option value="all">All</option>
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="home">Home</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Interval</label>
                  <select value={analyticsFilters.interval} onChange={e => setAnalyticsFilters(prev => ({...prev, interval: e.target.value}))} style={{ padding: '5px' }}>
                    <option value="day">Daily</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
              </div>

              <h3>Sales Trend</h3>
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
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                ) : <p>No data</p>}
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <h3>Orders per Location</h3>
                  <div style={{ height: '300px', marginTop: '20px' }}>
                    {analytics?.deliveryPlace ? (
                      <Bar 
                        data={{
                          labels: analytics.deliveryPlace.map(d => d._id || 'Unknown'),
                          datasets: [{
                            label: 'Total Orders',
                            data: analytics.deliveryPlace.map(d => d.totalOrders),
                            backgroundColor: '#10b981',
                          }]
                        }} 
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    ) : <p>No data</p>}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h3>Sales by Category</h3>
                  <div style={{ height: '300px', marginTop: '20px' }}>
                    {analytics?.categorySales ? (
                      <Pie 
                        data={{
                          labels: analytics.categorySales.map(d => d._id),
                          datasets: [{
                            data: analytics.categorySales.map(d => d.totalSales),
                            backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    ) : <p>No data</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Orders</h3>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    if (ordersData.orders.length === 0) return alert('No data to export');
                    const headers = ['Order ID', 'Date', 'Buyer', 'Status', 'Location', 'Products', 'Categories', 'Total Items', 'Total Amount'];
                    const rows = ordersData.orders.map(o => {
                      const totalItems = o.items.reduce((sum, item) => sum + item.quantity, 0);
                      const totalAmt = o.items.reduce((sum, item) => sum + (item.quantity * item.priceAtPurchase), 0);
                      const products = o.items.map(i => i.productId?.name || 'Unknown').join('; ');
                      const categories = [...new Set(o.items.map(i => i.productId?.category || 'Unknown'))].join('; ');
                      return [
                        o._id,
                        new Date(o.createdAt).toLocaleDateString(),
                        o.buyerId?.name || 'Unknown',
                        o.status,
                        o.deliveryAddress?.city || 'Unknown',
                        `"${products}"`,
                        `"${categories}"`,
                        totalItems,
                        totalAmt.toFixed(2)
                      ];
                    });
                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                >
                  Export to CSV
                </button>
              </div>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '10px' }}>Order ID</th>
                    <th style={{ padding: '10px' }}>Date</th>
                    <th style={{ padding: '10px' }}>Buyer</th>
                    <th style={{ padding: '10px' }}>Products</th>
                    <th style={{ padding: '10px' }}>Categories</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px' }}>Location</th>
                    <th style={{ padding: '10px' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersData.orders.map(o => {
                    const totalItems = o.items.reduce((sum, item) => sum + item.quantity, 0);
                    const total = o.items.reduce((sum, item) => sum + (item.quantity * item.priceAtPurchase), 0);
                    const products = o.items.map(i => i.productId?.name || 'Unknown').join(', ');
                    const categories = [...new Set(o.items.map(i => i.productId?.category || 'Unknown'))].join(', ');

                    return (
                      <tr key={o._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px', fontSize: '0.85rem' }}>{o._id.substring(o._id.length - 8)}</td>
                        <td style={{ padding: '10px' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '10px' }}>{o.buyerId?.name || 'Unknown'}</td>
                        <td style={{ padding: '10px', fontSize: '0.9rem' }}>{products} <br/><small>({totalItems} items)</small></td>
                        <td style={{ padding: '10px', fontSize: '0.9rem' }}>{categories}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', backgroundColor: o.status === 'confirmed' ? '#d1fae5' : o.status === 'delivered' ? '#bfdbfe' : '#fee2e2', color: o.status === 'confirmed' ? '#065f46' : o.status === 'delivered' ? '#1e3a8a' : '#991b1b' }}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>{o.deliveryAddress?.city || 'Unknown'}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>${total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn-secondary" disabled={ordersData.page === 1} onClick={() => fetchOrdersData(ordersData.page - 1)}>Previous</button>
                <span>Page {ordersData.page} of {ordersData.pages}</span>
                <button className="btn-secondary" disabled={ordersData.page === ordersData.pages} onClick={() => fetchOrdersData(ordersData.page + 1)}>Next</button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && user?.role === 'root_admin' && (
            <div>
              <h3>AI Summary</h3>
              <p style={{ lineHeight: '1.6' }}>{aiSummary || 'Loading AI summary...'}</p>
            </div>
          )}

          {activeTab === 'sentiment' && user?.role === 'root_admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Review Sentiment Analysis</h3>
                <button
                  className="btn-primary"
                  onClick={fetchSentimentReport}
                  disabled={sentimentLoading}
                  style={{ minWidth: '160px' }}
                >
                  {sentimentLoading ? 'Analyzing...' : '🔍 Generate Report'}
                </button>
              </div>

              {sentimentLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <p style={{ fontSize: '1.1rem' }}>Analyzing all product reviews with AI...</p>
                  <p style={{ fontSize: '0.9rem' }}>This may take a few seconds.</p>
                </div>
              )}

              {sentimentReport && !sentimentLoading && (
                <div>
                  {/* Overall summary */}
                  <div style={{ padding: '15px', backgroundColor: '#f0f9ff', borderLeft: '4px solid #3b82f6', borderRadius: '4px', marginBottom: '20px' }}>
                    <strong>Overall Summary:</strong>
                    <p style={{ margin: '8px 0 0 0', lineHeight: '1.6' }}>{sentimentReport.summary}</p>
                  </div>

                  {/* Flagged products */}
                  <h4 style={{ marginBottom: '10px' }}>
                    ⚠️ Flagged Products ({sentimentReport.negativeProducts?.length || 0})
                  </h4>

                  {(!sentimentReport.negativeProducts || sentimentReport.negativeProducts.length === 0) ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '8px', color: '#166534' }}>
                      ✅ No products flagged with negative sentiment. All products are performing well!
                    </div>
                  ) : (
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: '#fef2f2' }}>
                          <th style={{ padding: '12px' }}>Product</th>
                          <th style={{ padding: '12px' }}>Category</th>
                          <th style={{ padding: '12px' }}>Avg Rating</th>
                          <th style={{ padding: '12px' }}>Reviews</th>
                          <th style={{ padding: '12px' }}>Reason Flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sentimentReport.negativeProducts.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.productName}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '0.85rem' }}>
                                {p.category}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                backgroundColor: p.avgRating < 2 ? '#fee2e2' : p.avgRating < 3 ? '#fef3c7' : '#fef9c3',
                                color: p.avgRating < 2 ? '#991b1b' : p.avgRating < 3 ? '#92400e' : '#854d0e'
                              }}>
                                {'★'.repeat(Math.round(p.avgRating))}{'☆'.repeat(5 - Math.round(p.avgRating))} {p.avgRating}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>{p.reviewCount}</td>
                            <td style={{ padding: '12px', fontSize: '0.9rem', color: '#dc2626', maxWidth: '300px' }}>
                              {p.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {!sentimentReport && !sentimentLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <p>Click <strong>"Generate Report"</strong> to analyze all product reviews using AI.</p>
                  <p style={{ fontSize: '0.9rem' }}>The report will flag products with negative or mixed sentiment.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'approval' && user?.role === 'root_admin' && (
            <div>
              <h3>Pending Product Owners</h3>
              {allUsers.filter(u => u.role === 'product_owner' && u.status === 'pending').length === 0 ? (
                <p>No pending approvals.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {allUsers.filter(u => u.role === 'product_owner' && u.status === 'pending').map(u => (
                    <div key={u._id} style={{ border: '1px solid var(--border-color)', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 5px 0' }}>{u.name} ({u.email})</h4>
                      <p style={{ margin: '0 0 5px 0', fontSize: '0.95rem' }}><strong>Business:</strong> {u.businessName || 'N/A'}</p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>{u.businessDescription || 'No description provided.'}</p>
                      <button className="btn-primary" onClick={() => handleApprove(u._id)}>Approve</button>
                    </div>
                  ))}
                </div>
              )}
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
                  {allUsers.filter(u => u._id !== user.id).map(u => (
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
