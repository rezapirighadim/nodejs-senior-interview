/**
 * ============================================================================
 * FILE 15: System Design for Senior Node.js Interviews
 * ============================================================================
 *
 * A comprehensive guide to system design concepts, patterns, and frameworks
 * for senior-level interviews. Each concept includes runnable code
 * demonstrations where applicable.
 *
 * Run: node 15_system_design.js
 *
 * Table of Contents:
 *   1.  System Design Interview Framework (4 Steps)
 *   2.  Back-of-Envelope Calculations
 *   3.  Building Blocks (Load Balancers, CDN, Caching, Queues, Databases)
 *   4.  API Design (REST, Pagination, Rate Limiting)
 *   5.  Database Design (SQL/NoSQL, Sharding, Replication, Indexing)
 *   6.  Caching Strategies
 *   7.  Microservices Patterns
 *   8.  Event-Driven Architecture
 *   9.  Reliability Patterns (Circuit Breaker, Retry, Bulkhead)
 *   10. Observability (Logging, Metrics, Tracing)
 *   11. Security (JWT, OAuth2, API Keys)
 *   12. Scaling Patterns
 *   13. CAP Theorem, BASE vs ACID
 *   14. Node.js Specific Considerations
 * ============================================================================
 */

'use strict';

// ============================================================================
// UTILITY: Test runner
// ============================================================================
const results = { passed: 0, failed: 0, total: 0 };

function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  PASS: ${message}`);
  } else {
    results.failed++;
    console.log(`  FAIL: ${message}`);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(72)}`);
}

function subsection(title) {
  console.log(`\n  --- ${title} ---`);
}

// ============================================================================
// 1. SYSTEM DESIGN INTERVIEW FRAMEWORK
// ============================================================================

section('1. SYSTEM DESIGN INTERVIEW FRAMEWORK');

const frameworkGuide = `
  The 4-Step Framework (45-minute interview):
  ============================================================

  STEP 1: CLARIFY REQUIREMENTS (5-7 minutes)
  -----------------------------------------------------------
  Functional Requirements:
    - "What are the core features?"
    - "Who are the users? How many?"
    - "What does the user flow look like?"

  Non-Functional Requirements:
    - "What's the expected scale (users, requests/sec)?"
    - "What are the latency requirements?"
    - "Is consistency or availability more important?"
    - "Do we need real-time features?"

  Constraints & Assumptions:
    - "Can we use existing cloud services?"
    - "What's the budget for infrastructure?"
    - "Any regulatory requirements (GDPR, HIPAA)?"

  Pro tip: Write requirements on the whiteboard. The interviewer
  wants to see you scope the problem before diving in.

  STEP 2: ESTIMATE SCALE (3-5 minutes)
  -----------------------------------------------------------
  Back-of-envelope calculations:
    - Users -> QPS (queries per second)
    - Storage needs (per day, per year)
    - Bandwidth requirements
    - Memory for caching

  STEP 3: HIGH-LEVEL DESIGN (15-20 minutes)
  -----------------------------------------------------------
  Draw the architecture:
    - Start with client -> API -> database
    - Add components as needed (cache, queue, CDN, etc.)
    - Explain data flow for key use cases
    - Discuss API contracts

  STEP 4: DEEP DIVE (15-20 minutes)
  -----------------------------------------------------------
  The interviewer will pick areas to go deeper:
    - Database schema and indexing strategy
    - Specific algorithm design
    - Handling edge cases and failures
    - Scaling specific bottlenecks
    - Security considerations
`;

console.log(frameworkGuide);

// ============================================================================
// 2. BACK-OF-ENVELOPE CALCULATIONS
// ============================================================================

section('2. BACK-OF-ENVELOPE CALCULATIONS');

// Key numbers every engineer should know
const CONSTANTS = {
  // Time
  SECONDS_PER_DAY: 86_400,       // ~100K for quick math
  SECONDS_PER_MONTH: 2_592_000,  // ~2.5M
  SECONDS_PER_YEAR: 31_536_000,  // ~30M

  // Storage
  KB: 1_024,
  MB: 1_024 ** 2,
  GB: 1_024 ** 3,
  TB: 1_024 ** 4,

  // Latency
  L1_CACHE_NS: 0.5,
  L2_CACHE_NS: 7,
  RAM_NS: 100,
  SSD_READ_US: 150,           // microseconds
  HDD_SEEK_MS: 10,            // milliseconds
  NETWORK_SAME_DATACENTER_US: 500,
  NETWORK_CA_TO_EU_MS: 150,

  // Throughput
  SSD_SEQUENTIAL_READ_MBPS: 1_000,
  HDD_SEQUENTIAL_READ_MBPS: 100,
  NETWORK_1GBPS_MBPS: 125,  // 1 Gbps = 125 MB/s
};

/**
 * Estimation calculator for system design interviews
 */
class SystemEstimator {
  /**
   * Calculate QPS from DAU (Daily Active Users)
   */
  static calculateQPS({
    dailyActiveUsers,
    actionsPerUserPerDay,
    peakMultiplier = 3,  // Peak is typically 2-5x average
  }) {
    const totalDailyActions = dailyActiveUsers * actionsPerUserPerDay;
    const averageQPS = totalDailyActions / CONSTANTS.SECONDS_PER_DAY;
    const peakQPS = averageQPS * peakMultiplier;

    return {
      totalDailyActions,
      averageQPS: Math.ceil(averageQPS),
      peakQPS: Math.ceil(peakQPS),
    };
  }

  /**
   * Calculate storage requirements
   */
  static calculateStorage({
    dailyNewRecords,
    averageRecordSizeBytes,
    retentionYears = 5,
    replicationFactor = 3,
  }) {
    const dailyStorage = dailyNewRecords * averageRecordSizeBytes;
    const yearlyStorage = dailyStorage * 365;
    const totalStorage = yearlyStorage * retentionYears;
    const withReplication = totalStorage * replicationFactor;

    return {
      dailyGB: (dailyStorage / CONSTANTS.GB).toFixed(2),
      yearlyTB: (yearlyStorage / CONSTANTS.TB).toFixed(2),
      totalTB: (totalStorage / CONSTANTS.TB).toFixed(2),
      withReplicationTB: (withReplication / CONSTANTS.TB).toFixed(2),
    };
  }

  /**
   * Calculate bandwidth requirements
   */
  static calculateBandwidth({
    peakQPS,
    averageResponseSizeKB,
  }) {
    const bandwidthKBPS = peakQPS * averageResponseSizeKB;
    const bandwidthMBPS = bandwidthKBPS / 1024;
    const bandwidthGbps = (bandwidthMBPS * 8) / 1024; // Convert to bits

    return {
      bandwidthMBPS: bandwidthMBPS.toFixed(2),
      bandwidthGbps: bandwidthGbps.toFixed(2),
    };
  }

  /**
   * Calculate cache memory requirements
   */
  static calculateCacheMemory({
    dailyActiveUsers,
    cacheHitRatio = 0.8,       // 80% of requests served from cache
    averageCacheSizeBytes = 500,
    cachePercentOfDAU = 0.2,   // Cache top 20% of data (80/20 rule)
  }) {
    const itemsToCache = Math.ceil(dailyActiveUsers * cachePercentOfDAU);
    const totalCacheMemory = itemsToCache * averageCacheSizeBytes;

    return {
      itemsToCache,
      cacheMemoryGB: (totalCacheMemory / CONSTANTS.GB).toFixed(2),
      cacheHitRatio,
    };
  }
}

subsection('2. Example: Design Twitter-like System');

const twitterEstimates = {
  qps: SystemEstimator.calculateQPS({
    dailyActiveUsers: 300_000_000, // 300M DAU
    actionsPerUserPerDay: 5,       // 5 tweets read per visit (simplified)
    peakMultiplier: 3,
  }),
  storage: SystemEstimator.calculateStorage({
    dailyNewRecords: 500_000_000,  // 500M tweets/day
    averageRecordSizeBytes: 300,   // 280 chars + metadata
    retentionYears: 5,
  }),
  cache: SystemEstimator.calculateCacheMemory({
    dailyActiveUsers: 300_000_000,
    averageCacheSizeBytes: 300,
  }),
};

console.log('\n  Twitter-like System Estimates:');
console.log(`    QPS: avg=${twitterEstimates.qps.averageQPS}, peak=${twitterEstimates.qps.peakQPS}`);
console.log(`    Storage: ${twitterEstimates.storage.yearlyTB} TB/year, ${twitterEstimates.storage.withReplicationTB} TB with replication`);
console.log(`    Cache: ${twitterEstimates.cache.cacheMemoryGB} GB for top 20% of data`);

