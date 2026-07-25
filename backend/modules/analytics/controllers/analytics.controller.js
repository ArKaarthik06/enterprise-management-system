const Order = require('../../orders/models/Order');
const Product = require('../../catalog/models/Product');
const { redisClient } = require('../../../config/redis');

// Helper to get analytics data
const getSalesData = async (req) => {
  const userRole = req.user.role;
  let matchStage = { status: 'confirmed' };

  // If product owner, we need to filter orders that contain their products
  // For simplicity at the aggregation level, we'll join with products
  if (userRole === 'product_owner') {
    // Note: in a real huge DB, we'd probably denormalize ownerId onto the Order Item
    // Here we'll use $lookup
  }

  // Pipeline for Daily Sales
  const dailyPipeline = [
    { $match: { status: 'confirmed' } },
    { $unwind: '$items' }
  ];

  if (userRole === 'product_owner') {
    dailyPipeline.push(
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails' } },
      { $unwind: '$productDetails' },
      { $match: { 'productDetails.ownerId': req.user._id } }
    );
  }

  dailyPipeline.push(
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalSales: { $sum: { $multiply: ['$items.quantity', '$items.priceAtPurchase'] } },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  );

  const dailySales = await Order.aggregate(dailyPipeline);

  // Similar pipelines for Category Sales and Delivery Place
  const deliveryPipeline = [
    { $match: { status: 'confirmed' } }
  ];

  if (userRole === 'product_owner') {
    deliveryPipeline.push(
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails' } },
      { $unwind: '$productDetails' },
      { $match: { 'productDetails.ownerId': req.user._id } }
    );
  }

  deliveryPipeline.push(
    {
      $group: {
        _id: { 
          $replaceAll: { 
            input: { $toLower: { $ifNull: ['$deliveryAddress.city', 'unknown'] } }, 
            find: ' ', 
            replacement: '' 
          } 
        },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalOrders: -1 } }
  );

  const deliveryPlace = await Order.aggregate(deliveryPipeline);

  return { dailySales, deliveryPlace };
};

// @desc    Get dashboard analytics
// @route   GET /api/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const role = req.user.role;
    const cacheKey = `analytics:${role}:${req.user._id}:dashboard`;

    if (redisClient.isReady) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Redis read error for analytics:', err);
      }
    }

    const data = await getSalesData(req);

    if (redisClient.isReady) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
      } catch (err) {
        console.error('Redis write error for analytics:', err);
      }
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get AI generated summary of analytics
// @route   GET /api/analytics/ai-summary
exports.getAiSummary = async (req, res) => {
  try {
    if (req.user.role !== 'root_admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const data = await getSalesData(req);
    
    // LLM Placeholder Stub (will be replaced with real API call later)
    const summary = `AI Summary (Placeholder): Overall sales have seen a steady trend. The top performing delivery location is ${data.deliveryPlace[0]?._id || 'unknown'}. We recommend focusing marketing efforts there.`;

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
