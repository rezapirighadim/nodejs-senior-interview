# System Design: Distributed Rate Limiter

> **Interview Time Budget:** 40 minutes total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## Step 1: Clarify Requirements (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | Rate limit API requests | Per user, per IP, per API key |
| F2 | Multiple limiting dimensions | Different limits for different endpoints |
| F3 | Return rate limit headers | X-RateLimit-Limit, Remaining, Reset |
| F4 | Return 429 when limit exceeded | With Retry-After header |
| F5 | Configurable rate limit rules | Via config, hot-reloadable |
| F6 | Support multiple algorithms | Token bucket, sliding window, leaky bucket |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Ultra-low latency | < 1ms overhead per request |
| NF2 | High availability | Rate limiter down should NOT block traffic |
| NF3 | Accuracy | Minor over-counting acceptable, no significant under-counting |
| NF4 | Distributed | Consistent across multiple API gateway instances |
| NF5 | Atomicity | No race conditions in counter updates |

### Clarifying Questions to Ask

1. "Where does the rate limiter sit -- at API gateway level, middleware, or separate service?"
2. "Should we fail open or fail closed when the rate limiter is unavailable?"
3. "Do we need tiered rate limits (free vs premium users)?"
4. "Is approximate rate limiting acceptable or must it be exact?"
5. "Do we need rate limiting at multiple levels (per-user AND per-IP simultaneously)?"

---

## Step 2: Estimate (5 min)

### Traffic Estimates

```
API traffic to protect:
  100,000 requests/sec across all API gateways (average)
  Peak: 300,000 requests/sec

Each request requires:
  1 rate limit check (read + conditional write to Redis)
  = 300,000 Redis operations/sec at peak

Rate limit rules:
  - Per user: 100 requests/min
  - Per IP: 50 requests/min
  - Per API key: 1000 requests/min
  - Per endpoint: varies (e.g., POST /login: 5/min, GET /feed: 60/min)
```

### Storage Estimates

```
Per rate limit key in Redis:
  Key:   "rl:user:12345:min"  ~30 bytes
  Value: counter or token bucket state ~50 bytes
  TTL:   auto-expires (1-60 min windows)
  Total: ~80 bytes per active key

Active users in a window: ~5M unique users/min
  5M * 80 bytes = 400 MB
  With per-endpoint keys: 400 MB * 5 endpoints = 2 GB

Easily fits in a single Redis Cluster
```

### Latency Budget

```
Rate limit check must be:
  Redis round-trip:    ~0.5ms (same availability zone)
  Lua script execution: ~0.1ms
  Total overhead:       < 1ms per request

This is acceptable -- API response times are typically 50-200ms
Rate limiter adds < 1% overhead
```

---

## Step 3: High-Level Design (15 min)

### Architecture Diagram

```
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Client A │  │ Client B │  │ Client C │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │              │              │
    ┌────▼──────────────▼──────────────▼────┐
    │           Load Balancer               │
    └──────────────────┬────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌──────────┐    ┌──────────┐       ┌──────────┐
│API Gate- │    │API Gate- │       │API Gate- │
│way 1     │    │way 2     │       │way N     │
│          │    │          │       │          │
│┌────────┐│    │┌────────┐│       │┌────────┐│
││Rate    ││    ││Rate    ││       ││Rate    ││
││Limiter ││    ││Limiter ││       ││Limiter ││
││Midware ││    ││Midware ││       ││Midware ││
│└───┬────┘│    │└───┬────┘│       │└───┬────┘│
└────┼─────┘    └────┼─────┘       └────┼─────┘
     │               │                  │
     └───────────────┼──────────────────┘
                     │
          ┌──────────▼───────────┐
          │    Redis Cluster     │
          │                      │
          │  ┌────┐ ┌────┐      │
          │  │ M1 │ │ M2 │ ...  │  Masters: handle writes
          │  │ R1 │ │ R2 │      │  Replicas: failover
          │  └────┘ └────┘      │
          │                      │
          │  Lua scripts for     │
          │  atomic operations   │
          └──────────────────────┘
                     │
          ┌──────────▼───────────┐
          │    Rules Config      │
          │  (etcd / ConfigMap)  │
          │                      │
          │  - Per-user limits   │
          │  - Per-endpoint      │
          │  - Tier overrides    │
          └──────────────────────┘
                     │
                     ▼
     Rate limit exceeded? ──► YES ──► 429 Too Many Requests
                      │                 + Retry-After header
                      NO
                      │
                      ▼
              ┌───────────────┐
              │ Backend       │
              │ Services      │
              │ (protected)   │
              └───────────────┘
```

