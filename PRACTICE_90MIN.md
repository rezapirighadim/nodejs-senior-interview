# 90-Minute Rapid Practice Sheet

Quick-fire drills covering the most common senior Node.js / TypeScript interview topics. Work through all six parts in order. Time yourself strictly -- the goal is recall speed, not perfection.

---

## Part 1 -- Core JavaScript (15 min)

### 1.1 Closures

```js
function createCounter(initial = 0) {
  let count = initial;
  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count,
  };
}

const counter = createCounter(10);
counter.increment(); // 11
counter.increment(); // 12
counter.decrement(); // 11
console.log(counter.getCount()); // 11
// `count` is not accessible from outside -- that is the closure.
```

**Quick drill:** Explain what happens if you do `console.log(counter.count)`. (Answer: `undefined` -- `count` is enclosed in the function scope, not a property of the returned object.)

### 1.2 Prototypes

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a noise.`;
};

const dog = new Animal("Rex");
console.log(dog.speak()); // "Rex makes a noise."
console.log(dog.__proto__ === Animal.prototype); // true
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true
```

**Quick drill:** What is the difference between `__proto__` and `prototype`? (Answer: `prototype` is a property on constructor functions. `__proto__` is the internal link on every object pointing to the prototype it was created from.)

### 1.3 Destructuring

```js
// Object destructuring with rename and default
const config = { host: "localhost", port: 3000 };
const { host: h, port: p, protocol: proto = "http" } = config;
console.log(h, p, proto); // "localhost" 3000 "http"

// Array destructuring with skip
const [first, , third] = [1, 2, 3];
console.log(first, third); // 1 3

// Nested destructuring
const { data: { users: [primaryUser] } } = { data: { users: ["Alice", "Bob"] } };
console.log(primaryUser); // "Alice"

// Rest in destructuring
const { host: hostname, ...rest } = { host: "localhost", port: 3000, debug: true };
console.log(rest); // { port: 3000, debug: true }
```

### 1.4 Map / Set

```js
// Map -- ordered, any key type
const cache = new Map<string, number>();
cache.set("a", 1);
cache.set("b", 2);
cache.has("a");        // true
cache.delete("b");
console.log(cache.size); // 1

// WeakMap -- keys must be objects, garbage-collectable
const metadata = new WeakMap();
let obj = {};
metadata.set(obj, { created: Date.now() });
obj = null; // entry is now eligible for GC

// Set -- unique values
const ids = new Set([1, 2, 3, 2, 1]);
console.log([...ids]); // [1, 2, 3]

// Set operations (ES2025+)
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);
console.log(a.intersection(b));  // Set {2, 3}
console.log(a.union(b));         // Set {1, 2, 3, 4}
console.log(a.difference(b));    // Set {1}
```

### 1.5 Array Methods

```js
const nums = [1, 2, 3, 4, 5];

// map, filter, reduce
const doubled = nums.map((n) => n * 2);           // [2, 4, 6, 8, 10]
const evens = nums.filter((n) => n % 2 === 0);    // [2, 4]
const sum = nums.reduce((acc, n) => acc + n, 0);   // 15

// find, findIndex
nums.find((n) => n > 3);      // 4
nums.findIndex((n) => n > 3); // 3

// flat, flatMap
[[1, 2], [3, [4]]].flat(Infinity); // [1, 2, 3, 4]
["hello world", "foo bar"].flatMap((s) => s.split(" ")); // ["hello", "world", "foo", "bar"]

// at (negative indexing)
nums.at(-1); // 5

// structuredClone (deep copy)
const original = { a: { b: 1 } };
const clone = structuredClone(original);
clone.a.b = 99;
console.log(original.a.b); // 1 -- unaffected
```

---

## Part 2 -- Functions & Async (15 min)

### 2.1 Higher-Order Functions

