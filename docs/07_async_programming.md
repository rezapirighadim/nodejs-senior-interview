# Async Programming in Node.js -- Senior Interview Reference

## Table of Contents

- [Callbacks and Callback Hell](#callbacks-and-callback-hell)
- [Promises](#promises)
- [Async/Await](#asyncawait)
- [Async Iterators and for-await-of](#async-iterators-and-for-await-of)
- [Node.js Streams](#nodejs-streams)
- [Backpressure](#backpressure)
- [AbortController and Cancellation](#abortcontroller-and-cancellation)
- [Event Loop Phases in Detail](#event-loop-phases-in-detail)
- [process.nextTick vs queueMicrotask vs setImmediate](#processnexttick-vs-queuemicrotask-vs-setimmediate)
- [Unhandled Rejections](#unhandled-rejections)
- [Async Resource Management (Symbol.dispose)](#async-resource-management-symboldispose)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Callbacks and Callback Hell

### Node.js Error-First Callback Convention

```javascript
const fs = require("node:fs");

// Error-first pattern: callback(error, result)
fs.readFile("/path/to/file.txt", "utf8", (err, data) => {
  if (err) {
    console.error("Failed to read:", err.message);
    return; // always return after error handling
  }
  console.log("File contents:", data);
});
```

### Callback Hell (Pyramid of Doom)

```javascript
// The problem: deeply nested, hard to read, hard to handle errors
getUser(userId, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      getShippingStatus(details.trackingId, (err, status) => {
        if (err) return handleError(err);
        console.log("Status:", status);
      });
    });
  });
});
```

### Mitigating Callback Hell

```javascript
// Strategy 1: Named functions
function handleStatus(err, status) {
  if (err) return handleError(err);
  console.log("Status:", status);
}

function handleDetails(err, details) {
  if (err) return handleError(err);
  getShippingStatus(details.trackingId, handleStatus);
}

function handleOrders(err, orders) {
  if (err) return handleError(err);
  getOrderDetails(orders[0].id, handleDetails);
}

getUser(userId, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, handleOrders);
});

// Strategy 2: Promisify
const { promisify } = require("node:util");
const readFile = promisify(fs.readFile);

// Now it returns a Promise
const data = await readFile("/path/to/file.txt", "utf8");
```

> **Interview Tip:** Explain callbacks as the foundational async pattern in Node.js. The error-first convention was established because try/catch cannot catch errors in async callbacks. Promises and async/await were created specifically to solve callback hell.

---

## Promises

### Creating Promises

```javascript
// Using the constructor
const promise = new Promise((resolve, reject) => {
  const data = fetchSomething();
  if (data) {
    resolve(data);  // fulfilled
  } else {
    reject(new Error("No data")); // rejected
  }
});

// Static methods for immediate values
const resolved = Promise.resolve(42);
const rejected = Promise.reject(new Error("fail"));

// Promisifying a callback-based function
function readFileAsync(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
```

### Promise Chaining

```javascript
fetchUser(userId)
  .then(user => fetchOrders(user.id))       // returns a new Promise
  .then(orders => fetchDetails(orders[0]))   // auto-unwraps Promises
  .then(details => {
    console.log(details);
    return details;
  })
  .catch(err => {
    // catches any error in the chain
    console.error("Pipeline failed:", err.message);
  })
  .finally(() => {
    // always runs, regardless of outcome
    cleanupResources();
  });

// Common mistake: nested .then (recreating callback hell)
// BAD:
fetchUser(userId).then(user => {
  fetchOrders(user.id).then(orders => {  // unnecessary nesting
    console.log(orders);
  });
});

// GOOD:
fetchUser(userId)
  .then(user => fetchOrders(user.id))
  .then(orders => console.log(orders));
```

### Promise Combinators

```javascript
const p1 = fetch("/api/users");
const p2 = fetch("/api/posts");
const p3 = fetch("/api/comments");
const pFail = Promise.reject(new Error("network error"));

// Promise.all -- ALL must succeed; rejects on first failure
try {
  const [users, posts, comments] = await Promise.all([p1, p2, p3]);
  // All resolved
} catch (err) {
  // First rejection
}

// Promise.allSettled -- waits for ALL, never rejects
const results = await Promise.allSettled([p1, p2, pFail]);
// [
//   { status: "fulfilled", value: Response },
//   { status: "fulfilled", value: Response },
//   { status: "rejected",  reason: Error }
// ]

const succeeded = results.filter(r => r.status === "fulfilled");
const failed = results.filter(r => r.status === "rejected");

// Promise.race -- first to settle wins (fulfilled OR rejected)
const fastest = await Promise.race([p1, p2, p3]);

// Timeout pattern with race
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

const data = await withTimeout(fetch("/api/slow"), 5000);

// Promise.any -- first to FULFILL wins; rejects only if ALL reject
try {
  const first = await Promise.any([pFail, p1, p2]);
  // First successful result
} catch (err) {
  // AggregateError -- all rejected
  console.log(err.errors); // array of all rejection reasons
}
```

### Combinator Comparison Table

| Combinator         | Resolves When                  | Rejects When            | Use Case                          |
|--------------------|--------------------------------|-------------------------|-----------------------------------|
| `Promise.all`      | All fulfill                    | Any one rejects         | Parallel tasks, all required      |
| `Promise.allSettled` | All settle (either way)      | Never                   | Parallel tasks, handle each result|
| `Promise.race`     | First to settle                | First to settle (if reject) | Timeout, fastest response     |
| `Promise.any`      | First to fulfill               | All reject              | Redundancy, fallback sources      |

---

## Async/Await

### Basics and Error Handling

```javascript
// async function always returns a Promise
async function getUser(id) {
  // await pauses execution until the Promise settles
  const response = await fetch(`/api/users/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json(); // returns a Promise (auto-wrapped)
}

// Error handling with try/catch
async function loadDashboard(userId) {
  try {
    const user = await getUser(userId);
    const orders = await getOrders(user.id);
    return { user, orders };
  } catch (err) {
    console.error("Dashboard load failed:", err.message);
    return { error: err.message };
  } finally {
    hideLoadingSpinner();
  }
}
```

### Sequential vs Parallel Execution

```javascript
// SEQUENTIAL -- each awaits the previous (slow)
async function sequential() {
  const users = await fetchUsers();    // 1s
  const posts = await fetchPosts();    // 1s
  const comments = await fetchComments(); // 1s
  return { users, posts, comments };
  // Total: ~3s
}

// PARALLEL -- all start at once (fast)
async function parallel() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),      // 1s
    fetchPosts(),      // 1s   (all run concurrently)
    fetchComments()    // 1s
  ]);
  return { users, posts, comments };
  // Total: ~1s
}

// PARALLEL with independent error handling
async function parallelSafe() {
  const results = await Promise.allSettled([
    fetchUsers(),
    fetchPosts(),
    fetchComments()
  ]);

  return {
    users: results[0].status === "fulfilled" ? results[0].value : [],
    posts: results[1].status === "fulfilled" ? results[1].value : [],
    comments: results[2].status === "fulfilled" ? results[2].value : []
  };
}

// CONTROLLED CONCURRENCY -- limit parallel operations
async function mapWithConcurrency(items, fn, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const [index, item] of items.entries()) {
    const promise = fn(item, index).then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// Process 100 items, max 5 concurrent
const processed = await mapWithConcurrency(
  items,
  item => processItem(item),
  5
);
```

### Error Handling Patterns

```javascript
// Pattern 1: Go-style tuple returns
async function safeAsync(fn) {
  try {
    const result = await fn();
    return [null, result];
  } catch (err) {
    return [err, null];
  }
}

const [err, user] = await safeAsync(() => getUser(123));
if (err) {
  console.error("Failed:", err.message);
}

// Pattern 2: Catch on individual promises
async function loadPage() {
  const user = await getUser(id).catch(() => null);
  const settings = await getSettings(id).catch(() => defaults);
  return { user, settings };
}

// Pattern 3: Error boundary wrapper
function withErrorBoundary(fn, fallback) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`${fn.name} failed:`, err);
      return typeof fallback === "function" ? fallback(err) : fallback;
    }
  };
}

const safeGetUser = withErrorBoundary(getUser, null);
```

### Common Pitfalls

```javascript
// PITFALL 1: Forgetting await in try/catch
async function broken() {
  try {
    // Bug: catch will NOT catch this rejection
    const promise = riskyOperation(); // no await!
    return promise;
  } catch (err) {
    // Never reached for async errors
  }
}

// PITFALL 2: await in a loop (sequential when parallel is possible)
// Slow:
for (const id of ids) {
  const user = await fetchUser(id); // one at a time
  results.push(user);
}

// Fast:
const results = await Promise.all(ids.map(id => fetchUser(id)));

// PITFALL 3: Unhandled rejection from fire-and-forget
async function handleRequest(req, res) {
  // Bug: if logAnalytics rejects, nobody catches it
  logAnalytics(req); // missing await, no .catch()

  // Fix:
  logAnalytics(req).catch(err => console.error("Analytics failed:", err));
}
```

---

## Async Iterators and for-await-of

### Consuming Async Iterables

```javascript
// Async iterables implement Symbol.asyncIterator
async function* generateNumbers() {
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 100));
    yield i;
  }
}

