const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const connectDB = require('./config/db');
connectDB();

const passport = require('./config/passport');
app.use(passport.initialize());

// Health check endpoints
app.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[require('mongoose').connection.readyState] || 'unknown';
  res.json({ status: 'ok', database: state });
});
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Enterprise Marketplace Backend API is live' });
});

// Routes
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/products', require('./modules/catalog/routes/product.routes'));
app.use('/api/inventory', require('./modules/inventory/routes/inventory.routes'));
app.use('/api/orders', require('./modules/orders/routes/order.routes'));
app.use('/api/messaging', require('./modules/messaging/routes/messaging.routes'));
app.use('/api/analytics', require('./modules/analytics/routes/analytics.routes'));
app.use('/api/ai', require('./modules/ai/routes/ai.routes')); // AI layer: RAG + MCP + guardrails

// Polling endpoint lives in messaging controller for convenience
const { pollUpdates } = require('./modules/messaging/controllers/messaging.controller');
app.get('/api/dashboard/updates', passport.authenticate('jwt', { session: false }), pollUpdates);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  const kafkaBroker = process.env.KAFKA_BROKER;
  const isCloudLocalKafka = Boolean(process.env.RENDER && (!kafkaBroker || kafkaBroker.includes('localhost')));
  if (kafkaBroker && !isCloudLocalKafka) {
    try {
      const { connectKafkaProducer } = require('./config/kafka');
      const { connectKafkaConsumers } = require('./config/consumers');
      await connectKafkaProducer();
      await connectKafkaConsumers();
    } catch (err) {
      console.warn('Kafka connection warning:', err.message);
    }
  } else {
    console.log('Kafka disabled or set to localhost in cloud; running in cloud standalone mode.');
  }
});
