/**
 * ============================================================================
 * FILE 7: ASYNC PROGRAMMING IN NODE.JS
 * ============================================================================
 *
 * A comprehensive guide to asynchronous programming in Node.js, from
 * callbacks to streams, event loop internals, and modern async patterns.
 *
 * Run: node 07_async_programming.js
 * ============================================================================
 */

'use strict';

const { Readable, Writable, Transform, pipeline } = require('stream');
const { promisify } = require('util');
const { setTimeout: setTimeoutPromise } = require('timers/promises');

// ---------------------------------------------------------------------------
// Helper: section printer
// ---------------------------------------------------------------------------
const section = (title) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(72));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ===========================================================================
// 1. CALLBACKS AND CALLBACK HELL
// ===========================================================================
// The original async pattern in Node.js. Convention: callback(error, result).
// "Callback hell" = deeply nested callbacks that are hard to read/maintain.
// ===========================================================================

// Node-style callback function
function readFileCallback(filename, callback) {
  setTimeout(() => {
    if (filename === 'missing.txt') {
      callback(new Error('File not found'));
    } else {
      callback(null, `Contents of ${filename}`);
    }
  }, 10);
}

// Callback hell example (anti-pattern)
function callbackHellExample(done) {
  readFileCallback('config.json', (err, config) => {
    if (err) return done(err);
    readFileCallback('data.json', (err2, data) => {
      if (err2) return done(err2);
      readFileCallback('template.html', (err3, template) => {
        if (err3) return done(err3);
        done(null, { config, data, template });
      });
    });
  });
}

// Fix: convert to promise
function readFilePromise(filename) {
  return new Promise((resolve, reject) => {
    readFileCallback(filename, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Or use util.promisify
const readFilePromisified = promisify(readFileCallback);

// ===========================================================================
// 2. PROMISES: CREATION, CHAINING, ERROR HANDLING
// ===========================================================================
// Promises represent the eventual result of an async operation.
// States: pending -> fulfilled OR rejected (settled = fulfilled | rejected).
// ===========================================================================

// --- 2a. Creating promises ---
function fetchData(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id <= 0) reject(new Error(`Invalid ID: ${id}`));
      else resolve({ id, name: `Item_${id}`, value: id * 10 });
    }, 10);
  });
}

// --- 2b. Chaining ---
function chainExample() {
  return fetchData(1)
    .then((item) => {
      console.log(`    Step 1: fetched ${item.name}`);
      return fetchData(item.id + 1);
    })
    .then((item) => {
      console.log(`    Step 2: fetched ${item.name}`);
      return item.value;
    })
    .then((value) => {
      console.log(`    Step 3: final value = ${value}`);
      return value;
    });
}

// --- 2c. Error handling ---
function errorHandlingExample() {
  return fetchData(-1)
    .then((item) => {
      // This won't run
      console.log('This should not print');
    })
    .catch((err) => {
      console.log(`    Caught: ${err.message}`);
      return 'fallback value'; // recovery
    })
    .then((result) => {
      console.log(`    After catch: ${result}`);
    })
    .finally(() => {
      console.log('    Finally: cleanup runs regardless');
    });
}

// ===========================================================================
// 3. PROMISE COMBINATORS: all, race, allSettled, any
// ===========================================================================
// These combine multiple promises in different ways.
// ===========================================================================

async function promiseCombinators() {
  const tasks = [
    () => sleep(30).then(() => 'A'),
    () => sleep(10).then(() => 'B'),
    () => sleep(20).then(() => 'C'),
  ];

  // Promise.all: wait for ALL to succeed (fails fast on first rejection)
  const all = await Promise.all(tasks.map((t) => t()));
  console.log(`    Promise.all:        [${all}] (all results)`);

  // Promise.race: first to settle (resolve or reject) wins
  const race = await Promise.race(tasks.map((t) => t()));
  console.log(`    Promise.race:       ${race} (fastest)`);

  // Promise.allSettled: wait for ALL, never rejects, returns status objects
  const mixedTasks = [
    sleep(10).then(() => 'ok'),
    sleep(5).then(() => { throw new Error('fail'); }),
  ];
  const allSettled = await Promise.allSettled(mixedTasks);
  console.log(`    Promise.allSettled: ${JSON.stringify(allSettled.map((r) => r.status))}`);

  // Promise.any: first to SUCCEED (ignores rejections until all fail)
  const anyResult = await Promise.any([
    sleep(30).then(() => { throw new Error('slow fail'); }),
    sleep(10).then(() => 'fast success'),
    sleep(50).then(() => 'slower success'),
  ]);
  console.log(`    Promise.any:        ${anyResult} (first success)`);

  // Promise.any with all failures -> AggregateError
  try {
    await Promise.any([
      Promise.reject(new Error('err1')),
      Promise.reject(new Error('err2')),
    ]);
  } catch (e) {
    console.log(`    Promise.any (all fail): AggregateError with ${e.errors.length} errors`);
  }
}

