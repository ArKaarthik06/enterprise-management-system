    const mongoose = require('mongoose');

// Every AI request is recorded here. We only keep MASKED text (no raw PII).
const auditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  role: String,
  kind: { type: String, enum: ['chat', 'confirm', 'ingest'], default: 'chat' },
  inputMasked: String,
  outcome: { type: String, enum: ['allowed', 'blocked'], default: 'allowed', index: true },
  blockStage: String, // input_filter | injection | rate_limit | output_filter
  blockReason: String,
  injectionScore: Number,
  piiFindings: [{ type: { type: String }, count: Number }],
  toolCalls: [{ name: String, ok: Boolean, kind: String }],
  usage: {
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheCreationTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
  },
  model: String,
  latencyMs: Number,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // auto-delete after 90 days
});

module.exports = mongoose.models.AiAuditLog || mongoose.model('AiAuditLog', auditSchema);
