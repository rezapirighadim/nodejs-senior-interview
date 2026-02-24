/**
 * ============================================================================
 * LOW-LEVEL DESIGN: Rate Limiter
 * ============================================================================
 *
 * Problem:
 *   Design a rate limiter that supports multiple algorithms and per-client
 *   limiting. The system should be strategy-swappable at runtime.
 *
 * Key Concepts:
 *   - Strategy pattern: swap between Token Bucket, Sliding Window Log,
 *     and Fixed Window Counter algorithms
 *   - Per-client state tracked by client ID
 *   - Time-based algorithms with configurable windows
 *   - Quota info returned with each request (remaining, retryAfter)
 *
 * Algorithms:
 *   1. Token Bucket: tokens refill at a fixed rate; each request consumes one
 *   2. Sliding Window Log: track exact timestamps; count within window
 *   3. Fixed Window Counter: divide time into fixed windows; count per window
 *
 * Classes:
 *   RateLimitResult           -- outcome of an allow() check
 *   RateLimitAlgorithm (base) -- strategy interface
 *     TokenBucket             -- refill-based limiting
 *     SlidingWindowLog        -- timestamp-log-based limiting
 *     FixedWindowCounter      -- window-counter-based limiting
 *   RateLimiter               -- facade: per-client limiting using a strategy
 *
 * Run: node 05_rate_limiter.js
 * ============================================================================
 */

// ─── Rate Limit Result ──────────────────────────────────────────────────────

class RateLimitResult {
  /**
   * @param {boolean} allowed - whether the request is allowed
   * @param {number} remaining - remaining quota in the current period
   * @param {number} limit - total limit for the period
   * @param {number} retryAfterMs - ms to wait before retrying (0 if allowed)
   */
  constructor(allowed, remaining, limit, retryAfterMs = 0) {
    this.allowed = allowed;
    this.remaining = remaining;
    this.limit = limit;
    this.retryAfterMs = retryAfterMs;
  }

  toString() {
    return this.allowed
      ? `ALLOWED (remaining: ${this.remaining}/${this.limit})`
      : `DENIED  (retry after ${this.retryAfterMs}ms)`;
  }
}

// ─── Abstract Algorithm ─────────────────────────────────────────────────────

/**
 * @abstract Base class for rate limiting algorithms.
 * Each algorithm maintains its own per-client state.
 */
class RateLimitAlgorithm {
  /**
   * @param {number} maxRequests - maximum requests allowed in the window
   * @param {number} windowMs - time window in milliseconds
   */
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request from the given client should be allowed.
   * @param {string} clientId
   * @param {number} [now] - current time in ms (injectable for testing)
   * @returns {RateLimitResult}
   */
  allow(clientId, now = Date.now()) {
    throw new Error("RateLimitAlgorithm.allow() must be overridden");
  }

  /**
   * Reset state for a specific client.
   * @param {string} clientId
   */
  reset(clientId) {
    throw new Error("RateLimitAlgorithm.reset() must be overridden");
  }

  /** @returns {string} human-readable algorithm name */
  get name() {
    return this.constructor.name;
  }
}

// ─── Token Bucket ───────────────────────────────────────────────────────────

/**
 * Token Bucket: starts with `maxRequests` tokens. Each request costs 1 token.
 * Tokens refill at a fixed rate of `maxRequests / windowMs` tokens per ms.
 */
class TokenBucket extends RateLimitAlgorithm {
  constructor(maxRequests, windowMs) {
    super(maxRequests, windowMs);
    /** @type {Map<string, { tokens: number, lastRefill: number }>} */
    this.buckets = new Map();
  }

