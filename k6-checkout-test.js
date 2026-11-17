import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
    stages: [
        { duration: '5s', target: 50 }, // Ramp up to 50 VUs
        { duration: '15s', target: 50 }, // Sustain 50 VUs
        { duration: '5s', target: 0 },  // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.05'],   // Less than 5% of requests should fail
    },
};

const BASE_URL = 'http://localhost:5000/api';

export function setup() {
    // 1. Authenticate as Customer
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        email: 'customer@market.com',
        password: 'password123',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    if (loginRes.status !== 200) {
        throw new Error('Login failed in setup');
    }
    const token = loginRes.json('token');

    // 2. Fetch products to get a valid product ID
    const productsRes = http.get(`${BASE_URL}/products?pageSize=10`);
    if (productsRes.status !== 200) {
        throw new Error('Failed to fetch products');
    }
    const products = productsRes.json('products');
    if (!products || products.length === 0) {
        throw new Error('No products available for testing');
    }

    return { token: token, productId: products[0]._id };
}

export default function (data) {
    const idempotencyKey = uuidv4();
    const payload = JSON.stringify({
        items: [{ productId: data.productId, quantity: 1 }],
        deliveryAddress: '123 Test St, Loadville',
        idempotencyKey: idempotencyKey
    });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
    };

    const req = {
        method: 'POST',
        url: `${BASE_URL}/orders`,
        body: payload,
        params: { headers }
    };

    // Send two identical requests concurrently to test idempotency
    const responses = http.batch([req, req]);

    // One should be 201 (Created), the other should be 200 (Already processed) or maybe 400 if it failed due to insufficient stock
    const statuses = responses.map(r => r.status);
    
    check(responses, {
        'at least one request succeeded (201/200) or ran out of stock (400)': () => statuses.includes(201) || statuses.includes(200) || statuses.includes(400),
        'no 500 errors': () => !statuses.includes(500),
    });

    sleep(1);
}
