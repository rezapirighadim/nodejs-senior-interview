# System Design: URL Shortener (like Bit.ly)

> **Interview Time Budget:** 40 minutes total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## Step 1: Clarify Requirements (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | Given a long URL, generate a short unique URL | Core feature |
| F2 | Redirect short URL to original long URL | Must be fast (<100ms) |
| F3 | Custom short codes (optional) | Users pick their own alias |
| F4 | Link expiration (TTL) | Default 5 years, configurable |
| F5 | Analytics dashboard | Click count, geographic data, referrers |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | High availability | 99.99% uptime |
| NF2 | Low latency redirects | p99 < 50ms |
| NF3 | Short codes are not predictable | Security consideration |
| NF4 | Shortened URLs are not guessable | Prevent enumeration attacks |
| NF5 | System is read-heavy | 10:1 read-to-write ratio |

### Clarifying Questions to Ask

1. "Do we need to support custom aliases or only auto-generated codes?"
2. "Should expired links return 404 or redirect to a landing page?"
3. "Do we need real-time analytics or is near-real-time (minutes delay) acceptable?"
4. "Is there a maximum URL length we need to support?"
5. "Do we need to detect and prevent malicious/phishing URLs?"

---

## Step 2: Estimate (5 min)

### Traffic Estimates

```
Write (URL creation):
  100M URLs/month
  = 100M / (30 * 24 * 3600) ~= 40 URLs/sec (average)
  Peak: 40 * 3 = 120 URLs/sec

Read (Redirects):
  10:1 read/write ratio
  = 1B redirects/month
  = 1B / (30 * 24 * 3600) ~= 400 redirects/sec (average)
  Peak: 400 * 3 = 1,200 redirects/sec
```

### Storage Estimates

```
Per URL record:
  - short_code:    7 bytes
  - long_url:      2,048 bytes (max, avg ~200 bytes)
  - created_at:    8 bytes
  - expires_at:    8 bytes
  - user_id:       8 bytes
  - metadata:      ~100 bytes
  Total per record: ~350 bytes average

Monthly: 100M * 350 bytes = 35 GB/month
5-year retention: 35 GB * 60 months = 2.1 TB

Analytics per click:
  ~200 bytes (timestamp, geo, referrer, user-agent)
  1B clicks/month * 200 bytes = 200 GB/month
  5 years: 12 TB (consider aggregation/archival)
```

### Bandwidth Estimates

```
Incoming (writes): 40 req/s * 2 KB avg = 80 KB/s (negligible)
Outgoing (reads):  400 req/s * 500 bytes (redirect response) = 200 KB/s
Total: < 1 MB/s -- very manageable
```

### Cache Estimates

```
80/20 rule: 20% of URLs generate 80% of traffic
Cache 20% of daily URLs:
  Daily new URLs: ~3.3M
  Cache hot 20%: 660K URLs * 350 bytes ~= 230 MB
  Very comfortably fits in a single Redis instance
```

---

## Step 3: High-Level Design (15 min)

### Architecture Diagram

```
                                    ┌──────────────────┐
                                    │   CDN / DNS LB   │
                                    └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │   API Gateway     │
                                    │  (Rate Limiting,  │
                                    │   Auth, TLS)      │
                                    └────────┬─────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                 ┌────────▼───────┐ ┌───────▼────────┐ ┌──────▼───────┐
                 │  App Server 1  │ │  App Server 2  │ │ App Server N │
                 │  (Node.js)     │ │  (Node.js)     │ │ (Node.js)    │
                 └────────┬───────┘ └───────┬────────┘ └──────┬───────┘
                          │                 │                  │
                          └─────────────────┼──────────────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
                ┌────────▼───────┐ ┌───────▼────────┐ ┌──────▼───────────┐
                │  Redis Cache   │ │  PostgreSQL    │ │  Analytics       │
                │  (Cluster)     │ │  (Primary +    │ │  Pipeline        │
                │                │ │   Replicas)    │ │                  │
                │  - URL cache   │ │  - URL table   │ │  Kafka → Click-  │
                │  - Counter     │ │  - User table  │ │  stream Worker → │
                │    ranges      │ │  - Analytics   │ │  ClickHouse      │
                └────────────────┘ └────────────────┘ └──────────────────┘
```

### API Design

