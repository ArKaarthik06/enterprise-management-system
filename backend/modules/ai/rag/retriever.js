// Step 5 of RAG: RETRIEVE. Given a question, find the best chunks the user is allowed to read.
// "Hybrid" search = meaning match (vector) + exact word match (keyword), blended together.
const crypto = require('crypto');
const config = require('../config/ai.config');
const { embed, getProvider, tokenize } = require('./embedder');
const vectorStore = require('./vectorStore');
const { allowedDocumentLevels } = require('../guardrails/rbacPolicy');
const { redisClient } = require('../../../config/redis');

const CACHE_PREFIX = 'ai:rag:';

// Keyword score: what share of the question's (rare) words appear in the chunk? Range 0..1.
function keywordScores(queryTokens, candidates) {
  const docs = candidates.map((c) => new Set(tokenize(c.text)));
  // rare words count more (inverse document frequency)
  const idf = {};
  for (const t of new Set(queryTokens)) {
    const df = docs.filter((d) => d.has(t)).length;
    idf[t] = Math.log(1 + (docs.length + 1) / (df + 1));
  }
  const total = Object.values(idf).reduce((a, b) => a + b, 0) || 1;
  return docs.map((d) => {
    let hit = 0;
    for (const t of Object.keys(idf)) if (d.has(t)) hit += idf[t];
    return hit / total;
  });
}

async function searchKnowledge({ query, role, category, topK = config.rag.topK }) {
  const allowedAccess = allowedDocumentLevels(role);

  // Redis cache: the same question from the same access level gives the same chunks.
  const cacheKey = CACHE_PREFIX + crypto.createHash('sha1')
    .update(JSON.stringify([query.toLowerCase().trim(), allowedAccess, category || '', topK]))
    .digest('hex');
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* cache problems must never break search */ }
  }

  const provider = await getProvider();
  const candidates = await vectorStore.loadCandidates({ allowedAccess, provider, category });
  if (!candidates.length) return [];

  const queryVector = await embed(query);
  const vectorRanked = vectorStore.rankByVector(candidates, queryVector);
  const kw = keywordScores(tokenize(query), candidates);

  const results = vectorRanked
    .map((r, i) => ({
      source: r.chunk.source,
      title: r.chunk.title,
      category: r.chunk.category,
      text: r.chunk.text,
      score: Number((config.rag.vectorWeight * r.vectorScore + config.rag.keywordWeight * kw[i]).toFixed(4)),
    }))
    .filter((r) => r.score >= config.rag.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (redisClient.isReady) {
    try { await redisClient.set(cacheKey, JSON.stringify(results), { EX: config.rag.cacheSeconds }); } catch (e) { /* ignore */ }
  }
  return results;
}

async function clearSearchCache() {
  if (!redisClient.isReady) return;
  try {
    const keys = await redisClient.keys(`${CACHE_PREFIX}*`);
    if (keys.length) await redisClient.del(keys);
  } catch (e) { /* ignore */ }
}

module.exports = { searchKnowledge, clearSearchCache };
