/**
 * =============================================================================
 * FILE 12: DATA STRUCTURES AND ALGORITHMS
 * =============================================================================
 *
 * Senior Node.js Interview Prep
 * Runnable: node 12_data_structures_algorithms.js
 *
 * Topics covered:
 *   1.  Big-O notation and complexity analysis cheat sheet
 *   2.  Arrays and strings: common operations and complexities
 *   3.  Hash Maps: implementation from scratch, collision handling
 *   4.  Linked Lists: singly, doubly, operations
 *   5.  Stacks and Queues: array-based, linked-list-based
 *   6.  Trees: BST, traversals, insert, search
 *   7.  Graphs: adjacency list, BFS, DFS, cycle detection
 *   8.  Heaps: MinHeap implementation, priority queue
 *   9.  Tries: insert, search, prefix matching
 *  10.  Sorting: quicksort, mergesort
 *  11.  Binary search variations
 *  12.  Dynamic programming: top-down vs bottom-up
 */

'use strict';

// =============================================================================
// SECTION 1: BIG-O NOTATION CHEAT SHEET
// =============================================================================
//
// Big-O describes the UPPER BOUND of an algorithm's growth rate as input
// size (n) increases. We drop constants and lower-order terms.
//
// Common complexities (best to worst):
//
//   O(1)        Constant      - Hash table lookup, array index access
//   O(log n)    Logarithmic   - Binary search, balanced BST operations
//   O(n)        Linear        - Array scan, linked list traversal
//   O(n log n)  Linearithmic  - Merge sort, heap sort, efficient sorts
//   O(n^2)      Quadratic     - Nested loops, bubble/selection/insertion sort
//   O(2^n)      Exponential   - Recursive Fibonacci (naive), power set
//   O(n!)       Factorial     - Permutations, traveling salesman (brute force)
//
// Space complexity matters too:
//   - In-place algorithms use O(1) extra space
//   - Merge sort uses O(n) extra space
//   - Recursive calls use O(depth) stack space
//
// Amortized analysis:
//   - Array.push() is O(1) amortized (occasional O(n) resize)
//   - Dynamic array doubling strategy ensures amortized O(1)
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ Data Structure      │ Access │ Search │ Insert │ Delete │ Space        │
// ├──────────────────────────────────────────────────────────────────────────┤
// │ Array               │ O(1)   │ O(n)   │ O(n)   │ O(n)   │ O(n)        │
// │ Linked List         │ O(n)   │ O(n)   │ O(1)*  │ O(1)*  │ O(n)        │
// │ Hash Table          │ N/A    │ O(1)   │ O(1)   │ O(1)   │ O(n)        │
// │ BST (balanced)      │ O(logn)│ O(logn)│ O(logn)│ O(logn)│ O(n)        │
// │ BST (worst/skewed)  │ O(n)   │ O(n)   │ O(n)   │ O(n)   │ O(n)        │
// │ Min/Max Heap        │ O(1)** │ O(n)   │ O(logn)│ O(logn)│ O(n)        │
// │ Trie                │ N/A    │ O(m)   │ O(m)   │ O(m)   │ O(ALPHABET*m│
// │ Graph (adj list)    │ N/A    │ O(V+E) │ O(1)   │ O(E)   │ O(V+E)      │
// └──────────────────────────────────────────────────────────────────────────┘
// * O(1) if you have a reference to the node; O(n) to find it first
// ** O(1) for min/max only; general access is O(n)
// m = length of the key/word

// =============================================================================
// SECTION 2: ARRAYS AND STRINGS
// =============================================================================
//
// JavaScript arrays are dynamic (auto-resize). Under the hood V8 uses both
// packed SMI/double/object arrays and dictionary mode for sparse arrays.
//
// Common operations and their complexities:
//
//   arr[i]          O(1)     - Direct index access
//   arr.push(x)     O(1)*   - Amortized (may trigger resize)
//   arr.pop()       O(1)     - Remove from end
//   arr.unshift(x)  O(n)     - Insert at beginning (shifts all elements)
//   arr.shift()     O(n)     - Remove from beginning
//   arr.splice(i)   O(n)     - Insert/remove at index
//   arr.includes(x) O(n)     - Linear scan
//   arr.indexOf(x)  O(n)     - Linear scan
//   arr.sort()      O(n log n) - TimSort in V8
//   arr.slice()     O(n)     - Creates a copy
//   arr.concat()    O(n+m)   - Merges arrays

/**
 * Two Sum - classic interview problem.
 * Given an array and a target, find two indices whose values sum to target.
 *
 * Brute force: O(n^2) - nested loops
 * Optimal: O(n) time, O(n) space - hash map
 */
function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return null;
}

/**
 * Reverse a string in-place (treating it as char array).
 * O(n) time, O(1) space (two-pointer technique).
 */
function reverseString(s) {
  const arr = [...s];
  let left = 0;
  let right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    left++;
    right--;
  }
  return arr.join('');
}

/**
 * Check if a string is a palindrome.
 * O(n) time, O(1) space.
 */
function isPalindrome(s) {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let left = 0;
  let right = cleaned.length - 1;
  while (left < right) {
    if (cleaned[left] !== cleaned[right]) return false;
    left++;
    right--;
  }
  return true;
}

/**
 * Sliding window - maximum sum of k consecutive elements.
 * O(n) time, O(1) space.
 */
function maxSubarraySum(arr, k) {
  if (arr.length < k) return null;
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];
  let maxSum = windowSum;
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // slide: add new, remove old
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

// =============================================================================
// SECTION 3: HASH MAP FROM SCRATCH
// =============================================================================
//
// Hash maps provide O(1) average-case lookup, insert, and delete.
// Key components:
//   - Hash function: converts keys to bucket indices
//   - Collision resolution: chaining (linked lists) or open addressing
//   - Load factor: ratio of entries to buckets; resize when too high
//
// JavaScript's Map is a hash map. Object keys are also hashed internally.

class HashMap {
  constructor(initialCapacity = 16, loadFactorThreshold = 0.75) {
    this.capacity = initialCapacity;
    this.loadFactorThreshold = loadFactorThreshold;
    this.size = 0;
    // Each bucket is a linked list (array of [key, value] pairs for simplicity)
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
  }

  /**
   * Hash function using DJB2 algorithm.
   * Distributes keys uniformly across buckets.
   */
  _hash(key) {
    const str = String(key);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.capacity;
  }

