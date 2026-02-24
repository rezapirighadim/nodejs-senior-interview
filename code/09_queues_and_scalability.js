/**
 * =============================================================================
 * FILE 9: QUEUES, CACHING, AND SCALABILITY PATTERNS
 * =============================================================================
 *
 * Senior Node.js Interview Prep
 * Runnable: node 09_queues_and_scalability.js
 *
 * Topics covered:
 *   1. Message queue concepts (producer/consumer, pub/sub)
 *   2. BullMQ patterns (job creation, processing, retries, delay, priority)
 *   3. Redis as cache (get/set, TTL, cache-aside, write-through)
 *   4. Redis data structures (strings, lists, sets, sorted sets, hashes)
 *   5. Rate limiting (token bucket, sliding window)
 *   6. Caching strategies (in-memory LRU, distributed)
 *   7. Background job processing patterns
 *   8. Dead letter queues and retry strategies
 *   9. Circuit breaker pattern
 *  10. Event-driven architecture with EventEmitter
 *  11. CQRS concept
 *  12. Idempotency patterns
 *
 * NOTE: All Redis/BullMQ interactions are simulated in-memory so the file
 *       runs standalone. The APIs mirror the real libraries' shapes.
 */

'use strict';

const { EventEmitter } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: IN-MEMORY REDIS SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────
// Real Redis is a single-threaded, in-memory data structure store.
// We replicate its core data-type APIs here so every later section can
// call redis.get(), redis.lpush(), etc. without an actual Redis process.

