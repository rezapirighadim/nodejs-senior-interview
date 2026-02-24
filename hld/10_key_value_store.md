# HLD 10 -- Distributed Key-Value Store (Redis / DynamoDB)

> **Interview time budget:** 40 min total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## 1. Clarify (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | **put(key, value)** | Store a key-value pair |
| F2 | **get(key)** | Retrieve value by key |
| F3 | **delete(key)** | Remove a key-value pair |
| F4 | **TTL support** | Automatic expiry of keys |
| F5 | **Data types** | Strings, lists, sets, sorted sets, hashes |
| F6 | **Atomic operations** | Increment, compare-and-swap, list push/pop |
| F7 | **Range queries** | For sorted sets and ordered data |
| F8 | **Pub/Sub** | Publish messages to channels (nice to have) |
| F9 | **Transactions** | Multi-key atomic operations (MULTI/EXEC) |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Throughput | **Millions of QPS** (1 M+ per cluster) |
| NF2 | Latency (p99) | **< 1 ms** for single-key ops (in-memory) |
| NF3 | Latency (p99) | **< 10 ms** for on-disk ops |
| NF4 | Availability | **99.999 %** (5 min downtime / year) |
| NF5 | Durability | Configurable: in-memory only OR persistent |
| NF6 | Consistency | Tunable: eventual to strong (quorum-based) |
| NF7 | Max key size | 512 bytes |
| NF8 | Max value size | 1 MB (soft limit), 100 MB (hard limit) |
| NF9 | Cluster size | Up to 1000 nodes |

### CAP Theorem Positioning

We design for **AP** by default (availability + partition tolerance) with tunable consistency:
- Default: eventual consistency (fast reads from any replica)
- Optional: strong consistency via quorum reads (W + R > N)
- Similar to DynamoDB's approach: choose per-request

---

## 2. Estimate (5 min)

### Cluster Sizing

| Metric | Calculation | Result |
|--------|-------------|--------|
| Target QPS | 1 M reads/s + 200 K writes/s | **1.2 M QPS** |
| Throughput per node | ~100 K ops/s (in-memory) | -- |
| Nodes for throughput | 1.2 M / 100 K | **12 data nodes** (min) |
| Data volume | 1 B keys x avg 1 KB value | **1 TB** |
| Memory per node (with replicas) | 1 TB / 12 nodes x 3 replicas | **~250 GB / node** |
| Provision | 12 data nodes x 3 replicas | **36 nodes** total |

### Storage

| Component | Calculation | Result |
|-----------|-------------|--------|
| In-memory (hot data) | 1 TB total, distributed across nodes | ~85 GB per node |
| WAL (Write-Ahead Log) | 200 K writes/s x 100 B avg x 86400 s | **~1.7 TB / day** per cluster |
| RDB snapshots | Full dump every 6 hours: 1 TB compressed | **~200 GB per snapshot** |
| On-disk (LSM / cold tier) | 10 TB for historical / spilled data | **~280 GB per node** |

### Bandwidth

| Direction | Calculation | Result |
|-----------|-------------|--------|
| Client reads | 1 M/s x 1 KB avg | **1 GB/s** |
| Client writes | 200 K/s x 1 KB avg | **200 MB/s** |
| Replication traffic | 200 K/s x 1 KB x 2 replicas | **400 MB/s** (inter-node) |
| Gossip protocol | 36 nodes x 1 msg/s x 1 KB | **~36 KB/s** (negligible) |

---

## 3. High-Level Design (15 min)

### Architecture Diagram

