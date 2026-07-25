import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CheckoutModal = ({ items, onClose, onSuccess }) => {
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [useDefaultAddress, setUseDefaultAddress] = useState(false);
  const [phone, setPhone] = useState('');
  const [defaultProfile, setDefaultProfile] = useState(null);
  const [idempotencyKey] = useState(() => Math.random().toString(36).substring(7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Temporarily use auth/users endpoint to fetch current user's profile if we don't have a specific profile GET route, wait, we do have PUT, but we didn't write GET /api/auth/profile. 
          // Let's decode user from localstorage. We'll prompt them to fill it in if it's empty.
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user.defaultAddress) {
              setDefaultProfile(user);
              setUseDefaultAddress(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (useDefaultAddress && defaultProfile && defaultProfile.defaultAddress) {
      const addr = defaultProfile.defaultAddress;
      setDeliveryAddress(`${addr.street || ''}, ${addr.state || ''}, ${addr.zip || ''}, ${addr.country || ''}`);
      setCity(addr.city || '');
      if (defaultProfile.phone) setPhone(defaultProfile.phone);
    } else {
      setDeliveryAddress('');
      setCity('');
    }
  }, [useDefaultAddress, defaultProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Please login to place an order');

      // Update default address if they want to save it (optional, we could add a checkbox for this)
      
      await axios.post('http://localhost:5000/api/orders', {
        items,
        deliveryAddress: {
          line1: deliveryAddress,
          city: city.trim().toLowerCase().replace(/\s+/g, '')
        },
        phone,
        idempotencyKey
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.message || error.message || 'Error placing order');
    } finally {
      setLoading(false);
    }
  };

  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="modal-overlay" style={modalOverlayStyle}>
      <div className="modal-content form-card" style={modalContentStyle}>
        <h2>Checkout</h2>
        <div className="checkout-summary" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
          {items.map(item => (
            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{item.name} x {item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '8px', paddingTop: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {defaultProfile && defaultProfile.defaultAddress && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={useDefaultAddress} 
                onChange={(e) => setUseDefaultAddress(e.target.checked)} 
                id="useDefault"
              />
              <label htmlFor="useDefault" style={{ margin: 0 }}>Use Default Address</label>
            </div>
          )}

          <div className="form-group">
            <label>Phone Number</label>
            <input 
              type="text" 
              required 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-group">
            <label>City</label>
            <input 
              type="text" 
              required 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
              placeholder="Enter city"
            />
          </div>

          <div className="form-group">
            <label>Delivery Address</label>
            <textarea 
              required 
              value={deliveryAddress} 
              onChange={(e) => setDeliveryAddress(e.target.value)} 
              placeholder="Enter full delivery address..."
            />
          </div>
          
          <div className="form-footer" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Processing...' : 'Confirm Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1rem'
};

const modalContentStyle = {
  width: '100%',
  maxWidth: '500px',
  maxHeight: '90vh',
  overflowY: 'auto'
};

export default CheckoutModal;