const bandwidth = SystemEstimator.calculateBandwidth({
  peakQPS: twitterEstimates.qps.peakQPS,
  averageResponseSizeKB: 5,
});
console.log(`    Bandwidth: ${bandwidth.bandwidthMBPS} MB/s (${bandwidth.bandwidthGbps} Gbps)`);

assert(twitterEstimates.qps.peakQPS > twitterEstimates.qps.averageQPS, 'Estimates: peak > average QPS');
assert(parseFloat(twitterEstimates.storage.withReplicationTB) > 0, 'Estimates: storage calculated');

// ============================================================================
// 3. BUILDING BLOCKS
// ============================================================================

section('3. BUILDING BLOCKS');

const buildingBlocks = `
  Key Components in System Design:
  ============================================================

  LOAD BALANCER
  -----------------------------------------------------------
  Purpose: Distribute traffic across servers
  Algorithms:
    - Round Robin: simple rotation
    - Weighted Round Robin: based on server capacity
    - Least Connections: send to server with fewest active connections
    - IP Hash: consistent mapping (sticky sessions)
    - Least Response Time: send to fastest server

  Layers:
    - L4 (Transport): TCP/UDP level, faster, no content inspection
    - L7 (Application): HTTP level, can route by URL/headers/cookies

  Tools: Nginx, HAProxy, AWS ALB/NLB, Cloudflare

  CDN (Content Delivery Network)
  -----------------------------------------------------------
  Purpose: Serve static content from edge locations close to users
  What to cache: images, CSS, JS, videos, static HTML
  Patterns:
    - Push CDN: you push content to CDN (for static sites)
    - Pull CDN: CDN fetches from origin on first request (most common)
  Invalidation: TTL-based, purge API, versioned URLs
  Tools: CloudFront, Cloudflare, Akamai, Fastly

  MESSAGE QUEUE
  -----------------------------------------------------------
  Purpose: Decouple producers and consumers, handle async work
  Use cases: email sending, image processing, data pipelines
  Patterns:
    - Point-to-point: one producer, one consumer
    - Pub/Sub: one producer, multiple consumer groups
    - Fan-out: one message to multiple consumers

  Guarantees:
    - At-most-once: may lose messages (fastest)
    - At-least-once: may duplicate messages (most common)
    - Exactly-once: hardest to achieve (Kafka transactions)

  Tools: RabbitMQ, Apache Kafka, AWS SQS, Redis Streams, BullMQ

  DATABASE
  -----------------------------------------------------------
  (Covered in detail in Section 5)
`;

console.log(buildingBlocks);

// ---------------------------------------------------------------------------
// 3a. Load Balancer Simulation
// ---------------------------------------------------------------------------

subsection('3a. Load Balancer Algorithms');

class LoadBalancer {
  #servers;
  #algorithm;
  #currentIndex = 0;
  #connectionCounts = new Map();

  constructor(servers, algorithm = 'round-robin') {
    this.#servers = servers;
    this.#algorithm = algorithm;
    for (const server of servers) {
      this.#connectionCounts.set(server, 0);
    }
  }

  getServer(clientIP = '') {
    switch (this.#algorithm) {
      case 'round-robin':
        return this.#roundRobin();
      case 'least-connections':
        return this.#leastConnections();
      case 'ip-hash':
        return this.#ipHash(clientIP);
      default:
        return this.#roundRobin();
    }
  }

  #roundRobin() {
    const server = this.#servers[this.#currentIndex];
    this.#currentIndex = (this.#currentIndex + 1) % this.#servers.length;
    return server;
  }

  #leastConnections() {
    let minConns = Infinity;
    let selected = this.#servers[0];

    for (const [server, conns] of this.#connectionCounts) {
      if (conns < minConns) {
        minConns = conns;
        selected = server;
      }
    }

    this.#connectionCounts.set(selected, minConns + 1);
    return selected;
  }

  #ipHash(clientIP) {
    let hash = 0;
    for (let i = 0; i < clientIP.length; i++) {
      hash = ((hash << 5) - hash + clientIP.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % this.#servers.length;
    return this.#servers[index];
  }

  releaseConnection(server) {
    const current = this.#connectionCounts.get(server) ?? 0;
    this.#connectionCounts.set(server, Math.max(0, current - 1));
  }
}

// Demo load balancers
const servers = ['server-1', 'server-2', 'server-3'];

const rrLB = new LoadBalancer(servers, 'round-robin');
const rrResults = Array.from({ length: 6 }, () => rrLB.getServer());
assert(rrResults[0] === 'server-1' && rrResults[3] === 'server-1', 'LB: round-robin cycles');

const ipLB = new LoadBalancer(servers, 'ip-hash');
const ipResult1 = ipLB.getServer('192.168.1.1');
const ipResult2 = ipLB.getServer('192.168.1.1');
assert(ipResult1 === ipResult2, 'LB: ip-hash is consistent for same IP');

// ============================================================================
// 4. API DESIGN
// ============================================================================

section('4. API DESIGN');

// ---------------------------------------------------------------------------
// 4a. REST API Conventions
// ---------------------------------------------------------------------------

subsection('4a. REST API Conventions');

const restConventions = `
  REST API Best Practices:
  ============================================================

  URL Structure:
    GET    /api/v1/users          - List users
    POST   /api/v1/users          - Create user
    GET    /api/v1/users/:id      - Get user
    PUT    /api/v1/users/:id      - Replace user
    PATCH  /api/v1/users/:id      - Partial update
    DELETE /api/v1/users/:id      - Delete user

  Naming:
    - Use nouns (not verbs): /users NOT /getUsers
    - Use plural nouns: /users NOT /user
    - Use kebab-case: /user-profiles NOT /userProfiles
    - Nest for relationships: /users/:id/posts

  Status Codes:
    200 OK              - Success (GET, PUT, PATCH)
    201 Created         - Success (POST)
    204 No Content      - Success (DELETE)
    400 Bad Request     - Invalid input
    401 Unauthorized    - Not authenticated
    403 Forbidden       - Not authorized
    404 Not Found       - Resource doesn't exist
    409 Conflict        - Duplicate or conflict
    422 Unprocessable   - Validation failed
    429 Too Many Reqs   - Rate limited
    500 Internal Error  - Server error
    503 Service Unavail - Server overloaded

  Versioning: /api/v1/, /api/v2/ (URL path is most common)
  Alternatives: header-based (Accept: application/vnd.api.v2+json)
`;

console.log(restConventions);

// ---------------------------------------------------------------------------
// 4b. Pagination Pattern
// ---------------------------------------------------------------------------

subsection('4b. Pagination');

/**
 * Three main pagination strategies:
 *
 * 1. OFFSET-BASED (simplest, has issues at scale)
 *    GET /users?page=2&limit=20
 *    - Easy to implement: SELECT * FROM users LIMIT 20 OFFSET 20
 *    - Problem: skips/duplicates when data changes, slow at high offsets
 *
 * 2. CURSOR-BASED (recommended for feeds/timelines)
 *    GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
 *    - Cursor is an opaque token (often base64-encoded ID)
 *    - SELECT * FROM users WHERE id > 100 ORDER BY id LIMIT 20
 *    - No skip/duplicate issues, consistent performance
 *
 * 3. KEYSET PAGINATION (cursor with sort support)
 *    GET /users?after_id=100&sort=created_at&limit=20
 *    - Similar to cursor but with explicit sort columns
 */

class Paginator {
  /**
   * Offset-based pagination
   */
  static offsetPaginate(items, { page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    const paginatedItems = items.slice(offset, offset + limit);
    const totalPages = Math.ceil(items.length / limit);

    return {
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: items.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Cursor-based pagination
   */
  static cursorPaginate(items, { cursor = null, limit = 10 }) {
    let startIndex = 0;

    if (cursor) {
      // Decode cursor (base64 -> JSON -> id)
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      startIndex = items.findIndex(item => item.id === decoded.id) + 1;
    }

    const paginatedItems = items.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < items.length;

    // Encode next cursor
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ id: paginatedItems.at(-1).id })).toString('base64')
      : null;

    return {
      data: paginatedItems,
      pagination: {
        nextCursor,
        hasMore,
        count: paginatedItems.length,
      },
    };
  }
}

// Demo pagination
const allUsers = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
}));

