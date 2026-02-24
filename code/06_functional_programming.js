/**
 * ============================================================================
 * FILE 6: FUNCTIONAL PROGRAMMING IN NODE.JS
 * ============================================================================
 *
 * A deep dive into functional programming concepts with practical, idiomatic
 * JavaScript and Node.js examples. Every concept includes explanations,
 * implementations, and runnable demos.
 *
 * Run: node 06_functional_programming.js
 * ============================================================================
 */

'use strict';

// ---------------------------------------------------------------------------
// Helper: section printer
// ---------------------------------------------------------------------------
const section = (title) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(72));
};

// ===========================================================================
// 1. PURE FUNCTIONS AND SIDE EFFECTS
// ===========================================================================
// A pure function:
//   - Given the same inputs, always returns the same output (deterministic)
//   - Has no side effects (doesn't mutate external state, do I/O, etc.)
//
// Why it matters: pure functions are testable, cacheable, parallelizable,
//   and easy to reason about.
// ===========================================================================

// IMPURE: depends on external state, mutates it
let globalDiscount = 0.1;
function impureCalcPrice(price) {
  globalDiscount += 0.01; // side effect: mutates external state
  return price * (1 - globalDiscount); // depends on external state
}

// PURE: same input -> same output, no side effects
function pureCalcPrice(price, discount) {
  return price * (1 - discount);
}

// IMPURE: I/O is a side effect
function impureLog(message) {
  console.log(message); // side effect
  return message;
}

// Strategy: push side effects to the edges, keep core logic pure.
// "Functional core, imperative shell"
function formatLogMessage(level, message, timestamp) {
  return `[${level.toUpperCase()}] ${timestamp.toISOString()} - ${message}`;
}

// ===========================================================================
// 2. FIRST-CLASS AND HIGHER-ORDER FUNCTIONS
// ===========================================================================
// In JS, functions are first-class citizens: they can be assigned to variables,
// passed as arguments, returned from functions, and stored in data structures.
//
// A higher-order function (HOF) is one that takes a function as an argument
// and/or returns a function.
// ===========================================================================

// Functions as values
const greet = (name) => `Hello, ${name}!`;
const shout = (fn) => (name) => fn(name).toUpperCase();
const whisper = (fn) => (name) => fn(name).toLowerCase();

// HOF: takes a predicate, returns a new function
function createFilter(predicate) {
  return function (array) {
    return array.filter(predicate);
  };
}

const isEven = (n) => n % 2 === 0;
const isPositive = (n) => n > 0;
const filterEvens = createFilter(isEven);
const filterPositive = createFilter(isPositive);

// HOF: function that returns a function with "memory"
function createCounter(start = 0) {
  let count = start;
  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
}

// ===========================================================================
// 3. FUNCTION COMPOSITION (PIPE & COMPOSE)
// ===========================================================================
// Composition combines simple functions into complex ones.
//   compose(f, g)(x) = f(g(x))  — right to left
//   pipe(f, g)(x)    = g(f(x))  — left to right
//
// pipe is generally preferred because it reads like natural data flow.
// ===========================================================================

const pipe = (...fns) => (value) => fns.reduce((acc, fn) => fn(acc), value);
const compose = (...fns) => (value) => fns.reduceRight((acc, fn) => fn(acc), value);

// Async pipe for functions that may return promises
const pipeAsync = (...fns) => (value) =>
  fns.reduce((acc, fn) => Promise.resolve(acc).then(fn), value);

// Example: data transformation pipeline
const trim = (s) => s.trim();
const toLower = (s) => s.toLowerCase();
const splitWords = (s) => s.split(/\s+/);
const unique = (arr) => [...new Set(arr)];
const sortAlpha = (arr) => [...arr].sort();
const joinComma = (arr) => arr.join(', ');

const normalizeWords = pipe(trim, toLower, splitWords, unique, sortAlpha, joinComma);

// Compose example (right to left - reads bottom-up like math)
const processInput = compose(joinComma, sortAlpha, unique, splitWords, toLower, trim);

// ===========================================================================
// 4. CURRYING AND PARTIAL APPLICATION
// ===========================================================================
// Currying: transforms f(a, b, c) into f(a)(b)(c).
// Partial application: fix some arguments, get a new function for the rest.
//
// They enable creating specialized functions from general ones.
// ===========================================================================

// Manual currying
const curriedAdd = (a) => (b) => a + b;
const add10 = curriedAdd(10);