// Consuming with for-await-of
for await (const num of generateNumbers()) {
  console.log(num); // 0, 1, 2, 3, 4 (each after 100ms)
}

// Reading a file line by line
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

async function processLines(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    // Process each line without loading entire file
  }
  return lineCount;
}
```

### Building Async Iterables

```javascript
// Async generator: paginated API fetching
async function* fetchAllPages(baseUrl) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${baseUrl}?page=${page}&limit=100`);
    const data = await response.json();

    yield* data.items; // yield each item individually

    hasMore = data.hasNextPage;
    page++;
  }
}

// Consume all pages transparently
for await (const item of fetchAllPages("/api/products")) {
  await processItem(item);
}

// Event-to-async-iterator adapter
import { on } from "node:events";

async function handleEvents(emitter) {
  for await (const [event] of on(emitter, "data")) {
    console.log("Received:", event);
  }
}
```

### Async Iterator Utilities

```javascript
// Async map
async function* asyncMap(iterable, fn) {
  for await (const item of iterable) {
    yield await fn(item);
  }
}

// Async filter
async function* asyncFilter(iterable, pred) {
  for await (const item of iterable) {
    if (await pred(item)) yield item;
  }
}

// Async take
async function* asyncTake(iterable, n) {
  let count = 0;
  for await (const item of iterable) {
    if (count >= n) return;
    yield item;
    count++;
  }
}

// Async batch/chunk
async function* asyncBatch(iterable, size) {
  let batch = [];
  for await (const item of iterable) {
    batch.push(item);
    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

// Usage: process database records in batches
for await (const batch of asyncBatch(fetchAllRecords(), 50)) {
  await bulkInsert(batch); // insert 50 at a time
}
```

