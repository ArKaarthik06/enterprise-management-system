const Product = require('../models/Product');
const Review = require('../models/Review');
const { redisClient } = require('../../../config/redis');

// Helper to invalidate product cache
const invalidateProductCache = async (category) => {
  try {
    if (!redisClient.isReady) return;
    const keys = await redisClient.keys(`products:page:*:category:${category}`);
    const allKeys = await redisClient.keys(`products:page:*:category:all`);
    
    const keysToDelete = [...keys, ...allKeys];
    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }
  } catch (err) {
    console.error('Redis cache invalidation error:', err);
  }
};

// @desc    Get all products (paginated, searchable)
// @route   GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 10;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const category = req.query.category || 'all';

    // Skip cache if there's a search query
    const cacheKey = `products:page:${page}:category:${category}`;
    
    if (!search && redisClient.isReady) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Redis read error:', err);
      }
    }

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category !== 'all') {
      query.category = category;
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    const responseData = {
      products,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    };

    if (!search && redisClient.isReady) {
      try {
        // Cache for 60 seconds
        await redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
      } catch (err) {
        console.error('Redis write error:', err);
      }
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviews = await Review.find({ productId: product._id }).populate('userId', 'name');

    let avgRating = product.avgRating;
    if (redisClient.isReady) {
      try {
        const cachedRating = await redisClient.get(`product:${product._id}:avgRating`);
        if (cachedRating) {
          avgRating = parseFloat(cachedRating);
        }
      } catch (err) {
        console.error('Redis read error for avgRating:', err);
      }
    }

    res.json({
      product: { ...product.toObject(), avgRating },
      reviews
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Middleware to pre-fetch product for ownership check
exports.prefetchProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    req.resource = product;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      ownerId: req.user.id
    });
    const createdProduct = await product.save();
    await invalidateProductCache(product.category);
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = req.resource;
    Object.assign(product, req.body);
    const updatedProduct = await product.save();
    await invalidateProductCache(product.category);
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const category = req.resource.category;
    await Product.deleteOne({ _id: req.resource._id });
    await invalidateProductCache(category);
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
exports.createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.id;

    const alreadyReviewed = await Review.findOne({ productId, userId: req.user.id });
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }

    const review = await Review.create({
      rating: Number(rating),
      comment,
      productId,
      userId: req.user.id
    });

    const { publishEvent } = require('../../../config/kafka');
    await publishEvent('review.created', productId, {
      productId,
      rating: Number(rating)
    });

    res.status(201).json({ message: 'Review added', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
