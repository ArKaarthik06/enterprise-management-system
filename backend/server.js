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

// Routes
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/products', require('./modules/catalog/routes/product.routes'));
app.use('/api/inventory', require('./modules/inventory/routes/inventory.routes'));
app.use('/api/orders', require('./modules/orders/routes/order.routes'));
app.use('/api/messaging', require('./modules/messaging/routes/messaging.routes'));
app.use('/api/analytics', require('./modules/analytics/routes/analytics.routes'));

// Polling endpoint lives in messaging controller for convenience
const { pollUpdates } = require('./modules/messaging/controllers/messaging.controller');
app.get('/api/dashboard/updates', passport.authenticate('jwt', { session: false }), pollUpdates);

const { connectKafkaProducer } = require('./config/kafka');
const { connectKafkaConsumers } = require('./config/consumers');

const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Start Kafka
  await connectKafkaProducer();
  await connectKafkaConsumers();
});
