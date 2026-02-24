# HLD 07 -- Search Autocomplete System

> **Interview time budget:** 40 min total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## 1. Clarify (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | **Real-time suggestions** | Return top 5-10 suggestions as user types each character |
| F2 | **Prefix matching** | "how t" -> "how to cook rice", "how to tie a tie", ... |
| F3 | **Ranking by popularity** | Most searched queries ranked higher |
| F4 | **Personalization** | Boost suggestions based on user's search history |
| F5 | **Trending queries** | Recent spikes in search volume surface quickly |
| F6 | **Multi-language support** | UTF-8 aware prefix matching |
| F7 | **Spell correction** | "pythn" -> suggest "python" (nice to have) |
| F8 | **Offensive content filtering** | Blacklist inappropriate suggestions |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Latency (p99) | **< 100 ms** end-to-end |
| NF2 | Availability | 99.99 % |
| NF3 | Freshness | Trending queries surface within **15 minutes** |
| NF4 | Throughput | Handle **100 K+ requests/sec** |
| NF5 | Consistency | Eventual (stale suggestions are acceptable) |

### Users & Access Patterns

- **100 M** DAU, **10 searches/day/user**
- Average **20 characters** per query, user sees suggestions after every keystroke
- Read-heavy: 99.9 % reads (suggestion lookups), 0.1 % writes (logging searches)
- Global user base across multiple regions

---

## 2. Estimate (5 min)

### QPS

| Metric | Calculation | Result |
|--------|-------------|--------|
| Total searches per day | 100 M x 10 | **1 B / day** |
| Autocomplete requests per search | ~20 chars, but debounce reduces to ~6 requests | **6 B / day** |
| Average QPS | 6 B / 86400 | **~70 K /s** |
| Peak QPS (3x average) | 70 K x 3 | **~210 K /s** |

### Storage

| Data | Calculation | Result |
|------|-------------|--------|
| Unique queries (last 12 months) | ~500 M unique queries | -- |
| Average query length | 20 chars x 2 bytes (UTF-8 avg) | 40 bytes |
| Trie node storage | 500 M queries x 40 B avg + overhead | **~50 GB** (raw trie) |
| Top-K results per prefix | ~100 M popular prefixes x 10 results x 60 B | **~60 GB** |
| Total in-memory | Trie + top-K precomputed | **~110 GB** |
| Search logs (raw) | 1 B/day x 100 B/entry x 365 days | **~36 TB /year** |

### Bandwidth

| Direction | Calculation | Result |
|-----------|-------------|--------|
| Request size | ~50 bytes (prefix + metadata) | -- |
| Response size | ~500 bytes (10 suggestions) | -- |
| Ingress | 210 K /s x 50 B | **~10 MB/s** |
| Egress | 210 K /s x 500 B | **~100 MB/s** |

---

## 3. High-Level Design (15 min)

### Architecture Diagram

```
 +---------------------+
 |  Client (Browser /  |
 |  Mobile App)        |
 |  - Debounce 100ms   |
 |  - Local LRU cache  |
 +----------+----------+
            |
            | HTTPS
            v
 +---------------------+
 |    API Gateway       |  -- Rate limiting, auth
 |    (Regional)        |
 +----------+----------+
            |
    +-------+-------+
    |               |
    v               v
 +----------+  +----------+
 | Autocmpl |  | Search   |
 | Service  |  | Service  |  -- Full search (on Enter)
 | (Read)   |  | (Read)   |
 +----+-----+  +----------+
      |
      |  Lookup prefix
      v
 +---------------------------+
 |      Trie Cluster         |
 |  (In-Memory / Redis)      |
 |  - Sharded by prefix      |
 |  - Replicated for reads   |
 +---------------------------+
      ^
      |  Periodic rebuild (every 15 min)
      |
 +----+---------+
 | Trie Builder |  -- Offline pipeline
 +----+---------+
      |
      v
 +-----------+     +------------------+     +-----------------+
 | Aggregator|<----| Log Collector    |<----| Search Logs     |
 | Service   |     | (Kafka/Kinesis)  |     | (Raw Events)    |
 +-----------+     +------------------+     +-----------------+
      |
      v
 +-------------------+
 | Analytics DB      |
 | (ClickHouse)      |
 | - query, count,   |
 |   time_bucket     |
 +-------------------+

 +-------------------+
 | Personalization   |  -- User history lookup
 | Service           |
 | (Redis / ML Model)|
 +-------------------+
```