---

## Node.js Streams

### Stream Types

| Stream Type   | Description                 | Example                        |
|---------------|-----------------------------|--------------------------------|
| `Readable`    | Source of data              | `fs.createReadStream`, HTTP request body |
| `Writable`    | Destination for data        | `fs.createWriteStream`, HTTP response |
| `Duplex`      | Both readable and writable  | TCP socket, WebSocket          |
| `Transform`   | Duplex that modifies data   | `zlib.createGzip`, custom parser |

### Readable Streams

```javascript
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

// From file
const fileStream = createReadStream("large-file.csv", {
  encoding: "utf8",
  highWaterMark: 64 * 1024 // 64KB chunks
});

fileStream.on("data", chunk => console.log("Chunk:", chunk.length));
fileStream.on("end", () => console.log("Done"));
fileStream.on("error", err => console.error(err));

// Creating a custom readable
const customReadable = new Readable({
  read(size) {
    this.push("hello ");
    this.push("world\n");
    this.push(null); // signals end of stream
  }
});

// From an iterable (Node 12+)
const fromArray = Readable.from(["line1\n", "line2\n", "line3\n"]);

// Async generator to readable
async function* generateData() {
  for (let i = 0; i < 1000; i++) {
    yield JSON.stringify({ id: i, timestamp: Date.now() }) + "\n";
  }
}
const dataStream = Readable.from(generateData());
```

