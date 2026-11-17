import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProductManagement from './pages/ProductManagement';
import ProductDetails from './pages/ProductDetails';
import Settings from './pages/Settings';
import Cart from './pages/Cart';
import MyOrders from './pages/MyOrders';
import OrderDetails from './pages/OrderDetails';
import AiAudit from './pages/AiAudit';
import AiChat from './components/AiChat';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <Router>
        <Navbar />
        <div className="container">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai-audit" element={<AiAudit />} />
          </Routes>
        </div>
        <AiChat />
      </Router>
    </CartProvider>
  );
}

export default App;
