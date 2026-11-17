const mongoose = require('mongoose');

// One searchable piece of a policy document (a "chunk") plus its embedding vector.
const aiChunkSchema = new mongoose.Schema({
  source: { type: String, required: true, index: true }, // file name, e.g. return-refund-policy.md
  title: { type: String, required: true },
  category: { type: String, default: 'policy', index: true }, // policy | product | internal
  access: { type: String, enum: ['public', 'seller', 'admin'], default: 'public', index: true },
  order: { type: Number, default: 0 }, // position of the chunk inside the document
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  provider: { type: String, required: true }, // which embedder made the vector (local | hash)
}, { timestamps: true });

module.exports = mongoose.models.AiChunk || mongoose.model('AiChunk', aiChunkSchema);
