import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState({
    street: user?.defaultAddress?.street || '',
    city: user?.defaultAddress?.city || '',
    state: user?.defaultAddress?.state || '',
    zip: user?.defaultAddress?.zip || '',
    country: user?.defaultAddress?.country || ''
  });
  
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(import.meta.env.VITE_API_BASE_URL + '/api/auth/profile', {
        phone,
        defaultAddress: address
      }, getHeaders());
      
      const updatedUser = { ...user, ...res.data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setStatusMsg('Profile settings updated successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(err.response?.data?.message || 'Failed to update settings');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h2>Account Settings</h2>
      {statusMsg && (
        <div style={{ padding: '10px', marginBottom: '20px', borderRadius: '4px', backgroundColor: statusMsg.includes('failed') ? '#fee2e2' : '#d1fae5', color: statusMsg.includes('failed') ? 'var(--error)' : 'var(--success)' }}>
          {statusMsg}
        </div>
      )}
      <div className="form-card">
        <form onSubmit={handleSave}>
          <h3>Contact Details</h3>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 234 567 8900" />
          </div>

          <h3 style={{ marginTop: '30px' }}>Default Delivery Address</h3>
          <div className="form-group">
            <label>Street Address</label>
            <input type="text" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>City</label>
              <input type="text" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>State / Province</label>
              <input type="text" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Zip / Postal Code</label>
              <input type="text" value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Country</label>
              <input type="text" value={address.country} onChange={e => setAddress({...address, country: e.target.value})} />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{ marginTop: '20px' }}>Save Settings</button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