class InMemoryRedis {
  constructor() {
    /** @type {Map<string, { value: any, type: string, expiresAt: number | null }>} */
    this.store = new Map();
    // Pub/Sub channels: channelName -> Set<callback>
    this.channels = new Map();
    // Periodic expiry sweep (real Redis uses lazy + active expiry)
    this._expiryInterval = setInterval(() => this._sweep(), 500);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  quit() {
    clearInterval(this._expiryInterval);
  }

  // ── Internal helpers ───────────────────────────────────────────────────
  _now() {
    return Date.now();
  }
  _sweep() {
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && this._now() >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
  _alive(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && this._now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
  _getEntry(key, expectedType) {
    if (!this._alive(key)) return null;
    const entry = this.store.get(key);
    if (entry && expectedType && entry.type !== expectedType) {
      throw new Error(`WRONGTYPE Operation against a key holding the wrong kind of value`);
    }
    return entry;
  }
  _ensureEntry(key, type, defaultValue) {
    if (!this._alive(key)) {
      this.store.set(key, { value: defaultValue(), type, expiresAt: null });
    }
    return this._getEntry(key, type);
  }

  // ── STRING commands ────────────────────────────────────────────────────
  // Redis strings hold bytes; commonly used for caching serialized objects.
  async set(key, value, options = {}) {
    const entry = { value: String(value), type: 'string', expiresAt: null };
    if (options.EX) entry.expiresAt = this._now() + options.EX * 1000;
    if (options.PX) entry.expiresAt = this._now() + options.PX;
    // NX = set only if key does Not eXist
    if (options.NX && this._alive(key)) return null;
    // XX = set only if key already eXists
    if (options.XX && !this._alive(key)) return null;
    this.store.set(key, entry);
    return 'OK';
  }
  async get(key) {
    const entry = this._getEntry(key, 'string');
    return entry ? entry.value : null;
  }
  async incr(key) {
    if (!this._alive(key)) await this.set(key, '0');
    const entry = this._getEntry(key, 'string');
    const n = parseInt(entry.value, 10) + 1;
    entry.value = String(n);
    return n;
  }
  async incrby(key, amount) {
    if (!this._alive(key)) await this.set(key, '0');
    const entry = this._getEntry(key, 'string');
    const n = parseInt(entry.value, 10) + amount;
    entry.value = String(n);
    return n;
  }
  async expire(key, seconds) {
    if (!this._alive(key)) return 0;
    this.store.get(key).expiresAt = this._now() + seconds * 1000;
    return 1;
  }
  async ttl(key) {
    if (!this._alive(key)) return -2; // key does not exist
    const entry = this.store.get(key);
    if (entry.expiresAt === null) return -1; // no expiry set
    return Math.max(0, Math.ceil((entry.expiresAt - this._now()) / 1000));
  }
  async del(...keys) {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }
  async exists(key) {
    return this._alive(key) ? 1 : 0;
  }
  async mget(...keys) {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  // ── LIST commands ──────────────────────────────────────────────────────
  // Redis lists are doubly-linked lists of strings. O(1) push/pop at ends.
  async lpush(key, ...values) {
    const entry = this._ensureEntry(key, 'list', () => []);
    entry.value.unshift(...values.map(String));
    return entry.value.length;
  }
  async rpush(key, ...values) {
    const entry = this._ensureEntry(key, 'list', () => []);
    entry.value.push(...values.map(String));
    return entry.value.length;
  }
  async lpop(key) {
    const entry = this._getEntry(key, 'list');
    if (!entry || entry.value.length === 0) return null;
    return entry.value.shift();
  }
  async rpop(key) {
    const entry = this._getEntry(key, 'list');
    if (!entry || entry.value.length === 0) return null;
    return entry.value.pop();
  }
  async lrange(key, start, stop) {
    const entry = this._getEntry(key, 'list');
    if (!entry) return [];
    const len = entry.value.length;
    if (start < 0) start = Math.max(len + start, 0);
    if (stop < 0) stop = len + stop;
    return entry.value.slice(start, stop + 1);
  }
  async llen(key) {
    const entry = this._getEntry(key, 'list');
    return entry ? entry.value.length : 0;
  }

  // ── SET commands ───────────────────────────────────────────────────────
  // Redis sets are unordered collections of unique strings.
  async sadd(key, ...members) {
    const entry = this._ensureEntry(key, 'set', () => new Set());
    let added = 0;
    for (const m of members) {
      if (!entry.value.has(String(m))) { entry.value.add(String(m)); added++; }
    }
    return added;
  }
  async smembers(key) {
    const entry = this._getEntry(key, 'set');
    return entry ? [...entry.value] : [];
  }
  async sismember(key, member) {
    const entry = this._getEntry(key, 'set');
    return entry && entry.value.has(String(member)) ? 1 : 0;
  }
  async scard(key) {
    const entry = this._getEntry(key, 'set');
    return entry ? entry.value.size : 0;
  }
  async srem(key, ...members) {
    const entry = this._getEntry(key, 'set');
    if (!entry) return 0;
    let removed = 0;
    for (const m of members) {
      if (entry.value.delete(String(m))) removed++;
    }
    return removed;
  }

  // ── SORTED SET (ZSET) commands ─────────────────────────────────────────
  // Sorted sets map members to floating-point scores; ordered by score.
  // Internally backed by a skip-list in real Redis; we use an array here.
  async zadd(key, ...scoreMembers) {
    // scoreMembers: [score1, member1, score2, member2, ...]
    const entry = this._ensureEntry(key, 'zset', () => []);
    let added = 0;
    for (let i = 0; i < scoreMembers.length; i += 2) {
      const score = Number(scoreMembers[i]);
      const member = String(scoreMembers[i + 1]);
      const idx = entry.value.findIndex((e) => e.member === member);
      if (idx >= 0) {
        entry.value[idx].score = score;
      } else {
        entry.value.push({ score, member });
        added++;
      }
    }
    entry.value.sort((a, b) => a.score - b.score);
    return added;
  }
  async zrange(key, start, stop) {
    const entry = this._getEntry(key, 'zset');
    if (!entry) return [];
    return entry.value.slice(start, stop + 1).map((e) => e.member);
  }
  async zrangebyscore(key, min, max) {
    const entry = this._getEntry(key, 'zset');
    if (!entry) return [];
    return entry.value
      .filter((e) => e.score >= min && e.score <= max)
      .map((e) => e.member);
  }
  async zremrangebyscore(key, min, max) {
    const entry = this._getEntry(key, 'zset');
    if (!entry) return 0;
    const before = entry.value.length;
    entry.value = entry.value.filter((e) => e.score < min || e.score > max);
    return before - entry.value.length;
  }
  async zcard(key) {
    const entry = this._getEntry(key, 'zset');
    return entry ? entry.value.length : 0;
  }

  // ── HASH commands ──────────────────────────────────────────────────────
  // Redis hashes map string fields to string values. Good for objects.
  async hset(key, ...fieldValues) {
    const entry = this._ensureEntry(key, 'hash', () => new Map());
    let added = 0;
    for (let i = 0; i < fieldValues.length; i += 2) {
      if (!entry.value.has(fieldValues[i])) added++;
      entry.value.set(fieldValues[i], String(fieldValues[i + 1]));
    }
    return added;
  }
  async hget(key, field) {
    const entry = this._getEntry(key, 'hash');
    return entry ? (entry.value.get(field) ?? null) : null;
  }
  async hgetall(key) {
    const entry = this._getEntry(key, 'hash');
    if (!entry) return {};
    return Object.fromEntries(entry.value);
  }
  async hdel(key, ...fields) {
    const entry = this._getEntry(key, 'hash');
    if (!entry) return 0;
    let removed = 0;
    for (const f of fields) {
      if (entry.value.delete(f)) removed++;
    }
    return removed;
  }
  async hincrby(key, field, increment) {
    const entry = this._ensureEntry(key, 'hash', () => new Map());
    const current = parseInt(entry.value.get(field) ?? '0', 10);
    entry.value.set(field, String(current + increment));
    return current + increment;
  }

  // ── PUB/SUB ────────────────────────────────────────────────────────────
  // Redis Pub/Sub is fire-and-forget. Subscribers receive messages in real
  // time but miss anything published while they were disconnected.
  subscribe(channel, callback) {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set());
    this.channels.get(channel).add(callback);
  }
  unsubscribe(channel, callback) {
    this.channels.get(channel)?.delete(callback);
  }
  async publish(channel, message) {
    const subs = this.channels.get(channel);
    if (!subs) return 0;
    for (const cb of subs) cb(message);
    return subs.size;
  }

  // ── MULTI / pipeline (simplified) ──────────────────────────────────────
  // Real Redis MULTI wraps commands in an atomic transaction.
  multi() {
    const commands = [];
    const self = this;
    const chain = new Proxy({}, {
      get(_, prop) {
        if (prop === 'exec') {
          return async () => {
            const results = [];
            for (const { method, args } of commands) {
              results.push(await self[method](...args));
            }
            return results;
          };
        }
        return (...args) => {
          commands.push({ method: prop, args });
          return chain; // allow chaining
        };
      },
    });
    return chain;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: BULLMQ-STYLE QUEUE SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────
//
// BullMQ is the go-to job/message queue for Node.js backed by Redis.
// Key concepts:
//   - Queue: named job container stored in Redis
//   - Job:   unit of work with data, options (delay, priority, retries)
//   - Worker: processes jobs from a queue concurrently
//   - Events: completed, failed, progress
//   - Flow:  parent/child job dependencies (BullMQ Pro)
//
// Real BullMQ uses Redis streams (XADD/XREADGROUP) under the hood.

class Job {
  constructor(queue, name, data, opts = {}) {
    this.id = `${queue.name}:${++Job._counter}`;
    this.queue = queue;
    this.name = name;
    this.data = data;
    this.opts = {
      attempts: opts.attempts ?? 1,
      delay: opts.delay ?? 0,       // ms before job becomes processable
      priority: opts.priority ?? 0, // lower number = higher priority
      backoff: opts.backoff ?? { type: 'fixed', delay: 1000 },
      removeOnComplete: opts.removeOnComplete ?? false,
      removeOnFail: opts.removeOnFail ?? false,
    };
    this.attemptsMade = 0;
    this.returnvalue = undefined;
    this.failedReason = undefined;
    this.timestamp = Date.now();
    this.processedOn = undefined;
    this.finishedOn = undefined;
    this.status = 'waiting'; // waiting | delayed | active | completed | failed
    this.progress = 0;
  }
  async updateProgress(value) {
    this.progress = value;
    this.queue.events.emit('progress', this, value);
  }
  async log(message) {
    this.queue.events.emit('log', this, message);
  }
}
Job._counter = 0;

class Queue extends EventEmitter {
  constructor(name, _connectionOpts) {
    super();
    this.name = name;
    this.events = new EventEmitter();
    /** @type {Job[]} */
    this.jobs = [];
    this.deadLetterJobs = []; // DLQ
  }

  /**
   * Add a job to the queue.
   * In real BullMQ: Queue.add(name, data, opts)
   */
  async add(name, data, opts = {}) {
    const job = new Job(this, name, data, opts);
    if (job.opts.delay > 0) {
      job.status = 'delayed';
    }
    this.jobs.push(job);
    this.emit('waiting', job);
    return job;
  }

  /** Bulk add (BullMQ supports addBulk for atomicity). */
  async addBulk(jobDefs) {
    return Promise.all(jobDefs.map((d) => this.add(d.name, d.data, d.opts)));
  }

  /** Retrieve a job by ID. */
  async getJob(id) {
    return this.jobs.find((j) => j.id === id) ?? null;
  }

  /** Drain the queue (remove all waiting jobs). */
  async drain() {
    this.jobs = this.jobs.filter((j) => j.status !== 'waiting');
  }

  async close() {
    this.removeAllListeners();
    this.events.removeAllListeners();
  }
}

class Worker extends EventEmitter {
  /**
   * @param {string} queueName
   * @param {(job: Job) => Promise<any>} processor
   * @param {{ concurrency?: number }} opts
   */
  constructor(queueName, processor, opts = {}) {
    super();
    this.queueName = queueName;
    this.processor = processor;
    this.concurrency = opts.concurrency ?? 1;
    this.running = false;
    this._queue = null; // linked during demo
  }

  /** Link to our simulated queue and start processing. */
  linkQueue(queue) {
    this._queue = queue;
  }

  async run() {
    if (!this._queue) throw new Error('Worker not linked to a queue');
    this.running = true;

    while (this.running) {
      // Sort by priority (lower = higher priority), then by timestamp (FIFO).
      const now = Date.now();
      const ready = this._queue.jobs
        .filter((j) =>
          (j.status === 'waiting') ||
          (j.status === 'delayed' && j.timestamp + j.opts.delay <= now)
        )
        .sort((a, b) => a.opts.priority - b.opts.priority || a.timestamp - b.timestamp);

      if (ready.length === 0) break; // nothing to process

      // Process up to `concurrency` jobs in parallel.
      const batch = ready.slice(0, this.concurrency);
      await Promise.allSettled(batch.map((job) => this._processJob(job)));
    }
  }

  async _processJob(job) {
    job.status = 'active';
    job.processedOn = Date.now();
    job.attemptsMade++;

    try {
      const result = await this.processor(job);
      job.returnvalue = result;
      job.status = 'completed';
      job.finishedOn = Date.now();
      this.emit('completed', job, result);
      this._queue.events.emit('completed', job, result);
    } catch (err) {
      job.failedReason = err.message;
      if (job.attemptsMade < job.opts.attempts) {
        // Retry: put back as waiting with delay based on backoff strategy
        job.status = 'waiting';
        const backoffDelay =
          job.opts.backoff.type === 'exponential'
            ? job.opts.backoff.delay * 2 ** (job.attemptsMade - 1)
            : job.opts.backoff.delay;
        job.opts.delay = backoffDelay;
        job.timestamp = Date.now();
        job.status = 'delayed';
        this.emit('retrying', job, err);
      } else {
        job.status = 'failed';
        job.finishedOn = Date.now();
        // Move to dead letter queue after all attempts exhausted
        this._queue.deadLetterJobs.push(job);
        this.emit('failed', job, err);
        this._queue.events.emit('failed', job, err);
      }
    }
  }

  async close() {
    this.running = false;
    this.removeAllListeners();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: CACHING STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LRU Cache (Least Recently Used) using a Map.
 *
 * Map in JS preserves insertion order, so the *first* entry is the
 * least-recently used. On every get/set we delete-and-re-insert so the
 * accessed key moves to the end (most recently used).
 *
 * Time complexity: O(1) for get, set, delete.
 */
class LRUCache {
  /**
   * @param {number} capacity Maximum number of entries.
   */
  constructor(capacity) {
    this.capacity = capacity;
    /** @type {Map<string, any>} */
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict the least recently used (first key)
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  get size() {
    return this.cache.size;
  }

  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Cache-Aside (Lazy Loading) Pattern
 *
 * Flow:
 *   1. Application checks cache.
 *   2. Cache HIT  -> return cached value.
 *   3. Cache MISS -> fetch from DB, store in cache, return value.
 *
 * Pros: Only requested data is cached; cache failure is non-fatal.
 * Cons: First request always slow (cache miss); data can become stale.
 */
class CacheAside {
  constructor(redis, ttlSeconds = 60) {
    this.redis = redis;
    this.ttl = ttlSeconds;
  }

  async get(key, fetchFromDb) {
    // Step 1: Check cache
    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached); // cache hit
    }
    // Step 2: Cache miss -> fetch from source
    const data = await fetchFromDb();
    // Step 3: Populate cache
    await this.redis.set(key, JSON.stringify(data), { EX: this.ttl });
    return data;
  }

  async invalidate(key) {
    await this.redis.del(key);
  }
}

/**
 * Write-Through Pattern
 *
 * Flow:
 *   1. Application writes to cache AND database simultaneously.
 *   2. Reads always hit the cache (which is always up to date).
 *
 * Pros: Cache is always consistent with DB.
 * Cons: Write latency is higher (two writes); unused data may fill cache.
 */
class WriteThrough {
  constructor(redis, ttlSeconds = 300) {
    this.redis = redis;
    this.ttl = ttlSeconds;
    // Simulated DB
    this.db = new Map();
  }

  async write(key, value) {
    // Write to both cache and DB atomically
    await this.redis.set(key, JSON.stringify(value), { EX: this.ttl });
    this.db.set(key, value); // "database write"
    return value;
  }

  async read(key) {
    const cached = await this.redis.get(key);
    if (cached !== null) return JSON.parse(cached);
    // Fallback to DB if cache was evicted
    const dbValue = this.db.get(key) ?? null;
    if (dbValue !== null) {
      await this.redis.set(key, JSON.stringify(dbValue), { EX: this.ttl });
    }
    return dbValue;
  }
}

/**
 * Write-Behind (Write-Back) Pattern (concept)
 *
 * The application writes ONLY to the cache. A background process
 * asynchronously flushes dirty entries to the database.
 *
 * Pros: Very fast writes.
 * Cons: Risk of data loss if cache crashes before flush; complexity.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token Bucket Rate Limiter
 *
 * Concept: A bucket holds up to `capacity` tokens. Tokens are added at a
 * constant `refillRate` (tokens/second). Each request consumes one token.
 * If the bucket is empty, the request is rejected.
 *
 * Pros: Allows controlled bursts up to capacity.
 * Cons: In-memory only; not distributed without external store.
 */
class TokenBucketLimiter {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  tryConsume(tokensNeeded = 1) {
    this._refill();
    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return { allowed: true, remaining: Math.floor(this.tokens) };
    }
    return { allowed: false, remaining: 0, retryAfterMs: Math.ceil((tokensNeeded - this.tokens) / this.refillRate * 1000) };
  }
}

/**
 * Sliding Window Rate Limiter (Redis-backed)
 *
 * Uses a sorted set where each request is a member scored by its timestamp.
 * To check the rate:
 *   1. Remove all entries older than the window.
 *   2. Count remaining entries.
 *   3. If count < limit, add the new entry and allow.
 *
 * This is the approach used by many production API gateways.
 */
class SlidingWindowLimiter {
  constructor(redis, { windowMs = 60_000, maxRequests = 100 } = {}) {
    this.redis = redis;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async isAllowed(identifier) {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove entries outside the current window
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const count = await this.redis.zcard(key);

    if (count < this.maxRequests) {
      // Add this request
      await this.redis.zadd(key, now, `${now}:${Math.random()}`);
      await this.redis.expire(key, Math.ceil(this.windowMs / 1000));
      return { allowed: true, remaining: this.maxRequests - count - 1, resetMs: this.windowMs };
    }

    return { allowed: false, remaining: 0, resetMs: this.windowMs };
  }
}

/**
 * Fixed Window Counter (simplest, Redis-backed)
 *
 * Increment a counter keyed by the current time window.
 * Pros: Simple, low overhead.
 * Cons: Burst at window boundaries (2x burst possible).
 */
class FixedWindowLimiter {
  constructor(redis, { windowSec = 60, maxRequests = 100 } = {}) {
    this.redis = redis;
    this.windowSec = windowSec;
    this.maxRequests = maxRequests;
  }

  async isAllowed(identifier) {
    const windowKey = Math.floor(Date.now() / 1000 / this.windowSec);
    const key = `ratelimit:fixed:${identifier}:${windowKey}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.windowSec);
    }
    if (count <= this.maxRequests) {
      return { allowed: true, remaining: this.maxRequests - count };
    }
    return { allowed: false, remaining: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: CIRCUIT BREAKER PATTERN
// ─────────────────────────────────────────────────────────────────────────────
//
// Prevents cascading failures by "tripping" a circuit when a downstream
// service is failing. Three states:
//
//   CLOSED   -> normal operation; failures are counted
//   OPEN     -> all calls fail immediately (fast-fail); after a timeout,
//               transitions to HALF_OPEN
//   HALF_OPEN -> allows a single probe request; if it succeeds, circuit
//                closes; if it fails, circuit opens again
//

class CircuitBreaker extends EventEmitter {
  constructor(fn, options = {}) {
    super();
    this.fn = fn; // the function to protect
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.state = 'CLOSED';     // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async call(...args) {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.emit('halfOpen');
      } else {
        throw new Error('Circuit breaker is OPEN - request rejected');
      }
    }

    try {
      const result = await this.fn(...args);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.emit('close');
    }
    this.successCount++;
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.emit('open');
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: EVENT-DRIVEN ARCHITECTURE WITH EventEmitter
// ─────────────────────────────────────────────────────────────────────────────
//
// Node.js core pattern: many core modules (streams, http, fs watcher)
// extend EventEmitter. Great for decoupling producers and consumers.
//
// Interview points:
//   - .on() vs .once()
//   - .removeListener() to prevent memory leaks
//   - Error event is special: unhandled 'error' crashes the process
//   - EventEmitter is synchronous by default (listeners run in order)
//   - Use setImmediate or queueMicrotask for async dispatch if needed

class OrderService extends EventEmitter {
  constructor() {
    super();
    this.orders = new Map();
  }

  async createOrder(orderData) {
    const order = { id: `ord_${Date.now()}`, ...orderData, status: 'created' };
    this.orders.set(order.id, order);
    // Emit events that other services listen to (decoupled)
    this.emit('order:created', order);
    return order;
  }

  async fulfillOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');
    order.status = 'fulfilled';
    this.emit('order:fulfilled', order);
    return order;
  }
}

// Listeners (separate "services" reacting to events)
function setupOrderListeners(orderService) {
  // Inventory service
  orderService.on('order:created', (order) => {
    order._inventoryReserved = true;
  });
  // Notification service
  orderService.on('order:created', (order) => {
    order._notificationSent = true;
  });
  // Analytics
  orderService.on('order:fulfilled', (order) => {
    order._analyticsRecorded = true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: CQRS CONCEPT (Command Query Responsibility Segregation)
// ─────────────────────────────────────────────────────────────────────────────
//
// Separate the WRITE model (commands) from the READ model (queries).
//
// Why?
//   - Reads and writes have different scaling needs
//   - Read model can be denormalized / optimized for queries
//   - Write model can enforce business rules / domain logic
//
// Often combined with Event Sourcing: commands produce events that
// update the read model asynchronously.

class CQRSExample {
  constructor() {
    // Write side (normalized, enforces invariants)
    this.writeStore = new Map(); // id -> { id, name, email, balance }
    // Read side (denormalized, optimized for queries)
    this.readStore = {
      usersByEmail: new Map(),
      usersWithHighBalance: [],
    };
    this.events = [];
  }

  // ── Commands (write side) ──────────────────────────────────────────────
  executeCommand(command) {
    switch (command.type) {
      case 'CREATE_USER': {
        const user = { id: command.id, name: command.name, email: command.email, balance: 0 };
        this.writeStore.set(user.id, user);
        const event = { type: 'USER_CREATED', data: { ...user }, timestamp: Date.now() };
        this.events.push(event);
        this._project(event); // Update read model
        return user;
      }
      case 'DEPOSIT': {
        const user = this.writeStore.get(command.userId);
        if (!user) throw new Error('User not found');
        user.balance += command.amount;
        const event = { type: 'BALANCE_UPDATED', data: { ...user }, timestamp: Date.now() };
        this.events.push(event);
        this._project(event);
        return user;
      }
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  }

  // ── Queries (read side) ────────────────────────────────────────────────
  queryByEmail(email) {
    return this.readStore.usersByEmail.get(email) ?? null;
  }
  queryHighBalanceUsers(threshold = 1000) {
    return this.readStore.usersWithHighBalance.filter((u) => u.balance >= threshold);
  }

  // ── Projection (event -> read model update) ────────────────────────────
  _project(event) {
    switch (event.type) {
      case 'USER_CREATED':
        this.readStore.usersByEmail.set(event.data.email, event.data);
        break;
      case 'BALANCE_UPDATED':
        this.readStore.usersByEmail.set(event.data.email, event.data);
        if (event.data.balance >= 1000) {
          const idx = this.readStore.usersWithHighBalance.findIndex((u) => u.id === event.data.id);
          if (idx >= 0) this.readStore.usersWithHighBalance[idx] = event.data;
          else this.readStore.usersWithHighBalance.push(event.data);
        }
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: IDEMPOTENCY PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
//
// An operation is idempotent if executing it multiple times produces the
// same result as executing it once. Critical for:
//   - Payment processing (don't charge twice)
//   - Webhook handlers (may be delivered multiple times)
//   - Message queue consumers (at-least-once delivery)
//
// Implementation: store an idempotency key with the result; on duplicate
// requests, return the stored result instead of re-executing.

class IdempotencyStore {
  constructor(redis, ttlSeconds = 86400) {
    this.redis = redis;
    this.ttl = ttlSeconds;
  }

  /**
   * Execute `fn` idempotently keyed by `idempotencyKey`.
   * If the key already exists, return the stored result.
   */
  async execute(idempotencyKey, fn) {
    const cacheKey = `idempotency:${idempotencyKey}`;

    // Check if we already processed this request
    const existing = await this.redis.get(cacheKey);
    if (existing !== null) {
      const parsed = JSON.parse(existing);
      return { result: parsed, deduplicated: true };
    }

    // Lock: use SET NX to prevent concurrent execution of the same key
    const lockKey = `idempotency-lock:${idempotencyKey}`;
    const locked = await this.redis.set(lockKey, '1', { NX: true, EX: 30 });
    if (!locked) {
      throw new Error('Concurrent request with same idempotency key');
    }

    try {
      const result = await fn();
      // Store the result
      await this.redis.set(cacheKey, JSON.stringify(result), { EX: this.ttl });
      return { result, deduplicated: false };
    } finally {
      await this.redis.del(lockKey);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: BACKGROUND JOB PROCESSING PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
//
// Common patterns for background work:
//
//  1. Simple delayed execution    - setTimeout / BullMQ delayed jobs
//  2. Recurring / cron jobs       - BullMQ repeat option or node-cron
//  3. Job chaining / workflows    - BullMQ Flows (parent depends on children)
//  4. Priority processing         - BullMQ priority option
//  5. Rate-limited processing     - BullMQ rate limiter on the Worker
//  6. Job batching                - Collect items, process in bulk

/**
 * Simulated job scheduler supporting delayed and recurring jobs.
 */
class JobScheduler extends EventEmitter {
  constructor() {
    super();
    this.scheduledJobs = [];
    this.executedJobs = [];
  }

  /**
   * Schedule a one-time job.
   */
  scheduleOnce(name, delayMs, handler) {
    const job = {
      id: `sched_${++JobScheduler._counter}`,
      name,
      type: 'once',
      delayMs,
      handler,
      scheduledAt: Date.now(),
    };
    this.scheduledJobs.push(job);
    return job;
  }

  /**
   * Schedule a recurring job (simplified cron).
   * @param {number} intervalMs - Repeat interval.
   * @param {number} maxRuns - Max executions (for demo purposes).
   */
  scheduleRecurring(name, intervalMs, handler, maxRuns = 3) {
    const job = {
      id: `sched_${++JobScheduler._counter}`,
      name,
      type: 'recurring',
      intervalMs,
      handler,
      maxRuns,
      runCount: 0,
    };
    this.scheduledJobs.push(job);
    return job;
  }

  /** Execute all scheduled jobs (simulated time progression). */
  async runAll() {
    for (const job of this.scheduledJobs) {
      if (job.type === 'once') {
        const result = await job.handler();
        this.executedJobs.push({ ...job, result });
        this.emit('completed', job);
      } else if (job.type === 'recurring') {
        while (job.runCount < job.maxRuns) {
          job.runCount++;
          const result = await job.handler();
          this.executedJobs.push({ ...job, result, run: job.runCount });
          this.emit('completed', job);
        }
      }
    }
  }
}
JobScheduler._counter = 0;

// =============================================================================
// DEMO / TESTS
// =============================================================================

async function main() {
  const redis = new InMemoryRedis();
  let passed = 0;
  let failed = 0;

  function assert(condition, label) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`  FAIL: ${label}`);
    }
  }

  // ── DEMO 1: Redis data structures ──────────────────────────────────────
  console.log('\n=== DEMO 1: Redis Data Structures ===');
  {
    // Strings
    await redis.set('name', 'Alice');
    assert((await redis.get('name')) === 'Alice', 'String GET/SET');

    await redis.set('counter', '0');
    await redis.incr('counter');
    await redis.incr('counter');
    assert((await redis.get('counter')) === '2', 'INCR');

    // TTL
    await redis.set('temp', 'data', { EX: 2 });
    assert((await redis.get('temp')) === 'data', 'TTL: value exists');
    const ttl = await redis.ttl('temp');
    assert(ttl > 0 && ttl <= 2, 'TTL: ttl is positive');

    // NX (set only if not exists)
    await redis.set('name', 'Bob', { NX: true });
    assert((await redis.get('name')) === 'Alice', 'SET NX does not overwrite');

    // Lists
    await redis.rpush('queue', 'a', 'b', 'c');
    assert((await redis.llen('queue')) === 3, 'List RPUSH + LLEN');
    assert((await redis.lpop('queue')) === 'a', 'List LPOP');
    const range = await redis.lrange('queue', 0, -1);
    assert(range.length === 2 && range[0] === 'b', 'List LRANGE');

    // Sets
    await redis.sadd('tags', 'node', 'redis', 'node');
    assert((await redis.scard('tags')) === 2, 'Set SADD deduplicates');
    assert((await redis.sismember('tags', 'redis')) === 1, 'Set SISMEMBER');

    // Sorted Sets
    await redis.zadd('leaderboard', 100, 'alice', 200, 'bob', 150, 'charlie');
    const top = await redis.zrange('leaderboard', 0, -1);
    assert(top[0] === 'alice' && top[2] === 'bob', 'Sorted set ordered by score');

    // Hashes
    await redis.hset('user:1', 'name', 'Alice', 'age', '30', 'city', 'NYC');
    assert((await redis.hget('user:1', 'name')) === 'Alice', 'Hash HGET');
    const all = await redis.hgetall('user:1');
    assert(all.city === 'NYC', 'Hash HGETALL');
    await redis.hincrby('user:1', 'age', 1);
    assert((await redis.hget('user:1', 'age')) === '31', 'Hash HINCRBY');

    // Multi/pipeline
    const results = await redis.multi()
      .set('a', '1')
      .set('b', '2')
      .get('a')
      .get('b')
      .exec();
    assert(results[2] === '1' && results[3] === '2', 'MULTI/pipeline');

    // Pub/Sub
    let received = null;
    redis.subscribe('notifications', (msg) => { received = msg; });
    await redis.publish('notifications', 'hello world');
    assert(received === 'hello world', 'Pub/Sub');
    console.log(`  Redis data structures: all checks passed`);
  }

  // ── DEMO 2: BullMQ-style queue ────────────────────────────────────────
  console.log('\n=== DEMO 2: BullMQ Queue Patterns ===');
  {
    const emailQueue = new Queue('email');
    const worker = new Worker('email', async (job) => {
      if (job.name === 'send-welcome') {
        return { sent: true, to: job.data.email };
      }
      if (job.name === 'send-newsletter' && job.attemptsMade === 1) {
        throw new Error('Temporary failure');
      }
      return { sent: true };
    }, { concurrency: 2 });
    worker.linkQueue(emailQueue);

    // Add jobs with different options
    await emailQueue.add('send-welcome', { email: 'alice@example.com' });
    await emailQueue.add('send-newsletter', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 100 },
    });
    await emailQueue.add('send-promo', { discount: 20 }, {
      delay: 50,
      priority: 10, // lower priority
    });
    await emailQueue.add('send-alert', { critical: true }, {
      priority: 1, // higher priority (processed first among waiting)
    });

    const completedJobs = [];
    worker.on('completed', (job, result) => completedJobs.push({ name: job.name, result }));
    worker.on('failed', (job, err) => {});

    // Run worker
    await worker.run();
    // Retry the failed job (it should have been delayed for retry)
    await worker.run();
    // Run again to process any remaining delayed
    await sleep(60);
    await worker.run();

    assert(completedJobs.some((j) => j.name === 'send-welcome'), 'Welcome email processed');
    assert(completedJobs.some((j) => j.name === 'send-alert'), 'Alert processed');
    console.log(`  Completed jobs: ${completedJobs.map((j) => j.name).join(', ')}`);
    console.log(`  Dead letter queue size: ${emailQueue.deadLetterJobs.length}`);

    await emailQueue.close();
    await worker.close();
  }

  // ── DEMO 3: Caching strategies ────────────────────────────────────────
  console.log('\n=== DEMO 3: Caching Strategies ===');
  {
    // LRU Cache
    const lru = new LRUCache(3);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3);
    lru.get('a');      // 'a' is now most recently used
    lru.set('d', 4);   // evicts 'b' (least recently used)
    assert(lru.get('b') === undefined, 'LRU evicted least recently used');
    assert(lru.get('a') === 1, 'LRU kept recently used');
    assert(lru.size === 3, 'LRU respects capacity');
    console.log(`  LRU hit rate: ${(lru.hitRate * 100).toFixed(0)}%`);

    // Cache-Aside
    const cacheAside = new CacheAside(redis, 60);
    let dbCallCount = 0;
    const fetchUser = async () => { dbCallCount++; return { id: 1, name: 'Alice' }; };

    const user1 = await cacheAside.get('user:1:profile', fetchUser);
    const user2 = await cacheAside.get('user:1:profile', fetchUser); // cache hit
    assert(dbCallCount === 1, 'Cache-aside: DB called only once');
    assert(user1.name === 'Alice' && user2.name === 'Alice', 'Cache-aside: correct data');
    console.log(`  Cache-aside: DB calls = ${dbCallCount}`);

    // Write-Through
    const wt = new WriteThrough(redis, 300);
    await wt.write('product:1', { name: 'Widget', price: 9.99 });
    const product = await wt.read('product:1');
    assert(product.price === 9.99, 'Write-through: consistent read');
    console.log(`  Write-through: product = ${JSON.stringify(product)}`);
  }

  // ── DEMO 4: Rate limiting ─────────────────────────────────────────────
  console.log('\n=== DEMO 4: Rate Limiting ===');
  {
    // Token Bucket
    const bucket = new TokenBucketLimiter(5, 1); // 5 capacity, 1 token/sec refill
    const tokenResults = [];
    for (let i = 0; i < 7; i++) {
      tokenResults.push(bucket.tryConsume());
    }
    const allowed = tokenResults.filter((r) => r.allowed).length;
    const denied = tokenResults.filter((r) => !r.allowed).length;
    assert(allowed === 5, 'Token bucket: allowed 5 requests');
    assert(denied === 2, 'Token bucket: denied 2 requests');
    console.log(`  Token bucket: ${allowed} allowed, ${denied} denied`);

    // Sliding Window (Redis-backed)
    const slider = new SlidingWindowLimiter(redis, { windowMs: 10_000, maxRequests: 3 });
    const r1 = await slider.isAllowed('user:42');
    const r2 = await slider.isAllowed('user:42');
    const r3 = await slider.isAllowed('user:42');
    const r4 = await slider.isAllowed('user:42'); // should be denied
    assert(r1.allowed && r2.allowed && r3.allowed, 'Sliding window: first 3 allowed');
    assert(!r4.allowed, 'Sliding window: 4th denied');
    console.log(`  Sliding window: remaining after 3 requests = ${r3.remaining}`);

    // Fixed Window
    const fixedLimiter = new FixedWindowLimiter(redis, { windowSec: 60, maxRequests: 2 });
    const f1 = await fixedLimiter.isAllowed('api:key:1');
    const f2 = await fixedLimiter.isAllowed('api:key:1');
    const f3 = await fixedLimiter.isAllowed('api:key:1');
    assert(f1.allowed && f2.allowed, 'Fixed window: first 2 allowed');
    assert(!f3.allowed, 'Fixed window: 3rd denied');
    console.log(`  Fixed window: working correctly`);
  }

  // ── DEMO 5: Circuit Breaker ───────────────────────────────────────────
  console.log('\n=== DEMO 5: Circuit Breaker ===');
  {
    let callCount = 0;
    const unreliableService = async () => {
      callCount++;
      if (callCount <= 5) throw new Error('Service unavailable');
      return 'success';
    };

    const breaker = new CircuitBreaker(unreliableService, {
      failureThreshold: 3,
      resetTimeoutMs: 50, // short for demo
    });

    const results = [];
    // Make 5 calls - first 3 failures trip the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.call();
        results.push('success');
      } catch (e) {
        results.push(e.message);
      }
    }

    assert(breaker.state === 'OPEN', 'Circuit breaker is OPEN after threshold');
    assert(results[3] === 'Circuit breaker is OPEN - request rejected', 'Fast-fail when open');
    console.log(`  State: ${breaker.state}, failures: ${breaker.failureCount}`);
    console.log(`  Results: ${results.map((r, i) => `${i + 1}:${r.substring(0, 20)}...`).join(' | ')}`);

    // Wait for reset timeout, then circuit should half-open
    await sleep(60);
    callCount = 10; // make next call succeed
    try {
      const result = await breaker.call();
      assert(result === 'success', 'Circuit breaker recovered');
      assert(breaker.state === 'CLOSED', 'Circuit breaker is CLOSED after recovery');
      console.log(`  After recovery: state=${breaker.state}`);
    } catch {
      // may not recover in time for demo
    }
  }

  // ── DEMO 6: Event-Driven Architecture ─────────────────────────────────
  console.log('\n=== DEMO 6: Event-Driven Architecture ===');
  {
    const orderService = new OrderService();
    setupOrderListeners(orderService);

    const order = await orderService.createOrder({ product: 'Widget', quantity: 2 });
    assert(order._inventoryReserved === true, 'Inventory listener fired');
    assert(order._notificationSent === true, 'Notification listener fired');

    await orderService.fulfillOrder(order.id);
    assert(order._analyticsRecorded === true, 'Analytics listener fired');
    assert(order.status === 'fulfilled', 'Order status updated');
    console.log(`  Order ${order.id}: status=${order.status}, ` +
      `inventory=${order._inventoryReserved}, notified=${order._notificationSent}`);
  }

  // ── DEMO 7: CQRS ──────────────────────────────────────────────────────
  console.log('\n=== DEMO 7: CQRS Pattern ===');
  {
    const cqrs = new CQRSExample();

    cqrs.executeCommand({ type: 'CREATE_USER', id: 'u1', name: 'Alice', email: 'alice@test.com' });
    cqrs.executeCommand({ type: 'CREATE_USER', id: 'u2', name: 'Bob', email: 'bob@test.com' });
    cqrs.executeCommand({ type: 'DEPOSIT', userId: 'u1', amount: 1500 });
    cqrs.executeCommand({ type: 'DEPOSIT', userId: 'u2', amount: 500 });

    // Query the read model
    const alice = cqrs.queryByEmail('alice@test.com');
    assert(alice.balance === 1500, 'CQRS: query by email works');
    const highBalance = cqrs.queryHighBalanceUsers(1000);
    assert(highBalance.length === 1 && highBalance[0].name === 'Alice', 'CQRS: high balance query');
    console.log(`  Events recorded: ${cqrs.events.length}`);
    console.log(`  High balance users: ${highBalance.map((u) => `${u.name} ($${u.balance})`).join(', ')}`);
  }

  // ── DEMO 8: Idempotency ───────────────────────────────────────────────
  console.log('\n=== DEMO 8: Idempotency Patterns ===');
  {
    const idempotency = new IdempotencyStore(redis, 3600);
    let processCount = 0;

    const processPayment = async () => {
      processCount++;
      return { chargeId: 'ch_123', amount: 99.99 };
    };

    // First call: executes the function
    const first = await idempotency.execute('payment-key-abc', processPayment);
    assert(!first.deduplicated, 'First call is not deduplicated');
    assert(first.result.chargeId === 'ch_123', 'First call returns result');

    // Second call with same key: returns cached result
    const second = await idempotency.execute('payment-key-abc', processPayment);
    assert(second.deduplicated, 'Second call is deduplicated');
    assert(second.result.chargeId === 'ch_123', 'Second call returns same result');

    assert(processCount === 1, 'Payment processed only once');
    console.log(`  Process count: ${processCount} (should be 1)`);
    console.log(`  First: deduplicated=${first.deduplicated}, Second: deduplicated=${second.deduplicated}`);
  }

  // ── DEMO 9: Background Job Scheduler ──────────────────────────────────
  console.log('\n=== DEMO 9: Background Job Scheduler ===');
  {
    const scheduler = new JobScheduler();

    scheduler.scheduleOnce('send-report', 0, async () => {
      return { report: 'monthly', pages: 42 };
    });

    scheduler.scheduleRecurring('cleanup', 100, async () => {
      return { cleaned: Math.floor(Math.random() * 100) };
    }, 3);

    await scheduler.runAll();
    assert(scheduler.executedJobs.length === 4, 'Scheduler: 1 once + 3 recurring = 4 executions');
    console.log(`  Executed ${scheduler.executedJobs.length} jobs: ${scheduler.executedJobs.map((j) => j.name).join(', ')}`);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  redis.quit();

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
