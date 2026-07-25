import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CheckoutModal from '../components/CheckoutModal';

const Cart = () => {
  const { cart, removeFromCart, getCartTotal, clearCart } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [idempotencyKey] = useState(() => Math.random().toString(36).substring(7));
  const navigate = useNavigate();

  const handleSuccess = () => {
    alert('Order placed successfully!');
    clearCart();
    setShowCheckout(false);
    navigate('/dashboard');
  };

  if (cart.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🛒</div>
        <h3>Your Cart is Empty</h3>
        <p>Looks like you haven't added anything to your cart yet.</p>
        <Link to="/" className="btn btn-primary">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="page-header">
        <h1>Your Cart</h1>
      </div>
      
      <div className="cart-grid">
        <div className="cart-items">
          {cart.map((item) => (
            <div key={item.productId} className="cart-item-card">
              <div>
                <h3>{item.name}</h3>
                <p>Quantity: {item.quantity}</p>
                <p className="price">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <button onClick={() => removeFromCart(item.productId)} className="btn btn-danger btn-sm">Remove</button>
            </div>
          ))}
        </div>
        
        <div className="cart-summary">
          <h3>Order Summary</h3>
          <p className="total">Total: ${getCartTotal().toFixed(2)}</p>
          
          <button onClick={() => setShowCheckout(true)} className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}>
            Proceed to Checkout
          </button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal 
          items={cart}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default Cart;