const offsetResult = Paginator.offsetPaginate(allUsers, { page: 2, limit: 10 });
assert(offsetResult.data.length === 10, 'Pagination: offset returns 10 items');
assert(offsetResult.data[0].id === 11, 'Pagination: offset page 2 starts at id 11');
assert(offsetResult.pagination.totalPages === 5, 'Pagination: 50 items / 10 = 5 pages');

const cursorResult1 = Paginator.cursorPaginate(allUsers, { limit: 10 });
assert(cursorResult1.data.length === 10, 'Pagination: cursor first page = 10 items');
assert(cursorResult1.pagination.hasMore === true, 'Pagination: has more pages');

const cursorResult2 = Paginator.cursorPaginate(allUsers, {
  cursor: cursorResult1.pagination.nextCursor,
  limit: 10,
});
assert(cursorResult2.data[0].id === 11, 'Pagination: cursor second page starts at id 11');

// ---------------------------------------------------------------------------
// 4c. Rate Limiting
// ---------------------------------------------------------------------------

subsection('4c. Rate Limiting');

/**
 * Rate limiting algorithms:
 *
 * 1. FIXED WINDOW: count requests per fixed time window
 *    - Simple but has burst issue at window boundary
 *
 * 2. SLIDING WINDOW LOG: store timestamp of each request
 *    - Accurate but memory-intensive
 *
 * 3. SLIDING WINDOW COUNTER: hybrid of fixed + sliding
 *    - Good balance of accuracy and efficiency
 *
 * 4. TOKEN BUCKET: tokens refill at fixed rate, request consumes token
 *    - Allows controlled bursts
 *
 * 5. LEAKY BUCKET: queue requests, process at fixed rate
 *    - Smooth output rate
 *
 * Rate Limit Headers (standard):
 *   X-RateLimit-Limit: 100         - Max requests per window
 *   X-RateLimit-Remaining: 87      - Remaining in current window
 *   X-RateLimit-Reset: 1640000000  - Unix timestamp when window resets
 *   Retry-After: 60                - Seconds until retry (when limited)
 */

// Token Bucket implementation
class TokenBucket {
  #tokens;
  #maxTokens;
  #refillRate;   // tokens per second
  #lastRefill;

  constructor({ maxTokens = 10, refillRate = 1 }) {
    this.#maxTokens = maxTokens;
    this.#tokens = maxTokens;
    this.#refillRate = refillRate;
    this.#lastRefill = Date.now();
  }

  #refill() {
    const now = Date.now();
    const elapsed = (now - this.#lastRefill) / 1000; // seconds
    const newTokens = elapsed * this.#refillRate;

    this.#tokens = Math.min(this.#maxTokens, this.#tokens + newTokens);
    this.#lastRefill = now;
  }