  /**
   * Insert or update a key-value pair. O(1) average.
   */
  set(key, value) {
    // Check load factor and resize if needed
    if ((this.size + 1) / this.capacity > this.loadFactorThreshold) {
      this._resize();
    }

    const index = this._hash(key);
    const bucket = this.buckets[index];

    // Check if key already exists (collision chain traversal)
    for (const entry of bucket) {
      if (entry[0] === key) {
        entry[1] = value; // Update existing
        return;
      }
    }

    // New entry
    bucket.push([key, value]);
    this.size++;
  }

  /**
   * Retrieve a value by key. O(1) average.
   */
  get(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    for (const entry of bucket) {
      if (entry[0] === key) return entry[1];
    }
    return undefined;
  }

  /**
   * Check if a key exists. O(1) average.
   */
  has(key) {
    const index = this._hash(key);
    return this.buckets[index].some((entry) => entry[0] === key);
  }

  /**
   * Delete a key-value pair. O(1) average.
   */
  delete(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    const idx = bucket.findIndex((entry) => entry[0] === key);
    if (idx === -1) return false;
    bucket.splice(idx, 1);
    this.size--;
    return true;
  }

  /**
   * Resize the internal array when load factor is exceeded.
   * Double the capacity and rehash all entries.
   * This is why insert is O(1) AMORTIZED (occasional O(n) resize).
   */
  _resize() {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this.size = 0;

    for (const bucket of oldBuckets) {
      for (const [key, value] of bucket) {
        this.set(key, value);
      }
    }
  }

  /** Get all keys. */
  keys() {
    const result = [];
    for (const bucket of this.buckets) {
      for (const [key] of bucket) result.push(key);
    }
    return result;
  }

  /** Get all entries. */
  entries() {
    const result = [];
    for (const bucket of this.buckets) {
      for (const entry of bucket) result.push(entry);
    }
    return result;
  }
}

// =============================================================================
// SECTION 4: LINKED LISTS
// =============================================================================

class SinglyNode {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

/**
 * Singly Linked List.
 *
 * Pros over arrays: O(1) insert/delete at head; no resize needed.
 * Cons: No random access (O(n) to reach index i); extra memory for pointers.
 */
class SinglyLinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  /** Prepend to head. O(1). */
  prepend(value) {
    this.head = new SinglyNode(value, this.head);
    this.size++;
  }

  /** Append to tail. O(n) without tail pointer. */
  append(value) {
    const node = new SinglyNode(value);
    if (!this.head) {
      this.head = node;
    } else {
      let current = this.head;
      while (current.next) current = current.next;
      current.next = node;
    }
    this.size++;
  }

  /** Insert at index. O(n). */
  insertAt(index, value) {
    if (index < 0 || index > this.size) throw new Error('Index out of bounds');
    if (index === 0) return this.prepend(value);

    let current = this.head;
    for (let i = 0; i < index - 1; i++) current = current.next;
    current.next = new SinglyNode(value, current.next);
    this.size++;
  }

  /** Delete first occurrence of value. O(n). */
  delete(value) {
    if (!this.head) return false;
    if (this.head.value === value) {
      this.head = this.head.next;
      this.size--;
      return true;
    }
    let current = this.head;
    while (current.next) {
      if (current.next.value === value) {
        current.next = current.next.next;
        this.size--;
        return true;
      }
      current = current.next;
    }
    return false;
  }

  /** Search for value. O(n). */
  find(value) {
    let current = this.head;
    while (current) {
      if (current.value === value) return current;
      current = current.next;
    }
    return null;
  }

  /**
   * Reverse the list in-place. O(n) time, O(1) space.
   * Classic interview question.
   *
   *   prev -> curr -> next
   *   null <- 1 <- 2 <- 3
   */
  reverse() {
    let prev = null;
    let current = this.head;
    while (current) {
      const next = current.next;
      current.next = prev;
      prev = current;
      current = next;
    }
    this.head = prev;
  }

  /** Convert to array for display. */
  toArray() {
    const result = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  /** Detect cycle using Floyd's tortoise and hare algorithm. O(n) time, O(1) space. */
  hasCycle() {
    let slow = this.head;
    let fast = this.head;
    while (fast && fast.next) {
      slow = slow.next;
      fast = fast.next.next;
      if (slow === fast) return true;
    }
    return false;
  }

  /** Find the middle node (slow/fast pointer). O(n). */
  findMiddle() {
    let slow = this.head;
    let fast = this.head;
    while (fast && fast.next) {
      slow = slow.next;
      fast = fast.next.next;
    }
    return slow;
  }
}

/**
 * Doubly Linked List node.
 */
class DoublyNode {
  constructor(value, prev = null, next = null) {
    this.value = value;
    this.prev = prev;
    this.next = next;
  }
}

class DoublyLinkedList {
  constructor() {
    // Sentinel nodes simplify edge cases (no null checks)
    this.head = new DoublyNode(null); // dummy head
    this.tail = new DoublyNode(null); // dummy tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  /** Insert at front. O(1). */
  prepend(value) {
    const node = new DoublyNode(value, this.head, this.head.next);
    this.head.next.prev = node;
    this.head.next = node;
    this.size++;
    return node;
  }

  /** Insert at back. O(1). */
  append(value) {
    const node = new DoublyNode(value, this.tail.prev, this.tail);
    this.tail.prev.next = node;
    this.tail.prev = node;
    this.size++;
    return node;
  }

  /** Remove a specific node. O(1) if you have the reference. */
  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    this.size--;
    return node.value;
  }

  /** Remove from front. O(1). */
  popFront() {
    if (this.size === 0) throw new Error('List is empty');
    return this.removeNode(this.head.next);
  }

  /** Remove from back. O(1). */
  popBack() {
    if (this.size === 0) throw new Error('List is empty');
    return this.removeNode(this.tail.prev);
  }

