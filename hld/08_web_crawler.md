# HLD 08 -- Web Crawler

> **Interview time budget:** 40 min total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## 1. Clarify (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | **Crawl web pages** | Fetch HTML content from URLs across the internet |
| F2 | **URL discovery** | Extract links from pages, add to crawl queue |
| F3 | **URL deduplication** | Never crawl the same URL twice per cycle |
| F4 | **Content deduplication** | Detect near-duplicate pages (mirrors, syndicated content) |
| F5 | **Politeness** | Respect robots.txt, honor crawl-delay, limit per-domain rate |
| F6 | **Priority crawling** | Important/popular pages crawled more frequently |
| F7 | **Recrawl scheduling** | Detect page change frequency, recrawl accordingly |
| F8 | **Store raw HTML** | Persist fetched content for downstream indexing |
| F9 | **Handle dynamic content** | JavaScript-rendered SPAs (headless browser fallback) |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Crawl volume | **1 billion pages / month** |
| NF2 | Throughput | **~400 pages / second** sustained |
| NF3 | Freshness | Top 10 M pages recrawled within **24 hours** |
| NF4 | Politeness | Max 1 request per second per domain (configurable) |
| NF5 | Fault tolerance | Survive individual worker failures without data loss |
| NF6 | Scalability | Scale linearly by adding workers |

### Constraints & Assumptions

- The web has ~2 billion indexable pages; we target 1 B/month (50 % coverage)
- Average page size: 100 KB (HTML only), 500 KB with assets
- We store HTML only (no images, CSS, JS assets)
- Seed URLs provided (top 10 K domains from Alexa/Tranco list)

---

## 2. Estimate (5 min)

### Throughput

| Metric | Calculation | Result |
|--------|-------------|--------|
| Pages per month | 1 B | -- |
| Pages per day | 1 B / 30 | **33.3 M / day** |
| Pages per second | 33.3 M / 86400 | **~386 /s** (round to **400 /s**) |
| With 3x headroom for bursts | 400 x 3 | **1200 /s peak** |

### Storage

| Data | Calculation | Result |
|------|-------------|--------|
| Raw HTML per page | 100 KB average | -- |
| Monthly raw HTML | 1 B x 100 KB | **100 TB / month** |
| Annual raw HTML | 100 TB x 12 | **1.2 PB / year** |
| Compressed (gzip ~5x) | 100 TB / 5 | **~20 TB / month** |
| Metadata per URL | ~500 bytes (URL, headers, timestamps, hash) | -- |
| Monthly metadata | 1 B x 500 B | **500 GB / month** |
| Bloom filter for URL dedup | 10 B URLs, 1 % FPR | **~1.2 GB** |

### Bandwidth

| Direction | Calculation | Result |
|-----------|-------------|--------|
| Download bandwidth | 400 pages/s x 100 KB | **40 MB/s** = **320 Mbps** |
| Peak download | 1200 pages/s x 100 KB | **120 MB/s** = **960 Mbps** |
| DNS queries | 400 /s (with caching, ~10 % miss) | **~40 DNS queries/s** |

### Worker Estimate

| Metric | Calculation | Result |
|--------|-------------|--------|
| Avg fetch time per page | ~2 s (DNS + connect + download + parse) | -- |
| Pages per worker per second | 50 concurrent connections / 2 s | **25 pages/s** |
| Workers needed | 400 / 25 | **~16 workers** (provision 24 for headroom) |

---

## 3. High-Level Design (15 min)

### Architecture Diagram