### API Response Headers

```
--- Normal response (within limits) ---
HTTP/1.1 200 OK
X-RateLimit-Limit: 100           # Max requests in window
X-RateLimit-Remaining: 73        # Requests remaining
X-RateLimit-Reset: 1708790460    # Unix timestamp when window resets

--- Rate limited response ---
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708790460
Retry-After: 37                  # Seconds until reset
Content-Type: application/json

{
    "error": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Try again in 37 seconds.",
    "retry_after": 37
}
```

### Rate Limit Rules Configuration

```javascript
// Rate limit rules (loaded from config service)
const rateLimitRules = {
    // Global per-user limits
    "user:default": {
        algorithm: "sliding_window",
        limit: 100,
        window: 60,              // seconds
    },

    // Per-endpoint overrides
    "endpoint:POST:/api/v1/login": {
        algorithm: "sliding_window",
        limit: 5,
        window: 60,
        key_type: "ip",          // by IP for login (user not authenticated yet)
    },

    "endpoint:POST:/api/v1/posts": {
        algorithm: "token_bucket",
        limit: 10,
        window: 60,
        burst: 5,                // allow burst of 5
    },

    "endpoint:GET:/api/v1/feed": {
        algorithm: "sliding_window",
        limit: 60,
        window: 60,
    },

    // Tier-based overrides
    "tier:premium": {
        multiplier: 5,           // 5x the default limits
    },

    // Per-IP limits (DDoS protection)
    "ip:default": {
        algorithm: "token_bucket",
        limit: 50,
        window: 60,
        burst: 20,
    },
};
```

---

## Step 4: Deep Dive (15 min)

### Deep Dive 1: Rate Limiting Algorithms Comparison

#### Algorithm A: Token Bucket

```
Concept:
  - Bucket holds N tokens (capacity)
  - Tokens added at rate R per second
  - Each request consumes 1 token
  - If no tokens available → reject

       ┌───────────────┐
       │  Token Bucket  │
       │               │     Tokens added
       │  ● ● ● ● ●   │ ◄── at fixed rate
       │  ● ● ●       │     (e.g., 1/sec)
       │               │
       └───────┬───────┘
               │
               ▼ Request takes 1 token
           (if available)
```

```javascript
// Redis Lua script for atomic token bucket
const TOKEN_BUCKET_SCRIPT = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])    -- tokens per second
    local now = tonumber(ARGV[3])            -- current timestamp (ms)
    local requested = tonumber(ARGV[4])      -- tokens requested (usually 1)

    local bucket = redis.call('hmget', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1])
    local last_refill = tonumber(bucket[2])

    -- Initialize if first request
    if tokens == nil then
        tokens = capacity
        last_refill = now
    end

    -- Calculate tokens to add since last refill
    local elapsed = (now - last_refill) / 1000.0
    tokens = math.min(capacity, tokens + elapsed * refill_rate)

    local allowed = 0
    local remaining = 0

    if tokens >= requested then
        tokens = tokens - requested
        allowed = 1
        remaining = math.floor(tokens)
    else
        remaining = 0
    end

    -- Save state
    redis.call('hmset', key, 'tokens', tostring(tokens), 'last_refill', tostring(now))
    redis.call('expire', key, math.ceil(capacity / refill_rate) + 1)

    return {allowed, remaining}
`;
```

**Best for:** Allowing bursts while maintaining average rate. API rate limiting.

#### Algorithm B: Sliding Window Log

```
Concept:
  - Store timestamp of each request
  - Count requests in last W seconds
  - If count >= limit → reject

  Time ──────────────────────────────────────►
       │     │  │    │ │ │       │  │  │
       └─────┴──┴────┴─┴─┴───────┴──┴──┘
       ◄─────── Window (60s) ──────────►
       Count = 8.  Limit = 10.  Allowed.
```

```javascript
const SLIDING_WINDOW_LOG_SCRIPT = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])         -- window in seconds
    local now = tonumber(ARGV[3])            -- current timestamp (ms)
    local window_start = now - (window * 1000)

    -- Remove entries outside the window
    redis.call('zremrangebyscore', key, '-inf', window_start)

    -- Count current entries
    local count = redis.call('zcard', key)

    if count < limit then
        -- Add current request
        redis.call('zadd', key, now, now .. ':' .. math.random(1000000))
        redis.call('expire', key, window + 1)
        return {1, limit - count - 1}  -- allowed, remaining
    else
        return {0, 0}  -- rejected, 0 remaining
    end