```ts
// A function that returns a function
function multiplier(factor: number) {
  return (x: number): number => x * factor;
}
const triple = multiplier(3);
console.log(triple(5)); // 15

// Compose / pipe
const compose = <T>(...fns: Array<(arg: T) => T>) =>
  (x: T): T => fns.reduceRight((acc, fn) => fn(acc), x);

const pipe = <T>(...fns: Array<(arg: T) => T>) =>
  (x: T): T => fns.reduce((acc, fn) => fn(acc), x);

const transform = pipe(
  (x: number) => x + 1,
  (x: number) => x * 2,
  (x: number) => x - 3,
);
console.log(transform(5)); // (5+1)*2 - 3 = 9

// Debounce
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

### 2.2 Promises

```ts
// Promise.all -- fail-fast on first rejection
const results = await Promise.all([
  fetch("/api/users"),
  fetch("/api/posts"),
]);

// Promise.allSettled -- never rejects, returns status for each
const outcomes = await Promise.allSettled([
  fetch("/api/users"),
  fetch("/api/might-fail"),
]);
outcomes.forEach((o) => {
  if (o.status === "fulfilled") console.log(o.value);
  else console.error(o.reason);
});

// Promise.race -- first to settle wins
const fastest = await Promise.race([
  fetch("/api/primary"),
  fetch("/api/fallback"),
]);

// Promise.any -- first to fulfill wins (ignores rejections)
const firstSuccess = await Promise.any([
  fetch("/mirror-1"),
  fetch("/mirror-2"),
]);

// Custom: timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}
```

### 2.3 async / await Patterns

```ts
// Sequential vs parallel
async function sequential() {
  const a = await fetchA(); // waits
  const b = await fetchB(); // then waits
  return [a, b];
}

async function parallel() {
  const [a, b] = await Promise.all([fetchA(), fetchB()]); // concurrent
  return [a, b];
}

// for-await-of (async iteration)
async function* generateIds(): AsyncGenerator<number> {
  let id = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, 100));
    yield id++;
  }
}

for await (const id of generateIds()) {
  console.log(id);
  if (id >= 4) break;
}

// Top-level await (ESM only)
const config = await import("./config.json", { with: { type: "json" } });
```

### 2.4 Error Handling

```ts
// Structured error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

class ValidationError extends AppError {
  constructor(public readonly fields: Record<string, string>) {
    super("Validation failed", "VALIDATION_ERROR", 400);
  }
}

// Usage in Express-style middleware
function errorHandler(err: Error, req: any, res: any, next: any) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
  } else {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "INTERNAL", message: "Something went wrong" });
  }
}
```

### 2.5 Streams (quick taste)

```ts
import { Readable, Transform, pipeline } from "node:stream";
import { promisify } from "node:util";

const pipelineAsync = promisify(pipeline);

const source = Readable.from(["hello", " ", "world", "\n"]);