// ===========================================================================
// 4. ASYNC/AWAIT: ERROR HANDLING, PARALLEL EXECUTION
// ===========================================================================
// async/await is syntactic sugar over promises, making async code look sync.
// ===========================================================================

// --- 4a. Basic async/await ---
async function basicAsyncAwait() {
  const item = await fetchData(1);
  console.log(`    Fetched: ${item.name}`);
  return item;
}

// --- 4b. Error handling with try/catch ---
async function asyncErrorHandling() {
  try {
    const item = await fetchData(-1);
    return item;
  } catch (err) {
    console.log(`    Caught async error: ${err.message}`);
    return null;
  } finally {
    console.log('    Async finally block');
  }
}

// --- 4c. Sequential vs parallel ---
async function sequentialVsParallel() {
  // SEQUENTIAL: each waits for the previous (slow!)
  const seqStart = performance.now();
  const a = await sleep(30).then(() => 'A');
  const b = await sleep(30).then(() => 'B');
  const c = await sleep(30).then(() => 'C');
  const seqTime = (performance.now() - seqStart).toFixed(0);
  console.log(`    Sequential [${a},${b},${c}]: ~${seqTime}ms`);

  // PARALLEL: start all at once, await together (fast!)
  const parStart = performance.now();
  const [x, y, z] = await Promise.all([
    sleep(30).then(() => 'X'),
    sleep(30).then(() => 'Y'),
    sleep(30).then(() => 'Z'),
  ]);
  const parTime = (performance.now() - parStart).toFixed(0);
  console.log(`    Parallel   [${x},${y},${z}]: ~${parTime}ms`);
}

// --- 4d. Async IIFE pattern ---
// (async () => { ... })();  // top-level await alternative for CJS

// ===========================================================================
// 5. ASYNC ITERATORS AND FOR-AWAIT-OF
// ===========================================================================
// Async iterators produce values asynchronously. They implement
// Symbol.asyncIterator and return { value, done } promises.
// ===========================================================================

// --- 5a. Custom async iterable ---
class AsyncRange {
  #start;
  #end;
  #delayMs;

  constructor(start, end, delayMs = 10) {
    this.#start = start;
    this.#end = end;
    this.#delayMs = delayMs;
  }

  async *[Symbol.asyncIterator]() {
    for (let i = this.#start; i <= this.#end; i++) {
      await sleep(this.#delayMs);
      yield i;
    }
  }
}

// --- 5b. Async generator for paginated API ---
async function* fetchPages(totalPages = 3) {
  for (let page = 1; page <= totalPages; page++) {
    await sleep(10); // simulate network
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: (page - 1) * 3 + i + 1,
      name: `Item ${(page - 1) * 3 + i + 1}`,
    }));
    yield { page, items, hasMore: page < totalPages };
  }
}

// --- 5c. Combine async iterables ---
async function* merge(...iterables) {
  const iterators = iterables.map((it) => it[Symbol.asyncIterator]());
  const promises = iterators.map((iter, i) =>
    iter.next().then((result) => ({ index: i, result }))
  );

  while (promises.length > 0) {
    const { index, result } = await Promise.race(promises);
    if (result.done) {
      promises.splice(index, 1);
      // Reindex remaining
      continue;
    }
    yield result.value;
    promises[index] = iterators[index].next().then((r) => ({ index, result: r }));
  }
}