```
POST /api/v1/shorten
  Headers: Authorization: Bearer <token>
  Body: {
    "url": "https://example.com/very/long/path?query=value",
    "custom_code": "my-link",      // optional
    "expires_at": "2027-01-01",    // optional
  }
  Response 201: {
    "short_url": "https://short.ly/Ab3xK9",
    "code": "Ab3xK9",
    "long_url": "https://example.com/very/long/path?query=value",
    "expires_at": "2027-01-01T00:00:00Z",
    "created_at": "2026-02-24T10:00:00Z"
  }

GET /{code}
  Response 301/302: Redirect to long_url
  Response 404: { "error": "Short URL not found or expired" }

GET /api/v1/stats/{code}
  Headers: Authorization: Bearer <token>
  Response 200: {
    "code": "Ab3xK9",
    "long_url": "https://example.com/...",
    "total_clicks": 15234,
    "created_at": "2026-02-24T10:00:00Z",
    "clicks_by_day": [ { "date": "2026-02-24", "count": 120 }, ... ],
    "top_referrers": [ { "referrer": "twitter.com", "count": 500 }, ... ],
    "top_countries": [ { "country": "US", "count": 8000 }, ... ]
  }
```

### Database Schema

```sql
-- PostgreSQL

CREATE TABLE urls (
    id            BIGSERIAL PRIMARY KEY,
    short_code    VARCHAR(10) NOT NULL,
    long_url      TEXT NOT NULL,
    user_id       BIGINT REFERENCES users(id),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at    TIMESTAMP WITH TIME ZONE,
    is_active     BOOLEAN DEFAULT TRUE,

    CONSTRAINT uq_short_code UNIQUE (short_code)
);

-- Index for fast lookups (the hot path)
CREATE INDEX idx_urls_short_code ON urls (short_code) WHERE is_active = TRUE;

-- Index for user's URLs listing
CREATE INDEX idx_urls_user_id ON urls (user_id, created_at DESC);

CREATE TABLE click_events (
    id            BIGSERIAL,
    short_code    VARCHAR(10) NOT NULL,
    clicked_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address    INET,
    user_agent    TEXT,
    referrer      TEXT,
    country_code  CHAR(2),
    city          VARCHAR(100),

    PRIMARY KEY (clicked_at, id)  -- for time-based partitioning
) PARTITION BY RANGE (clicked_at);

-- Create monthly partitions
CREATE TABLE click_events_2026_02 PARTITION OF click_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### 301 vs 302 Redirect Decision

| Aspect | 301 (Permanent) | 302 (Temporary) |
|--------|-----------------|-----------------|
| Browser caching | Browser caches, skips our server | Browser always hits our server |
| Analytics accuracy | Lose repeat visit tracking | Accurate click counting |
| SEO | Passes link juice to target | Retains link juice on short URL |
| Server load | Lower (browsers cache) | Higher (every click hits server) |
| **Recommendation** | Only if analytics not needed | **Use 302 for accurate analytics** |

**Decision: Use 302** because analytics tracking is a core requirement.

---

## Step 4: Deep Dive (15 min)

### Deep Dive 1: Short Code Generation

Three approaches compared:

#### Approach A: Counter + Base62 Encoding

```javascript
// Base62 character set: [0-9a-zA-Z]
const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function encodeBase62(num) {
    if (num === 0) return CHARSET[0];
    let result = '';
    while (num > 0) {
        result = CHARSET[num % 62] + result;
        num = Math.floor(num / 62);
    }
    return result;
}

// 7-char Base62 = 62^7 = 3.5 trillion combinations
// At 100M/month, lasts 35,000 months (~2,900 years)

// Distributed counter using Redis ranges
class CounterService {
    constructor(redisClient) {
        this.redis = redisClient;
        this.localCounter = 0;
        this.localMax = 0;
    }

    async getNextId() {
        if (this.localCounter >= this.localMax) {
            // Atomically reserve a range of 1000 IDs
            const rangeStart = await this.redis.incrby('url:counter', 1000);
            this.localCounter = rangeStart - 1000;
            this.localMax = rangeStart;
        }
        return ++this.localCounter;
    }

    async generateCode() {
        const id = await this.getNextId();
        return encodeBase62(id).padStart(7, '0');
    }
}
```

**Pros:** No collisions, predictable length, fast.
**Cons:** Sequential/predictable -- mitigate by shuffling bits before encoding.

#### Approach B: Random Hash (MD5/SHA-256 truncation)

```javascript
const crypto = require('crypto');

function generateCode(longUrl) {
    const hash = crypto.createHash('sha256')
        .update(longUrl + Date.now() + Math.random())
        .digest('base64url')
        .substring(0, 7);
    return hash;
}

