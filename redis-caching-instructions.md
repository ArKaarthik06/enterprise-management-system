# Add-on Instructions: Redis Caching

Add Redis as a caching layer to the existing enterprise marketplace project. Redis is a derived/temporary store only — MongoDB remains the source of truth for everything. Nothing should ever be readable only from Redis; every cached value must be reconstructible from MongoDB if the cache is empty or cleared.

## 1. Setup

- Add `redis` as a dependency and a `config/redis.js` module that creates and connects a single shared client on app startup, with an `error` event handler that logs failures without crashing the app.
- All caching must degrade gracefully: if Redis is unreachable, the app should fall back to querying MongoDB directly rather than throwing — wrap Redis calls in try/catch and treat a Redis failure the same as a cache miss.

## 2. Pattern to follow everywhere: cache-aside

Every cached read must follow this exact shape — do not invent a different caching pattern:

1. Check Redis for the key.
2. Cache hit → parse and return it, skip MongoDB entirely.
3. Cache miss → query MongoDB, store the result in Redis with an appropriate TTL, then return it.
4. Any write path that changes the underlying data must explicitly invalidate (delete) the relevant Redis key(s) — do not rely on TTL alone as the only invalidation mechanism for data that changes via Kafka consumers or explicit user actions.

## 3. Where to add caching

**a) Analytics (highest priority)**
Cache the day-wise / category-wise / delivery-place aggregation results under keys like `analytics:daily-sales:<date>`, `analytics:category-sales:<category>`, with a 5-minute TTL as a safety net. In addition to the TTL, the `order.placed` Kafka consumer must explicitly delete the relevant analytics keys whenever a new confirmed order changes the underlying numbers, so admins never see stale data for longer than necessary.

**b) Product listing / search**
Cache paginated product list results under keys like `products:page:<page>:category:<category|all>` with a short TTL (~60s). The product update/create service must invalidate all listing-cache keys for that product's category on any create/update/delete (a `KEYS` pattern scan is acceptable at this project's scale).

**c) Product average rating**
Store the recalculated `avgRating` under `product:<productId>:avgRating` from the same async consumer that recalculates it after a new review (do not compute rating synchronously in the request path). The product-detail read path checks Redis first for the rating and falls back to the value stored on the `Product` document if the cache is empty.

**d) Checkout reservation (only if the "hold my cart item" feature is implemented — optional stretch)**
Use `reserved:<productId>:<userId>` with a TTL (~600s) set only if the key doesn't already exist (`NX`), so a reservation can't be silently overwritten. On checkout confirm, run the existing atomic MongoDB stock decrement as the real source of truth, then delete the reservation key regardless of outcome. Do not use the reservation itself to decide whether stock is available — only the atomic MongoDB update decides that.

## 4. What NOT to do

- Do not use Redis to enforce the race-condition fix — that is handled entirely by the atomic `Product.updateOne` with a `$gte` stock filter, independent of caching.
- Do not cache `Order` documents, stock counts as a source of truth, or anything where a stale read could cause incorrect business logic (e.g. never let the "is this in stock" decision read from a cache).
- Do not let a Redis outage break any core flow — every cache read must have a MongoDB fallback path.

## 5. Deliverable

Implement the caching described above with clear TTLs and explicit invalidation calls placed in the same service/consumer functions that already exist for these flows (do not create parallel logic) — add inline comments explaining, for each cached key, why it's safe to cache (data only changes on a known write path) and what invalidates it.