  toArray() {
    const result = [];
    let current = this.head.next;
    while (current !== this.tail) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }
}

// =============================================================================
// SECTION 5: STACKS AND QUEUES
// =============================================================================

/**
 * Stack (LIFO) - array-based. All operations O(1).
 * Uses: function call stack, undo operations, expression parsing, DFS.
 */
class ArrayStack {
  constructor() { this._items = []; }
  push(item) { this._items.push(item); }
  pop() {
    if (this.isEmpty()) throw new Error('Stack underflow');
    return this._items.pop();
  }
  peek() {
    if (this.isEmpty()) throw new Error('Stack is empty');
    return this._items[this._items.length - 1];
  }
  isEmpty() { return this._items.length === 0; }
  get size() { return this._items.length; }
}

/**
 * Queue (FIFO) - linked-list-based for O(1) enqueue and dequeue.
 * Array-based queues using shift() are O(n) for dequeue.
 *
 * Uses: BFS, task scheduling, message queues, printer queues.
 */
class LinkedQueue {
  constructor() {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  /** Add to back. O(1). */
  enqueue(value) {
    const node = new SinglyNode(value);
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this._size++;
  }

  /** Remove from front. O(1). */
  dequeue() {
    if (!this.head) throw new Error('Queue is empty');
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this._size--;
    return value;
  }

  peek() {
    if (!this.head) throw new Error('Queue is empty');
    return this.head.value;
  }

  isEmpty() { return this._size === 0; }
  get size() { return this._size; }
}

/**
 * Valid Parentheses - classic stack problem.
 * O(n) time, O(n) space.
 */
function isValidParentheses(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const ch of s) {
    if ('([{'.includes(ch)) {
      stack.push(ch);
    } else if (')]}'.includes(ch)) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

// =============================================================================
// SECTION 6: TREES - BINARY SEARCH TREE
// =============================================================================
//
// BST property: left < node < right (for all nodes in subtrees)
// Balanced BST (AVL, Red-Black): O(log n) for all operations
// Unbalanced BST: O(n) worst case (degenerates to linked list)

class BSTNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null;
  }

  /** Insert a value. O(log n) average, O(n) worst. */
  insert(value) {
    const node = new BSTNode(value);
    if (!this.root) {
      this.root = node;
      return;
    }
    let current = this.root;
    while (true) {
      if (value < current.value) {
        if (!current.left) { current.left = node; return; }
        current = current.left;
      } else if (value > current.value) {
        if (!current.right) { current.right = node; return; }
        current = current.right;
      } else {
        return; // duplicates not allowed
      }
    }
  }

  /** Search for a value. O(log n) average. */
  search(value) {
    let current = this.root;
    while (current) {
      if (value === current.value) return true;
      current = value < current.value ? current.left : current.right;
    }
    return false;
  }

  /** Find minimum value. O(log n) average (go left). */
  findMin(node = this.root) {
    if (!node) return null;
    while (node.left) node = node.left;
    return node.value;
  }

  /** Find maximum value. O(log n) average (go right). */
  findMax(node = this.root) {
    if (!node) return null;
    while (node.right) node = node.right;
    return node.value;
  }

  /**
   * In-order traversal: Left, Root, Right.
   * Produces sorted output for a BST.
   */
  inOrder(node = this.root, result = []) {
    if (!node) return result;
    this.inOrder(node.left, result);
    result.push(node.value);
    this.inOrder(node.right, result);
    return result;
  }

  /**
   * Pre-order traversal: Root, Left, Right.
   * Used for serialization / tree copying.
   */
  preOrder(node = this.root, result = []) {
    if (!node) return result;
    result.push(node.value);
    this.preOrder(node.left, result);
    this.preOrder(node.right, result);
    return result;
  }

  /**
   * Post-order traversal: Left, Right, Root.
   * Used for deletion / expression evaluation.
   */
  postOrder(node = this.root, result = []) {
    if (!node) return result;
    this.postOrder(node.left, result);
    this.postOrder(node.right, result);
    result.push(node.value);
    return result;
  }

  /**
   * Level-order traversal (BFS).
   * Uses a queue. O(n) time, O(n) space.
   */
  levelOrder() {
    if (!this.root) return [];
    const result = [];
    const queue = [this.root];
    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node.value);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    return result;
  }

  /** Height of the tree. O(n). */
  height(node = this.root) {
    if (!node) return -1; // -1 so a single node has height 0
    return 1 + Math.max(this.height(node.left), this.height(node.right));
  }

  /** Check if the tree is a valid BST. O(n). */
  isValid(node = this.root, min = -Infinity, max = Infinity) {
    if (!node) return true;
    if (node.value <= min || node.value >= max) return false;
    return this.isValid(node.left, min, node.value) &&
           this.isValid(node.right, node.value, max);
  }
}

// =============================================================================
// SECTION 7: GRAPHS
// =============================================================================
//
// Representations:
//   - Adjacency List: Map<vertex, [neighbors]> - space efficient for sparse graphs
//   - Adjacency Matrix: 2D array - fast O(1) edge lookup, O(V^2) space
//
// BFS: uses queue, finds shortest path (unweighted), O(V+E)
// DFS: uses stack/recursion, used for cycle detection, topological sort, O(V+E)

class Graph {
  constructor(directed = false) {
    this.adjacencyList = new Map();
    this.directed = directed;
  }

  addVertex(vertex) {
    if (!this.adjacencyList.has(vertex)) {
      this.adjacencyList.set(vertex, []);
    }
  }

  addEdge(v1, v2, weight = 1) {
    this.addVertex(v1);
    this.addVertex(v2);
    this.adjacencyList.get(v1).push({ node: v2, weight });
    if (!this.directed) {
      this.adjacencyList.get(v2).push({ node: v1, weight });
    }
  }

  getVertices() {
    return [...this.adjacencyList.keys()];
  }

  getNeighbors(vertex) {
    return this.adjacencyList.get(vertex) || [];
  }