  /**
   * Refill tokens based on elapsed time, capped at maxRequests.
   * @param {{ tokens: number, lastRefill: number }} bucket
   * @param {number} now
   */
  #refill(bucket, now) {
    const elapsed = now - bucket.lastRefill;
    const refillRate = this.maxRequests / this.windowMs; // tokens per ms
    const tokensToAdd = elapsed * refillRate;
    bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /** @override */
  allow(clientId, now = Date.now()) {
    if (!this.buckets.has(clientId)) {
      this.buckets.set(clientId, { tokens: this.maxRequests, lastRefill: now });
    }

    const bucket = this.buckets.get(clientId);
    this.#refill(bucket, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return new RateLimitResult(
        true,
        Math.floor(bucket.tokens),
        this.maxRequests
      );
    }

    // Calculate when 1 token will be available
    const refillRate = this.maxRequests / this.windowMs;
    const waitMs = Math.ceil((1 - bucket.tokens) / refillRate);

    return new RateLimitResult(
      false,
      0,
      this.maxRequests,
      waitMs
    );
  }

  /** @override */
  reset(clientId) {
    this.buckets.delete(clientId);
  }
}

// ─── Sliding Window Log ─────────────────────────────────────────────────────

/**
 * Sliding Window Log: maintains a log of request timestamps per client.
 * Counts requests within the sliding window. Precise but memory-heavy.
 */
class SlidingWindowLog extends RateLimitAlgorithm {
  constructor(maxRequests, windowMs) {
    super(maxRequests, windowMs);
    /** @type {Map<string, number[]>} clientId -> sorted timestamps */
    this.logs = new Map();
  }

  /** @override */
  allow(clientId, now = Date.now()) {
    if (!this.logs.has(clientId)) {
      this.logs.set(clientId, []);
    }

    const log = this.logs.get(clientId);
    const windowStart = now - this.windowMs;

    // Evict old entries outside the window
    while (log.length > 0 && log[0] <= windowStart) {
      log.shift();
    }

    if (log.length < this.maxRequests) {
      log.push(now);
      return new RateLimitResult(
        true,
        this.maxRequests - log.length,
        this.maxRequests
      );
    }

    // Calculate when the oldest entry in the window will expire
    const oldestInWindow = log[0];
    const retryAfterMs = oldestInWindow + this.windowMs - now;

    return new RateLimitResult(
      false,
      0,
      this.maxRequests,
      Math.max(1, Math.ceil(retryAfterMs))
    );
  }

  /** @override */
  reset(clientId) {
    this.logs.delete(clientId);
  }
}

// ─── Fixed Window Counter ───────────────────────────────────────────────────

/**
 * Fixed Window Counter: divides time into fixed-length windows.
 * Each window has a counter. When a new window starts, the counter resets.
 * Simple and memory-efficient, but can allow bursts at window edges.
 */
class FixedWindowCounter extends RateLimitAlgorithm {
  constructor(maxRequests, windowMs) {
    super(maxRequests, windowMs);
    /** @type {Map<string, { windowStart: number, count: number }>} */
    this.windows = new Map();
  }

  /**
   * Get the window start time for a given timestamp.
   * @param {number} now
   * @returns {number}
   */
  #windowStart(now) {
    return Math.floor(now / this.windowMs) * this.windowMs;
  }

  /** @override */
  allow(clientId, now = Date.now()) {
    const currentWindowStart = this.#windowStart(now);

    if (!this.windows.has(clientId)) {
      this.windows.set(clientId, { windowStart: currentWindowStart, count: 0 });
    }

    const win = this.windows.get(clientId);

    // Reset if we've moved to a new window
    if (win.windowStart !== currentWindowStart) {
      win.windowStart = currentWindowStart;
      win.count = 0;
    }

    if (win.count < this.maxRequests) {
      win.count++;
      return new RateLimitResult(
        true,
        this.maxRequests - win.count,
        this.maxRequests
      );
    }

    // Wait until the next window starts
    const nextWindowStart = currentWindowStart + this.windowMs;
    const retryAfterMs = nextWindowStart - now;

    return new RateLimitResult(
      false,
      0,
      this.maxRequests,
      Math.max(1, Math.ceil(retryAfterMs))
    );
  }

  /** @override */
  reset(clientId) {
    this.windows.delete(clientId);
  }
}

