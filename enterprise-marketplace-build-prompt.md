# Build Prompt: Enterprise Multi-Role E-Commerce Marketplace (MERN)

You are building a full-stack enterprise e-commerce marketplace platform. Follow this specification exactly. Ask no clarifying questions — where a detail is not specified, make the most conventional, production-reasonable choice and note the assumption in a comment.

## 1. Stack & Architecture

- **Stack**: MongoDB, Express, React (plain HTML/CSS for now — no CSS framework), Node.js
- **Architecture**: MVC, structured as a modular monolith with clear module boundaries (Auth, Catalog, Orders, Inventory, Messaging, Analytics) so it could later be split into microservices without a rewrite. Each module owns its own Mongoose models and exposes a service-layer interface; modules must not directly import each other's models.
- **Message broker**: Kafka (or Redpanda for local dev) as the async event backbone. Kafka is used ONLY for async fan-out after a decision has already been made — never for enforcing consistency or serializing writes.
- **No WebSockets/SSE for this phase.** All "live" UI updates (messages panel, low-inventory panel) are done via short-interval polling (`setInterval`, ~7s ± small random jitter to avoid thundering herd) against a `GET /api/dashboard/updates?since=<timestamp>` endpoint. Design the endpoint and consumer-side render logic so a WebSocket push can be swapped in later without changing anything else.
- **No email/external notification service.** All notifications (including system-generated ones like low-stock alerts) are delivered as in-app `Message` documents, visible in the same messages panel as user-to-user messages.

## 2. Roles & RBAC

Three roles: `root_admin`, `product_owner`, `customer`.

- `product_owner` accounts have a `status` field: `pending` | `approved`. On signup, a product owner fills out their details and is created with `status: pending` and no active permissions. They cannot log in to owner features until `root_admin` approves them (approval flips status to `approved`, binds permissions, and triggers an in-app welcome message to the new owner).
- Implement RBAC as centralized middleware (`authorize(permission)`), not scattered `if (role === ...)` checks in controllers. Define a `Permission` set per role (e.g. `product:create`, `product:update:own`, `analytics:view:global`, `analytics:view:own`, `inventory:update:own`, `messaging:send`).
- Separately from role-based authorization, implement **resource-ownership checks** for product owners: a `product_owner` with the right role must still only mutate products where `product.ownerId === req.user.id`. Keep this check as a distinct middleware/service function from the role check.

## 3. Data Models (Mongoose)

- **User**: name, email, passwordHash, role, status (for product_owner), createdAt
- **Product**: ownerId, name, description, category, price, stock, lowStockThreshold (default 5), lowStockAlerted (bool, default false), images[], avgRating (denormalized, recalculated async via Kafka consumer on new review — not synchronously on the request path)
- **Order**: buyerId, items: [{ productId, quantity, priceAtPurchase }], status (`pending` → `confirmed` → `failed` → `shipped` ...), failureReason (nullable, e.g. `out_of_stock`), deliveryAddress { line1, city, state, ... }, createdAt. Index on `createdAt` and `deliveryAddress.city`.
- **Review**: productId, userId, rating, comment, createdAt
- **Message**: senderId (nullable/"system" for system-generated), recipients: [userId], body, metadata (e.g. { type: "low_stock" | "system" | "user", productId, productName }), sentAt, readBy: [userId]
- **InventoryLog**: productId, change, reason, timestamp — audit trail for stock changes, useful for debugging and for "orders lost to stock-outs" analytics

## 4. Race Condition Handling (single-item, last-unit-in-cart scenario)

This is a required, explicitly tested part of the system. Implement it as follows:

1. On order placement, for each line item run a single atomic MongoDB update — never a separate read-then-write:
   ```js
   const result = await Product.updateOne(
     { _id: productId, stock: { $gte: quantity } },
     { $inc: { stock: -quantity } }
   );
   ```
   `matchedCount === 0` means the stock check and the decrement happened as one atomic operation and failed — there is no window where two concurrent requests both "see" stock as available.
2. If the order has multiple line items and one item's atomic update fails after others already succeeded, run a compensating rollback (increment those products' stock back) before marking the order failed — implement this explicitly as a small saga, not an afterthought.
3. Branch on the outcome:
   - Success → set order status `confirmed`, publish `order.placed` to Kafka.
   - Failure → set order status `failed`, failureReason `out_of_stock`, publish `order.failed` to Kafka. Release any reservation record for that buyer/product if one exists. Void/cancel any payment pre-authorization (do not "capture then refund" — authorize at checkout, capture only after `order.placed` succeeds).