  /**
   * Breadth-First Search (BFS).
   * Explores all neighbors at current depth before moving deeper.
   * O(V + E) time, O(V) space.
   *
   * Use cases: shortest path (unweighted), level-order traversal,
   *            finding connected components.
   */
  bfs(start) {
    const visited = new Set();
    const result = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const vertex = queue.shift();
      result.push(vertex);

      for (const neighbor of this.getNeighbors(vertex)) {
        if (!visited.has(neighbor.node)) {
          visited.add(neighbor.node);
          queue.push(neighbor.node);
        }
      }
    }
    return result;
  }

  /**
   * Depth-First Search (DFS) - iterative.
   * Explores as deep as possible before backtracking.
   * O(V + E) time, O(V) space.
   *
   * Use cases: cycle detection, topological sort, path finding,
   *            maze solving, connected components.
   */
  dfs(start) {
    const visited = new Set();
    const result = [];
    const stack = [start];

    while (stack.length > 0) {
      const vertex = stack.pop();
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      result.push(vertex);

      // Push neighbors in reverse for consistent order
      const neighbors = this.getNeighbors(vertex);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        if (!visited.has(neighbors[i].node)) {
          stack.push(neighbors[i].node);
        }
      }
    }
    return result;
  }

  /** DFS - recursive version. */
  dfsRecursive(start, visited = new Set(), result = []) {
    visited.add(start);
    result.push(start);
    for (const neighbor of this.getNeighbors(start)) {
      if (!visited.has(neighbor.node)) {
        this.dfsRecursive(neighbor.node, visited, result);
      }
    }
    return result;
  }

  /**
   * Detect cycle in a directed graph using DFS.
   * Uses three states: WHITE (unvisited), GRAY (in progress), BLACK (done).
   * A cycle exists if we encounter a GRAY node.
   */
  hasCycleDirected() {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    for (const v of this.adjacencyList.keys()) color.set(v, WHITE);

    const dfs = (vertex) => {
      color.set(vertex, GRAY);
      for (const neighbor of this.getNeighbors(vertex)) {
        if (color.get(neighbor.node) === GRAY) return true; // back edge = cycle
        if (color.get(neighbor.node) === WHITE && dfs(neighbor.node)) return true;
      }
      color.set(vertex, BLACK);
      return false;
    };

    for (const vertex of this.adjacencyList.keys()) {
      if (color.get(vertex) === WHITE && dfs(vertex)) return true;
    }
    return false;
  }

  /**
   * Detect cycle in an undirected graph using DFS.
   */
  hasCycleUndirected() {
    const visited = new Set();

    const dfs = (vertex, parent) => {
      visited.add(vertex);
      for (const neighbor of this.getNeighbors(vertex)) {
        if (!visited.has(neighbor.node)) {
          if (dfs(neighbor.node, vertex)) return true;
        } else if (neighbor.node !== parent) {
          return true; // visited non-parent neighbor = cycle
        }
      }
      return false;
    };

    for (const vertex of this.adjacencyList.keys()) {
      if (!visited.has(vertex) && dfs(vertex, null)) return true;
    }
    return false;
  }

  /**
   * Topological sort (Kahn's algorithm, BFS-based).
   * Only works on directed acyclic graphs (DAG).
   * O(V + E).
   *
   * Use cases: task scheduling, build systems, dependency resolution.
   */
  topologicalSort() {
    const inDegree = new Map();
    for (const v of this.adjacencyList.keys()) inDegree.set(v, 0);
    for (const [, neighbors] of this.adjacencyList) {
      for (const { node } of neighbors) {
        inDegree.set(node, (inDegree.get(node) || 0) + 1);
      }
    }

    const queue = [];
    for (const [v, deg] of inDegree) {
      if (deg === 0) queue.push(v);
    }

    const result = [];
    while (queue.length > 0) {
      const v = queue.shift();
      result.push(v);
      for (const neighbor of this.getNeighbors(v)) {
        const newDeg = inDegree.get(neighbor.node) - 1;
        inDegree.set(neighbor.node, newDeg);
        if (newDeg === 0) queue.push(neighbor.node);
      }
    }

    // If result doesn't include all vertices, there's a cycle
    return result.length === this.adjacencyList.size ? result : null;
  }

  /**
   * Shortest path using BFS (unweighted).
   */
  shortestPath(start, end) {
    const visited = new Set([start]);
    const queue = [[start, [start]]];

    while (queue.length > 0) {
      const [vertex, path] = queue.shift();
      if (vertex === end) return path;
      for (const neighbor of this.getNeighbors(vertex)) {
        if (!visited.has(neighbor.node)) {
          visited.add(neighbor.node);
          queue.push([neighbor.node, [...path, neighbor.node]]);
        }
      }
    }
    return null; // no path found
  }
}

// =============================================================================
// SECTION 8: HEAP / PRIORITY QUEUE
// =============================================================================
//
// A heap is a complete binary tree where each parent is smaller (min-heap)
// or larger (max-heap) than its children.
//
// Stored as an array:
//   parent(i) = Math.floor((i - 1) / 2)
//   left(i)   = 2 * i + 1
//   right(i)  = 2 * i + 2
//
// Operations:
//   insert: O(log n) - add to end, bubble up
//   extractMin/Max: O(log n) - remove root, bubble down
//   peek: O(1)
//   heapify (build heap): O(n) - bottom-up

class MinHeap {
  constructor() {
    this.heap = [];
  }

  get size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i) { return 2 * i + 1; }
  _right(i) { return 2 * i + 2; }

  _swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /** Peek at the minimum element. O(1). */
  peek() {
    if (this.isEmpty()) throw new Error('Heap is empty');
    return this.heap[0];
  }

  /** Insert a value. O(log n). */
  insert(value) {
    this.heap.push(value);
    this._bubbleUp(this.heap.length - 1);
  }

  /** Remove and return the minimum element. O(log n). */
  extractMin() {
    if (this.isEmpty()) throw new Error('Heap is empty');
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._bubbleDown(0);
    }
    return min;
  }

  /** Bubble up after insertion. */
  _bubbleUp(i) {
    while (i > 0 && this.heap[i] < this.heap[this._parent(i)]) {
      this._swap(i, this._parent(i));
      i = this._parent(i);
    }
  }

  /** Bubble down after extraction (heapify). */
  _bubbleDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = this._left(i);
      const right = this._right(i);

      if (left < n && this.heap[left] < this.heap[smallest]) smallest = left;
      if (right < n && this.heap[right] < this.heap[smallest]) smallest = right;

      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  /** Build a heap from an array. O(n) (not O(n log n)!). */
  static fromArray(arr) {
    const heap = new MinHeap();
    heap.heap = [...arr];
    // Start from last non-leaf and heapify down
    for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i--) {
      heap._bubbleDown(i);
    }
    return heap;
  }

  /** Heap sort: O(n log n) time, O(n) space. */
  static heapSort(arr) {
    const heap = MinHeap.fromArray(arr);
    const sorted = [];
    while (!heap.isEmpty()) {
      sorted.push(heap.extractMin());
    }
    return sorted;
  }
}

