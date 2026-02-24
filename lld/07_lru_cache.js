/**
 * ============================================================================
 * LOW-LEVEL DESIGN: LRU CACHE (+ LFU VARIANT)
 * ============================================================================
 *
 * Problem:
 *   Design a cache with Least Recently Used eviction, O(1) get and put,
 *   optional per-entry TTL, and cache statistics.  Also provide a simpler
 *   Map-based LRU and a Least Frequently Used (LFU) variant.
 *
 * Approach -- Classic LRU:
 *   Doubly linked list (most-recent at head, least-recent at tail) combined
 *   with a HashMap for O(1) lookup.
 *
 *   get(key)  -- look up in map, move node to head, return value   O(1)
 *   put(key)  -- insert/update node at head; if over capacity,
 *                evict tail                                        O(1)
 *
 * Approach -- Map-based LRU:
 *   JavaScript Map preserves insertion order.  On access we delete + re-insert
 *   to move the key to the end.  Eviction removes the first key.
 *
 * Approach -- LFU:
 *   HashMap + frequency buckets (Map<freq, DoublyLinkedList>).
 *   Maintains a minFreq pointer for O(1) eviction.
 *
 * Run:  node 07_lru_cache.js
 * ============================================================================
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLASSIC LRU CACHE  (Doubly Linked List + HashMap)
// ─────────────────────────────────────────────────────────────────────────────

/** Doubly-linked-list node. */
class DLLNode {
  /**
   * @param {string}  key
   * @param {*}       value
   * @param {number}  [ttl]  time-to-live in milliseconds (0 = no expiry)
   */
  constructor(key, value, ttl = 0) {
    this.key = key;
    this.value = value;
    /** @type {DLLNode | null} */
    this.prev = null;
    /** @type {DLLNode | null} */
    this.next = null;
    /** @type {number} expiry timestamp (0 means never) */
    this.expiresAt = ttl > 0 ? Date.now() + ttl : 0;
  }

  /** @returns {boolean} */
  isExpired() {
    return this.expiresAt > 0 && Date.now() > this.expiresAt;
  }
}

/**
 * LRU Cache -- O(1) get / put backed by a doubly linked list + hash map.
 */
class LRUCache {
  /**
   * @param {number} capacity  maximum number of entries
   */
  constructor(capacity) {
    if (capacity < 1) throw new RangeError('capacity must be >= 1');
    /** @type {number} */
    this.capacity = capacity;

    /** @type {Map<string, DLLNode>} */
    this._map = new Map();

    // Sentinel head/tail simplify edge-case handling.
    /** @type {DLLNode} */
    this._head = new DLLNode('__head__', null);
    /** @type {DLLNode} */
    this._tail = new DLLNode('__tail__', null);
    this._head.next = this._tail;
    this._tail.prev = this._head;

    // Stats
    this._hits = 0;
    this._misses = 0;
  }

  /** @returns {number} */
  get size() {
    return this._map.size;
  }

  // ── Internal linked-list helpers ────────────────────────────────────────

  /** Remove a node from its current position. */
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  /** Insert a node right after head (= most recently used). */
  _insertAfterHead(node) {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next.prev = node;
    this._head.next = node;
  }

  /** Move existing node to head. */
  _moveToHead(node) {
    this._remove(node);
    this._insertAfterHead(node);
  }

