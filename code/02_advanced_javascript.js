/**
 * ============================================================================
 * FILE 2: ADVANCED JAVASCRIPT — Senior Interview Prep
 * ============================================================================
 *
 * Topics covered:
 *   - Event loop deep dive: call stack, task queue, microtask queue
 *   - setTimeout vs setImmediate vs process.nextTick
 *   - Promises internals: states, chaining, error propagation
 *   - Generators and iterators (Symbol.iterator, function*)
 *   - Proxy and Reflect API
 *   - WeakRef and FinalizationRegistry
 *   - Tagged template literals
 *   - Decorators (stage 3 proposal pattern)
 *   - Structured clone vs JSON parse/stringify
 *   - Memory management and garbage collection
 *   - Module systems: CommonJS vs ESM, dynamic imports
 *   - eval, new Function, and security considerations
 *   - Bitwise operations practical uses
 *   - RegExp advanced (named groups, lookbehind, dotAll)
 *
 * Run: node 02_advanced_javascript.js
 */

"use strict";

// ---------------------------------------------------------------------------
// Utility: section printer
// ---------------------------------------------------------------------------
/** @param {string} title */
function section(title) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
}

/** @param {string} label @param {*} value */
function show(label, value) {
  console.log(`  ${label}:`, value);
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  1. EVENT LOOP DEEP DIVE                                               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("1. Event Loop: Call Stack, Task Queue, Microtask Queue");

/**
 * NODE.JS EVENT LOOP PHASES (libuv):
 *
 *   ┌───────────────────────────┐
 *   │        timers              │  ← setTimeout, setInterval callbacks
 *   ├───────────────────────────┤
 *   │     pending callbacks      │  ← I/O callbacks deferred from prev cycle
 *   ├───────────────────────────┤
 *   │     idle, prepare          │  ← internal use only
 *   ├───────────────────────────┤
 *   │         poll               │  ← retrieve new I/O events; execute I/O callbacks
 *   ├───────────────────────────┤
 *   │         check              │  ← setImmediate callbacks
 *   ├───────────────────────────┤
 *   │    close callbacks         │  ← socket.on('close', ...)
 *   └───────────────────────────┘
 *
 * BETWEEN EACH PHASE, Node drains all microtasks:
 *   1. process.nextTick queue (highest priority)
 *   2. Promise microtask queue
 *
 * EXECUTION ORDER:
 *   synchronous code > process.nextTick > microtasks (Promises) > macrotasks
 *
 * KEY INTERVIEW INSIGHT:
 *   - Call stack: where synchronous code executes (LIFO)
 *   - Microtask queue: Promise.then/catch/finally, queueMicrotask, process.nextTick
 *   - Macrotask (task) queue: setTimeout, setInterval, setImmediate, I/O
 */

console.log("  [1] Synchronous — start");

setTimeout(() => console.log("  [5] setTimeout (macrotask)"), 0);

setImmediate(() => console.log("  [6] setImmediate (check phase)"));

Promise.resolve().then(() => console.log("  [3] Promise.then (microtask)"));

process.nextTick(() => console.log("  [2] process.nextTick (highest priority microtask)"));

queueMicrotask(() => console.log("  [4] queueMicrotask (microtask)"));

console.log("  [1] Synchronous — end");

/**
 * Expected output order:
 *   [1] Synchronous — start
 *   [1] Synchronous — end
 *   [2] process.nextTick
 *   [3] Promise.then
 *   [4] queueMicrotask
 *   [5] setTimeout       (may swap with setImmediate depending on timing)
 *   [6] setImmediate
 *
 * NOTE: setTimeout(0) vs setImmediate order is non-deterministic in the
 * main module. Inside an I/O callback, setImmediate always fires first.
 */

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  2. setTimeout vs setImmediate vs process.nextTick                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("2. setTimeout vs setImmediate vs process.nextTick");

/**
 * process.nextTick(callback):
 *   - Fires BEFORE any I/O or timer in the current phase
 *   - Runs after current operation completes, before event loop continues
 *   - Can starve I/O if used recursively (dangerous!)
 *   - Highest priority among async callbacks
 *
 * queueMicrotask(callback):
 *   - Standard API (not Node-specific)
 *   - Fires after nextTick, before macrotasks
 *   - Same queue as Promise.then callbacks
 *
 * setTimeout(callback, 0):
 *   - Minimum delay is actually ~1ms (clamped by the runtime)
 *   - Fires in the "timers" phase
 *
 * setImmediate(callback):
 *   - Node.js only (not standard)
 *   - Fires in the "check" phase
 *   - Inside I/O callback: always fires before setTimeout(0)
 *   - Outside I/O callback: order with setTimeout(0) is non-deterministic
 */

// Demonstrate nextTick starvation risk:
function nextTickStarvationDemo() {
  let count = 0;
  const MAX = 5;

  function scheduleTick() {
    if (count < MAX) {
      count++;
      process.nextTick(scheduleTick); // recursive nextTick
    }
  }

  scheduleTick();
  show("nextTick starvation demo", `Scheduled ${MAX} recursive nextTicks`);
  show("WARNING", "Recursive nextTick can starve I/O — prefer setImmediate for recursive patterns");
}
nextTickStarvationDemo();

// Inside I/O — setImmediate always before setTimeout:
const { readFile } = require("fs");
readFile(__filename, () => {
  setTimeout(() => console.log("  [I/O] setTimeout"), 0);
  setImmediate(() => console.log("  [I/O] setImmediate (always first in I/O callback)"));
});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  3. PROMISES INTERNALS                                                 ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("3. Promises: States, Chaining, Error Propagation");

/**
 * A Promise has 3 states:
 *   - pending:   initial state, neither fulfilled nor rejected
 *   - fulfilled: operation completed successfully (resolved with a value)
 *   - rejected:  operation failed (rejected with a reason)
 *
 * Once settled (fulfilled/rejected), a Promise is IMMUTABLE — it never
 * changes state again.
 *
 * INTERVIEW POINTS:
 *   - .then() always returns a NEW Promise
 *   - Returning a value from .then() resolves the new Promise with that value
 *   - Throwing in .then() rejects the new Promise
 *   - Returning a Promise from .then() adopts that Promise's state
 *   - Errors propagate down the chain until caught
 */

// Promise creation and states:
const pending = new Promise(() => {}); // never settles
const fulfilled = Promise.resolve(42);
const rejected = Promise.reject(new Error("failed")).catch(() => {}); // catch to suppress unhandled

// Chaining demonstration:
async function chainingDemo() {
  const result = await Promise.resolve(1)
    .then((v) => {
      show("Chain step 1", v); // 1
      return v + 1;
    })
    .then((v) => {
      show("Chain step 2", v); // 2
      return v * 3;
    })
    .then((v) => {
      show("Chain step 3", v); // 6
      return v;
    });
  show("Final chain result", result); // 6
}

// Error propagation:
async function errorPropagation() {
  const result = await Promise.resolve("start")
    .then((v) => {
      throw new Error("Something went wrong");
    })
    .then((v) => {
      // This is SKIPPED — error propagates past it
      console.log("  This never runs");
      return v;
    })
    .catch((err) => {
      show("Caught error", err.message);
      return "recovered"; // catch can recover the chain
    })
    .then((v) => {
      show("After recovery", v); // "recovered"
      return v;
    });
  return result;
}

// Promise combinators:
async function combinatorsDemo() {
  const fast = (ms, val) => new Promise((r) => setTimeout(() => r(val), ms));
  const fail = (ms, msg) =>
    new Promise((_, r) => setTimeout(() => r(new Error(msg)), ms));

  // Promise.all — resolves when ALL resolve, rejects on FIRST rejection
  try {
    const all = await Promise.all([fast(10, "a"), fast(20, "b"), fast(30, "c")]);
    show("Promise.all", all); // ['a', 'b', 'c']
  } catch (e) {
    show("Promise.all error", e.message);
  }

  // Promise.allSettled — NEVER rejects, returns status of each
  const settled = await Promise.allSettled([
    fast(10, "success"),
    fail(20, "oops"),
    fast(30, "also success"),
  ]);
  show(
    "Promise.allSettled",
    settled.map((s) => `${s.status}: ${s.value ?? s.reason?.message}`)
  );

  // Promise.race — resolves/rejects with the FIRST to settle
  const raced = await Promise.race([fast(50, "slow"), fast(10, "fast")]);
  show("Promise.race", raced); // "fast"

  // Promise.any — resolves with FIRST fulfillment, rejects only if ALL reject
  const any = await Promise.any([fail(10, "err1"), fast(20, "ok"), fail(30, "err2")]);
  show("Promise.any", any); // "ok"

  // Promise.any — all reject → AggregateError
  try {
    await Promise.any([fail(10, "err1"), fail(20, "err2")]);
  } catch (e) {
    show("Promise.any all rejected", e.constructor.name); // AggregateError
    show("Promise.any errors", e.errors.map((e) => e.message));
  }

  // Promise.withResolvers (ES2024):
  if (typeof Promise.withResolvers === "function") {
    const { promise, resolve, reject } = Promise.withResolvers();
    setTimeout(() => resolve("done!"), 10);
    const val = await promise;
    show("Promise.withResolvers", val);
  } else {
    show("Promise.withResolvers", "Not available in this Node version");
  }
}

// Async/await error handling patterns:
async function asyncErrorPatterns() {
  // Pattern 1: try/catch
  async function fetchData() {
    throw new Error("network error");
  }

  try {
    await fetchData();
  } catch (e) {
    show("try/catch pattern", e.message);
  }

  // Pattern 2: .catch() on await
  const result = await fetchData().catch((e) => ({ error: e.message }));
  show(".catch() on await", result);

  // Pattern 3: Tuple-style error handling (Go-like)
  /**
   * @template T
   * @param {Promise<T>} promise
   * @returns {Promise<[Error, null] | [null, T]>}
   */
  async function to(promise) {
    try {
      const data = await promise;
      return [null, data];
    } catch (err) {
      return [err, null];
    }
  }

  const [err, data] = await to(fetchData());
  show("Tuple pattern", err ? `Error: ${err.message}` : `Data: ${data}`);
}

// Run async demos sequentially:
(async () => {
  await chainingDemo();
  await errorPropagation();
  await combinatorsDemo();
  await asyncErrorPatterns();

  // Continue with synchronous sections after async completes:

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  4. GENERATORS AND ITERATORS                                         ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("4. Generators and Iterators");

  /**
   * Iterators: objects implementing the Iterator protocol:
   *   { next() { return { value, done } } }
   *
   * Iterables: objects implementing Symbol.iterator, returning an iterator.
   *   Built-in iterables: Array, String, Map, Set, arguments, NodeList
   *
   * Generators: functions that can pause execution and resume later.
   *   Declared with function* — calling them returns a generator object
   *   (which is both an iterator AND an iterable).
   *
   * yield: pauses the generator function and returns a value
   * yield*: delegates to another iterable/generator
   */

  // Custom iterator:
  const countdown = {
    from: 5,
    [Symbol.iterator]() {
      let current = this.from;
      return {
        next() {
          return current >= 0
            ? { value: current--, done: false }
            : { done: true, value: undefined };
        },
      };
    },
  };
  show("Custom iterator", [...countdown]); // [5, 4, 3, 2, 1, 0]

  // Basic generator:
  function* numberGenerator() {
    yield 1;
    yield 2;
    yield 3;
  }
  const gen = numberGenerator();
  show("gen.next()", gen.next()); // { value: 1, done: false }
  show("gen.next()", gen.next()); // { value: 2, done: false }
  show("gen.next()", gen.next()); // { value: 3, done: false }
  show("gen.next()", gen.next()); // { value: undefined, done: true }
  show("Spread generator", [...numberGenerator()]); // [1, 2, 3]

  // Generator with input (two-way communication):
  function* conversation() {
    const name = yield "What is your name?";
    const age = yield `Hello ${name}! How old are you?`;
    return `${name} is ${age} years old.`;
  }
  const chat = conversation();
  show("chat.next()", chat.next()); // { value: "What is your name?" }
  show('chat.next("Alice")', chat.next("Alice")); // { value: "Hello Alice!..." }
  show("chat.next(30)", chat.next(30)); // { value: "Alice is 30 years old." }

  // Infinite generator:
  function* fibonacci() {
    let [a, b] = [0, 1];
    while (true) {
      yield a;
      [a, b] = [b, a + b];
    }
  }
  const fib = fibonacci();
  const first10 = Array.from({ length: 10 }, () => fib.next().value);
  show("First 10 Fibonacci", first10);

  // yield* delegation:
  function* inner() {
    yield "a";
    yield "b";
  }
  function* outer() {
    yield 1;
    yield* inner(); // delegates to inner
    yield 2;
  }
  show("yield* delegation", [...outer()]); // [1, 'a', 'b', 2]

  // Async generators (for-await-of):
  async function* asyncRange(start, end) {
    for (let i = start; i <= end; i++) {
      await new Promise((r) => setTimeout(r, 5));
      yield i;
    }
  }
  const asyncNums = [];
  for await (const n of asyncRange(1, 5)) {
    asyncNums.push(n);
  }
  show("Async generator", asyncNums); // [1, 2, 3, 4, 5]

  // Generator as state machine:
  function* trafficLight() {
    while (true) {
      yield "RED";
      yield "GREEN";
      yield "YELLOW";
    }
  }
  const light = trafficLight();
  show(
    "Traffic light",
    Array.from({ length: 6 }, () => light.next().value)
  ); // RED, GREEN, YELLOW, RED, GREEN, YELLOW

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  5. PROXY AND REFLECT API                                            ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("5. Proxy and Reflect API");

  /**
   * Proxy: wraps an object and intercepts operations (get, set, delete, etc.)
   * Reflect: provides default implementations for proxy traps.
   *
   * INTERVIEW TIP: Proxy enables meta-programming — you can intercept and
   * customize fundamental object operations.
   *
   * Common use cases:
   *   - Validation
   *   - Logging / debugging
   *   - Auto-population / default values
   *   - Access control
   *   - Observable objects
   *   - Negative array indexing
   */

  // Validation proxy:
  /** @param {object} schema */
  function createValidatedObject(schema) {
    return new Proxy(
      {},
      {
        set(target, prop, value) {
          if (prop in schema) {
            const validator = schema[prop];
            if (!validator(value)) {
              throw new TypeError(`Invalid value for '${String(prop)}': ${value}`);
            }
          }
          return Reflect.set(target, prop, value);
        },
        get(target, prop) {
          if (!(prop in target)) {
            return undefined;
          }
          return Reflect.get(target, prop);
        },
      }
    );
  }

  const userSchema = {
    age: (v) => typeof v === "number" && v > 0 && v < 150,
    name: (v) => typeof v === "string" && v.length > 0,
  };

  const validatedUser = createValidatedObject(userSchema);
  validatedUser.name = "Alice";
  validatedUser.age = 30;
  show("Validated object", { name: validatedUser.name, age: validatedUser.age });

  try {
    validatedUser.age = -5;
  } catch (e) {
    show("Validation rejected", e.message);
  }

  // Logging proxy:
  function createLoggingProxy(target, label) {
    return new Proxy(target, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        console.log(`    [${label}] GET ${String(prop)} => ${JSON.stringify(value)}`);
        return value;
      },
      set(target, prop, value, receiver) {
        console.log(`    [${label}] SET ${String(prop)} = ${JSON.stringify(value)}`);
        return Reflect.set(target, prop, value, receiver);
      },
    });
  }

  const logged = createLoggingProxy({ x: 1 }, "LogDemo");
  logged.x;
  logged.y = 42;

  // Negative array index proxy:
  function negativeArray(arr) {
    return new Proxy(arr, {
      get(target, prop, receiver) {
        const index = Number(prop);
        if (!Number.isNaN(index) && index < 0) {
          return Reflect.get(target, target.length + index, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  const nArr = negativeArray([10, 20, 30, 40, 50]);
  show("nArr[-1]", nArr[-1]); // 50
  show("nArr[-2]", nArr[-2]); // 40
  show("nArr[0]", nArr[0]); // 10

  // Revocable proxy (for access control):
  const { proxy: revocableProxy, revoke } = Proxy.revocable(
    { secret: "data" },
    {}
  );
  show("Before revoke", revocableProxy.secret); // "data"
  revoke(); // All operations on proxy will now throw
  try {
    revocableProxy.secret;
  } catch (e) {
    show("After revoke", e.message); // TypeError
  }

  // Reflect API — mirrors Proxy traps:
  /**
   * Reflect methods: apply, construct, defineProperty, deleteProperty,
   * get, getOwnPropertyDescriptor, getPrototypeOf, has, isExtensible,
   * ownKeys, preventExtensions, set, setPrototypeOf
   *
   * Advantage over Object counterparts:
   *   - Returns boolean for success/failure (instead of throwing)
   *   - More consistent API
   */
  const reflectObj = { a: 1, b: 2 };
  show("Reflect.has(obj, 'a')", Reflect.has(reflectObj, "a")); // true
  show("Reflect.ownKeys(obj)", Reflect.ownKeys(reflectObj)); // ['a', 'b']
  Reflect.set(reflectObj, "c", 3);
  show("After Reflect.set", reflectObj);

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  6. WEAKREF AND FINALIZATIONREGISTRY                                 ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("6. WeakRef and FinalizationRegistry");

  /**
   * WeakRef: holds a weak reference to an object that does NOT prevent GC.
   *   - .deref() returns the object if still alive, or undefined if GC'd
   *   - Use case: caches that should not prevent garbage collection
   *
   * FinalizationRegistry: registers a callback to be called when an object
   *   is garbage collected.
   *   - Use case: cleanup resources associated with an object
   *
   * INTERVIEW WARNING: These are low-level tools. GC timing is non-deterministic.
   *   Avoid depending on them for critical logic.
   */

  // WeakRef demo:
  let target = { id: 1, name: "cached object" };
  const weakRef = new WeakRef(target);
  show("WeakRef.deref()", weakRef.deref()); // { id: 1, name: 'cached object' }
  show("deref() not undefined?", weakRef.deref() !== undefined); // true

  // Simple cache using WeakRef:
  class WeakCache {
    /** @type {Map<string, WeakRef<object>>} */
    #cache = new Map();

    /** @param {string} key @param {object} value */
    set(key, value) {
      this.#cache.set(key, new WeakRef(value));
    }

    /** @param {string} key @returns {object | undefined} */
    get(key) {
      const ref = this.#cache.get(key);
      if (!ref) return undefined;
      const value = ref.deref();
      if (value === undefined) {
        this.#cache.delete(key); // clean up dead reference
      }
      return value;
    }
  }

  const cache = new WeakCache();
  let bigData = { data: new Array(1000).fill("x") };
  cache.set("bigData", bigData);
  show("Cache hit", cache.get("bigData") !== undefined); // true

  // FinalizationRegistry:
  const registry = new FinalizationRegistry((heldValue) => {
    console.log(`  [FinalizationRegistry] Object with key "${heldValue}" was GC'd`);
  });

  let tempObject = { important: "data" };
  registry.register(tempObject, "tempObject-key");
  // If tempObject becomes unreachable, the callback MAY fire (non-deterministic).
  // We cannot demonstrate this reliably in a short script.
  show("FinalizationRegistry", "Registered — callback fires on GC (non-deterministic)");

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  7. TAGGED TEMPLATE LITERALS                                         ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("7. Tagged Template Literals");

  /**
   * A tagged template is a function call where the arguments are derived
   * from a template literal.
   *
   * tag`Hello ${name}, you are ${age} years old`
   *
   * The tag function receives:
   *   - strings: array of string literals (always strings.length === values.length + 1)
   *   - ...values: the interpolated expressions
   *
   * Use cases:
   *   - SQL query sanitization
   *   - i18n / localization
   *   - Styled components (CSS-in-JS)
   *   - HTML escaping
   *   - Custom DSLs
   */

  // Basic tag function:
  /**
   * @param {TemplateStringsArray} strings
   * @param {...*} values
   * @returns {string}
   */
  function highlight(strings, ...values) {
    return strings.reduce((result, str, i) => {
      const value = i < values.length ? `**${values[i]}**` : "";
      return result + str + value;
    }, "");
  }

  const userName = "Alice";
  const action = "logged in";
  show("Tagged template", highlight`User ${userName} just ${action}!`);

  // HTML escaping tag:
  function html(strings, ...values) {
    const escape = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    return strings.reduce((result, str, i) => {
      return result + str + (i < values.length ? escape(values[i]) : "");
    }, "");
  }

  const userInput = '<script>alert("xss")</script>';
  show("HTML escaped", html`<div>${userInput}</div>`);

  // SQL-like sanitization tag:
  function sql(strings, ...values) {
    const params = [];
    const query = strings.reduce((result, str, i) => {
      if (i < values.length) {
        params.push(values[i]);
        return result + str + `$${params.length}`;
      }
      return result + str;
    }, "");
    return { query: query.trim(), params };
  }

  const id = 42;
  const status = "active";
  const query = sql`SELECT * FROM users WHERE id = ${id} AND status = ${status}`;
  show("SQL tag result", query);

  // String.raw — built-in tag that returns the raw string:
  show("String.raw", String.raw`Newlines: \n\t are NOT processed`);

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  8. DECORATORS (Stage 3 Proposal Pattern)                            ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("8. Decorators (Stage 3 Pattern in Plain JS)");

  /**
   * TC39 Stage 3 decorators are available in TypeScript 5+ and some build tools.
   * In plain JS (without transpilation), we simulate the pattern using
   * higher-order functions and wrapper patterns.
   *
   * Decorator: a function that wraps/modifies a class, method, or property.
   *
   * Common patterns:
   *   - Method decorators: logging, caching, throttling, access control
   *   - Class decorators: adding methods, enforcing contracts
   */

  // Method decorator pattern: logging
  /**
   * @param {Function} originalMethod
   * @param {string} methodName
   * @returns {Function}
   */
  function logged(originalMethod, methodName) {
    return function (...args) {
      console.log(`    [LOG] ${methodName}(${args.join(", ")})`);
      const result = originalMethod.apply(this, args);
      console.log(`    [LOG] ${methodName} returned: ${JSON.stringify(result)}`);
      return result;
    };
  }

  // Method decorator pattern: memoization
  function memoized(originalMethod, methodName) {
    const cache = new Map();
    return function (...args) {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        console.log(`    [MEMO] ${methodName} cache hit for ${key}`);
        return cache.get(key);
      }
      const result = originalMethod.apply(this, args);
      cache.set(key, result);
      return result;
    };
  }

  // Method decorator: timing
  function timed(originalMethod, methodName) {
    return function (...args) {
      const start = performance.now();
      const result = originalMethod.apply(this, args);
      const elapsed = (performance.now() - start).toFixed(3);
      console.log(`    [TIME] ${methodName} took ${elapsed}ms`);
      return result;
    };
  }

  // Applying decorators manually:
  class Calculator {
    add(a, b) {
      return a + b;
    }

    fibonacci(n) {
      if (n <= 1) return n;
      return this.fibonacci(n - 1) + this.fibonacci(n - 2);
    }
  }

  // Apply decorators:
  Calculator.prototype.add = logged(Calculator.prototype.add, "add");
  Calculator.prototype.fibonacci = memoized(
    Calculator.prototype.fibonacci,
    "fibonacci"
  );

  const calc = new Calculator();
  calc.add(3, 4);
  show("fibonacci(10)", calc.fibonacci(10));
  show("fibonacci(10) again (cached)", calc.fibonacci(10));

  // Class decorator pattern:
  function withTimestamp(BaseClass) {
    return class extends BaseClass {
      constructor(...args) {
        super(...args);
        this.createdAt = new Date().toISOString();
      }
    };
  }

  class BaseModel {
    constructor(name) {
      this.name = name;
    }
  }

  const TimestampedModel = withTimestamp(BaseModel);
  const model = new TimestampedModel("test");
  show("Class decorator", { name: model.name, createdAt: model.createdAt });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  9. STRUCTURED CLONE vs JSON PARSE/STRINGIFY                         ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("9. Structured Clone vs JSON Parse/Stringify");

  /**
   * JSON.parse(JSON.stringify(obj)):
   *   + Simple, widely available
   *   - Loses: Date (becomes string), undefined, functions, Symbol keys,
   *     RegExp, Map, Set, ArrayBuffer, Error
   *   - Fails on circular references
   *   - Converts NaN/Infinity to null
   *   - Drops non-enumerable properties
   *
   * structuredClone(obj):
   *   + Handles: Date, RegExp, Map, Set, ArrayBuffer, Error, Blob, File
   *   + Handles circular references
   *   + Preserves NaN, Infinity, -0
   *   - Cannot clone: Functions, DOM Nodes, Symbols, property descriptors
   *   - Available in Node 17+ and modern browsers
   */

  const testObj = {
    date: new Date("2024-01-01"),
    regex: /test/gi,
    map: new Map([
      ["a", 1],
      ["b", 2],
    ]),
    set: new Set([1, 2, 3]),
    nested: { deep: { value: 42 } },
    undef: undefined,
    nan: NaN,
    negZero: -0,
  };

  // Add circular reference:
  testObj.self = testObj;

  // structuredClone handles everything:
  const scClone = structuredClone(testObj);
  show("structuredClone results:", {
    dateIsDate: scClone.date instanceof Date,
    dateValue: scClone.date.toISOString(),
    regexIsRegex: scClone.regex instanceof RegExp,
    mapIsMap: scClone.map instanceof Map,
    setIsSet: scClone.set instanceof Set,
    hasUndefined: "undef" in scClone,
    nanIsNaN: Number.isNaN(scClone.nan),
    negZeroPreserved: Object.is(scClone.negZero, -0),
    circularRef: scClone.self === scClone,
  });

  // JSON round-trip loses types:
  const simple = { date: new Date("2024-01-01"), num: 42, undef: undefined };
  const jsonClone = JSON.parse(JSON.stringify(simple));
  show("JSON roundtrip:", {
    dateType: typeof jsonClone.date, // string — NOT Date!
    hasUndefined: "undef" in jsonClone, // false — dropped!
  });

  // JSON fails on circular:
  try {
    JSON.stringify(testObj);
  } catch (e) {
    show("JSON circular error", e.message);
  }

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  10. MEMORY MANAGEMENT & GARBAGE COLLECTION                          ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("10. Memory Management & Garbage Collection");

  /**
   * JavaScript uses AUTOMATIC memory management via garbage collection (GC).
   *
   * V8 GC STRATEGY:
   *   1. Generational GC:
   *      - Young generation (nursery): short-lived objects, collected frequently
   *        via Scavenge (semi-space copying collector)
   *      - Old generation: long-lived objects, collected less frequently
   *        via Mark-Sweep-Compact
   *
   *   2. Mark-and-Sweep (old generation):
   *      - Mark phase: traverse from roots, mark all reachable objects
   *      - Sweep phase: reclaim memory of unmarked objects
   *      - Compact phase: defragment memory
   *
   *   3. Incremental / Concurrent marking: avoids long GC pauses
   *
   * COMMON MEMORY LEAKS:
   *   1. Accidental globals (forgetting let/const)
   *   2. Forgotten timers/intervals
   *   3. Closures holding large scope references
   *   4. Detached DOM nodes (browser)
   *   5. Unbounded caches (Map/object growing indefinitely)
   *   6. Event listener accumulation
   *   7. Large data in module-level variables
   *
   * DEBUGGING TOOLS:
   *   - process.memoryUsage() — Node.js memory stats
   *   - --inspect flag + Chrome DevTools heap profiler
   *   - --max-old-space-size=<MB> to adjust heap limit
   */

  const mem = process.memoryUsage();
  show("Memory usage", {
    rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`, // Resident Set Size
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
  });

  // Example of a memory leak pattern — bounded cache fix:
  class BoundedCache {
    /** @param {number} maxSize */
    constructor(maxSize = 100) {
      /** @type {Map<string, *>} */
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    /** @param {string} key @param {*} value */
    set(key, value) {
      // LRU eviction: delete oldest entry if at capacity
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      this.cache.delete(key); // re-insert to update order
      this.cache.set(key, value);
    }

    /** @param {string} key @returns {*} */
    get(key) {
      if (!this.cache.has(key)) return undefined;
      const value = this.cache.get(key);
      this.cache.delete(key); // move to end (most recently used)
      this.cache.set(key, value);
      return value;
    }

    get size() {
      return this.cache.size;
    }
  }

  const lru = new BoundedCache(3);
  lru.set("a", 1);
  lru.set("b", 2);
  lru.set("c", 3);
  lru.set("d", 4); // evicts "a"
  show("LRU cache (max 3)", {
    a: lru.get("a"), // undefined — evicted
    b: lru.get("b"), // 2
    d: lru.get("d"), // 4
    size: lru.size,
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  11. MODULE SYSTEMS: CJS vs ESM                                      ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("11. Module Systems: CommonJS vs ESM");

  /**
   * CommonJS (CJS) — Node.js default:
   *   - require() / module.exports
   *   - Synchronous loading
   *   - Dynamic: require() can be called anywhere, conditionally
   *   - Exports a copy of the value (except objects — reference)
   *   - Module is cached after first require()
   *   - Circular deps: returns partially loaded module
   *
   * ES Modules (ESM) — Standard:
   *   - import / export
   *   - Async loading (enables tree-shaking)
   *   - Static: imports must be top-level (enables static analysis)
   *   - Live bindings: imports reflect current value of export
   *   - Strict mode by default
   *   - Requires "type": "module" in package.json OR .mjs extension
   *
   * INTEROP:
   *   - ESM can import CJS (default import)
   *   - CJS can use dynamic import() for ESM (async only)
   *
   * Dynamic import():
   *   - Returns a Promise<module>
   *   - Works in both CJS and ESM
   *   - Enables code splitting and lazy loading
   */

  // CJS demo (we are running in CJS mode):
  const path = require("path");
  show("CJS require", path.basename(__filename));

  // Dynamic import (works in both CJS and ESM):
  const dynamicMod = await import("os");
  show("Dynamic import (os.platform)", dynamicMod.platform());

  // Module caching demonstration:
  /**
   * require.cache stores loaded modules. Re-requiring returns the cached version.
   * This is why modifying a module's exports persists across requires.
   */
  show("require.cache has this file", __filename in require.cache);

  // CJS vs ESM key differences summary:
  console.log(`
  ┌──────────────────────┬─────────────────────┬──────────────────────┐
  │ Feature              │ CommonJS (CJS)      │ ES Modules (ESM)     │
  ├──────────────────────┼─────────────────────┼──────────────────────┤
  │ Syntax               │ require/exports     │ import/export        │
  │ Loading              │ Synchronous         │ Asynchronous         │
  │ Static analysis      │ No                  │ Yes (tree-shakeable) │
  │ Top-level await      │ No                  │ Yes                  │
  │ Live bindings        │ No (value copy)     │ Yes                  │
  │ Conditional import   │ Yes (dynamic)       │ Only via import()    │
  │ File extension       │ .js / .cjs          │ .mjs / .js + type   │
  │ __dirname / __filename│ Available           │ Use import.meta.url  │
  │ Strict mode          │ Optional            │ Always               │
  └──────────────────────┴─────────────────────┴──────────────────────┘`);

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  12. eval, new Function, AND SECURITY                                ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("12. eval, new Function, and Security");

  /**
   * eval(codeString):
   *   - Executes code in the CURRENT scope (access to local variables)
   *   - Direct eval: called literally as eval()
   *   - Indirect eval: called as (0, eval)() — runs in global scope
   *   - Disables V8 optimizations for the enclosing function
   *
   * new Function(argNames..., body):
   *   - Creates a function from a string
   *   - Always runs in GLOBAL scope (cannot access local variables)
   *   - Slightly safer than eval (no local scope leakage)
   *
   * SECURITY RISKS:
   *   - Code injection attacks (never eval user input!)
   *   - Bypasses CSP (Content Security Policy) in browsers
   *   - Prevents static analysis and optimization
   *
   * ALTERNATIVES:
   *   - JSON.parse() for data
   *   - Map/Object lookup for dynamic dispatch
   *   - Proxy for dynamic property access
   *   - vm module (Node.js) for sandboxed execution
   */

  // eval demo (scope access):
  const localVar = 42;
  // Direct eval has access to local scope:
  const evalResult = eval("localVar + 8"); // 50
  show("eval (accesses local scope)", evalResult);

  // new Function (global scope only):
  const fn = new Function("a", "b", "return a + b");
  show("new Function result", fn(10, 20)); // 30

  // new Function CANNOT access local scope:
  try {
    const fnLocal = new Function("return localVar");
    fnLocal(); // ReferenceError: localVar is not defined
  } catch (e) {
    show("new Function scope isolation", e.message);
  }

  // Safer alternative: vm module
  const vm = require("vm");
  const sandbox = { x: 10, y: 20, result: null };
  vm.createContext(sandbox);
  vm.runInContext("result = x + y", sandbox);
  show("vm.runInContext", sandbox.result); // 30

  show("RULE", "NEVER eval() user-provided strings. Use JSON.parse, Map, or vm module.");

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  13. BITWISE OPERATIONS — PRACTICAL USES                             ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("13. Bitwise Operations — Practical Uses");

  /**
   * Bitwise operators work on 32-bit integers:
   *   & (AND), | (OR), ^ (XOR), ~ (NOT), << (left shift), >> (right shift),
   *   >>> (unsigned right shift)
   *
   * Practical uses in real-world JS:
   *   - Permission/flag systems
   *   - Fast math tricks
   *   - Color manipulation
   *   - Hash functions
   *   - Feature flags
   */

  // Permission flags (bitmask pattern):
  const PERMISSIONS = Object.freeze({
    READ: 1 << 0, // 0001 = 1
    WRITE: 1 << 1, // 0010 = 2
    EXECUTE: 1 << 2, // 0100 = 4
    ADMIN: 1 << 3, // 1000 = 8
  });

  let userPerms = PERMISSIONS.READ | PERMISSIONS.WRITE; // 0011 = 3
  show("User permissions (READ|WRITE)", userPerms.toString(2).padStart(4, "0"));

  // Check permission:
  const hasRead = (userPerms & PERMISSIONS.READ) !== 0;
  const hasAdmin = (userPerms & PERMISSIONS.ADMIN) !== 0;
  show("Has READ?", hasRead); // true
  show("Has ADMIN?", hasAdmin); // false

  // Add permission:
  userPerms |= PERMISSIONS.EXECUTE;
  show("After adding EXECUTE", userPerms.toString(2).padStart(4, "0")); // 0111

  // Remove permission:
  userPerms &= ~PERMISSIONS.WRITE;
  show("After removing WRITE", userPerms.toString(2).padStart(4, "0")); // 0101

  // Toggle permission:
  userPerms ^= PERMISSIONS.ADMIN;
  show("After toggling ADMIN", userPerms.toString(2).padStart(4, "0")); // 1101

  // Fast integer operations:
  show("Math.floor via |0", (3.7 | 0)); // 3 (truncate toward zero)
  show("Math.floor via |0 (negative)", (-3.7 | 0)); // -3 (NOT same as Math.floor!)
  show("Multiply by 2 via <<", (5 << 1)); // 10
  show("Divide by 2 via >>", (10 >> 1)); // 5
  show("Check even via &1", ((4 & 1) === 0)); // true
  show("Check odd via &1", ((5 & 1) === 1)); // true

  // Swap without temp using XOR:
  let p = 5,
    q = 10;
  p ^= q;
  q ^= p;
  p ^= q;
  show("XOR swap", { p, q }); // p=10, q=5

  // Color manipulation:
  const color = 0xff5733; // RGB hex color
  const r = (color >> 16) & 0xff; // 255
  const g = (color >> 8) & 0xff; // 87
  const bVal = color & 0xff; // 51
  show("Color extraction (0xFF5733)", { r, g, b: bVal });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  14. REGEXP ADVANCED                                                 ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  section("14. RegExp Advanced (Named Groups, Lookbehind, dotAll)");

  /**
   * Modern RegExp features (ES2018+):
   *   - Named capture groups: (?<name>...)
   *   - Lookbehind assertions: (?<=...) and (?<!...)
   *   - dotAll flag (s): makes . match newlines too
   *   - Unicode property escapes: \p{Letter}, \p{Script=Greek}
   *   - The 'd' flag (ES2022): provides match indices
   *   - The 'v' flag (ES2024): extends unicode mode
   */

  // Named capture groups:
  const dateStr = "2024-01-15";
  const dateRegex2 = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
  const match = dateStr.match(dateRegex2);
  show("Named groups", match?.groups); // { year: '2024', month: '01', day: '15' }

  // Named groups in replace:
  const reformatted = dateStr.replace(dateRegex2, "$<month>/$<day>/$<year>");
  show("Named replace", reformatted); // "01/15/2024"

  // Lookbehind assertions:
  const prices = "Price: $100 and EUR200 and $300";

  // Positive lookbehind — match numbers preceded by $:
  const dollarAmounts = prices.match(/(?<=\$)\d+/g);
  show("Positive lookbehind (after $)", dollarAmounts); // ['100', '300']

  // Negative lookbehind — match numbers NOT preceded by $:
  const nonDollar = prices.match(/(?<!\$)\d+/g);
  show("Negative lookbehind (not after $)", nonDollar); // ['200'] (ignoring partial matches)

  // Lookahead:
  const files = "report.pdf budget.pdf notes.txt todo.md";
  const pdfFiles = files.match(/\w+(?=\.pdf)/g);
  show("Positive lookahead (.pdf)", pdfFiles); // ['report', 'budget']

  // dotAll flag (s):
  const multiline = "Hello\nWorld";
  show("Without 's' flag", /Hello.World/.test(multiline)); // false (. doesn't match \n)
  show("With 's' flag", /Hello.World/s.test(multiline)); // true (. matches \n)

  // Unicode property escapes:
  const text2 = "Hello Mundo 42 !@#";
  const letters = text2.match(/\p{Letter}+/gu);
  show("Unicode \\p{Letter}", letters); // ['Hello', 'Mundo']

  const emoji = "Hello 🌍 World 🚀!";
  const emojis = emoji.match(/\p{Emoji_Presentation}/gu);
  show("Unicode \\p{Emoji}", emojis); // ['🌍', '🚀']

  // Match indices (d flag, ES2022):
  const indexRegex = /(?<word>\w+)/d;
  const indexMatch = "Hello World".match(indexRegex);
  if (indexMatch?.indices) {
    show("Match indices", {
      fullMatch: indexMatch.indices[0], // [0, 5]
      namedGroup: indexMatch.indices.groups?.word, // [0, 5]
    });
  }

  // Practical example: parsing structured text
  const logLine = '2024-01-15T10:30:45Z [ERROR] Service "auth" failed: timeout';
  const logRegex =
    /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+\[(?<level>\w+)]\s+(?<message>.+)/;
  const logMatch = logLine.match(logRegex);
  show("Log parsing", logMatch?.groups);

  // Global matchAll with named groups:
  const csvLine = 'name="Alice",age="30",city="NYC"';
  const kvRegex = /(?<key>\w+)="(?<value>[^"]+)"/g;
  const kvPairs = Object.fromEntries(
    [...csvLine.matchAll(kvRegex)].map((m) => [m.groups.key, m.groups.value])
  );
  show("matchAll to object", kvPairs);

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║  COMPLETE                                                            ║
  // ╚═══════════════════════════════════════════════════════════════════════╝

  console.log(`\n${"=".repeat(72)}`);
  console.log("  02_advanced_javascript.js — All sections complete!");
  console.log(`${"=".repeat(72)}\n`);
})();
