import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null); // For rating modal
  const [ratings, setRatings] = useState({}); // Local state for ratings
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const res = await axios.get(import.meta.env.VITE_API_BASE_URL + '/api/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [navigate]);

  const handleRateSubmit = async (productId) => {
    const ratingData = ratings[productId];
    if (!ratingData || !ratingData.rating) return alert('Please select a star rating');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/products/${productId}/reviews`, {
        rating: ratingData.rating,
        comment: ratingData.comment || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Review submitted successfully!');
      // Mark as submitted locally
      setRatings(prev => ({ ...prev, [productId]: { ...prev[productId], submitted: true } }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit review');
    }
  };

  if (loading) return <div className="container">Loading your orders...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state form-card">
          <div className="icon">📦</div>
          <h3>No Orders Yet</h3>
          <p>You haven't placed any orders. Start exploring our marketplace!</p>
          <Link to="/" className="btn-primary" style={{ marginTop: '1rem' }}>Browse Products</Link>
        </div>
      ) : (
        <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Total Items</th>
                <th>Total Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);
                const totalPrice = order.items.reduce((acc, item) => acc + (item.quantity * item.priceAtPurchase), 0);
                
                return (
                  <tr key={order._id}>
                    <td><strong>#{order._id.substring(order._id.length - 8)}</strong></td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{totalItems} items</td>
                    <td>${totalPrice.toFixed(2)}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        backgroundColor: order.status === 'confirmed' ? 'var(--success)' : order.status === 'failed' ? 'var(--error)' : 'var(--warning)',
                        color: '#fff'
                      }}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Link to={`/orders/${order._id}`} className="btn-secondary btn-sm">View Details</Link>
                        {order.status === 'delivered' && (
                          <button 
                            className="btn-primary btn-sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Rate Products
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3>Rate Products</h3>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            {selectedOrder.items.map(item => {
              const r = ratings[item.productId._id || item.productId] || { rating: 5, comment: '' };
              const isSubmitted = r.submitted;
              const pId = item.productId._id || item.productId;
              const pName = item.productId.name || 'Product';
              return (
                <div key={pId} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <h4>{pName}</h4>
                  {isSubmitted ? (
                    <p style={{ color: 'green' }}>✓ Review submitted</p>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Rating (1-5 Stars):</label>
                        <select 
                          value={r.rating}
                          onChange={(e) => setRatings(prev => ({ ...prev, [pId]: { ...prev[pId], rating: e.target.value } }))}
                          style={{ padding: '5px' }}
                        >
                          <option value="5">5 - Excellent</option>
                          <option value="4">4 - Very Good</option>
                          <option value="3">3 - Good</option>
                          <option value="2">2 - Fair</option>
                          <option value="1">1 - Poor</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Comment:</label>
                        <textarea 
                          rows="2" 
                          style={{ width: '100%', padding: '8px' }}
                          value={r.comment}
                          onChange={(e) => setRatings(prev => ({ ...prev, [pId]: { ...prev[pId], comment: e.target.value } }))}
                          placeholder="What did you think about this product?"
                        />
                      </div>
                      <button className="btn-primary btn-sm" onClick={() => handleRateSubmit(pId)}>Submit Review</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
