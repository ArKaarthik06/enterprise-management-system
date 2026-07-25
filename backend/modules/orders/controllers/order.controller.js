const Order = require('../models/Order');
const Product = require('../../catalog/models/Product');
const { publishEvent } = require('../../../config/kafka');
const { redisClient } = require('../../../config/redis');

// @desc    Place a new order
// @route   POST /api/orders
exports.placeOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, idempotencyKey } = req.body;
    const buyerId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ message: 'Idempotency key is required' });
    }

    // Optional: check if idempotency key was already used in a recent cache (we'll keep it simple and check Order collection or rely on client correctly generating it)
    // In production, we'd check a fast store like Redis for idempotency key locking.

    // Calculate total and prepare items for the order document
    const orderItems = [];
    const successfulDecrements = [];
    let orderFailed = false;

    // Day 11: Race-condition handling (Atomic `$inc` updates)
    // 1. For each line item run a single atomic MongoDB update
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        orderFailed = true;
        break;
      }

      // Atomic update
      const result = await Product.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );

      if (result.modifiedCount === 0) {
        // The stock check and decrement failed
        orderFailed = true;
        break;
      }

      // Push to successful list in case we need to rollback
      successfulDecrements.push({
        productId: item.productId,
        quantity: item.quantity,
      });

      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        priceAtPurchase: product.price
      });
    }

    // 2. Compensating rollback if one fails
    if (orderFailed) {
      for (const decrement of successfulDecrements) {
        await Product.updateOne(
          { _id: decrement.productId },
          { $inc: { stock: decrement.quantity } }
        );
      }

      // 3. Branch on outcome: Failure
      const failedOrder = await Order.create({
        buyerId,
        items: orderItems.length > 0 ? orderItems : items.map(i => ({ productId: i.productId, quantity: i.quantity, priceAtPurchase: 0 })), // save what we tried
        deliveryAddress,
        status: 'failed',
        failureReason: 'out_of_stock'
      });

      // publish order.failed to Kafka
      await publishEvent('order.failed', failedOrder._id, failedOrder);

      return res.status(400).json({ 
        message: 'Order failed due to insufficient stock', 
        orderId: failedOrder._id 
      });
    }

    // 3. Branch on outcome: Success
    const newOrder = await Order.create({
      buyerId,
      items: orderItems,
      deliveryAddress,
      status: 'confirmed'
    });

    // publish order.placed to Kafka
    await publishEvent('order.placed', newOrder._id, newOrder);

    // Kafka does not prevent the race condition. The atomic MongoDB update does. 
    // Kafka only fans out the already-safe decision asynchronously.
    
    // Invalidate analytics cache
    if (redisClient.isReady) {
      try {
        const keys = await redisClient.keys('analytics:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } catch (err) {
        console.error('Failed to invalidate analytics cache:', err);
      }
    }
    
    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order history for user
// @route   GET /api/orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order details
// @route   GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyerId: req.user.id })
      .populate('items.productId', 'name images category');
      
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
