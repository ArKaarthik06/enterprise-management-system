// Business insight tools for sellers (own products only) and admins (everything).
const { z } = require('zod');
const mongoose = require('mongoose');
const Order = require('../../../orders/models/Order');
const Product = require('../../../catalog/models/Product');

const DAY = 24 * 60 * 60 * 1000;
const round = (n) => Math.round((n || 0) * 100) / 100;

// Sales aggregation for one date range. Sellers are limited to their own products HERE,
// using the id from the login (ctx), never an id the model supplies.
async function salesBetween(ctx, from, to, category) {
  const pipeline = [
    { $match: { status: { $in: ['confirmed', 'delivered'] }, createdAt: { $gte: from, $lt: to } } },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
  ];
  if (ctx.role === 'product_owner') pipeline.push({ $match: { 'p.ownerId': new mongoose.Types.ObjectId(ctx.userId) } });
  if (category) pipeline.push({ $match: { 'p.category': { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } });

  pipeline.push(
    { $addFields: { lineTotal: { $multiply: ['$items.quantity', '$items.priceAtPurchase'] } } },
    {
      $facet: {
        totals: [{ $group: { _id: null, revenue: { $sum: '$lineTotal' }, units: { $sum: '$items.quantity' }, orders: { $addToSet: '$_id' } } }],
        topProducts: [
          { $group: { _id: '$p._id', name: { $first: '$p.name' }, revenue: { $sum: '$lineTotal' }, units: { $sum: '$items.quantity' } } },
          { $sort: { revenue: -1 } }, { $limit: 5 },
        ],
        byCategory: [
          { $group: { _id: '$p.category', revenue: { $sum: '$lineTotal' }, units: { $sum: '$items.quantity' } } },
          { $sort: { revenue: -1 } },
        ],
        byCity: [
          { $group: { _id: { $toLower: { $ifNull: ['$deliveryAddress.city', 'unknown'] } }, orders: { $addToSet: '$_id' } } },
          { $project: { orders: { $size: '$orders' } } }, { $sort: { orders: -1 } }, { $limit: 5 },
        ],
        timeline: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$lineTotal' } } },
          { $sort: { _id: 1 } },
        ],
      },
    },
  );

  const [r] = await Order.aggregate(pipeline);
  const t = (r.totals && r.totals[0]) || { revenue: 0, units: 0, orders: [] };
  return {
    revenue: round(t.revenue), unitsSold: t.units, orderCount: t.orders.length,
    topProducts: r.topProducts.map((p) => ({ name: p.name, revenue: round(p.revenue), units: p.units })),
    revenueByCategory: r.byCategory.map((c) => ({ category: c._id, revenue: round(c.revenue), units: c.units })),
    topDeliveryCities: r.byCity.map((c) => ({ city: c._id, orders: c.orders })),
    dailyRevenue: r.timeline.map((d) => ({ date: d._id, revenue: round(d.revenue) })),
  };
}

const getSalesInsights = {
  name: 'get_sales_insights',
  description: 'Sales analytics: revenue, orders, units, top products, revenue by category, top delivery cities, daily revenue, plus a comparison with the previous period of the same length. Sellers see only their own products; admins see the whole platform.',
  roles: ['product_owner', 'root_admin'],
  kind: 'read',
  input: {
    days: z.number().int().min(1).max(365).optional().describe('Look back this many days (default 30)'),
    category: z.string().max(50).optional().describe('Optional category filter, e.g. Kitchen'),
  },
  async run({ days = 30, category }, ctx) {
    const now = new Date();
    const from = new Date(now - days * DAY);
    const previousFrom = new Date(from - days * DAY);

    const current = await salesBetween(ctx, from, now, category);
    const previous = await salesBetween(ctx, previousFrom, from, category);

    const changePct = previous.revenue > 0 ? round(((current.revenue - previous.revenue) / previous.revenue) * 100) : null;
    return {
      scope: ctx.role === 'root_admin' ? 'whole platform' : 'your own products only',
      periodDays: days,
      current,
      previousPeriod: { revenue: previous.revenue, orderCount: previous.orderCount },
      revenueChangePercent: changePct, // null = no sales in the previous period to compare with
    };
  },
};

const getLowStockItems = {
  name: 'get_low_stock_items',
  description: 'List products whose stock is at or below their low-stock threshold. Sellers see only their own products.',
  roles: ['product_owner', 'root_admin'],
  kind: 'read',
  input: { limit: z.number().int().min(1).max(25).optional().describe('Default 10') },
  async run({ limit = 10 }, ctx) {
    const filter = { $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
    if (ctx.role === 'product_owner') filter.ownerId = ctx.userId;
    const items = await Product.find(filter).sort({ stock: 1 }).limit(limit).lean();
    return {
      count: items.length,
      items: items.map((p) => ({ id: String(p._id), name: p.name, category: p.category, stock: p.stock, threshold: p.lowStockThreshold })),
    };
  },
};

module.exports = [getSalesInsights, getLowStockItems];