// ===========================================================================
// 6. NODE.JS STREAMS: Readable, Writable, Transform, pipeline()
// ===========================================================================
// Streams process data in chunks, enabling handling of large data without
// loading it all into memory.
// ===========================================================================

// --- 6a. Custom Readable stream ---
class NumberStream extends Readable {
  #current;
  #max;

  constructor(max = 5) {
    super({ objectMode: true });
    this.#current = 1;
    this.#max = max;
  }

  _read() {
    if (this.#current > this.#max) {
      this.push(null); // signal end
    } else {
      this.push({ number: this.#current, squared: this.#current ** 2 });
      this.#current++;
    }
  }
}

// --- 6b. Custom Writable stream ---
class CollectorStream extends Writable {
  #items = [];

  constructor() {
    super({ objectMode: true });
  }

  _write(chunk, _encoding, callback) {
    this.#items.push(chunk);
    callback(); // signal done processing this chunk
  }

  get items() { return [...this.#items]; }
}

// --- 6c. Custom Transform stream ---
class DoubleTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, _encoding, callback) {
    callback(null, {
      ...chunk,
      doubled: chunk.number * 2,
      isEven: chunk.number % 2 === 0,
    });
  }
}

// --- 6d. Readable.from() for creating streams from iterables ---
function createStreamFromArray(arr) {
  return Readable.from(arr);
}

// --- 6e. Pipeline (recommended way to connect streams) ---
async function streamPipelineDemo() {
  const results = [];

  const source = new NumberStream(5);
  const transform = new DoubleTransform();
  const sink = new Writable({
    objectMode: true,
    write(chunk, _enc, cb) {
      results.push(chunk);
      cb();
    },
  });

  await new Promise((resolve, reject) => {
    pipeline(source, transform, sink, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return results;
}

// ===========================================================================
// 7. STREAM BACKPRESSURE HANDLING
// ===========================================================================
// Backpressure occurs when a writable stream can't keep up with a readable.
// If ignored, data accumulates in memory. The stream API handles this via
// the return value of .push() and .write(), and 'drain' events.
// ===========================================================================

class SlowConsumer extends Writable {
  #count = 0;

  constructor() {
    super({
      objectMode: true,
      highWaterMark: 2, // tiny buffer to trigger backpressure
    });
  }

  _write(chunk, _encoding, callback) {
    this.#count++;
    // Simulate slow processing
    setTimeout(() => callback(), 5);
  }

  get processedCount() { return this.#count; }
}

async function backpressureDemo() {
  const source = new NumberStream(10);
  const slow = new SlowConsumer();

  return new Promise((resolve, reject) => {
    pipeline(source, slow, (err) => {
      if (err) reject(err);
      else resolve(slow.processedCount);
    });
  });
}

// ===========================================================================
// 8. ABORTCONTROLLER AND CANCELLATION
// ===========================================================================
// AbortController provides a standard mechanism to cancel async operations.
// It works with fetch, streams, setTimeout (timers/promises), and custom code.
// ===========================================================================

async function cancellableOperation(signal) {
  for (let i = 0; i < 10; i++) {
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    await sleep(20);
  }
  return 'completed';
}

async function abortControllerDemo() {
  // Cancel after 50ms
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);

  try {
    const result = await cancellableOperation(controller.signal);
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`    Operation aborted: ${err.message}`);
      return 'aborted';
    }
    throw err;
  }
}

// AbortController with timers/promises (Node.js 16+)
async function cancellableTimeout() {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 30);

  try {
    await setTimeoutPromise(100, 'done', { signal: ac.signal });
    return 'completed';
  } catch (err) {
    if (err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

// ===========================================================================
// 9. EVENT LOOP PHASES IN DETAIL
// ===========================================================================
// The Node.js event loop has these phases (libuv):
//
//   1. TIMERS        - Execute setTimeout/setInterval callbacks
//   2. PENDING I/O   - Execute I/O callbacks deferred from previous cycle
//   3. IDLE/PREPARE  - Internal use only
//   4. POLL          - Retrieve new I/O events; execute I/O callbacks
//   5. CHECK         - Execute setImmediate() callbacks
//   6. CLOSE         - Execute close event callbacks (e.g., socket.on('close'))
//
// Between each phase, Node.js processes:
//   - process.nextTick queue (highest priority microtask)
//   - Promise microtask queue
//
// Order: nextTick > microtasks (Promises) > macrotasks (timers, I/O, etc.)
// ===========================================================================

function eventLoopDemo() {
  return new Promise((resolve) => {
    const order = [];

    // Macrotask: timers phase
    setTimeout(() => order.push('1. setTimeout(0)'), 0);

    // Macrotask: check phase
    setImmediate(() => order.push('2. setImmediate'));

    // Microtask: nextTick (runs before promises)
    process.nextTick(() => order.push('3. nextTick'));

    // Microtask: promise
    Promise.resolve().then(() => order.push('4. Promise.resolve'));

    // Microtask: queueMicrotask (same queue as promises)
    queueMicrotask(() => order.push('5. queueMicrotask'));

    // Nested nextTick (runs before other microtasks)
    process.nextTick(() => {
      process.nextTick(() => order.push('6. nested nextTick'));
    });

    // Let everything settle
    setTimeout(() => {
      resolve(order);
    }, 50);
  });
}

// ===========================================================================
// 10. process.nextTick vs queueMicrotask vs setImmediate
// ===========================================================================
// process.nextTick:
//   - Node.js specific, runs BEFORE other microtasks
//   - Starves the event loop if used recursively (dangerous)
//
// queueMicrotask:
//   - Web standard, runs after nextTick but before macrotasks
//   - Same queue as Promise callbacks
//
// setImmediate:
//   - Runs in the "check" phase of the event loop
//   - After I/O events are processed
//   - Like setTimeout(fn, 0) but more predictable in I/O callbacks
// ===========================================================================

function microtaskOrderDemo() {
  return new Promise((resolve) => {
    const log = [];

    process.nextTick(() => log.push('nextTick 1'));
    queueMicrotask(() => log.push('queueMicrotask 1'));
    Promise.resolve().then(() => log.push('Promise 1'));
    process.nextTick(() => log.push('nextTick 2'));
    queueMicrotask(() => log.push('queueMicrotask 2'));

    // Resolve after everything settles
    setTimeout(() => resolve(log), 20);
  });
}

// ===========================================================================
// 11. TOP-LEVEL AWAIT
// ===========================================================================
// In ES modules (.mjs or "type":"module" in package.json), you can use
// await at the top level without wrapping in an async function.
//
// In CJS (this file), we use async IIFE. Demonstrating the concept:
// ===========================================================================
// In an .mjs file:
//   const data = await fetchData(1);
//   console.log(data);
//
// Benefits: cleaner initialization, conditional imports, etc.
// Caveat: blocks downstream importers until the promise settles.

// ===========================================================================
// 12. ASYNC ERROR PATTERNS AND UNHANDLED REJECTIONS
// ===========================================================================
// Common pitfalls and best practices for async error handling.
// ===========================================================================

// --- 12a. Unhandled rejection handler ---
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection:', reason);
//   // Gracefully shutdown or log
// });

// --- 12b. Safe async wrapper ---
function safeAsync(fn) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`[safeAsync] ${fn.name} failed:`, err.message);
      return null;
    }
  };
}

// --- 12c. Error-first pattern for async/await ---
async function to(promise) {
  try {
    const result = await promise;
    return [null, result];
  } catch (err) {
    return [err, null];
  }
}

// --- 12d. Retry with exponential backoff ---
async function retryWithBackoff(fn, { maxRetries = 3, baseDelay = 50 } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelay * 2 ** (attempt - 1);
      console.log(`    Retry ${attempt}/${maxRetries}, waiting ${delay}ms...`);
      await sleep(delay);
    }
  }
}