### Writable Streams

```javascript
import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";

// To file
const fileWriter = createWriteStream("output.log", { flags: "a" });

fileWriter.write("Log entry 1\n");
fileWriter.write("Log entry 2\n");
fileWriter.end("Final entry\n"); // signals no more writes

fileWriter.on("finish", () => console.log("All data flushed"));
fileWriter.on("error", err => console.error(err));

// Custom writable: batch database inserts
class DatabaseWriter extends Writable {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
    this._batch = [];
    this._batchSize = options.batchSize || 100;
  }

  async _write(record, _encoding, callback) {
    this._batch.push(record);
    if (this._batch.length >= this._batchSize) {
      try {
        await db.bulkInsert(this._batch);
        this._batch = [];
        callback();
      } catch (err) {
        callback(err);
      }
    } else {
      callback();
    }
  }

  async _final(callback) {
    // Flush remaining records
    if (this._batch.length > 0) {
      try {
        await db.bulkInsert(this._batch);
        callback();
      } catch (err) {
        callback(err);
      }
    } else {
      callback();
    }
  }
}
```

### Transform Streams

```javascript
import { Transform } from "node:stream";

// Simple transform: uppercase
const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  }
});

// JSON line parser
class JSONLineParser extends Transform {
  constructor() {
    super({ objectMode: true }); // output objects, not buffers
    this._buffer = "";
  }

  _transform(chunk, _encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (line.trim()) {
        try {
          this.push(JSON.parse(line));
        } catch (err) {
          this.emit("error", new Error(`Invalid JSON: ${line}`));
        }
      }
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim()) {
      try {
        this.push(JSON.parse(this._buffer));
      } catch (err) {
        // ignore trailing incomplete data
      }
    }
    callback();
  }
}

// CSV to JSON transform
function csvToJson(headers) {
  return new Transform({
    objectMode: true,
    transform(line, _encoding, callback) {
      const values = line.toString().trim().split(",");
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      callback(null, obj);
    }
  });
}
```

### pipeline() -- The Modern Way

```javascript
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

// pipeline handles errors and cleanup automatically
try {
  await pipeline(
    createReadStream("input.log"),
    createGzip(),
    createWriteStream("input.log.gz")
  );
  console.log("Compression complete");
} catch (err) {
  console.error("Pipeline failed:", err);
}

// Complex processing pipeline
await pipeline(
  createReadStream("data.jsonl"),
  new JSONLineParser(),
  new Transform({
    objectMode: true,
    transform(record, _, cb) {
      if (record.status === "active") {
        cb(null, JSON.stringify(record) + "\n");
      } else {
        cb(); // skip
      }
    }
  }),
  createGzip(),
  createWriteStream("active-records.jsonl.gz")
);
```

> **Interview Tip:** Always prefer `pipeline()` over `.pipe()`. The `pipeline` function properly handles error propagation and stream cleanup (destroying streams on error). The old `.pipe()` method does not destroy streams on error, leading to memory leaks.

---

## Backpressure

**Backpressure** occurs when a writable stream cannot consume data as fast as the readable stream produces it. Without handling it, data accumulates in memory and can cause an out-of-memory crash.

### How Backpressure Works

```
Readable           Writable
  |                  |
  |-- push data ---> |
  |                  | (buffer filling up)
  |-- push data ---> |
  |                  | (buffer at highWaterMark)
  |<-- pause --------|  (.write() returns false)
  |                  |
  |                  | (buffer drains)
  |<-- drain --------|  ('drain' event)
  |-- push data ---> |
```

### Manual Backpressure Handling

```javascript
import { createReadStream, createWriteStream } from "node:fs";

const reader = createReadStream("huge-file.csv");
const writer = createWriteStream("output.csv");

reader.on("data", (chunk) => {
  const canContinue = writer.write(chunk);

  if (!canContinue) {
    // Buffer is full -- pause reading
    reader.pause();
    writer.once("drain", () => {
      // Buffer drained -- resume reading
      reader.resume();
    });
  }
});

reader.on("end", () => writer.end());
```