```
 +-------------------+
 |   Seed URLs       |
 |  (Top 10K sites)  |
 +--------+----------+
          |
          v
 +-------------------+     +-------------------+
 |   URL Frontier    |<----|  URL Extractor    |
 |                   |     |  (new discovered  |
 | - Priority Queue  |     |   URLs fed back)  |
 | - Per-domain FIFO |     +--------+----------+
 | - Politeness ctrl |              ^
 +--------+----------+              |
          |                         |
          | Dequeue next URL        |
          v                         |
 +-------------------+     +--------+----------+
 |  Fetcher Workers  |     |  Content Parser   |
 |  (24 workers)     |---->|  - HTML parsing   |
 |                   |     |  - Link extraction |
 | - HTTP client     |     |  - Content hash   |
 | - Retry logic     |     +--------+----------+
 | - Redirect follow |              |
 +--------+----------+              |
          |                         v
          |               +-------------------+     +-------------------+
          |               |   Dedup Service   |     |  Bloom Filter     |
          |               | - URL dedup       |---->|  (URL seen set)   |
          |               | - Content dedup   |     +-------------------+
          |               | (SimHash)         |     +-------------------+
          |               +--------+----------+     |  SimHash Index    |
          |                        |                +-------------------+
          |                        |
          v                        v
 +-------------------+     +-------------------+
 |   DNS Cache       |     |   Storage Layer   |
 |  (Local + Redis)  |     |                   |
 +-------------------+     | - HTML: S3/HDFS   |
                           | - Metadata: DB    |
 +-------------------+     | - URL queue: Redis|
 |  robots.txt       |     +-------------------+
 |  Cache (Redis)    |
 |  TTL: 24 hours    |
 +-------------------+

 +-----------------------------------------------+
 |              Monitoring & Control              |
 | - Crawl rate dashboard                         |
 | - Per-domain stats                             |
 | - Error rates, queue depth                     |
 | - Manual URL injection / blacklisting          |
 +-----------------------------------------------+
```

### API Design (Internal Control Plane)

```
# Add seed URLs
POST /api/v1/crawler/seeds
Body: { urls: ["https://example.com", ...], priority: "high" }
Response: { added: 150, duplicates: 3 }

# Get crawl status
GET /api/v1/crawler/status
Response: {
  "queueDepth": 45_000_000,
  "crawlRate": 412,        // pages/sec current
  "domainsActive": 12_500,
  "errorsLastHour": 234,
  "pagesThisMonth": 890_000_000
}

# Blacklist domain
POST /api/v1/crawler/blacklist
Body: { domain: "spam-site.com", reason: "spam" }

# Force recrawl
POST /api/v1/crawler/recrawl
Body: { urls: ["https://important-page.com/news"], priority: "immediate" }
```

### Database Schema

```sql
-- Crawl metadata (PostgreSQL -- for structured queries)
CREATE TABLE crawl_pages (
    id              BIGSERIAL PRIMARY KEY,
    url_hash        CHAR(64) NOT NULL,         -- SHA-256 of normalized URL
    url             TEXT NOT NULL,
    domain          VARCHAR(255) NOT NULL,
    status_code     SMALLINT,
    content_type    VARCHAR(100),
    content_hash    CHAR(16),                  -- SimHash (64-bit, hex)
    content_length  INT,
    s3_key          VARCHAR(512),              -- pointer to raw HTML in S3
    crawled_at      TIMESTAMPTZ,
    next_crawl_at   TIMESTAMPTZ,
    crawl_count     INT DEFAULT 0,
    change_frequency INTERVAL,                 -- estimated
    priority        SMALLINT DEFAULT 5,        -- 1=highest, 10=lowest
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(url_hash)
);
CREATE INDEX idx_pages_domain     ON crawl_pages(domain);
CREATE INDEX idx_pages_next_crawl ON crawl_pages(next_crawl_at);
CREATE INDEX idx_pages_simhash    ON crawl_pages(content_hash);

-- Domain metadata
CREATE TABLE domains (
    id              SERIAL PRIMARY KEY,
    domain          VARCHAR(255) UNIQUE NOT NULL,
    robots_txt      TEXT,
    robots_fetched  TIMESTAMPTZ,
    crawl_delay_ms  INT DEFAULT 1000,          -- from robots.txt or default
    last_crawled_at TIMESTAMPTZ,
    total_pages     INT DEFAULT 0,
    avg_response_ms INT,
    is_blacklisted  BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Crawl errors (for monitoring)
CREATE TABLE crawl_errors (
    id              BIGSERIAL PRIMARY KEY,
    url_hash        CHAR(64) NOT NULL,
    error_type      VARCHAR(50),  -- 'timeout', 'dns_fail', 'http_5xx', 'robots_blocked'
    error_detail    TEXT,
    occurred_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_errors_time ON crawl_errors(occurred_at);
```