const upperCase = new Transform({
  transform(chunk, _encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

await pipelineAsync(source, upperCase, process.stdout);
// Output: HELLO WORLD
```

---

## Part 3 -- OOP & Patterns (15 min)

### 3.1 Classes in TypeScript

```ts
abstract class Shape {
  abstract area(): number;

  toString(): string {
    return `${this.constructor.name}(area=${this.area().toFixed(2)})`;
  }
}

class Circle extends Shape {
  constructor(private readonly radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle extends Shape {
  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    super();
  }

  area(): number {
    return this.width * this.height;
  }
}

const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6)];
shapes.forEach((s) => console.log(s.toString()));
// Circle(area=78.54)
// Rectangle(area=24.00)
```

### 3.2 Interfaces & Generics

```ts
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

class InMemoryUserRepo implements Repository<User> {
  private store = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<User[]> {
    return [...this.store.values()];
  }

  async save(user: User): Promise<User> {
    this.store.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
```

### 3.3 Strategy Pattern

```ts
interface CompressionStrategy {
  compress(data: Buffer): Buffer;
  decompress(data: Buffer): Buffer;
}

class GzipStrategy implements CompressionStrategy {
  compress(data: Buffer): Buffer { /* gzip logic */ return data; }
  decompress(data: Buffer): Buffer { /* gunzip logic */ return data; }
}

class BrotliStrategy implements CompressionStrategy {
  compress(data: Buffer): Buffer { /* brotli logic */ return data; }
  decompress(data: Buffer): Buffer { /* brotli logic */ return data; }
}

class FileProcessor {
  constructor(private strategy: CompressionStrategy) {}

  setStrategy(strategy: CompressionStrategy) {
    this.strategy = strategy;
  }

  process(data: Buffer): Buffer {
    return this.strategy.compress(data);
  }
}
```

### 3.4 Factory Pattern

```ts
interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string) { console.log(`[CONSOLE] ${message}`); }
}

class FileLogger implements Logger {
  log(message: string) { /* write to file */ }
}

class RemoteLogger implements Logger {
  log(message: string) { /* send to logging service */ }
}

type LoggerType = "console" | "file" | "remote";

function createLogger(type: LoggerType): Logger {
  const loggers: Record<LoggerType, () => Logger> = {
    console: () => new ConsoleLogger(),
    file: () => new FileLogger(),
    remote: () => new RemoteLogger(),
  };

  const factory = loggers[type];
  if (!factory) throw new Error(`Unknown logger type: ${type}`);
  return factory();
}

const logger = createLogger("console");
logger.log("Hello!"); // [CONSOLE] Hello!
```

### 3.5 Observer Pattern (EventEmitter-style)

```ts
type Listener<T> = (data: T) => void;

class EventBus<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

// Usage
interface AppEvents {
  "user:login": { userId: string; timestamp: number };
  "user:logout": { userId: string };
  "order:placed": { orderId: string; total: number };
}

const bus = new EventBus<AppEvents>();

const unsub = bus.on("user:login", ({ userId, timestamp }) => {
  console.log(`User ${userId} logged in at ${new Date(timestamp)}`);
});

bus.emit("user:login", { userId: "abc", timestamp: Date.now() });
unsub(); // clean up
```

### 3.6 Dependency Injection

```ts
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface UserRepository {
  findById(id: string): Promise<{ id: string; email: string } | null>;
}

class NotificationService {
  constructor(
    private readonly emailService: EmailService,
    private readonly userRepo: UserRepository,
  ) {}

  async notifyUser(userId: string, message: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error(`User ${userId} not found`);
    await this.emailService.send(user.email, "Notification", message);
  }
}

// In production: inject real implementations
// In tests: inject mocks / stubs
```

---

## Part 4 -- Node.js Specifics (10 min)

### 4.1 Event Loop Phases

```
   ┌───────────────────────────┐
┌─>│         timers            │  setTimeout, setInterval callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     pending callbacks     │  I/O callbacks deferred to next loop
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │       idle, prepare       │  internal use only
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │         poll              │  retrieve new I/O events; run I/O callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │         check             │  setImmediate callbacks
│  └──────────┬────────────────┘
│  ┌──────────┴────────────────┐
│  │     close callbacks       │  e.g. socket.on('close', ...)
│  └──────────┬────────────────┘
│             │
│  ┌──────────┴────────────────┐
└──│  microtasks (between each │  Promise.then, process.nextTick,
   │  phase)                   │  queueMicrotask
   └───────────────────────────┘
```

```js
console.log("1 - sync");

setTimeout(() => console.log("2 - setTimeout"), 0);

setImmediate(() => console.log("3 - setImmediate"));

Promise.resolve().then(() => console.log("4 - promise microtask"));

process.nextTick(() => console.log("5 - nextTick"));

console.log("6 - sync");

// Output:
// 1 - sync
// 6 - sync
// 5 - nextTick          (nextTick queue drains first)
// 4 - promise microtask (then other microtasks)
// 2 - setTimeout        (timers phase -- order with setImmediate varies)
// 3 - setImmediate      (check phase)
```

### 4.2 Cluster Module

```ts
import cluster from "node:cluster";
import http from "node:http";
import { availableParallelism } from "node:os";

const numCPUs = availableParallelism();

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code) => {
    console.log(`Worker ${worker.process.pid} exited (code ${code}). Restarting...`);
    cluster.fork();
  });
} else {
  http
    .createServer((req, res) => {
      res.writeHead(200);
      res.end(`Handled by worker ${process.pid}\n`);
    })
    .listen(3000);

  console.log(`Worker ${process.pid} started`);
}
```

### 4.3 Worker Threads

```ts
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

