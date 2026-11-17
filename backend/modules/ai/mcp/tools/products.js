// Read-only product tools. Anyone logged in may browse the catalogue.
const { z } = require('zod');
const mongoose = require('mongoose');
const Product = require('../../../catalog/models/Product');
const { ToolError } = require('./toolError');

const ALL_ROLES = ['customer', 'product_owner', 'root_admin'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // never put raw user text in a regex

const searchProducts = {
  name: 'search_products',
  description: 'Search the product catalogue by keyword, category and price. Returns id, name, category, price, stock and rating. Use it to find product ids before ordering.',
  roles: ALL_ROLES,
  kind: 'read',
  input: {
    query: z.string().max(100).optional().describe('Words to look for in the product name or description'),
    category: z.string().max(50).optional().describe('Category such as Kitchen or Household'),
    maxPrice: z.number().positive().optional().describe('Maximum price in USD'),
    inStockOnly: z.boolean().optional().describe('Only products that are in stock'),
    limit: z.number().int().min(1).max(10).optional().describe('How many results (default 5, max 10)'),
  },
  async run({ query, category, maxPrice, inStockOnly, limit = 5 }) {
    const filter = {};
    if (query) {
      const rx = new RegExp(escapeRegex(query), 'i');
      filter.$or = [{ name: rx }, { description: rx }];
    }
    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    if (maxPrice) filter.price = { $lte: maxPrice };
    if (inStockOnly) filter.stock = { $gt: 0 };

    const products = await Product.find(filter).sort({ avgRating: -1, price: 1 }).limit(limit).lean();
    return {
      count: products.length,
      products: products.map((p) => ({
        id: String(p._id), name: p.name, category: p.category, price: p.price,
        stock: p.stock, rating: p.avgRating, description: (p.description || '').slice(0, 200),
      })),
    };
  },
};

const getProductDetails = {
  name: 'get_product_details',
  description: 'Get full details and the latest reviews of one product by its id.',
  roles: ALL_ROLES,
  kind: 'read',
  input: { productId: z.string().describe('The product id (24 hex characters)') },
  async run({ productId }) {
    if (!mongoose.isValidObjectId(productId)) throw new ToolError('That is not a valid product id. Use search_products to find it.');
    const p = await Product.findById(productId).lean();
    if (!p) throw new ToolError('Product not found.');
    return {
      id: String(p._id), name: p.name, category: p.category, price: p.price, stock: p.stock,
      rating: p.avgRating, description: p.description,
      latestReviews: (p.reviews || []).slice(-3).map((r) => ({ rating: r.rating, comment: (r.comment || '').slice(0, 200) })),
    };
  },
};

module.exports = [searchProducts, getProductDetails];
