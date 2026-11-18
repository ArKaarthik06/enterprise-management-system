import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Automatically close mobile drawer when navigating
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <Link to="/">EnterpriseMarket</Link>
        </div>

        <button
          type="button"
          className="navbar-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(prev => !prev)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {user ? (
            <>
              <span className="navbar-greeting">Hello, {user.name}</span>
              {(user.role === 'root_admin' || user.role === 'product_owner') && (
                <Link to="/dashboard">Dashboard</Link>
              )}
              {user.role === 'root_admin' && <Link to="/ai-audit">AI Audit</Link>}
              {user.role === 'customer' && (
                <>
                  <Link to="/orders">My Orders</Link>
                  <Link to="/cart">🛒 Cart ({cart.length})</Link>
                </>
              )}
              <Link to="/settings">Settings</Link>
              <button className="btn-primary btn-sm navbar-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="btn-primary btn-sm navbar-signup">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
