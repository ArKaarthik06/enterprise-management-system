const { kafka, publishEvent } = require('./kafka');
const { redisClient } = require('./redis');
const Message = require('../modules/messaging/models/Message');
const Product = require('../modules/catalog/models/Product');
const User = require('../modules/auth/models/User');

const consumer = kafka.consumer({ groupId: 'enterprise-group' });

// In-memory idempotency check (In production, use Redis or DB for persistence)
const processedMessages = new Set();

const connectKafkaConsumers = async () => {
  try {
    await consumer.connect();
    console.log('Kafka Consumer connected');

    await consumer.subscribe({ topic: 'order.placed', fromBeginning: true });
    await consumer.subscribe({ topic: 'order.failed', fromBeginning: true });
    await consumer.subscribe({ topic: 'inventory.updated', fromBeginning: true });
    await consumer.subscribe({ topic: 'inventory.low-stock', fromBeginning: true });
    await consumer.subscribe({ topic: 'message.sent', fromBeginning: true });
    await consumer.subscribe({ topic: 'review.created', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const key = message.key?.toString();
        const value = JSON.parse(message.value.toString());

        // Idempotency check
        if (key && processedMessages.has(`${topic}-${key}`)) {
          console.log(`Skipping duplicate message ${key} for topic ${topic}`);
          return;
        }

        try {
          switch (topic) {
            case 'inventory.low-stock':
              await handleLowStockEvent(value);
              break;
            case 'order.placed':
              await handleOrderPlacedEvent(value);
              break;
            case 'order.failed':
              await handleOrderFailedEvent(value);
              break;
            case 'inventory.updated':
              // Handle analytics cache invalidation etc.
              break;
            case 'message.sent':
              // read model update only
              break;
            case 'review.created':
              await handleReviewCreatedEvent(value);
              break;
          }
          if (key) processedMessages.add(`${topic}-${key}`);
        } catch (err) {
          console.error(`Error processing message from topic ${topic}:`, err);
          // Dead Letter Queue
          await publishEvent(`${topic}.dlq`, key || 'dlq', { originalMessage: value, error: err.message });
        }
      },
    });
  } catch (err) {
    console.error('Error in Kafka Consumers', err);
  }
};

const handleLowStockEvent = async (data) => {
  const { productId, productName, stock, ownerId } = data;
  
  // Find root admins to notify as well
  const rootAdmins = await User.find({ role: 'root_admin' });
  const recipients = [ownerId, ...rootAdmins.map(admin => admin._id)];

  await Message.create({
    senderId: 'system',
    recipients,
    body: `Product "${productName}" is low on stock! Only ${stock} left.`,
    metadata: {
      type: 'low_stock',
      productId,
      productName
    }
  });
};

const handleOrderPlacedEvent = async (order) => {
  // Invalidate Redis analytics cache
  if (redisClient.isReady) {
    try {
      const keys = await redisClient.keys('analytics:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      console.error('Redis error invalidating analytics cache:', err);
    }
  }

  // Send notification to buyer
  await Message.create({
    senderId: 'system',
    recipients: [order.buyerId],
    body: `Your order has been placed successfully!`,
    metadata: {
      type: 'system'
    }
  });
};

const handleOrderFailedEvent = async (order) => {
  await Message.create({
    senderId: 'system',
    recipients: [order.buyerId],
    body: `Your order failed. Reason: ${order.failureReason}. Any charges have been voided.`,
    metadata: {
      type: 'system'
    }
  });
};

const handleReviewCreatedEvent = async (data) => {
  const { productId } = data;
  const Review = require('../modules/catalog/models/Review');
  
  const reviews = await Review.find({ productId });
  const totalRating = reviews.reduce((acc, rev) => acc + rev.rating, 0);
  const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

  // Update MongoDB
  await Product.updateOne({ _id: productId }, { avgRating: Number(avgRating) });

  // Update Redis Cache
  if (redisClient.isReady) {
    try {
      await redisClient.set(`product:${productId}:avgRating`, avgRating);
    } catch (err) {
      console.error('Redis error caching avgRating:', err);
    }
  }
};

module.exports = { connectKafkaConsumers };
