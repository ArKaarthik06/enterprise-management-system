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
import './Dashboard.css';

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

const STATUS_CLASS = {
  confirmed: 'dash-status-confirmed',
  delivered: 'dash-status-delivered',
  shipped: 'dash-status-shipped',
  pending: 'dash-status-pending',
  cancelled: 'dash-status-cancelled',
  failed: 'dash-status-failed',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [messages, setMessages] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [sentimentReport, setSentimentReport] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
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
      const interval = setInterval(pollUpdates, 7000 + Math.random() * 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (user && (user.role === 'root_admin' || user.role === 'product_owner')) {
      fetchAnalyticsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleExportCsv = () => {
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
  };

  // Derived KPI metrics from loaded data
  const totalRevenue = analytics?.dailySales
    ? analytics.dailySales.reduce((sum, d) => sum + (d.totalSales || 0), 0)
    : 0;
  const totalOrdersCount = ordersData?.total || 0;
  const pendingApprovalsCount = allUsers.filter(u => u.role === 'product_owner' && u.status === 'pending').length;

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } }
    },
    scales: {
      x: { ticks: { maxTicksLimit: 7, maxRotation: 45, font: { size: 11 } } },
      y: { ticks: { font: { size: 11 }, callback: (v) => `$${v}` } }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { ticks: { font: { size: 11 }, maxRotation: 40 } },
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } }
    }
  };

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dash-header">
        <div className="dash-title-group">
          <h2>Dashboard</h2>
          {user?.role && (
            <span className="dash-role-badge">{user.role.replace('_', ' ')}</span>
          )}
        </div>
        {user?.role === 'product_owner' && (
          <button className="btn-primary" onClick={() => navigate('/products')}>
            Manage Products
          </button>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Filtered Revenue</span>
          <span className="dash-kpi-value">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="dash-kpi-sub">Confirmed & delivered</span>
        </div>
        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Total Orders</span>
          <span className="dash-kpi-value">{totalOrdersCount}</span>
          <span className="dash-kpi-sub">All statuses</span>
        </div>
        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Low Stock Alerts</span>
          <span className={`dash-kpi-value ${lowStock.length > 0 ? 'alert' : ''}`}>{lowStock.length}</span>
          <span className="dash-kpi-sub">Needs restocking</span>
        </div>
        <div className="dash-kpi-card">
          <span className="dash-kpi-label">Messages</span>
          <span className="dash-kpi-value">{messages.length}</span>
          <span className="dash-kpi-sub">Inbox notifications</span>
        </div>
      </div>

      {/* Top Panels */}
      <div className="dash-panels-grid">
        {/* Messages Panel */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Messages</h3>
            <button className="btn-primary btn-sm" onClick={() => setIsComposing(true)}>
              Send Message
            </button>
          </div>
          <div className="dash-panel-body">
            {messages.length === 0 ? (
              <p className="dash-empty-text">No messages yet.</p>
            ) : (
              messages.map(msg => (
                <div key={msg._id} className="dash-msg-item">
                  <div className="dash-msg-top">
                    <span className="dash-msg-sender">
                      From: {msg.senderId === 'system' ? 'System' : (allUsers.find(u => u._id === msg.senderId)?.name || 'User')}
                    </span>
                    <span className="dash-msg-time">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="dash-msg-body">{msg.body}</p>
                  {msg.metadata?.type === 'low_stock' && (
                    <span className="dash-msg-tag">Low Stock Alert</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Inventory Panel */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Low Inventory Alerts</h3>
          </div>
          <div className="dash-panel-body">
            {lowStock.length === 0 ? (
              <p className="dash-empty-text">All products are well stocked.</p>
            ) : (
              lowStock.map(p => (
                <div key={p._id} className="dash-stock-item">
                  <span className="dash-stock-name">{p.name}</span>
                  <span className="dash-stock-pill">
                    {p.stock} left / min {p.lowStockThreshold}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs-section">
        <div className="dash-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'analytics'}
            className={`dash-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics (Charts)
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'table'}
            className={`dash-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Tabular View
          </button>
          {user?.role === 'root_admin' && (
            <>
              <button
                role="tab"
                aria-selected={activeTab === 'ai'}
                className={`dash-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai')}
              >
                AI Analytics
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'sentiment'}
                className={`dash-tab-btn ${activeTab === 'sentiment' ? 'active' : ''}`}
                onClick={() => setActiveTab('sentiment')}
              >
                Sentiment Analysis
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'approval'}
                className={`dash-tab-btn ${activeTab === 'approval' ? 'active' : ''}`}
                onClick={() => setActiveTab('approval')}
              >
                Pending Approvals {pendingApprovalsCount > 0 ? `(${pendingApprovalsCount})` : ''}
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div className="dash-content-card">
          {activeTab === 'analytics' && (
            <div>
              <div className="dash-filters">
                <div className="dash-filter-field">
                  <label htmlFor="filter-start">Start Date</label>
                  <input
                    id="filter-start"
                    type="date"
                    value={analyticsFilters.startDate}
                    onChange={e => setAnalyticsFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="dash-filter-field">
                  <label htmlFor="filter-end">End Date</label>
                  <input
                    id="filter-end"
                    type="date"
                    value={analyticsFilters.endDate}
                    onChange={e => setAnalyticsFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="dash-filter-field">
                  <label htmlFor="filter-category">Category</label>
                  <select
                    id="filter-category"
                    value={analyticsFilters.category}
                    onChange={e => setAnalyticsFilters(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="all">All Categories</option>
                    <option value="Household">Household</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Fashion">Fashion</option>
                  </select>
                </div>
                <div className="dash-filter-field">
                  <label htmlFor="filter-interval">Interval</label>
                  <select
                    id="filter-interval"
                    value={analyticsFilters.interval}
                    onChange={e => setAnalyticsFilters(prev => ({ ...prev, interval: e.target.value }))}
                  >
                    <option value="day">Daily</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="dash-chart-card dash-chart-primary">
                <h3 className="dash-section-title">Sales Trend</h3>
                <div className="dash-chart-box">
                  {analytics?.dailySales && analytics.dailySales.length > 0 ? (
                    <Line
                      data={{
                        labels: analytics.dailySales.map(d => d._id),
                        datasets: [
                          {
                            label: 'Sales Revenue ($)',
                            data: analytics.dailySales.map(d => d.totalSales),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99,102,241,0.2)',
                            fill: true,
                            tension: 0.35
                          }
                        ]
                      }}
                      options={lineOptions}
                    />
                  ) : (
                    <p className="dash-empty-text">No sales trend data for the selected filters.</p>
                  )}
                </div>
              </div>

              <div className="dash-charts-row">
                <div className="dash-chart-card">
                  <h3 className="dash-section-title">Orders per Location</h3>
                  <div className="dash-chart-box-sm">
                    {analytics?.deliveryPlace && analytics.deliveryPlace.length > 0 ? (
                      <Bar
                        data={{
                          labels: analytics.deliveryPlace.map(d => d._id || 'Unknown'),
                          datasets: [{
                            label: 'Total Orders',
                            data: analytics.deliveryPlace.map(d => d.totalOrders),
                            backgroundColor: '#10b981',
                            borderRadius: 6
                          }]
                        }}
                        options={barOptions}
                      />
                    ) : (
                      <p className="dash-empty-text">No location data available.</p>
                    )}
                  </div>
                </div>

                <div className="dash-chart-card">
                  <h3 className="dash-section-title">Sales by Category</h3>
                  <div className="dash-chart-box-sm">
                    {analytics?.categorySales && analytics.categorySales.length > 0 ? (
                      <Pie
                        data={{
                          labels: analytics.categorySales.map(d => d._id),
                          datasets: [{
                            data: analytics.categorySales.map(d => d.totalSales),
                            backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                          }]
                        }}
                        options={pieOptions}
                      />
                    ) : (
                      <p className="dash-empty-text">No category breakdown available.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <div>
              <div className="dash-section-header">
                <h3>Orders ({ordersData.total})</h3>
                <button className="btn-primary btn-sm" onClick={handleExportCsv}>
                  Export to CSV
                </button>
              </div>

              {/* Desktop / Tablet Table */}
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Buyer</th>
                      <th>Products</th>
                      <th>Categories</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersData.orders.map(o => {
                      const totalItems = o.items.reduce((sum, item) => sum + item.quantity, 0);
                      const total = o.items.reduce((sum, item) => sum + (item.quantity * item.priceAtPurchase), 0);
                      const products = o.items.map(i => i.productId?.name || 'Unknown').join(', ');
                      const categories = [...new Set(o.items.map(i => i.productId?.category || 'Unknown'))].join(', ');

                      return (
                        <tr key={o._id}>
                          <td style={{ fontFamily: 'monospace' }}>{o._id.substring(o._id.length - 8)}</td>
                          <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                          <td>{o.buyerId?.name || 'Unknown'}</td>
                          <td>{products} <br /><small style={{ color: 'var(--text-muted)' }}>({totalItems} items)</small></td>
                          <td>{categories}</td>
                          <td>
                            <span className={`dash-status-pill ${STATUS_CLASS[o.status] || 'dash-status-pending'}`}>
                              {o.status}
                            </span>
                          </td>
                          <td>{o.deliveryAddress?.city || 'Unknown'}</td>
                          <td style={{ fontWeight: 700 }}>${total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="dash-mobile-list">
                {ordersData.orders.map(o => {
                  const totalItems = o.items.reduce((sum, item) => sum + item.quantity, 0);
                  const total = o.items.reduce((sum, item) => sum + (item.quantity * item.priceAtPurchase), 0);
                  const products = o.items.map(i => i.productId?.name || 'Unknown').join(', ');
                  const categories = [...new Set(o.items.map(i => i.productId?.category || 'Unknown'))].join(', ');

                  return (
                    <div key={o._id} className="dash-order-card">
                      <div className="dash-order-card-top">
                        <span className="dash-order-id">#{o._id.substring(o._id.length - 8)}</span>
                        <span className={`dash-status-pill ${STATUS_CLASS[o.status] || 'dash-status-pending'}`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="dash-order-meta">
                        <span>👤 {o.buyerId?.name || 'Unknown'}</span>
                        <span>📅 {new Date(o.createdAt).toLocaleDateString()}</span>
                        <span>📍 {o.deliveryAddress?.city || 'Unknown'}</span>
                      </div>
                      <div className="dash-order-products">
                        {products} <span style={{ color: 'var(--text-muted)' }}>({totalItems} items)</span>
                      </div>
                      <div className="dash-order-card-bottom">
                        <span style={{ color: 'var(--text-secondary)' }}>{categories}</span>
                        <span className="dash-order-total">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="dash-pagination">
                <button
                  className="btn-secondary"
                  disabled={ordersData.page === 1}
                  onClick={() => fetchOrdersData(ordersData.page - 1)}
                >
                  Previous
                </button>
                <span className="dash-pagination-info">
                  Page {ordersData.page} of {ordersData.pages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={ordersData.page === ordersData.pages}
                  onClick={() => fetchOrdersData(ordersData.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && user?.role === 'root_admin' && (
            <div>
              <div className="dash-section-header">
                <h3>AI Analytics Summary</h3>
              </div>
              <div className="dash-ai-box">
                {aiSummary || 'Loading AI summary...'}
              </div>
            </div>
          )}

          {activeTab === 'sentiment' && user?.role === 'root_admin' && (
            <div>
              <div className="dash-section-header">
                <h3>Review Sentiment Analysis</h3>
                <button
                  className="btn-primary"
                  onClick={fetchSentimentReport}
                  disabled={sentimentLoading}
                >
                  {sentimentLoading ? 'Analyzing...' : '🔍 Generate Report'}
                </button>
              </div>

              {sentimentLoading && (
                <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>Analyzing all product reviews with AI...</p>
                  <p style={{ fontSize: '0.88rem', marginTop: 4 }}>This may take a few seconds.</p>
                </div>
              )}

              {sentimentReport && !sentimentLoading && (
                <div>
                  <div className="dash-sentiment-summary">
                    <strong>Overall Summary:</strong>
                    <p>{sentimentReport.summary}</p>
                  </div>

                  <h4 style={{ marginBottom: '12px' }}>
                    ⚠️ Flagged Products ({sentimentReport.negativeProducts?.length || 0})
                  </h4>

                  {(!sentimentReport.negativeProducts || sentimentReport.negativeProducts.length === 0) ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '8px', color: '#166534' }}>
                      ✅ No products flagged with negative sentiment. All products are performing well!
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="dash-table-wrap">
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Category</th>
                              <th>Avg Rating</th>
                              <th>Reviews</th>
                              <th>Reason Flagged</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sentimentReport.negativeProducts.map((p, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 700 }}>{p.productName}</td>
                                <td>
                                  <span style={{ padding: '3px 8px', backgroundColor: '#f1f5f9', borderRadius: '999px', fontSize: '0.8rem' }}>
                                    {p.category}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    backgroundColor: p.avgRating < 2 ? '#fee2e2' : p.avgRating < 3 ? '#fef3c7' : '#fef9c3',
                                    color: p.avgRating < 2 ? '#991b1b' : p.avgRating < 3 ? '#92400e' : '#854d0e'
                                  }}>
                                    {'★'.repeat(Math.round(p.avgRating))}{'☆'.repeat(5 - Math.round(p.avgRating))} {p.avgRating}
                                  </span>
                                </td>
                                <td>{p.reviewCount}</td>
                                <td style={{ color: '#dc2626', maxWidth: '300px' }}>{p.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="dash-mobile-list">
                        {sentimentReport.negativeProducts.map((p, idx) => (
                          <div key={idx} className="dash-sentiment-card">
                            <div className="dash-order-card-top">
                              <strong style={{ fontSize: '0.95rem' }}>{p.productName}</strong>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '999px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                backgroundColor: p.avgRating < 2 ? '#fee2e2' : '#fef3c7',
                                color: p.avgRating < 2 ? '#991b1b' : '#92400e',
                                whiteSpace: 'nowrap'
                              }}>
                                ★ {p.avgRating} ({p.reviewCount})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Category: {p.category}</span>
                            <div className="dash-sentiment-reason">{p.reason}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!sentimentReport && !sentimentLoading && (
                <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-secondary)' }}>
                  <p>Click <strong>&quot;Generate Report&quot;</strong> to analyze all product reviews using AI.</p>
                  <p style={{ fontSize: '0.88rem', marginTop: 4 }}>The report will flag products with negative or mixed sentiment.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'approval' && user?.role === 'root_admin' && (
            <div>
              <div className="dash-section-header">
                <h3>Pending Product Owners</h3>
              </div>
              {allUsers.filter(u => u.role === 'product_owner' && u.status === 'pending').length === 0 ? (
                <p className="dash-empty-text">No pending approvals.</p>
              ) : (
                <div className="dash-approval-list">
                  {allUsers.filter(u => u.role === 'product_owner' && u.status === 'pending').map(u => (
                    <div key={u._id} className="dash-approval-card">
                      <h4 style={{ margin: '0 0 6px 0' }}>{u.name} ({u.email})</h4>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.92rem' }}>
                        <strong>Business:</strong> {u.businessName || 'N/A'}
                      </p>
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        {u.businessDescription || 'No description provided.'}
                      </p>
                      <button className="btn-primary btn-sm" onClick={() => handleApprove(u._id)}>
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="dash-modal-overlay" onClick={() => setIsComposing(false)}>
          <div className="dash-modal-card" onClick={e => e.stopPropagation()}>
            <h3>Send Message</h3>
            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <label>Select Recipients:</label>
                <div className="dash-recipients-box">
                  {allUsers.filter(u => u._id !== user.id).map(u => (
                    <div key={u._id} className="dash-recipient-row">
                      <input
                        type="checkbox"
                        id={`user_${u._id}`}
                        style={{ width: 'auto' }}
                        checked={selectedRecipients.includes(u._id)}
                        onChange={() => {
                          setSelectedRecipients(prev =>
                            prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id]
                          );
                        }}
                      />
                      <label htmlFor={`user_${u._id}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {u.name} ({u.role})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="compose-body">Message:</label>
                <textarea
                  id="compose-body"
                  rows="4"
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  required
                />
              </div>
              <div className="dash-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsComposing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
