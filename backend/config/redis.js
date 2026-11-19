const { createClient } = require('redis');

const isLocalhostRedis = !process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost');
const shouldDisableRedis = Boolean(process.env.RENDER && isLocalhostRedis);

let redisClient = { isReady: false };

if (!shouldDisableRedis) {
  try {
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
    console.log('ℹ Redis disabled or localhost in cloud; running in database-direct mode.');
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
