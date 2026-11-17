// Rate limiting: each user may send a limited number of AI messages per minute.
// Uses Redis when it is available, otherwise a simple in-memory counter.
const config = require('../config/ai.config');
const { redisClient } = require('../../../config/redis');

const memory = new Map(); // fallback: userId -> { count, resetAt }

async function hit(userId) {
  const limit = config.guardrails.rateLimitPerMinute;

  if (redisClient.isReady) {
    try {
      const key = `ai:rate:${userId}`;
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, 60);
      return { allowed: count <= limit, count, limit };
    } catch (e) { /* fall through to memory */ }
  }

  const now = Date.now();
  const entry = memory.get(userId);
  if (!entry || entry.resetAt < now) {
    memory.set(userId, { count: 1, resetAt: now + 60000 });
    return { allowed: true, count: 1, limit };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, count: entry.count, limit };
}

// Express middleware. Must run AFTER authentication so req.user exists.
async function aiRateLimit(req, res, next) {
  const result = await hit(String(req.user.id));
  if (!result.allowed) {
    req.aiRateLimited = true;
    return res.status(429).json({ blocked: true, reason: 'rate_limit', message: 'You are sending messages too fast. Please wait a minute and try again.' });
  }
  next();
}

module.exports = { aiRateLimit, hit };
