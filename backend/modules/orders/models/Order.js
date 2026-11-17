const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtPurchase: {
      type: Number,
      required: true,
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  failureReason: {
    type: String,
    default: null,
  },
  idempotencyKey: {
    type: String,
    required: true
  },
  deliveryAddress: {
    line1: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  }
}, { timestamps: true });

// Required indexes
orderSchema.index({ createdAt: 1 });
orderSchema.index({ 'deliveryAddress.city': 1 });
// Create a unique index for idempotency
orderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