// Must check for collisions in DB
// Collision probability with 7 chars (base64url = 64 chars):
// 64^7 = 4.4 trillion space
// At 6B URLs (5 year): birthday problem ~= 0.0004% collision rate
```

**Pros:** Not predictable, no coordination needed.
**Cons:** Collision checking required, extra DB roundtrip.

#### Approach C: Pre-Generated Pool

```javascript
// Background worker pre-generates codes into a pool table
class CodePool {
    async getCode() {
        // Atomic: mark code as used and return it
        const result = await db.query(`
            UPDATE code_pool
            SET is_used = TRUE, used_at = NOW()
            WHERE id = (
                SELECT id FROM code_pool
                WHERE is_used = FALSE
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING code
        `);
        return result.rows[0].code;
    }
}

// Background job keeps pool at 1M unused codes
// Refills when pool drops below threshold
```

**Pros:** O(1) generation, no collision at creation time, decoupled generation.
**Cons:** Extra infrastructure, pool exhaustion risk.

#### Recommendation

**Use Counter + Base62 with bit-shuffling** for production:
- Simplest to implement and scale
- Zero collision risk
- Add bit-shuffling to prevent enumeration:

```javascript
// Scatter bits to make sequential IDs non-obvious
function shuffleBits(n) {
    // Simple reversible bit permutation
    let result = 0n;
    const bitOrder = [0, 5, 1, 4, 2, 3, 6, 11, 7, 10, 8, 9,
                      12, 17, 13, 16, 14, 15, 18, 23, 19, 22, 20, 21,
                      24, 29, 25, 28, 26, 27, 30, 35, 31, 34, 32, 33,
                      36, 41, 37, 40, 38, 39, 42];
    const bn = BigInt(n);
    for (let i = 0; i < bitOrder.length; i++) {
        if (bn & (1n << BigInt(i))) {
            result |= (1n << BigInt(bitOrder[i]));
        }
    }
    return Number(result);
}
```

---

### Deep Dive 2: Caching Strategy (Cache-Aside Pattern)

```
Read Path (GET /{code}):

  Client ──► App Server ──► Redis Cache
                               │
                          HIT? ─┤
                          │     │
                         YES    NO
                          │     │
                          │     ▼
                          │   PostgreSQL
                          │     │
                          │     ▼
                          │   Write to Redis
                          │   (TTL: 24 hours)
                          │     │
                          ◄─────┘
                          │
                          ▼
                      302 Redirect
```

```javascript
class UrlService {
    constructor(redis, db) {
        this.redis = redis;
        this.db = db;
        this.CACHE_TTL = 86400; // 24 hours
    }

    async resolve(shortCode) {
        // Step 1: Check cache
        const cached = await this.redis.get(`url:${shortCode}`);
        if (cached) {
            // Cache HIT - async fire-and-forget analytics
            this.trackClick(shortCode).catch(() => {});
            return JSON.parse(cached);
        }

        // Step 2: Cache MISS - query database
        const result = await this.db.query(
            `SELECT long_url, expires_at FROM urls
             WHERE short_code = $1 AND is_active = TRUE`,
            [shortCode]
        );

        if (!result.rows[0]) return null;

        const urlData = result.rows[0];

        // Step 3: Check expiration
        if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
            return null;
        }

        // Step 4: Populate cache
        await this.redis.setex(
            `url:${shortCode}`,
            this.CACHE_TTL,
            JSON.stringify(urlData)
        );

