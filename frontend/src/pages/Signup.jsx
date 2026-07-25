import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/signup', formData);
      if (res.data.user.role === 'product_owner') {
        setSuccess('Account created! Your product_owner account is pending approval by an admin.');
      } else {
        setSuccess('Account created! You can now log in.');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="form-card" style={{ maxWidth: '400px', margin: '60px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '1.75rem', fontWeight: '800' }}>Create Account</h2>
      {error && <div style={{ color: 'var(--error)', marginBottom: '20px', padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', marginBottom: '20px', padding: '12px', backgroundColor: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '0.9rem' }}>{success}</div>}
      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label>Your Name</label>
          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
        </div>
        <div className="form-group">
          <label>Account Type</label>
          <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="customer">Customer</option>
            <option value="product_owner">Product Owner</option>
          </select>
        </div>
        <button type="submit" className="btn-primary btn-block" style={{ marginTop: '10px', height: '44px' }}>Create your account</button>
      </form>
    </div>
  );
};

export default Signup;