// ─── Rate Limiter Facade ────────────────────────────────────────────────────

class RateLimiter {
  /**
   * @param {RateLimitAlgorithm} algorithm
   */
  constructor(algorithm) {
    this.algorithm = algorithm;
  }

  /**
   * Swap the algorithm at runtime (Strategy pattern).
   * @param {RateLimitAlgorithm} algorithm
   */
  setAlgorithm(algorithm) {
    this.algorithm = algorithm;
  }

  /**
   * Check if a request from clientId should be allowed.
   * @param {string} clientId
   * @param {number} [now]
   * @returns {RateLimitResult}
   */
  allow(clientId, now) {
    return this.algorithm.allow(clientId, now);
  }

  /**
   * Reset limits for a client.
   * @param {string} clientId
   */
  reset(clientId) {
    this.algorithm.reset(clientId);
  }

  /** @returns {string} */
  get algorithmName() {
    return this.algorithm.name;
  }
}

// ─── Demo Helpers ───────────────────────────────────────────────────────────

/**
 * Simulate a burst of requests from a client.
 * @param {RateLimiter} limiter
 * @param {string} clientId
 * @param {number} count
 * @param {number} [intervalMs=0] - spacing between requests
 * @param {number} [startTime]
 */
function simulateRequests(limiter, clientId, count, intervalMs = 0, startTime = Date.now()) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const now = startTime + i * intervalMs;
    const result = limiter.allow(clientId, now);
    results.push({ requestNum: i + 1, ...result });
  }
  return results;
}

// ─── Demo ───────────────────────────────────────────────────────────────────