---

## 4. Deep Dive (15 min)

### Deep Dive A: URL Frontier Design

The URL Frontier is the brain of the crawler. It must balance priority, politeness, and freshness while handling tens of millions of pending URLs.

**Two-queue architecture:**

```
                 +-------------------+
                 | Incoming URLs     |
                 | (from extractor)  |
                 +--------+----------+
                          |
                          v
                 +-------------------+
                 |  Prioritizer      |
                 |  - PageRank score |
                 |  - Domain authority|
                 |  - Freshness need |
                 +--------+----------+
                          |
            +-------------+-------------+
            |             |             |
            v             v             v
    +-------+--+  +-------+--+  +------+---+
    | Priority  |  | Priority  |  | Priority |
    | Queue 0   |  | Queue 1   |  | Queue 2  |
    | (Critical)|  | (High)    |  | (Normal) |
    +-------+---+  +------+----+  +-----+----+
            |             |              |
            +-------------+--------------+
                          |
                          v
                 +-------------------+
                 | Politeness Router |
                 | (per-domain FIFO) |
                 +-------------------+
                 | domain-a.com: [url1, url2, ...]  |
                 | domain-b.com: [url3, ...]         |
                 | domain-c.com: [url4, url5, ...]   |
                 +--------+---------+
                          |
                          | Rate-limited dequeue
                          | (1 req/s per domain)
                          v
                 +-------------------+
                 |  Fetcher Worker   |
                 +-------------------+
```

**Priority assignment:**

```typescript
function calculatePriority(url: string, metadata: URLMetadata): number {
  let score = 0;

  // Domain authority (from PageRank or similar)
  score += domainAuthority[extractDomain(url)] * 40;  // 0-40 points

  // Path depth (shorter = more important)
  const depth = url.split('/').length - 3;
  score += Math.max(0, 20 - depth * 2);               // 0-20 points

  // Freshness need (high change frequency = crawl sooner)
  if (metadata.changeFrequency) {
    const hoursSinceLastCrawl = (now() - metadata.lastCrawled) / 3600000;
    const expectedChangeHours = metadata.changeFrequency / 3600000;
    score += Math.min(20, (hoursSinceLastCrawl / expectedChangeHours) * 20);
  }

  // Explicit boost for news sites, sitemaps
  if (isNewsSite(url)) score += 20;
  if (isSitemap(url)) score += 15;

  return Math.min(100, score);
}
```

**Politeness enforcement:**

Each domain has a FIFO queue and a rate limiter. The rate limiter enforces:
1. **robots.txt crawl-delay** directive (if specified)
2. **Minimum 1-second gap** between requests to the same domain (default)
3. **Adaptive delay:** If the server responds slowly (> 2 s), double the delay. If it returns 429/503, back off exponentially.

```typescript
class DomainRateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private delays: Map<string, number> = new Map();  // ms

  async waitForDomain(domain: string): Promise<void> {
    const delay = this.delays.get(domain) || 1000;
    const lastReq = this.lastRequestTime.get(domain) || 0;
    const elapsed = Date.now() - lastReq;
    if (elapsed < delay) {
      await sleep(delay - elapsed);
    }
    this.lastRequestTime.set(domain, Date.now());
  }

  adaptDelay(domain: string, responseTimeMs: number, statusCode: number): void {
    let currentDelay = this.delays.get(domain) || 1000;
    if (statusCode === 429 || statusCode === 503) {
      currentDelay = Math.min(currentDelay * 2, 60000);  // max 60s
    } else if (responseTimeMs > 2000) {
      currentDelay = Math.min(currentDelay * 1.5, 30000);
    } else if (responseTimeMs < 500 && currentDelay > 1000) {
      currentDelay = Math.max(currentDelay * 0.8, 1000);  // slowly recover
    }
    this.delays.set(domain, currentDelay);
  }
}
```

### Deep Dive B: URL and Content Deduplication

**URL Deduplication -- Bloom Filter:**

