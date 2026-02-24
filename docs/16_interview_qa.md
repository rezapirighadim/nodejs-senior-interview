# Interview Questions & Answers -- Senior Interview Reference

## Table of Contents

- [Core JavaScript (8 Q&A)](#core-javascript)
- [Node.js (6 Q&A)](#nodejs)
- [Async Programming (5 Q&A)](#async-programming)
- [TypeScript (4 Q&A)](#typescript)
- [System Design (4 Q&A)](#system-design)
- [Behavioral Questions (STAR Framework)](#behavioral-questions-star-framework)
- [6-Week Study Plan](#6-week-study-plan)
- [Coding Tips for JS Interviews](#coding-tips-for-js-interviews)
- [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## Core JavaScript

### Q1: Event Loop

**Q:** Explain the JavaScript event loop. How does Node.js handle asynchronous operations if JavaScript is single-threaded?

**A:** JavaScript has a single call stack for executing code, but Node.js achieves concurrency through the **event loop** -- a mechanism that offloads I/O operations to the OS kernel or libuv's thread pool and processes their callbacks when they complete.

The event loop runs in phases: **timers** (setTimeout/setInterval callbacks), **pending callbacks** (deferred I/O), **poll** (retrieve new I/O events), **check** (setImmediate), and **close callbacks**. Between each phase, the **microtask queue** (Promises, queueMicrotask) and **process.nextTick queue** are drained.

When you call `fs.readFile()`, Node.js delegates the actual file read to the libuv thread pool. The main thread continues executing other code. When the read completes, its callback is placed in the poll queue and executed on the next appropriate event loop iteration.

```javascript
console.log("1");                          // call stack (sync)
setTimeout(() => console.log("2"), 0);     // timers phase
Promise.resolve().then(() => console.log("3")); // microtask queue
process.nextTick(() => console.log("4"));  // nextTick queue
console.log("5");                          // call stack (sync)

// Output: 1, 5, 4, 3, 2
```

The key insight: "single-threaded" means JavaScript execution is single-threaded, but Node.js itself uses multiple threads (libuv pool, OS I/O threads) behind the scenes.

---

### Q2: Closures

**Q:** What is a closure? Give a practical example and explain a common pitfall.

**A:** A **closure** is a function that retains access to its lexical scope (the variables from its outer function) even after the outer function has returned. Every function in JavaScript creates a closure.

```javascript
function createCounter(initial = 0) {
  let count = initial; // enclosed variable

  return {
    increment() { return ++count; },
    decrement() { return --count; },
    getCount() { return count; }
  };
}

const counter = createCounter(10);
counter.increment(); // 11
counter.increment(); // 12
counter.getCount();  // 12
// `count` is private -- only accessible through the returned methods
```

**Practical uses:** data privacy (module pattern), factory functions, callbacks that remember state, memoization, and partial application.

**Common pitfall -- `var` in loops:**

```javascript
// Bug: all callbacks share the same `i` because var is function-scoped
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3

// Fix 1: use let (block-scoped -- creates new binding per iteration)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 0, 1, 2

// Fix 2: IIFE to capture value
for (var i = 0; i < 3; i++) {
  ((j) => setTimeout(() => console.log(j), 100))(i);
}
```

**Memory concern:** Closures can cause memory leaks if they unintentionally hold references to large objects that are no longer needed. Set references to `null` when done.

---

### Q3: The `this` Keyword

**Q:** Explain how `this` works in JavaScript. How is it determined?

**A:** The value of `this` depends on **how a function is called**, not where it is defined. There are five binding rules, checked in order of precedence:

| Rule                | `this` Value                    | Example                              |
|---------------------|---------------------------------|--------------------------------------|
| **`new` binding**   | The newly created object        | `new Foo()` -- `this` = new instance |
| **Explicit binding**| The specified object            | `fn.call(obj)`, `fn.apply(obj)`, `fn.bind(obj)` |
| **Implicit binding**| The object before the dot       | `obj.fn()` -- `this` = `obj`        |
| **Default binding** | `globalThis` (or `undefined` in strict mode) | `fn()` standalone call     |
| **Arrow function**  | Inherits from enclosing lexical scope | Cannot be overridden          |

```javascript
const user = {
  name: "Alice",
  greet() {
    console.log(`Hi, I'm ${this.name}`);
  },
  greetLater() {
    // Bug: 'this' is lost in the callback
    setTimeout(function () {
      console.log(this.name); // undefined (default binding)
    }, 100);
  },
  greetLaterFixed() {
    // Fix: arrow function inherits 'this' from greetLaterFixed
    setTimeout(() => {
      console.log(this.name); // "Alice"
    }, 100);
  }
};

user.greet();          // "Hi, I'm Alice" (implicit binding)
const fn = user.greet;
fn();                  // undefined (default binding -- lost context)
fn.call(user);         // "Hi, I'm Alice" (explicit binding)
```

**Key rule for interviews:** Arrow functions do NOT have their own `this`. They capture `this` from the surrounding scope at definition time. This makes them ideal for callbacks but unsuitable as methods on objects or constructors.

---

### Q4: Prototypes

**Q:** Explain prototypal inheritance. How does the prototype chain work?

**A:** Every JavaScript object has an internal `[[Prototype]]` link (accessible via `__proto__` or `Object.getPrototypeOf()`). When you access a property on an object, JavaScript first checks the object itself, then walks up the prototype chain until it finds the property or reaches `null`.

```javascript
const animal = {
  alive: true,
  breathe() {
    return "inhale... exhale...";
  }
};

const dog = Object.create(animal); // dog's prototype = animal
dog.bark = function () { return "Woof!"; };

dog.bark();    // "Woof!" -- found on dog itself
dog.breathe(); // "inhale... exhale..." -- found on prototype (animal)
dog.alive;     // true -- found on prototype
dog.fly;       // undefined -- not found anywhere in chain

// Prototype chain: dog -> animal -> Object.prototype -> null
```

**Constructor functions and `new`:**

```javascript
function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};

const alice = new Person("Alice");
// alice.__proto__ === Person.prototype
// Person.prototype.__proto__ === Object.prototype
```

**ES6 `class` is syntactic sugar** over prototypal inheritance -- it does not change the underlying mechanism.

---

### Q5: Hoisting

**Q:** What is hoisting? How does it differ for `var`, `let`, `const`, functions, and classes?

**A:** **Hoisting** is JavaScript's behavior of moving declarations to the top of their scope during the compile phase. However, only the declarations are hoisted -- not the initializations.

| Declaration        | Hoisted? | Initialized?         | Accessible before declaration? |
|--------------------|----------|----------------------|-------------------------------|
| `var`              | Yes      | Yes, to `undefined`  | Yes (value is `undefined`)    |
| `let`              | Yes      | No (TDZ)             | No -- `ReferenceError`        |
| `const`            | Yes      | No (TDZ)             | No -- `ReferenceError`        |
| `function` declaration | Yes  | Yes, fully           | Yes -- fully usable           |
| `function` expression  | Like the variable (`var`/`let`/`const`) | Depends | Depends      |
| `class`            | Yes      | No (TDZ)             | No -- `ReferenceError`        |

```javascript
// var: hoisted and initialized to undefined
console.log(a); // undefined
var a = 5;

// let/const: hoisted but in Temporal Dead Zone (TDZ)
console.log(b); // ReferenceError: Cannot access 'b' before initialization
let b = 10;

// Function declaration: fully hoisted
greet(); // "Hello!" -- works
function greet() { console.log("Hello!"); }

// Function expression: NOT fully hoisted
sayHi(); // TypeError: sayHi is not a function
var sayHi = function () { console.log("Hi!"); };
```

**TDZ (Temporal Dead Zone):** The period between entering a scope and the actual declaration of a `let`/`const` variable. The variable exists but cannot be accessed.

---

### Q6: `==` vs `===`

**Q:** What is the difference between `==` and `===`? When would you use `==`?

**A:** `===` (strict equality) compares both **value and type** without conversion. `==` (loose equality) performs **type coercion** before comparing.

```javascript
// === (strict) -- no coercion
5 === 5       // true
5 === "5"     // false (different types)
null === undefined // false

// == (loose) -- coerces types
5 == "5"      // true ("5" coerced to 5)
0 == false    // true (false coerced to 0)
"" == false   // true (both coerce to 0)
null == undefined // true (special rule)
null == 0     // false (null only == undefined)
NaN == NaN    // false (NaN is not equal to anything)
```

**Coercion rules for `==`:**
1. If types are the same, use `===`
2. `null == undefined` is `true` (and nothing else)
3. Number vs String: convert string to number
4. Boolean vs anything: convert boolean to number first
5. Object vs primitive: call `valueOf()` then `toString()` on the object

**When to use `==`:** The only commonly accepted use is `value == null`, which checks for both `null` and `undefined` in a single comparison. In all other cases, prefer `===`.

---

### Q7: `var` vs `let` vs `const`

**Q:** Compare `var`, `let`, and `const`. Which should you prefer and why?

**A:**

| Feature           | `var`              | `let`              | `const`            |
|-------------------|--------------------|--------------------|--------------------|
| Scope             | Function-scoped    | Block-scoped       | Block-scoped       |
| Hoisting          | Yes (initialized to `undefined`) | Yes (TDZ) | Yes (TDZ)        |
| Redeclaration     | Allowed            | Not allowed        | Not allowed        |
| Reassignment      | Allowed            | Allowed            | Not allowed        |
| Global object property | Yes (`window.x`) | No              | No                 |

```javascript
// Scope difference
function example() {
  if (true) {
    var x = 1;   // visible in entire function
    let y = 2;   // visible only in this block
    const z = 3; // visible only in this block
  }
  console.log(x); // 1
  console.log(y); // ReferenceError
  console.log(z); // ReferenceError
}

// const does NOT mean immutable -- object contents can change
const obj = { a: 1 };
obj.a = 2;      // allowed -- modifying property
obj.b = 3;      // allowed -- adding property
obj = {};       // TypeError -- cannot reassign the binding
```

**Best practice:** Default to `const`. Use `let` when you need to reassign. Never use `var` in modern code.

---

### Q8: Type Coercion

**Q:** Explain implicit type coercion in JavaScript. What are some surprising results?

**A:** JavaScript automatically converts types during operations. The rules differ for numeric, string, and boolean contexts.

```javascript
// String concatenation wins over addition
"5" + 3        // "53" (3 coerced to string)
5 + "3"         // "53" (5 coerced to string)

// Other operators trigger numeric coercion
"5" - 3        // 2 (string "5" -> number 5)
"5" * "3"      // 15
true + true    // 2 (true -> 1)

// Surprising results
[] + []        // "" (arrays coerce to empty strings)
[] + {}        // "[object Object]" (string concatenation)
{} + []        // 0 (block statement + unary plus on [])
true + "1"     // "true1" (boolean coerced to string)
null + 1       // 1 (null coerces to 0)
undefined + 1  // NaN (undefined coerces to NaN)

// Boolean context (falsy values)
Boolean(0)         // false
Boolean("")        // false
Boolean(null)      // false
Boolean(undefined) // false
Boolean(NaN)       // false
Boolean(false)     // false
// Everything else is truthy (including [], {}, "0", "false")
```

**Key rules:**
- `+` with any string operand -> string concatenation
- `-`, `*`, `/`, `%` -> numeric coercion
- `==` follows the coercion algorithm (prefer `===`)
- `if`/`while`/`!`/`!!` -> boolean coercion
- `null` coerces to `0` numerically but `null == 0` is `false` (special `==` rule)

---

## Node.js

### Q9: Event Loop Phases

**Q:** Describe the phases of the Node.js event loop and the order in which they execute.

**A:** The Node.js event loop has six phases, executed in a fixed order:

1. **Timers:** Execute callbacks from `setTimeout` and `setInterval` whose delay has elapsed.
2. **Pending callbacks:** Execute I/O callbacks deferred from the previous loop iteration (e.g., TCP errors).
3. **Idle/Prepare:** Internal use only by Node.js.
4. **Poll:** Retrieve new I/O events and execute their callbacks (file reads, network data). The loop may block here waiting for events if there are no timers scheduled.
5. **Check:** Execute `setImmediate` callbacks.
6. **Close callbacks:** Execute close event handlers (e.g., `socket.on('close')`).

Between each phase, Node.js drains two queues in order:
- **process.nextTick queue** (highest priority)
- **Microtask queue** (Promise `.then`, `queueMicrotask`)

```javascript
// Inside an I/O callback, setImmediate always fires before setTimeout(0)
const fs = require("fs");
fs.readFile(__filename, () => {
  setImmediate(() => console.log("setImmediate"));  // check phase
  setTimeout(() => console.log("setTimeout"), 0);   // timers (next iteration)
});
// Output: setImmediate, setTimeout (guaranteed order)
```

This is important because it determines the execution order of mixed async operations and is one of the most frequently tested Node.js concepts.

---

### Q10: Streams

**Q:** What are Node.js Streams? When and why would you use them?

**A:** Streams are an interface for working with data that flows in chunks rather than being loaded entirely into memory. They extend `EventEmitter` and come in four types:

- **Readable:** Source of data (`fs.createReadStream`, HTTP request body)
- **Writable:** Destination for data (`fs.createWriteStream`, HTTP response)
- **Duplex:** Both readable and writable (TCP socket)
- **Transform:** Duplex that modifies data as it passes through (`zlib.createGzip`)

**Why use streams:**
- **Memory efficiency:** Process a 10GB file without loading it all into RAM
- **Time efficiency:** Start processing data before the entire payload arrives
- **Composability:** Chain transforms like Unix pipes

```javascript
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

// Compress a file with streaming -- constant memory regardless of file size
await pipeline(
  createReadStream("huge-file.log"),   // read chunks
  createGzip(),                         // compress each chunk
  createWriteStream("huge-file.log.gz") // write compressed chunks
);
```

**Always use `pipeline()` over `.pipe()`** because `pipeline` properly handles errors and cleans up (destroys) streams. The old `.pipe()` does not destroy streams on error, which leads to memory leaks.

**Backpressure** is a critical concept: when the writable cannot keep up with the readable, `pipeline` automatically pauses the readable until the writable catches up.

---

### Q11: Cluster Module vs Worker Threads

**Q:** What is the difference between the Cluster module and Worker Threads? When would you use each?

**A:**

| Feature             | Cluster Module                   | Worker Threads                    |
|---------------------|----------------------------------|-----------------------------------|
| Process model       | Multiple OS processes (fork)     | Threads within one process        |
| Memory              | Separate memory per process      | Separate V8 heap, but can share via SharedArrayBuffer |
| Communication       | IPC (serialized messages)        | MessagePort (structured clone) + SharedArrayBuffer |
| Use case            | Scale HTTP servers across CPU cores | Offload CPU-intensive JS tasks  |
| Port sharing        | Yes (workers share a listen port)| No                                |
| Crash isolation     | One worker crash does not affect others | Thread crash may affect process |

**Use Cluster when:** You want to scale an HTTP server to use all CPU cores. Each worker is a full copy of your server handling requests independently. This is what PM2's cluster mode does.

**Use Worker Threads when:** You need to run CPU-intensive JavaScript (image processing, data parsing, crypto) without blocking the main event loop. Workers are lighter than processes and can share memory.

```javascript
// Cluster: multiple servers sharing a port
if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) cluster.fork();
} else {
  http.createServer(handler).listen(3000);
}

// Worker: offload CPU work
const worker = new Worker("./heavy-task.js", { workerData: { input } });
worker.on("message", result => console.log(result));
```

**Rule of thumb:** Cluster for horizontal request handling, Workers for background computation.

---

### Q12: libuv

**Q:** What is libuv and why is it important to Node.js?

**A:** **libuv** is a C library that provides Node.js with its event loop, asynchronous I/O, and cross-platform abstraction layer. It is the engine that makes Node.js non-blocking.

Key responsibilities:
- **Event loop implementation:** The core loop that checks for pending callbacks and dispatches them
- **Thread pool (default 4 threads):** Handles blocking operations like file I/O, DNS lookups (`dns.lookup`), and crypto operations
- **OS kernel abstraction:** Uses `epoll` (Linux), `kqueue` (macOS), `IOCP` (Windows) for efficient network I/O
- **Async DNS, file system, child processes, signals, timers**

```
Your JavaScript code (V8)
         │
    Node.js C++ bindings
         │
       libuv
    ┌────┼────┐
    │    │    │
  Thread  Event  OS Kernel
  Pool    Loop   (epoll/kqueue)
```

**Important detail:** Network I/O does NOT use the thread pool. It goes directly to the OS kernel's async I/O mechanism. Only file system operations, DNS lookups, and some crypto operations use the thread pool. This is why Node.js can handle thousands of concurrent network connections with just a few threads.

You can increase the thread pool size with `UV_THREADPOOL_SIZE` (max 1024), which helps when your app does many concurrent file system or crypto operations.

---

### Q13: CommonJS vs ES Modules

**Q:** What are the differences between CommonJS (CJS) and ES Modules (ESM) in Node.js?

**A:**

| Feature               | CommonJS (CJS)                | ES Modules (ESM)              |
|-----------------------|-------------------------------|-------------------------------|
| Syntax                | `require()` / `module.exports`| `import` / `export`           |
| Loading               | Synchronous                   | Asynchronous                  |
| Evaluation            | Runtime (dynamic)             | Static analysis + runtime     |
| Top-level await       | Not supported                 | Supported                     |
| Tree-shaking          | Difficult                     | Supported (static analysis)   |
| File extension        | `.js` or `.cjs`               | `.mjs` or `.js` with `"type": "module"` |
| `this` at top level   | `module.exports`              | `undefined`                   |
| `__dirname`/`__filename` | Available                  | Not available (use `import.meta.url`) |
| Circular dependencies | Returns partial export        | Returns live bindings (references) |

```javascript
// CommonJS
const fs = require("node:fs");
const { join } = require("node:path");
module.exports = { myFunction };
module.exports.anotherFn = () => {};

// ES Modules
import fs from "node:fs";
import { join } from "node:path";
export function myFunction() {}
export default class MyClass {}

// ESM equivalent of __dirname
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**Key difference in circular dependencies:** CJS returns whatever has been exported so far (potentially incomplete). ESM uses live bindings -- imports are references that update when the source module updates them.

**Interop:** ESM can `import` CJS modules. CJS can load ESM using dynamic `import()` (returns a Promise).

---

### Q14: Error Handling in Node.js

**Q:** What are the different error handling patterns in Node.js and when should you use each?

**A:** Node.js has several error handling patterns depending on the context:

**1. Try/catch (synchronous + async/await):**
```javascript
try {
  const data = JSON.parse(invalidJson);
} catch (err) {
  console.error("Parse failed:", err.message);
}

async function fetchData() {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    // Catches both network errors and JSON parse errors
    return null;
  }
}
```

**2. Error-first callbacks (legacy pattern):**
```javascript
fs.readFile("file.txt", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  // use data
});
```

**3. Promise .catch():**
```javascript
fetchData()
  .then(process)
  .catch(err => console.error(err));
```

**4. EventEmitter 'error' event:**
```javascript
const stream = fs.createReadStream("file.txt");
stream.on("error", (err) => {
  console.error("Stream error:", err);
});
// If no 'error' listener is attached, the process crashes!
```

**5. Process-level handlers (safety nets):**
```javascript
process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err);
  process.exit(1); // process is in an unknown state -- exit
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  // Since Node 15+, this terminates the process by default
});
```

**Best practices:**
- Always handle errors as close to the source as possible
- Use typed/custom errors for different failure categories
- Process-level handlers are safety nets, not error handling strategies
- Never swallow errors silently (`catch (err) {}`)
- In Express: use error-handling middleware `(err, req, res, next)`

---

## Async Programming

### Q15: Promise vs Callback

**Q:** Why were Promises introduced? What problems do they solve over callbacks?

**A:** Promises solve several fundamental problems with callbacks:

| Problem                    | Callbacks                      | Promises                        |
|----------------------------|--------------------------------|---------------------------------|
| Nested async (callback hell) | Deep nesting, hard to read  | Flat `.then()` chains           |
| Error handling             | Manual error-first in every callback | Single `.catch()` for entire chain |
| Composition                | Difficult to combine           | `Promise.all`, `race`, `allSettled` |
| Return values              | Cannot return from callbacks   | `.then()` returns a new Promise  |
| Trust (inversion of control) | Callback may be called 0, 1, or N times | Promise resolves exactly once |
| Timing                     | May fire sync or async         | Always async (microtask)        |

```javascript
// Callback hell
getUser(id, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      console.log(details);
    });
  });
});

// Promise chain (flat, single error handler)
getUser(id)
  .then(user => getOrders(user.id))
  .then(orders => getDetails(orders[0].id))
  .then(details => console.log(details))
  .catch(handleError);

// Async/await (even cleaner)
try {
  const user = await getUser(id);
  const orders = await getOrders(user.id);
  const details = await getDetails(orders[0].id);
  console.log(details);
} catch (err) {
  handleError(err);
}
```

The key insight is **trust**: once a Promise settles (fulfilled or rejected), it cannot change state. Callbacks offer no such guarantee -- they rely on the callee to invoke them correctly.

---

### Q16: Async/Await Internals

**Q:** How does async/await work under the hood? What does the JavaScript engine do when it encounters `await`?

**A:** `async/await` is syntactic sugar over Promises and generators. An `async` function always returns a Promise. When the engine encounters `await`:

1. The expression after `await` is evaluated (if not a Promise, it is wrapped in `Promise.resolve()`)
2. The function's execution is **suspended** (its state is saved -- local variables, position)
3. Control returns to the caller (the function yields like a generator)
4. When the awaited Promise settles, the function is resumed via the microtask queue
5. If the Promise fulfilled, the resolved value becomes the result of `await`
6. If the Promise rejected, the error is thrown at the `await` line

```javascript
async function example() {
  console.log("A");
  const x = await Promise.resolve(42);
  console.log("B", x);
  return x;
}

console.log("1");
const p = example();
console.log("2");

// Output: 1, A, 2, B 42
```

**What happens:** `1` prints (sync). `example()` starts: `A` prints (sync). `await` suspends the function and returns a pending Promise. `2` prints (sync). On the next microtask tick, the awaited Promise is resolved, so `B 42` prints.

The important takeaway: everything after `await` runs as a **microtask** (like a `.then()` callback), not synchronously. This is why `2` appears before `B`.

---

### Q17: Unhandled Rejections

**Q:** What are unhandled Promise rejections? How do you prevent them and what happens if you do not?

**A:** An **unhandled rejection** occurs when a Promise rejects and no rejection handler is attached (no `.catch()` or `try/catch` with `await`).

Since Node.js 15+, unhandled rejections **terminate the process** by default with a non-zero exit code. This is a deliberate design decision because unhandled rejections indicate a bug -- an error that nobody is handling.

**Common sources:**

```javascript
// 1. Missing .catch()
someAsyncFunction(); // fire-and-forget without catch

// 2. Missing await in try/catch
async function broken() {
  try {
    riskyOperation(); // no await! catch block won't catch the rejection
  } catch (err) { /* never reached for async error */ }
}

// 3. Event handler with async callback
emitter.on("data", async (data) => {
  await processData(data); // if this rejects, nobody catches it
});
```

**Prevention:**

```javascript
// Always catch fire-and-forget promises
logAnalytics(event).catch(err => console.error("Analytics:", err));

// Always await in try/catch
try {
  await riskyOperation(); // WITH await
} catch (err) { /* catches the rejection */ }

// Wrap async event handlers
emitter.on("data", async (data) => {
  try {
    await processData(data);
  } catch (err) {
    console.error("Processing failed:", err);
  }
});

// Global safety net (last resort, not a strategy)
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
  gracefulShutdown(1);
});
```

---

### Q18: Race Conditions

**Q:** How can race conditions occur in Node.js if it is single-threaded? Give an example and a solution.

**A:** While JavaScript execution is single-threaded (no two lines run simultaneously), race conditions still occur because of **interleaved asynchronous operations**. Between any two `await` points, other async operations can run and change shared state.

```javascript
// Race condition: two requests modify the same balance concurrently
async function withdraw(userId, amount) {
  const user = await db.query("SELECT balance FROM users WHERE id = $1", [userId]);

  // <-- Another request can read the same balance here!

  if (user.balance >= amount) {
    await db.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [amount, userId]);
    return { success: true };
  }
  return { success: false, error: "Insufficient funds" };
}

// Two simultaneous $80 withdrawals from a $100 balance:
// Request A: reads balance = 100, checks 100 >= 80, updates to 20
// Request B: reads balance = 100 (before A's update), checks 100 >= 80, updates to 20
// Result: $160 withdrawn from $100 account!
```

**Solutions:**

```javascript
// 1. Atomic database operations
async function withdraw(userId, amount) {
  const result = await db.query(
    "UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance",
    [amount, userId]
  );
  return result.rowCount > 0
    ? { success: true, balance: result.rows[0].balance }
    : { success: false, error: "Insufficient funds" };
}

// 2. Application-level locking (e.g., Redis)
async function withdraw(userId, amount) {
  const lock = await redis.set(`lock:user:${userId}`, "1", "NX", "EX", 5);
  if (!lock) throw new Error("Account locked, try again");

  try {
    // safe to read-modify-write now
    const user = await db.query("SELECT balance FROM users WHERE id = $1", [userId]);
    if (user.balance < amount) throw new Error("Insufficient funds");
    await db.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [amount, userId]);
  } finally {
    await redis.del(`lock:user:${userId}`);
  }
}

// 3. Optimistic concurrency (version column)
async function withdraw(userId, amount) {
  const user = await db.query("SELECT balance, version FROM users WHERE id = $1", [userId]);
  if (user.balance < amount) throw new Error("Insufficient funds");

  const result = await db.query(
    "UPDATE users SET balance = balance - $1, version = version + 1 WHERE id = $2 AND version = $3",
    [amount, userId, user.version]
  );

  if (result.rowCount === 0) {
    throw new Error("Concurrent modification -- retry");
  }
}
```

---

### Q19: Async Memory Leaks

**Q:** What causes memory leaks in asynchronous Node.js code and how do you detect/fix them?

**A:** Common async memory leak patterns:

**1. Accumulating event listeners:**
```javascript
// Bug: each call adds a new listener, never removed
function subscribe(emitter) {
  emitter.on("data", async (data) => {
    await process(data);
  });
}
// If subscribe() is called repeatedly (e.g., on reconnect), listeners pile up.

// Fix: remove listeners or use AbortController
function subscribe(emitter, signal) {
  const handler = async (data) => { await process(data); };
  emitter.on("data", handler);
  signal.addEventListener("abort", () => emitter.off("data", handler));
}
```

**2. Unbounded Promise accumulation:**
```javascript
// Bug: promises accumulate if producer is faster than consumer
const pending = [];
for (const item of largeArray) {
  pending.push(processItem(item)); // unlimited concurrent promises
}

// Fix: limit concurrency
async function mapWithLimit(items, fn, limit = 10) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = fn(item).then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}
```

**3. Closures holding large objects:**
```javascript
// Bug: closure keeps entire `largeData` alive
async function process() {
  const largeData = await fetchHugeDataset(); // 500MB
  return function summarize() {
    // only needs largeData.length, but closure keeps all 500MB
    return largeData.length;
  };
}

// Fix: extract needed data, release the rest
async function process() {
  const largeData = await fetchHugeDataset();
  const length = largeData.length; // extract what you need
  // largeData can be GC'd after this function returns
  return function summarize() {
    return length;
  };
}
```

**Detection:** Monitor `process.memoryUsage().heapUsed` over time. Consistent growth without plateauing indicates a leak. Use `--inspect` with Chrome DevTools heap snapshots (take two, compare allocations) to find the retaining objects.

---

## TypeScript

### Q20: Interface vs Type

**Q:** What is the difference between `interface` and `type` in TypeScript? When do you use each?

**A:**

| Feature                | `interface`                    | `type`                        |
|------------------------|--------------------------------|-------------------------------|
| Object shapes          | Yes                            | Yes                           |
| Extends/inherits       | `extends` keyword              | Intersection (`&`)            |
| Declaration merging    | Yes (open)                     | No (closed)                   |
| Union types            | No                             | Yes (`A \| B`)                |
| Mapped types           | No                             | Yes                           |
| Tuples                 | Awkward                        | Natural                       |
| Primitives             | No                             | Yes (`type ID = string`)      |
| `implements`           | Yes                            | Yes                           |
| Performance            | Slightly better (cached)       | Recomputed each use           |

```typescript
// Interface: best for object shapes, especially public APIs
interface User {
  id: string;
  name: string;
  email: string;
}

interface Admin extends User {
  permissions: string[];
}

// Declaration merging (unique to interfaces)
interface User {
  createdAt: Date; // merged with the User interface above
}

// Type: best for unions, intersections, mapped types
type Status = "active" | "inactive" | "pending";
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type Nullable<T> = T | null;
type ReadonlyUser = Readonly<User>;
```

**Rule of thumb:** Use `interface` for public API contracts and object shapes (especially in libraries, because consumers can augment them via declaration merging). Use `type` for unions, intersections, tuples, mapped types, and when you need to alias primitives or complex types.

---

### Q21: Generics

**Q:** Explain generics in TypeScript. Why are they useful and how would you use them in practice?

**A:** **Generics** allow you to write reusable components that work with any type while maintaining type safety. They are type parameters -- placeholders that get filled in when the function/class is used.

```typescript
// Without generics: lose type information
function first(arr: any[]): any {
  return arr[0];
}
const x = first([1, 2, 3]); // type: any -- useless

// With generics: preserves type
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
const x = first([1, 2, 3]);     // type: number
const y = first(["a", "b"]);    // type: string

// Constrained generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25 };
getProperty(user, "name"); // type: string
getProperty(user, "age");  // type: number
getProperty(user, "foo");  // Error: "foo" is not a key of user

// Generic interfaces
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(item: Omit<T, "id">): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> { /* ... */ }
  async findAll(): Promise<User[]> { /* ... */ }
  // ...
}

// Generic utility function
async function fetchAndValidate<T>(
  url: string,
  validator: (data: unknown) => data is T
): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();
  if (!validator(data)) throw new Error("Validation failed");
  return data;
}
```

Generics are essential for building reusable libraries, data structures, and utility functions without sacrificing type safety.

---

### Q22: Type Guards

**Q:** What are type guards in TypeScript? How do you narrow types?

**A:** **Type guards** are runtime checks that narrow a variable's type within a conditional block. TypeScript's control flow analysis uses these to refine types.

```typescript
// 1. typeof guard (primitives)
function process(value: string | number) {
  if (typeof value === "string") {
    // TypeScript knows value is string here
    return value.toUpperCase();
  }
  // TypeScript knows value is number here
  return value.toFixed(2);
}

// 2. instanceof guard (classes)
function handleError(err: Error | string) {
  if (err instanceof TypeError) {
    console.log(err.message); // TypeScript knows it's TypeError
  }
}

// 3. in operator (property check)
interface Dog { bark(): void; legs: number; }
interface Fish { swim(): void; fins: number; }

function move(animal: Dog | Fish) {
  if ("bark" in animal) {
    animal.bark(); // TypeScript knows it's Dog
  } else {
    animal.swim(); // TypeScript knows it's Fish
  }
}

// 4. Custom type guard (type predicate)
interface ApiError {
  code: number;
  message: string;
}

function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    typeof (err as ApiError).code === "number"
  );
}

// Usage
try {
  await fetchData();
} catch (err) {
  if (isApiError(err)) {
    console.log(err.code, err.message); // safely typed
  }
}

// 5. Discriminated unions
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
  }
}
```

The custom type predicate (`x is Type`) is the most powerful form because it lets you define arbitrary validation logic that TypeScript trusts for narrowing.

---

### Q23: Utility Types

**Q:** Describe the most commonly used TypeScript utility types and when you would use each.

**A:**

| Utility Type            | What It Does                                     | Example Use Case                      |
|-------------------------|--------------------------------------------------|---------------------------------------|
| `Partial<T>`           | All properties optional                          | Update functions (`Partial<User>`)    |
| `Required<T>`          | All properties required                          | Validation output                     |
| `Readonly<T>`          | All properties readonly                          | Immutable config, frozen objects      |
| `Pick<T, K>`           | Select subset of properties                      | API response subsets                  |
| `Omit<T, K>`           | Exclude specific properties                      | Create DTOs (omit `password`)         |
| `Record<K, V>`         | Object type with specific key and value types    | Dictionaries, lookup maps            |
| `Exclude<U, E>`        | Remove types from a union                        | `Exclude<Status, "deleted">`          |
| `Extract<U, E>`        | Keep only matching types from a union            | `Extract<Event, { type: "click" }>`   |
| `NonNullable<T>`       | Remove `null` and `undefined`                    | After null checks                     |
| `ReturnType<F>`        | Extract function's return type                   | Infer types from functions            |
| `Parameters<F>`        | Extract function's parameter types as tuple      | Wrapper functions                     |
| `Awaited<T>`           | Unwrap Promise type                              | `Awaited<Promise<User>>` = `User`     |

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Partial: for update operations
async function updateUser(id: string, data: Partial<User>) {
  // data can have any subset of User properties
}
updateUser("123", { name: "Bob" }); // valid

// Omit: hide sensitive fields
type PublicUser = Omit<User, "password">;

// Pick: API response with select fields
type UserSummary = Pick<User, "id" | "name">;

// Record: typed dictionary
type UserRoles = Record<string, "admin" | "user" | "guest">;
const roles: UserRoles = { alice: "admin", bob: "user" };

// ReturnType: infer from function
function createUser() {
  return { id: "1", name: "Alice", active: true };
}
type CreatedUser = ReturnType<typeof createUser>;
// { id: string; name: string; active: boolean }

// Combining utilities
type CreateUserInput = Omit<User, "id" | "createdAt">;
type UpdateUserInput = Partial<Omit<User, "id" | "createdAt">>;
```

---

## System Design

### Q24: Scaling Node.js

**Q:** How would you scale a Node.js application to handle 100,000 concurrent users?

**A:** I would approach this in layers:

**1. Single server optimization:**
- Use the **cluster module** to utilize all CPU cores (each core handles ~1-2K req/s)
- Tune `--max-old-space-size` for available RAM
- Use **Worker Threads** for any CPU-intensive operations (image processing, crypto)
- Enable **HTTP keep-alive** to reuse TCP connections
- Use **connection pooling** for databases (e.g., 20-50 connections per process)

**2. Caching layer:**
- **Redis** for distributed caching (session data, frequently accessed queries)
- HTTP cache headers for browser/CDN caching
- Application-level memoization for expensive computations

**3. Horizontal scaling:**
- Deploy multiple server instances behind an **nginx** or **ALB** load balancer
- Make the application **stateless** -- store sessions in Redis, not in process memory
- Use **sticky sessions** only if absolutely necessary (e.g., WebSocket)

**4. Database scaling:**
- **Read replicas** to distribute read load
- **Connection pooling** (PgBouncer for PostgreSQL)
- **Indexing** and query optimization
- Eventually: **sharding** for write scaling

**5. Async workloads:**
- Offload heavy work to **message queues** (BullMQ, RabbitMQ)
- Background workers process queued jobs independently
- This prevents long-running tasks from blocking request handling

**6. Edge/CDN:**
- Serve static assets via CDN
- Cache API responses at the edge where possible

At 100K concurrent users with ~10K QPS, a cluster of 4-8 Node.js servers behind a load balancer with Redis caching and read replicas would handle this comfortably.

---

### Q25: Microservices

**Q:** When would you choose microservices over a monolith? What are the tradeoffs?

**A:**

**Choose a monolith when:**
- Team is small (fewer than 10 developers)
- Product is new and domain boundaries are unclear
- You need to move fast without operational overhead
- The application is not large enough to justify distribution

**Choose microservices when:**
- Multiple teams need to deploy independently
- Different components have different scaling requirements
- You need technology diversity (different languages/databases per service)
- The domain is well-understood with clear service boundaries
- Organization is large enough to support the operational complexity

**Tradeoffs:**

| Aspect                | Monolith              | Microservices            |
|-----------------------|-----------------------|--------------------------|
| Deployment            | Simple (one unit)     | Complex (many services)  |
| Development speed     | Fast initially        | Slower initially, faster at scale |
| Debugging             | Easy (one process)    | Hard (distributed tracing needed) |
| Data consistency      | ACID transactions     | Eventual consistency, sagas |
| Operational cost      | Low                   | High (K8s, monitoring, etc.) |
| Team independence     | Low (merge conflicts) | High (independent deploy) |
| Network reliability   | N/A (in-process)      | Must handle network failures |

**My recommendation:** Start with a well-structured monolith (modular monolith). Extract services only when you have a clear reason -- a specific service needs independent scaling, a different technology, or a separate team.

---

### Q26: Caching Strategy

**Q:** You have an API that reads from a database and response times are slow. How would you design the caching layer?

**A:** I would implement a **multi-layer caching strategy:**

**Layer 1: HTTP caching** -- Set proper `Cache-Control` and `ETag` headers for responses that can be cached by browsers and CDNs. This eliminates requests entirely for cacheable content.

**Layer 2: CDN caching** -- For public, read-heavy endpoints. The CDN serves responses from edge nodes, reducing load on your servers.

**Layer 3: Application cache (Redis)** -- For user-specific or dynamic data. I would use the **cache-aside** pattern:

```javascript
async function getProduct(id) {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);

  const product = await db.query("SELECT * FROM products WHERE id = $1", [id]);
  await redis.setEx(`product:${id}`, 300, JSON.stringify(product));
  return product;
}
```

**Invalidation strategy:** On writes, I would **delete** the cache key (not update it) to avoid race conditions. The next read will repopulate the cache. For high-traffic keys, I would use **stale-while-revalidate** -- serve the stale value immediately while refreshing in the background.

**Cache problems to address:**
- **Stampede:** When a popular key expires, hundreds of requests hit the DB simultaneously. Solution: use a distributed lock so only one request refreshes the cache.
- **Penetration:** Queries for non-existent data always miss cache. Solution: cache `null` results with a short TTL.
- **Avalanche:** Many keys expire simultaneously. Solution: add random jitter to TTL values.

**Monitoring:** Track cache hit rate (target >90%), latency, and memory usage. A low hit rate means the cache is not effective and needs tuning.

---

### Q27: Database Choice

**Q:** How do you decide between SQL and NoSQL databases for a new project?

**A:** I consider several factors:

**Choose SQL (PostgreSQL/MySQL) when:**
- Data has clear relationships and requires JOINs
- You need ACID transactions (financial data, inventory)
- Complex queries with filtering, aggregation, and sorting
- Data schema is relatively stable
- Strong consistency is required
- Example: user management, e-commerce orders, financial systems

**Choose Document DB (MongoDB/DynamoDB) when:**
- Data schema varies or evolves frequently
- You need horizontal scaling with built-in sharding
- Data is naturally document-shaped (content management, user profiles with varying fields)
- Read/write patterns fit the document model (one query returns all needed data)
- Example: content management, product catalogs, IoT data

**Choose Key-Value/Cache (Redis) when:**
- Simple lookup by key with ultra-low latency
- Session storage, caching, rate limiting, pub/sub
- Ephemeral data that can be regenerated

**Choose Wide-Column (Cassandra/ScyllaDB) when:**
- Massive write throughput is needed
- Data is time-series or append-heavy
- Multi-datacenter replication is required
- Example: logging, IoT sensor data, messaging

**In practice:** Most applications use a **polyglot persistence** approach. For example: PostgreSQL for core business data (users, orders), Redis for caching and sessions, Elasticsearch for search, and Kafka or a message queue for event processing.

The question I always start with: **"What are the access patterns?"** The way you read and write data should drive the database choice, not the other way around.

---

## Behavioral Questions (STAR Framework)

Use the **STAR** method for behavioral questions: **Situation** (context), **Task** (your responsibility), **Action** (what you did), **Result** (measurable outcome).

### Example 1: Handling a Production Incident

**Q:** Tell me about a time you dealt with a critical production issue.

**A:**

**Situation:** Our Node.js API started returning 503 errors during peak traffic. Monitoring showed the event loop latency spiking to over 2 seconds, and response times went from 50ms to 5s+. This was affecting thousands of users.

**Task:** As the senior engineer on call, I needed to diagnose the root cause, restore service, and implement a permanent fix.

**Action:** I immediately checked our dashboards and saw memory usage climbing steadily -- classic memory leak pattern. I took a heap snapshot from a production pod using `--inspect` and analyzed it in Chrome DevTools. I found that a recently deployed feature was creating a new Redis subscriber per request without cleaning it up, accumulating thousands of event listeners. I rolled back the deployment to restore service, then created a fix that used a shared subscriber with proper lifecycle management and added `MaxListenersExceededWarning` monitoring.

**Result:** Service was restored within 15 minutes of the alert. The permanent fix was deployed the next day with added memory and listener count monitoring. I also added a pre-deploy checklist item for EventEmitter listener patterns and shared the incident report with the team to prevent similar issues.

---

### Example 2: Technical Disagreement

**Q:** Describe a time you disagreed with a colleague on a technical decision.

**A:**

**Situation:** Our team was designing a new notification system. A colleague proposed using microservices with Kafka from day one, citing future scalability needs. I believed a simpler approach would be more appropriate for our current scale (500 DAU).

**Task:** I needed to advocate for a simpler design without dismissing my colleague's valid concerns about future growth.

**Action:** I prepared a comparison document showing the operational cost of a Kafka-based microservice (infrastructure, monitoring, team expertise needed) versus a simple queue-based approach using BullMQ with Redis. I proposed a modular monolith with clean interfaces -- specifically, a `NotificationService` class behind an interface so we could swap the implementation later. I presented both approaches in a design review, explicitly acknowledging the merits of the Kafka approach and defining clear metrics that would trigger migration (e.g., >10K messages/minute).

**Result:** The team agreed on the simpler approach. We shipped the notification system in 2 weeks instead of the estimated 6 weeks. Eight months later, when we reached 5K DAU, the clean interface made it straightforward to extract the notification service when the time came. My colleague later said the phased approach was the right call for our stage.

---

### Example 3: Improving Team Processes

**Q:** Tell me about a time you improved your team's engineering practices.

**A:**

**Situation:** Our deployment process was manual and error-prone. Developers would SSH into production servers, pull the latest code, and restart the service. We had two incidents in one month caused by deploying untested code, and rollbacks took 20+ minutes.

**Task:** As the most senior engineer, I took responsibility for improving our deployment reliability and speed.

**Action:** I implemented a CI/CD pipeline using GitHub Actions with the following steps: automated linting and type checking, unit and integration tests, Docker image build and push, staged deployment (staging first, then production), automated health check verification, and one-command rollback via image tag revert. I also added pre-commit hooks for linting and established a PR review requirement. I documented the entire process and ran a team workshop to ensure everyone understood it.

**Result:** Deployment time dropped from 30 minutes (manual) to 8 minutes (automated). We went from 2 deployment-related incidents per month to zero over the following 6 months. Developer confidence in deploying increased -- we went from deploying once a week to multiple times per day. The team velocity (measured in story points) increased by about 30% over the following quarter.

---

## 6-Week Study Plan

### Week 1: JavaScript Fundamentals
- [ ] Review closures, scope, hoisting, `this`
- [ ] Prototypes and prototype chain
- [ ] ES6+ features (destructuring, spread, modules)
- [ ] Type coercion rules and gotchas
- [ ] Practice: 5 LeetCode Easy (arrays/strings)

### Week 2: Async JavaScript and Node.js Core
- [ ] Event loop phases and microtask queue
- [ ] Promises: creation, chaining, combinators
- [ ] async/await patterns and error handling
- [ ] Streams and backpressure
- [ ] Cluster module and Worker Threads
- [ ] Practice: 5 LeetCode Easy/Medium (linked lists, stacks)

### Week 3: TypeScript and Design Patterns
- [ ] TypeScript generics, type guards, utility types
- [ ] Interface vs type, discriminated unions
- [ ] OOP: SOLID principles
- [ ] Design patterns: Factory, Strategy, Observer, Singleton
- [ ] Dependency injection
- [ ] Practice: 5 LeetCode Medium (trees, graphs)

### Week 4: System Design Fundamentals
- [ ] 4-step framework and back-of-envelope calculations
- [ ] Database design: SQL vs NoSQL, indexing, sharding
- [ ] Caching strategies and invalidation
- [ ] Load balancing and horizontal scaling
- [ ] Practice: Design URL shortener, Design rate limiter
- [ ] Practice: 5 LeetCode Medium (BFS/DFS, dynamic programming)

### Week 5: Advanced System Design and Architecture
- [ ] Microservices patterns (saga, circuit breaker, API gateway)
- [ ] Event-driven architecture (event sourcing, CQRS)
- [ ] Message queues (Kafka, RabbitMQ, BullMQ)
- [ ] Reliability patterns (retry, bulkhead, health checks)
- [ ] Security (JWT, OAuth2, API keys)
- [ ] Practice: Design chat system, Design notification service
- [ ] Practice: 5 LeetCode Medium/Hard

### Week 6: Mock Interviews and Review
- [ ] 2 mock system design interviews (with a friend or service)
- [ ] 2 mock coding interviews (timed, 45 minutes each)
- [ ] Review all behavioral STAR stories (prepare 5-6)
- [ ] Review weak areas from weeks 1-5
- [ ] Review this Q&A document end-to-end
- [ ] Rest and prepare mentally the day before

### Daily Habits
- Solve 1-2 LeetCode problems (build consistency over volume)
- Review 1 topic from this guide for 30 minutes
- Explain a concept out loud (to a rubber duck, friend, or camera)

---

## Coding Tips for JS Interviews

### Before You Code

1. **Clarify the problem.** Repeat it back to the interviewer. Ask about edge cases: empty input, single element, negative numbers, duplicates, very large input.

2. **Work through examples.** Trace through 2-3 examples on paper (or verbally) before writing code. Use a simple case, an edge case, and a normal case.

3. **State your approach.** Explain your algorithm in plain English before coding. Mention the time and space complexity upfront.

### While Coding

4. **Write clean JavaScript.** Use `const`/`let` (never `var`). Use descriptive variable names. Use arrow functions for callbacks. Use modern syntax (`for...of`, destructuring, template literals).

5. **Use built-in methods wisely.**
```javascript
// Know these cold:
Array: map, filter, reduce, find, findIndex, some, every, includes,
       sort, slice, splice, flat, flatMap, from, Array.isArray
String: split, join, includes, startsWith, endsWith, trim, replace,
        repeat, padStart, slice, indexOf, charAt
Object: keys, values, entries, assign, freeze, fromEntries
Map/Set: for unique values, O(1) lookup, maintaining insertion order
```

6. **Handle edge cases explicitly** at the top of your function:
```javascript
function solve(arr) {
  if (!arr || arr.length === 0) return []; // guard clause
  if (arr.length === 1) return arr;        // trivial case
  // main logic...
}
```

7. **Think about complexity.** Always state Big-O after solving. If your solution is O(n^2), mention that you are aware and discuss if an O(n) approach exists.

### Common Patterns to Know

```javascript
// Two pointers (sorted arrays, palindromes)
let left = 0, right = arr.length - 1;
while (left < right) { /* ... */ }

// Sliding window (subarrays, substrings)
let start = 0;
for (let end = 0; end < arr.length; end++) { /* expand/shrink window */ }

// Hash map for O(1) lookup
const map = new Map();
for (const item of arr) {
  map.set(item, (map.get(item) || 0) + 1);
}

// Stack (matching brackets, monotonic stack)
const stack = [];
stack.push(item);
stack.pop();
stack[stack.length - 1]; // peek

// BFS with queue
const queue = [startNode];
while (queue.length > 0) {
  const node = queue.shift();
  // process node, add neighbors to queue
}

// DFS with recursion or stack
function dfs(node) {
  if (!node) return;
  // process node
  dfs(node.left);
  dfs(node.right);
}
```

### After Solving

8. **Test your solution.** Walk through your code with an example input. Check off-by-one errors, null checks, and boundary conditions.

9. **Optimize if asked.** Discuss trade-offs: "I can reduce time complexity from O(n^2) to O(n) by using a hash map, at the cost of O(n) extra space."

10. **Communicate throughout.** Silence is the biggest red flag. Even if you are stuck, explain what you are thinking and what approaches you are considering.

---

## Common Mistakes to Avoid

### Technical Interview Mistakes

| Mistake                                    | Better Approach                                |
|--------------------------------------------|------------------------------------------------|
| Jumping into code immediately              | Clarify requirements, discuss approach first   |
| Writing code silently                      | Narrate your thought process continuously      |
| Ignoring edge cases                        | Ask about them upfront, handle them explicitly |
| Using `var` in interview code              | Always use `const` or `let`                    |
| Not knowing time/space complexity          | State Big-O for every solution                 |
| Over-engineering the first solution        | Start with brute force, then optimize          |
| Not testing your code                      | Walk through with an example before declaring done |
| Saying "I don't know" and stopping         | Say "I'm not sure, but here's my reasoning..." |
| Memorizing solutions without understanding | Understand the pattern so you can adapt it     |

### System Design Mistakes

| Mistake                                    | Better Approach                                |
|--------------------------------------------|------------------------------------------------|
| Jumping to "use Kafka and microservices"   | Start simple, justify each added component     |
| Not asking clarifying questions            | Spend 5 minutes understanding requirements     |
| Ignoring scale estimates                   | Do back-of-envelope math to size the system    |
| Single point of failure in design          | Identify SPOFs and add redundancy              |
| Not discussing tradeoffs                   | Every decision has pros/cons -- state them     |
| Ignoring failure scenarios                 | "What happens when X goes down?" -- address it |
| Over-designing for future scale            | Design for 10x, plan for 100x                 |

### Behavioral Interview Mistakes

| Mistake                                    | Better Approach                                |
|--------------------------------------------|------------------------------------------------|
| Giving vague, abstract answers             | Use STAR with specific, measurable details     |
| Taking credit for team work                | Use "I" for your actions, "we" for team outcomes |
| Blaming others for failures                | Own your part and focus on what you learned     |
| Not preparing stories in advance           | Have 5-6 STAR stories ready covering: conflict, failure, leadership, technical challenge, impact |
| Answers that are too long (>3 minutes)     | Keep STAR answers to 2-3 minutes               |
| No quantifiable results                    | Include numbers: "reduced latency by 40%", "saved 10 hours/week" |
