import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CheckoutModal from '../components/CheckoutModal';
import './LandingPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const LandingPage = () => {
  const { addToCart } = useCart();
  const [checkoutItem, setCheckoutItem] = useState(null);

  // Catalog state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Performance & loading state
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [loadTimeMs, setLoadTimeMs] = useState(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/products/categories`);
        if (Array.isArray(res.data)) {
          setCategories(res.data);
        }
      } catch (err) {
        console.warn('Could not load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch products with pagination & caching
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        category: selectedCategory,
      });
      if (activeSearch) {
        params.append('search', activeSearch);
      }

      const res = await axios.get(`${API_BASE}/api/products?${params.toString()}`);
      const duration = Math.round(performance.now() - start);
      setLoadTimeMs(duration);

      const data = res.data;
      setProducts(data.products || []);
      setTotalPages(data.pages || 1);
      setTotalProducts(data.total || 0);
      setIsCached(Boolean(data.fromCache));
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedCategory, activeSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setActiveSearch('');
    setSelectedCategory('all');
    setPage(1);
  };

  // Generate numbered pagination items
  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;

    const items = [];
    const maxVisible = 5;

    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <button key="1" className="pagination-btn" onClick={() => setPage(1)}>1</button>
      );
      if (startPage > 2) {
        items.push(<span key="start-ellipsis" className="pagination-ellipsis">…</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <button
          key={i}
          className={`pagination-btn ${page === i ? 'active' : ''}`}
          onClick={() => setPage(i)}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<span key="end-ellipsis" className="pagination-ellipsis">…</span>);
      }
      items.push(
        <button key={totalPages} className="pagination-btn" onClick={() => setPage(totalPages)}>
          {totalPages}
        </button>
      );
    }

    return items;
  };

  const startItem = totalProducts === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalProducts);

  return (
    <div className="landing-container">
      {/* Hero Banner */}
      <div className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">⚡ Redis-Accelerated Catalog</div>
          <h1>Enterprise Marketplace</h1>
          <p>
            Explore high-performance enterprise equipment with sub-10ms Redis cached product delivery,
            dynamic pagination, and full RBAC isolation.
          </p>
        </div>
      </div>

      {/* Search & Category Controls */}
      <div className="catalog-controls">
        <form onSubmit={handleSearchSubmit} className="catalog-search-row">
          <div className="catalog-search-input-wrap">
            <span className="catalog-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search products by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="catalog-search-input"
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
          {(activeSearch || selectedCategory !== 'all') && (
            <button type="button" onClick={handleClearFilters} className="btn-secondary">
              Reset Filters
            </button>
          )}
        </form>

        {/* Category Pills */}
        <div className="catalog-category-row">
          <button
            type="button"
            className={`category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stats, Cache Badge, and Page Size Selector */}
      <div className="catalog-stats-bar">
        <div className="catalog-count-text">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalProducts}</strong> products
          {activeSearch && <span> for "<em>{activeSearch}</em>"</span>}
        </div>

        <div className="catalog-meta-pills">
          {/* Cache Status Badge */}
          {loadTimeMs !== null && (
            <span
              className={`cache-badge ${isCached ? 'hit' : 'miss'}`}
              title={isCached ? 'Served directly from Redis RAM' : 'Queried from MongoDB Atlas'}
            >
              {isCached ? `⚡ Redis HIT (${loadTimeMs}ms)` : `🔄 DB Query (${loadTimeMs}ms)`}
            </span>
          )}

          {/* Page Size Selector */}
          <div className="page-size-selector">
            <span>Show:</span>
            <select value={pageSize} onChange={handlePageSizeChange}>
              <option value="8">8 per page</option>
              <option value="12">12 per page</option>
              <option value="24">24 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid / Loading / Empty States */}
      {loading ? (
        <div className="product-grid">
          {Array.from({ length: pageSize }).map((_, idx) => (
            <div key={idx} className="skeleton-card">
              <div className="skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="catalog-empty">
          <div className="catalog-empty-icon">📦</div>
          <h3>No products match your criteria</h3>
          <p>Try searching for a different keyword or selecting another category.</p>
          <button onClick={handleClearFilters} className="btn-primary">
            View All Products
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => {
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= (product.lowStockThreshold || 5);

            return (
              <div key={product._id} className="product-card">
                <div className="product-card-img-wrap">
                  {product.category && (
                    <span className="product-badge-category">{product.category}</span>
                  )}
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="product-card-img"
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No Image</span>
                  )}
                </div>

                <div className="product-card-body">
                  <h3 className="product-card-title">
                    <Link to={`/product/${product._id}`}>{product.name}</Link>
                  </h3>
                  <p className="product-card-desc">{product.description}</p>

                  <div className="product-card-pricing">
                    <div className="product-price">${product.price}</div>
                    <span
                      className={`product-stock-tag ${
                        isOutOfStock ? 'out-stock' : isLowStock ? 'low-stock' : 'in-stock'
                      }`}
                    >
                      {isOutOfStock
                        ? 'Out of Stock'
                        : isLowStock
                        ? `Only ${product.stock} left!`
                        : `In Stock (${product.stock})`}
                    </span>
                  </div>

                  <div className="product-card-rating">
                    ★ {product.avgRating ? Number(product.avgRating).toFixed(1) : '5.0'}
                    <span>/ 5.0</span>
                  </div>

                  <div className="product-card-actions">
                    <button
                      onClick={() => addToCart(product)}
                      className="btn-secondary"
                      disabled={isOutOfStock}
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => setCheckoutItem(product)}
                      className="btn-primary"
                      disabled={isOutOfStock}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutItem && (
        <CheckoutModal
          items={[
            {
              productId: checkoutItem._id,
              name: checkoutItem.name,
              price: checkoutItem.price,
              quantity: 1,
            },
          ]}
          onClose={() => setCheckoutItem(null)}
          onSuccess={() => {
            setCheckoutItem(null);
            alert('Order placed successfully!');
            fetchProducts();
          }}
        />
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <button
            className="pagination-btn"
            disabled={page === 1 || loading}
            onClick={() => setPage(1)}
            title="First Page"
          >
            «
          </button>
          <button
            className="pagination-btn"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          {renderPaginationButtons()}

          <button
            className="pagination-btn"
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Next Page"
          >
            Next ›
          </button>
          <button
            className="pagination-btn"
            disabled={page === totalPages || loading}
            onClick={() => setPage(totalPages)}
            title="Last Page"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