### Automatic Backpressure with pipeline

```javascript
import { pipeline } from "node:stream/promises";

// pipeline() handles backpressure automatically
await pipeline(
  createReadStream("huge-file.csv"),
  transformStream,
  createWriteStream("output.csv")
);
```

### Backpressure in Custom Streams

```javascript
class RateLimitedWriter extends Writable {
  constructor(ratePerSecond) {
    super();
    this._interval = 1000 / ratePerSecond;
  }

  _write(chunk, encoding, callback) {
    // Simulate slow processing
    processChunk(chunk);
    // Delay to enforce rate limit -- this naturally creates backpressure
    setTimeout(callback, this._interval);
  }
}

// The readable will automatically slow down to match
await pipeline(
  fastDataSource,
  new RateLimitedWriter(100) // max 100 writes/second
);
```

---

## AbortController and Cancellation

### Basic Usage

```javascript
// AbortController provides a signal to cancel async operations
const controller = new AbortController();
const { signal } = controller;

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch("https://api.example.com/data", { signal });
  const data = await response.json();
} catch (err) {
  if (err.name === "AbortError") {
    console.log("Request was cancelled");
  } else {
    throw err;
  }
}
```

### Cancellable Operations

```javascript
// Cancellable timeout
function cancellableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException("Aborted", "AbortError"));
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

// Cancellable event listener
const controller = new AbortController();

eventEmitter.on("data", handler, { signal: controller.signal });
// Later: controller.abort() removes the listener

// Cancellable stream pipeline
await pipeline(
  readStream,
  transformStream,
  writeStream,
  { signal: controller.signal }
);
```

### AbortSignal Utilities

```javascript
// AbortSignal.timeout -- auto-abort after duration (Node 18+)
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000) // 5-second timeout
});

// AbortSignal.any -- abort if ANY signal fires (Node 20+)
const userCancel = new AbortController();
const timeoutSignal = AbortSignal.timeout(30000);

const combined = AbortSignal.any([
  userCancel.signal,
  timeoutSignal
]);

await fetch(url, { signal: combined });

// Abort reason
const controller = new AbortController();
controller.abort("User navigated away");

controller.signal.reason; // "User navigated away"
```

### Cancellation Pattern for Long-Running Work

```javascript
async function processLargeDataset(items, signal) {
  const results = [];

  for (const item of items) {
    // Check for cancellation periodically
    if (signal?.aborted) {
      throw new DOMException("Processing cancelled", "AbortError");
    }

    const result = await processItem(item);
    results.push(result);
  }

  return results;
}

const controller = new AbortController();

// Cancel on user request
process.on("SIGINT", () => controller.abort("User interrupted"));

try {
  const results = await processLargeDataset(hugeArray, controller.signal);
} catch (err) {
  if (err.name === "AbortError") {
    console.log("Cancelled:", err.message);
  }
}
```

---

## Event Loop Phases in Detail

The Node.js event loop processes callbacks in a specific order of phases. Each phase has a FIFO queue of callbacks to execute.

### Phase Diagram

```
   ┌───────────────────────────┐
┌─>│         timers            │  <- setTimeout, setInterval callbacks
│  └───────────┬───────────────┘
│  ┌───────────┴───────────────┐
│  │     pending callbacks     │  <- I/O callbacks deferred to next iteration
│  └───────────┬───────────────┘
│  ┌───────────┴───────────────┐
│  │       idle, prepare       │  <- internal use only
│  └───────────┬───────────────┘
│  ┌───────────┴───────────────┐
│  │          poll             │  <- retrieve new I/O events; execute I/O callbacks
│  └───────────┬───────────────┘     (node will block here when appropriate)
│  ┌───────────┴───────────────┐
│  │          check            │  <- setImmediate callbacks
│  └───────────┬───────────────┘
│  ┌───────────┴───────────────┐
│  │     close callbacks       │  <- socket.on('close', ...) etc.
│  └───────────┬───────────────┘
│              │
│   [process.nextTick queue]    <- runs after each phase
│   [microtask queue]          <- Promise callbacks, queueMicrotask
│              │
└──────────────┘
```

