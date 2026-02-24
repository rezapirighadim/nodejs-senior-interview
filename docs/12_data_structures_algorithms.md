# 12 - Data Structures & Algorithms

## Table of Contents

- [Big-O Notation](#big-o-notation)
- [Arrays & Strings](#arrays--strings)
- [Hash Maps](#hash-maps)
- [Linked Lists](#linked-lists)
- [Stacks & Queues](#stacks--queues)
- [Trees](#trees)
- [Graphs](#graphs)
- [Heaps & Priority Queues](#heaps--priority-queues)
- [Tries](#tries)
- [Sorting Algorithms](#sorting-algorithms)
- [Binary Search](#binary-search)
- [Dynamic Programming Basics](#dynamic-programming-basics)
- [Complexity Comparison Table](#complexity-comparison-table)
- [Interview Tips](#interview-tips)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Big-O Notation

Big-O describes the upper bound of an algorithm's growth rate as input size increases.

### Common Complexities (Fastest to Slowest)

| Big-O | Name | Example | 10 | 100 | 1,000 | 1,000,000 |
|---|---|---|---|---|---|---|
| O(1) | Constant | Hash lookup | 1 | 1 | 1 | 1 |
| O(log n) | Logarithmic | Binary search | 3 | 7 | 10 | 20 |
| O(n) | Linear | Single loop | 10 | 100 | 1,000 | 1,000,000 |
| O(n log n) | Linearithmic | Merge sort | 33 | 664 | 9,966 | 19,931,569 |
| O(n^2) | Quadratic | Nested loop | 100 | 10,000 | 1,000,000 | 10^12 |
| O(2^n) | Exponential | Subsets | 1,024 | 10^30 | too large | too large |
| O(n!) | Factorial | Permutations | 3,628,800 | too large | too large | too large |

### Rules of Thumb

1. **Drop constants:** O(2n) = O(n)
2. **Drop lower order terms:** O(n^2 + n) = O(n^2)
3. **Different inputs, different variables:** Two arrays of size m and n -> O(m + n) or O(m * n)
4. **Sequential steps add:** O(a) + O(b) = O(a + b)
5. **Nested steps multiply:** O(a) inside O(b) = O(a * b)

```javascript
// O(1) — constant
function getFirst(arr) {
  return arr[0];
}

// O(n) — linear
function findMax(arr) {
  let max = -Infinity;
  for (const num of arr) {
    if (num > max) max = num;
  }
  return max;
}

// O(n^2) — quadratic
function hasDuplicate(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
}

// O(log n) — logarithmic
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

---

## Arrays & Strings

### Key Operations & Complexity

| Operation | Array | String |
|---|---|---|
| Access by index | O(1) | O(1) |
| Search (unsorted) | O(n) | O(n) |
| Insert at end | O(1) amortized | O(n) — immutable |
| Insert at beginning | O(n) | O(n) |
| Delete | O(n) | O(n) |
| Slice | O(k) | O(k) |

### Common Techniques

```javascript
// Two pointers — reverse in place
function reverseArray(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    left++;
    right--;
  }
  return arr;
}

// Sliding window — max sum of subarray of size k
function maxSubarraySum(arr, k) {
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];

  let maxSum = windowSum;
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

// Prefix sum
function prefixSum(arr) {
  const prefix = [0];
  for (let i = 0; i < arr.length; i++) {
    prefix.push(prefix[i] + arr[i]);
  }
  // Sum of range [l, r] = prefix[r+1] - prefix[l]
  return prefix;
}

// String — check palindrome
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let left = 0, right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
}

// String — character frequency
function charFrequency(s) {
  const freq = new Map();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  return freq;
}
```

---

## Hash Maps

### How Hash Maps Work

1. A **hash function** converts the key into an integer (hash code).
2. The hash code is mapped to a bucket index: `index = hash % capacity`.
3. Collisions (multiple keys mapping to the same index) are resolved by chaining (linked list) or open addressing (probing).

### Simple Implementation

```javascript
class HashMap {
  constructor(capacity = 16) {
    this.capacity = capacity;
    this.size = 0;
    this.buckets = new Array(capacity).fill(null).map(() => []);
    this.loadFactorThreshold = 0.75;
  }

  _hash(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0; // | 0 keeps it 32-bit int
    }
    return Math.abs(hash) % this.capacity;
  }

  set(key, value) {
    if (this.size / this.capacity >= this.loadFactorThreshold) {
      this._resize();
    }

    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (const pair of bucket) {
      if (pair[0] === key) {
        pair[1] = value;
        return;
      }
    }

    bucket.push([key, value]);
    this.size++;
  }

  get(key) {
    const index = this._hash(key);
    for (const [k, v] of this.buckets[index]) {
      if (k === key) return v;
    }
    return undefined;
  }

  delete(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }
    return false;
  }

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
}
```

### Collision Resolution Strategies

| Strategy | Description | Pros | Cons |
|---|---|---|---|
| **Chaining** | Each bucket stores a linked list | Simple, handles high load | Extra memory for pointers |
| **Open Addressing (Linear Probing)** | Find next empty slot | Cache-friendly | Clustering issues |
| **Open Addressing (Quadratic)** | Probe at 1, 4, 9, 16... | Less clustering | May not find empty slot |
| **Double Hashing** | Second hash function for step size | Minimal clustering | More computation |

### JS Built-in Map vs Object

| Feature | `Map` | `Object` |
|---|---|---|
| Key types | Any (objects, functions, primitives) | String / Symbol only |
| Order | Insertion order guaranteed | Insertion order (mostly) |
| Size | `.size` property | `Object.keys(obj).length` |
| Performance | Optimized for frequent add/delete | Optimized for static shape |
| Iteration | `for...of`, `.forEach()` | `for...in`, `Object.entries()` |
| Prototype | No inherited keys | Has prototype chain |

---

## Linked Lists

### Singly Linked List

```javascript
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

class SinglyLinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  // O(1) — prepend
  prepend(val) {
    this.head = new ListNode(val, this.head);
    this.size++;
  }

  // O(n) — append
  append(val) {
    const node = new ListNode(val);
    if (!this.head) {
      this.head = node;
    } else {
      let curr = this.head;
      while (curr.next) curr = curr.next;
      curr.next = node;
    }
    this.size++;
  }

  // O(n) — delete by value
  delete(val) {
    if (!this.head) return false;
    if (this.head.val === val) {
      this.head = this.head.next;
      this.size--;
      return true;
    }
    let curr = this.head;
    while (curr.next) {
      if (curr.next.val === val) {
        curr.next = curr.next.next;
        this.size--;
        return true;
      }
      curr = curr.next;
    }
    return false;
  }

  // Reverse the list — O(n)
  reverse() {
    let prev = null;
    let curr = this.head;
    while (curr) {
      const next = curr.next;
      curr.next = prev;
      prev = curr;
      curr = next;
    }
    this.head = prev;
  }

  // Detect cycle — Floyd's algorithm — O(n)
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

  // Find middle node — O(n)
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
```

### Doubly Linked List

```javascript
class DoublyNode {
  constructor(val, prev = null, next = null) {
    this.val = val;
    this.prev = prev;
    this.next = next;
  }
}

class DoublyLinkedList {
  constructor() {
    // Sentinel nodes simplify edge cases
    this.head = new DoublyNode(null); // dummy head
    this.tail = new DoublyNode(null); // dummy tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  // O(1) — add to front
  addFirst(val) {
    const node = new DoublyNode(val, this.head, this.head.next);
    this.head.next.prev = node;
    this.head.next = node;
    this.size++;
    return node;
  }

  // O(1) — add to end
  addLast(val) {
    const node = new DoublyNode(val, this.tail.prev, this.tail);
    this.tail.prev.next = node;
    this.tail.prev = node;
    this.size++;
    return node;
  }

  // O(1) — remove a specific node (given reference)
  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    this.size--;
    return node.val;
  }

  // O(1) — remove from front
  removeFirst() {
    if (this.size === 0) return null;
    return this.removeNode(this.head.next);
  }

  // O(1) — remove from end
  removeLast() {
    if (this.size === 0) return null;
    return this.removeNode(this.tail.prev);
  }
}
```

### Linked List Complexity

| Operation | Singly | Doubly |
|---|---|---|
| Access by index | O(n) | O(n) |
| Prepend | O(1) | O(1) |
| Append | O(n) or O(1) with tail | O(1) |
| Delete (given node) | O(n) | O(1) |
| Search | O(n) | O(n) |

---

## Stacks & Queues

### Stack (LIFO)

```javascript
class Stack {
  constructor() {
    this.items = [];
  }

  push(val) { this.items.push(val); }
  pop()     { return this.items.pop(); }
  peek()    { return this.items[this.items.length - 1]; }
  isEmpty() { return this.items.length === 0; }
  get size(){ return this.items.length; }
}

// Classic problem: valid parentheses
function isValid(s) {
  const stack = [];
  const map = { ')': '(', ']': '[', '}': '{' };

  for (const ch of s) {
    if ('({['.includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.pop() !== map[ch]) return false;
    }
  }
  return stack.length === 0;
}
```

### Queue (FIFO)

```javascript
// Simple array-based queue (shift is O(n) — not ideal for large queues)
class SimpleQueue {
  constructor() { this.items = []; }
  enqueue(val)  { this.items.push(val); }
  dequeue()     { return this.items.shift(); } // O(n)
  peek()        { return this.items[0]; }
  isEmpty()     { return this.items.length === 0; }
}

// O(1) amortized dequeue with circular buffer or linked list
class Queue {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  enqueue(val) {
    const node = { val, next: null };
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.size++;
  }

  dequeue() {
    if (!this.head) return undefined;
    const val = this.head.val;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.size--;
    return val;
  }

  peek() {
    return this.head?.val;
  }

  isEmpty() {
    return this.size === 0;
  }
}
```

---

## Trees

### Binary Search Tree (BST)

```javascript
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

class BST {
  constructor() {
    this.root = null;
  }

  // O(log n) average, O(n) worst (skewed)
  insert(val) {
    const node = new TreeNode(val);
    if (!this.root) { this.root = node; return; }

    let curr = this.root;
    while (true) {
      if (val < curr.val) {
        if (!curr.left) { curr.left = node; return; }
        curr = curr.left;
      } else {
        if (!curr.right) { curr.right = node; return; }
        curr = curr.right;
      }
    }
  }

  // O(log n) average
  search(val) {
    let curr = this.root;
    while (curr) {
      if (val === curr.val) return curr;
      curr = val < curr.val ? curr.left : curr.right;
    }
    return null;
  }
}
```

### Tree Traversals

```javascript
// In-order (Left, Root, Right) — sorted order for BST
function inorder(node, result = []) {
  if (!node) return result;
  inorder(node.left, result);
  result.push(node.val);
  inorder(node.right, result);
  return result;
}

// Pre-order (Root, Left, Right) — good for copying/serializing
function preorder(node, result = []) {
  if (!node) return result;
  result.push(node.val);
  preorder(node.left, result);
  preorder(node.right, result);
  return result;
}

// Post-order (Left, Right, Root) — good for deletion
function postorder(node, result = []) {
  if (!node) return result;
  postorder(node.left, result);
  postorder(node.right, result);
  result.push(node.val);
  return result;
}

// Level-order (BFS)
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const level = [];

    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}

// Max depth (height)
function maxDepth(node) {
  if (!node) return 0;
  return 1 + Math.max(maxDepth(node.left), maxDepth(node.right));
}
```

### Traversal Comparison

| Traversal | Order | Use Case |
|---|---|---|
| **In-order** | Left, Root, Right | Sorted output from BST |
| **Pre-order** | Root, Left, Right | Serialize/copy a tree |
| **Post-order** | Left, Right, Root | Delete a tree, evaluate expressions |
| **Level-order** | Level by level (BFS) | Find shortest path, print levels |

---

## Graphs

### Representations

```javascript
// Adjacency List (most common for sparse graphs)
const graph = {
  A: ['B', 'C'],
  B: ['A', 'D'],
  C: ['A', 'D', 'E'],
  D: ['B', 'C'],
  E: ['C'],
};

// Adjacency List with Map
const graphMap = new Map();
graphMap.set('A', ['B', 'C']);
graphMap.set('B', ['A', 'D']);

// Adjacency Matrix (dense graphs)
// 0=A, 1=B, 2=C, 3=D
const matrix = [
  [0, 1, 1, 0],  // A -> B, C
  [1, 0, 0, 1],  // B -> A, D
  [1, 0, 0, 1],  // C -> A, D
  [0, 1, 1, 0],  // D -> B, C
];
```

### BFS (Breadth-First Search)

```javascript
function bfs(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];

  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

// Shortest path (unweighted)
function shortestPath(graph, start, end) {
  const visited = new Set([start]);
  const queue = [[start, [start]]];  // [node, path]

  while (queue.length > 0) {
    const [node, path] = queue.shift();
    if (node === end) return path;

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }
  return null; // no path
}
```

### DFS (Depth-First Search)

```javascript
// Recursive
function dfsRecursive(graph, start, visited = new Set()) {
  visited.add(start);
  const order = [start];

  for (const neighbor of graph[start] || []) {
    if (!visited.has(neighbor)) {
      order.push(...dfsRecursive(graph, neighbor, visited));
    }
  }
  return order;
}

// Iterative (using stack)
function dfsIterative(graph, start) {
  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) continue;

    visited.add(node);
    order.push(node);

    for (const neighbor of (graph[node] || []).reverse()) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }
  return order;
}
```

### Cycle Detection

```javascript
// Directed graph — DFS with coloring
function hasCycleDirected(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};

  for (const node of Object.keys(graph)) color[node] = WHITE;

  function dfs(node) {
    color[node] = GRAY;  // in progress

    for (const neighbor of graph[node] || []) {
      if (color[neighbor] === GRAY) return true;   // back edge = cycle
      if (color[neighbor] === WHITE && dfs(neighbor)) return true;
    }

    color[node] = BLACK;  // done
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (color[node] === WHITE && dfs(node)) return true;
  }
  return false;
}

// Undirected graph — Union-Find
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  union(x, y) {
    const px = this.find(x), py = this.find(y);
    if (px === py) return false; // already connected = cycle if adding edge

    if (this.rank[px] < this.rank[py]) this.parent[px] = py;
    else if (this.rank[px] > this.rank[py]) this.parent[py] = px;
    else { this.parent[py] = px; this.rank[px]++; }

    return true;
  }
}
```

### BFS vs DFS Comparison

| Feature | BFS | DFS |
|---|---|---|
| Data structure | Queue | Stack (or recursion) |
| Exploration | Level by level | Go deep first |
| Shortest path (unweighted) | Yes | No |
| Space complexity | O(w) — width of level | O(h) — height/depth |
| Use cases | Shortest path, level-order | Cycle detection, topological sort, path finding |

---

## Heaps & Priority Queues

A **min-heap** is a complete binary tree where every parent is smaller than or equal to its children. A **max-heap** is the opposite.

```javascript
class MinHeap {
  constructor() {
    this.data = [];
  }

  get size() { return this.data.length; }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i)   { return 2 * i + 1; }
  _right(i)  { return 2 * i + 2; }

  _swap(i, j) {
    [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
  }

  // O(log n)
  push(val) {
    this.data.push(val);
    this._bubbleUp(this.data.length - 1);
  }

  // O(log n)
  pop() {
    if (this.data.length === 0) return undefined;
    const min = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  // O(1)
  peek() {
    return this.data[0];
  }

  _bubbleUp(i) {
    while (i > 0 && this.data[i] < this.data[this._parent(i)]) {
      this._swap(i, this._parent(i));
      i = this._parent(i);
    }
  }

  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = this._left(i), r = this._right(i);
      if (l < n && this.data[l] < this.data[smallest]) smallest = l;
      if (r < n && this.data[r] < this.data[smallest]) smallest = r;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }
}

// Usage: find k largest elements
function kLargest(arr, k) {
  const heap = new MinHeap(); // min-heap of size k
  for (const num of arr) {
    heap.push(num);
    if (heap.size > k) heap.pop(); // remove smallest
  }
  // heap now contains k largest elements
  const result = [];
  while (heap.size > 0) result.push(heap.pop());
  return result.reverse();
}
```

---

## Tries

A **trie** (prefix tree) stores strings character by character, sharing common prefixes.

```javascript
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  // O(m) where m = word length
  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) {
        node.children[ch] = new TrieNode();
      }
      node = node.children[ch];
    }
    node.isEnd = true;
  }

  // O(m)
  search(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.isEnd;
  }

  // O(m)
  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return true;
  }

  // Autocomplete: find all words with given prefix
  autocomplete(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) return [];
      node = node.children[ch];
    }

    const results = [];
    function dfs(node, path) {
      if (node.isEnd) results.push(prefix + path);
      for (const [ch, child] of Object.entries(node.children)) {
        dfs(child, path + ch);
      }
    }
    dfs(node, '');
    return results;
  }
}

