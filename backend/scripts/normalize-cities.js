const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../modules/orders/models/Order');

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('MongoDB Connected');
  
  try {
    const orders = await Order.find({ 'deliveryAddress.city': { $exists: true } });
    let updatedCount = 0;
    
    for (const order of orders) {
      if (order.deliveryAddress && order.deliveryAddress.city) {
        const normalized = order.deliveryAddress.city.trim().toLowerCase().replace(/\s+/g, '');
        if (order.deliveryAddress.city !== normalized) {
          await Order.collection.updateOne(
            { _id: order._id },
            { $set: { 'deliveryAddress.city': normalized } }
          );
          updatedCount++;
        }
      }
    }
    console.log(`Successfully normalized ${updatedCount} orders.`);
  } catch (error) {
    console.error('Error normalizing cities:', error);
  } finally {
    process.exit(0);
  }
}).catch(err => {
  console.error(err);
  process.exit(1);
});