// Generic curry utility
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...args2) {
      return curried.apply(this, [...args, ...args2]);
    };
  };
}

// Generic partial application
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

// Practical uses
const multiply = curry((a, b) => a * b);
const double = multiply(2);
const triple = multiply(3);

const formatCurrency = curry((symbol, decimals, amount) =>
  `${symbol}${amount.toFixed(decimals)}`
);
const formatUSD = formatCurrency('$')(2);
const formatEUR = formatCurrency('\u20AC')(2);
const formatBTC = formatCurrency('\u20BF')(8);

// Curried map/filter for point-free composition
const map = curry((fn, arr) => arr.map(fn));
const filter = curry((fn, arr) => arr.filter(fn));
const reduce = curry((fn, init, arr) => arr.reduce(fn, init));

// ===========================================================================
// 5. IMMUTABILITY PATTERNS
// ===========================================================================
// Immutable data prevents accidental mutation bugs and makes code easier
// to reason about. JavaScript isn't immutable by default, but we have
// tools: Object.freeze, spread, structuredClone, and discipline.
// ===========================================================================

// --- 5a. Object.freeze (shallow) ---
function demonstrateFreeze() {
  const config = Object.freeze({
    host: 'localhost',
    port: 3000,
    db: { name: 'mydb' }, // nested object is NOT frozen
  });

  // config.port = 4000; // throws in strict mode, silently fails otherwise
  config.db.name = 'hacked'; // THIS WORKS — freeze is shallow

  return config;
}

// --- 5b. Deep freeze ---
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// --- 5c. Immutable updates with spread ---
function immutableUpdate(state, updates) {
  return { ...state, ...updates };
}

function immutableNestedUpdate(state, path, value) {
  const keys = path.split('.');
  if (keys.length === 1) return { ...state, [keys[0]]: value };

  return {
    ...state,
    [keys[0]]: immutableNestedUpdate(state[keys[0]] ?? {}, keys.slice(1).join('.'), value),
  };
}

// --- 5d. structuredClone (deep copy, ES2022+) ---
function demonstrateStructuredClone() {
  const original = {
    name: 'Alice',
    scores: [100, 95, 88],
    meta: { created: new Date(), tags: new Set(['a', 'b']) },
  };
  const clone = structuredClone(original);
  clone.scores.push(77);
  clone.name = 'Bob';
  return { original, clone };
}

// --- 5e. Persistent data structure (simple immutable list) ---
class ImmutableList {
  #items;

  constructor(items = []) {
    this.#items = Object.freeze([...items]);
  }