```
 Client (App Server / SDK)
          |
          | TCP / Binary Protocol
          v
 +-------------------+
 |   Client Router   |  -- Partition map cached locally
 |   (Smart Client)  |  -- Routes to correct node directly
 +--------+----------+
          |
          | Direct to owning node
          v
 +--------------------------------------------------+
 |              Consistent Hash Ring                 |
 |                                                    |
 |  Node A        Node B        Node C        Node D |
 |  [Shard 0-90]  [Shard 91-180] [Shard 181-270] [Shard 271-360]
 |  +----------+  +----------+  +----------+  +----------+
 |  | Leader   |  | Leader   |  | Leader   |  | Leader   |
 |  +----------+  +----------+  +----------+  +----------+
 |  | Follower1|  | Follower1|  | Follower1|  | Follower1|
 |  +----------+  +----------+  +----------+  +----------+
 |  | Follower2|  | Follower2|  | Follower2|  | Follower2|
 |  +----------+  +----------+  +----------+  +----------+
 |                                                    |
 +--------------------------------------------------+
          |                    |
          v                    v
 +-------------------+  +-------------------+
 | Gossip Protocol   |  | Cluster Manager   |
 | (Failure detect,  |  | (Node join/leave, |
 |  membership)      |  |  rebalancing)     |
 +-------------------+  +-------------------+

 Per-Node Storage Engine:
 +--------------------------------------------------+
 |  Incoming Write                                    |
 |       |                                            |
 |       v                                            |
 |  +---------+     +-----------+                     |
 |  |   WAL   |---->| MemTable  |  (in-memory sorted) |
 |  | (Append |     | (Red-Black|                     |
 |  |  Only)  |     |  Tree)    |                     |
 |  +---------+     +-----+-----+                     |
 |                        |  Flush when full           |
 |                        v                            |
 |                  +-----------+                      |
 |                  | SSTable 0 | (immutable, sorted)  |
 |                  +-----------+                      |
 |                  | SSTable 1 |                      |
 |                  +-----------+                      |
 |                  | SSTable N |                      |
 |                  +-----------+                      |
 |                        |  Compaction                |
 |                        v                            |
 |                  +-----------+                      |
 |                  | Merged    |                      |
 |                  | SSTables  |                      |
 |                  +-----------+                      |
 +--------------------------------------------------+
```

### API Design (Wire Protocol)

```
# Binary protocol frame:
+--------+--------+--------+----------+--------+
| Magic  | OpCode | KeyLen | ValueLen | Flags  |
| 2B     | 1B     | 2B     | 4B       | 1B     |
+--------+--------+--------+----------+--------+
| Key (variable)  | Value (variable)            |
+-----------------+-----------------------------+

# Operations (also exposed via Redis-compatible text protocol):

# Strings
SET key value [EX seconds] [NX|XX]
GET key
INCR key
MGET key1 key2 key3

# Lists
LPUSH key value1 value2
RPOP key
LRANGE key start stop

# Sets
SADD key member1 member2
SMEMBERS key
SINTER key1 key2

# Sorted Sets
ZADD key score1 member1 score2 member2
ZRANGE key start stop [BYSCORE min max]
ZRANK key member

# Hashes
HSET key field1 value1 field2 value2
HGET key field
HGETALL key

# Cluster
CLUSTER INFO
CLUSTER NODES
CLUSTER SLOTS
```

### Data Structures (Internal Representation)

```typescript
// Internal value encoding
enum DataType {
  STRING = 0,
  LIST = 1,       // Doubly-linked list (or ziplist for small lists)
  SET = 2,        // Hash table (or intset for small integer sets)
  SORTED_SET = 3, // Skip list + hash table
  HASH = 4,       // Hash table (or ziplist for small hashes)
}

interface Entry {
  key: Buffer;
  type: DataType;
  value: Buffer | LinkedList | HashTable | SkipList;
  ttl: number | null;       // Unix timestamp of expiration
  version: VectorClock;     // For conflict resolution
  lastModified: number;     // Unix timestamp
  sizeBytes: number;        // For memory management
}

// Vector clock for conflict resolution
interface VectorClock {
  counters: Map<string, number>;  // nodeId -> counter
}
```

### Database Schema (Cluster Metadata -- stored separately in etcd or PostgreSQL)

```sql
-- Cluster nodes
CREATE TABLE cluster_nodes (
    id              VARCHAR(40) PRIMARY KEY,  -- Node ID (SHA-1 hash)
    address         VARCHAR(255) NOT NULL,    -- host:port
    status          VARCHAR(20) DEFAULT 'active',  -- active, suspect, failed, leaving
    role            VARCHAR(20) DEFAULT 'follower', -- leader, follower
    shard_range_start INT,
    shard_range_end   INT,
    leader_of       VARCHAR(40),              -- leader node ID (if follower)
    last_heartbeat  TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ DEFAULT now()
);

-- Partition map
CREATE TABLE partition_map (
    slot            INT PRIMARY KEY,          -- 0-16383 (like Redis Cluster)
    node_id         VARCHAR(40) REFERENCES cluster_nodes(id),
    replicas        VARCHAR(40)[],            -- follower node IDs
    status          VARCHAR(20) DEFAULT 'stable', -- stable, migrating
    migration_target VARCHAR(40)              -- target node during migration
);
```