// ===========================================================================
// 13. ASYNC RESOURCE MANAGEMENT (using / Symbol.dispose)
// ===========================================================================
// ES2024 explicit resource management: `using` keyword with Symbol.dispose
// and Symbol.asyncDispose for automatic cleanup.
//
// Note: Requires Node.js 22+ with --experimental-vm-modules or newer.
// We show the pattern here; actual `using` syntax may need flags.
// ===========================================================================

// Manual implementation of disposable pattern
class DatabaseConnection {
  #connected = false;
  #name;

  constructor(name) {
    this.#name = name;
  }

  async connect() {
    this.#connected = true;
    console.log(`    [${this.#name}] Connected`);
    return this;
  }

  async query(sql) {
    if (!this.#connected) throw new Error('Not connected');
    return `[${this.#name}] Result of: ${sql}`;
  }

  // Symbol.asyncDispose — for `await using`
  async [Symbol.asyncDispose]() {
    if (this.#connected) {
      this.#connected = false;
      console.log(`    [${this.#name}] Connection closed (auto-disposed)`);
    }
  }

  // Manual close for environments without `using`
  async close() {
    await this[Symbol.asyncDispose]();
  }
}

// Helper: simulate `await using` for older runtimes
async function withResource(createFn, useFn) {
  const resource = await createFn();
  try {
    return await useFn(resource);
  } finally {
    if (Symbol.asyncDispose in resource) {
      await resource[Symbol.asyncDispose]();
    } else if (typeof resource.close === 'function') {
      await resource.close();
    }
  }
}

// ===========================================================================
// 14. PRACTICAL: ASYNC QUEUE & RATE-LIMITED FETCHER
// ===========================================================================

// --- 14a. Async queue with concurrency control ---
class AsyncQueue {
  #concurrency;
  #running = 0;
  #queue = [];
  #results = [];