### Phase Details

| Phase              | What Executes                                   | Key Notes                              |
|--------------------|-------------------------------------------------|----------------------------------------|
| **timers**         | `setTimeout` and `setInterval` callbacks        | Executes callbacks whose delay has elapsed |
| **pending callbacks** | Deferred I/O callbacks (e.g., TCP errors)    | System-level callbacks from previous loop |
| **idle, prepare**  | Internal Node.js housekeeping                   | Not accessible to user code            |
| **poll**           | I/O callbacks (file read, network, etc.)        | May block waiting for events if no timers scheduled |
| **check**          | `setImmediate` callbacks                        | Always runs after poll phase           |
| **close callbacks**| `socket.on('close')`, cleanup handlers          | Resource cleanup                       |

### Execution Order Examples

```javascript
// Example 1: Basic ordering
console.log("1: synchronous");

setTimeout(() => console.log("2: setTimeout"), 0);
setImmediate(() => console.log("3: setImmediate"));

Promise.resolve().then(() => console.log("4: Promise microtask"));
process.nextTick(() => console.log("5: nextTick"));

console.log("6: synchronous");

// Output:
// 1: synchronous
// 6: synchronous
// 5: nextTick       (nextTick queue, highest async priority)
// 4: Promise microtask  (microtask queue, after nextTick)
// 2: setTimeout     (timers phase)   \  order between these two
// 3: setImmediate   (check phase)    /  is non-deterministic here
```

```javascript
// Example 2: Inside an I/O callback, setImmediate always runs before setTimeout
const fs = require("node:fs");

fs.readFile(__filename, () => {
  // We are in the poll phase callback
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// Output (always this order inside I/O callback):
// setImmediate   (check phase runs right after poll)
// setTimeout     (timers phase in next iteration)
```

```javascript
// Example 3: Microtask ordering
Promise.resolve()
  .then(() => {
    console.log("promise 1");
    process.nextTick(() => console.log("nextTick inside promise"));
  })
  .then(() => console.log("promise 2"));

process.nextTick(() => {
  console.log("nextTick 1");
  process.nextTick(() => console.log("nested nextTick"));
});

// Output:
// nextTick 1
// nested nextTick       (nextTick queue drains completely first)
// promise 1
// nextTick inside promise  (nextTick runs between microtasks)
// promise 2
```

---

## process.nextTick vs queueMicrotask vs setImmediate

### Comparison Table

| Feature              | `process.nextTick`           | `queueMicrotask`             | `setImmediate`               |
|----------------------|------------------------------|------------------------------|------------------------------|
| Timing               | Before microtasks            | After nextTick, before macrotasks | After I/O (check phase)  |
| Priority             | Highest async priority       | After nextTick               | After timers phase           |
| Queue                | nextTick queue               | Microtask queue              | check phase queue            |
| Recursive behavior   | Can starve I/O if recursive  | Can starve I/O if recursive  | Safe -- yields to I/O        |
| Standard             | Node.js only                 | Web standard + Node.js       | Node.js only                 |
| Use case             | Emit events after constructor | Promise-like deferral       | Run after current I/O batch  |

### When to Use What

```javascript
// process.nextTick: ensure callback runs before any I/O
// Common use: emit events after construction
class MyEmitter extends EventEmitter {
  constructor() {
    super();
    // Without nextTick, 'ready' fires before listener is attached
    process.nextTick(() => this.emit("ready"));
  }
}

const emitter = new MyEmitter();
emitter.on("ready", () => console.log("Ready!")); // works

// queueMicrotask: standards-compliant promise-level scheduling
queueMicrotask(() => {
  console.log("Runs after current task, like a resolved promise");
});

// setImmediate: defer work to next event loop iteration (after I/O)
setImmediate(() => {
  // Good for breaking up CPU-intensive work
  processNextBatch();
});
```

### Starvation Risk