---

## 4. Deep Dive (15 min)

### Deep Dive A: Consistent Hashing and Data Partitioning

**Why consistent hashing?**

Simple modulo hashing (`hash(key) % N`) causes massive data movement when nodes are added or removed. With N=12 nodes, adding 1 node remaps ~92 % of keys. Consistent hashing limits remapping to ~1/N (8 %) of keys.

**Implementation: Virtual Nodes**

Each physical node is mapped to multiple positions (virtual nodes) on the hash ring to ensure even distribution:

```
Physical nodes: A, B, C, D
Virtual nodes (150 per physical):

Hash ring (0 to 2^32):
  |---A1---B1---C1---A2---D1---B2---C2---A3---D2---|
  0                                              2^32

Key "user:123" -> hash = 0x4F2A... -> lands between C1 and A2 -> owned by A
```

```typescript
class ConsistentHashRing {
  private ring: SortedMap<number, string> = new SortedMap(); // hash -> nodeId
  private readonly virtualNodesPerNode = 150;

  addNode(nodeId: string): string[] {
    const affectedKeys: string[] = [];
    for (let i = 0; i < this.virtualNodesPerNode; i++) {
      const virtualKey = `${nodeId}:vn${i}`;
      const hash = this.hash(virtualKey);
      this.ring.set(hash, nodeId);
    }
    return affectedKeys; // keys that need migration
  }

  removeNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodesPerNode; i++) {
      const hash = this.hash(`${nodeId}:vn${i}`);
      this.ring.delete(hash);
    }
  }

  getNode(key: string): string {
    const hash = this.hash(key);
    // Find the first node clockwise from the key's hash position
    const entry = this.ring.ceiling(hash) || this.ring.first();
    return entry.value; // nodeId
  }

  getReplicaNodes(key: string, replicaCount: number): string[] {
    const primaryHash = this.hash(key);
    const nodes: Set<string> = new Set();
    let current = this.ring.ceiling(primaryHash);

    // Walk clockwise, collecting distinct physical nodes
    while (nodes.size < replicaCount) {
      if (!current) current = this.ring.first();
      nodes.add(current.value);
      current = this.ring.higher(current.key);
    }

    return Array.from(nodes);
  }

  private hash(key: string): number {
    // Use MurmurHash3 for speed and good distribution
    return murmurhash3(key);
  }
}
```

**Slot-based partitioning (Redis Cluster approach):**

Instead of raw consistent hashing, divide the keyspace into 16,384 fixed slots:

```
Key -> CRC16(key) % 16384 -> slot number -> owning node

Slot assignment:
  Node A: slots 0-4095
  Node B: slots 4096-8191
  Node C: slots 8192-12287
  Node D: slots 12288-16383

Adding Node E (rebalance):
  Move slots 0-819 from A to E
  Move slots 4096-4915 from B to E
  Move slots 8192-9011 from C to E
  Move slots 12288-13107 from D to E
  Node E: slots [0-819, 4096-4915, 8192-9011, 12288-13107]
```

This is simpler to reason about than virtual nodes and makes migration granular (move one slot at a time).

### Deep Dive B: Storage Engine -- LSM Tree vs B-Tree

**LSM Tree (Log-Structured Merge Tree) -- Write-Optimized:**

```
Write path:
  1. Append to WAL (sequential write -- fast)
  2. Insert into MemTable (in-memory sorted tree)
  3. When MemTable is full (~64 MB), flush to disk as an SSTable
  4. Background compaction merges SSTables

Read path:
  1. Check MemTable
  2. Check Bloom filters for each SSTable level
  3. Binary search in matching SSTables
  4. Merge results across levels

                  Writes
                    |
                    v
              +-----------+
              |    WAL    |  (sequential append)
              +-----------+
                    |
                    v
              +-----------+
              | MemTable  |  (Red-Black tree, ~64 MB)
              +-----------+
                    | flush
                    v
  Level 0:  [SST-0a] [SST-0b] [SST-0c]    (overlapping ranges)
                    | compaction
                    v
  Level 1:  [SST-1a] [SST-1b] [SST-1c] [SST-1d]  (non-overlapping)
                    | compaction
                    v
  Level 2:  [SST-2a] ... [SST-2j]  (10x bigger)
                    | compaction
                    v
  Level 3:  [SST-3a] ... [SST-3z]  (10x bigger)
```

