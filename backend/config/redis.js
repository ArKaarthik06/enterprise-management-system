const { createClient } = require('redis');

let rawUrl = (process.env.REDIS_URL || '').trim().replace(/^["']|["']$/g, '');
if (rawUrl.startsWith('redis-cli -u ')) {
  rawUrl = rawUrl.replace('redis-cli -u ', '').trim();
}

const isHttps = rawUrl.startsWith('https://') || rawUrl.startsWith('http://');
const isLocalhostRedis = !rawUrl || rawUrl.includes('localhost');
const shouldDisableRedis = Boolean(process.env.RENDER && isLocalhostRedis) || isHttps;

let redisClient = { isReady: false };

if (isHttps) {
  console.warn('⚠️ REDIS_URL starts with "https://". Upstash REST API URLs cannot be used with Node-Redis. Please use the "rediss://" connection string (found in the ioredis / Node.js tab in Upstash).');
} else if (!shouldDisableRedis) {
  try {
    redisClient = createClient({
      url: rawUrl || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) return false; // Stop retrying after 2 attempts
          return 500;
        }
      }
    });

    redisClient.on('error', (err) => {
      if (redisClient.isReady) {
        console.warn('Redis Client Warning:', err.message);
      }
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis connected successfully');
    });
  } catch (err) {
    console.warn('Redis initialization error:', err.message);
    redisClient = { isReady: false };
  }
}

const connectRedis = async () => {
  if (shouldDisableRedis || !redisClient.connect) {
    console.log('ℹ Redis disabled, invalid protocol, or localhost in cloud; running in database-direct mode.');
    return;
  }
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('ℹ Redis connection unavailable (graceful degradation):', err.message);
  }
};

module.exports = {
  redisClient,
  connectRedis
};