  constructor(concurrency = 3) {
    this.#concurrency = concurrency;
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      this.#processNext();
    });
  }

  async #processNext() {
    if (this.#running >= this.#concurrency || this.#queue.length === 0) return;

    this.#running++;
    const { task, resolve, reject } = this.#queue.shift();

    try {
      const result = await task();
      this.#results.push(result);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.#running--;
      this.#processNext();
    }
  }

  async drain() {
    // Wait until all queued tasks complete
    while (this.#queue.length > 0 || this.#running > 0) {
      await sleep(5);
    }
    return this.#results;
  }

  get pending() { return this.#queue.length; }
  get active() { return this.#running; }
}

// --- 14b. Rate-limited fetcher ---
class RateLimiter {
  #maxRequests;
  #windowMs;
  #timestamps = [];

  constructor(maxRequests = 5, windowMs = 1000) {
    this.#maxRequests = maxRequests;
    this.#windowMs = windowMs;
  }

  async acquire() {
    while (true) {
      const now = Date.now();
      // Remove expired timestamps
      this.#timestamps = this.#timestamps.filter((t) => now - t < this.#windowMs);

      if (this.#timestamps.length < this.#maxRequests) {
        this.#timestamps.push(now);
        return;
      }

      // Wait until the oldest request expires
      const oldestTimestamp = this.#timestamps[0];
      const waitTime = this.#windowMs - (now - oldestTimestamp) + 1;
      await sleep(waitTime);
    }
  }
}

class RateLimitedFetcher {
  #limiter;
  #queue;

  constructor({ maxConcurrent = 3, rateLimit = 10, windowMs = 1000 } = {}) {
    this.#limiter = new RateLimiter(rateLimit, windowMs);
    this.#queue = new AsyncQueue(maxConcurrent);
  }

  async fetch(url) {
    return this.#queue.enqueue(async () => {
      await this.#limiter.acquire();
      // Simulate fetch
      await sleep(10);
      return { url, status: 200, data: `Response from ${url}` };
    });
  }

  async fetchAll(urls) {
    return Promise.allSettled(urls.map((url) => this.fetch(url)));
  }
}

// --- 14c. Semaphore (general concurrency primitive) ---
class Semaphore {
  #permits;
  #waiting = [];

  constructor(permits) {
    this.#permits = permits;
  }

  async acquire() {
    if (this.#permits > 0) {
      this.#permits--;
      return;
    }
    return new Promise((resolve) => {
      this.#waiting.push(resolve);
    });
  }

  release() {
    const next = this.#waiting.shift();
    if (next) {
      next();
    } else {
      this.#permits++;
    }
  }

  // Use with try/finally:
  // await sem.acquire();
  // try { ... } finally { sem.release(); }
}

// ===========================================================================
// DEMO / TEST SECTION
// ===========================================================================

