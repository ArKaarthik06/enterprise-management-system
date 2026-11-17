// Stock update: a WRITE tool (needs the user to press Confirm).
const { z } = require('zod');
const mongoose = require('mongoose');
const Product = require('../../../catalog/models/Product');
const config = require('../../config/ai.config');
const { ToolError } = require('./toolError');

// Sellers may only touch their own products. Admins may touch any product.
async function findAllowedProduct(productId, ctx) {
  if (!mongoose.isValidObjectId(productId)) throw new ToolError('That is not a valid product id.');
  const filter = { _id: productId };
  if (ctx.role === 'product_owner') filter.ownerId = ctx.userId;
  const product = await Product.findOne(filter);
  if (!product) throw new ToolError('Product not found among the products you manage.'); // same message for "not yours"
  return product;
}

const updateStock = {
  name: 'update_stock',
  description: 'PREPARE a stock change for one product: sets the stock to a new absolute number. Sellers can change only their own products. It does NOT change anything until the user presses Confirm.',
  roles: ['product_owner', 'root_admin'],
  kind: 'write',
  input: {
    productId: z.string().describe('Product id'),
    newStock: z.number().int().min(0).max(config.guardrails.maxStockValue).describe('The new total stock quantity'),
  },
  async prepare({ productId, newStock }, ctx) {
    const p = await findAllowedProduct(productId, ctx);
    return { summary: `Change stock of "${p.name}" from ${p.stock} to ${newStock} units.`, args: { productId, newStock } };
  },
  async execute({ productId, newStock }, ctx) {
    const p = await findAllowedProduct(productId, ctx); // ownership is checked again at execution time
    const before = p.stock;
    p.stock = newStock;
    if (newStock > p.lowStockThreshold) p.lowStockAlerted = false; // allow future low-stock alerts again
    await p.save();
    return `Stock of "${p.name}" changed from ${before} to ${newStock}.`;
  },
};

module.exports = [updateStock];
