import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CheckoutModal from '../components/CheckoutModal';

const LandingPage = () => {
  const { addToCart } = useCart();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/products?page=${page}&search=${search}`);
      setProducts(res.data.products);
      setTotalPages(res.data.pages);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>All Products</h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" className="btn-primary">Search</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {products.map(product => (
          <div key={product._id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              {product.images && product.images.length > 0 ? (
                <img src={product.images[0]} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: '#aaa' }}>No Image</span>
              )}
            </div>
            <h3 style={{ margin: '0 0 10px 0' }}><Link to={`/product/${product._id}`}>{product.name}</Link></h3>
            <p style={{ color: '#555', height: '40px', overflow: 'hidden', margin: 0 }}>{product.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '15px' }}>
              <strong style={{ fontSize: '18px', color: '#B12704' }}>${product.price}</strong>
              <span style={{ fontSize: '14px', color: product.stock > 0 ? 'var(--success)' : 'var(--error)' }}>
                {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
              </span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#ffb400', marginBottom: '15px' }}>
              ★ {product.avgRating} / 5
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <button 
                onClick={() => addToCart(product)} 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={product.stock <= 0}
              >
                Add to Cart
              </button>
              <button 
                onClick={() => setCheckoutItem(product)} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={product.stock <= 0}
              >
                Place Order
              </button>
            </div>
          </div>
        ))}
      </div>

      {checkoutItem && (
        <CheckoutModal 
          items={[{ productId: checkoutItem._id, name: checkoutItem.name, price: checkoutItem.price, quantity: 1 }]} 
          onClose={() => setCheckoutItem(null)} 
          onSuccess={() => { setCheckoutItem(null); alert('Order placed successfully!'); }} 
        />
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <button 
          disabled={page === 1} 
          onClick={() => setPage(p => p - 1)}
          style={{ padding: '5px 10px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button 
          disabled={page === totalPages || totalPages === 0} 
          onClick={() => setPage(p => p + 1)}
          style={{ padding: '5px 10px', cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