async function runDemos() {
  // ---- 1. Callbacks ----
  section('1. CALLBACKS AND CALLBACK HELL');

  console.log('  Callback-style read:');
  await new Promise((resolve) => {
    readFileCallback('data.json', (err, result) => {
      console.log(`    ${err ? 'Error: ' + err.message : result}`);
      resolve();
    });
  });

  console.log('  Promisified:');
  const content = await readFilePromisified('data.json');
  console.log(`    ${content}`);

  console.log('  Error handling:');
  try {
    await readFilePromisified('missing.txt');
  } catch (e) {
    console.log(`    Caught: ${e.message}`);
  }

  // ---- 2. Promises ----
  section('2. PROMISES: CREATION, CHAINING, ERROR HANDLING');

  console.log('  Chaining:');
  await chainExample();

  console.log('\n  Error handling:');
  await errorHandlingExample();

  // ---- 3. Promise combinators ----
  section('3. PROMISE COMBINATORS');
  await promiseCombinators();

  // ---- 4. Async/Await ----
  section('4. ASYNC/AWAIT');

  console.log('  Basic:');
  await basicAsyncAwait();

  console.log('  Error handling:');
  await asyncErrorHandling();

  console.log('  Sequential vs Parallel:');
  await sequentialVsParallel();

  console.log('\n  Error-first tuple pattern [err, result]:');
  const [err, result] = await to(fetchData(1));
  console.log(`    [${err}, ${JSON.stringify(result)}]`);
  const [err2, result2] = await to(fetchData(-1));
  console.log(`    [${err2?.message}, ${result2}]`);

  // ---- 5. Async iterators ----
  section('5. ASYNC ITERATORS AND FOR-AWAIT-OF');

  console.log('  AsyncRange(1, 5):');
  const rangeItems = [];
  for await (const n of new AsyncRange(1, 5, 5)) {
    rangeItems.push(n);
  }
  console.log(`    ${JSON.stringify(rangeItems)}`);

  console.log('\n  Paginated API:');
  for await (const page of fetchPages(3)) {
    console.log(`    Page ${page.page}: ${page.items.map((i) => i.name).join(', ')} (hasMore: ${page.hasMore})`);
  }

  // ---- 6. Streams ----
  section('6. NODE.JS STREAMS');

  console.log('  Pipeline (NumberStream -> DoubleTransform -> Collector):');
  const pipelineResults = await streamPipelineDemo();
  console.log(`    ${JSON.stringify(pipelineResults)}`);

  console.log('\n  Readable.from() with array:');
  const fromArray = [];
  const arrayStream = Readable.from(['hello', 'world', 'streams']);
  for await (const chunk of arrayStream) {
    fromArray.push(chunk);
  }
  console.log(`    ${JSON.stringify(fromArray)}`);

  // ---- 7. Backpressure ----
  section('7. STREAM BACKPRESSURE');

  const processed = await backpressureDemo();
  console.log(`  SlowConsumer processed ${processed} items with backpressure handled by pipeline()`);

  // ---- 8. AbortController ----
  section('8. ABORTCONTROLLER AND CANCELLATION');

  console.log('  Cancellable operation:');
  const abortResult = await abortControllerDemo();
  console.log(`    Result: ${abortResult}`);

  console.log('  Cancellable timeout:');
  const timeoutResult = await cancellableTimeout();
  console.log(`    Result: ${timeoutResult}`);

  // ---- 9. Event loop phases ----
  section('9. EVENT LOOP PHASES');

  console.log('  Execution order (numbered by registration, shown in actual order):');
  const order = await eventLoopDemo();
  order.forEach((item, i) => console.log(`    ${i + 1}. ${item}`));

  console.log('\n  Key insight:');
  console.log('    nextTick > Promise/queueMicrotask > setTimeout/setImmediate');

  // ---- 10. Microtask ordering ----
  section('10. process.nextTick vs queueMicrotask vs setImmediate');

  const microtaskOrder = await microtaskOrderDemo();
  microtaskOrder.forEach((item, i) => console.log(`    ${i + 1}. ${item}`));
  console.log('  Note: nextTick always runs before Promises and queueMicrotask');

  // ---- 11. Top-level await ----
  section('11. TOP-LEVEL AWAIT');
  console.log('  Top-level await works in ES modules (.mjs or "type":"module")');
  console.log('  Example:');
  console.log('    // In app.mjs');
  console.log('    const config = await loadConfig();');
  console.log('    const db = await connectDatabase(config);');
  console.log('    export { db };');
  console.log('  Note: Blocks downstream importers until resolved');

  // ---- 12. Async error patterns ----
  section('12. ASYNC ERROR PATTERNS');

  console.log('  Safe async wrapper:');
  const safeOp = safeAsync(async function riskyOperation() {
    throw new Error('something broke');
  });
  const safeResult = await safeOp();
  console.log(`    Result: ${safeResult} (null = handled failure)`);

  console.log('\n  Retry with backoff:');
  let retryCount = 0;
  try {
    await retryWithBackoff(async () => {
      retryCount++;
      if (retryCount < 3) throw new Error(`Attempt ${retryCount} failed`);
      return 'success';
    }, { maxRetries: 3, baseDelay: 20 });
    console.log(`    Succeeded after ${retryCount} attempts`);
  } catch (e) {
    console.log(`    Failed after all retries: ${e.message}`);
  }

  // ---- 13. Async resource management ----
  section('13. ASYNC RESOURCE MANAGEMENT');

  console.log('  Using withResource helper (simulates `await using`):');
  const queryResult = await withResource(
    async () => {
      const conn = new DatabaseConnection('MainDB');
      await conn.connect();
      return conn;
    },
    async (conn) => {
      return conn.query('SELECT * FROM users');
    }
  );
  console.log(`    Query result: ${queryResult}`);
  console.log('    Connection was auto-closed by dispose');

  // ---- 14. Async queue & rate limiter ----
  section('14. PRACTICAL: ASYNC QUEUE & RATE-LIMITED FETCHER');

  console.log('  Async queue (concurrency=2):');
  const queue = new AsyncQueue(2);

  const taskResults = [];
  const taskPromises = [];
  for (let i = 1; i <= 5; i++) {
    taskPromises.push(
      queue.enqueue(async () => {
        const startTime = Date.now();
        await sleep(20);
        const result = `Task ${i} done`;
        taskResults.push(result);
        return result;
      })
    );
  }

  await Promise.all(taskPromises);
  console.log(`    Completed: ${JSON.stringify(taskResults)}`);

  console.log('\n  Rate-limited fetcher:');
  const fetcher = new RateLimitedFetcher({ maxConcurrent: 2, rateLimit: 5, windowMs: 200 });
  const urls = Array.from({ length: 4 }, (_, i) => `https://api.example.com/data/${i + 1}`);
  const fetchStart = performance.now();
  const fetchResults = await fetcher.fetchAll(urls);
  const fetchTime = (performance.now() - fetchStart).toFixed(0);
  const successful = fetchResults.filter((r) => r.status === 'fulfilled').length;
  console.log(`    Fetched ${successful}/${urls.length} URLs in ~${fetchTime}ms`);

  console.log('\n  Semaphore example:');
  const sem = new Semaphore(2);
  const semResults = [];
  await Promise.all(
    [1, 2, 3, 4].map(async (id) => {
      await sem.acquire();
      try {
        await sleep(10);
        semResults.push(`Worker ${id} done`);
      } finally {
        sem.release();
      }
    })
  );
  console.log(`    ${JSON.stringify(semResults)}`);

  // ---- Summary ----
  section('SUMMARY');
  console.log(`
  Concept                   | Key Takeaway
  --------------------------|------------------------------------------------
  Callbacks                 | Error-first convention, promisify to modernize
  Promises                  | Chainable, .catch for errors, .finally for cleanup
  Combinators               | all (all succeed), race (first), allSettled, any
  async/await               | Sync-looking async code, try/catch for errors
  Async iterators           | for-await-of for streaming async data
  Streams                   | Process large data in chunks, use pipeline()
  Backpressure              | Let streams auto-regulate flow, use pipeline()
  AbortController           | Standard cancellation for async operations
  Event loop                | nextTick > microtasks > macrotasks
  Async resource mgmt       | Symbol.asyncDispose for auto-cleanup
  Async queue               | Control concurrency for parallel operations
  Rate limiter              | Respect API rate limits with token bucket
  `);
}

runDemos().catch(console.error);
