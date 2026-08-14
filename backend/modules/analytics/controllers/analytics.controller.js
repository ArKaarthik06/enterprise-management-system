const Order = require('../../orders/models/Order');
const Product = require('../../catalog/models/Product');
const { redisClient } = require('../../../config/redis');

const getSalesData = async (req) => {
  const userRole = req.user.role;
  const { startDate, endDate, category, interval = 'day' } = req.query;

  let matchStage = { status: { $in: ['confirmed', 'delivered'] } };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  // Pipeline base
  const pipeline = [
    { $match: matchStage },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails' } },
    { $unwind: '$productDetails' }
  ];

  if (userRole === 'product_owner') {
    pipeline.push({ $match: { 'productDetails.ownerId': req.user._id } });
  }

  if (category && category !== 'all') {
    pipeline.push({ $match: { 'productDetails.category': category } });
  }

  // 1. Time Series (Daily/Monthly Sales)
  const dateFormat = interval === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const timeSeriesPipeline = [
    ...pipeline,
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        totalSales: { $sum: { $multiply: ['$items.quantity', '$items.priceAtPurchase'] } },
        totalOrders: { $sum: 1 } // Approximates order line items
      }
    },
    { $sort: { _id: 1 } }
  ];

  // 2. Delivery Locations
  const deliveryPipeline = [
    ...pipeline,
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
    { $sort: { totalOrders: -1 } },
    { $limit: 10 }
  ];

  // 3. Category Sales
  const categoryPipeline = [
    ...pipeline,
    {
      $group: {
        _id: '$productDetails.category',
        totalSales: { $sum: { $multiply: ['$items.quantity', '$items.priceAtPurchase'] } }
      }
    }
  ];

  const [dailySales, deliveryPlace, categorySales] = await Promise.all([
    Order.aggregate(timeSeriesPipeline),
    Order.aggregate(deliveryPipeline),
    Order.aggregate(categoryPipeline)
  ]);

  return { dailySales, deliveryPlace, categorySales };
};

// @desc    Get dashboard analytics
// @route   GET /api/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const role = req.user.role;
    const { startDate, endDate, category, interval } = req.query;
    const cacheKey = `analytics:${role}:${req.user._id}:dashboard:${startDate || 'all'}:${endDate || 'all'}:${category || 'all'}:${interval || 'day'}`;

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
    
    // Call Gemini API directly
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ summary: "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file." });
    }

    const prompt = `You are an expert e-commerce data analyst. Review the following sales analytics data and provide a concise, insightful 3-4 sentence summary of the key trends and actionable recommendations. Do not use markdown. Data: ${JSON.stringify(data)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate summary from AI response.';

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get raw paginated orders for table
// @route   GET /api/analytics/orders
exports.getOrdersTable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const userRole = req.user.role;
    
    // Auto-update orders older than 24h from confirmed to delivered
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Order.updateMany(
      { status: 'confirmed', createdAt: { $lt: oneDayAgo } },
      { $set: { status: 'delivered' } }
    );

    // For root admin, just get all orders
    if (userRole === 'root_admin') {
      const orders = await Order.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyerId', 'name email')
        .populate('items.productId', 'name category price images ownerId');
      const total = await Order.countDocuments();
      return res.json({ orders, total, page, pages: Math.ceil(total / limit) });
    }
    
    // For product owner, we must aggregate to find orders containing their products
    const pipeline = [
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails' } },
      { $unwind: '$productDetails' },
      { $match: { 'productDetails.ownerId': req.user._id } },
      {
        $group: {
          _id: '$_id',
          buyerId: { $first: '$buyerId' },
          status: { $first: '$status' },
          createdAt: { $first: '$createdAt' },
          items: {
            $push: {
              productId: {
                _id: '$productDetails._id',
                name: '$productDetails.name',
                category: '$productDetails.category',
                price: '$productDetails.price',
                images: '$productDetails.images',
                ownerId: '$productDetails.ownerId'
              },
              quantity: '$items.quantity',
              priceAtPurchase: '$items.priceAtPurchase'
            }
          },
          deliveryAddress: { $first: '$deliveryAddress' }
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    
    const countPipeline = [
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'productDetails' } },
      { $unwind: '$productDetails' },
      { $match: { 'productDetails.ownerId': req.user._id } },
      { $group: { _id: '$_id' } },
      { $count: 'total' }
    ];

    const ordersAgg = await Order.aggregate(pipeline);
    const countAgg = await Order.aggregate(countPipeline);
    const total = countAgg.length > 0 ? countAgg[0].total : 0;
    
    // Optionally populate buyer info via a second query or $lookup
    const buyerIds = ordersAgg.map(o => o.buyerId);
    const User = require('../../auth/models/User');
    const buyers = await User.find({ _id: { $in: buyerIds } }, 'name email');
    
    const orders = ordersAgg.map(o => {
      o.buyerId = buyers.find(b => b._id.toString() === o.buyerId.toString());
      return o;
    });

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