```javascript
// DANGER: recursive nextTick starves the event loop
function recursiveNextTick() {
  process.nextTick(recursiveNextTick); // I/O never runs!
}

// SAFE: recursive setImmediate yields to I/O
function recursiveImmediate() {
  setImmediate(recursiveImmediate); // I/O can run between iterations
}

// SAFE: break up CPU work
function processChunks(data, index = 0, chunkSize = 1000) {
  const end = Math.min(index + chunkSize, data.length);

  for (let i = index; i < end; i++) {
    heavyComputation(data[i]);
  }

  if (end < data.length) {
    setImmediate(() => processChunks(data, end, chunkSize));
  }
}
```

---

## Unhandled Rejections

### Detection and Handling

```javascript
// Global handler (Node.js)
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection:", reason);
  // Log to monitoring service
  monitor.reportError(reason);
});

// Since Node.js 15+, unhandled rejections terminate the process by default
// To customize behavior:
// --unhandled-rejections=throw   (default since v15, exits with code 1)
// --unhandled-rejections=warn    (prints warning, does not exit)
// --unhandled-rejections=none    (silent, not recommended)

// Common sources of unhandled rejections
// 1. Missing .catch()
someAsyncFunction(); // no await, no .catch()

// 2. Missing error handler in event emitter Promise
emitter.on("data", async (data) => {
  await riskyOperation(data); // if this throws, it's unhandled
});

// Fix:
emitter.on("data", async (data) => {
  try {
    await riskyOperation(data);
  } catch (err) {
    console.error("Processing failed:", err);
  }
});

// 3. Promise.all with partial failure
const results = await Promise.all([
  fetch("/api/a"),
  fetch("/api/b").catch(() => null), // handle individually
  fetch("/api/c")
]);
```

### Best Practices

```javascript
// Always handle rejections in fire-and-forget scenarios
async function main() {
  // Bad: unhandled if it rejects
  logAnalytics({ event: "startup" });

  // Good: catch and log
  logAnalytics({ event: "startup" })
    .catch(err => console.error("Analytics failed:", err));
}

// Use a global safety net, but fix the root cause
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  // In production, log and gracefully shut down
  gracefulShutdown(1);
});
```

---

## Async Resource Management (Symbol.dispose)

The Explicit Resource Management proposal (TC39 Stage 3, available in Node.js 20+ with flag, Node.js 22+ stable) provides `using` and `await using` declarations for automatic cleanup.

### Symbol.dispose and Symbol.asyncDispose

```javascript
// Synchronous disposable
class FileHandle {
  #handle;

  constructor(path) {
    this.#handle = fs.openSync(path, "r");
  }

  read() {
    return fs.readFileSync(this.#handle, "utf8");
  }

  [Symbol.dispose]() {
    fs.closeSync(this.#handle);
    console.log("File handle closed");
  }
}

// Usage with 'using' keyword
{
  using file = new FileHandle("/tmp/data.txt");
  const content = file.read();
  // file[Symbol.dispose]() called automatically at end of block
}

// Async disposable
class DatabaseConnection {
  #pool;

  constructor(pool) {
    this.#pool = pool;
  }

  async query(sql) {
    return this.#pool.query(sql);
  }

  async [Symbol.asyncDispose]() {
    await this.#pool.release();
    console.log("Connection released");
  }
}

// Usage with 'await using'
async function getUser(id) {
  await using conn = await pool.getConnection();
  const [rows] = await conn.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
  // conn[Symbol.asyncDispose]() called automatically
}
```

### DisposableStack

```javascript
// Manage multiple disposables together
async function processData() {
  await using stack = new AsyncDisposableStack();

  const conn = stack.use(await pool.getConnection());
  const tempFile = stack.use(await createTempFile());
  const lock = stack.use(await acquireLock("resource-123"));

  await conn.query("INSERT INTO ...");
  await tempFile.write(data);

  // All three are disposed in reverse order when scope exits:
  // 1. lock released
  // 2. temp file deleted
  // 3. connection returned to pool
}
```

### Practical Pattern: Transaction Management