  push(item) { return new ImmutableList([...this.#items, item]); }
  pop() { return new ImmutableList(this.#items.slice(0, -1)); }
  set(index, value) {
    const copy = [...this.#items];
    copy[index] = value;
    return new ImmutableList(copy);
  }
  get(index) { return this.#items[index]; }
  toArray() { return [...this.#items]; }
  get length() { return this.#items.length; }
  [Symbol.iterator]() { return this.#items[Symbol.iterator](); }
}

// ===========================================================================
// 6. FUNCTORS AND MONADS (Maybe, Either/Result)
// ===========================================================================
// A Functor is any type that implements .map() — it "wraps" a value and
// lets you transform it while keeping the wrapper.
//
// A Monad adds .flatMap() (or .chain()) — enabling sequencing operations
// that themselves return wrapped values.
//
// Practical use: safe null handling (Maybe) and error handling (Either/Result).
// ===========================================================================

// --- 6a. Maybe monad (null-safe chaining) ---
class Maybe {
  #value;

  constructor(value) {
    this.#value = value;
  }

  static of(value) { return new Maybe(value); }
  static empty() { return new Maybe(null); }

  get isNothing() { return this.#value === null || this.#value === undefined; }

  map(fn) {
    return this.isNothing ? this : Maybe.of(fn(this.#value));
  }

  flatMap(fn) {
    return this.isNothing ? this : fn(this.#value);
  }

  getOrElse(defaultValue) {
    return this.isNothing ? defaultValue : this.#value;
  }

  filter(predicate) {
    if (this.isNothing) return this;
    return predicate(this.#value) ? this : Maybe.empty();
  }

  toString() {
    return this.isNothing ? 'Maybe(Nothing)' : `Maybe(${JSON.stringify(this.#value)})`;
  }
}

// --- 6b. Either/Result monad (error handling without exceptions) ---
class Result {
  #value;
  #error;
  #isOk;

  constructor(isOk, valueOrError) {
    this.#isOk = isOk;
    if (isOk) {
      this.#value = valueOrError;
      this.#error = null;
    } else {
      this.#value = null;
      this.#error = valueOrError;
    }
  }

  static ok(value) { return new Result(true, value); }
  static err(error) { return new Result(false, error); }

  // Wrap a function that might throw
  static fromTry(fn) {
    try {
      return Result.ok(fn());
    } catch (e) {
      return Result.err(e.message ?? String(e));
    }
  }

  static async fromAsync(fn) {
    try {
      return Result.ok(await fn());
    } catch (e) {
      return Result.err(e.message ?? String(e));
    }
  }

  get isOk() { return this.#isOk; }
  get isErr() { return !this.#isOk; }

  map(fn) {
    return this.#isOk ? Result.ok(fn(this.#value)) : this;
  }

  mapErr(fn) {
    return this.#isOk ? this : Result.err(fn(this.#error));
  }

  flatMap(fn) {
    return this.#isOk ? fn(this.#value) : this;
  }

  unwrap() {
    if (this.#isOk) return this.#value;
    throw new Error(`Unwrap called on Err: ${this.#error}`);
  }

  unwrapOr(defaultValue) {
    return this.#isOk ? this.#value : defaultValue;
  }

  match({ ok, err }) {
    return this.#isOk ? ok(this.#value) : err(this.#error);
  }

  toString() {
    return this.#isOk ? `Ok(${JSON.stringify(this.#value)})` : `Err(${this.#error})`;
  }
}

// --- Practical: pipeline with Result ---
function parseJSON(str) {
  return Result.fromTry(() => JSON.parse(str));
}

function validateUser(data) {
  if (!data.name) return Result.err('Name is required');
  if (!data.email) return Result.err('Email is required');
  if (!data.email.includes('@')) return Result.err('Invalid email');
  return Result.ok(data);
}

function normalizeUser(data) {
  return Result.ok({
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role ?? 'user',
  });
}

function processUserInput(jsonString) {
  return parseJSON(jsonString)
    .flatMap(validateUser)
    .flatMap(normalizeUser);
}

// ===========================================================================
// 7. MEMOIZATION AND CACHING
// ===========================================================================
// Memoization caches the result of a pure function call based on its
// arguments, avoiding redundant computation. Essential for expensive
// calculations, recursive algorithms, and API response caching.
// ===========================================================================

// --- 7a. Simple memoize ---
function memoize(fn) {
  const cache = new Map();
  const memoized = function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
  memoized.cache = cache;
  memoized.clearCache = () => cache.clear();
  return memoized;
}

// --- 7b. Memoize with TTL and max size (LRU-ish) ---
function memoizeWithOptions(fn, { maxSize = 100, ttlMs = Infinity } = {}) {
  const cache = new Map(); // Map preserves insertion order

  return function (...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && (Date.now() - cached.time < ttlMs)) {
      // Move to end (most recently used)
      cache.delete(key);
      cache.set(key, cached);
      return cached.value;
    }

    const result = fn.apply(this, args);
    cache.set(key, { value: result, time: Date.now() });

    // Evict oldest if over max size
    if (cache.size > maxSize) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return result;
  };
}

// --- 7c. Recursive example: Fibonacci ---
const fib = memoize(function fibonacci(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

// ===========================================================================
// 8. LAZY EVALUATION WITH GENERATORS
// ===========================================================================
// Generators produce values on demand (lazily). This is crucial for
// processing large/infinite datasets without loading everything into memory.
// ===========================================================================

// --- 8a. Infinite sequences ---
function* naturals(start = 1) {
  let n = start;
  while (true) yield n++;
}

function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// --- 8b. Lazy transformation operators ---
function* lazyMap(iterable, fn) {
  for (const item of iterable) yield fn(item);
}

function* lazyFilter(iterable, predicate) {
  for (const item of iterable) {
    if (predicate(item)) yield item;
  }
}

function* lazyTake(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count >= n) return;
    yield item;
    count++;
  }
}

function* lazyFlatMap(iterable, fn) {
  for (const item of iterable) yield* fn(item);
}

// Collect a lazy sequence into an array
function collect(iterable) {
  return [...iterable];
}

// --- 8c. Lazy pipeline helper ---
class LazySeq {
  #iterable;

  constructor(iterable) {
    this.#iterable = iterable;
  }

  static from(iterable) { return new LazySeq(iterable); }
  static of(...items) { return new LazySeq(items); }
  static range(start, end) {
    return new LazySeq(
      (function* () {
        for (let i = start; i < end; i++) yield i;
      })()
    );
  }

  map(fn) { return new LazySeq(lazyMap(this.#iterable, fn)); }
  filter(fn) { return new LazySeq(lazyFilter(this.#iterable, fn)); }
  take(n) { return new LazySeq(lazyTake(this.#iterable, n)); }
  flatMap(fn) { return new LazySeq(lazyFlatMap(this.#iterable, fn)); }
  collect() { return collect(this.#iterable); }

  reduce(fn, init) {
    let acc = init;
    for (const item of this.#iterable) acc = fn(acc, item);
    return acc;
  }

  forEach(fn) {
    for (const item of this.#iterable) fn(item);
  }

  [Symbol.iterator]() { return this.#iterable[Symbol.iterator](); }
}

// ===========================================================================
// 9. TRANSDUCERS CONCEPT
// ===========================================================================
// Transducers compose transformations WITHOUT creating intermediate arrays.
//   Normal: arr.map(f).filter(g).map(h) — creates 3 arrays
//   Transducer: compose(mapT(f), filterT(g), mapT(h)) — single pass
//
// A transducer is a function that takes a "reducer" and returns a new "reducer".
// ===========================================================================

// Transducer building blocks
const mapT = (fn) => (reducer) => (acc, item) => reducer(acc, fn(item));
const filterT = (pred) => (reducer) => (acc, item) => pred(item) ? reducer(acc, item) : acc;
const takeT = (n) => {
  let count = 0;
  return (reducer) => (acc, item) => {
    if (count >= n) return acc; // short-circuit ideally via reduced protocol
    count++;
    return reducer(acc, item);
  };
};

// Compose transducers (left to right — data flows left to right)
function composeTransducers(...xforms) {
  return (reducer) => xforms.reduceRight((r, xf) => xf(r), reducer);
}

// Apply a transducer to an array
function transduce(xform, reducer, init, coll) {
  const xReducer = xform(reducer);
  return coll.reduce(xReducer, init);
}

// Convenience: into array
function intoArray(xform, coll) {
  return transduce(xform, (acc, item) => { acc.push(item); return acc; }, [], coll);
}

// ===========================================================================
// 10. POINT-FREE STYLE
// ===========================================================================
// Point-free (tacit) programming avoids explicitly mentioning the arguments.
// It's about composing functions rather than manipulating data directly.
//
// Not always more readable, but useful in pipelines and composition.
// ===========================================================================

// Instead of: (x) => x.toUpperCase()
const toUpper = (s) => s.toUpperCase();
// Instead of: (x) => x.length
const length = (s) => s.length;
// Instead of: (x) => x > 3
const gt = curry((threshold, x) => x > threshold);
const lt = curry((threshold, x) => x < threshold);
const eq = curry((a, b) => a === b);
const prop = curry((key, obj) => obj[key]);
const not = (fn) => (...args) => !fn(...args);

// Point-free composition
const getNameLength = pipe(prop('name'), length);
const isLongName = pipe(getNameLength, gt(5));

// ===========================================================================
// 11. PRACTICAL FP: ERROR HANDLING WITH RESULT, DATA PIPELINES
// ===========================================================================

// --- 11a. Result-based API client ---
class ApiClient {
  static async fetchUser(id) {
    // Simulate API call
    if (id <= 0) return Result.err('Invalid user ID');
    if (id > 100) return Result.err('User not found');
    return Result.ok({
      id,
      name: `User_${id}`,
      email: `user${id}@example.com`,
      age: 20 + (id % 40),
    });
  }

  static async fetchOrders(userId) {
    return Result.ok([
      { id: 1, userId, total: 49.99 },
      { id: 2, userId, total: 129.00 },
    ]);
  }
}

// Pipeline: fetch user -> fetch orders -> calculate total
async function getUserOrderTotal(userId) {
  const userResult = await ApiClient.fetchUser(userId);
  return userResult
    .flatMap((user) => Result.ok(user.id))
    .match({
      ok: async (id) => {
        const ordersResult = await ApiClient.fetchOrders(id);
        return ordersResult
          .map((orders) => orders.reduce((sum, o) => sum + o.total, 0))
          .map((total) => ({ userId: id, total }));
      },
      err: (e) => Result.err(e),
    });
}

// --- 11b. Data pipeline (ETL-style) ---
function buildDataPipeline(records) {
  const isActive = (r) => r.status === 'active';
  const hasEmail = (r) => r.email?.includes('@');
  const toSummary = (r) => ({
    name: r.name,
    email: r.email.toLowerCase(),
    value: r.purchases.reduce((s, p) => s + p.amount, 0),
  });
  const byValueDesc = (a, b) => b.value - a.value;

  return records
    .filter(isActive)
    .filter(hasEmail)
    .map(toSummary)
    .sort(byValueDesc);
}

// ===========================================================================
// 12. ARRAY METHOD CHAINING VS REDUCE
// ===========================================================================
// .map().filter().reduce() creates intermediate arrays.
// A single .reduce() can do everything in one pass. Trade-off: readability
// vs performance.
// ===========================================================================

function chainingVsReduce(numbers) {
  // Chaining: clear but creates 2 intermediate arrays
  const chainingResult = numbers
    .filter((n) => n % 2 === 0)
    .map((n) => n ** 2)
    .reduce((sum, n) => sum + n, 0);

  // Single reduce: one pass, no intermediate arrays
  const reduceResult = numbers.reduce((sum, n) => {
    if (n % 2 === 0) return sum + n ** 2;
    return sum;
  }, 0);

  return { chainingResult, reduceResult };
}

// Reduce as a swiss-army knife
const groupBy = curry((keyFn, arr) =>
  arr.reduce((groups, item) => {
    const key = keyFn(item);
    return { ...groups, [key]: [...(groups[key] ?? []), item] };
  }, {})
);

const countBy = curry((keyFn, arr) =>
  arr.reduce((counts, item) => {
    const key = keyFn(item);
    return { ...counts, [key]: (counts[key] ?? 0) + 1 };
  }, {})
);

const indexBy = curry((keyFn, arr) =>
  arr.reduce((index, item) => ({ ...index, [keyFn(item)]: item }), {})
);

// ===========================================================================
// 13. LODASH/FP-STYLE PATTERNS (without lodash)
// ===========================================================================

// --- 13a. get (safe deep property access) ---
function get(obj, path, defaultValue = undefined) {
  const keys = typeof path === 'string' ? path.split('.') : path;
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) return defaultValue;
  }
  return result;
}

// --- 13b. set (immutable deep set) ---
function set(obj, path, value) {
  const keys = typeof path === 'string' ? path.split('.') : path;
  if (keys.length === 0) return value;
  const [head, ...rest] = keys;
  return {
    ...obj,
    [head]: rest.length === 0 ? value : set(obj?.[head] ?? {}, rest, value),
  };
}

// --- 13c. pick / omit ---
const pick = (keys, obj) =>
  keys.reduce((acc, key) => (key in obj ? { ...acc, [key]: obj[key] } : acc), {});

const omit = (keys, obj) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

// --- 13d. chunk ---
const chunk = (size, arr) =>
  arr.reduce((chunks, item, i) => {
    const chunkIndex = Math.floor(i / size);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(item);
    return chunks;
  }, []);

// --- 13e. zip ---
const zip = (...arrays) =>
  arrays[0].map((_, i) => arrays.map((arr) => arr[i]));

// --- 13f. flatten / flattenDeep ---
const flattenDeep = (arr) =>
  arr.reduce((flat, item) =>
    Array.isArray(item) ? [...flat, ...flattenDeep(item)] : [...flat, item], []);

// --- 13g. debounce / throttle ---
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function throttle(fn, ms) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// --- 13h. flow (like pipe but takes initial args) ---
const flow = (...fns) => (...args) => {
  const [first, ...rest] = fns;
  return rest.reduce((acc, fn) => fn(acc), first(...args));
};

// ===========================================================================
// DEMO / TEST SECTION
// ===========================================================================

async function runDemos() {
  // ---- 1. Pure functions ----
  section('1. PURE FUNCTIONS AND SIDE EFFECTS');

  console.log('  Impure (non-deterministic):');
  console.log(`    impureCalcPrice(100) = ${impureCalcPrice(100).toFixed(2)}`);
  console.log(`    impureCalcPrice(100) = ${impureCalcPrice(100).toFixed(2)} (different!)`);

  console.log('  Pure (deterministic):');
  console.log(`    pureCalcPrice(100, 0.1) = ${pureCalcPrice(100, 0.1).toFixed(2)}`);
  console.log(`    pureCalcPrice(100, 0.1) = ${pureCalcPrice(100, 0.1).toFixed(2)} (same!)`);

  console.log('  Functional core:');
  const msg = formatLogMessage('info', 'Server started', new Date(2025, 0, 1));
  console.log(`    ${msg}`);

  // ---- 2. First-class and HOF ----
  section('2. FIRST-CLASS AND HIGHER-ORDER FUNCTIONS');

  const shoutGreet = shout(greet);
  const whisperGreet = whisper(greet);
  console.log(`  greet('World')        = ${greet('World')}`);
  console.log(`  shout(greet)('World') = ${shoutGreet('World')}`);
  console.log(`  whisper(greet)('World') = ${whisperGreet('World')}`);

  const nums = [-3, -1, 0, 2, 4, 5, 7, 8];
  console.log(`  filterEvens(${JSON.stringify(nums)}) = ${JSON.stringify(filterEvens(nums))}`);
  console.log(`  filterPositive(${JSON.stringify(nums)}) = ${JSON.stringify(filterPositive(nums))}`);

  const counter = createCounter(10);
  console.log(`  counter: ${counter.increment()}, ${counter.increment()}, ${counter.decrement()}`);

  // ---- 3. Composition ----
  section('3. FUNCTION COMPOSITION (PIPE & COMPOSE)');

  const input = '  Hello World Hello foo Bar FOO  ';
  console.log(`  Input: "${input}"`);
  console.log(`  pipe(trim, toLower, splitWords, unique, sortAlpha, joinComma):`);
  console.log(`    "${normalizeWords(input)}"`);
  console.log(`  compose (same functions, same result):`);
  console.log(`    "${processInput(input)}"`);

  // Async pipe
  const asyncPipeline = pipeAsync(
    (x) => x * 2,
    async (x) => x + 10,
    (x) => x.toString(),
  );
  const asyncResult = await asyncPipeline(5);
  console.log(`  Async pipe: pipeAsync(x*2, x+10, toString)(5) = "${asyncResult}"`);

  // ---- 4. Currying & Partial Application ----
  section('4. CURRYING AND PARTIAL APPLICATION');

  console.log(`  curriedAdd(10)(5) = ${curriedAdd(10)(5)}`);
  console.log(`  add10(5) = ${add10(5)}`);
  console.log(`  double(7) = ${double(7)}`);
  console.log(`  triple(7) = ${triple(7)}`);
  console.log(`  formatUSD(99.5) = ${formatUSD(99.5)}`);
  console.log(`  formatEUR(99.5) = ${formatEUR(99.5)}`);
  console.log(`  formatBTC(0.00045) = ${formatBTC(0.00045)}`);

  // Curried map/filter in composition
  const doubleAll = map((x) => x * 2);
  const keepPositive = filter((x) => x > 0);
  const processNums = pipe(keepPositive, doubleAll);
  console.log(`  processNums([-1, 2, -3, 4]) = ${JSON.stringify(processNums([-1, 2, -3, 4]))}`);

  // ---- 5. Immutability ----
  section('5. IMMUTABILITY PATTERNS');

  console.log('  Object.freeze (shallow):');
  const frozen = demonstrateFreeze();
  console.log(`    config.db.name after mutation: "${frozen.db.name}" (freeze is shallow!)`);

  console.log('  Deep freeze:');
  const deepFrozen = deepFreeze({ a: { b: { c: 42 } } });
  try {
    deepFrozen.a.b.c = 0;
  } catch (e) {
    console.log(`    Mutation threw: ${e.message}`);
  }

  console.log('  Immutable updates:');
  const state = { name: 'Alice', age: 30, address: { city: 'NYC' } };
  const updated = immutableNestedUpdate(state, 'address.city', 'LA');
  console.log(`    Original city: ${state.address.city}`);
  console.log(`    Updated city:  ${updated.address.city}`);
  console.log(`    Same object?   ${state === updated}`);

  console.log('  structuredClone:');
  const { original, clone } = demonstrateStructuredClone();
  console.log(`    Original scores: ${JSON.stringify(original.scores)}`);
  console.log(`    Clone scores:    ${JSON.stringify(clone.scores)} (has extra 77)`);

  console.log('  ImmutableList:');
  const list = new ImmutableList([1, 2, 3]);
  const list2 = list.push(4);
  const list3 = list2.set(0, 99);
  console.log(`    list:  ${JSON.stringify(list.toArray())}`);
  console.log(`    list2: ${JSON.stringify(list2.toArray())} (new instance)`);
  console.log(`    list3: ${JSON.stringify(list3.toArray())} (new instance)`);

  // ---- 6. Functors and Monads ----
  section('6. FUNCTORS AND MONADS (Maybe, Either/Result)');

  console.log('  Maybe monad:');
  const user = { name: 'Alice', address: { street: '123 Main St', city: 'NYC' } };
  const city = Maybe.of(user)
    .map(prop('address'))
    .map(prop('city'))
    .map(toUpper)
    .getOrElse('Unknown');
  console.log(`    City: ${city}`);

  const noUser = null;
  const noCity = Maybe.of(noUser)
    .map(prop('address'))
    .map(prop('city'))
    .getOrElse('Unknown');
  console.log(`    No user -> city: ${noCity}`);

  console.log('\n  Result monad:');
  const good = processUserInput('{"name": "Bob", "email": "bob@test.com"}');
  const bad1 = processUserInput('not json');
  const bad2 = processUserInput('{"name": "Bob"}');
  console.log(`    Valid:   ${good}`);
  console.log(`    Bad JSON: ${bad1}`);
  console.log(`    Missing email: ${bad2}`);

  console.log('\n  Result.match:');
  good.match({
    ok: (val) => console.log(`    Ok: ${JSON.stringify(val)}`),
    err: (e) => console.log(`    Err: ${e}`),
  });

  // ---- 7. Memoization ----
  section('7. MEMOIZATION AND CACHING');

  console.log('  Fibonacci with memoization:');
  const start = performance.now();
  const fib40 = fib(40);
  const elapsed = (performance.now() - start).toFixed(3);
  console.log(`    fib(40) = ${fib40} (${elapsed}ms, cache size: ${fib.cache.size})`);

  console.log('  Memoize with TTL:');
  let callCount = 0;
  const expensive = memoizeWithOptions(
    (x) => { callCount++; return x ** 2; },
    { maxSize: 5, ttlMs: 1000 }
  );
  expensive(5); expensive(5); expensive(5);
  console.log(`    expensive(5) called 3 times, actual invocations: ${callCount}`);

  // ---- 8. Lazy evaluation ----
  section('8. LAZY EVALUATION WITH GENERATORS');

  console.log('  First 10 Fibonacci numbers (lazy):');
  const first10Fib = collect(lazyTake(fibonacci(), 10));
  console.log(`    ${JSON.stringify(first10Fib)}`);

  console.log('  Lazy pipeline: first 5 even squares from naturals:');
  const result = LazySeq.from(naturals())
    .map((n) => n ** 2)
    .filter((n) => n % 2 === 0)
    .take(5)
    .collect();
  console.log(`    ${JSON.stringify(result)}`);

  console.log('  LazySeq.range:');
  const rangeResult = LazySeq.range(1, 100)
    .filter((n) => n % 3 === 0)
    .map((n) => n * 10)
    .take(5)
    .collect();
  console.log(`    First 5 multiples of 3 * 10: ${JSON.stringify(rangeResult)}`);

  // ---- 9. Transducers ----
  section('9. TRANSDUCERS CONCEPT');

  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  console.log(`  Input: ${JSON.stringify(data)}`);

  // Compose: keep evens, double them, take first 3
  const xform = composeTransducers(
    filterT((x) => x % 2 === 0),
    mapT((x) => x * 2),
    takeT(3),
  );
  const transducedResult = intoArray(xform, data);
  console.log(`  filter(even) -> map(x*2) -> take(3): ${JSON.stringify(transducedResult)}`);

  // Compare with chaining (same result, but creates intermediate arrays)
  const chainedResult = data.filter((x) => x % 2 === 0).map((x) => x * 2).slice(0, 3);
  console.log(`  Chained equivalent: ${JSON.stringify(chainedResult)}`);
  console.log('  Transducers: single pass, no intermediate arrays');

  // ---- 10. Point-free ----
  section('10. POINT-FREE STYLE');

  const people = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlotte', age: 35 },
  ];

  // Point-free
  const names = people.map(prop('name'));
  const longNames = people.filter(isLongName);
  console.log(`  Names: ${JSON.stringify(names)}`);
  console.log(`  Long names (>5): ${JSON.stringify(longNames.map(prop('name')))}`);

  const isAdult = pipe(prop('age'), gt(17));
  console.log(`  isAdult(Alice): ${isAdult(people[0])}`);

  // ---- 11. Practical FP ----
  section('11. PRACTICAL FP: RESULT-BASED PIPELINES');

  const orderTotal = await getUserOrderTotal(1);
  console.log(`  getUserOrderTotal(1):`, orderTotal.toString());

  const notFound = await getUserOrderTotal(999);
  console.log(`  getUserOrderTotal(999):`, notFound.toString());

  console.log('\n  Data pipeline (ETL):');
  const records = [
    { name: 'Alice', email: 'Alice@Test.COM', status: 'active', purchases: [{ amount: 100 }, { amount: 50 }] },
    { name: 'Bob', email: 'bob@test.com', status: 'inactive', purchases: [{ amount: 200 }] },
    { name: 'Carol', email: 'carol@test.com', status: 'active', purchases: [{ amount: 300 }, { amount: 75 }] },
    { name: 'Dave', email: null, status: 'active', purchases: [] },
  ];
  const summaries = buildDataPipeline(records);
  console.log(`    ${JSON.stringify(summaries, null, 4)}`);

  // ---- 12. Chaining vs reduce ----
  section('12. ARRAY METHOD CHAINING VS REDUCE');

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const { chainingResult, reduceResult } = chainingVsReduce(numbers);
  console.log(`  Sum of even squares (chaining): ${chainingResult}`);
  console.log(`  Sum of even squares (reduce):   ${reduceResult}`);

  console.log('\n  groupBy:');
  const items = [
    { name: 'Widget', category: 'A' },
    { name: 'Gadget', category: 'B' },
    { name: 'Gizmo', category: 'A' },
    { name: 'Thingamajig', category: 'B' },
  ];
  console.log(`    ${JSON.stringify(groupBy(prop('category'), items))}`);

  console.log('  countBy:');
  const words = ['hello', 'world', 'hello', 'foo', 'world', 'hello'];
  console.log(`    ${JSON.stringify(countBy((x) => x, words))}`);

  // ---- 13. lodash/fp patterns ----
  section('13. LODASH/FP-STYLE PATTERNS (without lodash)');

  const nested = { a: { b: { c: 42 } }, x: [1, 2, 3] };
  console.log(`  get(obj, 'a.b.c'):         ${get(nested, 'a.b.c')}`);
  console.log(`  get(obj, 'a.b.z', 'N/A'):  ${get(nested, 'a.b.z', 'N/A')}`);

  const withSet = set(nested, 'a.b.c', 99);
  console.log(`  set(obj, 'a.b.c', 99):     ${JSON.stringify(withSet)}`);
  console.log(`  Original unchanged:         ${JSON.stringify(nested)}`);

  const obj = { name: 'Alice', age: 30, email: 'alice@test.com', password: 'secret' };
  console.log(`  pick(['name','email'], obj): ${JSON.stringify(pick(['name', 'email'], obj))}`);
  console.log(`  omit(['password'], obj):     ${JSON.stringify(omit(['password'], obj))}`);

  console.log(`  chunk(3, [1..8]):            ${JSON.stringify(chunk(3, [1, 2, 3, 4, 5, 6, 7, 8]))}`);
  console.log(`  zip([1,2,3], ['a','b','c']): ${JSON.stringify(zip([1, 2, 3], ['a', 'b', 'c']))}`);
  console.log(`  flattenDeep([1,[2,[3,[4]]]]): ${JSON.stringify(flattenDeep([1, [2, [3, [4]]]]))}`);

  // flow example
  const processName = flow(
    (first, last) => `${first} ${last}`,
    (s) => s.trim(),
    (s) => s.toUpperCase()
  );
  console.log(`  flow(concat, trim, upper)('John', 'Doe'): ${processName('John', 'Doe')}`);

  // ---- Summary ----
  section('SUMMARY');
  console.log(`
  Concept               | Key Takeaway
  ----------------------|------------------------------------------------
  Pure functions        | Deterministic, no side effects, testable
  HOF                   | Functions that take/return functions
  Composition           | Build complex from simple (pipe/compose)
  Currying              | Transform f(a,b) into f(a)(b), create specialized fns
  Immutability          | Prevent accidental mutation, use spread/clone
  Maybe/Result          | Type-safe null/error handling without exceptions
  Memoization           | Cache pure function results
  Lazy evaluation       | Generators for on-demand computation
  Transducers           | Composable, single-pass transformations
  Point-free            | Compose without naming arguments
  `);
}

runDemos().catch(console.error);