function demo() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       RATE LIMITER  —  LLD DEMO             ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const windowMs = 1000; // 1-second window
  const maxReq = 5;      // 5 requests per window

  // ── 1. Token Bucket ──

  console.log("═══ 1. TOKEN BUCKET ═══");
  console.log(`  Config: ${maxReq} tokens, refill over ${windowMs}ms\n`);

  const tbLimiter = new RateLimiter(new TokenBucket(maxReq, windowMs));
  const startTime = Date.now();

  // Burst of 7 requests at once
  console.log("  Burst of 7 requests at t=0:");
  const tbResults = simulateRequests(tbLimiter, "client-A", 7, 0, startTime);
  for (const r of tbResults) {
    console.log(`    req #${r.requestNum}: ${r.allowed ? "ALLOWED" : "DENIED "}  remaining=${r.remaining}  retryAfter=${r.retryAfterMs}ms`);
  }

  // After waiting 400ms (40% of window => 2 tokens refilled)
  console.log("\n  After 400ms (expect ~2 tokens refilled):");
  const after400 = simulateRequests(tbLimiter, "client-A", 3, 0, startTime + 400);
  for (const r of after400) {
    console.log(`    req #${r.requestNum}: ${r.allowed ? "ALLOWED" : "DENIED "}  remaining=${r.remaining}`);
  }

  // ── 2. Sliding Window Log ──

  console.log("\n═══ 2. SLIDING WINDOW LOG ═══");
  console.log(`  Config: ${maxReq} requests per ${windowMs}ms window\n`);

  const swlLimiter = new RateLimiter(new SlidingWindowLog(maxReq, windowMs));
  const t0 = 1000000; // deterministic start time

  console.log("  5 requests spread across 800ms:");
  const swlResults = simulateRequests(swlLimiter, "client-B", 5, 200, t0);
  for (const r of swlResults) {
    console.log(`    req #${r.requestNum}: ${r.allowed ? "ALLOWED" : "DENIED "}  remaining=${r.remaining}`);
  }

  // 6th request at t0+900ms (still within window of first request at t0)
  console.log("\n  6th request at t0+900ms (within window):");
  const r6 = swlLimiter.allow("client-B", t0 + 900);
  console.log(`    req #6: ${r6}  retryAfter=${r6.retryAfterMs}ms`);

  // 6th request at t0+1100ms (first request at t0 has expired from window)
  console.log("\n  Retry at t0+1100ms (oldest entry expired):");
  const r7 = swlLimiter.allow("client-B", t0 + 1100);
  console.log(`    req #6 retry: ${r7}`);

  // ── 3. Fixed Window Counter ──

  console.log("\n═══ 3. FIXED WINDOW COUNTER ═══");
  console.log(`  Config: ${maxReq} requests per ${windowMs}ms window\n`);

  const fwcLimiter = new RateLimiter(new FixedWindowCounter(maxReq, windowMs));
  const windowBase = Math.floor(Date.now() / windowMs) * windowMs; // align to window

  console.log("  7 requests in same window:");
  const fwcResults = simulateRequests(fwcLimiter, "client-C", 7, 0, windowBase + 100);
  for (const r of fwcResults) {
    console.log(`    req #${r.requestNum}: ${r.allowed ? "ALLOWED" : "DENIED "}  remaining=${r.remaining}  retryAfter=${r.retryAfterMs}ms`);
  }

  // New window
  console.log("\n  New window starts (counter resets):");
  const nextWindow = windowBase + windowMs + 100;
  const fwcNew = simulateRequests(fwcLimiter, "client-C", 3, 0, nextWindow);
  for (const r of fwcNew) {
    console.log(`    req #${r.requestNum}: ${r.allowed ? "ALLOWED" : "DENIED "}  remaining=${r.remaining}`);
  }

  // ── 4. Per-client isolation ──

  console.log("\n═══ 4. PER-CLIENT ISOLATION ═══");
  const multiLimiter = new RateLimiter(new TokenBucket(3, 1000));

  console.log("  Client X: 4 requests");
  for (let i = 1; i <= 4; i++) {
    const res = multiLimiter.allow("client-X");
    console.log(`    X req #${i}: ${res}`);
  }
  console.log("  Client Y: 4 requests (independent quota)");
  for (let i = 1; i <= 4; i++) {
    const res = multiLimiter.allow("client-Y");
    console.log(`    Y req #${i}: ${res}`);
  }

  // ── 5. Strategy swap at runtime ──

  console.log("\n═══ 5. STRATEGY SWAP AT RUNTIME ═══");
  const limiter = new RateLimiter(new TokenBucket(3, 1000));
  console.log(`  Algorithm: ${limiter.algorithmName}`);
  console.log(`  Request: ${limiter.allow("test")}`);

  limiter.setAlgorithm(new SlidingWindowLog(3, 1000));
  console.log(`  Swapped to: ${limiter.algorithmName}`);
  console.log(`  Request: ${limiter.allow("test")}`);

  limiter.setAlgorithm(new FixedWindowCounter(3, 1000));
  console.log(`  Swapped to: ${limiter.algorithmName}`);
  console.log(`  Request: ${limiter.allow("test")}`);

  // ── 6. Reset client ──

  console.log("\n═══ 6. RESET CLIENT ═══");
  const resetLimiter = new RateLimiter(new TokenBucket(2, 1000));
  console.log(`  req 1: ${resetLimiter.allow("resettable")}`);
  console.log(`  req 2: ${resetLimiter.allow("resettable")}`);
  console.log(`  req 3: ${resetLimiter.allow("resettable")}`);
  console.log("  -- reset --");
  resetLimiter.reset("resettable");
  console.log(`  req 4 (after reset): ${resetLimiter.allow("resettable")}`);
  console.log(`  req 5 (after reset): ${resetLimiter.allow("resettable")}`);
  console.log(`  req 6 (after reset): ${resetLimiter.allow("resettable")}`);

  console.log("\n--- Done ---");
}

demo();