**Compaction strategies:**

| Strategy | Description | Pros | Cons |
|----------|-------------|------|------|
| **Size-Tiered** | Merge SSTables of similar size | Better write amplification | More space amplification; read performance degrades |
| **Leveled** | Each level is 10x bigger; merge into next level | Better read performance; bounded space | Higher write amplification |
| **FIFO** | Delete oldest SSTables | Simplest; good for time-series | No range queries across time |

**Write amplification analysis:**

```
Leveled compaction (worst case):
  Data written to WAL:     1x
  Data written to Level 0: 1x (MemTable flush)
  L0 -> L1 compaction:    ~10x (merge with existing L1 data)
  L1 -> L2 compaction:    ~10x
  L2 -> L3 compaction:    ~10x
  Total write amplification: ~30x

  For 200 K writes/s x 1 KB = 200 MB/s logical writes
  Actual disk writes: 200 MB/s x 30 = 6 GB/s
```

**B-Tree comparison:**

| Property | LSM Tree | B-Tree |
|----------|----------|--------|
| Write throughput | Higher (sequential I/O) | Lower (random I/O) |
| Read latency (point) | Higher (check multiple levels) | Lower (one tree traversal) |
| Write amplification | 10-30x | 2-5x |
| Read amplification | 1-5 SSTables | 1 tree walk |
| Space amplification | Higher (dead entries until compacted) | Lower (in-place updates) |
| Best for | Write-heavy (logs, time-series) | Read-heavy (OLTP) |

**Our choice:** LSM Tree for primary storage (write-heavy KV workloads), with Bloom filters to mitigate read amplification:

```
Bloom filter per SSTable:
  - 10 bits per key, 3 hash functions
  - False positive rate: ~1%
  - For a 64 MB SSTable with ~65K entries: 80 KB Bloom filter
  - Skips reading SSTable 99% of the time when key is absent
```

### Deep Dive C: Replication and Conflict Resolution

**Replication model: Leader-Follower with Quorum**

```
Write (W=2, N=3):
  Client --> Leader (Node A)
              |
              +--> Follower 1 (Node B) -- ACK
              |
              +--> Follower 2 (Node C) -- ACK
              |
              +-- Return success when 2 of 3 ACK (W=2)

Read (R=2, N=3):
  Client --> Any 2 nodes
              |
              +--> Node A: value="hello", version=(A:5, B:3)
              |
              +--> Node B: value="hello", version=(A:5, B:3)
              |
              +-- Return "hello" (consistent, both agree)

Consistency guarantee: W + R > N  =>  2 + 2 > 3  =>  Strong consistency
```

**Tunable consistency options:**

| Config | W | R | N | Consistency | Latency | Use Case |
|--------|---|---|---|-------------|---------|----------|
| Strong | 2 | 2 | 3 | Strong (W+R>N) | Higher | Financial, counters |
| Eventual | 1 | 1 | 3 | Eventual | Lowest | Caching, sessions |
| Write-safe | 3 | 1 | 3 | Strong for writes | Write is slow, read is fast | Write-once data |
| Read-safe | 1 | 3 | 3 | Strong for reads | Read is slow, write is fast | Rarely written, often read |

**Conflict resolution with vector clocks:**

When two replicas receive concurrent writes (network partition or async replication), we detect and resolve conflicts:

```typescript
class VectorClock {
  counters: Map<string, number>;  // nodeId -> logical counter

  increment(nodeId: string): VectorClock {
    const newClock = new VectorClock(new Map(this.counters));
    newClock.counters.set(nodeId, (this.counters.get(nodeId) || 0) + 1);
    return newClock;
  }

  // Returns: "before" | "after" | "concurrent" | "equal"
  compare(other: VectorClock): string {
    let thisGreater = false;
    let otherGreater = false;

    const allNodes = new Set([...this.counters.keys(), ...other.counters.keys()]);
    for (const node of allNodes) {
      const thisVal = this.counters.get(node) || 0;
      const otherVal = other.counters.get(node) || 0;
      if (thisVal > otherVal) thisGreater = true;
      if (otherVal > thisVal) otherGreater = true;
    }

    if (thisGreater && otherGreater) return "concurrent";  // CONFLICT
    if (thisGreater) return "after";
    if (otherGreater) return "before";
    return "equal";
  }

  merge(other: VectorClock): VectorClock {
    const merged = new VectorClock(new Map(this.counters));
    for (const [node, count] of other.counters) {
      merged.counters.set(node, Math.max(merged.counters.get(node) || 0, count));
    }
    return merged;
  }
}

// Conflict resolution during read-repair
function resolveConflict(versions: VersionedValue[]): VersionedValue {
  // Check if one version dominates
  for (const v of versions) {
    if (versions.every(other => {
      const cmp = v.clock.compare(other.clock);
      return cmp === "after" || cmp === "equal";
    })) {
      return v; // This version is the latest
    }
  }

  // Concurrent versions detected -- apply resolution strategy
  // Strategy 1: Last-Writer-Wins (using wall clock as tiebreaker)
  // Simple but can lose data
  return versions.reduce((a, b) => a.timestamp > b.timestamp ? a : b);

  // Strategy 2: Return all versions to client (like DynamoDB)
  // Client resolves (e.g., merge shopping carts)
  // return { values: versions, conflict: true };
}
```

**Failure detection: Gossip Protocol + Phi Accrual Detector**

```
Gossip protocol:
  Every 1 second, each node:
    1. Picks a random peer
    2. Sends its membership table: { nodeId, heartbeat, status }
    3. Peer merges with its own table (keep higher heartbeats)
    4. If a node's heartbeat hasn't increased in T seconds, mark "suspect"

Phi Accrual Failure Detector:
  Instead of binary "alive/dead", compute a suspicion level (phi):
    phi = -log10(P(heartbeat_late))

  Based on historical heartbeat inter-arrival times:
    - phi < 1:   Normal (90% chance it's alive)
    - phi = 1-3: Suspicious
    - phi > 8:   Almost certainly dead (probability 99.999999%)

  Advantage over fixed timeout:
    - Adapts to network conditions
    - Handles slow nodes (GC pauses) without false positives
    - Each node can set its own phi threshold
```

```typescript
class PhiAccrualDetector {
  private arrivalWindows: Map<string, SlidingWindow> = new Map();
  private readonly windowSize = 1000;

  recordHeartbeat(nodeId: string): void {
    const now = Date.now();
    let window = this.arrivalWindows.get(nodeId);
    if (!window) {
      window = new SlidingWindow(this.windowSize);
      this.arrivalWindows.set(nodeId, window);
    }
    window.add(now);
  }

  phi(nodeId: string): number {
    const window = this.arrivalWindows.get(nodeId);
    if (!window || window.size() < 2) return 0;

    const now = Date.now();
    const lastHeartbeat = window.latest();
    const timeSinceLast = now - lastHeartbeat;

    // Assume normal distribution of inter-arrival times
    const mean = window.mean();
    const stddev = window.stddev();

    // P(next heartbeat hasn't arrived yet given it's been timeSinceLast ms)
    const p = 1 - normalCDF(timeSinceLast, mean, stddev);

    return -Math.log10(p);
  }

  isAlive(nodeId: string, threshold: number = 8): boolean {
    return this.phi(nodeId) < threshold;
  }
}
```

---

## Trade-offs

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Partitioning | Consistent hashing (virtual nodes) | Fixed slot assignment | **Fixed slots (16384)** | Simpler to manage migrations; proven by Redis Cluster |
| Storage engine | LSM Tree | B-Tree | **LSM Tree** (default); B-Tree (read-heavy option) | KV stores are typically write-heavy; LSM has better write throughput |
| Replication | Single-leader | Multi-leader | **Single-leader** per partition | Simpler conflict resolution; multi-leader only needed for multi-DC |
| Consistency model | Strong only | Tunable | **Tunable** (quorum-based) | Different use cases need different tradeoffs |
| Conflict resolution | Last-writer-wins | Vector clocks | **Both** | LWW for simple cases; vector clocks for applications needing correctness |
| Failure detection | Fixed timeout | Phi accrual | **Phi accrual** | Fewer false positives; adapts to network conditions |
| Persistence | RDB snapshots | AOF (Append-Only File) | **Both** | RDB for fast recovery; AOF for minimal data loss (configurable) |
| Compaction | Size-tiered | Leveled | **Leveled** | Better read performance and bounded space; write amp acceptable for KV workloads |
| Network protocol | Text (Redis RESP) | Binary | **Both** | RESP for compatibility; binary for high-performance internal communication |
| Memory management | Jemalloc | System malloc | **Jemalloc** | Better fragmentation handling for KV allocation patterns |