`;
```

**Best for:** Precise counting. Memory-intensive for high-volume endpoints.

#### Algorithm C: Sliding Window Counter (Recommended)

```
Concept:
  - Hybrid of fixed window + sliding window
  - Track counts for current and previous fixed windows
  - Estimate current sliding window count using weighted average

  Previous Window    Current Window
  ┌──────────────┐  ┌──────────────┐
  │  count = 40  │  │  count = 15  │
  └──────────────┘  └──────────────┘
                         ▲
                    70% into current window

  Estimate = 40 * 0.30 + 15 = 27
  Limit = 100 → Allowed
```

```javascript
const SLIDING_WINDOW_COUNTER_SCRIPT = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    -- Determine current and previous window
    local current_window = math.floor(now / (window * 1000))
    local previous_window = current_window - 1
    local elapsed_in_current = (now % (window * 1000)) / (window * 1000)

    local prev_key = key .. ':' .. previous_window
    local curr_key = key .. ':' .. current_window

    -- Get counts
    local prev_count = tonumber(redis.call('get', prev_key) or '0')
    local curr_count = tonumber(redis.call('get', curr_key) or '0')

    -- Weighted estimate
    local estimate = math.floor(prev_count * (1 - elapsed_in_current) + curr_count)

    if estimate < limit then
        -- Increment current window counter
        redis.call('incr', curr_key)
        redis.call('expire', curr_key, window * 2 + 1)
        return {1, limit - estimate - 1}
    else
        return {0, 0}
    end
`;
```

**Best for:** Balance of accuracy and memory efficiency. The recommended default.

#### Algorithm Comparison Table

| Aspect | Token Bucket | Sliding Window Log | Sliding Window Counter |
|--------|-------------|-------------------|----------------------|
| Memory per key | O(1) - 2 fields | O(N) - N timestamps | O(1) - 2 counters |
| Accuracy | Exact for rate | Exact for window | Approximate (~0.003% error) |
| Burst handling | Configurable burst | No burst | Smoothed |
| Complexity | Medium | Simple | Simple |
| Redis ops | 1 EVAL | 1 EVAL | 1 EVAL |
| **Best use** | API rate limiting | Login/auth limiting | General purpose |

---

### Deep Dive 2: Distributed Rate Limiting -- Race Conditions

```
Problem: Multiple API gateways checking Redis simultaneously

  Gateway 1                  Redis                  Gateway 2
      │                        │                        │
      │── GET count ──────────►│◄──────── GET count ────│
      │◄── count=99 ──────────│────────── count=99 ───►│
      │                        │                        │
      │  99 < 100, allow!      │      99 < 100, allow! │
      │── INCR ───────────────►│◄───────────── INCR ───│
      │                        │                        │
      │        count is now 101 -- LIMIT EXCEEDED!      │
```

**Solution: Atomic Lua Scripts**

```javascript
// All rate limit logic runs as a single atomic Lua script
// Redis executes Lua scripts atomically (single-threaded)

class DistributedRateLimiter {
    constructor(redisCluster, config) {
        this.redis = redisCluster;
        this.config = config;
        this.scripts = {};

        // Load scripts into Redis (EVALSHA for performance)
        this.loadScripts();
    }

    async loadScripts() {
        this.scripts.slidingWindow = await this.redis.script(
            'LOAD',
            SLIDING_WINDOW_COUNTER_SCRIPT
        );
    }

