import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const navigate = useNavigate();

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'electronics',
    stock: '',
    lowStockThreshold: '',
    images: [''] // simplifying to one image input
  });

  const [stockForm, setStockForm] = useState({ id: null, change: '' });

  useEffect(() => {
    if (!user || user.role !== 'product_owner') {
      navigate('/');
    } else {
      fetchMyProducts();
    }
  }, [user, navigate]);

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const fetchMyProducts = async () => {
    try {
      // Pagination omitted for simplicity in this management view, or we fetch a large page size
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/products?ownerId=${user.id}&pageSize=50`);
      setProducts(res.data.products);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        lowStockThreshold: Number(formData.lowStockThreshold)
      };

      if (editMode) {
        await axios.put(`${import.meta.env.VITE_API_BASE_URL}/api/products/${currentId}`, payload, getHeaders());
        alert('Product updated!');
      } else {
        await axios.post(import.meta.env.VITE_API_BASE_URL + '/api/products', payload, getHeaders());
        alert('Product created!');
      }
      
      setShowForm(false);
      fetchMyProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/products/${id}`, getHeaders());
        fetchMyProducts();
      } catch (err) {
        alert(err.response?.data?.message || 'Delete failed');
      }
    }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/inventory/${stockForm.id}`, {
        change: Number(stockForm.change),
        reason: 'manual_update'
      }, getHeaders());
      alert('Stock updated!');
      setStockForm({ id: null, change: '' });
      fetchMyProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Stock update failed');
    }
  };

  const openCreateForm = () => {
    setFormData({ name: '', description: '', price: '', category: 'electronics', stock: '', lowStockThreshold: '', images: [''] });
    setEditMode(false);
    setShowForm(true);
  };

  const openEditForm = (p) => {
    setFormData({
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      images: p.images
    });
    setCurrentId(p._id);
    setEditMode(true);
    setShowForm(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Product Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          <button className="btn-primary" onClick={openCreateForm}>Add New Product</button>
        </div>
      </div>

      {showForm && (
        <div className="form-card" style={{ maxWidth: '600px', margin: '0' }}>
          <h3>{editMode ? 'Edit Product' : 'Create Product'}</h3>
          <form onSubmit={handleSaveProduct}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Price</label>
                <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="electronics">Electronics</option>
                  <option value="fashion">Fashion</option>
                  <option value="home">Home</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Initial Stock</label>
                <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required disabled={editMode} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Low Stock Threshold</label>
                <input type="number" value={formData.lowStockThreshold} onChange={e => setFormData({...formData, lowStockThreshold: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label>Image URL</label>
              <input type="text" value={formData.images[0]} onChange={e => setFormData({...formData, images: [e.target.value]})} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Update Modal */}
      {stockForm.id && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <h3>Adjust Stock</h3>
            <form onSubmit={handleStockUpdate}>
              <div className="form-group">
                <label>Change (e.g. 10 or -5)</label>
                <input type="number" value={stockForm.change} onChange={e => setStockForm({...stockForm, change: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setStockForm({ id: null, change: '' })}>Cancel</button>
                <button type="submit" className="btn-primary">Apply</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h3>My Products</h3>
        {products.length === 0 ? <p>You haven't listed any products yet.</p> : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px' }}>Product</th>
                <th style={{ padding: '10px' }}>Price</th>
                <th style={{ padding: '10px' }}>Stock</th>
                <th style={{ padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>
                    <strong>{p.name}</strong><br/>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.category}</span>
                  </td>
                  <td style={{ padding: '10px' }}>${p.price.toFixed(2)}</td>
                  <td style={{ padding: '10px', color: p.stock <= p.lowStockThreshold ? 'var(--error)' : 'inherit' }}>
                    {p.stock} {p.stock <= p.lowStockThreshold && '(Low)'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setStockForm({ id: p._id, change: '' })}>Restock</button>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => openEditForm(p)}>Edit</button>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDelete(p._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProductManagement;
