const mongoose = require('mongoose');

// When the AI wants to DO something (place an order, cancel, change stock) it does not run it.
// It saves a "pending action" here. Only the human pressing Confirm in the UI can run it.
const pendingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tool: { type: String, required: true },
  args: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: { type: String, required: true }, // human readable, e.g. "Order 2 x Blender for $300"
  status: { type: String, enum: ['pending', 'executed', 'cancelled', 'failed'], default: 'pending' },
  resultMessage: String,
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Mongo deletes it after expiry
}, { timestamps: true });

module.exports = mongoose.models.AiPendingAction || mongoose.model('AiPendingAction', pendingSchema);
