// Order tools: two read tools and two write tools (place / cancel).
// WRITE tools never run directly. They have:
//   prepare()  - validates everything and describes the action  (runs when the AI asks)
//   execute()  - really changes data                             (runs only after the user presses Confirm)
const { z } = require('zod');
const mongoose = require('mongoose');
const Order = require('../../../orders/models/Order');
const Product = require('../../../catalog/models/Product');
const User = require('../../../auth/models/User');
const { placeOrder } = require('../../../orders/controllers/order.controller');
const { redisClient } = require('../../../../config/redis');
const config = require('../../config/ai.config');
const { ToolError } = require('./toolError');

const money = (n) => `$${Number(n).toFixed(2)}`;
const shortId = (id) => String(id).slice(-6);

// A customer only ever sees their own orders. An admin may look at any order.
const orderScope = (ctx) => (ctx.role === 'customer' ? { buyerId: ctx.userId } : {});

function describeOrder(o) {
  const total = o.items.reduce((s, i) => s + i.quantity * i.priceAtPurchase, 0);
  return {
    id: String(o._id), status: o.status, placedAt: o.createdAt, total,
    items: o.items.map((i) => ({
      product: i.productId && i.productId.name ? i.productId.name : String(i.productId),
      quantity: i.quantity, unitPrice: i.priceAtPurchase,
    })),
    deliveryCity: o.deliveryAddress && o.deliveryAddress.city,
    failureReason: o.failureReason || undefined,
  };
}

// ---------------- READ tools ----------------
const getMyOrders = {
  name: 'get_my_orders',
  description: 'List the logged-in customer\'s own recent orders with status and totals.',
  roles: ['customer'],
  kind: 'read',
  input: {
    status: z.enum(['pending', 'confirmed', 'failed', 'shipped', 'delivered', 'cancelled']).optional(),
    limit: z.number().int().min(1).max(10).optional().describe('Default 5, max 10'),
  },
  async run({ status, limit = 5 }, ctx) {
    const filter = { ...orderScope(ctx), ...(status ? { status } : {}) };
    const orders = await Order.find(filter).populate('items.productId', 'name').sort({ createdAt: -1 }).limit(limit);
    return { count: orders.length, orders: orders.map(describeOrder) };
  },
};

const getOrderStatus = {
  name: 'get_order_status',
  description: 'Get the status and details of one order by its id. Customers can only look up their own orders.',
  roles: ['customer', 'root_admin'],
  kind: 'read',
  input: { orderId: z.string().describe('The order id (24 hex characters)') },
  async run({ orderId }, ctx) {
    if (!mongoose.isValidObjectId(orderId)) throw new ToolError('That is not a valid order id.');
    const order = await Order.findOne({ _id: orderId, ...orderScope(ctx) }).populate('items.productId', 'name');
    if (!order) throw new ToolError('Order not found.'); // same message whether it does not exist or belongs to someone else
    return describeOrder(order);
  },
};

// ---------------- WRITE tools ----------------
// Shared check used when proposing AND again when executing (stock may have changed).
async function validateOrder(args, ctx) {
  const { maxOrderQuantityPerLine, maxOrderValue } = config.guardrails;
  const merged = new Map(); // same product listed twice => add quantities
  for (const line of args.items) merged.set(line.productId, (merged.get(line.productId) || 0) + line.quantity);

  const lines = [];
  let total = 0;
  for (const [productId, quantity] of merged) {
    if (!mongoose.isValidObjectId(productId)) throw new ToolError(`"${productId}" is not a valid product id. Use search_products first.`);
    if (quantity > maxOrderQuantityPerLine) throw new ToolError(`At most ${maxOrderQuantityPerLine} units per product can be ordered through the assistant.`);
    const p = await Product.findById(productId).lean();
    if (!p) throw new ToolError(`Product ${productId} not found.`);
    if (p.stock < quantity) throw new ToolError(`Only ${p.stock} units of "${p.name}" are in stock.`);
    lines.push({ productId, quantity, name: p.name, price: p.price });
    total += p.price * quantity;
  }
  if (total > maxOrderValue) throw new ToolError(`Orders above ${money(maxOrderValue)} cannot be placed through the assistant. Please use the checkout page.`);

  // delivery address: given in the request, or the default one saved in the profile
  let address = args.deliveryAddress;
  if (!address || !address.city) {
    const user = await User.findById(ctx.userId).select('defaultAddress').lean();
    const d = user && user.defaultAddress;
    if (d && d.city) address = { line1: d.street, city: d.city, state: d.state, zip: d.zip, country: d.country };
  }
  if (!address || !address.city) throw new ToolError('No delivery address. Ask the user for a delivery address (street, city, state, zip, country).');

  return { lines, total, address };
}