---

## Scaling Strategy

| Component | Strategy |
|-----------|----------|
| Data nodes | Add nodes to cluster; automatic slot rebalancing moves 1/N data |
| Read scaling | Add follower replicas; route reads to followers |
| Write scaling | Add partitions (more leaders); each leader handles its slot range |
| Hot keys | Detect via metrics; replicate hot slots to more nodes; client-side caching |
| Memory pressure | Eviction policies: LRU, LFU, random, allkeys-lru |
| Cross-DC | Async replication to secondary DC; promote to primary on failover |

**Node addition process:**

```
1. New node joins cluster (gossip announces membership)
2. Cluster manager calculates new slot assignment
3. Migration begins:
   a. Source node marks slots as "migrating"
   b. Keys in migrating slots are copied to target (background)
   c. New writes to migrating slots are dual-written
   d. Once caught up, slot ownership transfers atomically
   e. Source deletes migrated data
4. Client routers update their partition map

Timeline: ~5 min for 1000 slots (depends on data volume)
```

**Persistence strategy:**

```
RDB Snapshots:
  - Full point-in-time dump every 6 hours
  - Fork process, copy-on-write for zero-downtime snapshot
  - Recovery time: ~30 s per GB (fast, load entire dataset)

AOF (Append-Only File):
  - Every write appended to log
  - fsync options: always (safest, slowest), every second (balanced), never (OS decides)
  - AOF rewrite: periodically compact the AOF to remove redundant operations

Hybrid (recommended):
  - RDB snapshots every 6 hours for fast recovery baseline
  - AOF for changes since last snapshot
  - Recovery: load RDB snapshot + replay AOF = minimal data loss
```

---

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Leader node crash | Writes to affected slots fail | Phi detector detects in ~5 s; follower promoted to leader; clients redirect via updated partition map |
| Follower node crash | Reduced read capacity for affected slots | Other followers absorb reads; replacement node joins and syncs from leader |
| Network partition (split brain) | Two leaders for same slot | Quorum prevents: minority partition rejects writes (W > N/2); use fencing tokens |
| Disk failure | Data loss for one replica | Replication ensures at least 2 other copies; replace disk, resync from healthy replica |
| Memory exhaustion (OOM) | Node crashes | Eviction policy (LRU/LFU) enforced before OOM; max-memory config; alerts at 80 % |
| Hot key (thundering herd) | One node overloaded | Detect via latency spike; replicate hot key to multiple nodes; client-side caching |
| Slow node (GC pause, disk I/O) | Increased latency for affected slots | Phi detector marks as suspect (not dead); route reads to replicas; compact/GC during off-peak |
| Full cluster rebalance | Temporary throughput reduction | Rate-limit migration bandwidth to 50 MB/s per node; prioritize serving traffic |
| Correlated failure (rack/AZ) | Multiple nodes down | Place replicas in different racks/AZs; ensure N=3 replicas span 3 failure domains |
| Clock skew | LWW conflict resolution incorrect | Use NTP with tight bounds; prefer vector clocks for critical data; hybrid logical clocks |

---

## Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Get latency (p99) | > 1 ms (in-memory), > 10 ms (on-disk) |
| Set latency (p99) | > 1 ms (in-memory), > 10 ms (on-disk) |
| Ops per second per node | > 80 % of node capacity |
| Memory usage per node | > 80 % of max-memory |
| Replication lag | > 1 s (bytes behind leader) |
| Compaction pending bytes | > 10 GB (falling behind) |
| Key eviction rate | > 1000 /s (memory pressure) |
| Gossip convergence time | > 10 s (network issues) |
| Slot migration duration | > 10 min per slot |
| Cache hit rate (client-side) | < 80 % (consider increasing cache size) |
| Connected clients | > 80 % of max connections |
| WAL size | > 10 GB (need more frequent snapshots) |
