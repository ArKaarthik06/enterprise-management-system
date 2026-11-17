# Enterprise Marketplace

This project implements a MERN-stack enterprise e-commerce marketplace featuring Event-Driven Architecture (Kafka), Caching (Redis), and rigorous race-condition handling.

## Stack
- MongoDB (Mongoose)
- Express.js (Node.js)
- React (Vite)
- Kafka (Event Broker)
- Redis (Caching)
- Passport.js (JWT Auth)

## Setup & Run

### Backend
1. `cd backend`
2. `npm install`
3. Ensure MongoDB, Redis, and Kafka are running locally.
4. `npm run dev`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Seeding Data
Run `node backend/scripts/seed.js` to populate the database with a root admin, a product owner, a customer, and some products. Note: Passwords are set to `password123`.

## Race Condition Test

To test the race condition logic for the last unit in stock:
1. Seed the DB and find a product with `stock: 1` (e.g., Wireless Mouse).
2. Log in as a customer and get your JWT token.
3. Update `backend/scripts/race-test.js` with the token and product ID.
4. Run `node backend/scripts/race-test.js`.

You will observe 3 concurrent requests firing at the exact same time. The atomic MongoDB update (`$inc` with `$gte` stock condition) ensures that only one request will succeed, and the other two will cleanly fail with an "out_of_stock" failure reason, without double-selling the item.

## AI Assistant (RAG + MCP + Guardrails)

A role-aware AI assistant is built on top of the platform: policy Q&A with RAG, database tools through MCP (including order placement with human confirmation), prompt-injection defence, PII masking and prompt caching. See [backend/modules/ai/README.md](backend/modules/ai/README.md) for the architecture, setup (`LLM_API_KEY`, `npm run ai:ingest`) and example prompts. Run its tests with `cd backend && npm run ai:test`.