const placeOrderTool = {
  name: 'place_order',
  description: 'PREPARE an order for the logged-in customer. It does NOT place the order: the user must press the Confirm button first. Use product ids from search_products. Max 10 units per product and $5000 per order.',
  roles: ['customer'],
  kind: 'write',
  input: {
    items: z.array(z.object({
      productId: z.string().describe('Product id from search_products'),
      quantity: z.number().int().min(1).max(10),
    })).min(1).max(5),
    deliveryAddress: z.object({
      line1: z.string().max(120).optional(), city: z.string().max(60), state: z.string().max(60).optional(),
      zip: z.string().max(20).optional(), country: z.string().max(60).optional(),
    }).optional().describe('Only if the user gave one. Otherwise the saved default address is used.'),
  },
  async prepare(args, ctx) {
    const { lines, total, address } = await validateOrder(args, ctx);
    const text = lines.map((l) => `${l.quantity} x ${l.name} (${money(l.price)} each)`).join(', ');
    return {
      summary: `Place order: ${text}. Total ${money(total)}. Deliver to ${address.city}${address.country ? ', ' + address.country : ''}.`,
      args: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), deliveryAddress: address },
    };
  },
  async execute(args, ctx) {
    await validateOrder(args, ctx); // check again: stock or prices may have changed since the proposal
    // Reuse the existing, race-safe order controller instead of duplicating its logic.
    const { status, body } = await callController(placeOrder, {
      user: { id: ctx.userId },
      body: { items: args.items, deliveryAddress: args.deliveryAddress, idempotencyKey: `ai-${ctx.pendingId}` },
    });
    if (status >= 400) throw new ToolError(body.message || 'The order could not be placed.');
    return `Order placed successfully. Order id ${body.order._id}.`;
  },
};

const cancelOrderTool = {
  name: 'cancel_order',
  description: 'PREPARE the cancellation of one of the customer\'s own orders (only pending or confirmed orders). It does NOT cancel: the user must press Confirm.',
  roles: ['customer'],
  kind: 'write',
  input: { orderId: z.string().describe('The order id') },
  async prepare({ orderId }, ctx) {
    if (!mongoose.isValidObjectId(orderId)) throw new ToolError('That is not a valid order id.');
    const order = await Order.findOne({ _id: orderId, buyerId: ctx.userId }).populate('items.productId', 'name');
    if (!order) throw new ToolError('Order not found.');
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new ToolError(`This order is "${order.status}" and can no longer be cancelled. Only pending or confirmed orders can be cancelled.`);
    }
    const d = describeOrder(order);
    return { summary: `Cancel order ...${shortId(order._id)} (${d.items.map((i) => `${i.quantity} x ${i.product}`).join(', ')}, total ${money(d.total)}). Stock is returned and you are refunded.`, args: { orderId } };
  },
  async execute({ orderId }, ctx) {
    // one atomic update: only succeeds if the order is still cancellable and belongs to this user
    const order = await Order.findOneAndUpdate(
      { _id: orderId, buyerId: ctx.userId, status: { $in: ['pending', 'confirmed'] } },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!order) throw new ToolError('The order could not be cancelled (it may have shipped in the meantime).');
    for (const item of order.items) await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    await clearAnalyticsCache();
    return `Order ...${shortId(order._id)} was cancelled.`;
  },
};

// ---------------- helpers ----------------
// Our order controller is an Express handler (req, res). This lets us call it like a function.
function callController(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function clearAnalyticsCache() {
  if (!redisClient.isReady) return;
  try {
    const keys = await redisClient.keys('analytics:*');
    if (keys.length) await redisClient.del(keys);
  } catch (e) { /* cache problems are not fatal */ }
}

module.exports = [getMyOrders, getOrderStatus, placeOrderTool, cancelOrderTool];
