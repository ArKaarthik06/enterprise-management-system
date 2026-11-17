const { createClient } = require('redis');

const isLocalhostRedis = !process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost');
const shouldDisableRedis = Boolean(process.env.RENDER && isLocalhostRedis);

let redisClient = { isReady: false };

if (!shouldDisableRedis) {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 2) return false; // Stop retrying after 2 attempts
        return 500;
      }
    }
  });

  redisClient.on('error', (err) => {
    if (redisClient.isReady) {
      console.warn('Redis Client Error:', err.message);
    }
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });
}

const connectRedis = async () => {
  if (shouldDisableRedis || !redisClient.connect) return;
  try {
    await redisClient.connect();
  } catch (err) {
    // Graceful degradation
  }
};

module.exports = {
  redisClient,
  connectRedis
};
