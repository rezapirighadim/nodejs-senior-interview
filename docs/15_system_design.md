# System Design -- Senior Interview Reference

## Table of Contents

- [4-Step Interview Framework](#4-step-interview-framework)
- [Back-of-Envelope Calculations](#back-of-envelope-calculations)
- [Building Blocks](#building-blocks)
- [API Design](#api-design)
- [Database Design](#database-design)
- [Caching Strategies](#caching-strategies)
- [Microservices Patterns](#microservices-patterns)
- [Event-Driven Architecture](#event-driven-architecture)
- [Reliability Patterns](#reliability-patterns)
- [Observability](#observability)
- [Security](#security)
- [Scaling Patterns](#scaling-patterns)
- [CAP Theorem](#cap-theorem)
- [ACID vs BASE](#acid-vs-base)
- [Node.js Specific Considerations](#nodejs-specific-considerations)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Estimation Cheat Sheet](#estimation-cheat-sheet)

---

## 4-Step Interview Framework

### Step 1: Clarify Requirements (5 minutes)

Ask targeted questions to narrow scope.

**Functional requirements:**
- What are the core features? (e.g., "Users can post, follow, and see a feed")
- Who are the users? (consumers, businesses, internal)
- What platforms? (web, mobile, API-only)

**Non-functional requirements:**
- Scale: How many users? DAU? Peak QPS?
- Latency: What response time is acceptable? (p99)
- Availability: What uptime? (99.9%, 99.99%?)
- Consistency: Strong or eventual?
- Durability: Can we lose data?

**Constraints:**
- Budget / team size / timeline
- Existing infrastructure
- Regulatory (GDPR, HIPAA)

### Step 2: Estimate Scale (5 minutes)

Back-of-envelope math to size the system (see next section).

### Step 3: High-Level Design (15 minutes)

Draw the architecture: clients, load balancers, services, databases, caches, queues.

```
Client (Web/Mobile)
    │
    ▼
Load Balancer (nginx / ALB)
    │
    ▼
API Gateway / Reverse Proxy
    │
    ├── Auth Service
    ├── User Service ──── PostgreSQL (primary + read replicas)
    ├── Feed Service ──── Redis (cache)
    ├── Notification Svc ── Message Queue (RabbitMQ/Kafka)
    │
    ▼
CDN (static assets, images)
    │
    ▼
Object Storage (S3)
```

### Step 4: Deep Dive (15 minutes)

The interviewer picks components to explore. Be prepared to discuss:
- Database schema and indexing
- API contracts
- Caching strategy and invalidation
- Data partitioning / sharding
- Failure scenarios and mitigation
- Monitoring and alerting

---

## Back-of-Envelope Calculations

### Key Numbers to Memorize

| Metric                     | Value                 |
|----------------------------|-----------------------|
| Seconds in a day           | 86,400 (~100K)        |
| Seconds in a month         | 2.6 million (~2.5M)   |
| Seconds in a year          | 31.5 million (~30M)   |
| 1 million requests/day     | ~12 QPS               |
| 100 million requests/day   | ~1,200 QPS            |
| 1 billion requests/day     | ~12,000 QPS           |

### Latency Numbers

| Operation                  | Latency               |
|----------------------------|-----------------------|
| L1 cache reference         | 0.5 ns                |
| L2 cache reference         | 7 ns                  |
| Main memory reference      | 100 ns                |
| SSD random read            | 150 us (microseconds) |
| HDD random read            | 10 ms                 |
| Network round trip (same DC) | 0.5 ms              |
| Network round trip (cross-continent) | 150 ms      |
| Read 1 MB from SSD         | 1 ms                  |
| Read 1 MB from HDD         | 20 ms                 |
| Read 1 MB from network     | 10 ms                 |

### Storage Estimates

| Data Type                  | Approximate Size      |
|----------------------------|-----------------------|
| UUID                       | 16 bytes              |
| Timestamp                  | 8 bytes               |
| Integer (32-bit)           | 4 bytes               |
| Short string (name)        | 50 bytes              |
| Email                      | 50 bytes              |
| URL                        | 100 bytes             |
| Tweet-sized text           | 280 bytes             |
| Blog post                  | 5 KB                  |
| Thumbnail image            | 30 KB                 |
| Photo (compressed)         | 200 KB                |
| HD Photo                   | 2 MB                  |
| 1-minute video (compressed)| 10 MB                 |

### Example Calculation: Twitter-like Feed

```
Requirements:
- 500M users, 200M DAU
- Each user follows 200 people on average
- Each user creates 2 tweets/day
- Each tweet: 280 chars + metadata = ~500 bytes

QPS:
- Write: 200M users * 2 tweets / 86400 = ~4,600 QPS (writes)
- Read:  200M users * 10 feed views / 86400 = ~23,000 QPS (reads)
- Peak:  2-3x average = ~70,000 read QPS

Storage (per day):
- 200M * 2 tweets * 500 bytes = 200 GB/day
- Per year: 200 GB * 365 = ~73 TB/year

Bandwidth:
- Read: 70,000 QPS * 50 KB (feed page) = 3.5 GB/s outbound
- Write: 4,600 QPS * 500 bytes = 2.3 MB/s inbound
```

---

## Building Blocks

### Load Balancers

```
Layer 4 (Transport)               Layer 7 (Application)
├── Operates on TCP/UDP           ├── Operates on HTTP/HTTPS
├── Faster (no content inspection)├── Can inspect headers, cookies, URL
├── Less flexible                 ├── Content-based routing
├── Example: AWS NLB              ├── SSL termination
└── Use: raw TCP, gaming          ├── Example: AWS ALB, nginx
                                  └── Use: web apps, APIs
```

### CDN (Content Delivery Network)

```javascript
// CDN caches content at edge locations close to users
// Two models:

// Pull CDN: CDN fetches from origin on first request, then caches
// - Simpler to set up
// - First request is slow (origin fetch)
// - Good for: websites, APIs with cacheable responses

// Push CDN: You upload content to CDN proactively
// - More control over what's cached
// - Good for: large static files, video, known content
```

### Caching Layers

```
Request flow with caching:

Client
  │
  ├── Browser cache (HTTP cache headers: Cache-Control, ETag)
  │
  ├── CDN edge cache (static assets, API responses)
  │
  ├── API Gateway cache (response caching by URL)
  │
  ├── Application cache (in-memory: LRU, node-cache)
  │
  ├── Distributed cache (Redis, Memcached)
  │
  └── Database query cache (MySQL query cache, materialized views)
```

### Message Queues

| Feature            | RabbitMQ                    | Apache Kafka               | AWS SQS / BullMQ          |
|--------------------|-----------------------------|----------------------------|----------------------------|
| Model              | Message broker              | Distributed log            | Managed queue / Redis-based|
| Ordering           | Per-queue FIFO              | Per-partition ordering     | FIFO optional / per-queue  |
| Delivery           | At-least-once / at-most-once| At-least-once              | At-least-once              |
| Retention          | Until consumed              | Time-based (days/weeks)    | Until consumed / configurable |
| Throughput         | ~50K msg/s                  | ~1M msg/s                  | Varies                     |
| Use case           | Task queues, RPC            | Event streaming, logs      | Job queues, background tasks |
| Node.js library    | amqplib                     | kafkajs                    | @aws-sdk/sqs / bullmq      |

---

## API Design

### REST Conventions

```
GET    /api/v1/users           - List users (with pagination)
GET    /api/v1/users/:id       - Get single user
POST   /api/v1/users           - Create user
PUT    /api/v1/users/:id       - Full update (replace)
PATCH  /api/v1/users/:id       - Partial update
DELETE /api/v1/users/:id       - Delete user

# Nested resources
GET    /api/v1/users/:id/orders          - User's orders
POST   /api/v1/users/:id/orders          - Create order for user

# Actions that don't map to CRUD
POST   /api/v1/users/:id/verify          - Trigger verification
POST   /api/v1/orders/:id/cancel         - Cancel order

# Filtering, sorting, searching
GET    /api/v1/users?status=active&role=admin
GET    /api/v1/users?sort=-createdAt,name
GET    /api/v1/users?search=alice
GET    /api/v1/users?fields=name,email     - Field selection
```

### Pagination Patterns

```javascript
// Offset-based (simple, but slow for large offsets)
// GET /api/users?page=3&limit=20
{
  "data": [...],
  "pagination": {
    "page": 3,
    "limit": 20,
    "total": 1543,
    "totalPages": 78
  }
}
// SQL: SELECT * FROM users LIMIT 20 OFFSET 40;

// Cursor-based (fast, consistent with real-time data)
// GET /api/users?limit=20&cursor=eyJpZCI6MTAwfQ==
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTIwfQ==",
    "hasMore": true
  }
}
// SQL: SELECT * FROM users WHERE id > 100 ORDER BY id LIMIT 20;

// Keyset pagination (cursor variant)
// GET /api/users?limit=20&after_id=100&after_date=2024-01-15
// SQL: SELECT * FROM users
//      WHERE (created_at, id) > ('2024-01-15', 100)
//      ORDER BY created_at, id LIMIT 20;
```

### Pagination Comparison

| Method    | Pros                              | Cons                                  | Best For                  |
|-----------|-----------------------------------|---------------------------------------|---------------------------|
| Offset    | Simple, supports "jump to page"   | Slow at large offsets, inconsistent   | Admin dashboards, small data |
| Cursor    | Fast, consistent, scales well     | No "jump to page", opaque cursors    | Feeds, infinite scroll    |
| Keyset    | Fast, no offset, deterministic    | Complex multi-column ordering         | Sorted large datasets     |

### Rate Limiting Headers

```javascript
// Standard rate limit response headers
const headers = {
  "X-RateLimit-Limit": "100",         // max requests per window
  "X-RateLimit-Remaining": "95",      // remaining in current window
  "X-RateLimit-Reset": "1640000000",  // UTC epoch when window resets
  "Retry-After": "30",                // seconds to wait (on 429)
};

// Rate limiter middleware (Express + Redis)
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";

const limiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,      // Disable X-RateLimit headers
  keyGenerator: (req) => req.ip, // or req.user.id for authenticated
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
});

// Rate limiting strategies
// Fixed window:   Simple counter reset at intervals (burst at window edges)
// Sliding window: Weighted count across overlapping windows (smoother)
// Token bucket:   Tokens added at fixed rate, consumed per request (allows bursts)
// Leaky bucket:   Requests processed at fixed rate, excess queued (smooth output)
```

---

## Database Design

### SQL vs NoSQL Comparison

| Feature             | SQL (PostgreSQL, MySQL)     | Document (MongoDB)           | Key-Value (Redis)          | Wide-Column (Cassandra)    |
|---------------------|-----------------------------|------------------------------|----------------------------|----------------------------|
| Data model          | Tables with rows/columns    | JSON-like documents          | Key -> value pairs         | Column families            |
| Schema              | Strict, predefined          | Flexible, schema-optional    | Schema-free                | Flexible columns per row   |
| Query language      | SQL                         | MongoDB Query Language       | Simple GET/SET             | CQL (Cassandra Query)      |
| Relationships       | JOINs (strong)              | Embedded or referenced       | None                       | Denormalized               |
| Transactions        | Full ACID                   | Document-level (multi-doc v4+) | Single-key atomic        | Lightweight transactions   |
| Scaling             | Vertical + read replicas    | Horizontal (sharding)        | Horizontal (cluster)       | Horizontal (native)        |
| Consistency         | Strong                      | Configurable                 | Strong (single node)       | Tunable (eventual default) |
| Best for            | Complex queries, relations  | Flexible schemas, rapid dev  | Caching, sessions          | High write throughput       |

### When to Choose What

```
Need complex JOINs and transactions?     -> PostgreSQL / MySQL
Need flexible schema, document storage?  -> MongoDB / DynamoDB
Need blazing-fast caching?               -> Redis / Memcached
Need massive write throughput?           -> Cassandra / ScyllaDB
Need full-text search?                   -> Elasticsearch / OpenSearch
Need time-series data?                   -> TimescaleDB / InfluxDB
Need graph relationships?                -> Neo4j / Amazon Neptune
```

### Sharding Strategies

```
Hash-based sharding:
  shard = hash(userId) % num_shards
  + Even distribution
  - Hard to add/remove shards (reshuffling)
  - Range queries across shards are expensive

Range-based sharding:
  shard_1: users A-M, shard_2: users N-Z
  + Range queries on shard key are efficient
  - Hot spots (uneven data distribution)
  - Need to rebalance as data grows

Directory-based sharding:
  Lookup table maps keys to shards
  + Flexible, easy to rebalance
  - Lookup service is a bottleneck / SPOF
  - Extra hop for every query

Geographic sharding:
  US data in US shard, EU data in EU shard
  + Low latency for regional users
  + Helps with data residency compliance
  - Cross-region queries are complex
```

### Replication

```
Single Leader (Primary-Replica):
  Write -> Primary -> replicate to Replicas
  Read  -> Replicas (or Primary)
  + Simple
  + Read scaling
  - Single write bottleneck
  - Replication lag (eventual consistency for reads)

Multi-Leader:
  Write -> Any leader -> replicate to other leaders
  + Write scaling
  + Geo-distributed writes
  - Conflict resolution is complex
  - Use case: multi-datacenter

Leaderless (Quorum):
  Write -> W nodes must acknowledge
  Read  -> R nodes must respond
  R + W > N ensures consistency
  + High availability
  + No single point of failure
  - Tuning R, W, N is complex
  - Example: Cassandra, DynamoDB
```

### Indexing Strategies

```javascript
// B-Tree index (default in most RDBMS)
// Good for: equality, range, sorting
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_date ON orders(created_at);

// Composite index (column order matters!)
CREATE INDEX idx_user_status_date ON orders(user_id, status, created_at);
// Efficient for: WHERE user_id = X AND status = Y ORDER BY created_at

// Covering index (includes all columns needed)
CREATE INDEX idx_covering ON users(email) INCLUDE (name, avatar_url);
// SELECT name, avatar_url FROM users WHERE email = '...' -- index-only scan

// Partial index (index only matching rows)
CREATE INDEX idx_active_users ON users(email) WHERE active = true;
// Smaller index, faster for common queries

// Full-text index
CREATE INDEX idx_posts_search ON posts USING GIN(to_tsvector('english', body));
```

---

## Caching Strategies

### Strategy Comparison

| Strategy        | How It Works                                    | Consistency    | Use Case                     |
|-----------------|-------------------------------------------------|----------------|------------------------------|
| Cache-Aside     | App checks cache, on miss reads DB, writes cache | Eventual       | General purpose, read-heavy  |
| Read-Through    | Cache reads from DB on miss automatically        | Eventual       | Simplified app logic         |
| Write-Through   | Writes go to cache AND DB simultaneously         | Strong         | When consistency matters     |
| Write-Behind    | Writes go to cache, async batch write to DB      | Eventual       | Write-heavy, performance     |
| Write-Around    | Writes go directly to DB, bypassing cache        | Eventual       | Infrequently read data       |

### Cache-Aside Pattern (Most Common)

```javascript
async function getUser(userId) {
  // 1. Check cache
  const cached = await redis.get(`user:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss -- read from DB
  const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);

  // 3. Populate cache
  if (user) {
    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(user)); // 1hr TTL
  }

  return user;
}

async function updateUser(userId, data) {
  // 1. Update DB
  await db.query("UPDATE users SET name = $1 WHERE id = $2", [data.name, userId]);

  // 2. Invalidate cache (NOT update -- avoids race conditions)
  await redis.del(`user:${userId}`);
}
```

### Write-Through Pattern

```javascript
async function updateUser(userId, data) {
  // 1. Update cache AND DB atomically
  const user = { ...data, id: userId, updatedAt: new Date() };

  await Promise.all([
    redis.setEx(`user:${userId}`, 3600, JSON.stringify(user)),
    db.query("UPDATE users SET name = $1, updated_at = $2 WHERE id = $3",
      [user.name, user.updatedAt, userId])
  ]);

  return user;
}
```

### Write-Behind (Write-Back) Pattern

```javascript
// Writes accumulate in cache and are flushed to DB in batches
class WriteBackCache {
  #pending = new Map();
  #flushInterval;

  constructor(flushMs = 5000) {
    this.#flushInterval = setInterval(() => this.flush(), flushMs);
  }

  async write(key, value) {
    await redis.setEx(key, 3600, JSON.stringify(value));
    this.#pending.set(key, value);
  }

  async flush() {
    if (this.#pending.size === 0) return;

    const batch = new Map(this.#pending);
    this.#pending.clear();

    // Bulk write to DB
    const values = [...batch.entries()];
    await db.query(
      "INSERT INTO cache_data (key, value) VALUES " +
      values.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(", ") +
      " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      values.flat()
    );
  }

  destroy() {
    clearInterval(this.#flushInterval);
    return this.flush(); // final flush
  }
}
```

### Cache Invalidation Strategies

```javascript
// 1. TTL-based (simplest, eventual consistency)
await redis.setEx("key", 300, value); // auto-expire in 5 minutes

// 2. Event-based invalidation (on write)
async function updateProduct(id, data) {
  await db.updateProduct(id, data);
  await redis.del(`product:${id}`);
  await redis.del(`product-list:category:${data.category}`);
}

// 3. Versioned keys
async function getProduct(id) {
  const version = await redis.get(`product-version:${id}`) || "0";
  const cached = await redis.get(`product:${id}:v${version}`);
  if (cached) return JSON.parse(cached);

  const product = await db.getProduct(id);
  await redis.setEx(`product:${id}:v${version}`, 3600, JSON.stringify(product));
  return product;
}

// 4. Stale-while-revalidate
async function getWithSWR(key, fetchFn, ttl = 300, staleTtl = 60) {
  const cached = await redis.get(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const age = (Date.now() - timestamp) / 1000;

    if (age < ttl) return data; // fresh

    if (age < ttl + staleTtl) {
      // Stale but usable -- serve stale, refresh in background
      fetchFn().then(fresh =>
        redis.setEx(key, ttl + staleTtl, JSON.stringify({
          data: fresh, timestamp: Date.now()
        }))
      ).catch(() => {}); // ignore refresh errors
      return data;
    }
  }

  // Cache miss or too stale
  const data = await fetchFn();
  await redis.setEx(key, ttl + staleTtl, JSON.stringify({
    data, timestamp: Date.now()
  }));
  return data;
}
```

### Cache Problems

| Problem           | Description                                      | Solution                           |
|--------------------|-------------------------------------------------|-------------------------------------|
| Cache stampede     | Many requests hit DB simultaneously on cache miss | Locking (singleflight), SWR       |
| Cache penetration  | Queries for non-existent data always miss cache  | Cache null results, bloom filter   |
| Cache avalanche    | Many keys expire at same time -> DB overload     | Jittered TTLs, staggered expiry   |
| Stale data         | Cache serves outdated data                       | Event-based invalidation, short TTL|
| Hot key            | Single key gets disproportionate traffic         | Local cache + distributed cache    |

---

## Microservices Patterns

### Service Discovery

```
Client-side discovery:
  Client -> Service Registry -> get address -> call service
  Example: Consul, Eureka

Server-side discovery:
  Client -> Load Balancer -> routes to service
  Example: AWS ALB, Kubernetes Service

DNS-based:
  Client -> DNS lookup -> returns service IP
  Example: Kubernetes DNS, AWS Cloud Map
```

### API Gateway

```javascript
// API Gateway responsibilities:
// - Request routing
// - Authentication/authorization
// - Rate limiting
// - Request/response transformation
// - Circuit breaking
// - Logging/monitoring
// - SSL termination

// Simple Express API Gateway
import express from "express";
import httpProxy from "http-proxy-middleware";

const app = express();

// Authentication middleware
app.use(authMiddleware);

// Route to microservices
app.use("/api/users", httpProxy({
  target: "http://user-service:3001",
  pathRewrite: { "^/api/users": "" },
}));

app.use("/api/orders", httpProxy({
  target: "http://order-service:3002",
  pathRewrite: { "^/api/orders": "" },
}));

app.use("/api/products", httpProxy({
  target: "http://product-service:3003",
  pathRewrite: { "^/api/products": "" },
}));
```

### Saga Pattern (Distributed Transactions)

```javascript
// Problem: Multi-service transaction (e.g., create order + charge payment + update inventory)
// Solution: Saga -- sequence of local transactions with compensating actions

// Choreography-based Saga (event-driven)
// Each service publishes events and reacts to events

// Orchestration-based Saga (centralized coordinator)
class OrderSaga {
  async execute(orderData) {
    const steps = [
      {
        action: () => orderService.create(orderData),
        compensate: (result) => orderService.cancel(result.orderId),
      },
      {
        action: (prev) => paymentService.charge(prev.orderId, orderData.amount),
        compensate: (result) => paymentService.refund(result.paymentId),
      },
      {
        action: (prev) => inventoryService.reserve(orderData.items),
        compensate: (result) => inventoryService.release(result.reservationId),
      },
      {
        action: (prev) => shippingService.schedule(orderData),
        compensate: (result) => shippingService.cancel(result.shipmentId),
      },
    ];

    const completed = [];

    try {
      let previousResult = null;
      for (const step of steps) {
        const result = await step.action(previousResult);
        completed.push({ step, result });
        previousResult = result;
      }
      return { success: true, result: previousResult };
    } catch (err) {
      // Compensate in reverse order
      console.error("Saga failed, compensating...", err.message);
      for (const { step, result } of completed.reverse()) {
        try {
          await step.compensate(result);
        } catch (compErr) {
          console.error("Compensation failed:", compErr);
          // Log for manual intervention
        }
      }
      return { success: false, error: err.message };
    }
  }
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  #state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
  #failureCount = 0;
  #successCount = 0;
  #lastFailureTime = null;

  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30s
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
  }

  async call(fn) {
    if (this.#state === "OPEN") {
      if (Date.now() - this.#lastFailureTime > this.resetTimeout) {
        this.#state = "HALF_OPEN";
        this.#successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (err) {
      this.#onFailure();
      throw err;
    }
  }

  #onSuccess() {
    if (this.#state === "HALF_OPEN") {
      this.#successCount++;
      if (this.#successCount >= this.halfOpenMaxAttempts) {
        this.#state = "CLOSED";
        this.#failureCount = 0;
      }
    } else {
      this.#failureCount = 0;
    }
  }

  #onFailure() {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

    if (this.#failureCount >= this.failureThreshold) {
      this.#state = "OPEN";
    }
  }

  get state() {
    return this.#state;
  }
}

// Usage
const paymentBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000,
});

try {
  const result = await paymentBreaker.call(() =>
    paymentService.charge(orderId, amount)
  );
} catch (err) {
  if (err.message === "Circuit breaker is OPEN") {
    // Fallback: queue for later, return pending status
    await queue.add("retry-payment", { orderId, amount });
    return { status: "pending" };
  }
  throw err;
}
```

---

## Event-Driven Architecture

### Event Sourcing

```javascript
// Instead of storing current state, store all events that led to it
// Events are immutable, append-only

// Event store
class EventStore {
  #events = []; // In production: append-only DB table or Kafka topic

  async append(streamId, event) {
    const stored = {
      id: crypto.randomUUID(),
      streamId,
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
      version: this.#events.filter(e => e.streamId === streamId).length + 1,
    };
    this.#events.push(stored);
    return stored;
  }

  async getStream(streamId) {
    return this.#events
      .filter(e => e.streamId === streamId)
      .sort((a, b) => a.version - b.version);
  }
}

// Aggregate: rebuild state from events
class BankAccount {
  #balance = 0;
  #id;

  constructor(id) {
    this.#id = id;
  }

  apply(event) {
    switch (event.type) {
      case "AccountOpened":
        this.#balance = event.data.initialBalance;
        break;
      case "MoneyDeposited":
        this.#balance += event.data.amount;
        break;
      case "MoneyWithdrawn":
        this.#balance -= event.data.amount;
        break;
    }
  }

  static fromEvents(id, events) {
    const account = new BankAccount(id);
    for (const event of events) {
      account.apply(event);
    }
    return account;
  }

  get balance() { return this.#balance; }
}

// Usage
const store = new EventStore();
const accountId = "acc-123";

await store.append(accountId, { type: "AccountOpened", data: { initialBalance: 100 } });
await store.append(accountId, { type: "MoneyDeposited", data: { amount: 50 } });
await store.append(accountId, { type: "MoneyWithdrawn", data: { amount: 30 } });

const events = await store.getStream(accountId);
const account = BankAccount.fromEvents(accountId, events);
console.log(account.balance); // 120
```

### CQRS (Command Query Responsibility Segregation)

```
Traditional:
  Client -> Single Model -> Single Database

CQRS:
  Commands (writes) -> Command Model -> Write DB (normalized)
       │
       ▼
  Event Bus (sync/async)
       │
       ▼
  Queries (reads) -> Query Model -> Read DB (denormalized, optimized)
```

```javascript
// Command side: validates and writes
class OrderCommandHandler {
  async createOrder(command) {
    // Validate
    const user = await userRepo.findById(command.userId);
    if (!user) throw new Error("User not found");

    const items = await inventoryRepo.checkAvailability(command.items);
    if (!items.allAvailable) throw new Error("Items unavailable");

    // Write to command store
    const order = await orderRepo.create({
      userId: command.userId,
      items: command.items,
      status: "pending",
    });

    // Publish event
    await eventBus.publish("OrderCreated", {
      orderId: order.id,
      userId: order.userId,
      items: order.items,
      total: order.total,
    });

    return order.id;
  }
}

// Query side: optimized read model
class OrderQueryHandler {
  // Read from denormalized view/table optimized for this query
  async getUserOrders(userId) {
    return readDb.query(`
      SELECT order_id, total, status, item_count, created_at
      FROM order_summary_view
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
  }
}

// Event handler: keeps read model in sync
eventBus.subscribe("OrderCreated", async (event) => {
  await readDb.query(`
    INSERT INTO order_summary_view (order_id, user_id, total, item_count, status, created_at)
    VALUES ($1, $2, $3, $4, 'pending', NOW())
  `, [event.orderId, event.userId, event.total, event.items.length]);
});
```

---

## Reliability Patterns

### Retry with Exponential Backoff

```javascript
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
    retryOn = () => true, // predicate to decide if error is retryable
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !retryOn(err)) {
        throw err;
      }

      let delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of calculated delay
      }

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay.toFixed(0)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// Usage
const data = await retryWithBackoff(
  () => fetch("https://api.example.com/data").then(r => r.json()),
  {
    maxRetries: 3,
    baseDelay: 1000,
    retryOn: (err) => err.status >= 500 || err.code === "ECONNRESET",
  }
);
```

### Bulkhead Pattern

```javascript
// Isolate failures: limit concurrent requests per service
class Bulkhead {
  #maxConcurrent;
  #queue = [];
  #running = 0;

  constructor(maxConcurrent = 10) {
    this.#maxConcurrent = maxConcurrent;
  }

  async execute(fn) {
    if (this.#running >= this.#maxConcurrent) {
      // Wait in queue
      await new Promise((resolve, reject) => {
        this.#queue.push({ resolve, reject });
      });
    }

    this.#running++;
    try {
      return await fn();
    } finally {
      this.#running--;
      if (this.#queue.length > 0) {
        const { resolve } = this.#queue.shift();
        resolve();
      }
    }
  }
}

// Separate bulkheads per service -- a slow payment service
// won't exhaust connections used by the user service
const paymentBulkhead = new Bulkhead(5);
const userBulkhead = new Bulkhead(20);

const payment = await paymentBulkhead.execute(() => chargePayment(order));
const user = await userBulkhead.execute(() => getUser(userId));
```

### Timeout Pattern

```javascript
function withTimeout(promise, ms, message = "Operation timed out") {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Or use AbortSignal.timeout (Node.js 18+)
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000),
});
```

---

## Observability

### Three Pillars

```
Observability
├── Logs        - What happened (discrete events)
├── Metrics     - How much / how often (aggregated numbers)
└── Traces      - Request flow across services (distributed)
```

### Structured Logging

```javascript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ["req.headers.authorization", "body.password"], // hide sensitive data
});

// Structured log entries
logger.info({ userId: 123, action: "login" }, "User logged in");
logger.error({ err, orderId: "abc" }, "Order processing failed");

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  // Child logger with request context
  req.log = logger.child({ requestId, method: req.method, url: req.url });

  res.on("finish", () => {
    req.log.info({
      statusCode: res.statusCode,
      duration: Date.now() - start,
    }, "Request completed");
  });

  next();
}
```

### Metrics (Prometheus-style)

```javascript
import { Counter, Histogram, Gauge, Registry } from "prom-client";

const registry = new Registry();

// Request counter
const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"],
  registers: [registry],
});

// Response time histogram
const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// Active connections gauge
const activeConnections = new Gauge({
  name: "active_connections",
  help: "Number of active connections",
  registers: [registry],
});

// Middleware
function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer({ method: req.method, path: req.route?.path || req.path });
  activeConnections.inc();

  res.on("finish", () => {
    httpRequests.inc({ method: req.method, path: req.route?.path || req.path, status: res.statusCode });
    end();
    activeConnections.dec();
  });

  next();
}

// Expose /metrics endpoint for Prometheus scraping
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
```

### Distributed Tracing

```javascript
// OpenTelemetry setup for Node.js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://jaeger:4318/v1/traces",
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});

sdk.start();

// Manual span creation
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("order-service");

async function processOrder(orderId) {
  return tracer.startActiveSpan("processOrder", async (span) => {
    span.setAttribute("order.id", orderId);

    try {
      const order = await tracer.startActiveSpan("fetchOrder", async (childSpan) => {
        const result = await db.query("SELECT * FROM orders WHERE id = $1", [orderId]);
        childSpan.end();
        return result;
      });

      await tracer.startActiveSpan("chargePayment", async (childSpan) => {
        await paymentService.charge(order.total);
        childSpan.end();
      });

      span.setStatus({ code: 1 }); // OK
      return order;
    } catch (err) {
      span.setStatus({ code: 2, message: err.message }); // ERROR
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}
```

---

## Security

### JWT Authentication Flow

```
1. Login:
   Client -> POST /auth/login { email, password }
   Server -> validates credentials
   Server -> generates JWT (access token + refresh token)
   Server -> returns { accessToken, refreshToken }

2. Authenticated Request:
   Client -> GET /api/data, Authorization: Bearer <accessToken>
   Server -> verifies JWT signature and expiry
   Server -> extracts user claims
   Server -> processes request

3. Token Refresh:
   Client -> POST /auth/refresh { refreshToken }
   Server -> validates refresh token (check DB/Redis)
   Server -> generates new access token
   Server -> returns { accessToken }
```

```javascript
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Generate tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" }  // short-lived
  );

  const refreshToken = jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    REFRESH_SECRET,
    { expiresIn: "7d" }   // long-lived
  );

  return { accessToken, refreshToken };
}

// Verify middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
}

// Role-based authorization
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Usage
app.get("/api/admin/users", authenticate, authorize("admin"), getUsers);
```

### OAuth 2.0 Flow (Authorization Code)

```
1. Client redirects user to Authorization Server:
   GET https://auth.provider.com/authorize?
     response_type=code
     &client_id=xxx
     &redirect_uri=https://myapp.com/callback
     &scope=openid+profile+email
     &state=random_csrf_token

2. User authenticates and consents

3. Auth Server redirects back with code:
   GET https://myapp.com/callback?code=AUTH_CODE&state=random_csrf_token

4. Server exchanges code for tokens:
   POST https://auth.provider.com/token
   { grant_type: "authorization_code", code: AUTH_CODE, redirect_uri, client_id, client_secret }

5. Auth Server returns:
   { access_token, refresh_token, id_token, expires_in }
```

### API Key Security

```javascript
import crypto from "node:crypto";

// Generate API key
function generateApiKey() {
  const prefix = "sk_live_";
  const key = crypto.randomBytes(32).toString("hex");
  return prefix + key;
}

// Store hashed key (never store plaintext)
async function createApiKey(userId) {
  const rawKey = generateApiKey();
  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");

  await db.query(
    "INSERT INTO api_keys (user_id, key_hash, prefix) VALUES ($1, $2, $3)",
    [userId, hashedKey, rawKey.slice(0, 12)]
  );

  return rawKey; // show once, never stored in plaintext
}

// Verify API key
async function verifyApiKey(rawKey) {
  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  const result = await db.query(
    "SELECT user_id FROM api_keys WHERE key_hash = $1 AND active = true",
    [hashedKey]
  );
  return result.rows[0] || null;
}
```

---

## Scaling Patterns

### Horizontal vs Vertical

```
Vertical Scaling (Scale Up):
  Add more resources to existing machine
  ├── More RAM, faster CPU, faster SSD
  ├── Simple -- no code changes
  └── Limited by hardware ceiling

Horizontal Scaling (Scale Out):
  Add more machines
  ├── Load balancer distributes traffic
  ├── Stateless services required
  └── Practically unlimited
```

### Consistent Hashing

```javascript
// Problem: hash(key) % N breaks when N changes (all keys remap)
// Solution: Consistent hashing -- only K/N keys remap when adding/removing a node

import crypto from "node:crypto";

class ConsistentHashRing {
  #ring = new Map(); // position -> node
  #sortedPositions = [];
  #replicas;

  constructor(replicas = 150) {
    this.#replicas = replicas; // virtual nodes per real node
  }

  #hash(key) {
    return parseInt(
      crypto.createHash("md5").update(key).digest("hex").slice(0, 8),
      16
    );
  }

  addNode(node) {
    for (let i = 0; i < this.#replicas; i++) {
      const position = this.#hash(`${node}:${i}`);
      this.#ring.set(position, node);
      this.#sortedPositions.push(position);
    }
    this.#sortedPositions.sort((a, b) => a - b);
  }

  removeNode(node) {
    for (let i = 0; i < this.#replicas; i++) {
      const position = this.#hash(`${node}:${i}`);
      this.#ring.delete(position);
    }
    this.#sortedPositions = this.#sortedPositions.filter(p => this.#ring.has(p));
  }

  getNode(key) {
    if (this.#ring.size === 0) return null;

    const hash = this.#hash(key);

    // Find first position >= hash (binary search in production)
    for (const position of this.#sortedPositions) {
      if (position >= hash) {
        return this.#ring.get(position);
      }
    }

    // Wrap around to first node
    return this.#ring.get(this.#sortedPositions[0]);
  }
}

// Usage
const ring = new ConsistentHashRing();
ring.addNode("server-1");
ring.addNode("server-2");
ring.addNode("server-3");

ring.getNode("user:123"); // "server-2"
ring.getNode("user:456"); // "server-1"

// Adding server-4 only remaps ~25% of keys (1/N), not all of them
ring.addNode("server-4");
```

### Data Partitioning

```
Horizontal partitioning (Sharding):
  Split rows across databases
  user_id 1-1M -> Shard A
  user_id 1M-2M -> Shard B

Vertical partitioning:
  Split columns across databases
  User core data -> DB A (id, name, email)
  User activity -> DB B (id, posts, likes)

Functional partitioning:
  Split by service/domain
  User data -> PostgreSQL
  Product catalog -> MongoDB
  Session data -> Redis
  Analytics -> ClickHouse
```

---

## CAP Theorem

```
In a distributed system, you can only guarantee 2 of 3:

C (Consistency):  Every read receives the most recent write
A (Availability): Every request receives a response (no errors)
P (Partition Tolerance): System works despite network partitions

Since network partitions ALWAYS happen in distributed systems,
the real choice is: CP or AP

CP Systems (Consistency + Partition Tolerance):
  Sacrifices availability during partitions
  Examples: PostgreSQL, MongoDB, ZooKeeper, Redis (single)
  Use when: Banking, inventory, anything requiring correctness

AP Systems (Availability + Partition Tolerance):
  Sacrifices consistency (returns potentially stale data)
  Examples: Cassandra, DynamoDB, CouchDB
  Use when: Social media feeds, analytics, shopping carts
```

---

## ACID vs BASE

| Property   | ACID                            | BASE                              |
|------------|----------------------------------|-----------------------------------|
| Full name  | Atomicity, Consistency, Isolation, Durability | Basically Available, Soft state, Eventually consistent |
| Consistency | Strong (immediate)             | Eventual                          |
| Concurrency | Pessimistic locking            | Optimistic, conflict resolution   |
| Scaling     | Vertical (hard to distribute)  | Horizontal (distributed-friendly) |
| Use case    | Financial, transactional       | Social, analytics, high-scale     |
| Examples    | PostgreSQL, MySQL              | Cassandra, DynamoDB, MongoDB      |

---

## Node.js Specific Considerations

### Why Node.js for Microservices

```
Strengths:
├── Fast I/O (event loop + non-blocking)
├── Lightweight processes (low memory footprint)
├── Fast startup time (important for serverless/containers)
├── npm ecosystem (huge library selection)
├── JSON native (no serialization overhead for APIs)
├── TypeScript support (type safety at scale)
└── Same language as frontend (full-stack teams)

Weaknesses:
├── CPU-intensive tasks block the event loop
├── Single-threaded (need clustering for multi-core)
├── Callback complexity (mitigated by async/await)
├── Dynamic typing (mitigated by TypeScript)
└── Memory-intensive apps limited by V8 heap
```

### Node.js Performance Checklist

```javascript
// 1. Use streaming for large data
await pipeline(readStream, transformStream, writeStream);

// 2. Use connection pooling
const pool = new Pool({ max: 20 });

// 3. Use clustering for multi-core
cluster.fork(); // per CPU core

// 4. Offload CPU work to Worker Threads
const worker = new Worker("./heavy-computation.js");

// 5. Use caching (Redis for distributed, Map for local)
const cache = new Map(); // or redis

// 6. Avoid synchronous APIs in production
// Bad: fs.readFileSync, JSON.parse(hugeString)
// Good: fs.promises.readFile, streaming JSON parser

// 7. Set proper timeouts
server.setTimeout(30000);
server.keepAliveTimeout = 65000; // > ALB idle timeout (60s)
server.headersTimeout = 66000;   // > keepAliveTimeout

// 8. Handle backpressure in streams
// Use pipeline() instead of .pipe()

// 9. Monitor event loop lag
const start = Date.now();
setImmediate(() => {
  const lag = Date.now() - start;
  if (lag > 100) console.warn(`Event loop lag: ${lag}ms`);
});

// 10. Use AbortController for timeouts
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

---

## Interview Tips and Key Takeaways

1. **Follow the framework:** Clarify -> Estimate -> Design -> Deep dive. Never jump straight to the solution.

2. **Think out loud:** The interviewer wants to see your thought process, not just the final answer. Explain tradeoffs as you go.

3. **Start simple, then scale:** Begin with a single-server design, then add components as needed. Over-engineering early is a red flag.

4. **Know your numbers:** Approximate QPS, storage, and bandwidth quickly. It shows engineering maturity.

5. **Always discuss tradeoffs:** There is no perfect design. Every choice has pros and cons. "It depends" is good -- as long as you explain what it depends on.

6. **Address failure modes:** What happens when a component fails? How do you detect it? How do you recover? This distinguishes senior from mid-level.

7. **Node.js angle:** If designing for Node.js specifically, mention event loop considerations, clustering strategy, streaming for large data, and when to offload CPU work.

8. **Do not over-index on buzzwords:** Saying "microservices" or "Kafka" without justification is worse than a well-reasoned monolith.

---

## Estimation Cheat Sheet

### Quick Math

```
Requests per second from daily count:
  1M/day    = ~12 QPS
  10M/day   = ~120 QPS
  100M/day  = ~1,200 QPS
  1B/day    = ~12,000 QPS

Storage from user count:
  1M users * 1KB/user = 1 GB
  1M users * 1MB/user = 1 TB

Bandwidth:
  QPS * response_size = bandwidth
  1,000 QPS * 10 KB = 10 MB/s
```

### Power of 2 Reference

| Power | Exact Value       | Approximate  | Unit  |
|-------|-------------------|--------------|-------|
| 10    | 1,024             | 1 Thousand   | 1 KB  |
| 20    | 1,048,576         | 1 Million    | 1 MB  |
| 30    | 1,073,741,824     | 1 Billion    | 1 GB  |
| 40    | 1,099,511,627,776 | 1 Trillion   | 1 TB  |

### Capacity Quick Reference

| Component           | Typical Capacity                    |
|---------------------|-------------------------------------|
| Single Node.js      | ~10K concurrent connections         |
| PostgreSQL          | ~5K-10K QPS (depends on queries)    |
| Redis               | ~100K QPS (single node)             |
| MongoDB             | ~20K-50K QPS                        |
| Kafka               | ~1M messages/s (per cluster)        |
| nginx               | ~50K concurrent connections         |
| Single API server   | ~1K-5K QPS (depends on workload)    |

### SLA Quick Reference

| Availability | Downtime/year | Downtime/month | Downtime/week |
|-------------|---------------|----------------|---------------|
| 99%         | 3.65 days     | 7.3 hours      | 1.68 hours    |
| 99.9%       | 8.76 hours    | 43.8 minutes   | 10.1 minutes  |
| 99.99%      | 52.6 minutes  | 4.38 minutes   | 1.01 minutes  |
| 99.999%     | 5.26 minutes  | 26.3 seconds   | 6.05 seconds  |