if (isMainThread) {
  // Main thread: spawn a worker for CPU-intensive work
  function runWorker(data: number[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: data });
      worker.on("message", resolve);
      worker.on("error", reject);
    });
  }

  const result = await runWorker([1, 2, 3, 4, 5]);
  console.log("Sum from worker:", result);
} else {
  // Worker thread: do heavy computation
  const data = workerData as number[];
  const sum = data.reduce((a, b) => a + b, 0);
  parentPort!.postMessage(sum);
}
```

### 4.4 Streams (pipeline pattern)

```ts
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

// Compress a file using streaming (constant memory, any file size)
await pipeline(
  createReadStream("input.txt"),
  createGzip(),
  createWriteStream("input.txt.gz"),
);

console.log("Compression complete.");
```

---

## Part 5 -- LeetCode Patterns in JS (20 min)

Solve each one from memory. If stuck, glance at the solution, then close it and try again.

### 5.1 Two Sum (hash map)

```ts
function twoSum(nums: number[], target: number): [number, number] {
  const seen = new Map<number, number>(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement)!, i];
    }
    seen.set(nums[i], i);
  }
  throw new Error("No solution");
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
```

### 5.2 Valid Parentheses (stack)

```ts
function isValid(s: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  for (const ch of s) {
    if ("({[".includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

console.log(isValid("({[]})")); // true
console.log(isValid("({)}"));   // false
```

### 5.3 Longest Substring Without Repeating Characters (sliding window)

```ts
function lengthOfLongestSubstring(s: string): number {
  const lastSeen = new Map<string, number>();
  let maxLen = 0;
  let start = 0;

  for (let end = 0; end < s.length; end++) {
    const ch = s[end];
    if (lastSeen.has(ch) && lastSeen.get(ch)! >= start) {
      start = lastSeen.get(ch)! + 1;
    }
    lastSeen.set(ch, end);
    maxLen = Math.max(maxLen, end - start + 1);
  }

  return maxLen;
}

console.log(lengthOfLongestSubstring("abcabcbb")); // 3
```

### 5.4 Binary Search

```ts
function binarySearch(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length - 1;

  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }

  return -1;
}

console.log(binarySearch([1, 3, 5, 7, 9, 11], 7)); // 3
```

### 5.5 Reverse Linked List (iterative)

```ts
class ListNode {
  constructor(
    public val: number,
    public next: ListNode | null = null,
  ) {}
}

function reverseList(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;

  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }

  return prev;
}
```

### 5.6 Maximum Depth of Binary Tree (DFS)

```ts
class TreeNode {
  constructor(
    public val: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

function maxDepth(root: TreeNode | null): number {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

### 5.7 Merge Intervals (sort + sweep)

```ts
function merge(intervals: number[][]): number[][] {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = intervals[i];

    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

console.log(merge([[1,3],[2,6],[8,10],[15,18]]));
// [[1,6],[8,10],[15,18]]
```

### 5.8 Coin Change (dynamic programming)

```ts
function coinChange(coins: number[], amount: number): number {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (const coin of coins) {
    for (let i = coin; i <= amount; i++) {
      dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}

console.log(coinChange([1, 5, 10, 25], 30)); // 2 (25 + 5)
```

---

## Part 6 -- Quick-Fire Concepts (15 min)

Answer each in 2-3 sentences, then check yourself.

### 6.1 Event Loop Phases

> **Q:** Name the main phases of the Node.js event loop in order.
>
> **A:** Timers (setTimeout/setInterval) -> Pending callbacks -> Idle/Prepare -> Poll (I/O) -> Check (setImmediate) -> Close callbacks. Between every phase, the microtask queue is drained (process.nextTick first, then Promise callbacks).

### 6.2 Microtask vs Macrotask

> **Q:** What is the difference?
>
> **A:** Microtasks (`process.nextTick`, `Promise.then`, `queueMicrotask`) run between event-loop phases and always execute before the next macrotask. Macrotasks (`setTimeout`, `setInterval`, `setImmediate`, I/O) are scheduled in specific event-loop phases. The entire microtask queue drains before the loop moves on.

### 6.3 CommonJS vs ESM

| Feature | CommonJS (`require`) | ESM (`import`) |
|---------|---------------------|----------------|
| Loading | Synchronous | Asynchronous |
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Top-level await | Not supported | Supported |
| Tree shaking | Not possible (dynamic) | Possible (static analysis) |
| `this` at top level | `exports` | `undefined` |
| File extension | `.js` (or `.cjs`) | `.mjs` (or `.js` with `"type": "module"`) |

### 6.4 REST vs GraphQL

| Aspect | REST | GraphQL |
|--------|------|---------|
| Endpoints | Multiple (one per resource) | Single (`/graphql`) |
| Over-fetching | Common | Eliminated (client picks fields) |
| Under-fetching | Requires multiple calls | Single query can join data |
| Caching | HTTP caching (easy) | Needs specialized caching |
| Error handling | HTTP status codes | Always 200, errors in body |
| Best for | Simple CRUD, public APIs | Complex relational data, mobile apps |

### 6.5 SOLID Principles

| Principle | One-liner | TypeScript Example |
|-----------|-----------|-------------------|
| **S** - Single Responsibility | A class does one thing | `UserValidator` only validates, `UserRepository` only persists |
| **O** - Open/Closed | Open for extension, closed for modification | Add new `PaymentStrategy` without changing `PaymentProcessor` |
| **L** - Liskov Substitution | Subtypes must be substitutable for their base | `Square` should not extend `Rectangle` if it breaks `setWidth`/`setHeight` |
| **I** - Interface Segregation | Many small interfaces > one fat interface | `Readable`, `Writable` instead of one `ReadWriteStream` |
| **D** - Dependency Inversion | Depend on abstractions, not concretions | Constructor takes `Repository` interface, not `PostgresRepository` |

### 6.6 When to Use What

| Situation | Choice | Why |
|-----------|--------|-----|
| CPU-bound task in Node | Worker Threads | Avoids blocking the event loop |
| Scale HTTP across cores | Cluster module (or PM2) | Forks worker processes sharing the same port |
| Real-time bidirectional | WebSockets (ws, Socket.IO) | Persistent connection, low latency |
| Task queue / background | BullMQ + Redis | Reliable, retries, priorities, concurrency control |
| Fast key-value caching | Redis or in-process Map/LRU | Sub-ms reads, TTL support |
| Structured data storage | PostgreSQL (with Prisma/Drizzle) | ACID, relations, migrations |
| Document / flexible schema | MongoDB (with Mongoose) | Schema-less, horizontal scaling |
| Full-text search | Elasticsearch / OpenSearch | Inverted index, relevance scoring |
| API gateway | Express / Fastify (or Kong/Traefik) | Routing, rate-limiting, auth middleware |
| Type-safe API layer | tRPC or GraphQL (Pothos) | End-to-end type safety |

---

**Done!** Review anything you hesitated on. Repeat daily until every answer is instant.
