const Order = require('../models/Order');
const Product = require('../../catalog/models/Product');
const { publishEvent } = require('../../../config/kafka');
const { redisClient } = require('../../../config/redis');
const { checkAndFireLowStock } = require('../../inventory/utils/stockLogic');

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

    // Create order in 'pending' state first to lock idempotency key
    let currentOrder;
    try {
      currentOrder = await Order.create({
        buyerId,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, priceAtPurchase: 0 })),
        deliveryAddress,
        idempotencyKey,
        status: 'pending'
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key error, idempotency key already used
        const existingOrder = await Order.findOne({ buyerId, idempotencyKey });
        return res.status(200).json({ message: 'Order already processed', order: existingOrder });
      }
      throw err;
    }

    // Calculate total and prepare items for the order document
    const orderItems = [];
    const successfulDecrements = [];
    const productsToSaveForLowStock = [];
    let orderFailed = false;

    // Day 11: Race-condition handling (Atomic `$inc` updates)
    // 1. For each line item run a single atomic MongoDB update
    for (const item of items) {
      const productPreCheck = await Product.findById(item.productId);
      if (!productPreCheck) {
        orderFailed = true;
        break;
      }

      // Atomic update
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true } // get post-update document
      );

      if (!updatedProduct) {
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
        productId: updatedProduct._id,
        quantity: item.quantity,
        priceAtPurchase: updatedProduct.price
      });

      // Check if this purchase pushed the product below the low stock threshold
      const needsSave = await checkAndFireLowStock(updatedProduct);
      if (needsSave) {
        productsToSaveForLowStock.push(updatedProduct);
      }
    }

    // 2. Compensating rollback if one fails
    if (orderFailed) {
      for (const decrement of successfulDecrements) {
        const rolledBackProduct = await Product.findOneAndUpdate(
          { _id: decrement.productId },
          { $inc: { stock: decrement.quantity } },
          { new: true }
        );
        if (rolledBackProduct) {
          const needsSave = await checkAndFireLowStock(rolledBackProduct);
          if (needsSave) await rolledBackProduct.save();
        }
      }

      // 3. Branch on outcome: Failure
      currentOrder.status = 'failed';
      currentOrder.failureReason = 'out_of_stock';
      await currentOrder.save();

      // publish order.failed to Kafka
      await publishEvent('order.failed', currentOrder._id.toString(), currentOrder);

      return res.status(400).json({ 
        message: 'Order failed due to insufficient stock', 
        orderId: currentOrder._id 
      });
    }

    // Save any products that tripped their low stock threshold during successful purchase
    for (const p of productsToSaveForLowStock) {
      await p.save();
    }

    // 3. Branch on outcome: Success
    currentOrder.items = orderItems;
    currentOrder.status = 'confirmed';
    await currentOrder.save();

    // publish order.placed to Kafka
    await publishEvent('order.placed', currentOrder._id.toString(), currentOrder);

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
    
    res.status(201).json({ message: 'Order placed successfully', order: currentOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order history for user
// @route   GET /api/orders
exports.getMyOrders = async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await Order.updateMany(
      { buyerId: req.user.id, status: 'confirmed', createdAt: { $lt: oneDayAgo } },
      { $set: { status: 'delivered' } }
    );

    const orders = await Order.find({ buyerId: req.user.id })
      .populate('items.productId', 'name images category')
      .sort({ createdAt: -1 });
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