/**
 * Priority Queue using MinHeap.
 * Stores [priority, value] pairs.
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  get size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i) { return 2 * i + 1; }
  _right(i) { return 2 * i + 2; }
  _swap(i, j) { [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]; }

  enqueue(value, priority) {
    this.heap.push({ value, priority });
    let i = this.heap.length - 1;
    while (i > 0 && this.heap[i].priority < this.heap[this._parent(i)].priority) {
      this._swap(i, this._parent(i));
      i = this._parent(i);
    }
  }

  dequeue() {
    if (this.isEmpty()) throw new Error('Queue is empty');
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = this._left(i), r = this._right(i);
        if (l < this.heap.length && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
        if (r < this.heap.length && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
        if (smallest === i) break;
        this._swap(i, smallest);
        i = smallest;
      }
    }
    return min;
  }
}

// =============================================================================
// SECTION 9: TRIE (PREFIX TREE)
// =============================================================================
//
// A trie stores strings character by character. Each node has up to
// ALPHABET_SIZE children. Excellent for:
//   - Autocomplete / prefix matching
//   - Spell checking
//   - IP routing tables
//
// Time: O(m) for insert/search/prefix, where m = word length
// Space: O(ALPHABET_SIZE * m * n) for n words

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.count = 0; // How many words pass through this node
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /** Insert a word. O(m). */
  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch);
      node.count++;
    }
    node.isEndOfWord = true;
  }

  /** Search for an exact word. O(m). */
  search(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) return false;
      node = node.children.get(ch);
    }
    return node.isEndOfWord;
  }

  /** Check if any word starts with the given prefix. O(m). */
  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return false;
      node = node.children.get(ch);
    }
    return true;
  }

  /**
   * Find all words with the given prefix (autocomplete).
   * O(m + k) where k is total characters in matching words.
   */
  autocomplete(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch);
    }

    // DFS from this node to collect all words
    const results = [];
    const dfs = (currentNode, currentWord) => {
      if (currentNode.isEndOfWord) results.push(currentWord);
      for (const [ch, child] of currentNode.children) {
        dfs(child, currentWord + ch);
      }
    };
    dfs(node, prefix);
    return results;
  }

  /** Count words with given prefix. O(m). */
  countWordsWithPrefix(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return 0;
      node = node.children.get(ch);
    }
    return node.count;
  }
}

// =============================================================================
// SECTION 10: SORTING ALGORITHMS
// =============================================================================

/**
 * Merge Sort - O(n log n) time, O(n) space. STABLE.
 *
 * Divide and conquer:
 *   1. Split array in half
 *   2. Recursively sort each half
 *   3. Merge the two sorted halves
 *
 * Always O(n log n) regardless of input (no worst case degradation).
 */
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  // Remaining elements
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}

/**
 * Quick Sort - O(n log n) average, O(n^2) worst. NOT STABLE (in-place version).
 *
 * Divide and conquer:
 *   1. Choose a pivot element
 *   2. Partition: elements < pivot go left, elements > pivot go right
 *   3. Recursively sort left and right
 *
 * V8's Array.sort() uses TimSort (hybrid merge/insertion sort).
 */
function quickSort(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIdx = partition(arr, low, high);
    quickSort(arr, low, pivotIdx - 1);
    quickSort(arr, pivotIdx + 1, high);
  }
  return arr;
}

function partition(arr, low, high) {
  // Median-of-three pivot selection (reduces worst-case probability)
  const mid = Math.floor((low + high) / 2);
  if (arr[mid] < arr[low]) [arr[low], arr[mid]] = [arr[mid], arr[low]];
  if (arr[high] < arr[low]) [arr[low], arr[high]] = [arr[high], arr[low]];
  if (arr[mid] < arr[high]) [arr[mid], arr[high]] = [arr[high], arr[mid]];
  const pivot = arr[high]; // pivot is now median

  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}

// =============================================================================
// SECTION 11: BINARY SEARCH VARIATIONS
// =============================================================================
//
// Binary search works on SORTED arrays. O(log n) time.
// Key insight: eliminate half the search space on each step.

/**
 * Classic binary search. Returns index of target, or -1.
 */
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2); // avoid overflow
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

/**
 * Find the leftmost (first) occurrence of target.
 * Useful when duplicates exist.
 */
function lowerBound(arr, target) {
  let left = 0;
  let right = arr.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] < target) left = mid + 1;
    else right = mid;
  }
  return left < arr.length && arr[left] === target ? left : -1;
}

/**
 * Find the rightmost (last) occurrence of target.
 */
function upperBound(arr, target) {
  let left = 0;
  let right = arr.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] <= target) left = mid + 1;
    else right = mid;
  }
  return left > 0 && arr[left - 1] === target ? left - 1 : -1;
}

/**
 * Search in a rotated sorted array.
 * [4,5,6,7,0,1,2] - find target in O(log n).
 */
function searchRotated(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) return mid;

    // Determine which half is sorted
    if (arr[left] <= arr[mid]) {
      // Left half is sorted
      if (target >= arr[left] && target < arr[mid]) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    } else {
      // Right half is sorted
      if (target > arr[mid] && target <= arr[right]) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }
  return -1;
}

/**
 * Find peak element. An element is a peak if it's greater than its neighbors.
 * O(log n) using binary search.
 */
function findPeakElement(arr) {
  let left = 0;
  let right = arr.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] < arr[mid + 1]) {
      left = mid + 1; // peak is in right half
    } else {
      right = mid; // peak is in left half (including mid)
    }
  }
  return left;
}

// =============================================================================
// SECTION 12: DYNAMIC PROGRAMMING
// =============================================================================
//
// DP solves problems by breaking them into overlapping subproblems and
// storing results to avoid redundant computation.
//
// Two approaches:
//   Top-down (memoization): recursive with cache
//   Bottom-up (tabulation): iterative, fill table from base case up
//
// Steps to solve DP problems:
//   1. Define the state (what are the subproblems?)
//   2. Define the recurrence relation (how do subproblems relate?)
//   3. Identify base cases
//   4. Determine traversal order (bottom-up) or use memoization (top-down)
//   5. Optimize space if possible

/**
 * Fibonacci - classic DP example.
 */

// Naive recursive: O(2^n) time, O(n) stack space. DON'T DO THIS.
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// Top-down with memoization: O(n) time, O(n) space.
function fibMemo(n, memo = new Map()) {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n);
  const result = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, result);
  return result;
}