        this.trackClick(shortCode).catch(() => {});
        return urlData;
    }

    async shorten(longUrl, userId, options = {}) {
        const shortCode = await this.codeGenerator.generateCode();

        const result = await this.db.query(
            `INSERT INTO urls (short_code, long_url, user_id, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [shortCode, longUrl, userId, options.expiresAt]
        );

        // Pre-warm the cache for the new URL
        await this.redis.setex(
            `url:${shortCode}`,
            this.CACHE_TTL,
            JSON.stringify(result.rows[0])
        );

        return result.rows[0];
    }

    async trackClick(shortCode) {
        // Publish to Kafka for async processing
        await this.kafka.produce('click-events', {
            short_code: shortCode,
            timestamp: Date.now(),
            // ip, user-agent, referrer extracted from request
        });
    }
}
```

**Cache Invalidation Triggers:**
1. URL is deleted by owner -- explicitly delete cache key
2. URL expires -- TTL in Redis handles this naturally
3. URL is updated -- delete cache key, next read repopulates

**Why Cache-Aside (vs. Write-Through/Write-Behind):**
- Reads vastly outnumber writes (10:1)
- Simple to reason about
- Cache failures don't block writes
- Only hot URLs end up in cache (lazy loading)

---

### Deep Dive 3: Analytics Pipeline

```
Click Event Flow:

  App Server                Kafka              Stream Workers
  ┌────────┐           ┌───────────┐          ┌────────────┐
  │ GET /x │──event──► │  clicks   │────────► │  Enrichment │
  └────────┘           │  topic    │          │  Worker     │
                       │ (partitioned│         │             │
                       │  by code) │          │  - GeoIP    │
                       └───────────┘          │  - UA parse │
                                              └──────┬─────┘
                                                     │
                                    ┌────────────────┼───────────────┐
                                    │                │               │
                           ┌────────▼──────┐  ┌─────▼─────┐  ┌─────▼──────┐
                           │  ClickHouse   │  │  Redis     │  │  PostgreSQL│
                           │  (raw events, │  │  (real-time│  │  (daily    │
                           │   analytics   │  │   counters)│  │   rollups) │
                           │   queries)    │  │            │  │            │
                           └───────────────┘  └───────────┘  └────────────┘
```

```javascript
// Click enrichment worker (Kafka consumer)
class ClickEnrichmentWorker {
    async processEvent(event) {
        const { short_code, ip, user_agent, referrer, timestamp } = event;

        // GeoIP lookup
        const geo = geoip.lookup(ip);

        // User-agent parsing
        const ua = useragent.parse(user_agent);

        const enrichedEvent = {
            short_code,
            timestamp,
            country: geo?.country || 'unknown',
            city: geo?.city || 'unknown',
            device: ua.device.family,
            browser: ua.family,
            os: ua.os.family,
            referrer: new URL(referrer || '').hostname || 'direct',
        };

        // Write to ClickHouse for analytics queries
        await this.clickhouse.insert('click_events', enrichedEvent);

        // Increment real-time counter in Redis
        await this.redis.hincrby(`stats:${short_code}`, 'total', 1);
        await this.redis.hincrby(`stats:${short_code}:countries`, geo?.country || 'unknown', 1);
    }
}
```

---

## Trade-Offs Summary

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Redirect type | 301 (Permanent) | 302 (Temporary) | **302** | Accurate analytics tracking |
| Code generation | Counter+Base62 | Random hash | **Counter+Base62** | Zero collisions, simpler scaling |
| Cache pattern | Write-through | Cache-aside | **Cache-aside** | Read-heavy, simpler, only caches hot data |
| Analytics | Sync (in-request) | Async (Kafka) | **Async** | Never slow down the redirect path |
| Primary DB | NoSQL (DynamoDB) | PostgreSQL | **PostgreSQL** | ACID for URL mapping, simpler ops |
| Short code length | 6 chars | 7 chars | **7 chars** | 3.5T combinations, future-proof |

---

## Scaling Strategy

### Phase 1: Single Region (0-10M URLs)
- 2 App servers behind a load balancer
- PostgreSQL primary + 1 read replica
- Single Redis instance (cache + counter)
- Kafka single broker for analytics

### Phase 2: Growth (10M-1B URLs)
- Horizontal scale app servers (auto-scaling group)
- PostgreSQL: partition `click_events` by month
- Redis Cluster (3 masters + 3 replicas)
- Counter range allocation per app server (reduces Redis calls)
- CDN for static assets and common redirects

### Phase 3: Global Scale (1B+ URLs)
- Multi-region deployment with GeoDNS
- PostgreSQL with read replicas per region
- Redis cluster per region
- Global counter coordination via range allocation per region
- Async cross-region replication for URL data

---

## Failure Scenarios & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Redis cache down | Increased DB load, higher latency | Read replicas absorb load; circuit breaker with fallback to DB |
| PostgreSQL primary down | Cannot create new URLs | Promote read replica; counter ranges still in app memory |
| Counter service failure | Cannot generate codes | Pre-fetch counter ranges; local buffer of ~1000 IDs per server |
| Kafka down | Analytics events lost | Buffer events in local disk queue; replay when Kafka recovers |
| App server crash | Active connections dropped | Load balancer health checks; auto-restart; retry on client |
| Hash collision (if random) | Duplicate short codes | Retry with different salt; unique constraint catches at DB level |

---

## Key Interview Talking Points

1. **Why not UUID?** -- Too long for a "short" URL. Base62 with 7 chars gives 3.5T combinations.
2. **Why not a hash of the URL?** -- Same URL could need different short codes (different users, different expirations).
3. **How to prevent abuse?** -- Rate limiting per user/IP, malware URL scanning, CAPTCHA for anonymous users.
4. **Why PostgreSQL over NoSQL?** -- At 40 writes/sec, PostgreSQL handles this easily. ACID guarantees simplify the code. Switch to DynamoDB only if you hit multi-region write scaling issues.
5. **Hot key problem?** -- A viral short URL could overload a single Redis shard. Solution: replicate hot keys across multiple shards or use local in-memory caching with short TTL (5 seconds).
