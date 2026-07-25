import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const res = await axios.get('http://localhost:5000/api/orders', {
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
                      <Link to={`/orders/${order._id}`} className="btn-secondary btn-sm">View Details</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