// Bottom-up tabulation: O(n) time, O(n) space.
function fibBottomUp(n) {
  if (n <= 1) return n;
  const dp = new Array(n + 1);
  dp[0] = 0;
  dp[1] = 1;
  for (let i = 2; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp[n];
}

// Space-optimized bottom-up: O(n) time, O(1) space.
function fibOptimized(n) {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}

/**
 * Climbing Stairs (LeetCode 70).
 * You can climb 1 or 2 steps. How many distinct ways to reach step n?
 * Same as Fibonacci! dp[i] = dp[i-1] + dp[i-2]
 */
function climbStairs(n) {
  if (n <= 2) return n;
  let prev2 = 1, prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}

/**
 * Coin Change (LeetCode 322).
 * Given coin denominations and an amount, find the minimum number of coins.
 *
 * State: dp[amount] = minimum coins to make that amount
 * Recurrence: dp[amount] = min(dp[amount - coin] + 1) for each coin
 * Base case: dp[0] = 0
 *
 * O(amount * coins.length) time, O(amount) space.
 */
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] !== Infinity) {
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}

/**
 * Longest Common Subsequence (LCS).
 *
 * State: dp[i][j] = length of LCS of s1[0..i-1] and s2[0..j-1]
 * Recurrence:
 *   if s1[i-1] === s2[j-1]: dp[i][j] = dp[i-1][j-1] + 1
 *   else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])
 *
 * O(m*n) time and space.
 */