4. Be precise in code comments: Kafka does not prevent the race condition. The atomic MongoDB update does. Kafka only fans out the already-safe decision asynchronously.
5. Optional stretch (implement if time allows, otherwise stub the interface): a Redis-backed reservation with short TTL created at checkout-start, so a buyer doesn't lose an item mid-checkout to a faster buyer; convert to the real decrement above on submit, release on expiry or cancel.

## 5. Kafka Topics & Consumers

| Topic | Producer | Consumers |
|---|---|---|
| `order.placed` | Order service | Inventory service, Notification service, Analytics service |
| `order.failed` | Order service | Notification service (refund + notify buyer flow) |
| `inventory.updated` | Inventory service | Analytics service |
| `inventory.low-stock` | Inventory service (fires once when stock crosses at-or-below `lowStockThreshold`; resets `lowStockAlerted` to false when restocked above threshold) | Notification service |
| `message.sent` | Messaging service | (read model update only — no external consumer needed without WebSockets) |

All consumers must be idempotent — key on `orderId` or an equivalent idempotency key — since Kafka delivers at-least-once and messages may be replayed.

The `inventory.low-stock` consumer creates a `Message` document directly (sender: `"system"`, recipients: [productOwnerId, rootAdminId], body includes product name, remaining stock, and owner details, metadata.type = `"low_stock"`). This must appear in the same messages panel UI as regular messages, optionally with a distinct visual style keyed on `metadata.type`.

## 6. API surface (minimum required endpoints)

- Auth: signup (customer / product_owner-pending), login, root-admin approve-owner
- Products: list (paginated, searchable), get by id (with reviews + avgRating + stock), create/update/delete (owner-scoped), add review
- Orders: place order (runs the atomic race-condition flow above), get order history
- Inventory: update stock (owner-scoped), low-stock list (root admin: global; owner: own products only)
- Analytics: day-wise sales, category-wise sales, delivery-place breakdown — as aggregation pipelines (`$group`/`$match`/`$sort`), scoped globally for root admin and to own products for product owners
- AI analytics: an endpoint that takes the aggregated sales JSON and returns an LLM-generated natural-language summary (e.g. "Category X grew 18% this week, driven by Y") — this is the actual "AI" part; the charts/tables themselves are plain aggregation, not ML
- Messaging: send message (to one or more recipients via checkboxes), list messages, polling endpoint for updates since a timestamp

## 7. Frontend

**Design**: clean UI, Amazon-like color scheme (dark navy header, orange/yellow accent for CTAs, white content areas). Plain HTML/CSS, no framework, for this phase.

**Navbar** changes by role:
- Customer: logout, signup/login, cart icon
- Product owner / root admin: dashboard link (in addition to logout)

**Landing page**: all products, paginated, with a search bar. Clicking a product opens a details view: description, price, stock remaining, comments/reviews with ratings, add-to-cart.

**Signup**: product owner signup collects details but account stays inactive until root admin approves it from the admin dashboard.

**Dashboard page** (shared shell for both admin roles, content scoped by role):
- Top quarter of the page: messages panel + low-inventory panel side by side.
  - Messages panel has a "send message" button top-right that opens an in-page form with a blurred page background, a text field, and a recipient checklist. Each message shows sent date/time.
  - Low-inventory panel lists products at/below threshold (global for root admin, own-products-only for product owner).
- Below that: tabs to switch between **Analytics** (charts) and **Tabular view** (data table). Tabular view lives on a "details" sub-page under the dashboard, reached via tab switch, not a separate nav item.
  - Root admin analytics/table: day-wise sales, monthly sales, filterable by product category; table columns include order placed date, quantity, delivery place.
  - Product owner analytics/table: same shape, scoped to their own products only.
  - Root admin only: an additional **AI analytics** tab that calls the AI-analytics endpoint and renders the generated summary alongside the existing charts.

## 8. Non-functional requirements to implement, not just design

- Idempotency key (client-generated UUID) on the order-placement endpoint to guard against duplicate submissions from double-clicks/retries — separate from Kafka-level consumer idempotency.
- Index `Message` and `InventoryLog` on `createdAt` (the polling endpoint's `since=` query depends on this).
- Cache/pre-aggregate heavy analytics queries where reasonable; keep them off the primary order-write path.
- Dead-letter handling for Kafka consumers: a failed message should route to a DLQ topic / retry log, not disappear silently.

## 9. Deliverable expectations

Produce working code organized by MVC layers per module (routes/controllers/services/models), a seed script for demo data (a few product owners, products across categories, a root admin), and a short README documenting the race-condition test (how to simulate two concurrent orders for the last unit and see one succeed / one fail cleanly).