  consume(tokens = 1) {
    this.#refill();

    if (this.#tokens >= tokens) {
      this.#tokens -= tokens;
      return {
        allowed: true,
        remaining: Math.floor(this.#tokens),
        limit: this.#maxTokens,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      limit: this.#maxTokens,
      retryAfter: Math.ceil((tokens - this.#tokens) / this.#refillRate),
    };
  }
}

// Sliding Window Counter
class SlidingWindowRateLimiter {
  #windowSizeMs;
  #maxRequests;
  #windows = new Map(); // key -> { prevCount, currCount, windowStart }

  constructor({ windowSizeMs = 60000, maxRequests = 100 }) {
    this.#windowSizeMs = windowSizeMs;
    this.#maxRequests = maxRequests;
  }

  isAllowed(key) {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / this.#windowSizeMs) * this.#windowSizeMs;

    let entry = this.#windows.get(key);

    if (!entry || entry.windowStart < currentWindowStart - this.#windowSizeMs) {
      entry = { prevCount: 0, currCount: 0, windowStart: currentWindowStart };
    } else if (entry.windowStart < currentWindowStart) {
      // Rotate windows
      entry = {
        prevCount: entry.currCount,
        currCount: 0,
        windowStart: currentWindowStart,
      };
    }

    // Weighted count: previous window * overlap fraction + current window
    const elapsed = now - currentWindowStart;
    const overlapFraction = 1 - (elapsed / this.#windowSizeMs);
    const weightedCount = entry.prevCount * overlapFraction + entry.currCount;

    if (weightedCount >= this.#maxRequests) {
      this.#windows.set(key, entry);
      return { allowed: false, count: Math.ceil(weightedCount) };
    }

    entry.currCount++;
    this.#windows.set(key, entry);
    return { allowed: true, count: Math.ceil(weightedCount) + 1 };
  }
}

// Demo rate limiting
const bucket = new TokenBucket({ maxTokens: 5, refillRate: 2 });
let allowed = 0;
for (let i = 0; i < 8; i++) {
  if (bucket.consume().allowed) allowed++;
}
assert(allowed === 5, `TokenBucket: allowed 5 out of 8 rapid requests`);

const limiter = new SlidingWindowRateLimiter({ windowSizeMs: 1000, maxRequests: 3 });
const r1 = limiter.isAllowed('user1');
const r2 = limiter.isAllowed('user1');
const r3 = limiter.isAllowed('user1');
const r4 = limiter.isAllowed('user1');
assert(r1.allowed && r2.allowed && r3.allowed, 'SlidingWindow: first 3 requests allowed');
assert(!r4.allowed, 'SlidingWindow: 4th request blocked');

// ============================================================================
// 5. DATABASE DESIGN
// ============================================================================

section('5. DATABASE DESIGN');

const databaseGuide = `
  SQL vs NoSQL Decision Guide:
  ============================================================

  Choose SQL (PostgreSQL, MySQL) when:
    - Data has clear relationships (foreign keys)
    - Need ACID transactions
    - Complex queries with JOINs
    - Data integrity is critical (financial, medical)
    - Schema is well-defined and stable

  Choose NoSQL when:
    Document DB (MongoDB):
      - Flexible/evolving schema
      - Nested data structures
      - Content management, catalogs

    Key-Value (Redis, DynamoDB):
      - Simple lookups by key
      - Caching, sessions, leaderboards
      - Extremely high throughput needed

    Wide-Column (Cassandra, HBase):
      - Write-heavy workloads
      - Time-series data
      - IoT sensor data

    Graph DB (Neo4j):
      - Highly connected data
      - Social networks, recommendation engines
      - Path finding

  SHARDING STRATEGIES
  -----------------------------------------------------------
  Horizontal Partitioning (Sharding):
    - Range-based: shard by ID range (1-1M -> shard1, 1M-2M -> shard2)
      Pro: simple, range queries work
      Con: hot spots if data is not uniform

    - Hash-based: shard = hash(key) % num_shards
      Pro: even distribution
      Con: range queries need to hit all shards, resharding is painful

    - Directory-based: lookup table maps key -> shard
      Pro: flexible
      Con: lookup table is a single point of failure

  REPLICATION
  -----------------------------------------------------------
  - Leader-Follower: writes to leader, reads from followers
    Pro: read scalability
    Con: replication lag, leader is SPOF

  - Leader-Leader (Multi-Master): writes to any node
    Pro: write availability
    Con: conflict resolution is complex

  - Leaderless (Quorum): read/write to multiple nodes
    Pro: no single point of failure
    Con: complexity, consistency challenges
    Example: Cassandra, DynamoDB

  INDEXING
  -----------------------------------------------------------
  - B-Tree: balanced tree, O(log n) for reads, writes
    Best for: range queries, ordered data

  - Hash Index: O(1) lookups
    Best for: exact match queries

  - Composite Index: multiple columns
    Rule: left-to-right prefix matching

  - Covering Index: includes all queried columns
    Benefit: can answer query from index alone (no table lookup)

  - Full-Text Index: for text search
    Best for: search functionality
`;

console.log(databaseGuide);

// ---------------------------------------------------------------------------
// 5a. Consistent Hashing (for distributed databases/caches)
// ---------------------------------------------------------------------------

subsection('5a. Consistent Hashing');

class ConsistentHash {
  #ring = new Map();        // position -> node
  #sortedPositions = [];
  #virtualNodes;

  constructor(virtualNodes = 150) {
    this.#virtualNodes = virtualNodes;
  }

  #hash(key) {
    // Simple hash function (use crypto in production)
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  addNode(node) {
    for (let i = 0; i < this.#virtualNodes; i++) {
      const position = this.#hash(`${node}:${i}`);
      this.#ring.set(position, node);
      this.#sortedPositions.push(position);
    }
    this.#sortedPositions.sort((a, b) => a - b);
  }

  removeNode(node) {
    for (let i = 0; i < this.#virtualNodes; i++) {
      const position = this.#hash(`${node}:${i}`);
      this.#ring.delete(position);
    }
    this.#sortedPositions = this.#sortedPositions.filter(p => this.#ring.has(p));
  }

  getNode(key) {
    if (this.#ring.size === 0) return null;

    const hash = this.#hash(key);

    // Find the first position >= hash (binary search)
    let left = 0;
    let right = this.#sortedPositions.length - 1;

    if (hash > this.#sortedPositions[right]) {
      return this.#ring.get(this.#sortedPositions[0]); // Wrap around
    }

    while (left < right) {
      const mid = (left + right) >> 1;
      if (this.#sortedPositions[mid] < hash) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return this.#ring.get(this.#sortedPositions[left]);
  }

  getDistribution(keys) {
    const counts = {};
    for (const key of keys) {
      const node = this.getNode(key);
      counts[node] = (counts[node] ?? 0) + 1;
    }
    return counts;
  }
}

// Demo consistent hashing
const ch = new ConsistentHash(100);
ch.addNode('server-A');
ch.addNode('server-B');
ch.addNode('server-C');

// Check distribution
const testKeys = Array.from({ length: 1000 }, (_, i) => `key-${i}`);
const dist = ch.getDistribution(testKeys);

console.log('\n  Key distribution across 3 nodes:');
for (const [node, count] of Object.entries(dist)) {
  console.log(`    ${node}: ${count} keys (${(count / 10).toFixed(1)}%)`);
}

assert(Object.keys(dist).length === 3, 'ConsistentHash: uses all 3 nodes');

// Test: adding a node only redistributes some keys
const before = ch.getNode('important-key');
ch.addNode('server-D');
const after = ch.getNode('important-key');
// Key may or may not move, but the system works
assert(typeof after === 'string', 'ConsistentHash: key resolves after adding node');

// ============================================================================
// 6. CACHING STRATEGIES
// ============================================================================

section('6. CACHING STRATEGIES');

const cachingStrategies = `
  Caching Patterns:
  ============================================================

  1. CACHE-ASIDE (Lazy Loading)
  -----------------------------------------------------------
  Read: App checks cache -> miss -> read DB -> write to cache
  Write: App writes to DB -> invalidate cache

  Pros: Only caches what's needed, DB is source of truth
  Cons: Cache miss penalty (3 network calls), stale data possible

  2. WRITE-THROUGH
  -----------------------------------------------------------
  Write: App writes to cache -> cache writes to DB (synchronous)
  Read: Always from cache

  Pros: Cache always consistent with DB
  Cons: Write latency (2 writes), caches data that may never be read

  3. WRITE-BEHIND (Write-Back)
  -----------------------------------------------------------
  Write: App writes to cache -> cache writes to DB (async, batched)
  Read: Always from cache

  Pros: Low write latency, batching reduces DB load
  Cons: Risk of data loss if cache fails before DB write

  4. READ-THROUGH
  -----------------------------------------------------------
  Read: App reads from cache -> cache reads from DB on miss
  The cache itself handles the DB read (unlike cache-aside where app does it)

  CACHE INVALIDATION STRATEGIES
  -----------------------------------------------------------
  - TTL (Time-To-Live): simplest, set expiry time
  - Event-based: invalidate on write events
  - Versioning: append version to cache key
  - Active invalidation: explicitly delete on update

  "There are only two hard things in CS:
   cache invalidation and naming things." - Phil Karlton
`;

console.log(cachingStrategies);

// ---------------------------------------------------------------------------
// 6a. Cache-Aside Implementation
// ---------------------------------------------------------------------------

subsection('6a. Cache-Aside Implementation');

class CacheAside {
  #cache = new Map();
  #ttls = new Map();
  #db;
  #hits = 0;
  #misses = 0;

  constructor(db) {
    this.#db = db;
  }

  async get(key) {
    // Check cache first
    if (this.#cache.has(key)) {
      const ttl = this.#ttls.get(key);
      if (!ttl || ttl > Date.now()) {
        this.#hits++;
        return this.#cache.get(key);
      }
      // TTL expired
      this.#cache.delete(key);
      this.#ttls.delete(key);
    }

    // Cache miss: read from DB
    this.#misses++;
    const value = await this.#db.get(key);

    if (value !== undefined) {
      // Populate cache
      this.#cache.set(key, value);
      this.#ttls.set(key, Date.now() + 60000); // 60 second TTL
    }

    return value;
  }

  async set(key, value) {
    // Write to DB
    await this.#db.set(key, value);
    // Invalidate cache (not write-through)
    this.#cache.delete(key);
    this.#ttls.delete(key);
  }

  get stats() {
    const total = this.#hits + this.#misses;
    return {
      hits: this.#hits,
      misses: this.#misses,
      hitRate: total > 0 ? (this.#hits / total * 100).toFixed(1) + '%' : '0%',
      cacheSize: this.#cache.size,
    };
  }
}

// Mock database
class MockDB {
  #data = new Map();
  #queryCount = 0;

  async get(key) {
    this.#queryCount++;
    // Simulate DB latency
    return this.#data.get(key);
  }

  async set(key, value) {
    this.#queryCount++;
    this.#data.set(key, value);
  }

  get queryCount() { return this.#queryCount; }
}

async function demoCacheAside() {
  const db = new MockDB();
  const cache = new CacheAside(db);

  // Seed database
  await db.set('user:1', { name: 'Alice', role: 'admin' });
  await db.set('user:2', { name: 'Bob', role: 'user' });

  // First read: cache miss
  const user1 = await cache.get('user:1');
  assert(user1?.name === 'Alice', 'CacheAside: first read from DB');

  // Second read: cache hit
  const user1Again = await cache.get('user:1');
  assert(user1Again?.name === 'Alice', 'CacheAside: second read from cache');

  // Multiple reads to build up stats
  await cache.get('user:1');
  await cache.get('user:2'); // miss
  await cache.get('user:2'); // hit

  console.log(`  Cache stats: ${JSON.stringify(cache.stats)}`);
  assert(cache.stats.hits > 0, `CacheAside: hit rate = ${cache.stats.hitRate}`);
}

// ============================================================================
// 7. MICROSERVICES PATTERNS
// ============================================================================

section('7. MICROSERVICES PATTERNS');

const microservicesPatterns = `
  Key Microservices Patterns:
  ============================================================

  SERVICE DISCOVERY
  -----------------------------------------------------------
  Problem: services need to find each other in a dynamic environment
  Solutions:
    - Client-side: service queries registry (Consul, etcd, ZooKeeper)
    - Server-side: load balancer queries registry (AWS ALB, Kubernetes)
    - DNS-based: services register DNS records

  API GATEWAY
  -----------------------------------------------------------
  Single entry point for all clients:
    - Routing: forward requests to appropriate services
    - Authentication: verify tokens before forwarding
    - Rate limiting: protect backend services
    - Response aggregation: combine multiple service responses
    - Protocol translation: REST to gRPC, etc.
  Tools: Kong, Express Gateway, AWS API Gateway, Nginx

  SAGA PATTERN (Distributed Transactions)
  -----------------------------------------------------------
  Problem: can't use ACID transactions across services

  Choreography (event-based):
    Order Service -> [OrderCreated event]
    Payment Service handles event -> [PaymentProcessed event]
    Inventory Service handles event -> [InventoryReserved event]
    Each service publishes compensation events on failure.

  Orchestration (central coordinator):
    Saga Orchestrator:
      1. Tell Order Service to create order
      2. Tell Payment Service to charge
      3. Tell Inventory to reserve
      4. If step fails, call compensating actions in reverse

  COMMUNICATION PATTERNS
  -----------------------------------------------------------
  Synchronous:
    - REST (HTTP): simple, widespread
    - gRPC: high performance, contract-first (protobuf)
    - GraphQL: flexible queries, client-driven

  Asynchronous:
    - Message Queue: point-to-point or pub/sub
    - Event Streaming: Kafka for event log
    - Webhooks: push notifications to subscribers
`;

console.log(microservicesPatterns);

// ---------------------------------------------------------------------------
// 7a. Saga Pattern (Orchestration) Implementation
// ---------------------------------------------------------------------------

subsection('7a. Saga Orchestrator');

class SagaOrchestrator {
  #steps = [];

  addStep(name, execute, compensate) {
    this.#steps.push({ name, execute, compensate });
    return this;
  }

  async run(context) {
    const completedSteps = [];
    const log = [];

    try {
      for (const step of this.#steps) {
        log.push(`Executing: ${step.name}`);
        await step.execute(context);
        completedSteps.push(step);
        log.push(`Completed: ${step.name}`);
      }

      return { success: true, log };
    } catch (error) {
      log.push(`FAILED: ${error.message}`);

      // Compensate in reverse order
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        const step = completedSteps[i];
        try {
          log.push(`Compensating: ${step.name}`);
          await step.compensate(context);
          log.push(`Compensated: ${step.name}`);
        } catch (compError) {
          log.push(`COMPENSATION FAILED: ${step.name} - ${compError.message}`);
        }
      }

      return { success: false, error: error.message, log };
    }
  }
}

async function demoSaga() {
  // Successful saga
  const orderSaga = new SagaOrchestrator()
    .addStep(
      'createOrder',
      async (ctx) => { ctx.orderId = 'ORD-001'; },
      async (ctx) => { ctx.orderId = null; }
    )
    .addStep(
      'processPayment',
      async (ctx) => { ctx.paymentId = 'PAY-001'; },
      async (ctx) => { ctx.paymentId = null; /* refund */ }
    )
    .addStep(
      'reserveInventory',
      async (ctx) => { ctx.reserved = true; },
      async (ctx) => { ctx.reserved = false; /* unreserve */ }
    );

  const ctx1 = {};
  const result1 = await orderSaga.run(ctx1);
  assert(result1.success === true, 'Saga: successful execution');
  assert(ctx1.orderId === 'ORD-001', 'Saga: context updated');

  // Failed saga (payment fails)
  const failingSaga = new SagaOrchestrator()
    .addStep(
      'createOrder',
      async (ctx) => { ctx.orderId = 'ORD-002'; },
      async (ctx) => { ctx.orderCancelled = true; }
    )
    .addStep(
      'processPayment',
      async () => { throw new Error('Insufficient funds'); },
      async (ctx) => { ctx.paymentRefunded = true; }
    )
    .addStep(
      'reserveInventory',
      async (ctx) => { ctx.reserved = true; },
      async (ctx) => { ctx.reserved = false; }
    );

  const ctx2 = {};
  const result2 = await failingSaga.run(ctx2);
  assert(result2.success === false, 'Saga: detected failure');
  assert(ctx2.orderCancelled === true, 'Saga: compensating action ran');
  assert(ctx2.reserved === undefined, 'Saga: inventory step never ran');

  console.log('  Saga log:', result2.log.join(' -> '));
}

// ============================================================================
// 8. EVENT-DRIVEN ARCHITECTURE
// ============================================================================

section('8. EVENT-DRIVEN ARCHITECTURE');

const eventDrivenGuide = `
  Event-Driven Patterns:
  ============================================================

  EVENT SOURCING
  -----------------------------------------------------------
  Instead of storing current state, store a sequence of events.
  Current state is derived by replaying events.

  Example (bank account):
    Event 1: AccountCreated { balance: 0 }
    Event 2: MoneyDeposited { amount: 100 }
    Event 3: MoneyWithdrawn { amount: 30 }
    Current balance: replay -> 0 + 100 - 30 = 70

  Benefits:
    - Complete audit trail
    - Can reconstruct state at any point in time
    - Natural fit for event-driven architectures

  Drawbacks:
    - Complexity, learning curve
    - Event schema evolution is hard
    - Read performance (need snapshots)

  CQRS (Command Query Responsibility Segregation)
  -----------------------------------------------------------
  Separate read and write models:
    - Command side: handles writes (events, validations)
    - Query side: optimized read models (denormalized, indexed)

  Often combined with Event Sourcing:
    Commands -> Event Store -> Events -> Read Model projections

  Benefits:
    - Optimize reads and writes independently
    - Scale read and write sides independently
    - Different storage for each (SQL for reads, Event Store for writes)
`;

console.log(eventDrivenGuide);

// ---------------------------------------------------------------------------
// 8a. Event Sourcing Implementation
// ---------------------------------------------------------------------------

subsection('8a. Event Sourcing');

class EventStore {
  #events = new Map(); // aggregateId -> Event[]

  append(aggregateId, event) {
    if (!this.#events.has(aggregateId)) {
      this.#events.set(aggregateId, []);
    }
    const events = this.#events.get(aggregateId);
    events.push({
      ...event,
      timestamp: Date.now(),
      version: events.length + 1,
    });
  }

  getEvents(aggregateId, fromVersion = 0) {
    const events = this.#events.get(aggregateId) ?? [];
    return events.filter(e => e.version > fromVersion);
  }
}

// Bank Account aggregate using Event Sourcing
class BankAccount {
  #id;
  #balance = 0;
  #version = 0;
  #eventStore;

  constructor(id, eventStore) {
    this.#id = id;
    this.#eventStore = eventStore;
  }

  // Rebuild state from events
  static fromEvents(id, eventStore) {
    const account = new BankAccount(id, eventStore);
    const events = eventStore.getEvents(id);

    for (const event of events) {
      account.#applyEvent(event);
    }

    return account;
  }

  deposit(amount) {
    if (amount <= 0) throw new Error('Amount must be positive');

    const event = { type: 'MoneyDeposited', data: { amount } };
    this.#eventStore.append(this.#id, event);
    this.#applyEvent(event);
  }

  withdraw(amount) {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > this.#balance) throw new Error('Insufficient funds');

    const event = { type: 'MoneyWithdrawn', data: { amount } };
    this.#eventStore.append(this.#id, event);
    this.#applyEvent(event);
  }

  #applyEvent(event) {
    switch (event.type) {
      case 'AccountCreated':
        this.#balance = 0;
        break;
      case 'MoneyDeposited':
        this.#balance += event.data.amount;
        break;
      case 'MoneyWithdrawn':
        this.#balance -= event.data.amount;
        break;
    }
    this.#version++;
  }

  get balance() { return this.#balance; }
  get version() { return this.#version; }
}

function demoEventSourcing() {
  const store = new EventStore();

  // Create and use account
  store.append('acc-1', { type: 'AccountCreated', data: {} });
  const account = BankAccount.fromEvents('acc-1', store);

  account.deposit(100);
  account.deposit(50);
  account.withdraw(30);

  assert(account.balance === 120, `EventSourcing: balance = ${account.balance} (expected 120)`);

  // Rebuild from events (time travel!)
  const rebuiltAccount = BankAccount.fromEvents('acc-1', store);
  assert(rebuiltAccount.balance === 120, 'EventSourcing: rebuilt from events matches');

  // Show event history
  const events = store.getEvents('acc-1');
  console.log(`  Event history (${events.length} events):`);
  for (const event of events) {
    console.log(`    v${event.version}: ${event.type} ${JSON.stringify(event.data)}`);
  }
}

// ============================================================================
// 9. RELIABILITY PATTERNS
// ============================================================================

section('9. RELIABILITY PATTERNS');

// ---------------------------------------------------------------------------
// 9a. Circuit Breaker
// ---------------------------------------------------------------------------

subsection('9a. Circuit Breaker');

/**
 * Circuit Breaker Pattern:
 * Prevents cascading failures by stopping calls to a failing service.
 *
 * States:
 *   CLOSED -> normal operation, requests pass through
 *   OPEN -> service is failing, requests fail immediately (fast-fail)
 *   HALF_OPEN -> trial period, allow a few requests to test recovery
 *
 * Transitions:
 *   CLOSED -> OPEN: when failure threshold is exceeded
 *   OPEN -> HALF_OPEN: after timeout period
 *   HALF_OPEN -> CLOSED: if trial requests succeed
 *   HALF_OPEN -> OPEN: if trial requests fail
 */

class CircuitBreaker {
  static CLOSED = 'CLOSED';
  static OPEN = 'OPEN';
  static HALF_OPEN = 'HALF_OPEN';

  #state = CircuitBreaker.CLOSED;
  #failureCount = 0;
  #successCount = 0;
  #lastFailureTime = 0;
  #failureThreshold;
  #resetTimeout;
  #halfOpenMaxTrials;

  constructor({
    failureThreshold = 5,
    resetTimeout = 30000,    // 30 seconds before trying again
    halfOpenMaxTrials = 3,
  } = {}) {
    this.#failureThreshold = failureThreshold;
    this.#resetTimeout = resetTimeout;
    this.#halfOpenMaxTrials = halfOpenMaxTrials;
  }

  async call(fn) {
    if (this.#state === CircuitBreaker.OPEN) {
      // Check if enough time has passed to try again
      if (Date.now() - this.#lastFailureTime >= this.#resetTimeout) {
        this.#state = CircuitBreaker.HALF_OPEN;
        this.#successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - request rejected');
      }
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure();
      throw error;
    }
  }

  #onSuccess() {
    if (this.#state === CircuitBreaker.HALF_OPEN) {
      this.#successCount++;
      if (this.#successCount >= this.#halfOpenMaxTrials) {
        this.#state = CircuitBreaker.CLOSED;
        this.#failureCount = 0;
      }
    } else {
      this.#failureCount = 0; // Reset on success in CLOSED state
    }
  }

  #onFailure() {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

    if (this.#state === CircuitBreaker.HALF_OPEN) {
      this.#state = CircuitBreaker.OPEN;
    } else if (this.#failureCount >= this.#failureThreshold) {
      this.#state = CircuitBreaker.OPEN;
    }
  }

  get state() { return this.#state; }
  get failureCount() { return this.#failureCount; }
}

// Demo circuit breaker
async function demoCircuitBreaker() {
  const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 100 });

  // Simulate failures
  const failingFn = async () => { throw new Error('Service unavailable'); };
  const successFn = async () => 'OK';

  // Fail 3 times to trip the breaker
  for (let i = 0; i < 3; i++) {
    try { await breaker.call(failingFn); } catch { /* expected */ }
  }
  assert(breaker.state === CircuitBreaker.OPEN, 'CB: opens after 3 failures');

  // Next call should fail immediately (fast-fail)
  try {
    await breaker.call(successFn);
    assert(false, 'CB: should have rejected');
  } catch (e) {
    assert(e.message.includes('OPEN'), 'CB: fast-fails when open');
  }

  // Wait for reset timeout
  await new Promise(r => setTimeout(r, 150));

  // Should be HALF_OPEN now, trial requests
  const result = await breaker.call(successFn);
  assert(result === 'OK', 'CB: allows trial request in half-open');
}

// ---------------------------------------------------------------------------
// 9b. Retry with Exponential Backoff
// ---------------------------------------------------------------------------

subsection('9b. Retry with Exponential Backoff');

async function retryWithBackoff(fn, {
  maxRetries = 3,
  baseDelay = 100,
  maxDelay = 10000,
  factor = 2,
  jitter = true,
  retryOn = () => true, // Function to decide if error is retryable
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      let delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
      if (jitter) {
        delay *= 0.5 + Math.random(); // Add jitter to prevent thundering herd
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function demoRetry() {
  let attempts = 0;
  const flakeyFn = async () => {
    attempts++;
    if (attempts < 3) throw new Error('Temporary failure');
    return 'Success!';
  };

  const result = await retryWithBackoff(flakeyFn, {
    maxRetries: 5,
    baseDelay: 10,
  });

  assert(result === 'Success!', `Retry: succeeded after ${attempts} attempts`);
}

// ---------------------------------------------------------------------------
// 9c. Bulkhead Pattern
// ---------------------------------------------------------------------------

subsection('9c. Bulkhead Pattern');

/**
 * Bulkhead isolates different parts of the system so a failure in one
 * doesn't cascade to others. Named after ship bulkheads that prevent
 * a hull breach from flooding the entire ship.
 *
 * Implementation: limit concurrent requests per service/resource.
 */

class Bulkhead {
  #maxConcurrent;
  #maxQueue;
  #running = 0;
  #queue = [];
  #name;

  constructor({ maxConcurrent = 10, maxQueue = 50, name = 'default' }) {
    this.#maxConcurrent = maxConcurrent;
    this.#maxQueue = maxQueue;
    this.#name = name;
  }

  async execute(fn) {
    if (this.#running >= this.#maxConcurrent) {
      if (this.#queue.length >= this.#maxQueue) {
        throw new Error(`Bulkhead [${this.#name}]: queue is full (${this.#maxQueue})`);
      }

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

      // Dequeue next waiting request
      if (this.#queue.length > 0) {
        const { resolve } = this.#queue.shift();
        resolve();
      }
    }
  }

  get stats() {
    return {
      name: this.#name,
      running: this.#running,
      queued: this.#queue.length,
      maxConcurrent: this.#maxConcurrent,
    };
  }
}

async function demoBulkhead() {
  const paymentBulkhead = new Bulkhead({ maxConcurrent: 2, maxQueue: 2, name: 'payments' });

  // Run 4 concurrent tasks (2 will execute, 2 will queue)
  const tasks = Array.from({ length: 4 }, (_, i) =>
    paymentBulkhead.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
      return `task-${i}`;
    })
  );

  const results = await Promise.all(tasks);
  assert(results.length === 4, `Bulkhead: all ${results.length} tasks completed`);

  // Test queue overflow
  const overflowBulkhead = new Bulkhead({ maxConcurrent: 1, maxQueue: 0, name: 'tiny' });
  const blocking = overflowBulkhead.execute(() => new Promise(r => setTimeout(r, 100)));

  try {
    await overflowBulkhead.execute(() => 'should fail');
    assert(false, 'Bulkhead: should have rejected');
  } catch (e) {
    assert(e.message.includes('queue is full'), 'Bulkhead: rejects when full');
  }

  await blocking;
}

// ---------------------------------------------------------------------------
// 9d. Health Check Pattern
// ---------------------------------------------------------------------------

subsection('9d. Health Check');

class HealthChecker {
  #checks = new Map();

  register(name, checkFn) {
    this.#checks.set(name, checkFn);
  }

  async check() {
    const results = {};
    let allHealthy = true;

    for (const [name, checkFn] of this.#checks) {
      const start = Date.now();
      try {
        await checkFn();
        results[name] = {
          status: 'healthy',
          latencyMs: Date.now() - start,
        };
      } catch (error) {
        allHealthy = false;
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          latencyMs: Date.now() - start,
        };
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }
}

async function demoHealthCheck() {
  const health = new HealthChecker();

  health.register('database', async () => {
    // Simulate DB ping
    await new Promise(r => setTimeout(r, 5));
  });

  health.register('cache', async () => {
    await new Promise(r => setTimeout(r, 2));
  });

  health.register('external-api', async () => {
    throw new Error('Connection refused');
  });

  const result = await health.check();
  console.log(`  Health check: ${JSON.stringify(result, null, 2).split('\n').join('\n  ')}`);

  assert(result.status === 'unhealthy', 'HealthCheck: detects unhealthy dependency');
  assert(result.checks.database.status === 'healthy', 'HealthCheck: DB is healthy');
  assert(result.checks['external-api'].status === 'unhealthy', 'HealthCheck: API is unhealthy');
}

// ============================================================================
// 10. OBSERVABILITY
// ============================================================================

section('10. OBSERVABILITY');

const observabilityGuide = `
  The Three Pillars of Observability:
  ============================================================

  1. LOGGING
  -----------------------------------------------------------
  Structured logging (JSON) for machine-parseable logs:
    { "timestamp": "...", "level": "error", "message": "...",
      "service": "api", "requestId": "...", "userId": "..." }

  Log levels: DEBUG < INFO < WARN < ERROR < FATAL
  Best practices:
    - Always include request/correlation ID
    - Don't log sensitive data (passwords, tokens, PII)
    - Use structured format (JSON) for aggregation
    - Include context (user ID, request path, etc.)

  Tools: Winston, Pino, Bunyan (Node.js)
  Aggregation: ELK Stack, Datadog, Grafana Loki

  2. METRICS
  -----------------------------------------------------------
  Types:
    - Counter: monotonically increasing (requests_total)
    - Gauge: can go up/down (active_connections)
    - Histogram: distribution of values (request_duration_seconds)
    - Summary: similar to histogram with percentiles

  RED Method (for services):
    - Rate: requests per second
    - Errors: number of failing requests
    - Duration: latency distribution

  USE Method (for resources):
    - Utilization: % time resource is busy
    - Saturation: degree of queuing
    - Errors: error count

  Tools: Prometheus + Grafana, Datadog, AWS CloudWatch

  3. DISTRIBUTED TRACING
  -----------------------------------------------------------
  Track a request as it flows through multiple services.
  Each span represents a unit of work with timing info.

  Trace:
    [API Gateway: 100ms]
      [Auth Service: 20ms]
      [User Service: 60ms]
        [Database: 30ms]
        [Cache: 5ms]

  Key concepts:
    - Trace ID: unique per request, propagated across services
    - Span ID: unique per operation within a trace
    - Parent Span ID: links child spans to parent

  Tools: Jaeger, Zipkin, OpenTelemetry, Datadog APM
`;

console.log(observabilityGuide);

// ---------------------------------------------------------------------------
// 10a. Structured Logger Implementation
// ---------------------------------------------------------------------------

subsection('10a. Structured Logger');

class StructuredLogger {
  #serviceName;
  #defaultMeta;

  constructor(serviceName, defaultMeta = {}) {
    this.#serviceName = serviceName;
    this.#defaultMeta = defaultMeta;
  }

  #log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.#serviceName,
      message,
      ...this.#defaultMeta,
      ...meta,
    };

    // In production: write to stdout (let container platform handle routing)
    return JSON.stringify(entry);
  }

  debug(message, meta) { return this.#log('DEBUG', message, meta); }
  info(message, meta) { return this.#log('INFO', message, meta); }
  warn(message, meta) { return this.#log('WARN', message, meta); }
  error(message, meta) { return this.#log('ERROR', message, meta); }

  // Create child logger with additional context
  child(meta) {
    return new StructuredLogger(this.#serviceName, {
      ...this.#defaultMeta,
      ...meta,
    });
  }
}

const logger = new StructuredLogger('api-service', { environment: 'production' });
const requestLogger = logger.child({ requestId: 'req-abc-123', userId: 'user-42' });

const logEntry = requestLogger.info('User profile fetched', { duration: 45 });
const parsed = JSON.parse(logEntry);
assert(parsed.level === 'INFO', 'Logger: correct level');
assert(parsed.requestId === 'req-abc-123', 'Logger: includes request context');
assert(parsed.service === 'api-service', 'Logger: includes service name');

// ============================================================================
// 11. SECURITY
// ============================================================================

section('11. SECURITY');

// ---------------------------------------------------------------------------
// 11a. JWT (JSON Web Token)
// ---------------------------------------------------------------------------

subsection('11a. JWT Implementation');

/**
 * JWT Structure: header.payload.signature
 *
 * Header:  { "alg": "HS256", "typ": "JWT" }
 * Payload: { "sub": "user123", "exp": 1234567890, "iat": 1234567800 }
 * Signature: HMAC-SHA256(base64(header) + "." + base64(payload), secret)
 *
 * Security considerations:
 * - Always verify signature
 * - Check expiration (exp claim)
 * - Use HTTPS (JWT is NOT encrypted, just signed)
 * - Keep tokens short-lived (15-60 minutes)
 * - Use refresh tokens for long sessions
 * - Store in httpOnly cookies (not localStorage for XSS protection)
 */

const { createHmac } = await import('node:crypto');

class SimpleJWT {
  #secret;

  constructor(secret) {
    this.#secret = secret;
  }

  #base64UrlEncode(data) {
    return Buffer.from(JSON.stringify(data))
      .toString('base64url');
  }

  #base64UrlDecode(str) {
    return JSON.parse(Buffer.from(str, 'base64url').toString());
  }

  #sign(data) {
    return createHmac('sha256', this.#secret)
      .update(data)
      .digest('base64url');
  }

  /**
   * Create a JWT token
   */
  create(payload, { expiresInSeconds = 3600 } = {}) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const headerEncoded = this.#base64UrlEncode(header);
    const payloadEncoded = this.#base64UrlEncode(fullPayload);
    const signature = this.#sign(`${headerEncoded}.${payloadEncoded}`);

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   */
  verify(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [headerEncoded, payloadEncoded, signature] = parts;

    // Verify signature
    const expectedSignature = this.#sign(`${headerEncoded}.${payloadEncoded}`);
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const payload = this.#base64UrlDecode(payloadEncoded);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  }
}

function demoJWT() {
  const jwt = new SimpleJWT('super-secret-key-do-not-hardcode');

  // Create token
  const token = jwt.create({
    sub: 'user-123',
    role: 'admin',
    name: 'Alice',
  }, { expiresInSeconds: 3600 });

  console.log(`  JWT: ${token.slice(0, 50)}...`);

  // Verify token
  const verified = jwt.verify(token);
  assert(verified.valid === true, 'JWT: valid token verified');
  assert(verified.payload.sub === 'user-123', 'JWT: payload decoded');
  assert(verified.payload.role === 'admin', 'JWT: custom claims preserved');

  // Tampered token
  const tampered = token.slice(0, -5) + 'XXXXX';
  const tamperedResult = jwt.verify(tampered);
  assert(tamperedResult.valid === false, 'JWT: detects tampered token');

  // Expired token
  const expiredToken = jwt.create({ sub: 'user' }, { expiresInSeconds: -1 });
  const expiredResult = jwt.verify(expiredToken);
  assert(expiredResult.valid === false, 'JWT: detects expired token');
}

// ---------------------------------------------------------------------------
// 11b. OAuth2 Flow
// ---------------------------------------------------------------------------

subsection('11b. OAuth2 Flow');

const oauth2Guide = `
  OAuth2 Authorization Code Flow (most secure):
  ============================================================

  1. User clicks "Login with Google"
  2. App redirects to Google:
     GET https://accounts.google.com/oauth2/authorize?
       client_id=YOUR_CLIENT_ID&
       redirect_uri=https://yourapp.com/callback&
       response_type=code&
       scope=openid email profile&
       state=random_csrf_token

  3. User authenticates and grants permission
  4. Google redirects back:
     GET https://yourapp.com/callback?code=AUTH_CODE&state=random_csrf_token

  5. App exchanges code for tokens (server-to-server):
     POST https://oauth2.googleapis.com/token
     Body: { code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }

  6. Google returns: { access_token, refresh_token, id_token, expires_in }

  7. App uses access_token to call Google APIs
  8. When access_token expires, use refresh_token to get new one

  Key concepts:
  - access_token: short-lived (minutes), used for API calls
  - refresh_token: long-lived (days/months), used to get new access tokens
  - id_token: JWT containing user identity (OpenID Connect extension)
  - PKCE: additional security for mobile/SPA (proof key for code exchange)
`;

console.log(oauth2Guide);

// ---------------------------------------------------------------------------
// 11c. API Key Management
// ---------------------------------------------------------------------------

subsection('11c. API Key Pattern');

class APIKeyManager {
  #keys = new Map(); // hash -> { name, permissions, rateLimit, createdAt }

  #hash(key) {
    return createHmac('sha256', 'api-key-salt')
      .update(key)
      .digest('hex');
  }

  createKey(name, permissions = ['read']) {
    // Generate a random API key
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) keyBytes[i] = Math.floor(Math.random() * 256);
    const key = `sk_live_${Buffer.from(keyBytes).toString('hex')}`;

    // Store only the hash (never store raw keys)
    const hash = this.#hash(key);
    this.#keys.set(hash, {
      name,
      permissions,
      rateLimit: 1000,
      createdAt: new Date().toISOString(),
    });

    // Return the raw key ONCE (user must save it)
    return { key, name };
  }

  validateKey(key) {
    const hash = this.#hash(key);
    const keyData = this.#keys.get(hash);

    if (!keyData) {
      return { valid: false, error: 'Invalid API key' };
    }

    return {
      valid: true,
      name: keyData.name,
      permissions: keyData.permissions,
    };
  }

  revokeKey(key) {
    const hash = this.#hash(key);
    return this.#keys.delete(hash);
  }
}

function demoAPIKeys() {
  const manager = new APIKeyManager();

  const { key, name } = manager.createKey('Production App', ['read', 'write']);
  console.log(`  Created API key: ${key.slice(0, 20)}...`);

  const result = manager.validateKey(key);
  assert(result.valid === true, 'APIKey: validates correct key');
  assert(result.permissions.includes('write'), 'APIKey: returns permissions');

  const invalid = manager.validateKey('sk_live_invalid_key');
  assert(invalid.valid === false, 'APIKey: rejects invalid key');

  manager.revokeKey(key);
  const revoked = manager.validateKey(key);
  assert(revoked.valid === false, 'APIKey: revoked key is rejected');
}

// ============================================================================
// 12. SCALING PATTERNS
// ============================================================================

section('12. SCALING PATTERNS');

const scalingPatterns = `
  Scaling Strategies:
  ============================================================

  HORIZONTAL vs VERTICAL SCALING
  -----------------------------------------------------------
  Vertical (Scale Up):
    - Add more CPU/RAM/disk to existing server
    - Simple, no code changes
    - Has a ceiling (hardware limits)
    - Single point of failure

  Horizontal (Scale Out):
    - Add more servers
    - More complex (load balancing, data distribution)
    - Virtually unlimited scaling
    - Better fault tolerance

  Rule: scale vertically first (cheap, fast), then horizontally.

  DATABASE SCALING
  -----------------------------------------------------------
  1. Read Replicas: route reads to replicas, writes to primary
     When: read-heavy workload (most apps), reporting queries

  2. Connection Pooling: reuse database connections
     When: many short-lived requests (always do this in Node.js)

  3. Caching: Redis/Memcached for hot data
     When: data changes infrequently, same data read often

  4. Vertical Partitioning: split tables by columns
     When: tables have many columns, only some are accessed

  5. Horizontal Sharding: distribute rows across databases
     When: data too large for single database

  APPLICATION SCALING
  -----------------------------------------------------------
  1. Stateless services: no server-side sessions
     Store state in Redis, database, or JWT

  2. Async processing: offload heavy work to queues
     Example: image processing, email sending, reports

  3. CDN: serve static assets from edge locations
     When: global users, static content heavy

  4. Microservices: independent scaling per service
     When: different services have different scaling needs

  CONSISTENT HASHING
  -----------------------------------------------------------
  Used for distributed caches/databases.
  When a node is added/removed, only K/N keys need to be remapped
  (K = total keys, N = total nodes) vs ALL keys in modulo hashing.

  Problem with naive hash(key) % N:
    - Adding/removing server changes N, remapping nearly all keys
    - Causes cache stampede / thundering herd

  Consistent hashing:
    - Map nodes and keys to a hash ring (0 to 2^32)
    - A key maps to the first node clockwise from its hash
    - Adding/removing a node only affects its neighbors
    - Virtual nodes ensure even distribution
`;

console.log(scalingPatterns);

// ============================================================================
// 13. CAP THEOREM, BASE vs ACID
// ============================================================================

section('13. CAP THEOREM, BASE vs ACID');

const capGuide = `
  CAP Theorem:
  ============================================================
  In a distributed system, you can only guarantee TWO of three:

  C - Consistency: every read receives the most recent write
  A - Availability: every request receives a response
  P - Partition Tolerance: system works despite network failures

  In practice, you MUST handle partitions (P is not optional),
  so the real choice is: CP or AP

  CP Systems (Consistency + Partition Tolerance):
    - Sacrifice availability during partitions
    - Examples: ZooKeeper, HBase, MongoDB (default), Redis Cluster
    - When: financial data, inventory counts, leader election

  AP Systems (Availability + Partition Tolerance):
    - Sacrifice consistency during partitions (eventual consistency)
    - Examples: Cassandra, DynamoDB, CouchDB, DNS
    - When: social media feeds, shopping carts, metrics

  ACID (Traditional Databases):
  ============================================================
  A - Atomicity: all or nothing transactions
  C - Consistency: data satisfies all constraints
  I - Isolation: concurrent transactions don't interfere
  D - Durability: committed data survives crashes

  BASE (NoSQL / Distributed Systems):
  ============================================================
  BA - Basically Available: system guarantees some availability
  S  - Soft state: state may change over time without input
  E  - Eventually consistent: given enough time, reads converge

  Comparison:
  -----------------------------------------------------------
                | ACID              | BASE
  --------------|-------------------|---------------------------
  Consistency   | Strong            | Eventual
  Availability  | May sacrifice     | Prioritized
  Performance   | Lower (locking)   | Higher (no global locks)
  Scaling       | Vertical          | Horizontal
  Use case      | Financial, orders | Social, analytics, IoT
`;

console.log(capGuide);

// ============================================================================
// 14. NODE.JS SPECIFIC CONSIDERATIONS
// ============================================================================

section('14. NODE.JS SPECIFIC CONSIDERATIONS');

const nodeSpecific = `
  Node.js in System Design:
  ============================================================

  WHEN NODE.JS EXCELS
  -----------------------------------------------------------
  - Real-time applications (chat, collaboration, gaming)
  - API gateways and BFF (Backend for Frontend)
  - Streaming applications (data pipelines, media)
  - Microservices (lightweight, fast startup)
  - I/O-heavy workloads (database queries, API calls)
  - Server-Sent Events / WebSocket servers
  - Serverless functions (fast cold start)

  WHEN NOT TO USE NODE.JS
  -----------------------------------------------------------
  - CPU-intensive computation (image/video processing)
    (Unless using Worker Threads or offloading to C++ addons)
  - Heavy scientific computing (use Python/R)
  - Systems requiring strong multi-threading (use Go, Rust, Java)

  SCALING NODE.JS
  -----------------------------------------------------------
  1. cluster module: fork N workers (one per CPU core)
     - Built-in, shares server port
     - Use PM2 for production process management

  2. Worker Threads: for CPU-intensive tasks
     - Don't block the event loop
     - Share memory via SharedArrayBuffer

  3. Horizontal scaling with load balancer
     - Stateless design (use Redis for sessions)
     - Sticky sessions if needed (WebSocket)

  4. Microservices: split monolith into services
     - Each service can be scaled independently
     - Use message queues for async communication

  NODE.JS EVENT LOOP ADVANTAGES
  -----------------------------------------------------------
  In system design interviews, highlight:

  - Single-threaded event loop is actually an ADVANTAGE for I/O
  - One Node.js process can handle 10,000+ concurrent connections
    (vs. thread-per-connection model in Java/Python)
  - Lower memory footprint per connection
  - Non-blocking I/O means the process never waits idle
  - Perfect for the "C10K problem" (handling 10K+ connections)

  But explain trade-offs:
  - CPU-bound tasks block the event loop (use workers)
  - Must be careful with synchronous operations
  - Error handling is different (unhandled promise rejections)

  IMPORTANT PATTERNS FOR NODE.JS SYSTEMS
  -----------------------------------------------------------
  1. Connection pooling (database, Redis)
  2. Graceful shutdown (finish in-flight requests)
  3. Health checks (liveness + readiness)
  4. Structured logging (JSON to stdout)
  5. Circuit breakers for external services
  6. Request timeouts (never wait forever)
  7. Backpressure handling in streams
  8. Memory leak monitoring (process.memoryUsage())
`;

console.log(nodeSpecific);

// ---------------------------------------------------------------------------
// 14a. Graceful Shutdown Pattern
// ---------------------------------------------------------------------------

subsection('14a. Graceful Shutdown Pattern');

class GracefulServer {
  #isShuttingDown = false;
  #activeConnections = new Set();
  #server = null;

  constructor() {
    // In production, this would be an HTTP server
    this.#server = {
      close: (cb) => cb(),
      listening: true,
    };
  }

  async handleRequest(requestId) {
    if (this.#isShuttingDown) {
      return { status: 503, body: 'Service Unavailable (shutting down)' };
    }

    this.#activeConnections.add(requestId);

    try {
      // Simulate request processing
      await new Promise(r => setTimeout(r, 10));
      return { status: 200, body: 'OK' };
    } finally {
      this.#activeConnections.delete(requestId);
    }
  }

  async shutdown(timeoutMs = 30000) {
    this.#isShuttingDown = true;

    // 1. Stop accepting new connections
    await new Promise(resolve => this.#server.close(resolve));

    // 2. Wait for active requests to complete (with timeout)
    const deadline = Date.now() + timeoutMs;

    while (this.#activeConnections.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }

    const forced = this.#activeConnections.size > 0;

    return {
      forced,
      remainingConnections: this.#activeConnections.size,
    };
  }

  get isShuttingDown() { return this.#isShuttingDown; }
  get activeConnections() { return this.#activeConnections.size; }
}

async function demoGracefulShutdown() {
  const server = new GracefulServer();

  // Handle some requests
  const r1 = await server.handleRequest('req-1');
  assert(r1.status === 200, 'GracefulShutdown: normal request succeeds');

  // Start shutdown while a request is in-flight
  const longRequest = server.handleRequest('req-2');
  const shutdownResult = await server.shutdown(5000);

  assert(server.isShuttingDown === true, 'GracefulShutdown: is shutting down');
  assert(shutdownResult.forced === false, 'GracefulShutdown: clean shutdown');

  // New requests during shutdown are rejected
  const rejected = await server.handleRequest('req-3');
  assert(rejected.status === 503, 'GracefulShutdown: rejects new requests during shutdown');
}

// ============================================================================
// RUN ALL DEMOS
// ============================================================================

section('RUNNING ALL DEMOS');

async function runAllDemos() {
  await demoCacheAside();
  await demoSaga();
  demoEventSourcing();
  await demoCircuitBreaker();
  await demoRetry();
  await demoBulkhead();
  await demoHealthCheck();
  demoJWT();
  demoAPIKeys();
  await demoGracefulShutdown();

  // Final results
  section('RESULTS SUMMARY');
  console.log(`\n  Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
  console.log(`  ${results.failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);
}

runAllDemos().catch(console.error);