function longestCommonSubsequence(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 0/1 Knapsack.
 *
 * Given items with weights and values, and a capacity W,
 * maximize the total value without exceeding W.
 *
 * dp[i][w] = max value using first i items with capacity w
 *   don't take: dp[i-1][w]
 *   take: dp[i-1][w - weight[i]] + value[i]  (if weight[i] <= w)
 *   dp[i][w] = max(don't take, take)
 *
 * O(n * W) time and space.
 */
function knapsack(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w]; // don't take item i
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  return dp[n][capacity];
}

/**
 * Maximum Subarray Sum (Kadane's Algorithm).
 * O(n) time, O(1) space.
 *
 * Not strictly DP, but uses the same principle of optimal substructure:
 * dp[i] = max(nums[i], dp[i-1] + nums[i])
 */
function maxSubarrayKadane(nums) {
  let maxSoFar = nums[0];
  let maxEndingHere = nums[0];

  for (let i = 1; i < nums.length; i++) {
    maxEndingHere = Math.max(nums[i], maxEndingHere + nums[i]);
    maxSoFar = Math.max(maxSoFar, maxEndingHere);
  }
  return maxSoFar;
}

// =============================================================================
// DEMO / TESTS
// =============================================================================

function main() {
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

  function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  // ── DEMO 1: Arrays and Strings ─────────────────────────────────────────
  console.log('\n=== DEMO 1: Arrays and Strings ===');
  {
    // Two Sum
    assert(arraysEqual(twoSum([2, 7, 11, 15], 9), [0, 1]), 'Two Sum: [2,7] -> [0,1]');
    assert(arraysEqual(twoSum([3, 2, 4], 6), [1, 2]), 'Two Sum: [3,2,4] -> [1,2]');
    assert(twoSum([1, 2, 3], 10) === null, 'Two Sum: no solution');

    // Reverse String
    assert(reverseString('hello') === 'olleh', 'Reverse string');
    assert(reverseString('') === '', 'Reverse empty string');

    // Palindrome
    assert(isPalindrome('racecar') === true, 'Palindrome: racecar');
    assert(isPalindrome('A man, a plan, a canal: Panama') === true, 'Palindrome with spaces');
    assert(isPalindrome('hello') === false, 'Not palindrome: hello');

    // Sliding window
    assert(maxSubarraySum([2, 1, 5, 1, 3, 2], 3) === 9, 'Max subarray sum k=3');

    console.log(`  All array/string checks passed`);
  }

  // ── DEMO 2: HashMap ────────────────────────────────────────────────────
  console.log('\n=== DEMO 2: HashMap ===');
  {
    const map = new HashMap();
    map.set('name', 'Alice');
    map.set('age', 30);
    map.set('city', 'NYC');

    assert(map.get('name') === 'Alice', 'HashMap get');
    assert(map.get('age') === 30, 'HashMap get number');
    assert(map.has('city') === true, 'HashMap has');
    assert(map.size === 3, 'HashMap size');

    map.set('name', 'Bob'); // update
    assert(map.get('name') === 'Bob', 'HashMap update');
    assert(map.size === 3, 'Size unchanged after update');

    map.delete('age');
    assert(map.get('age') === undefined, 'HashMap delete');
    assert(map.size === 2, 'Size after delete');

    // Test collision handling (many keys)
    for (let i = 0; i < 50; i++) map.set(`key_${i}`, i);
    assert(map.get('key_25') === 25, 'HashMap handles many entries');
    assert(map.capacity > 16, 'HashMap resized');
    console.log(`  HashMap capacity: ${map.capacity}, size: ${map.size}`);
  }

  // ── DEMO 3: Linked Lists ───────────────────────────────────────────────
  console.log('\n=== DEMO 3: Linked Lists ===');
  {
    // Singly Linked List
    const sll = new SinglyLinkedList();
    sll.append(1);
    sll.append(2);
    sll.append(3);
    sll.prepend(0);
    assert(arraysEqual(sll.toArray(), [0, 1, 2, 3]), 'SLL: prepend + append');

    sll.delete(2);
    assert(arraysEqual(sll.toArray(), [0, 1, 3]), 'SLL: delete');

    sll.reverse();
    assert(arraysEqual(sll.toArray(), [3, 1, 0]), 'SLL: reverse');

    const mid = sll.findMiddle();
    assert(mid.value === 1, 'SLL: find middle');

    assert(!sll.hasCycle(), 'SLL: no cycle');

    // Doubly Linked List
    const dll = new DoublyLinkedList();
    dll.append(1);
    dll.append(2);
    dll.prepend(0);
    assert(arraysEqual(dll.toArray(), [0, 1, 2]), 'DLL: prepend + append');

    dll.popFront();
    assert(arraysEqual(dll.toArray(), [1, 2]), 'DLL: popFront');

    dll.popBack();
    assert(arraysEqual(dll.toArray(), [1]), 'DLL: popBack');

    console.log(`  Linked list operations passed`);
  }

  // ── DEMO 4: Stack and Queue ────────────────────────────────────────────
  console.log('\n=== DEMO 4: Stack and Queue ===');
  {
    const stack = new ArrayStack();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    assert(stack.pop() === 3, 'Stack: LIFO pop');
    assert(stack.peek() === 2, 'Stack: peek');
    assert(stack.size === 2, 'Stack: size');

    const queue = new LinkedQueue();
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');
    assert(queue.dequeue() === 'a', 'Queue: FIFO dequeue');
    assert(queue.peek() === 'b', 'Queue: peek');
    assert(queue.size === 2, 'Queue: size');

    // Valid parentheses
    assert(isValidParentheses('()[]{}') === true, 'Valid parens: ()[]{}');
    assert(isValidParentheses('([{}])') === true, 'Valid parens: nested');
    assert(isValidParentheses('([)]') === false, 'Invalid parens: ([)]');
    assert(isValidParentheses('(') === false, 'Invalid parens: (');

    console.log(`  Stack and queue operations passed`);
  }

  // ── DEMO 5: Binary Search Tree ─────────────────────────────────────────
  console.log('\n=== DEMO 5: Binary Search Tree ===');
  {
    const bst = new BinarySearchTree();
    //       8
    //      / \
    //     3   10
    //    / \    \
    //   1   6   14
    //      / \  /
    //     4  7 13
    for (const v of [8, 3, 10, 1, 6, 14, 4, 7, 13]) bst.insert(v);

    assert(bst.search(6) === true, 'BST: search found');
    assert(bst.search(5) === false, 'BST: search not found');
    assert(bst.findMin() === 1, 'BST: findMin');
    assert(bst.findMax() === 14, 'BST: findMax');

    assert(arraysEqual(bst.inOrder(), [1, 3, 4, 6, 7, 8, 10, 13, 14]), 'BST: in-order (sorted)');
    assert(arraysEqual(bst.preOrder(), [8, 3, 1, 6, 4, 7, 10, 14, 13]), 'BST: pre-order');
    assert(arraysEqual(bst.postOrder(), [1, 4, 7, 6, 3, 13, 14, 10, 8]), 'BST: post-order');
    assert(arraysEqual(bst.levelOrder(), [8, 3, 10, 1, 6, 14, 4, 7, 13]), 'BST: level-order');

    assert(bst.height() === 3, 'BST: height');
    assert(bst.isValid() === true, 'BST: is valid');

    console.log(`  In-order: [${bst.inOrder().join(', ')}]`);
    console.log(`  Level-order: [${bst.levelOrder().join(', ')}]`);
    console.log(`  Height: ${bst.height()}`);
  }

  // ── DEMO 6: Graph ──────────────────────────────────────────────────────
  console.log('\n=== DEMO 6: Graph ===');
  {
    // Undirected graph
    const g = new Graph(false);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    g.addEdge('D', 'E');
    //  A -- B
    //  |    |
    //  C -- D -- E

    const bfsResult = g.bfs('A');
    assert(bfsResult[0] === 'A', 'Graph BFS: starts at A');
    assert(bfsResult.length === 5, 'Graph BFS: visits all 5 nodes');

    const dfsResult = g.dfs('A');
    assert(dfsResult[0] === 'A', 'Graph DFS: starts at A');
    assert(dfsResult.length === 5, 'Graph DFS: visits all 5 nodes');

    const path = g.shortestPath('A', 'E');
    assert(path !== null && path[0] === 'A' && path[path.length - 1] === 'E', 'Graph: shortest path');
    assert(path.length === 3, 'Graph: shortest path length (A-B-D-E or A-C-D-E)');

    assert(g.hasCycleUndirected() === true, 'Graph: cycle detected');

    console.log(`  BFS: ${bfsResult.join(' -> ')}`);
    console.log(`  DFS: ${dfsResult.join(' -> ')}`);
    console.log(`  Shortest A->E: ${path.join(' -> ')}`);

    // Directed acyclic graph (DAG) for topological sort
    const dag = new Graph(true);
    dag.addEdge('A', 'B');
    dag.addEdge('A', 'C');
    dag.addEdge('B', 'D');
    dag.addEdge('C', 'D');
    dag.addEdge('D', 'E');

    assert(!dag.hasCycleDirected(), 'DAG: no cycle');
    const topoSort = dag.topologicalSort();
    assert(topoSort !== null, 'DAG: topological sort exists');
    assert(topoSort[0] === 'A', 'DAG: A comes first');
    assert(topoSort[topoSort.length - 1] === 'E', 'DAG: E comes last');
    console.log(`  Topological sort: ${topoSort.join(' -> ')}`);

    // Directed graph with cycle
    const cyclic = new Graph(true);
    cyclic.addEdge('A', 'B');
    cyclic.addEdge('B', 'C');
    cyclic.addEdge('C', 'A'); // creates cycle
    assert(cyclic.hasCycleDirected() === true, 'Cyclic graph: cycle detected');
    assert(cyclic.topologicalSort() === null, 'Cyclic graph: no topological sort');
  }

  // ── DEMO 7: Heap / Priority Queue ──────────────────────────────────────
  console.log('\n=== DEMO 7: Heap / Priority Queue ===');
  {
    const heap = new MinHeap();
    for (const v of [5, 3, 8, 1, 4, 7, 2]) heap.insert(v);

    assert(heap.peek() === 1, 'MinHeap: peek is minimum');
    assert(heap.extractMin() === 1, 'MinHeap: extract 1');
    assert(heap.extractMin() === 2, 'MinHeap: extract 2');
    assert(heap.extractMin() === 3, 'MinHeap: extract 3');
    assert(heap.size === 4, 'MinHeap: size after 3 extractions');

    // Heap sort
    const sorted = MinHeap.heapSort([5, 3, 8, 1, 4, 7, 2, 6]);
    assert(arraysEqual(sorted, [1, 2, 3, 4, 5, 6, 7, 8]), 'Heap sort');

    // Priority Queue
    const pq = new PriorityQueue();
    pq.enqueue('Low priority task', 10);
    pq.enqueue('CRITICAL task', 1);
    pq.enqueue('Medium task', 5);

    assert(pq.dequeue().value === 'CRITICAL task', 'PQ: highest priority first');
    assert(pq.dequeue().value === 'Medium task', 'PQ: medium second');

    console.log(`  Heap sort: [${sorted.join(', ')}]`);
  }

  // ── DEMO 8: Trie ───────────────────────────────────────────────────────
  console.log('\n=== DEMO 8: Trie ===');
  {
    const trie = new Trie();
    const words = ['apple', 'app', 'application', 'apply', 'apt', 'bat', 'bath', 'band'];
    for (const w of words) trie.insert(w);

    assert(trie.search('apple') === true, 'Trie: search apple');
    assert(trie.search('app') === true, 'Trie: search app');
    assert(trie.search('ap') === false, 'Trie: search ap (prefix only)');
    assert(trie.startsWith('app') === true, 'Trie: startsWith app');
    assert(trie.startsWith('xyz') === false, 'Trie: startsWith xyz');

    const completions = trie.autocomplete('app');
    assert(completions.length === 4, 'Trie: autocomplete "app" -> 4 words');
    assert(completions.includes('apple'), 'Trie: autocomplete includes apple');
    assert(completions.includes('application'), 'Trie: autocomplete includes application');

    assert(trie.countWordsWithPrefix('ap') === 5, 'Trie: 5 words with prefix "ap"');
    assert(trie.countWordsWithPrefix('ba') === 3, 'Trie: 3 words with prefix "ba"');

    console.log(`  Autocomplete "app": [${completions.join(', ')}]`);
    console.log(`  Words with "ap": ${trie.countWordsWithPrefix('ap')}`);
  }

  // ── DEMO 9: Sorting ────────────────────────────────────────────────────
  console.log('\n=== DEMO 9: Sorting ===');
  {
    const unsorted = [38, 27, 43, 3, 9, 82, 10];

    const mergeSorted = mergeSort([...unsorted]);
    assert(arraysEqual(mergeSorted, [3, 9, 10, 27, 38, 43, 82]), 'Merge sort');

    const quickSorted = quickSort([...unsorted]);
    assert(arraysEqual(quickSorted, [3, 9, 10, 27, 38, 43, 82]), 'Quick sort');

    // Edge cases
    assert(arraysEqual(mergeSort([]), []), 'Merge sort: empty');
    assert(arraysEqual(mergeSort([1]), [1]), 'Merge sort: single');
    assert(arraysEqual(quickSort([5, 5, 5]), [5, 5, 5]), 'Quick sort: duplicates');

    console.log(`  Merge sort: [${mergeSorted.join(', ')}]`);
    console.log(`  Quick sort: [${quickSorted.join(', ')}]`);
  }

  // ── DEMO 10: Binary Search ─────────────────────────────────────────────
  console.log('\n=== DEMO 10: Binary Search ===');
  {
    const sorted = [1, 3, 5, 7, 9, 11, 13, 15];

    assert(binarySearch(sorted, 7) === 3, 'Binary search: found');
    assert(binarySearch(sorted, 6) === -1, 'Binary search: not found');
    assert(binarySearch(sorted, 1) === 0, 'Binary search: first');
    assert(binarySearch(sorted, 15) === 7, 'Binary search: last');

    // Duplicates
    const dupes = [1, 2, 2, 2, 3, 4, 5];
    assert(lowerBound(dupes, 2) === 1, 'Lower bound: first 2');
    assert(upperBound(dupes, 2) === 3, 'Upper bound: last 2');

    // Rotated array
    const rotated = [4, 5, 6, 7, 0, 1, 2];
    assert(searchRotated(rotated, 0) === 4, 'Rotated search: 0 at index 4');
    assert(searchRotated(rotated, 6) === 2, 'Rotated search: 6 at index 2');
    assert(searchRotated(rotated, 3) === -1, 'Rotated search: not found');

    // Peak element
    const peaks = [1, 3, 5, 4, 2];
    assert(findPeakElement(peaks) === 2, 'Peak element: index 2 (value 5)');

    console.log(`  Binary search, bounds, rotated, peak: all passed`);
  }

  // ── DEMO 11: Dynamic Programming ───────────────────────────────────────
  console.log('\n=== DEMO 11: Dynamic Programming ===');
  {
    // Fibonacci
    assert(fibMemo(10) === 55, 'Fibonacci memo(10) = 55');
    assert(fibBottomUp(10) === 55, 'Fibonacci bottom-up(10) = 55');
    assert(fibOptimized(10) === 55, 'Fibonacci optimized(10) = 55');
    assert(fibOptimized(50) === 12586269025, 'Fibonacci(50) large number');

    // Performance comparison
    const t1 = Date.now();
    fibMemo(35);
    const memoTime = Date.now() - t1;

    const t2 = Date.now();
    fibOptimized(35);
    const optTime = Date.now() - t2;
    console.log(`  Fib(35): memo=${memoTime}ms, optimized=${optTime}ms`);

    // Climbing stairs
    assert(climbStairs(1) === 1, 'Climb stairs(1) = 1');
    assert(climbStairs(2) === 2, 'Climb stairs(2) = 2');
    assert(climbStairs(5) === 8, 'Climb stairs(5) = 8');

    // Coin change
    assert(coinChange([1, 5, 10, 25], 30) === 2, 'Coin change: 30 = 25+5');
    assert(coinChange([2], 3) === -1, 'Coin change: impossible');
    assert(coinChange([1, 2, 5], 11) === 3, 'Coin change: 11 = 5+5+1');

    // Longest Common Subsequence
    assert(longestCommonSubsequence('abcde', 'ace') === 3, 'LCS: ace');
    assert(longestCommonSubsequence('abc', 'abc') === 3, 'LCS: identical');
    assert(longestCommonSubsequence('abc', 'def') === 0, 'LCS: none');

    // Knapsack
    assert(knapsack([2, 3, 4, 5], [3, 4, 5, 6], 8) === 10, 'Knapsack: max value 10');

    // Kadane's algorithm
    assert(maxSubarrayKadane([-2, 1, -3, 4, -1, 2, 1, -5, 4]) === 6, 'Kadane: max subarray = 6');
    assert(maxSubarrayKadane([-1]) === -1, 'Kadane: single negative');
    assert(maxSubarrayKadane([5, 4, -1, 7, 8]) === 23, 'Kadane: all positive region');

    console.log(`  Coin change [1,5,10,25] for 30: ${coinChange([1, 5, 10, 25], 30)} coins`);
    console.log(`  LCS("abcde", "ace"): ${longestCommonSubsequence('abcde', 'ace')}`);
    console.log(`  Knapsack max value: ${knapsack([2, 3, 4, 5], [3, 4, 5, 6], 8)}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main();
