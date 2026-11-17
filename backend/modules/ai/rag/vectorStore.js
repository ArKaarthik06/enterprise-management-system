// Step 4 of RAG: STORE the chunks and their vectors.
// We use the MongoDB you already have. For a few hundred chunks, comparing vectors in
// JavaScript is fast and easy to read. (For millions of chunks, swap this file for
// MongoDB Atlas Vector Search or Qdrant - nothing else in the project needs to change.)
const AiChunk = require('../models/AiChunk');
const { cosine } = require('./embedder');

async function replaceAll(chunks) {
  await AiChunk.deleteMany({});
  if (chunks.length) await AiChunk.insertMany(chunks);
}

async function count() {
  return AiChunk.countDocuments();
}

// RBAC happens HERE, inside the database filter: chunks the user may not read
// are never even loaded, so they cannot leak by accident.
async function loadCandidates({ allowedAccess, provider, category }) {
  const filter = { access: { $in: allowedAccess }, provider };
  if (category) filter.category = category;
  return AiChunk.find(filter).lean();
}

function rankByVector(candidates, queryVector) {
  return candidates.map((c) => ({ chunk: c, vectorScore: Math.max(0, cosine(c.embedding, queryVector)) }));
}

module.exports = { replaceAll, count, loadCandidates, rankByVector };
