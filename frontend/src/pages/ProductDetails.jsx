import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CheckoutModal from '../components/CheckoutModal';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  
  const { addToCart } = useCart();
  const [checkoutItem, setCheckoutItem] = useState(null);
  
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/products/${id}`);
        setData(res.data);
      } catch (err) {
        setError('Failed to load product');
      }
    };
    fetchProduct();
  }, [id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');
      await axios.post(`http://localhost:5000/api/products/${id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Review added!');
      setReviewComment('');
      // Refresh
      const res = await axios.get(`http://localhost:5000/api/products/${id}`);
      setData(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!data) return <div>Loading...</div>;

  const { product, reviews } = data;

  return (
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* Product Image */}
        <div style={{ flex: '1 1 300px', minWidth: '300px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {product.images && product.images.length > 0 ? (
            <img src={product.images[0]} alt={product.name} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
          ) : (
            <span style={{ color: '#aaa' }}>No Image Available</span>
          )}
        </div>

        {/* Product Info */}
        <div style={{ flex: '2 1 400px' }}>
          <h2>{product.name}</h2>
          <p style={{ color: '#555' }}>Category: {product.category}</p>
          <div style={{ fontSize: '24px', color: '#B12704', margin: '10px 0' }}>${product.price}</div>
          <p>{product.description}</p>
          
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid var(--border-color)', display: 'inline-block' }}>
            <p style={{ color: product.stock > 0 ? 'var(--success)' : 'var(--error)' }}>
              {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
            </p>
            
            {product.stock > 0 && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label>Qty:</label>
                <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                  {[...Array(Math.min(product.stock, 10)).keys()].map(x => (
                    <option key={x+1} value={x+1}>{x+1}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={() => addToCart(product, qty)}>Add to Cart</button>
                <button className="btn btn-primary" onClick={() => setCheckoutItem(product)}>Place Order Now</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {checkoutItem && (
        <CheckoutModal 
          items={[{ productId: checkoutItem._id, name: checkoutItem.name, price: checkoutItem.price, quantity: qty }]} 
          onClose={() => setCheckoutItem(null)} 
          onSuccess={() => { setCheckoutItem(null); alert('Order placed successfully!'); }} 
        />
      )}

      <hr style={{ borderColor: 'var(--border-color)', margin: '40px 0 20px 0' }} />
      
      <h3>Customer Reviews (★ {product.avgRating})</h3>
      {reviews.length === 0 ? <p>No reviews yet.</p> : (
        reviews.map(review => (
          <div key={review._id} className="comment-item" style={{ marginBottom: '15px' }}>
            <div style={{ color: '#ffb400' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div>
            <strong className="comment-author">{review.userId.name}</strong> <span className="comment-date">on {new Date(review.createdAt).toLocaleDateString()}</span>
            <p className="comment-text">{review.comment}</p>
          </div>
        ))
      )}

      {/* Review Form */}
      <div className="comments-section" style={{ marginTop: '2rem' }}>
        <h4>Write a Review</h4>
        <form onSubmit={handleReviewSubmit} className="comment-form form-card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
          <div className="form-group">
            <label>Rating</label>
            <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Terrible</option>
            </select>
          </div>
          <div className="form-group">
            <label>Review</label>
            <textarea 
              required
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="What did you like or dislike?"
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary" disabled={reviewSubmitting}>Submit Review</button>
        </form>
      </div>
    </div>
  );
};

export default ProductDetails;