```javascript
class Transaction {
  #conn;
  #committed = false;

  constructor(conn) {
    this.#conn = conn;
  }

  static async create(pool) {
    const conn = await pool.getConnection();
    await conn.query("BEGIN");
    return new Transaction(conn);
  }

  async query(sql, params) {
    return this.#conn.query(sql, params);
  }

  async commit() {
    await this.#conn.query("COMMIT");
    this.#committed = true;
  }

  async [Symbol.asyncDispose]() {
    if (!this.#committed) {
      await this.#conn.query("ROLLBACK");
    }
    await this.#conn.release();
  }
}

// Usage -- automatic rollback on error
async function transferFunds(fromId, toId, amount) {
  await using tx = await Transaction.create(pool);

  await tx.query("UPDATE accounts SET balance = balance - ? WHERE id = ?", [amount, fromId]);
  await tx.query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [amount, toId]);

  await tx.commit();
  // If any line throws, tx is auto-disposed -> ROLLBACK + release
}
```

---

## Interview Tips and Key Takeaways

1. **Event loop mastery:** Be able to trace execution order for any code snippet mixing `setTimeout`, `setImmediate`, `process.nextTick`, Promises, and sync code. Practice with diagrams.

2. **Streams are the Node.js superpower:** For large data processing, streams beat loading entire files into memory. Always mention `pipeline()` over `.pipe()`.

3. **Parallel vs sequential:** Know when to use `Promise.all` (independent tasks) vs sequential `await` (dependent tasks). `Promise.allSettled` when partial failure is acceptable.

4. **Cancellation is modern Node.js:** `AbortController` is the standard pattern. Mention `AbortSignal.timeout()` and `AbortSignal.any()` to show current knowledge.

5. **Backpressure awareness:** This separates juniors from seniors. Explain that without backpressure handling, fast producers can overwhelm slow consumers, causing OOM crashes.

6. **Error handling everywhere:** Every async operation needs error handling. `process.on('unhandledRejection')` is a safety net, not a strategy.

7. **Resource cleanup:** `using` / `await using` with `Symbol.dispose` is the modern approach (like try-with-resources in Java or `with` in Python).

8. **Know the combinators:** `Promise.all` vs `race` vs `allSettled` vs `any` -- know behavior differences and use cases cold.

---

## Quick Reference / Cheat Sheet

### Promise Combinators

| Combinator           | Resolves                 | Rejects              | Short-circuits? |
|----------------------|--------------------------|----------------------|-----------------|
| `Promise.all`        | When all fulfill         | On first rejection   | Yes             |
| `Promise.allSettled` | When all settle          | Never                | No              |
| `Promise.race`       | First to settle          | First to settle      | Yes             |
| `Promise.any`        | First to fulfill         | When all reject      | Yes             |

### Event Loop Priority (High to Low)

```
1. Synchronous code (current call stack)
2. process.nextTick queue
3. Microtask queue (Promise .then, queueMicrotask)
4. Macrotask queues (in phase order):
   a. timers (setTimeout, setInterval)
   b. pending callbacks (deferred I/O)
   c. poll (I/O callbacks)
   d. check (setImmediate)
   e. close callbacks
```

### Stream Quick Reference

```javascript
// Prefer pipeline (handles errors + backpressure)
import { pipeline } from "node:stream/promises";

await pipeline(source, transform1, transform2, destination);

// Quick readable from data
import { Readable } from "node:stream";
const stream = Readable.from(["a", "b", "c"]);

// Quick writable that collects data
const chunks = [];
const collector = new Writable({
  write(chunk, enc, cb) { chunks.push(chunk); cb(); }
});
```

### Async Pattern Decision Tree

```
Need to run tasks?
├── Independent tasks? -> Promise.all / Promise.allSettled
├── Need first result? -> Promise.race / Promise.any
├── Sequential chain?  -> await one by one / async pipe
├── Large data?        -> Streams with pipeline()
├── Pagination/lazy?   -> Async generators + for-await-of
└── Need cancellation? -> AbortController + signal
```

### Common Timing Gotchas

```javascript
// setTimeout(fn, 0) is NOT truly 0ms -- minimum is ~1ms
// setImmediate is faster than setTimeout(fn, 0) inside I/O callbacks
// process.nextTick runs before ANY pending I/O
// Promise.resolve().then(fn) runs after nextTick but before I/O
// await splits the function: code after await is a microtask
```