// Usage
const trie = new Trie();
['apple', 'app', 'application', 'apt', 'banana'].forEach((w) => trie.insert(w));

trie.search('app');           // true
trie.search('ap');            // false
trie.startsWith('app');       // true
trie.autocomplete('app');     // ['app', 'apple', 'application']
```

---

## Sorting Algorithms

### Quick Sort

Average O(n log n), worst O(n^2). In-place, not stable.

```javascript
function quickSort(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return arr;

  const pivotIdx = partition(arr, lo, hi);
  quickSort(arr, lo, pivotIdx - 1);
  quickSort(arr, pivotIdx + 1, hi);
  return arr;
}

function partition(arr, lo, hi) {
  const pivot = arr[hi];
  let i = lo;

  for (let j = lo; j < hi; j++) {
    if (arr[j] <= pivot) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i++;
    }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];
  return i;
}
```

### Merge Sort

Always O(n log n). Stable, but O(n) extra space.

```javascript
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

  return result.concat(left.slice(i), right.slice(j));
}
```

### Sorting Comparison

| Algorithm | Best | Average | Worst | Space | Stable |
|---|---|---|---|---|---|
| Quick Sort | O(n log n) | O(n log n) | O(n^2) | O(log n) | No |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |
| Insertion Sort | O(n) | O(n^2) | O(n^2) | O(1) | Yes |
| Bubble Sort | O(n) | O(n^2) | O(n^2) | O(1) | Yes |
| Counting Sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes |

> **Note:** JavaScript's `Array.prototype.sort()` uses TimSort (hybrid merge+insertion), which is O(n log n) and stable.

---

## Binary Search

```javascript
// Standard binary search
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2); // avoid overflow
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// Find leftmost (first occurrence)
function lowerBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo; // first index where arr[index] >= target
}