    async checkRateLimit(identifier, rule) {
        const key = `rl:${rule.key_type}:${identifier}:${rule.endpoint || 'global'}`;
        const now = Date.now();

        try {
            const [allowed, remaining] = await this.redis.evalsha(
                this.scripts.slidingWindow,
                1,        // number of keys
                key,
                rule.limit,
                rule.window,
                now
            );

            const resetTime = Math.ceil(now / (rule.window * 1000)) * rule.window;

            return {
                allowed: allowed === 1,
                limit: rule.limit,
                remaining: Math.max(0, remaining),
                reset: resetTime,
                retryAfter: allowed ? null : resetTime - Math.floor(now / 1000),
            };
        } catch (error) {
            // FAIL OPEN: if Redis is down, allow the request
            console.error('Rate limiter error, failing open:', error.message);
            return {
                allowed: true,
                limit: rule.limit,
                remaining: -1,  // unknown
                reset: 0,
            };
        }
    }
}
```

**Multi-Level Rate Limiting:**

```javascript
// Express middleware applying multiple rate limit checks
function rateLimiterMiddleware(limiter, rules) {
    return async (req, res, next) => {
        const checks = [];

        // Level 1: Per-IP (DDoS protection)
        const ipRule = rules[`ip:default`];
        if (ipRule) {
            checks.push(limiter.checkRateLimit(req.ip, { ...ipRule, key_type: 'ip' }));
        }

        // Level 2: Per-user (authenticated requests)
        if (req.user) {
            const userRule = rules[`user:default`];
            const tierRule = rules[`tier:${req.user.tier}`];
            const effectiveLimit = tierRule
                ? userRule.limit * tierRule.multiplier
                : userRule.limit;

            checks.push(limiter.checkRateLimit(req.user.id, {
                ...userRule,
                limit: effectiveLimit,
                key_type: 'user',
            }));
        }

        // Level 3: Per-endpoint
        const endpointKey = `endpoint:${req.method}:${req.route?.path}`;
        const endpointRule = rules[endpointKey];
        if (endpointRule) {
            const identifier = endpointRule.key_type === 'ip'
                ? req.ip
                : (req.user?.id || req.ip);
            checks.push(limiter.checkRateLimit(
                `${identifier}:${endpointKey}`,
                { ...endpointRule, key_type: endpointRule.key_type || 'user' }
            ));
        }

        // Run all checks in parallel
        const results = await Promise.all(checks);

        // Find the most restrictive result
        const mostRestrictive = results.reduce((worst, r) => {
            if (!r.allowed) return r;
            if (!worst.allowed) return worst;
            return r.remaining < worst.remaining ? r : worst;
        }, results[0]);

        // Set rate limit headers (most restrictive)
        res.set('X-RateLimit-Limit', String(mostRestrictive.limit));
        res.set('X-RateLimit-Remaining', String(mostRestrictive.remaining));
        res.set('X-RateLimit-Reset', String(mostRestrictive.reset));

        if (!mostRestrictive.allowed) {
            res.set('Retry-After', String(mostRestrictive.retryAfter));
            return res.status(429).json({
                error: 'rate_limit_exceeded',
                message: `Rate limit exceeded. Try again in ${mostRestrictive.retryAfter} seconds.`,
                retry_after: mostRestrictive.retryAfter,
            });
        }

        next();
    };
}
```

---

### Deep Dive 3: Graceful Degradation and Edge Cases

```
Failure Mode Decision Tree:

  Redis available?
       │
    ┌──┴──┐
   YES    NO
    │      │
    │      └──► FAIL OPEN: allow all requests
    │           (log + alert, service > rate limiting)
    │
    ▼
  Response within SLA? (< 1ms)
       │
    ┌──┴──┐
   YES    NO (Redis slow)
    │      │
    │      └──► LOCAL FALLBACK:
    │           Use in-memory approximate counter
    │           (per-gateway, not globally accurate)
    │
    ▼
  Normal rate limiting
```

```javascript
class ResilientRateLimiter {
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            recoveryTimeout: 10000,  // 10 seconds
        });
        // Local in-memory fallback (approximate)
        this.localCounters = new Map();
    }

    async checkRateLimit(identifier, rule) {
        // Circuit breaker wraps Redis calls
        if (this.circuitBreaker.isOpen()) {
            return this.localFallback(identifier, rule);
        }

        try {
            const result = await Promise.race([
                this.redisCheck(identifier, rule),
                this.timeout(2),  // 2ms timeout
            ]);
            this.circuitBreaker.recordSuccess();
            return result;
        } catch (error) {
            this.circuitBreaker.recordFailure();
            return this.localFallback(identifier, rule);
        }
    }

    localFallback(identifier, rule) {
        // In-memory sliding window (per-gateway, not distributed)
        const key = `${identifier}:${rule.endpoint || 'global'}`;
        const now = Date.now();
        const windowMs = rule.window * 1000;

        if (!this.localCounters.has(key)) {
            this.localCounters.set(key, []);
        }

        const timestamps = this.localCounters.get(key);

        // Remove old entries
        while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
            timestamps.shift();
        }

        // Scale limit by number of gateways (approximate)
        const localLimit = Math.ceil(rule.limit / this.config.gatewayCount);

        if (timestamps.length < localLimit) {
            timestamps.push(now);
            return { allowed: true, remaining: localLimit - timestamps.length, limit: rule.limit, reset: 0 };
        }

        return { allowed: false, remaining: 0, limit: rule.limit, retryAfter: rule.window };
    }

    timeout(ms) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Rate limiter timeout')), ms)
        );
    }
}

