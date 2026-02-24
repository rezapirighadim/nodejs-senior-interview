# Advanced JavaScript -- Senior Interview Reference

## Table of Contents

- [The Event Loop](#the-event-loop)
- [setTimeout vs setImmediate vs process.nextTick](#settimeout-vs-setimmediate-vs-processnexttick)
- [Promise Internals](#promise-internals)
- [Generators and Iterators](#generators-and-iterators)
- [Proxy and Reflect](#proxy-and-reflect)
- [WeakRef and FinalizationRegistry](#weakref-and-finalizationregistry)
- [Module Systems: CommonJS vs ESM](#module-systems-commonjs-vs-esm)
- [Memory Management and Garbage Collection](#memory-management-and-garbage-collection)
- [Tagged Templates](#tagged-templates)
- [Advanced Regular Expressions](#advanced-regular-expressions)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## The Event Loop

The event loop is the mechanism that allows Node.js (and browsers) to perform non-blocking I/O despite JavaScript being single-threaded.

### Core Components

```text
┌─────────────────────────────────────────┐
│             Call Stack                   │
│  (Executes functions one at a time)     │
└──────────────────┬──────────────────────┘
                   │
                   v
┌─────────────────────────────────────────┐
│           Event Loop                     │
│  ┌───────────────────────────────────┐  │
│  │ 1. Microtask Queue (highest pri.) │  │
│  │    - Promise callbacks            │  │
│  │    - queueMicrotask()             │  │
│  │    - process.nextTick() *         │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 2. Macrotask Queue (task queue)   │  │
│  │    - setTimeout / setInterval     │  │
│  │    - setImmediate (Node.js)       │  │
│  │    - I/O callbacks                │  │
│  │    - UI rendering (browser)       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

* process.nextTick has its own queue that drains
  before other microtasks in Node.js
```

### Node.js Event Loop Phases (libuv)

```text
   ┌───────────────────────────┐
┌─>│         timers             │  <- setTimeout, setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks      │  <- I/O callbacks deferred to next loop
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare        │  <- internal use only
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │          poll              │  <- retrieve new I/O events
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │          check             │  <- setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      close callbacks       │  <- socket.on('close', ...)
│  └─────────────┬─────────────┘
│                │
└────────────────┘

Between EACH phase: drain microtask queue
  (process.nextTick queue first, then Promise microtasks)
```

### Classic Event Loop Questions

```javascript
// Question 1: What is the output order?
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve().then(() => console.log("3"));

console.log("4");

// Output: 1, 4, 3, 2
// Explanation:
//   "1" -- synchronous
//   "4" -- synchronous
//   "3" -- microtask (Promise) runs before macrotask
//   "2" -- macrotask (setTimeout)
```

```javascript
// Question 2: Nested microtasks and macrotasks
console.log("start");

setTimeout(() => {
  console.log("timeout 1");
  Promise.resolve().then(() => console.log("promise inside timeout"));
}, 0);

setTimeout(() => {
  console.log("timeout 2");
}, 0);

Promise.resolve().then(() => {
  console.log("promise 1");
}).then(() => {
  console.log("promise 2");
});

console.log("end");

// Output: start, end, promise 1, promise 2, timeout 1,
//         promise inside timeout, timeout 2
```

```javascript
// Question 3: process.nextTick vs Promise
process.nextTick(() => console.log("nextTick 1"));
Promise.resolve().then(() => console.log("promise 1"));
process.nextTick(() => console.log("nextTick 2"));
Promise.resolve().then(() => console.log("promise 2"));

// Output: nextTick 1, nextTick 2, promise 1, promise 2
// nextTick queue drains completely before promise microtasks
```

---

## setTimeout vs setImmediate vs process.nextTick

### Comparison Table

| Feature           | `process.nextTick`       | `queueMicrotask`         | `setTimeout(fn, 0)`    | `setImmediate`           |
|-------------------|--------------------------|--------------------------|------------------------|--------------------------|
| Type              | Microtask (special)      | Microtask                | Macrotask              | Macrotask                |
| Phase             | Between phases (first)   | Between phases (after nextTick) | timers phase   | check phase              |
| Recursive danger  | Can starve I/O           | Can starve I/O           | No                     | No                       |
| Min delay         | None                     | None                     | ~1ms (clamped)         | None                     |
| Availability      | Node.js only             | Node.js + Browser        | Universal              | Node.js only             |

### When to Use What

```javascript
// process.nextTick -- when you need to run BEFORE any I/O or timers
// Use case: ensure a callback fires after the current operation but
// before anything else (e.g., EventEmitter pattern)
const EventEmitter = require("events");

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    // Wrong: synchronous emit, listeners not yet attached
    // this.emit("ready");

    // Right: defer to allow listener attachment
    process.nextTick(() => this.emit("ready"));
  }
}

const emitter = new MyEmitter();
emitter.on("ready", () => console.log("Ready!")); // This works now

// queueMicrotask -- standard way to queue a microtask
// Preferred over process.nextTick for new code
queueMicrotask(() => {
  console.log("microtask");
});

// setImmediate -- run in the next iteration of the event loop
// after I/O events are processed
setImmediate(() => {
  console.log("immediate");
});

// setTimeout vs setImmediate ordering (non-deterministic at top level)
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// Could be either order! Depends on process performance

// But inside an I/O callback, setImmediate always fires first
const fs = require("fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
// Output: immediate, timeout (always this order inside I/O)
```

### Starvation Example

```javascript
// DANGEROUS: recursive nextTick starves the event loop
function badRecursion() {
  process.nextTick(badRecursion); // I/O will never be processed
}

// SAFE: recursive setImmediate allows I/O between calls
function safeRecursion() {
  setImmediate(safeRecursion); // I/O callbacks get a chance to run
}
```

---

## Promise Internals

### Promise States

```text
              ┌──── fulfill(value) ──── FULFILLED
              │                            │
PENDING ──────┤                            ├──── .then(onFulfilled)
              │                            │
              └──── reject(reason)  ──── REJECTED
                                           │
                                           ├──── .catch(onRejected)
                                           └──── .then(_, onRejected)

A promise is "settled" when it is either fulfilled or rejected.
A settled promise is immutable -- it cannot change state again.
```

### Building a Simplified Promise

```javascript
class SimplePromise {
  #state = "pending";
  #value = undefined;
  #handlers = [];

  constructor(executor) {
    const resolve = (value) => {
      if (this.#state !== "pending") return;
      // Handle thenables
      if (value && typeof value.then === "function") {
        value.then(resolve, reject);
        return;
      }
      this.#state = "fulfilled";
      this.#value = value;
      this.#handlers.forEach((h) => h.onFulfilled(value));
    };

    const reject = (reason) => {
      if (this.#state !== "pending") return;
      this.#state = "rejected";
      this.#value = reason;
      this.#handlers.forEach((h) => h.onRejected(reason));
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    return new SimplePromise((resolve, reject) => {
      const handle = () => {
        try {
          if (this.#state === "fulfilled") {
            const result = onFulfilled
              ? onFulfilled(this.#value)
              : this.#value;
            resolve(result);
          } else {
            if (onRejected) {
              resolve(onRejected(this.#value));
            } else {
              reject(this.#value);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      if (this.#state === "pending") {
        this.#handlers.push({
          onFulfilled: () => queueMicrotask(handle),
          onRejected: () => queueMicrotask(handle),
        });
      } else {
        queueMicrotask(handle);
      }
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  static resolve(value) {
    return new SimplePromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new SimplePromise((_, reject) => reject(reason));
  }
}
```

### Promise Combinators

```javascript
// Promise.all -- all must succeed, fails fast on first rejection
const results = await Promise.all([
  fetch("/api/users"),
  fetch("/api/posts"),
  fetch("/api/comments"),
]);

// Promise.allSettled -- waits for all, never rejects
const outcomes = await Promise.allSettled([
  fetch("/api/users"),
  fetch("/api/will-fail"),
]);
// [
//   { status: "fulfilled", value: Response },
//   { status: "rejected", reason: Error }
// ]

// Promise.race -- first to settle wins (fulfilled OR rejected)
const winner = await Promise.race([
  fetch("/api/data"),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000)
  ),
]);

// Promise.any -- first to FULFILL wins, rejects only if ALL reject
try {
  const fastest = await Promise.any([
    fetch("https://cdn1.example.com/data"),
    fetch("https://cdn2.example.com/data"),
    fetch("https://cdn3.example.com/data"),
  ]);
} catch (error) {
  // AggregateError with all rejection reasons
  console.log(error.errors);
}
```

### Promise Anti-patterns

```javascript
// Anti-pattern 1: Unnecessary wrapping (the Promise constructor anti-pattern)
// BAD
function getUser(id) {
  return new Promise((resolve, reject) => {
    db.findUser(id).then(resolve).catch(reject);
  });
}
// GOOD
function getUser(id) {
  return db.findUser(id);
}

// Anti-pattern 2: Forgetting to return in .then chains
// BAD
fetchUser()
  .then((user) => {
    fetchPosts(user.id); // Missing return! Next .then gets undefined
  })
  .then((posts) => {
    console.log(posts); // undefined!
  });

// GOOD
fetchUser()
  .then((user) => {
    return fetchPosts(user.id);
  })
  .then((posts) => {
    console.log(posts); // Actual posts
  });

// Anti-pattern 3: Sequential when parallel is possible
// BAD (sequential -- slow)
const users = await getUsers();
const posts = await getPosts();
const comments = await getComments();

// GOOD (parallel -- fast)
const [users, posts, comments] = await Promise.all([
  getUsers(),
  getPosts(),
  getComments(),
]);
```

---

## Generators and Iterators

### The Iteration Protocol

```javascript
// An object is iterable if it has a [Symbol.iterator] method
// that returns an iterator (an object with a .next() method)

const range = {
  from: 1,
  to: 5,

  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { done: true };
      },
    };
  },
};

for (const num of range) {
  console.log(num); // 1, 2, 3, 4, 5
}

console.log([...range]); // [1, 2, 3, 4, 5]

const [first, second] = range; // Destructuring works too
```

### Generator Functions

```javascript
function* numberGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

const gen = numberGenerator();
console.log(gen.next()); // { value: 1, done: false }
console.log(gen.next()); // { value: 2, done: false }
console.log(gen.next()); // { value: 3, done: false }
console.log(gen.next()); // { value: undefined, done: true }

// Generators are iterable
for (const n of numberGenerator()) {
  console.log(n); // 1, 2, 3
}

// Infinite sequences
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Take first 10 Fibonacci numbers
function take(iterable, count) {
  const result = [];
  for (const value of iterable) {
    result.push(value);
    if (result.length >= count) break;
  }
  return result;
}

console.log(take(fibonacci(), 10));
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### Two-Way Communication with Generators

```javascript
function* conversation() {
  const name = yield "What is your name?";
  const age = yield `Hello ${name}! How old are you?`;
  return `${name} is ${age} years old.`;
}

const chat = conversation();
console.log(chat.next());          // { value: "What is your name?", done: false }
console.log(chat.next("Alice"));   // { value: "Hello Alice! How old are you?", done: false }
console.log(chat.next(30));        // { value: "Alice is 30 years old.", done: true }
```

### Delegation with `yield*`

```javascript
function* innerGen() {
  yield "a";
  yield "b";
}

function* outerGen() {
  yield 1;
  yield* innerGen(); // delegate to another generator
  yield 2;
}

console.log([...outerGen()]); // [1, "a", "b", 2]

// Practical: tree traversal
function* traverse(node) {
  yield node.value;
  if (node.left) yield* traverse(node.left);
  if (node.right) yield* traverse(node.right);
}
```

### Async Generators

```javascript
async function* fetchPages(baseUrl) {
  let page = 1;
  while (true) {
    const response = await fetch(`${baseUrl}?page=${page}`);
    const data = await response.json();

    if (data.items.length === 0) return;

    yield data.items;
    page++;
  }
}

// Consuming with for-await-of
async function getAllItems() {
  const allItems = [];
  for await (const items of fetchPages("/api/data")) {
    allItems.push(...items);
  }
  return allItems;
}
```

---

## Proxy and Reflect

### Proxy Basics

A `Proxy` wraps an object and intercepts operations on it via "traps."

```javascript
const handler = {
  get(target, property, receiver) {
    console.log(`Getting ${String(property)}`);
    return Reflect.get(target, property, receiver);
  },
  set(target, property, value, receiver) {
    console.log(`Setting ${String(property)} = ${value}`);
    return Reflect.set(target, property, value, receiver);
  },
};

const user = new Proxy({}, handler);
user.name = "Alice"; // "Setting name = Alice"
console.log(user.name); // "Getting name" -> "Alice"
```

### All Proxy Traps

| Trap                    | Intercepts                                |
|-------------------------|-------------------------------------------|
| `get`                   | Property read                             |
| `set`                   | Property write                            |
| `has`                   | `in` operator                             |
| `deleteProperty`        | `delete` operator                         |
| `apply`                 | Function call                             |
| `construct`             | `new` operator                            |
| `getPrototypeOf`        | `Object.getPrototypeOf`                   |
| `setPrototypeOf`        | `Object.setPrototypeOf`                   |
| `isExtensible`          | `Object.isExtensible`                     |
| `preventExtensions`     | `Object.preventExtensions`                |
| `defineProperty`        | `Object.defineProperty`                   |
| `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor`     |
| `ownKeys`               | `Object.keys`, `for...in`, etc.           |

### Practical Proxy Patterns

```javascript
// 1. Validation
function createValidatedObject(validationRules) {
  return new Proxy(
    {},
    {
      set(target, prop, value) {
        const rule = validationRules[prop];
        if (rule && !rule(value)) {
          throw new TypeError(
            `Invalid value for ${String(prop)}: ${value}`
          );
        }
        target[prop] = value;
        return true;
      },
    }
  );
}

const user = createValidatedObject({
  age: (v) => typeof v === "number" && v >= 0 && v <= 150,
  email: (v) => typeof v === "string" && v.includes("@"),
});

user.email = "alice@example.com"; // OK
// user.age = -5;                 // TypeError

// 2. Negative array indices (Python-style)
function createNegativeArray(arr) {
  return new Proxy(arr, {
    get(target, prop, receiver) {
      const index = Number(prop);
      if (!isNaN(index) && index < 0) {
        prop = String(target.length + index);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const arr = createNegativeArray([1, 2, 3, 4, 5]);
console.log(arr[-1]); // 5
console.log(arr[-2]); // 4

// 3. Observable / Reactive data
function observable(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      if (oldValue !== value) {
        onChange(prop, value, oldValue);
      }
      return true;
    },
  });
}

const state = observable({ count: 0 }, (prop, newVal, oldVal) => {
  console.log(`${prop}: ${oldVal} -> ${newVal}`);
});

state.count = 1; // "count: 0 -> 1"

// 4. Revocable proxy (for access control)
const { proxy, revoke } = Proxy.revocable(
  { secret: "data" },
  {}
);
console.log(proxy.secret); // "data"
revoke();
// console.log(proxy.secret); // TypeError: Cannot perform 'get' on a revoked proxy
```

### Reflect API

`Reflect` provides default behavior for all proxy traps as static methods.

```javascript
// Reflect mirrors proxy traps 1:1
Reflect.get(target, prop);
Reflect.set(target, prop, value);
Reflect.has(target, prop);        // same as `prop in target`
Reflect.deleteProperty(target, prop);
Reflect.ownKeys(target);
Reflect.apply(fn, thisArg, args);
Reflect.construct(Cls, args);

// Key advantage: returns boolean for success/failure instead of throwing
const obj = Object.freeze({ x: 1 });
Reflect.set(obj, "x", 2); // returns false (no exception)
// vs
// Object.defineProperty(obj, "x", { value: 2 }); // throws TypeError
```

---

## WeakRef and FinalizationRegistry

### WeakRef

A `WeakRef` holds a weak reference to an object, allowing it to be garbage collected.

```javascript
class Cache {
  #cache = new Map();

  set(key, value) {
    this.#cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this.#cache.get(key);
    if (!ref) return undefined;

    const value = ref.deref(); // returns undefined if GC'd
    if (!value) {
      this.#cache.delete(key); // clean up stale entry
      return undefined;
    }
    return value;
  }
}

let bigObject = { data: new Array(1_000_000) };
const cache = new Cache();
cache.set("big", bigObject);

console.log(cache.get("big")); // { data: [...] }

bigObject = null; // Allow GC
// After GC runs:
// cache.get("big") -> undefined
```

### FinalizationRegistry

Allows you to request a callback when an object is garbage collected.

```javascript
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`Object with id ${heldValue} was garbage collected`);
  // Clean up external resources (file handles, network connections, etc.)
});

function createTrackedObject(id) {
  const obj = { id, data: "important" };
  registry.register(obj, id); // heldValue = id
  return obj;
}

let obj = createTrackedObject(42);
obj = null;
// Eventually: "Object with id 42 was garbage collected"
```

> **Warning:** Do not rely on `FinalizationRegistry` for critical cleanup. GC timing is non-deterministic, and the callback may never run if the process exits first.

---

## Module Systems: CommonJS vs ESM

### Comparison Table

| Feature              | CommonJS (CJS)           | ES Modules (ESM)              |
|----------------------|--------------------------|-------------------------------|
| Syntax               | `require()` / `module.exports` | `import` / `export`     |
| Loading              | Synchronous              | Asynchronous                  |
| Evaluation           | Runtime (dynamic)        | Parse time (static)           |
| Exports binding      | Value copy               | Live bindings                 |
| Top-level `this`     | `module.exports`         | `undefined`                   |
| File extensions      | `.js`, `.cjs`            | `.mjs` or `.js` (with type:module) |
| Tree-shaking         | Difficult                | Supported natively            |
| `__dirname`/`__filename` | Available            | Not available (use `import.meta.url`) |
| Dynamic import       | `require(expr)`          | `import(expr)` (returns Promise) |
| Circular deps        | Partial exports          | Live bindings (better handled)|
| JSON import          | `require("./data.json")` | Import assertions needed      |

### CommonJS

```javascript
// math.cjs
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }

module.exports = { add, subtract };
// or: exports.add = add;

// app.cjs
const { add, subtract } = require("./math.cjs");
console.log(add(1, 2)); // 3

// Dynamic require
const moduleName = "./math.cjs";
const math = require(moduleName); // works at runtime

// Module caching
const a = require("./math.cjs");
const b = require("./math.cjs");
console.log(a === b); // true (same cached module object)
```

### ES Modules

```javascript
// math.mjs
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export default class Calculator { /* ... */ }

// app.mjs
import Calculator, { add, subtract } from "./math.mjs";
import * as math from "./math.mjs";

// Dynamic import (returns a Promise)
const { add } = await import("./math.mjs");

// Conditional import
if (process.env.NODE_ENV === "development") {
  const { debug } = await import("./debug.mjs");
  debug.enable();
}

// import.meta
console.log(import.meta.url);  // file:///path/to/app.mjs

// Replicate __dirname in ESM
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### Live Bindings vs Value Copies

```javascript
// CommonJS: value copy
// counter.cjs
let count = 0;
function increment() { count++; }
module.exports = { count, increment };

// app.cjs
const counter = require("./counter.cjs");
console.log(counter.count); // 0
counter.increment();
console.log(counter.count); // 0 (!) -- it's a copy

// ESM: live binding
// counter.mjs
export let count = 0;
export function increment() { count++; }

// app.mjs
import { count, increment } from "./counter.mjs";
console.log(count); // 0
increment();
console.log(count); // 1 -- live binding reflects the change
```

### Interop Between CJS and ESM

```javascript
// ESM can import CJS
import cjsModule from "./module.cjs"; // default import only

// CJS can import ESM (only with dynamic import)
async function main() {
  const esmModule = await import("./module.mjs");
}

// package.json settings
// { "type": "module" }     -> .js files treated as ESM
// { "type": "commonjs" }   -> .js files treated as CJS (default)
// Use .mjs / .cjs to be explicit regardless of package.json
```

---

## Memory Management and Garbage Collection

### V8 Memory Structure

```text
┌────────────────────────────────────┐
│             V8 Heap                │
│  ┌──────────────────────────────┐  │
│  │        New Space             │  │  <- Short-lived objects
│  │   (Semi-space: From / To)    │  │     Minor GC (Scavenge)
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │        Old Space             │  │  <- Long-lived objects
│  │   (Old Pointer / Old Data)   │  │     Major GC (Mark-Sweep-Compact)
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │      Large Object Space      │  │  <- Objects > ~512KB
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │       Code Space             │  │  <- JIT compiled code
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │       Map Space              │  │  <- Hidden classes (shapes)
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### GC Algorithms

| Algorithm           | Space     | Strategy                                    |
|---------------------|-----------|---------------------------------------------|
| Scavenge            | New Space | Copy live objects between two semi-spaces    |
| Mark-Sweep          | Old Space | Mark reachable objects, sweep unmarked ones  |
| Mark-Compact        | Old Space | Like Mark-Sweep but also compacts memory     |
| Incremental Marking | Old Space | Breaks marking into small steps              |
| Concurrent Marking  | Old Space | Marks on background threads                  |

### Common Memory Leak Patterns

```javascript
// 1. Forgotten timers
const data = loadHugeDataset();
const intervalId = setInterval(() => {
  // `data` is captured in the closure -- never GC'd
  sendMetrics(data);
}, 1000);
// Fix: clearInterval(intervalId) when done

// 2. Closures retaining unnecessary references
function createProcessor() {
  const hugeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100 MB
  const config = { timeout: 5000 };

  return function process() {
    // Only uses `config`, but `hugeBuffer` is also retained
    return doWork(config);
  };
}
// Fix: structure code so closures only capture what they need

// 3. Event listeners not cleaned up
class UserComponent {
  constructor() {
    // This creates a strong reference to `this`
    window.addEventListener("resize", this.handleResize);
  }

  handleResize = () => { /* ... */ };

  destroy() {
    window.removeEventListener("resize", this.handleResize);
  }
}

// 4. Growing data structures
const cache = {};
function processRequest(req) {
  cache[req.id] = computeResult(req); // Cache grows indefinitely
}
// Fix: use LRU cache, TTL, or WeakMap

// 5. Global variables
function leaky() {
  leaked = "I am global"; // No var/let/const -> global (in sloppy mode)
}
```

### Monitoring Memory

```javascript
// Node.js memory usage
const mem = process.memoryUsage();
console.log({
  rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,          // Total allocated
  heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`, // V8 heap allocated
  heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,   // V8 heap used
  external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,   // C++ objects
  arrayBuffers: `${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
});

// V8 heap statistics
const v8 = require("v8");
console.log(v8.getHeapStatistics());

// Max old space size
// node --max-old-space-size=4096 app.js  (4 GB)
```

---

## Tagged Templates

Tagged templates allow you to parse template literals with a function.

```javascript
// The tag function receives:
//   strings: array of string literals (always strings.length === values.length + 1)
//   values:  the interpolated expressions
function tag(strings, ...values) {
  console.log(strings); // ["Hello, ", "! You are ", " years old."]
  console.log(values);  // ["Alice", 30]

  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? values[i] : "");
  }, "");
}

const name = "Alice";
const age = 30;
tag`Hello, ${name}! You are ${age} years old.`;
```

### Practical Tagged Template Examples

```javascript
// 1. SQL query builder (prevent injection)
function sql(strings, ...values) {
  const query = strings.join("?");
  return { query, params: values };
}

const userId = 42;
const result = sql`SELECT * FROM users WHERE id = ${userId} AND active = ${true}`;
// { query: "SELECT * FROM users WHERE id = ? AND active = ?", params: [42, true] }

// 2. HTML escaping
function safeHtml(strings, ...values) {
  const escape = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? escape(values[i]) : "");
  }, "");
}

const userInput = '<script>alert("xss")</script>';
console.log(safeHtml`<div>${userInput}</div>`);
// <div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>

// 3. Styled components (real-world usage)
const Button = styled.button`
  background: ${(props) => (props.primary ? "blue" : "white")};
  color: ${(props) => (props.primary ? "white" : "blue")};
  padding: 8px 16px;
  border-radius: 4px;
`;

// 4. GraphQL queries (gql tag)
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
    }
  }
`;
```

---

## Advanced Regular Expressions

### Named Capture Groups

```javascript
const dateRegex = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const match = dateRegex.exec("2024-01-15");

console.log(match.groups.year);  // "2024"
console.log(match.groups.month); // "01"
console.log(match.groups.day);   // "15"

// In String.replace
"2024-01-15".replace(dateRegex, "$<day>/$<month>/$<year>");
// "15/01/2024"
```

### Lookbehind and Lookahead

```javascript
// Lookahead: (?=...) positive, (?!...) negative
// Match 'foo' only if followed by 'bar'
console.log("foobar foobaz".match(/foo(?=bar)/g)); // ["foo"]

// Match 'foo' only if NOT followed by 'bar'
console.log("foobar foobaz".match(/foo(?!bar)/g)); // ["foo"]

// Lookbehind: (?<=...) positive, (?<!...) negative
// Match digits only if preceded by '$'
console.log("$100 200 $300".match(/(?<=\$)\d+/g)); // ["100", "300"]

// Match digits NOT preceded by '$'
console.log("$100 200 $300".match(/(?<!\$)\d+/g)); // ["00", "200", "00"]
// Note: "00" matches because those digits are not preceded by '$'
```

### The `d` (hasIndices) Flag

```javascript
const regex = /(?<word>\w+)/d;
const match = regex.exec("Hello World");

console.log(match.indices[0]);        // [0, 5] -- full match
console.log(match.indices.groups.word); // [0, 5] -- named group
```

### matchAll

```javascript
const text = "cat: meow, dog: woof, cat: purr";
const regex = /(\w+): (\w+)/g;

for (const match of text.matchAll(regex)) {
  console.log(`${match[1]} says ${match[2]}`);
}
// "cat says meow"
// "dog says woof"
// "cat says purr"
```

### Unicode Support

```javascript
// \p{...} Unicode property escapes (requires 'u' flag)
const emojiRegex = /\p{Emoji_Presentation}/gu;
console.log("Hello World".match(emojiRegex)); // null or emoji matches

// Match any letter from any language
const letterRegex = /\p{Letter}+/gu;
console.log("Hello".match(letterRegex)); // ["Hello"]

// The 'v' flag (ES2024) -- set notation and string properties
const regex = /[\p{Script=Greek}&&\p{Letter}]/v;
```

---

## Interview Tips and Key Takeaways

1. **Event loop mastery** is the most commonly tested advanced JS topic. Practice predicting output order with mixtures of `setTimeout`, `Promise`, `nextTick`, and `setImmediate`.

2. **Know the difference between microtasks and macrotasks** -- microtasks always drain completely before the next macrotask.

3. **`process.nextTick` runs before Promise microtasks** in Node.js. This is a frequent interview trick question.

4. **Understand CJS vs ESM** differences, especially live bindings vs value copies, and the practical implications for circular dependencies.

5. **Proxy/Reflect** questions are becoming more common in senior interviews. Know at least 2-3 practical use cases (validation, logging, reactive data).

6. **Memory leaks** -- be ready to identify common patterns and explain how to diagnose them using `process.memoryUsage()`, heap snapshots, and the `--inspect` flag.

7. **Generators** are the foundation of `async/await` -- understanding them deeply shows mastery of the language.

8. **Promise internals** -- being able to sketch out a basic Promise implementation demonstrates deep understanding.

9. **WeakRef/FinalizationRegistry** are niche but show you stay current with the language evolution.

10. **Tagged templates** -- know at least the SQL injection prevention and HTML escaping use cases.

---

## Quick Reference / Cheat Sheet

```text
EVENT LOOP EXECUTION ORDER
  1. Synchronous code (call stack)
  2. process.nextTick queue (Node.js)
  3. Promise microtasks (queueMicrotask)
  4. Macrotask (setTimeout, setImmediate, I/O)
  5. Between each phase: drain all microtasks again

NODE.JS EVENT LOOP PHASES
  timers -> pending callbacks -> idle/prepare -> poll -> check -> close

PROMISE COMBINATORS
  Promise.all([...])         -- all succeed or fail fast
  Promise.allSettled([...])  -- wait for all, never rejects
  Promise.race([...])        -- first to settle (fulfilled or rejected)
  Promise.any([...])         -- first to fulfill, or AggregateError

MODULE SYSTEMS
  CJS:  require() / module.exports  -- sync, runtime, value copy
  ESM:  import / export             -- async, static, live bindings

GENERATOR PROTOCOL
  function* gen() { yield value; }
  const g = gen();
  g.next(input)   -> { value, done }
  g.return(value)  -> forces completion
  g.throw(error)   -> throws into generator

PROXY TRAPS (most common)
  get, set, has, deleteProperty, apply, construct, ownKeys

V8 MEMORY
  New Space  -> Scavenge (minor GC)
  Old Space  -> Mark-Sweep-Compact (major GC)
  node --max-old-space-size=4096 app.js

MEMORY LEAK SOURCES
  - Forgotten timers/intervals
  - Closures capturing large objects
  - Unremoved event listeners
  - Growing caches without eviction
  - Accidental globals (missing var/let/const)
```