// Find rightmost (last occurrence)
function upperBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1; // last index where arr[index] <= target
}

// Binary search on answer (e.g., minimum capacity to ship packages in D days)
function shipWithinDays(weights, days) {
  let lo = Math.max(...weights);
  let hi = weights.reduce((a, b) => a + b, 0);

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (canShip(weights, days, mid)) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

function canShip(weights, days, capacity) {
  let daysNeeded = 1, currentLoad = 0;
  for (const w of weights) {
    if (currentLoad + w > capacity) {
      daysNeeded++;
      currentLoad = 0;
    }
    currentLoad += w;
  }
  return daysNeeded <= days;
}
```

---

## Dynamic Programming Basics

### Key Concepts

1. **Overlapping subproblems** — same subproblem is solved multiple times.
2. **Optimal substructure** — optimal solution can be built from optimal solutions of subproblems.

### Top-Down (Memoization)

```javascript
// Fibonacci — O(n) time, O(n) space
function fib(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
  return memo[n];
}
```

### Bottom-Up (Tabulation)

```javascript
// Fibonacci — O(n) time, O(1) space
function fibBottomUp(n) {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

// Climbing stairs — how many ways to reach step n (1 or 2 steps at a time)
function climbStairs(n) {
  if (n <= 2) return n;
  let prev2 = 1, prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

// Coin change — minimum coins to make amount
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i && dp[i - coin] + 1 < dp[i]) {
        dp[i] = dp[i - coin] + 1;
      }
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}
```

---

## Complexity Comparison Table

### Data Structure Operations

| Data Structure | Access | Search | Insert | Delete | Space |
|---|---|---|---|---|---|
| **Array** | O(1) | O(n) | O(n) | O(n) | O(n) |
| **Sorted Array** | O(1) | O(log n) | O(n) | O(n) | O(n) |
| **Linked List** | O(n) | O(n) | O(1)* | O(1)* | O(n) |
| **Stack** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Queue** | O(n) | O(n) | O(1) | O(1) | O(n) |
| **Hash Map** | N/A | O(1) avg | O(1) avg | O(1) avg | O(n) |
| **BST (balanced)** | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |
| **BST (worst)** | O(n) | O(n) | O(n) | O(n) | O(n) |
| **Min/Max Heap** | O(1) peek | O(n) | O(log n) | O(log n) | O(n) |
| **Trie** | N/A | O(m) | O(m) | O(m) | O(n * m) |

\* O(1) if you have a reference to the position; O(n) if searching first.
m = key/word length.

### Algorithm Complexities

| Algorithm | Best | Average | Worst | Space |
|---|---|---|---|---|
| **Binary Search** | O(1) | O(log n) | O(log n) | O(1) |
| **Quick Sort** | O(n log n) | O(n log n) | O(n^2) | O(log n) |
| **Merge Sort** | O(n log n) | O(n log n) | O(n log n) | O(n) |
| **BFS** | O(V + E) | O(V + E) | O(V + E) | O(V) |
| **DFS** | O(V + E) | O(V + E) | O(V + E) | O(V) |
| **Dijkstra** | O(E log V) | O(E log V) | O(E log V) | O(V) |

---

## Interview Tips

1. **Always state the time and space complexity** of your solution. Interviewers expect this.

2. **Start with brute force**, then optimize. Mention the naive approach even if you jump to the optimal one.

3. **Hash maps are your best friend.** Most "optimize from O(n^2) to O(n)" problems use a hash map.

4. **Know your traversals.** Be able to write in-order, pre-order, post-order, and level-order from memory.

5. **Practice the "binary search on answer" pattern.** It appears in many medium/hard problems.

6. **For DP problems**, start by defining the state, the transition, and the base cases. Then decide top-down vs bottom-up.

7. **Use JavaScript's built-in structures** when appropriate: `Map`, `Set`, `Array` methods (`sort`, `reduce`, `filter`), but know their time complexities.

---

## Quick Reference / Cheat Sheet

```
When to use each data structure:
  Fast lookup by key           --> Hash Map / Map
  Ordered data + search        --> BST / Sorted Array + Binary Search
  LIFO (undo, DFS, parsing)   --> Stack
  FIFO (BFS, scheduling)      --> Queue
  Min/Max quickly              --> Heap
  Prefix matching              --> Trie
  Connected components         --> Graph + Union-Find
  Frequent insert/delete       --> Linked List
  Top K / Kth largest          --> Min-Heap of size K

DP Approach:
  1. Define state:    dp[i] = ...
  2. Transition:      dp[i] = dp[i-1] + dp[i-2]  (or similar)
  3. Base case:       dp[0] = 0, dp[1] = 1
  4. Direction:       top-down (memo) or bottom-up (tabulation)
  5. Optimize space:  if dp[i] only depends on dp[i-1], dp[i-2] -> use 2 vars

Graph Traversal:
  BFS -> shortest path (unweighted), level-order
  DFS -> cycle detection, topological sort, connected components

Binary Search Template:
  lo = min_possible, hi = max_possible
  while (lo < hi):
    mid = lo + floor((hi - lo) / 2)
    if condition(mid): hi = mid    # mid could be answer
    else: lo = mid + 1             # mid too small
  return lo
```