### API Design

#### Get Suggestions

```
GET /api/v1/autocomplete?q={prefix}&limit=10&lang=en&userId={uid}
Headers: X-Session-Id, X-Region

Response 200:
{
  "suggestions": [
    { "text": "how to cook rice", "score": 0.95, "source": "trending" },
    { "text": "how to tie a tie", "score": 0.90, "source": "popular" },
    { "text": "how to screenshot on mac", "score": 0.87, "source": "personal" }
  ],
  "cached": false,
  "latency_ms": 12
}
```

#### Log Search Event (Async)

```
POST /api/v1/search/log
Body: { query, userId, sessionId, timestamp, resultClicked }
Response: 202 Accepted
```

### Data Structures

#### Trie Node (Conceptual)

```typescript
interface TrieNode {
  children: Map<string, TrieNode>;  // char -> child node
  isEnd: boolean;                    // marks complete query
  topK: SuggestionEntry[];           // precomputed top-10 results for this prefix
}

interface SuggestionEntry {
  text: string;      // full query text
  score: number;     // popularity score (decayed over time)
  frequency: number; // raw count
  category: string;  // "trending" | "popular" | "recent"
}
```

#### Redis Sorted Set (Alternative to In-Memory Trie)

```
Key:   autocomplete:prefix:{prefix}
Value: ZSET { "query_text": score, ... }

Example:
  autocomplete:prefix:how     -> ZSET { "how to cook rice": 95000, "how are you": 90000, ... }
  autocomplete:prefix:how t   -> ZSET { "how to cook rice": 95000, "how to tie a tie": 85000, ... }
  autocomplete:prefix:how to  -> ZSET { "how to cook rice": 95000, "how to tie a tie": 85000, ... }
```

---

## 4. Deep Dive (15 min)

### Deep Dive A: Trie Data Structure and Prefix Lookup

**Why a trie (and not a database query)?**

A `LIKE 'prefix%'` query on a B-tree index can work for small datasets, but at 500 M unique queries and 210 K QPS, database lookups would be far too slow and expensive. A trie provides O(L) prefix lookup where L is the length of the prefix (typically 1-20 characters).

**Trie optimizations:**

1. **Compressed trie (Patricia trie):** Merge single-child chains into one node. "autocomplete" becomes a single edge rather than 12 nodes. Reduces memory by ~60 %.

```
Standard trie:          Compressed trie:
  a                       auto
   u                        complete
    t                       correct
     o
      c
       o
        m
         p
          l
           e
            t
             e
```

2. **Pre-computed top-K at each node:** Instead of traversing all descendants to find the most popular completions (which could be millions), we precompute and store the top 10 results at every trie node during the build phase.

```
Node "how to" stores:
  topK = [
    ("how to cook rice", 95000),
    ("how to tie a tie", 85000),
    ("how to screenshot on mac", 80000),
    ...top 10
  ]
```

This makes lookups O(L) -- just walk to the prefix node and return its topK array. No aggregation at query time.

3. **Sharding strategy:** Shard the trie by first 1-2 characters of the prefix. Each shard fits in a single server's memory (~5-10 GB). With 26 letters + digits + special characters, we get ~40 shards, each handling a slice of the keyspace.

```
Shard 0: prefixes starting with 'a'
Shard 1: prefixes starting with 'b'
...
Shard 7: prefixes starting with 'h' (includes "how", high traffic)
  -> Sub-shard 'h' into 'ha', 'hb', ..., 'hz' if needed
```

4. **Memory layout:** Use array-based trie with fixed-size nodes for cache efficiency. Each node is 128 bytes (fits in two cache lines), with children stored as indices into a flat array rather than pointers.

**Trie rebuild cycle:**

