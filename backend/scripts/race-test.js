const axios = require('axios');

// To run this test:
// 1. Start the server (npm start in backend)
// 2. Ensure you have seeded data and have a customer token
// 3. Update the TOKEN and PRODUCT_ID below
// 4. Run `node race-test.js`

const TOKEN = 'PLACE_CUSTOMER_JWT_TOKEN_HERE';
const PRODUCT_ID = 'PLACE_PRODUCT_ID_WITH_STOCK_1_HERE';

const placeOrder = async (workerId) => {
  try {
    console.log(`Worker ${workerId} attempting to place order...`);
    const res = await axios.post('http://localhost:5000/api/orders', {
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      deliveryAddress: { city: 'Test City' },
      idempotencyKey: `test-key-${workerId}-${Date.now()}`
    }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`Worker ${workerId} SUCCESS:`, res.data.message);
  } catch (err) {
    console.log(`Worker ${workerId} FAILED:`, err.response?.data?.message || err.message);
  }
};

const runRaceTest = async () => {
  console.log('--- Starting Race Condition Test ---');
  // Fire 3 concurrent requests for 1 remaining stock
  await Promise.all([
    placeOrder(1),
    placeOrder(2),
    placeOrder(3)
  ]);
  console.log('--- Test Complete ---');
};

runRaceTest();