We need to track which URLs we have already seen. With 10 B URLs in the frontier (including historical), a hash set would require ~200 GB of memory. A Bloom filter gives us approximate membership testing in ~1.2 GB with 1 % false positive rate.

```
Parameters:
  n = 10,000,000,000 (expected elements)
  p = 0.01 (1% false positive rate)
  m = -n * ln(p) / (ln(2))^2 = ~9.6 billion bits = ~1.2 GB
  k = (m/n) * ln(2) = ~7 hash functions
```

**URL normalization before hashing:**

```typescript
function normalizeURL(raw: string): string {
  const url = new URL(raw);

  // Lowercase scheme and host
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  // Remove default ports
  if ((url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }

  // Remove fragment
  url.hash = '';

  // Sort query parameters
  const params = new URLSearchParams(url.search);
  const sorted = new URLSearchParams([...params.entries()].sort());
  url.search = sorted.toString();

  // Remove trailing slash
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  // Remove tracking parameters
  ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid']
    .forEach(p => url.searchParams.delete(p));

  return url.toString();
}
```

**Content Deduplication -- SimHash:**

Many websites syndicate the same article or have near-identical pages (pagination, query parameters). SimHash detects near-duplicates by producing a fingerprint where similar documents have similar hashes.

```
Algorithm (SimHash):
  1. Tokenize the page text into shingles (3-word sliding windows)
  2. Hash each shingle to a 64-bit value
  3. For each bit position (0-63):
     - If the shingle hash has bit=1 at that position, add +1 to a counter
     - If bit=0, add -1
  4. Final hash: for each bit position, if counter > 0, set bit=1; else 0

  Two documents are near-duplicates if their SimHash values differ in
  <= 3 bit positions (Hamming distance <= 3).
```

**SimHash lookup optimization:**

Checking Hamming distance against 10 B hashes is expensive. We use a table-based approach:

1. Split the 64-bit SimHash into 4 blocks of 16 bits each.
2. Store each document in 4 lookup tables (one per block).
3. To check a new hash, look up each 16-bit block. Documents matching in at least one block are candidates.
4. Compute exact Hamming distance only for candidates.

This reduces comparisons from O(n) to O(candidates), typically < 100.

### Deep Dive C: Handling Dynamic Content (JavaScript-Rendered Pages)

Modern SPAs render content client-side with JavaScript. A simple HTTP GET returns an empty `<div id="root"></div>`.

**Detection strategy:**

```typescript
async function shouldRenderJS(url: string, html: string): Promise<boolean> {
  // Heuristic 1: Very little text content in raw HTML
  const textContent = stripTags(html).trim();
  if (textContent.length < 200 && html.length > 5000) return true;

  // Heuristic 2: Known SPA frameworks
  if (html.includes('__NEXT_DATA__') ||
      html.includes('id="__nuxt"') ||
      html.includes('ng-app') ||
      html.includes('id="root"')) return true;

  // Heuristic 3: Domain is known to require JS (learned over time)
  const domain = new URL(url).hostname;
  if (jsRequiredDomains.has(domain)) return true;

  return false;
}
```

**Architecture for JS rendering:**

```
 Fetcher Worker
      |
      | Raw HTML
      v
 +------------------+
 | JS Detection     |
 | Heuristic Engine |
 +--------+---------+
          |
    +-----+------+
    | Needs JS?  |
    +-----+------+
    No    |    Yes
    |     |      |
    v     |      v
 Store    | +------------------+
 as-is    | | Headless Browser |
          | | Pool (Puppeteer) |
          | | - 50 instances   |
          | | - 10s timeout    |
          | | - Block images   |
          | +--------+---------+
          |          |
          |    Rendered HTML
          |          |
          +----------+
                |
                v
          Content Parser
```

**Headless browser pool management:**

- Pool of 50 Puppeteer/Playwright instances per worker node
- Each instance has a 10-second timeout for page rendering
- Block image, font, and CSS loading to speed up rendering
- Recycle browser instances every 100 pages to prevent memory leaks
- JS rendering is expensive (~5 s/page vs 0.5 s/page for static): only use when needed
- Budget: at most 10 % of total crawl capacity goes to JS rendering

---

