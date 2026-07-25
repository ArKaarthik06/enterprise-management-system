import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';

const OrderDetails = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/login');

        const res = await axios.get(`http://localhost:5000/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrder(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetails();
  }, [id, navigate]);

  if (loading) return <div className="container">Loading order details...</div>;
  if (error) return <div className="container"><div className="form-card"><h3 style={{color:'var(--error)'}}>{error}</h3><Link to="/orders" className="btn-secondary">Back to Orders</Link></div></div>;
  if (!order) return null;

  const totalPrice = order.items.reduce((acc, item) => acc + (item.quantity * item.priceAtPurchase), 0);

  return (
    <div className="container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/orders" className="btn-secondary btn-sm">← Back</Link>
          <h1>Order Details</h1>
        </div>
        <span style={{ 
          padding: '6px 12px', 
          borderRadius: '20px', 
          fontSize: '0.9rem',
          fontWeight: '600',
          backgroundColor: order.status === 'confirmed' ? 'var(--success)' : order.status === 'failed' ? 'var(--error)' : 'var(--warning)',
          color: '#fff'
        }}>
          {order.status.toUpperCase()}
        </span>
      </div>

      <div className="form-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Order ID</p>
            <p style={{ fontWeight: '600' }}>#{order._id}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Date Placed</p>
            <p style={{ fontWeight: '600' }}>{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Amount</p>
            <p style={{ fontWeight: '600', color: 'var(--accent)', fontSize: '1.2rem' }}>${totalPrice.toFixed(2)}</p>
          </div>
        </div>

        <h3 style={{ marginBottom: '1rem' }}>Items</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {order.items.map((item, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '60px', height: '60px', backgroundColor: '#fff', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                  {item.productId && item.productId.images && item.productId.images[0] ? (
                    <img src={item.productId.images[0]} alt={item.productId.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>📦</span>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {item.productId ? (
                      <Link to={`/product/${item.productId._id}`}>{item.productId.name}</Link>
                    ) : 'Unknown Product'}
                  </h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Qty: {item.quantity}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: '600' }}>${(item.priceAtPurchase * item.quantity).toFixed(2)}</p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>${item.priceAtPurchase.toFixed(2)} each</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-card">
        <h3>Delivery Information</h3>
        {order.deliveryAddress ? (
          <p style={{ marginTop: '0.5rem', lineHeight: '1.8' }}>
            {typeof order.deliveryAddress === 'string' ? (
              order.deliveryAddress
            ) : (
              <>
                {order.deliveryAddress.line1}<br />
                {order.deliveryAddress.city && <span style={{textTransform: 'capitalize'}}>{order.deliveryAddress.city}</span>}
              </>
            )}
          </p>
        ) : (
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>No delivery address provided.</p>
        )}
      </div>

    </div>
  );
};

export default OrderDetails;