  /** Evict the tail node (least recently used). */
  _evictTail() {
    const lru = this._tail.prev;
    if (lru === this._head) return null; // empty
    this._remove(lru);
    this._map.delete(lru.key);
    return lru;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Retrieve a value.  Returns undefined on miss or if the entry has expired.
   * @param {string} key
   * @returns {* | undefined}
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) {
      this._misses++;
      return undefined;
    }
    if (node.isExpired()) {
      // Lazy expiry
      this._remove(node);
      this._map.delete(key);
      this._misses++;
      return undefined;
    }
    this._hits++;
    this._moveToHead(node);
    return node.value;
  }

  /**
   * Insert or update a key.
   * @param {string} key
   * @param {*}      value
   * @param {number} [ttl]  optional TTL in milliseconds
   */
  put(key, value, ttl = 0) {
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = ttl > 0 ? Date.now() + ttl : 0;
      this._moveToHead(existing);
      return;
    }

    const node = new DLLNode(key, value, ttl);
    this._map.set(key, node);
    this._insertAfterHead(node);

    if (this._map.size > this.capacity) {
      this._evictTail();
    }
  }

  /**
   * Delete a specific key.
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._remove(node);
    this._map.delete(key);
    return true;
  }

  /** Remove all entries. */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /**
   * Iterate entries from most-recent to least-recent.
   * @returns {Generator<[string, *]>}
   */
  *entries() {
    let node = this._head.next;
    while (node !== this._tail) {
      if (!node.isExpired()) {
        yield [node.key, node.value];
      }
      node = node.next;
    }
  }

  /** @returns {{ hits: number, misses: number, hitRate: string, size: number }} */
  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? '0.00%' : ((this._hits / total) * 100).toFixed(2) + '%',
      size: this.size,
    };
  }

  /** Pretty-print the cache order (head -> tail). */
  dump() {
    const items = [];
    for (const [k, v] of this.entries()) {
      items.push(`${k}=${v}`);
    }
    return `[${items.join(' -> ')}] (size=${this.size}/${this.capacity})`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MAP-BASED LRU CACHE  (Leveraging ES6 Map insertion order)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A simpler LRU implementation using the fact that Map iterates in insertion
 * order.  On access we delete + re-insert to "move to end".
 * Eviction removes the first key (oldest).
 *
 * Trade-off: slightly less efficient due to delete+insert, but much simpler.
 */
class MapLRUCache {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    /** @type {Map<string, *>} */
    this._map = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  get size() {
    return this._map.size;
  }

  /**
   * @param {string} key
   * @returns {* | undefined}
   */
  get(key) {
    if (!this._map.has(key)) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    const value = this._map.get(key);
    // Move to end (most-recent)
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  put(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    }
    this._map.set(key, value);
    if (this._map.size > this.capacity) {
      // Evict oldest (first key)
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? '0.00%' : ((this._hits / total) * 100).toFixed(2) + '%',
      size: this.size,
    };
  }

  dump() {
    const items = [...this._map.entries()].map(([k, v]) => `${k}=${v}`);
    return `[${items.join(' -> ')}] (size=${this.size}/${this.capacity})`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LFU CACHE  (Least Frequently Used)
// ─────────────────────────────────────────────────────────────────────────────

/** Node for the LFU doubly-linked list buckets. */
class LFUNode {
  /**
   * @param {string} key
   * @param {*}      value
   */
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.freq = 1;
    /** @type {LFUNode | null} */
    this.prev = null;
    /** @type {LFUNode | null} */
    this.next = null;
  }
}

/** A doubly-linked list used as a frequency bucket. */
class FrequencyList {
  constructor() {
    this.head = new LFUNode('__h__', null);
    this.tail = new LFUNode('__t__', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  /** Add node to front (most recent within this frequency). */
  addToFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
    this.size++;
  }

  /** Remove a specific node. */
  remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
    this.size--;
  }

  /** Remove and return the tail node (least recently used in this freq). */
  removeTail() {
    if (this.size === 0) return null;
    const node = this.tail.prev;
    this.remove(node);
    return node;
  }

  isEmpty() {
    return this.size === 0;
  }
}

/**
 * LFU Cache with O(1) get, put, and eviction.
 *
 * Uses frequency buckets: Map<freq, FrequencyList>.
 * Tracks a minFreq pointer to know which bucket to evict from.
 */
class LFUCache {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    /** @type {Map<string, LFUNode>} */
    this._keyMap = new Map();
    /** @type {Map<number, FrequencyList>} */
    this._freqMap = new Map();
    this._minFreq = 0;
    this._hits = 0;
    this._misses = 0;
  }

  get size() {
    return this._keyMap.size;
  }

  /** Ensure a frequency bucket exists. */
  _getOrCreateFreqList(freq) {
    if (!this._freqMap.has(freq)) {
      this._freqMap.set(freq, new FrequencyList());
    }
    return this._freqMap.get(freq);
  }

  /** Move a node from its current frequency bucket to freq+1. */
  _incrementFreq(node) {
    const oldFreq = node.freq;
    const oldList = this._freqMap.get(oldFreq);
    oldList.remove(node);

    // If the old bucket is now empty and was minFreq, bump minFreq
    if (oldList.isEmpty()) {
      this._freqMap.delete(oldFreq);
      if (this._minFreq === oldFreq) {
        this._minFreq++;
      }
    }

    node.freq++;
    const newList = this._getOrCreateFreqList(node.freq);
    newList.addToFront(node);
  }

  /**
   * @param {string} key
   * @returns {* | undefined}
   */
  get(key) {
    const node = this._keyMap.get(key);
    if (!node) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    this._incrementFreq(node);
    return node.value;
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  put(key, value) {
    if (this.capacity <= 0) return;

    const existing = this._keyMap.get(key);
    if (existing) {
      existing.value = value;
      this._incrementFreq(existing);
      return;
    }

    // Evict if at capacity
    if (this._keyMap.size >= this.capacity) {
      const minList = this._freqMap.get(this._minFreq);
      const evicted = minList.removeTail();
      if (evicted) {
        this._keyMap.delete(evicted.key);
      }
      if (minList.isEmpty()) {
        this._freqMap.delete(this._minFreq);
      }
    }

    const node = new LFUNode(key, value);
    this._keyMap.set(key, node);
    this._minFreq = 1;
    const list = this._getOrCreateFreqList(1);
    list.addToFront(node);
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? '0.00%' : ((this._hits / total) * 100).toFixed(2) + '%',
      size: this.size,
    };
  }
}

// ============================================================================
// DEMO
// ============================================================================

async function demo() {
  console.log('='.repeat(72));
  console.log(' LRU / LFU CACHE -- DEMO');
  console.log('='.repeat(72));

  // ── 1. Classic LRU ──────────────────────────────────────────────────────
  console.log('\n--- 1. Classic LRU Cache (capacity=3) ---');
  const lru = new LRUCache(3);

  lru.put('a', 1);
  lru.put('b', 2);
  lru.put('c', 3);
  console.log('After put a,b,c:', lru.dump());

  console.log('get(a):', lru.get('a')); // 1 -- moves 'a' to head
  console.log('After get(a):  ', lru.dump());

  lru.put('d', 4); // evicts 'b' (least recently used)
  console.log('After put(d):  ', lru.dump());

  console.log('get(b):', lru.get('b')); // undefined -- evicted
  console.log('Stats:', lru.stats());

  // ── 2. TTL support ─────────────────────────────────────────────────────
  console.log('\n--- 2. TTL Support ---');
  const ttlCache = new LRUCache(5);
  ttlCache.put('temp', 'expires-soon', 100); // 100ms TTL
  console.log('Immediately: get(temp) =', ttlCache.get('temp'));

  // We use a small delay to show TTL expiry
  await new Promise((resolve) => setTimeout(resolve, 150));
  console.log('After 150ms: get(temp) =', ttlCache.get('temp')); // undefined
  console.log('TTL stats:', ttlCache.stats());

  // ── 3. Map-based LRU ──────────────────────────────────────────────────
  console.log('\n--- 3. Map-Based LRU Cache (capacity=3) ---');
  const mapLru = new MapLRUCache(3);

  mapLru.put('x', 10);
  mapLru.put('y', 20);
  mapLru.put('z', 30);
  console.log('After put x,y,z:', mapLru.dump());

  mapLru.get('x'); // moves x to end
  console.log('After get(x):  ', mapLru.dump());

  mapLru.put('w', 40); // evicts 'y'
  console.log('After put(w):  ', mapLru.dump());
  console.log('get(y):', mapLru.get('y')); // undefined
  console.log('Stats:', mapLru.stats());

  // ── 4. LFU Cache ──────────────────────────────────────────────────────
  console.log('\n--- 4. LFU Cache (capacity=3) ---');
  const lfu = new LFUCache(3);

  lfu.put('a', 1);
  lfu.put('b', 2);
  lfu.put('c', 3);
  console.log('Initial: a=1, b=2, c=3');

  // Access 'a' twice, 'b' once -- frequencies: a=3, b=2, c=1
  lfu.get('a');
  lfu.get('a');
  lfu.get('b');
  console.log('After: get(a) x2, get(b) x1  =>  freq(a)=3, freq(b)=2, freq(c)=1');

  lfu.put('d', 4); // evicts 'c' (freq=1, least frequent)
  console.log('After put(d): evicts c (lowest freq)');
  console.log('  get(c):', lfu.get('c')); // undefined
  console.log('  get(a):', lfu.get('a')); // 1
  console.log('  get(d):', lfu.get('d')); // 4
  console.log('LFU stats:', lfu.stats());

  // ── 5. Larger workload with stats ─────────────────────────────────────
  console.log('\n--- 5. Workload Comparison (capacity=5, 100 operations) ---');
  const workLru = new LRUCache(5);
  const workLfu = new LFUCache(5);

  // Simulate a skewed access pattern: keys 0-2 are "hot", 3-9 are "cold"
  for (let i = 0; i < 100; i++) {
    const key =
      Math.random() < 0.7
        ? String(Math.floor(Math.random() * 3)) // hot keys 0-2
        : String(Math.floor(Math.random() * 10)); // any key 0-9

    // Alternate put and get
    if (i % 3 === 0) {
      workLru.put(key, i);
      workLfu.put(key, i);
    } else {
      workLru.get(key);
      workLfu.get(key);
    }
  }

  console.log('LRU stats:', workLru.stats());
  console.log('LFU stats:', workLfu.stats());

  // ── 6. Iteration ──────────────────────────────────────────────────────
  console.log('\n--- 6. LRU Iteration (most-recent first) ---');
  const iterCache = new LRUCache(4);
  iterCache.put('w', 'winter');
  iterCache.put('x', 'xray');
  iterCache.put('y', 'yellow');
  iterCache.put('z', 'zebra');
  iterCache.get('x'); // move x to front

  console.log('Entries (head to tail):');
  for (const [k, v] of iterCache.entries()) {
    console.log(`  ${k} = ${v}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log(' DEMO COMPLETE');
  console.log('='.repeat(72));
}

// Use top-level async wrapper for TTL demo
(async () => {
  await demo();
})();
