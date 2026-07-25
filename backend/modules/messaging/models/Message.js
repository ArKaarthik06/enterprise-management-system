const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.Mixed, // Can be ObjectId or String ("system")
    required: true,
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  body: {
    type: String,
    required: true,
  },
  metadata: {
    type: {
      type: String,
      enum: ['low_stock', 'system', 'user'],
      default: 'user'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    productName: String,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }]
}, { timestamps: true });

// Required index for polling queries
messageSchema.index({ createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