// Circuit Breaker implementation
class CircuitBreaker {
    constructor({ failureThreshold, recoveryTimeout }) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.failures = 0;
        this.lastFailure = 0;
        this.state = 'CLOSED';  // CLOSED = normal, OPEN = failing
    }

    isOpen() {
        if (this.state === 'OPEN') {
            // Check if recovery timeout has passed
            if (Date.now() - this.lastFailure > this.recoveryTimeout) {
                this.state = 'HALF_OPEN';
                return false;  // Allow one request through
            }
            return true;
        }
        return false;
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
}
```

**Edge Cases to Handle:**

| Edge Case | Problem | Solution |
|-----------|---------|----------|
| Clock skew across gateways | Inconsistent window boundaries | Use Redis server time (`redis.call('time')`) in Lua scripts |
| Redis cluster failover | Brief period of no rate limiting | Circuit breaker + local fallback counters |
| Hot keys (single user flood) | One Redis shard overloaded | Hash-based key distribution; local pre-filtering |
| Rule changes mid-window | Inconsistent limits | Version rule configs; apply new rules on next window |
| Distributed burst | All gateways allow simultaneously | Lua atomicity handles this; minor over-admission acceptable |
| Memory leak in local counters | Gateway OOM | LRU eviction; periodic cleanup of old entries |

---

## Trade-Offs Summary

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Algorithm | Token bucket | Sliding window counter | **Sliding window counter** (default) | Best balance of accuracy and memory |
| Storage | Local memory | Redis | **Redis** (primary) + local (fallback) | Distributed consistency with resilience |
| Failure mode | Fail closed | Fail open | **Fail open** | Service availability > rate limiting |
| Atomicity | GET then SET | Lua script | **Lua script** | Eliminates race conditions entirely |
| Multi-level | Sequential checks | Parallel checks | **Parallel** | Minimize latency overhead |
| Configuration | Hardcoded | Config service | **Config service** (hot-reload) | Change limits without deploy |

---

## Scaling Strategy

### Phase 1: Single Service (0-10K RPS)
- Rate limiter as middleware in each API gateway
- Single Redis instance (with replica for failover)
- Static config file for rules

### Phase 2: Growth (10K-100K RPS)
- Redis Cluster (3 masters, 3 replicas)
- Config service (etcd) for dynamic rule updates
- Monitoring dashboard for rate limit metrics
- Per-endpoint granular rules

### Phase 3: Global (100K+ RPS)
- Regional Redis clusters (rate limit per region)
- Global coordination via async sync (eventual consistency across regions)
- Local rate limiting as first layer (in-memory), Redis as second layer
- ML-based adaptive rate limiting (adjust limits based on traffic patterns)

---

## Failure Scenarios & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Redis cluster down | No distributed rate limiting | Fail open + local in-memory counters + alert |
| Single Redis shard down | Some keys unavailable | Redis Cluster automatic failover; client retries |
| Config service down | Cannot update rules | Cache last known config locally; use stale rules |
| Gateway clock drift | Inaccurate window boundaries | Use Redis TIME command in Lua scripts |
| DDoS overwhelms rate limiter | Redis overloaded by check volume | Local pre-filtering; IP blocklist at L3/L4 before rate limiter |
| Memory pressure on Redis | Eviction of rate limit keys | Appropriate maxmemory policy; keys have TTL |

---

## Key Interview Talking Points

1. **Why Lua scripts over GET+SET?** -- Redis executes Lua scripts atomically (single-threaded). This eliminates the TOCTOU race condition where two gateways read the same count, both see it under the limit, and both increment -- exceeding the limit.
2. **Why fail open?** -- In a production system, it is better to occasionally allow a few extra requests than to completely block all traffic because the rate limiter is down. Rate limiting is a guardrail, not a security boundary.
3. **Why not a separate rate limiter service?** -- Adding a network hop for every request doubles the latency overhead. The rate limiter should be an in-process middleware that talks to Redis directly. A separate service is justified only if you need complex rule evaluation.
4. **How to handle burst traffic legitimately?** -- Token bucket allows configurable burst size. A user might legitimately send 10 requests instantly (page load). Set burst = 10 but sustained rate = 2/sec.
5. **How to rate limit WebSocket connections?** -- Rate limit at connection time (per-IP) and per-message (per-user). Use a sliding window counter for message rate within established connections.