## Trade-offs

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| URL dedup | Hash set (exact) | Bloom filter (probabilistic) | **Bloom filter** | 100x less memory; 1 % false positives acceptable (miss some URLs, not duplicates) |
| Content dedup | Exact hash (SHA-256) | SimHash (near-duplicate) | **Both** | SHA-256 for exact duplicates; SimHash for near-duplicates |
| URL frontier storage | In-memory (Redis) | On-disk (RocksDB) | **Redis + disk overflow** | Redis for hot queue (top 10 M URLs); RocksDB for the tail |
| JS rendering | Always | On-demand heuristic | **On-demand** | 10x cost savings; only ~15 % of web needs JS rendering |
| Crawl rate control | Fixed delay | Adaptive per domain | **Adaptive** | Respects slow servers while maximizing throughput on fast ones |
| HTML storage | Database (PostgreSQL) | Object store (S3/HDFS) | **S3/HDFS** | 100 TB/month is too much for a database; object stores are cheaper |
| DNS resolution | System resolver | Custom cache | **Custom cache** | Avoid DNS as bottleneck; cache reduces latency and external queries |
| Distributed coordination | Central coordinator | Partitioned by domain | **Partitioned by domain** | Each worker "owns" a set of domains; avoids coordination overhead |

---

## Scaling Strategy

| Component | Strategy |
|-----------|----------|
| Fetcher Workers | Scale horizontally; each handles ~25 pages/s; add workers linearly |
| URL Frontier | Shard by domain hash; each shard ~1 M URLs in Redis |
| DNS Cache | Local per-worker cache (TTL 1 h) + shared Redis (TTL 24 h) |
| robots.txt Cache | Redis with 24-hour TTL; ~10 M domains = ~5 GB |
| Content Storage (S3) | Virtually unlimited; lifecycle policy to delete after 90 days if not indexed |
| Metadata DB | Shard PostgreSQL by domain; each shard ~50 M rows |
| Bloom Filter | Distributed across workers; each worker has full copy (~1.2 GB, fits in memory) |
| JS Rendering Pool | Separate GPU/CPU-heavy instances; scale based on queue depth |

**Domain-based partitioning:**

```
Worker 0: domains hashing to partition 0 (a*.com, d*.com, ...)
Worker 1: domains hashing to partition 1 (b*.com, e*.com, ...)
...
Worker 23: domains hashing to partition 23

Benefits:
- Each worker manages its own politeness timers
- No cross-worker coordination for rate limiting
- Domain locality improves DNS cache hit rates
```

---

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Fetcher worker crash | URLs in-flight lost | Checkpoint URL state in Redis before fetching; on restart, re-enqueue unfinished URLs |
| DNS resolution failure | Cannot resolve domain | Retry with exponential backoff; fall back to alternative DNS (8.8.8.8, 1.1.1.1); cache last-known IP |
| Target server down (5xx) | Page not crawled | Retry 3 times with exponential backoff; deprioritize domain; mark for recrawl later |
| S3 storage unavailable | Cannot persist HTML | Buffer in local disk (100 GB reserved); flush to S3 when available |
| Bloom filter corruption | False negatives cause re-crawling | Periodic rebuild from metadata DB; minor impact (just re-crawls some pages) |
| Redis frontier crash | Lose pending URL queue | Redis cluster with AOF persistence; rebuild from metadata DB if total loss |
| Crawler trapped in spider trap | Infinite loop, wasted resources | Max depth limit (15 levels); max pages per domain per cycle (100 K); URL pattern detection |
| Rate limiting / IP ban | Domain blocks our crawler | Rotate IPs across a pool; respect 429 backoff; use well-known User-Agent |

---

## Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Crawl rate (pages/sec) | < 300 (below target) |
| URL frontier depth | > 100 M (growing too fast, not draining) |
| Error rate (5xx + timeouts) | > 5 % of fetches |
| DNS cache hit rate | < 90 % |
| Duplicate content ratio | > 30 % (too many dupes) |
| Average fetch latency | > 3 s |
| JS rendering queue depth | > 10 K (need more headless instances) |
| robots.txt violations | > 0 (must be zero) |
| Storage growth rate | > 4 TB/day (cost alert) |
