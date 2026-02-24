# 09 - Queues, Caching & Scalability

## Table of Contents

- [Message Queue Concepts](#message-queue-concepts)
- [BullMQ / Bull Patterns](#bullmq--bull-patterns)
- [Redis as Cache](#redis-as-cache)
- [Redis Data Structures](#redis-data-structures)
- [Rate Limiting](#rate-limiting)
- [Caching Strategies](#caching-strategies)
- [Background Jobs](#background-jobs)
- [Dead Letter Queues](#dead-letter-queues)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Event-Driven Architecture](#event-driven-architecture)
- [CQRS](#cqrs)
- [Idempotency](#idempotency)
- [Interview Tips](#interview-tips)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Message Queue Concepts

A **message queue** decouples producers from consumers, enabling asynchronous communication between services. Messages are stored in a broker until a consumer processes them.

### Why Use Queues?

| Benefit | Description |
|---|---|
| **Decoupling** | Services communicate without knowing about each other |
| **Load leveling** | Absorb traffic spikes; consumers process at their own pace |
| **Reliability** | Messages persist even if a consumer is temporarily down |
| **Scalability** | Add more consumers to increase throughput |
| **Retry / DLQ** | Failed messages can be retried or routed to a dead letter queue |

### Core Terminology

| Term | Meaning |
|---|---|
| **Producer** | Publishes messages to the queue |
| **Consumer / Worker** | Reads and processes messages |
| **Broker** | The middleware that stores and routes messages (Redis, RabbitMQ, Kafka) |
| **Topic / Channel** | A named destination for messages |
| **Acknowledgement** | Consumer confirms successful processing |
| **At-least-once** | Message delivered one or more times (most common) |
| **Exactly-once** | Message delivered exactly once (hardest to achieve) |

### Common Brokers Compared

| Feature | Redis (BullMQ) | RabbitMQ | Apache Kafka |
|---|---|---|---|
| Protocol | Custom (Redis) | AMQP | Custom binary |
| Ordering | Per-queue FIFO | Per-queue FIFO | Per-partition |
| Persistence | Optional (RDB/AOF) | Disk-based | Log-based (durable) |
| Throughput | High | Medium-High | Very High |
| Use case | Job queues, tasks | Complex routing | Event streaming |
| Node.js library | `bullmq` | `amqplib` | `kafkajs` |

---

## BullMQ / Bull Patterns

BullMQ is the modern successor to Bull. Both use Redis as a backend.

### Basic Setup

```javascript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

// --- Producer ---
const emailQueue = new Queue('email', { connection });

await emailQueue.add('welcome-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up.',
}, {
  attempts: 3,                 // retry up to 3 times
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000,      // keep last 1000 completed jobs
  removeOnFail: 5000,
});

// --- Consumer / Worker ---
const worker = new Worker('email', async (job) => {
  console.log(`Processing job ${job.id}: ${job.name}`);
  await sendEmail(job.data);
}, {
  connection,
  concurrency: 5,             // process 5 jobs in parallel
  limiter: { max: 10, duration: 1000 }, // rate: 10 jobs/sec
});

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed: ${err.message}`));
```

### Job Scheduling (Delayed & Repeatable)

```javascript
// Delayed job — runs 5 minutes from now
await emailQueue.add('reminder', { userId: 42 }, {
  delay: 5 * 60 * 1000,
});

// Repeatable job — runs every hour
await emailQueue.add('hourly-report', {}, {
  repeat: { every: 60 * 60 * 1000 },
});

// Cron-based repeatable job
await emailQueue.add('daily-digest', {}, {
  repeat: { pattern: '0 9 * * *' },  // every day at 09:00
});
```

### Job Priority

```javascript
// Lower number = higher priority
await emailQueue.add('critical-alert', data, { priority: 1 });
await emailQueue.add('newsletter', data, { priority: 10 });
```

### Flow (Parent-Child Jobs)

```javascript
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection });

await flow.add({
  name: 'generate-report',
  queueName: 'reports',
  data: { month: 'January' },
  children: [
    { name: 'fetch-sales',   queueName: 'data-fetch', data: { type: 'sales' } },
    { name: 'fetch-signups', queueName: 'data-fetch', data: { type: 'signups' } },
  ],
});
// Parent waits for all children to complete before running
```

### Sandboxed Processors

```javascript
// worker runs in a separate child process — isolates crashes
const worker = new Worker('heavy', './processors/heavy.js', {
  connection,
  useWorkerThreads: true,  // or use worker_threads instead of child_process
});
```

---

## Redis as Cache

### TTL (Time-To-Live)

```javascript
import Redis from 'ioredis';
const redis = new Redis();

// SET with TTL
await redis.set('session:abc123', JSON.stringify(userData), 'EX', 3600); // 3600 seconds

// SET only if not exists (NX) with TTL
await redis.set('lock:order:99', '1', 'EX', 30, 'NX');

// Check remaining TTL
const ttl = await redis.ttl('session:abc123'); // seconds remaining (-1 = no expiry, -2 = key gone)
```

### Cache-Aside (Lazy Loading)

The most common caching pattern. The application checks the cache first, and on a miss, loads from the database and populates the cache.

```javascript
async function getUser(userId) {
  const cacheKey = `user:${userId}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);  // cache hit
  }

  // 2. Cache miss — read from DB
  const user = await db.users.findById(userId);
  if (!user) return null;

  // 3. Populate cache
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 600); // 10 min TTL

  return user;
}
```

### Write-Through

Every write goes to both cache and database synchronously.

```javascript
async function updateUser(userId, updates) {
  const cacheKey = `user:${userId}`;

  // 1. Write to DB
  const user = await db.users.findByIdAndUpdate(userId, updates, { new: true });

  // 2. Write to cache (synchronously)
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 600);

  return user;
}
```

### Write-Behind (Write-Back)

Write to cache immediately, then asynchronously flush to the database. Higher performance but risk of data loss.

```javascript
async function updateUserWriteBehind(userId, updates) {
  const cacheKey = `user:${userId}`;

  // 1. Update cache immediately
  const merged = { ...(await getCachedUser(userId)), ...updates };
  await redis.set(cacheKey, JSON.stringify(merged), 'EX', 600);

  // 2. Enqueue DB write (async)
  await dbWriteQueue.add('update-user', { userId, updates });

  return merged;
}
```

### Caching Strategies Comparison

| Strategy | Read perf | Write perf | Consistency | Data loss risk |
|---|---|---|---|---|
| Cache-Aside | Fast (on hit) | Normal | Eventual | None |
| Read-Through | Fast (on hit) | Normal | Eventual | None |
| Write-Through | Fast | Slower | Strong | None |
| Write-Behind | Fast | Very fast | Eventual | Possible |

---

## Redis Data Structures

| Structure | Commands | Use Case |
|---|---|---|
| **String** | `SET`, `GET`, `INCR`, `DECR` | Cache, counters, locks |
| **Hash** | `HSET`, `HGET`, `HGETALL` | Object storage (user profiles) |
| **List** | `LPUSH`, `RPUSH`, `LPOP`, `LRANGE` | Queues, activity feeds |
| **Set** | `SADD`, `SMEMBERS`, `SINTER` | Tags, unique visitors |
| **Sorted Set** | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE` | Leaderboards, rate limiting |
| **Stream** | `XADD`, `XREAD`, `XREADGROUP` | Event sourcing, log processing |
| **HyperLogLog** | `PFADD`, `PFCOUNT` | Cardinality estimation (unique counts) |

```javascript
// Hash — store user profile
await redis.hset('user:42', { name: 'Alice', email: 'alice@example.com', role: 'admin' });
const name = await redis.hget('user:42', 'name');       // "Alice"
const all  = await redis.hgetall('user:42');             // { name, email, role }

// Sorted Set — leaderboard
await redis.zadd('leaderboard', 1500, 'alice', 1200, 'bob', 1800, 'charlie');
const top3 = await redis.zrevrange('leaderboard', 0, 2, 'WITHSCORES');
// ["charlie", "1800", "alice", "1500", "bob", "1200"]

// Stream — append events
await redis.xadd('orders', '*', 'action', 'created', 'orderId', '12345');
const events = await redis.xrange('orders', '-', '+', 'COUNT', 10);

// HyperLogLog — count unique visitors
await redis.pfadd('visitors:2024-01-15', 'user1', 'user2', 'user3', 'user1');
const uniqueCount = await redis.pfcount('visitors:2024-01-15'); // ~3
```

---

## Rate Limiting

### Token Bucket

A bucket holds a maximum of N tokens. Each request consumes one token. Tokens are refilled at a fixed rate.

```javascript
async function tokenBucket(key, maxTokens, refillRate, windowSec) {
  const now = Date.now();
  const data = await redis.hgetall(key);

  let tokens = parseFloat(data.tokens ?? maxTokens);
  let lastRefill = parseFloat(data.lastRefill ?? now);

  // Refill tokens based on elapsed time
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(maxTokens, tokens + elapsed * refillRate);

  if (tokens < 1) {
    return { allowed: false, retryAfter: Math.ceil((1 - tokens) / refillRate) };
  }

  tokens -= 1;
  await redis.hset(key, { tokens: tokens.toString(), lastRefill: now.toString() });
  await redis.expire(key, windowSec);

  return { allowed: true, remaining: Math.floor(tokens) };
}
```

### Sliding Window (Sorted Set)

```javascript
async function slidingWindowRateLimit(userId, limit, windowMs) {
  const key = `ratelimit:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);   // remove old entries
  pipeline.zadd(key, now, `${now}:${Math.random()}`); // add current request
  pipeline.zcard(key);                                // count entries
  pipeline.expire(key, Math.ceil(windowMs / 1000));  // auto-cleanup

  const results = await pipeline.exec();
  const count = results[2][1];

  if (count > limit) {
    // Remove the entry we just added (over limit)
    await redis.zremrangebyscore(key, now, now);
    return { allowed: false, count };
  }

  return { allowed: true, remaining: limit - count };
}
```

### Fixed Window Counter (Simple)

```javascript
async function fixedWindowRateLimit(userId, limit, windowSec) {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const key = `ratelimit:${userId}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  return count <= limit
    ? { allowed: true, remaining: limit - count }
    : { allowed: false, retryAfter: windowSec };
}
```

### Rate Limiting Comparison

| Algorithm | Pros | Cons |
|---|---|---|
| **Fixed Window** | Simple, O(1) | Burst at window boundary |
| **Sliding Window Log** | Accurate | Higher memory (stores timestamps) |
| **Sliding Window Counter** | Good balance | Slight approximation |
| **Token Bucket** | Allows controlled bursts | Slightly more complex |
| **Leaky Bucket** | Smooth output rate | No burst allowed |

---

## Caching Strategies

### Cache Invalidation Patterns

```javascript
// 1. TTL-based expiration (simplest)
await redis.set('config', JSON.stringify(config), 'EX', 300);

// 2. Event-based invalidation
userEvents.on('user:updated', async ({ userId }) => {
  await redis.del(`user:${userId}`);
});

// 3. Tag-based invalidation (group keys)
async function invalidateByTag(tag) {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    await redis.del(`tag:${tag}`);
  }
}

// When caching, register tags
async function cacheWithTags(key, value, ttl, tags) {
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
  for (const tag of tags) {
    await redis.sadd(`tag:${tag}`, key);
  }
}
```

### Cache Stampede Prevention

When a popular key expires, many requests simultaneously miss the cache and hit the database.

```javascript
// Solution: distributed lock
async function getWithLock(key, fetchFn, ttl = 600) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');

  if (acquired) {
    try {
      const data = await fetchFn();
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Another process is fetching — wait and retry
  await new Promise((r) => setTimeout(r, 100));
  return getWithLock(key, fetchFn, ttl);
}
```

---

## Background Jobs

### Common Patterns

```javascript
// Image processing pipeline
const imageQueue = new Queue('images', { connection });

// Producer
await imageQueue.add('resize', {
  imageUrl: 'https://cdn.example.com/photo.jpg',
  sizes: [{ w: 150, h: 150 }, { w: 600, h: 400 }, { w: 1200, h: 800 }],
});

// Worker
const imageWorker = new Worker('images', async (job) => {
  const { imageUrl, sizes } = job.data;

  for (let i = 0; i < sizes.length; i++) {
    const { w, h } = sizes[i];
    await resizeImage(imageUrl, w, h);
    await job.updateProgress(Math.round(((i + 1) / sizes.length) * 100));
  }

  return { processed: sizes.length };
}, { connection, concurrency: 3 });
```

### Progress Tracking

```javascript
// Listen for progress updates
const queueEvents = new QueueEvents('images', { connection });

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} is ${data}% complete`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} finished:`, returnvalue);
});
```

---

## Dead Letter Queues

A **dead letter queue (DLQ)** captures messages that fail processing after all retry attempts, allowing manual inspection and reprocessing.

```javascript
// BullMQ: after all attempts exhausted, job moves to 'failed' state
// Listen for permanently failed jobs and move to a DLQ
const dlq = new Queue('dead-letter', { connection });

worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // All retries exhausted — move to DLQ
    await dlq.add('failed-job', {
      originalQueue: 'email',
      originalJobId: job.id,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
    console.error(`Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
  }
});

// DLQ processor — for manual review or automated retry
const dlqWorker = new Worker('dead-letter', async (job) => {
  // Log to monitoring, send alert, or attempt recovery
  await alertOps(job.data);
}, { connection });
```

---

## Circuit Breaker Pattern

Prevents cascading failures by stopping calls to a failing service.

**States:** CLOSED (normal) -> OPEN (failing) -> HALF-OPEN (testing recovery)

```javascript
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30s
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN — request rejected');
      }
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {  // 2 consecutive successes to close
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage
const breaker = new CircuitBreaker(fetchExternalAPI, {
  failureThreshold: 5,
  resetTimeout: 30000,
});

try {
  const result = await breaker.call('/api/data');
} catch (err) {
  // fallback logic
}
```

> **Library alternative:** Use `opossum` for production circuit breakers in Node.js.

---

## Event-Driven Architecture

### Event Emitter Pattern

```javascript
import { EventEmitter } from 'node:events';

class OrderService extends EventEmitter {
  async createOrder(orderData) {
    const order = await db.orders.create(orderData);

    // Emit event — listeners handle side effects
    this.emit('order:created', order);

    return order;
  }
}

const orderService = new OrderService();

// Listeners are decoupled from the core logic
orderService.on('order:created', async (order) => {
  await emailService.sendConfirmation(order);
});

orderService.on('order:created', async (order) => {
  await inventoryService.reserve(order.items);
});

orderService.on('order:created', async (order) => {
  await analyticsService.track('purchase', order);
});
```

### Cross-Service Events with Redis Pub/Sub

```javascript
import Redis from 'ioredis';

// Publisher (Order Service)
const pub = new Redis();
await pub.publish('events', JSON.stringify({
  type: 'order:created',
  data: { orderId: '123', total: 99.99 },
  timestamp: Date.now(),
}));

// Subscriber (Notification Service — different process)
const sub = new Redis();
await sub.subscribe('events');

sub.on('message', (channel, message) => {
  const event = JSON.parse(message);
  if (event.type === 'order:created') {
    sendPushNotification(event.data);
  }
});
```

> **Note:** Redis Pub/Sub is fire-and-forget. If a subscriber is offline, it misses messages. Use Redis Streams or a proper message broker for durability.

---

## CQRS

**Command Query Responsibility Segregation** — separate the write model (commands) from the read model (queries).

```javascript
// --- Command Side (writes) ---
class OrderCommandService {
  async createOrder(command) {
    // Validate
    if (!command.items?.length) throw new Error('Order must have items');

    // Write to primary database (normalized)
    const order = await db.orders.create({
      userId: command.userId,
      items: command.items,
      status: 'pending',
      total: command.items.reduce((s, i) => s + i.price * i.qty, 0),
    });

    // Publish event for read-side sync
    await eventBus.publish('order:created', order);

    return order.id;
  }
}

// --- Query Side (reads) ---
class OrderQueryService {
  async getOrderSummary(orderId) {
    // Read from denormalized read store (optimized for queries)
    return redis.hgetall(`order-view:${orderId}`);
  }

  async getUserOrders(userId) {
    // Precomputed view
    const orderIds = await redis.lrange(`user-orders:${userId}`, 0, -1);
    return Promise.all(orderIds.map((id) => redis.hgetall(`order-view:${id}`)));
  }
}

// --- Event handler that builds the read model ---
eventBus.on('order:created', async (order) => {
  await redis.hset(`order-view:${order.id}`, {
    id: order.id,
    userId: order.userId,
    total: order.total.toString(),
    status: order.status,
    itemCount: order.items.length.toString(),
    createdAt: order.createdAt.toISOString(),
  });
  await redis.lpush(`user-orders:${order.userId}`, order.id);
});
```

### When to Use CQRS

| Use CQRS When | Avoid CQRS When |
|---|---|
| Read and write workloads differ significantly | Simple CRUD application |
| Complex queries need denormalized views | Small team, early project |
| Event sourcing is already in place | No clear read/write asymmetry |
| You need independent scaling of reads/writes | Added complexity is not justified |

---

## Idempotency

An operation is **idempotent** if performing it multiple times has the same effect as performing it once. Critical for retries and at-least-once delivery.

```javascript
// Idempotency key middleware
function idempotency(ttlSeconds = 86400) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    const cacheKey = `idempotency:${key}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const { statusCode, body } = JSON.parse(cached);
      return res.status(statusCode).json(body);
    }

    // Intercept res.json to capture the response
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      await redis.set(cacheKey, JSON.stringify({
        statusCode: res.statusCode,
        body,
      }), 'EX', ttlSeconds);
      return originalJson(body);
    };

    next();
  };
}

// Usage
app.post('/api/payments', idempotency(86400), async (req, res) => {
  const payment = await processPayment(req.body);
  res.status(201).json(payment);
});
```

### Idempotency in Job Processing

```javascript
const worker = new Worker('payments', async (job) => {
  const { paymentId, amount } = job.data;

  // Check if already processed (idempotency guard)
  const existing = await db.payments.findOne({ externalId: paymentId });
  if (existing) {
    console.log(`Payment ${paymentId} already processed — skipping`);
    return existing;
  }

  // Process payment
  const result = await chargeCard(paymentId, amount);
  await db.payments.create({ externalId: paymentId, ...result });
  return result;
}, { connection });
```

---

## Interview Tips

1. **"Why use a queue instead of a direct API call?"** — Decoupling, resilience (retries), load leveling, and ability to handle traffic spikes without overwhelming downstream services.

2. **Know the trade-offs** between different caching strategies. Cache-aside is the default answer for most scenarios, but explain why.

3. **Redis is not just a cache.** Be prepared to discuss its role as a message broker (Pub/Sub, Streams), distributed lock (Redlock), rate limiter, and session store.

4. **Idempotency is a must-have** for any payment or financial system. Always mention idempotency keys when discussing API design.

5. **Circuit breakers** prevent cascading failures. Mention the three states (CLOSED, OPEN, HALF-OPEN) and real-world libraries like `opossum`.

6. **CQRS is not always necessary.** Demonstrate that you understand when it adds value versus unnecessary complexity.

---

## Quick Reference / Cheat Sheet

```
Message Queue Flow:
  Producer --> [Broker / Queue] --> Consumer --> ACK
                                      |
                                      +--> Retry --> DLQ (if max retries)

Caching Decision Tree:
  Read-heavy? --> Cache-Aside (default) or Read-Through
  Write-heavy? --> Write-Behind (if eventual consistency OK)
  Strong consistency? --> Write-Through

Rate Limiting Algorithms:
  Simple: Fixed Window Counter
  Accurate: Sliding Window (sorted set)
  Burst-tolerant: Token Bucket

BullMQ Job Lifecycle:
  waiting --> active --> completed
                    \--> failed --> (retry) --> active
                                 \--> DLQ (max retries)

Circuit Breaker States:
  CLOSED --[failures >= threshold]--> OPEN --[timeout]--> HALF-OPEN
  HALF-OPEN --[success]--> CLOSED
  HALF-OPEN --[failure]--> OPEN

Redis Data Structure Cheat:
  Counting  --> String (INCR)
  Object    --> Hash (HSET/HGET)
  Queue     --> List (LPUSH/RPOP)
  Unique    --> Set (SADD)
  Ranked    --> Sorted Set (ZADD)
  Timeline  --> Stream (XADD)
  Approx    --> HyperLogLog (PFADD)
```