```
Every 15 minutes:
  1. Aggregator reads from ClickHouse:
     "SELECT query, SUM(count) * decay_factor(age)
      FROM search_counts
      WHERE timestamp > now() - INTERVAL '30 days'
      GROUP BY query
      ORDER BY score DESC
      LIMIT 10_000_000"

  2. Build new trie in memory (takes ~2 min for 500M entries)

  3. Serialize to binary format, upload to S3

  4. Autocomplete servers download new snapshot and swap atomically
     (double-buffer: build new trie while serving from old one)
```

### Deep Dive B: Data Collection and Aggregation Pipeline

**Pipeline architecture:**

```
 User Search Event
       |
       v
 +---------------+     +--------------+     +------------------+
 | API Server    |---->| Kafka        |---->| Stream Processor |
 | (emit event)  |     | (search_logs |     | (Flink / Spark   |
 +---------------+     |  topic)      |     |  Streaming)      |
                        +--------------+     +--------+---------+
                                                      |
                                           +----------+----------+
                                           |                     |
                                    +------v------+     +--------v-------+
                                    | Real-Time   |     | Batch          |
                                    | Aggregator  |     | Aggregator     |
                                    | (5 min      |     | (Daily /       |
                                    |  windows)   |     |  Weekly)       |
                                    +------+------+     +--------+-------+
                                           |                     |
                                           v                     v
                                    +--------------+     +---------------+
                                    | Redis        |     | ClickHouse    |
                                    | (Trending    |     | (Historical   |
                                    |  counters)   |     |  counts)      |
                                    +--------------+     +---------------+
                                           |                     |
                                           +----------+----------+
                                                      |
                                              +-------v--------+
                                              | Trie Builder   |
                                              +----------------+
```

**Scoring formula:**

```
score(query) = base_popularity * time_decay(age) + trending_boost + personalization_bonus

where:
  base_popularity = log10(total_count_30d + 1) * 1000
  time_decay(age) = 0.95 ^ (days_since_last_search)
  trending_boost  = (count_last_hour / avg_hourly_count - 1) * 5000  [if > 3x normal]
  personalization_bonus = 2000  [if user searched this before]
```

**Handling trending queries (breaking news, viral events):**

The real-time aggregator uses sliding windows:
1. **5-minute tumbling windows** count queries in Kafka Streams / Flink.
2. If a query's 5-min count exceeds 3x its historical hourly average, it is flagged as "trending."
3. Trending queries are injected directly into Redis sorted sets (bypassing the full trie rebuild), so they surface within 5-10 minutes.
4. The next trie rebuild cycle incorporates them into the full trie.

### Deep Dive C: Client-Side Optimizations

These optimizations are critical because the client generates the majority of traffic (6 requests per search).

**1. Debouncing:**

```typescript
// Do not send request on every keystroke -- wait for a pause
function debounce(fn: Function, delayMs: number) {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

const fetchSuggestions = debounce(async (prefix: string) => {
  if (prefix.length < 2) return; // skip single-char queries
  const cached = lruCache.get(prefix);
  if (cached) return render(cached);

  const res = await fetch(`/api/v1/autocomplete?q=${encodeURIComponent(prefix)}`);
  const data = await res.json();
  lruCache.set(prefix, data.suggestions);
  render(data.suggestions);
}, 100); // 100ms debounce
```

Debouncing at 100 ms reduces requests from ~20/search to ~6/search (70 % reduction).

**2. Local LRU cache:**

```typescript
// Cache recent prefix -> suggestions in memory
// If user types "how", deletes, types "how" again, serve from cache
const lruCache = new LRUCache<string, Suggestion[]>({
  max: 1000,     // store up to 1000 prefixes
  ttl: 300_000,  // expire after 5 minutes
});
```

**3. Prefix reuse / filtering:**

If the user types "how t" and we already have results for "how", we can filter the "how" results client-side without a network request:

```typescript
function filterLocal(prefix: string): Suggestion[] | null {
  // Walk backwards to find a cached parent prefix
  for (let i = prefix.length - 1; i >= 2; i--) {
    const parent = prefix.substring(0, i);
    const cached = lruCache.get(parent);
    if (cached) {
      const filtered = cached.filter(s =>
        s.text.toLowerCase().startsWith(prefix.toLowerCase())
      );
      if (filtered.length >= 5) return filtered; // good enough
    }
  }
  return null; // need server request
}
```

**4. Request cancellation:**

```typescript
let abortController: AbortController | null = null;

async function fetchSuggestions(prefix: string) {
  // Cancel previous in-flight request
  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const res = await fetch(`/api/v1/autocomplete?q=${prefix}`, {
      signal: abortController.signal,
    });
    // ... process response
  } catch (err) {
    if (err.name === 'AbortError') return; // expected, ignore
    throw err;
  }
}
```

---

## Trade-offs

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Data structure | Trie in memory | Redis sorted sets per prefix | **Trie** for primary; **Redis** for trending | Trie gives lower latency and less memory; Redis enables real-time updates |
| Trie location | Application server memory | Dedicated trie cluster | **Dedicated cluster** | Decouples compute from data; easier to scale and update |
| Update frequency | Real-time per query | Batch rebuild every 15 min | **Batch + real-time trending** | Batch is simpler and cheaper; real-time only for trending spikes |
| Personalization | At trie level | As a re-ranking layer | **Re-ranking** | Keeps trie shared and simple; personalization blends into top-K at query time |
| Client caching | No cache | LRU + prefix reuse | **LRU + prefix reuse** | Reduces server load by ~40 % |
| Sharding key | By prefix (first chars) | By query hash | **By prefix** | Range queries (all completions for "how") stay on one shard |
| Spell correction | In autocomplete service | Separate service | **Separate** | Different latency profile; can be added incrementally |

---

## Scaling Strategy

| Component | Strategy |
|-----------|----------|
| API Gateway | Regional deployment (US, EU, Asia); Anycast DNS |
| Autocomplete Service | Stateless; horizontally scaled; ~50 instances per region |
| Trie Cluster | 40 shards, 3 replicas each = 120 nodes; read from any replica |
| Kafka | 3-broker cluster per region; partitioned by query hash |
| ClickHouse | Sharded by time; 30-day rolling window for scoring |
| Redis (trending) | Cluster mode; 6 nodes with 1 replica each |
| Trie Builder | Single leader per region; runs on beefy instance (128 GB RAM) |

**Regional architecture:**

```
                    Global
                      |
        +-------------+-------------+
        |             |             |
    US-East       EU-West       AP-Southeast
    (primary)     (replica)     (replica)

Each region has:
- Full trie cluster (built from same global data)
- Local Redis for trending (region-specific trends)
- Local Kafka for log collection -> replicated to central analytics
```

---

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Trie server crash | Partial prefix space unavailable | 3 replicas per shard; client retries to different replica |
| Trie rebuild fails | Stale suggestions (15+ min old) | Keep serving old trie; alert on-call; manual rebuild trigger |
| Kafka broker down | Search logs delayed | 3-broker cluster with replication factor 2; producer retries |
| ClickHouse down | Trie rebuild uses stale counts | Rebuild from last successful snapshot; trending still works via Redis |
| Redis trending crash | No trending suggestions | Graceful degradation: serve from trie only (lacks last 15 min of trends) |
| Network partition between regions | Region serves local-only trends | Each region is self-sufficient; global sync resumes on recovery |
| DDoS / traffic spike | Latency increase | Rate limiting at gateway; client-side debounce absorbs burst; auto-scale |
| Offensive query goes viral | Inappropriate suggestions shown | Real-time blacklist check in autocomplete service; manual review pipeline |

---

## Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Autocomplete p99 latency | > 100 ms |
| Autocomplete p50 latency | > 20 ms |
| Trie rebuild duration | > 5 min |
| Trie freshness (age of current snapshot) | > 30 min |
| Cache hit rate (client-side) | < 30 % |
| Suggestion click-through rate | < 20 % (relevance problem) |
| Kafka consumer lag | > 1 M messages |
| Trending detection latency | > 15 min from spike to surfaced |
