import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { cart } = useCart();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" style={{ fontSize: '20px', marginLeft: 0 }}>EnterpriseMarket</Link>
      </div>
      <div className="navbar-links">
        {user ? (
          <>
            <span style={{ marginRight: '20px' }}>Hello, {user.name}</span>
            {(user.role === 'root_admin' || user.role === 'product_owner') && (
              <Link to="/dashboard">Dashboard</Link>
            )}
            {user.role === 'customer' && (
              <>
                <Link to="/orders">My Orders</Link>
                <Link to="/cart">🛒 Cart ({cart.length})</Link>
              </>
            )}
            <Link to="/settings" style={{ marginLeft: '10px' }}>Settings</Link>
            <button className="btn-primary" onClick={handleLogout} style={{ marginLeft: '20px' }}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
