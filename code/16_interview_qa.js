/**
 * ============================================================================
 * FILE 16: 30+ Real Interview Questions & Answers for Senior Node.js Roles
 * ============================================================================
 *
 * A comprehensive, runnable collection of interview questions organized by
 * category, each presented as a function that prints the question and a
 * thorough answer. Includes behavioral STAR-format answers, a 6-week study
 * plan, coding tips, and common mistakes to avoid.
 *
 * Run: node 16_interview_qa.js
 *
 * Table of Contents:
 *   PART A  - Core JavaScript (8 questions)
 *   PART B  - Node.js Specifics (6 questions)
 *   PART C  - Async / Concurrency (5 questions)
 *   PART D  - TypeScript (4 questions)
 *   PART E  - System Design (4 questions)
 *   PART F  - Behavioral (STAR framework, 3 example answers)
 *   PART G  - 6-Week Study Plan
 *   PART H  - Coding Interview Tips for JavaScript
 *   PART I  - Common Mistakes to Avoid
 *   DEMO    - Run all sections
 * ============================================================================
 */

'use strict';

// ============================================================================
// UTILITIES
// ============================================================================

function section(title) {
  console.log(`\n${'='.repeat(76)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(76)}`);
}

function qa(number, question, answer) {
  console.log(`\n  Q${number}: ${question}`);
  console.log(`  ${'-'.repeat(70)}`);
  const lines = answer.trim().split('\n');
  for (const line of lines) {
    console.log(`  A: ${line}`);
  }
  console.log();
}

function subsection(title) {
  console.log(`\n  --- ${title} ---`);
}

// ============================================================================
// PART A: CORE JAVASCRIPT (8 Questions)
// ============================================================================

function coreJavaScriptQuestions() {
  section('PART A: CORE JAVASCRIPT (8 Questions)');

  // ---- Q1: Event Loop ----
  qa(1,
    'Explain the JavaScript event loop. How does it work in the browser vs Node.js?',
    `The event loop is the mechanism that allows JavaScript to perform non-blocking
operations despite being single-threaded. It continuously checks the call stack
and, when empty, dequeues tasks from the task queues.

Browser event loop:
  1. Execute the current macro-task (script, setTimeout callback, etc.)
  2. Drain the entire micro-task queue (Promises, queueMicrotask, MutationObserver)
  3. Optionally run requestAnimationFrame callbacks and render/paint
  4. Pick the next macro-task and repeat

Node.js event loop (libuv):
  Has explicit phases executed in order each "tick":
    - timers          : setTimeout / setInterval callbacks
    - pending I/O     : deferred I/O callbacks from previous cycle
    - idle / prepare  : internal use
    - poll            : retrieve new I/O events, execute I/O callbacks
    - check           : setImmediate callbacks
    - close callbacks : e.g., socket.on('close', ...)

  Between every phase, Node drains the micro-task queue
  (process.nextTick first, then Promise callbacks).

Key difference: Node.js has setImmediate (fires in the "check" phase) and
process.nextTick (fires before any other micro-task). Browsers do not have
these but have requestAnimationFrame tied to the rendering pipeline.`
  );

  // Demonstrate micro-task vs macro-task ordering
  subsection('Demo: Micro-task vs Macro-task ordering');
  console.log('  Scheduling: setTimeout, Promise.resolve, process.nextTick, setImmediate');
  console.log('  Expected order: nextTick -> Promise -> setTimeout -> setImmediate (approx)');
  console.log('  (Actual order logged below)\n');

  const order = [];

  setTimeout(() => order.push('setTimeout'), 0);
  Promise.resolve().then(() => order.push('Promise.then'));
  process.nextTick(() => order.push('process.nextTick'));
  setImmediate(() => order.push('setImmediate'));

  // We need to let the event loop cycle to collect results, so we print later
  setTimeout(() => {
    console.log(`  Actual execution order: ${order.join(' -> ')}`);
  }, 50);

  // ---- Q2: Closures ----
  qa(2,
    'What are closures? Give a practical use case and a common pitfall.',
    `A closure is formed when a function "remembers" the variables from its lexical
scope even after the outer function has returned. Every function in JavaScript
forms a closure over the scope in which it was defined.

Practical use case - private state / module pattern:

  function createCounter(initial) {
    let count = initial;               // enclosed variable
    return {
      increment() { return ++count; },
      decrement() { return --count; },
      getCount()  { return count; }
    };
  }
  const c = createCounter(0);
  c.increment(); // 1
  c.increment(); // 2
  c.getCount();  // 2
  // "count" is not accessible directly - true encapsulation

Common pitfall - the classic loop problem (var):

  for (var i = 0; i < 3; i++) {
    setTimeout(() => console.log(i), 100);
  }
  // Prints: 3, 3, 3 (all share the same "i")

Fix: use "let" (block-scoped) or an IIFE to create a new scope per iteration.`
  );

  // Demonstrate closure
  subsection('Demo: Closure-based counter');
  function createCounter(initial) {
    let count = initial;
    return {
      increment() { return ++count; },
      decrement() { return --count; },
      getCount()  { return count; }
    };
  }
  const counter = createCounter(10);
  console.log(`  counter.increment() => ${counter.increment()}`); // 11
  console.log(`  counter.increment() => ${counter.increment()}`); // 12
  console.log(`  counter.decrement() => ${counter.decrement()}`); // 11
  console.log(`  counter.getCount()  => ${counter.getCount()}`);  // 11

  // ---- Q3: this keyword ----
  qa(3,
    'How does the "this" keyword work in JavaScript? List the binding rules.',
    `"this" is determined at call time (not definition time) and follows these
rules in order of precedence:

1. new binding        : "new Foo()" -> this = newly created object
2. explicit binding   : call / apply / bind -> this = specified object
3. implicit binding   : obj.method() -> this = obj
4. default binding    : standalone call -> this = globalThis (or undefined in strict mode)

Arrow functions are the exception: they do NOT have their own "this". They
lexically capture "this" from the enclosing scope at definition time.

  const obj = {
    name: 'Alice',
    greet() { return this.name; },             // implicit binding
    greetArrow: () => { return this.name; }    // lexical - outer "this"
  };
  obj.greet();       // 'Alice'
  obj.greetArrow();  // undefined (or global name)

  const greet = obj.greet;
  greet();           // undefined (lost implicit binding, default applies)
  greet.call(obj);   // 'Alice' (explicit binding restores it)`
  );

  // Demonstrate this binding
  subsection('Demo: "this" binding rules');
  const person = {
    name: 'Alice',
    greet() { return this.name; },
    greetArrow: () => 'arrow-this-is-module-scope'
  };
  console.log(`  person.greet()          => ${person.greet()}`);
  console.log(`  person.greetArrow()     => ${person.greetArrow()}`);
  const unboundGreet = person.greet;
  console.log(`  unboundGreet.call(person) => ${unboundGreet.call(person)}`);

  // ---- Q4: Prototypes ----
  qa(4,
    'Explain prototypal inheritance. How does the prototype chain work?',
    `Every JavaScript object has an internal [[Prototype]] link (accessible via
Object.getPrototypeOf() or the __proto__ property). When you access a property
on an object, the engine:

  1. Checks the object itself
  2. If not found, follows [[Prototype]] to the parent
  3. Continues up the chain until it reaches Object.prototype
  4. If still not found, returns undefined

Constructor functions set up the chain automatically:

  function Animal(name) { this.name = name; }
  Animal.prototype.speak = function() { return this.name + ' speaks'; };

  const dog = new Animal('Rex');
  dog.speak(); // 'Rex speaks'
  // dog -> Animal.prototype -> Object.prototype -> null

ES6 classes are syntactic sugar over this exact mechanism. They do NOT
introduce a different inheritance model.

Key methods:
  Object.create(proto)           - create object with given prototype
  Object.getPrototypeOf(obj)     - get the prototype
  obj.hasOwnProperty(key)        - check own (not inherited) property
  obj instanceof Constructor     - walk the chain looking for Constructor.prototype`
  );

  // Demonstrate prototype chain
  subsection('Demo: Prototype chain');
  function Animal(name) { this.name = name; }
  Animal.prototype.speak = function () { return `${this.name} speaks`; };
  const dog = new Animal('Rex');
  console.log(`  dog.speak()                    => ${dog.speak()}`);
  console.log(`  dog.hasOwnProperty('name')     => ${dog.hasOwnProperty('name')}`);
  console.log(`  dog.hasOwnProperty('speak')    => ${dog.hasOwnProperty('speak')}`);
  console.log(`  dog instanceof Animal          => ${dog instanceof Animal}`);
  console.log(`  Object.getPrototypeOf(dog) === Animal.prototype => ${Object.getPrototypeOf(dog) === Animal.prototype}`);

  // ---- Q5: Hoisting ----
  qa(5,
    'What is hoisting? How do var, let, const, and function declarations differ?',
    `Hoisting is JavaScript's behavior of moving declarations to the top of their
scope during the compilation phase. However, only the declaration is hoisted,
not the initialization.

var:
  - Declaration hoisted to function/global scope, initialized to undefined
  - Can be used before declaration (value is undefined)

let / const:
  - Declaration hoisted to block scope, but NOT initialized
  - Accessing before declaration throws ReferenceError (Temporal Dead Zone)
  - const must be initialized at declaration and cannot be reassigned

function declarations:
  - Entire function (name + body) is hoisted
  - Can be called before the declaration appears in code

function expressions / arrow functions:
  - Follow the rules of their variable keyword (var/let/const)
  - Only the variable is hoisted, not the function body

  console.log(a);        // undefined (var hoisted)
  console.log(b);        // ReferenceError (TDZ)
  greet();               // works (function declaration hoisted)
  greetExpr();           // TypeError: not a function (var -> undefined)

  var a = 1;
  let b = 2;
  function greet() { return 'hi'; }
  var greetExpr = function() { return 'hi'; };`
  );

  // ---- Q6: == vs === ----
  qa(6,
    'What is the difference between == and ===? When would you use each?',
    `=== (strict equality): compares value AND type. No type coercion.
== (abstract equality):  compares values AFTER type coercion via the
Abstract Equality Comparison Algorithm (ECMA-262 section 7.2.15).

Coercion rules for ==:
  null == undefined  -> true  (special case)
  null == 0          -> false (null only equals undefined)
  '' == 0            -> true  (string coerced to number)
  '1' == 1           -> true
  true == 1          -> true  (boolean coerced to number first)
  [] == false        -> true  ([].toString()='' -> 0 == 0)
  {} == '[object Object]' -> true

Best practice:
  ALWAYS use === by default. The only acceptable use of == is checking
  for null/undefined simultaneously:  if (value == null) { ... }
  This is equivalent to: if (value === null || value === undefined)
  Some style guides (e.g., jQuery, lodash) endorse this pattern.`
  );

  // Demonstrate coercion quirks
  subsection('Demo: == vs === coercion examples');
  const comparisons = [
    ['null == undefined', null == undefined],     // true
    ['null === undefined', null === undefined],   // false
    ['"" == 0', '' == 0],                         // true
    ['"" === 0', '' === 0],                       // false
    ['[] == false', [] == false],                 // true
    ['[] === false', [] === false],               // false
    ['true == 1', true == 1],                     // true
    ['true === 1', true === 1],                   // false
  ];
  for (const [label, result] of comparisons) {
    console.log(`  ${label.padEnd(25)} => ${result}`);
  }

  // ---- Q7: var / let / const ----
  qa(7,
    'Compare var, let, and const. When should you use each?',
    `Feature            var            let            const
------------------------------------------------------------
Scope              function       block          block
Hoisting           yes (undefined) yes (TDZ)     yes (TDZ)
Re-declaration     allowed        not allowed    not allowed
Re-assignment      allowed        allowed        not allowed
Global property    yes (window)   no             no

Guidelines:
  - Default to "const" for everything. It signals immutability of the binding
    (not the value - objects/arrays can still be mutated).
  - Use "let" when you genuinely need to reassign (loop counters, accumulators).
  - Avoid "var" entirely in modern code. It leaks out of blocks and creates
    confusing behavior with closures in loops.

Note: "const" does NOT make objects immutable. For that, use Object.freeze()
(shallow) or a deep-freeze utility. For truly immutable data, consider
libraries like Immutable.js or Immer.`
  );

  // ---- Q8: Type Coercion ----
  qa(8,
    'Explain JavaScript type coercion. What are the rules for +, -, and comparison operators?',
    `Type coercion is the automatic conversion of values from one type to another.

The + operator:
  - If EITHER operand is a string, the other is converted to string (concatenation)
  - Otherwise, both are converted to numbers (addition)
  '5' + 3      -> '53'   (string wins)
  5 + '3'      -> '53'   (string wins)
  5 + 3        -> 8      (both numbers)
  true + 1     -> 2      (true becomes 1)
  [] + []      -> ''     (both become empty strings)
  {} + []      -> 0      (block + unary, but '[object Object]' in expression)

The -, *, / operators:
  - ALWAYS convert both operands to numbers
  '5' - 3      -> 2
  '5' * '2'    -> 10
  'abc' - 1    -> NaN

Comparison operators (< > <= >=):
  - If both are strings, lexicographic comparison
  - Otherwise, convert to numbers
  '10' > '9'   -> false  (lexicographic: '1' < '9')
  10 > '9'     -> true   (numeric comparison)

Truthy / Falsy values:
  Falsy: false, 0, -0, 0n, '', null, undefined, NaN
  Everything else is truthy (including [], {}, '0', 'false')`
  );

  // Demonstrate coercion
  subsection('Demo: Type coercion examples');
  const coercions = [
    ["'5' + 3", '5' + 3],
    ["5 + '3'", 5 + '3'],
    ["'5' - 3", '5' - 3],
    ["true + true", true + true],
    ["[] + []", [] + []],
    ["'10' > '9'", '10' > '9'],
    ["10 > '9'", 10 > '9'],
    ["Boolean('')", Boolean('')],
    ["Boolean('0')", Boolean('0')],
    ["Boolean([])", Boolean([])],
  ];
  for (const [label, result] of coercions) {
    console.log(`  ${String(label).padEnd(25)} => ${JSON.stringify(result)}`);
  }
}

// ============================================================================
// PART B: NODE.JS SPECIFICS (6 Questions)
// ============================================================================

function nodeJsQuestions() {
  section('PART B: NODE.JS SPECIFICS (6 Questions)');

  // ---- Q9: Event Loop Phases in Node.js ----
  qa(9,
    'Describe the phases of the Node.js event loop in detail. What runs in each phase?',
    `The Node.js event loop (powered by libuv) has 6 phases, executed in order:

Phase 1 - TIMERS:
  Executes callbacks from setTimeout() and setInterval() whose threshold
  has elapsed. Note: timers are not guaranteed to fire at exact time.

Phase 2 - PENDING CALLBACKS (I/O callbacks):
  Executes deferred I/O callbacks from the previous cycle, such as TCP
  error callbacks (ECONNREFUSED).

Phase 3 - IDLE / PREPARE:
  Internal use only. Not accessible to user code.

Phase 4 - POLL:
  The most important phase. It:
    a) Calculates how long to block and poll for I/O
    b) Processes events in the poll queue (fs, net, etc.)
  If the poll queue is empty:
    - If setImmediate() is scheduled, move to check phase
    - Otherwise, wait for callbacks to be added, then execute them

Phase 5 - CHECK:
  Executes setImmediate() callbacks. This runs AFTER the poll phase,
  which is why setImmediate() fires before setTimeout(0) when called
  from within an I/O callback.

Phase 6 - CLOSE CALLBACKS:
  Handles close events (e.g., socket.on('close', cb)).

Between EVERY phase:
  - process.nextTick() callbacks are drained (nextTickQueue)
  - Then Promise microtasks are drained (microTaskQueue)
  - nextTick has higher priority than Promise callbacks`
  );

  // ---- Q10: Streams ----
  qa(10,
    'Explain Node.js streams. What are the types, and when would you use each?',
    `Streams are collections of data that might not be available all at once and
do not need to fit in memory. They implement the EventEmitter interface.

Four types:
  1. Readable  : source of data (fs.createReadStream, http.IncomingMessage)
  2. Writable  : destination (fs.createWriteStream, http.ServerResponse)
  3. Duplex    : both readable + writable (net.Socket, TCP socket)
  4. Transform : duplex that modifies data passing through (zlib.createGzip)

Key concepts:
  - Backpressure: when the writable cannot consume as fast as the readable
    produces. stream.pipe() handles this automatically by pausing the readable.
  - Flowing mode vs Paused mode: readable streams start paused. Attaching
    a 'data' listener or calling .resume() switches to flowing mode.
  - Highwatermark: internal buffer size threshold (default 16KB for streams,
    16 objects for objectMode streams).

When to use:
  - Processing large files (CSV, logs) without loading into memory
  - Real-time data (WebSocket relay, video transcoding)
  - HTTP request/response bodies
  - Pipeline processing with pipeline() or stream.pipeline()

Best practice: prefer stream.pipeline() over .pipe() because pipeline()
properly handles errors and cleanup across the chain.`
  );

  // Demonstrate streams
  subsection('Demo: Transform stream (uppercase)');
  const { Transform } = require('stream');

  const upperCaseTransform = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk.toString().toUpperCase());
      callback();
    }
  });

  const { Readable, Writable } = require('stream');
  const input = Readable.from(['hello ', 'streams ', 'world']);
  const chunks = [];
  const output = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    }
  });

  const { pipeline } = require('stream');
  pipeline(input, upperCaseTransform, output, (err) => {
    if (err) console.error('  Pipeline error:', err);
    else console.log(`  Transformed output: "${chunks.join('')}"`);
  });

  // ---- Q11: Cluster vs Worker Threads ----
  qa(11,
    'Compare cluster module vs worker_threads. When do you use each?',
    `cluster module:
  - Forks the entire Node.js process (child_process.fork under the hood)
  - Each worker is a separate OS process with its own V8 instance and memory
  - Workers share the server port via the master process
  - Communication via IPC (Inter-Process Communication) - serialized messages
  - Use case: horizontal scaling of HTTP servers across CPU cores
  - Overhead: high memory (each process duplicates the V8 heap)

  const cluster = require('cluster');
  if (cluster.isPrimary) {
    for (let i = 0; i < os.cpus().length; i++) cluster.fork();
  } else {
    http.createServer(handler).listen(3000);
  }

worker_threads:
  - Spawns threads within the SAME process
  - Shared memory possible via SharedArrayBuffer and Atomics
  - Each worker has its own V8 isolate but shares the process memory space
  - Communication via message passing or shared memory
  - Use case: CPU-intensive tasks (image processing, crypto, parsing)
  - Overhead: lower than cluster (shared process resources)

  const { Worker } = require('worker_threads');
  const worker = new Worker('./heavy-computation.js');
  worker.on('message', (result) => console.log(result));

Decision matrix:
  Need to scale HTTP server across cores?      -> cluster
  Need to offload CPU-heavy work?              -> worker_threads
  Need shared memory between threads?          -> worker_threads
  Need process isolation for fault tolerance?   -> cluster`
  );

  // ---- Q12: libuv ----
  qa(12,
    'What is libuv and what role does it play in Node.js?',
    `libuv is a cross-platform C library that provides Node.js with:

1. Event Loop implementation
   - The core event loop described in Q9 is implemented by libuv
   - Handles timer scheduling, I/O polling, and phase management

2. Asynchronous I/O
   - File system operations (uses a thread pool, default 4 threads)
   - DNS resolution (getaddrinfo uses the thread pool)
   - Network I/O (uses OS-level async: epoll on Linux, kqueue on macOS,
     IOCP on Windows) - does NOT use the thread pool

3. Thread Pool (UV_THREADPOOL_SIZE, default 4, max 1024)
   - Used for: fs operations, dns.lookup, crypto (pbkdf2, randomBytes),
     zlib compression
   - NOT used for: network I/O, dns.resolve (uses c-ares), timers
   - Can be tuned: UV_THREADPOOL_SIZE=8 node app.js

4. Child Process management
   - Process spawning, pipes, signals

5. Cross-platform abstractions
   - Consistent API across Linux, macOS, Windows
   - Handles OS differences in async I/O mechanisms

Why it matters for interviews:
  Understanding libuv explains why some "async" operations (like fs) can
  still block if the thread pool is saturated. If you have 4 threads and
  5 concurrent fs.readFile calls, the 5th waits for a thread.`
  );

  // ---- Q13: CommonJS vs ESM ----
  qa(13,
    'Compare CommonJS (require) and ES Modules (import). What are the key differences?',
    `Feature              CommonJS (CJS)           ES Modules (ESM)
---------------------------------------------------------------------------
Syntax               require() / module.exports  import / export
Loading              synchronous                 asynchronous
Evaluation           eager (entire file)         supports tree-shaking
Timing               runtime (dynamic)           parse time (static analysis)
Top-level await      not supported               supported (Node 14.8+)
File extension       .js (default) or .cjs       .mjs or .js with type:module
"this" at top level  module.exports              undefined
Circular deps        partial exports available   live bindings (always current)
Browser support      needs bundler               native (modern browsers)
Caching              require.cache               module-level singleton

Key distinctions:

1. CJS require() is synchronous - it blocks until the module is loaded.
   ESM import is asynchronous and allows parallel loading.

2. ESM exports are "live bindings" - if the exporting module changes a
   value, importers see the new value. CJS exports are copied values.

3. ESM enables static analysis (tree-shaking) because imports/exports
   must be at the top level and cannot be conditional.

4. In Node.js, CJS can require() ESM only via dynamic import().
   ESM can import CJS modules directly.

Migration path:
  - Add "type": "module" to package.json for ESM
  - Or use .mjs / .cjs extensions to be explicit
  - Use import() for dynamic/conditional loading in ESM`
  );

  // ---- Q14: Error Handling Best Practices ----
  qa(14,
    'What are error handling best practices in Node.js?',
    `1. OPERATIONAL vs PROGRAMMER errors:
   - Operational: expected runtime problems (network timeout, file not found)
     -> Handle gracefully, retry, or return error to user
   - Programmer: bugs (TypeError, null reference)
     -> Fix the code; do NOT try to "handle" bugs

2. Async error handling patterns:
   - Callbacks: always check err first (error-first callback convention)
   - Promises: always attach .catch() or use try/catch with async/await
   - EventEmitters: always attach 'error' listener (unhandled = crash)

3. Global safety nets (use for logging, NOT for recovery):
   process.on('uncaughtException', (err) => {
     logger.fatal(err);
     process.exit(1);  // MUST exit - state is unreliable
   });
   process.on('unhandledRejection', (reason) => {
     logger.error(reason);
     // Node.js 15+ exits by default
   });

4. Express.js error handling:
   - Use error-handling middleware: (err, req, res, next) => {}
   - Wrap async route handlers to catch rejected promises
   - Use libraries like express-async-errors for automatic wrapping

5. Custom error classes:
   class AppError extends Error {
     constructor(message, statusCode, isOperational = true) {
       super(message);
       this.statusCode = statusCode;
       this.isOperational = isOperational;
       Error.captureStackTrace(this, this.constructor);
     }
   }

6. Never swallow errors silently:
   // BAD:  try { ... } catch(e) { }
   // GOOD: try { ... } catch(e) { logger.error(e); throw e; }

7. Use structured logging (JSON) for error tracking:
   logger.error({ err, requestId, userId }, 'Payment failed');`
  );
}

// ============================================================================
// PART C: ASYNC / CONCURRENCY (5 Questions)
// ============================================================================

function asyncConcurrencyQuestions() {
  section('PART C: ASYNC / CONCURRENCY (5 Questions)');

  // ---- Q15: Promise vs Callback ----
  qa(15,
    'Compare Promises vs Callbacks. Why were Promises introduced?',
    `Callbacks:
  - The original async pattern in Node.js
  - Error-first convention: callback(err, result)
  - Problems:
    a) Callback Hell / Pyramid of Doom (deep nesting)
    b) Inversion of Control (you hand your continuation to someone else)
    c) Error handling is manual and easy to forget
    d) Composing multiple async operations is cumbersome

Promises:
  - Represent a future value (pending -> fulfilled / rejected)
  - Chainable via .then() - flat structure instead of nesting
  - Centralized error handling with .catch()
  - Composable: Promise.all, Promise.race, Promise.allSettled, Promise.any
  - Guarantee: .then() callback is always called asynchronously (micro-task)
  - Immutable: once resolved/rejected, cannot change state

  // Callback pyramid
  getUser(id, (err, user) => {
    getOrders(user.id, (err, orders) => {
      getItems(orders[0].id, (err, items) => { ... });
    });
  });

  // Promise chain
  getUser(id)
    .then(user => getOrders(user.id))
    .then(orders => getItems(orders[0].id))
    .catch(err => handleError(err));

  // async/await (syntactic sugar over Promises)
  const user = await getUser(id);
  const orders = await getOrders(user.id);
  const items = await getItems(orders[0].id);`
  );

  // Demonstrate both patterns
  subsection('Demo: Callback vs Promise vs async/await');
  function fetchDataCallback(id, cb) {
    setTimeout(() => cb(null, { id, name: `item_${id}` }), 10);
  }
  function fetchDataPromise(id) {
    return new Promise(resolve =>
      setTimeout(() => resolve({ id, name: `item_${id}` }), 10)
    );
  }
  // Callback style
  fetchDataCallback(1, (err, data) => {
    console.log(`  Callback result: ${JSON.stringify(data)}`);
  });
  // Promise style
  fetchDataPromise(2).then(data => {
    console.log(`  Promise result:  ${JSON.stringify(data)}`);
  });
  // async/await style
  (async () => {
    const data = await fetchDataPromise(3);
    console.log(`  Await result:    ${JSON.stringify(data)}`);
  })();

  // ---- Q16: async/await internals ----
  qa(16,
    'How does async/await work under the hood?',
    `async/await is syntactic sugar over Promises and generators.

When you mark a function as "async":
  1. It always returns a Promise (even if you return a plain value)
  2. If the function throws, the returned Promise is rejected

When you use "await":
  1. The expression after await is wrapped in Promise.resolve()
  2. The function execution is SUSPENDED at that point
  3. The rest of the function is registered as a .then() callback
  4. Control returns to the caller (the event loop continues)
  5. When the Promise resolves, execution resumes from where it paused

Roughly equivalent to:

  async function foo() {       function foo() {
    const x = await bar();       return bar().then(x => {
    return x + 1;                  return x + 1;
  }                              });
                               }

Key performance notes:
  - Each "await" creates a micro-task (Promise resolution)
  - Unnecessary "await" in sequence can hurt throughput:
    // Slow (sequential):
    const a = await fetch('/a');
    const b = await fetch('/b');

    // Fast (parallel):
    const [a, b] = await Promise.all([fetch('/a'), fetch('/b')]);

  - "await" in loops is usually a code smell - consider Promise.all
  - An async function without await is equivalent to wrapping in Promise.resolve`
  );

  // ---- Q17: Unhandled Rejections ----
  qa(17,
    'What are unhandled promise rejections? How should you handle them in production?',
    `An unhandled rejection occurs when a Promise is rejected but no .catch()
handler or try/catch (in async/await) is attached to handle the error.

Historical behavior:
  - Node.js < 15: warning logged, process continues (dangerous!)
  - Node.js >= 15: process exits with non-zero code by default
  - Controlled via --unhandled-rejections flag:
    throw (default in 15+), warn, strict, none

Production strategy:

1. Global safety net:
   process.on('unhandledRejection', (reason, promise) => {
     logger.error({ reason, promise }, 'Unhandled rejection');
     // Optionally: graceful shutdown
     // In production, you likely want to exit and let PM2/k8s restart
   });

2. Always handle rejections:
   // Every .then() should have a .catch()
   // Every await should be in try/catch
   // Express: use wrapper to catch async route errors

3. Linting rules:
   - eslint: no-floating-promises (typescript-eslint)
   - Catches Promises that are not awaited or .catch()-ed

4. Testing:
   - Test error paths, not just happy paths
   - Verify that rejections are properly propagated

Common causes of unhandled rejections:
  - Forgetting .catch() on a Promise chain
  - Forgetting try/catch around await
  - Fire-and-forget async calls without error handling
  - Event handler that throws inside a Promise`
  );

  // Demonstrate unhandled rejection handling
  subsection('Demo: Catching unhandled rejection');
  const rejectionHandler = (reason) => {
    console.log(`  Caught unhandled rejection: ${reason}`);
  };
  process.on('unhandledRejection', rejectionHandler);
  Promise.reject(new Error('demo rejection'));
  setTimeout(() => {
    process.removeListener('unhandledRejection', rejectionHandler);
  }, 100);

  // ---- Q18: Race Conditions ----
  qa(18,
    'Can race conditions occur in Node.js? Give an example and how to prevent them.',
    `Yes! Even though Node.js is single-threaded, race conditions can occur
because of asynchronous interleaving. The event loop can switch between
operations between any two "await" points.

Example - check-then-act race condition:

  // Two requests arrive nearly simultaneously
  async function transferMoney(fromId, toId, amount) {
    const account = await db.getAccount(fromId);  // <- yields here
    if (account.balance >= amount) {               // check
      await db.updateBalance(fromId, -amount);     // act (another request
      await db.updateBalance(toId, +amount);       // may have drained balance)
    }
  }
  // If two transfers execute concurrently, both might pass the check
  // before either deducts, causing double-spending.

Prevention strategies:
  1. Database transactions with row-level locks:
     BEGIN; SELECT ... FOR UPDATE; UPDATE ...; COMMIT;

  2. Optimistic concurrency control:
     UPDATE accounts SET balance = balance - 100
     WHERE id = 1 AND balance >= 100;
     -- Check affected rows; if 0, retry

  3. Distributed locks (Redis):
     const lock = await redlock.acquire(['lock:account:1'], 5000);
     try { ... } finally { await lock.release(); }

  4. Queue-based serialization:
     Process all operations for a given account through a single queue
     worker to guarantee serial execution.

  5. Atomic operations:
     Use database-level atomic increment/decrement where possible.`
  );

  // Demonstrate race condition
  subsection('Demo: Race condition simulation');
  let sharedBalance = 100;
  async function withdraw(amount, label) {
    const current = sharedBalance; // read
    await new Promise(r => setTimeout(r, 10)); // simulate async gap
    if (current >= amount) {
      sharedBalance = current - amount; // write (stale read!)
      console.log(`  ${label}: Withdrew ${amount}. Balance: ${sharedBalance}`);
    } else {
      console.log(`  ${label}: Insufficient funds. Balance: ${sharedBalance}`);
    }
  }

  // Both read balance=100 before either writes
  withdraw(80, 'TxA');
  withdraw(80, 'TxB');
  setTimeout(() => {
    console.log(`  Final balance: ${sharedBalance} (should be -60 or error, got ${sharedBalance})`);
    console.log('  ^ This demonstrates a race condition: both transactions saw balance=100');
  }, 50);

  // ---- Q19: Memory Leaks ----
  qa(19,
    'What are common causes of memory leaks in Node.js and how do you detect them?',
    `Common causes:

1. Global variables / caches without eviction:
   const cache = {};  // grows forever
   Fix: use LRU cache (lru-cache package) with maxSize

2. Event listeners not removed:
   emitter.on('data', handler); // called repeatedly without .off()
   Fix: removeListener / removeAllListeners when done; use "once"

3. Closures retaining large objects:
   function process(bigData) {
     return () => { /* bigData is retained even if unused */ };
   }
   Fix: null out references; restructure to avoid capturing large objects

4. Unreferenced timers/intervals:
   setInterval(() => { ... }, 1000); // never cleared
   Fix: clearInterval() when no longer needed

5. Streams not properly consumed or destroyed:
   const stream = fs.createReadStream(file); // never read or piped
   Fix: always consume or call stream.destroy()

6. Circular references in complex object graphs:
   (V8 GC handles most, but WeakRef/FinalizationRegistry can help)

Detection tools:
  - process.memoryUsage() - track heapUsed over time
  - --inspect + Chrome DevTools heap snapshots
  - --max-old-space-size=512 to cap and surface leaks faster
  - clinic.js (clinic doctor, clinic flame)
  - node --heap-prof for heap profiling
  - Prometheus metrics: track RSS, heapUsed, external in production
  - heapdump package: trigger snapshots programmatically

Investigation workflow:
  1. Take heap snapshot at time T1
  2. Run suspected operation multiple times
  3. Take heap snapshot at time T2
  4. Compare snapshots - look for growing object counts
  5. Inspect retainer tree to find what holds references`
  );

  // Demonstrate memory monitoring
  subsection('Demo: Memory usage tracking');
  const mem = process.memoryUsage();
  console.log('  Current memory usage:');
  console.log(`    RSS:       ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Total:${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    External:  ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
}

// ============================================================================
// PART D: TYPESCRIPT (4 Questions)
// ============================================================================

function typeScriptQuestions() {
  section('PART D: TYPESCRIPT (4 Questions)');

  // ---- Q20: interface vs type ----
  qa(20,
    'What is the difference between interface and type in TypeScript?',
    `Both can describe object shapes, but they have key differences:

interface:
  - Can be extended with "extends" keyword
  - Supports declaration merging (same name = merged):
      interface User { name: string; }
      interface User { age: number; }
      // Result: User has both name and age
  - Can only describe object shapes and function signatures
  - Better for public API contracts / libraries (consumers can extend)
  - Slightly better error messages in some cases

type (type alias):
  - Can represent ANY type: primitives, unions, tuples, mapped types
      type ID = string | number;
      type Pair = [string, number];
      type Callback = (err: Error) => void;
  - Cannot be merged (duplicate identifier error)
  - Supports computed properties and conditional types
  - More powerful for complex type transformations

When to use which:
  - Objects/classes: prefer "interface" (convention, merging, extends)
  - Unions, tuples, mapped/conditional types: must use "type"
  - Library public API: prefer "interface" (consumers can augment)
  - Internal complex types: prefer "type" (more flexible)

In practice, many teams standardize on one. The TypeScript handbook
now says they are mostly interchangeable for object shapes.`
  );

  // Show TypeScript examples as strings
  subsection('Demo: interface vs type examples (as code strings)');
  const interfaceExample = `
  // Interface - declaration merging
  interface User { name: string; }
  interface User { age: number; }
  // User now has { name: string; age: number; }

  // Interface - extends
  interface Employee extends User { role: string; }
  `;

  const typeExample = `
  // Type - unions
  type ID = string | number;

  // Type - tuples
  type Point = [number, number];

  // Type - conditional
  type IsString<T> = T extends string ? 'yes' : 'no';

  // Type - mapped
  type Readonly<T> = { readonly [K in keyof T]: T[K] };
  `;

  console.log('  Interface example:');
  console.log(interfaceExample);
  console.log('  Type example:');
  console.log(typeExample);

  // ---- Q21: Generics ----
  qa(21,
    'Explain generics in TypeScript. What are practical use cases?',
    `Generics allow you to create reusable components that work with any type
while maintaining type safety. They are type parameters.

Basic syntax:
  function identity<T>(value: T): T { return value; }
  identity<string>('hello');  // T = string
  identity(42);               // T inferred as number

Practical use cases:

1. Generic functions:
   function firstElement<T>(arr: T[]): T | undefined { return arr[0]; }

2. Generic interfaces/classes:
   interface Repository<T> {
     findById(id: string): Promise<T>;
     save(entity: T): Promise<T>;
     delete(id: string): Promise<void>;
   }
   class UserRepo implements Repository<User> { ... }

3. Generic constraints:
   function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
     return obj[key];
   }
   // Ensures "key" is an actual property of T

4. Generic factory pattern:
   function createInstance<T>(ctor: new () => T): T {
     return new ctor();
   }

5. API response wrapper:
   interface ApiResponse<T> {
     data: T;
     status: number;
     message: string;
   }
   type UserResponse = ApiResponse<User>;

6. Conditional generics:
   type Flatten<T> = T extends Array<infer U> ? U : T;
   // Flatten<string[]> = string
   // Flatten<number>   = number

Common generic patterns in Node.js:
  - Express: Request<Params, ResBody, ReqBody, Query>
  - TypeORM: Repository<Entity>
  - Custom event emitters: TypedEmitter<EventMap>`
  );

  // ---- Q22: Type Guards ----
  qa(22,
    'What are type guards in TypeScript? How do you create custom ones?',
    `Type guards are expressions that narrow the type of a variable within a
conditional block. They help TypeScript understand specific types at runtime.

Built-in type guards:
  1. typeof:     if (typeof x === 'string') { x.toUpperCase(); }
  2. instanceof: if (x instanceof Date) { x.getTime(); }
  3. in:         if ('name' in obj) { obj.name; }
  4. truthiness: if (x) { /* x is not null/undefined/0/'' */ }

Custom type guards (type predicates):
  function isUser(value: unknown): value is User {
    return (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'email' in value
    );
  }

  function processInput(input: User | Guest) {
    if (isUser(input)) {
      // TypeScript knows input is User here
      console.log(input.email);
    }
  }

Discriminated unions (recommended pattern):
  interface Circle  { kind: 'circle';  radius: number; }
  interface Square  { kind: 'square';  side: number; }
  type Shape = Circle | Square;

  function area(shape: Shape): number {
    switch (shape.kind) {
      case 'circle': return Math.PI * shape.radius ** 2;
      case 'square': return shape.side ** 2;
    }
  }

Assertion functions (TypeScript 3.7+):
  function assertIsString(val: unknown): asserts val is string {
    if (typeof val !== 'string') throw new Error('Not a string');
  }
  // After calling assertIsString(x), TypeScript narrows x to string`
  );

  // Demonstrate type guard pattern (runtime version)
  subsection('Demo: Runtime type guard pattern');
  function isUserObj(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof value.name === 'string' &&
      typeof value.email === 'string'
    );
  }

  const testValues = [
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob' },
    'not an object',
    null,
  ];

  for (const val of testValues) {
    console.log(`  isUserObj(${JSON.stringify(val)}) => ${isUserObj(val)}`);
  }

  // ---- Q23: Utility Types ----
  qa(23,
    'What are TypeScript utility types? List the most commonly used ones.',
    `Utility types are built-in generic types that transform other types.

Most commonly used:

1.  Partial<T>         - All properties optional
    Partial<User> = { name?: string; email?: string; }

2.  Required<T>        - All properties required
    Required<Partial<User>> = { name: string; email: string; }

3.  Readonly<T>        - All properties readonly
    Readonly<User> = { readonly name: string; readonly email: string; }

4.  Pick<T, Keys>      - Select specific properties
    Pick<User, 'name'> = { name: string; }

5.  Omit<T, Keys>      - Remove specific properties
    Omit<User, 'password'> = { name: string; email: string; }

6.  Record<Keys, Type> - Object type with specific key and value types
    Record<string, number> = { [key: string]: number; }

7.  Exclude<Union, Excluded> - Remove types from union
    Exclude<'a'|'b'|'c', 'a'> = 'b' | 'c'

8.  Extract<Union, Extracted> - Keep only matching types
    Extract<'a'|'b'|'c', 'a'|'d'> = 'a'

9.  NonNullable<T>     - Remove null and undefined
    NonNullable<string | null> = string

10. ReturnType<T>      - Get function return type
    ReturnType<typeof parseInt> = number

11. Parameters<T>      - Get function parameter types as tuple
    Parameters<typeof setTimeout> = [callback, ms?, ...args[]]

12. Awaited<T>         - Unwrap Promise type (TS 4.5+)
    Awaited<Promise<string>> = string

Real-world usage:
  // API update endpoint - all fields optional
  async function updateUser(id: string, data: Partial<User>) { ... }

  // Config with defaults
  type Config = Required<Partial<RawConfig>> & { debug: boolean; }

  // Event map
  type Events = Record<string, (...args: any[]) => void>;`
  );
}

// ============================================================================
// PART E: SYSTEM DESIGN (4 Questions)
// ============================================================================

function systemDesignQuestions() {
  section('PART E: SYSTEM DESIGN (4 Questions)');

  // ---- Q24: Scaling Node.js ----
  qa(24,
    'How would you scale a Node.js application to handle millions of requests?',
    `Scaling strategy (from simple to complex):

VERTICAL SCALING (single machine):
  1. Cluster mode: fork workers per CPU core
     - PM2: pm2 start app.js -i max
     - Built-in: cluster.fork() in a loop
  2. Optimize event loop:
     - Avoid blocking the main thread (no sync I/O, no heavy computation)
     - Offload CPU work to worker_threads
     - Use streaming for large payloads
  3. Connection pooling:
     - Database connection pools (pg-pool, mongoose poolSize)
     - HTTP keep-alive for upstream services
  4. Caching:
     - In-memory: node-cache, lru-cache for hot data
     - Distributed: Redis/Memcached for shared state

HORIZONTAL SCALING (multiple machines):
  5. Load balancer:
     - Layer 7: Nginx, HAProxy, AWS ALB
     - Sticky sessions if needed (avoid if possible)
     - Health checks for auto-removal of unhealthy instances
  6. Stateless application design:
     - No server-side sessions (use JWT or Redis-backed sessions)
     - No local file storage (use S3 / object storage)
     - 12-factor app principles
  7. Auto-scaling:
     - Kubernetes HPA (Horizontal Pod Autoscaler)
     - AWS Auto Scaling Groups based on CPU/request count
     - Scale based on queue depth for worker services

ARCHITECTURE PATTERNS:
  8. Microservices: decompose by domain
  9. Event-driven: use message queues (RabbitMQ, Kafka) for decoupling
  10. CQRS: separate read and write paths
  11. CDN: cache static assets and API responses at the edge
  12. Database scaling: read replicas, sharding, caching layer

Monitoring (critical at scale):
  - Application metrics: response time (p50, p95, p99), error rate, throughput
  - System metrics: CPU, memory, event loop lag, active handles
  - Business metrics: signups, orders, revenue (tie to system health)`
  );

  // ---- Q25: Microservices Patterns ----
  qa(25,
    'What microservices patterns are important for Node.js applications?',
    `Key patterns:

1. API GATEWAY:
   - Single entry point for all clients
   - Routes requests to appropriate services
   - Handles cross-cutting concerns: auth, rate limiting, logging
   - Tools: Kong, AWS API Gateway, Express-based custom gateway

2. SERVICE DISCOVERY:
   - Services register themselves, clients look up addresses
   - Server-side: load balancer queries registry (Consul, etcd)
   - Client-side: client queries registry directly
   - Kubernetes: built-in DNS-based discovery

3. CIRCUIT BREAKER:
   - Prevents cascading failures when a service is down
   - States: Closed (normal) -> Open (failing) -> Half-Open (testing)
   - Libraries: opossum (Node.js), cockatiel
   - Thresholds: failure rate, response time

4. SAGA PATTERN (distributed transactions):
   - Choreography: each service emits events, next service reacts
   - Orchestration: a saga coordinator directs the workflow
   - Each step has a compensating action for rollback
   - Example: Order -> Payment -> Inventory -> Shipping (with compensations)

5. EVENT SOURCING + CQRS:
   - Store events rather than current state
   - Rebuild state by replaying events
   - Separate read models (optimized for queries) from write models
   - Great with Kafka / EventStoreDB

6. SIDECAR / SERVICE MESH:
   - Proxy handles networking concerns (mTLS, retries, tracing)
   - Istio, Linkerd for Kubernetes
   - Application code stays focused on business logic

7. BULKHEAD:
   - Isolate resources per service/feature
   - One slow service cannot consume all connection pool/threads
   - Separate thread pools, connection pools, rate limits

8. STRANGLER FIG (migration pattern):
   - Gradually replace monolith components with microservices
   - Route traffic to new service incrementally
   - Low risk, reversible migration strategy`
  );

  // ---- Q26: Caching Strategies ----
  qa(26,
    'What caching strategies would you implement and when?',
    `Caching layers (from client to database):

1. BROWSER CACHE:
   - Cache-Control, ETag, Last-Modified headers
   - Service Workers for offline-first PWAs

2. CDN CACHE:
   - Static assets, API responses for public data
   - CloudFront, Cloudflare, Fastly
   - Cache invalidation via tags or surrogate keys

3. APPLICATION CACHE:
   - In-memory: lru-cache, node-cache (single instance)
   - Distributed: Redis, Memcached (shared across instances)

4. DATABASE CACHE:
   - Query cache, materialized views
   - Database buffer pool tuning

Caching strategies:

CACHE-ASIDE (Lazy Loading):
  read: check cache -> miss -> query DB -> store in cache -> return
  write: update DB -> invalidate cache
  Pros: only caches what is needed
  Cons: cache miss penalty, possible stale data

WRITE-THROUGH:
  write: update cache AND DB simultaneously
  read: always from cache (guaranteed fresh)
  Pros: cache is always consistent
  Cons: write latency (two writes), caches unused data

WRITE-BEHIND (Write-Back):
  write: update cache -> async write to DB (batched)
  Pros: fast writes, batch efficiency
  Cons: data loss risk if cache crashes before DB write

READ-THROUGH:
  Cache itself is responsible for loading from DB on miss.
  Application only talks to cache.

TTL-based EXPIRATION:
  Set time-to-live based on data volatility:
  - User profile: 5-15 minutes
  - Product catalog: 1-24 hours
  - Config/feature flags: 30-60 seconds

CACHE INVALIDATION (the hard problem):
  - Event-driven: publish cache-invalidation events on data change
  - TTL-based: accept staleness within TTL window
  - Version-based: include version in cache key (v2:user:123)

Common pitfalls:
  - Cache stampede: many requests hit DB when cache expires simultaneously
    Fix: mutex/lock, stale-while-revalidate, jitter on TTL
  - Hot key: single cache key receives massive traffic
    Fix: local cache + distributed cache, key replication
  - Large values: serialization overhead, memory pressure
    Fix: compress, store references, paginate`
  );

  // ---- Q27: Database Choice ----
  qa(27,
    'How do you choose between SQL and NoSQL databases for a Node.js project?',
    `Decision framework:

CHOOSE SQL (PostgreSQL, MySQL) WHEN:
  - Data has clear relationships (users, orders, products)
  - You need ACID transactions (financial, inventory)
  - Complex queries with JOINs are common
  - Schema is relatively stable
  - You need strong consistency
  - Data integrity is critical (foreign keys, constraints)

CHOOSE NoSQL WHEN:
  Document (MongoDB, DynamoDB):
    - Flexible/evolving schema
    - Hierarchical data (nested objects)
    - Rapid prototyping
    - Read-heavy, denormalized data

  Key-Value (Redis, DynamoDB):
    - Caching, session storage
    - Simple lookups by key
    - High throughput, low latency
    - Rate limiting, leaderboards

  Wide-Column (Cassandra, ScyllaDB):
    - Massive write throughput
    - Time-series data, IoT
    - Multi-datacenter replication
    - Known query patterns

  Graph (Neo4j, Amazon Neptune):
    - Highly connected data (social networks, recommendations)
    - Traversal queries (shortest path, friends-of-friends)

Node.js ORM/Driver choices:
  SQL:
    - Prisma (type-safe, great DX, migrations)
    - Knex.js (query builder, flexible)
    - TypeORM (decorator-based, similar to Java)
    - pg (raw driver for PostgreSQL)

  NoSQL:
    - Mongoose (MongoDB ODM, schema validation)
    - ioredis (Redis, cluster support)
    - @aws-sdk/client-dynamodb

POLYGLOT PERSISTENCE:
  Real-world systems often use multiple databases:
    - PostgreSQL for core transactional data
    - Redis for caching and sessions
    - Elasticsearch for full-text search
    - S3 for file storage
    - Kafka for event streaming

  Use the right tool for each use case rather than forcing one database
  to do everything.`
  );
}

// ============================================================================
// PART F: BEHAVIORAL (STAR Framework, 3 Examples)
// ============================================================================

function behavioralQuestions() {
  section('PART F: BEHAVIORAL QUESTIONS (STAR Framework)');

  console.log(`
  The STAR Method:
  ================
  S - Situation : Set the scene. What was the context?
  T - Task      : What was your responsibility or goal?
  A - Action    : What specific steps did YOU take?
  R - Result    : What was the outcome? Quantify if possible.

  Tips:
  - Use "I" not "we" to highlight YOUR contribution
  - Be specific about technologies and decisions
  - Include metrics and outcomes
  - Keep it to 2-3 minutes when speaking
  - Prepare 5-7 stories that cover: leadership, conflict, failure,
    technical challenge, tight deadline, collaboration, innovation
`);

  // ---- Behavioral Q1 ----
  qa('B1',
    'Tell me about a challenging project you worked on.',
    `SITUATION:
At my previous company, we had a monolithic Express.js application serving
50,000 daily active users. Response times had degraded to 3-5 seconds for
key API endpoints, and the deployment process took 45 minutes with frequent
rollback-inducing failures. The CTO tasked our team with fixing this.

TASK:
As the senior backend engineer, I was responsible for identifying the root
causes of the performance issues and proposing an architectural solution
that the team could implement incrementally without a full rewrite.

ACTION:
1. I profiled the application using clinic.js and Chrome DevTools, discovering
   that three endpoints were making 15-20 sequential database queries each
   due to the N+1 query problem in our Sequelize ORM layer.

2. I designed a migration plan using the Strangler Fig pattern:
   - Extracted the three worst endpoints into separate microservices
   - Introduced Redis caching with a cache-aside strategy (5-min TTL)
   - Replaced sequential queries with batch loading (DataLoader pattern)
   - Set up a CI/CD pipeline with GitHub Actions (deploy time: 8 minutes)

3. I led the implementation, writing the caching layer and DataLoader
   integration myself, while mentoring two junior developers on the
   microservice extraction. I also introduced structured logging with
   Pino and Grafana dashboards for observability.

RESULT:
- API response times dropped from 3-5 seconds to 150-300ms (95th percentile)
- Database query count per request reduced by 80%
- Deployment time went from 45 minutes to 8 minutes
- Zero-downtime deployments enabled via rolling updates in Kubernetes
- The patterns we established became the team's standard for new services`
  );

  // ---- Behavioral Q2 ----
  qa('B2',
    'How do you handle disagreements with team members?',
    `SITUATION:
During a system design review for a new real-time notification service, I
proposed using Redis Pub/Sub with WebSocket connections, while a senior
colleague strongly advocated for polling with Server-Sent Events. The
discussion became heated in a team meeting, and neither side was backing down.

TASK:
As the tech lead for this feature, I needed to reach a sound technical
decision while maintaining team cohesion and ensuring both perspectives
were respected.

ACTION:
1. I paused the meeting discussion and suggested we both write up a one-page
   technical comparison document by the next day, covering: scalability,
   implementation complexity, client compatibility, operational cost, and
   failure modes.

2. I scheduled a 1-on-1 with my colleague first. I listened to understand
   his concerns: he was worried about WebSocket connection management at
   scale and our team's lack of experience with Redis Pub/Sub in production.
   These were legitimate concerns I had underestimated.

3. I proposed a compromise: use SSE for the initial release (simpler, proven)
   with an architecture that could swap to WebSockets later. I designed the
   abstraction layer so the transport mechanism was pluggable.

4. I built a proof-of-concept for both approaches and ran load tests.
   The data showed SSE handled our projected load (10K concurrent users)
   comfortably, validating the phased approach.

RESULT:
- We shipped the SSE version in 2 weeks (vs estimated 4 weeks for WebSocket)
- The service handled 15K concurrent connections in production without issues
- My colleague and I developed a stronger working relationship built on
  mutual respect. He later helped design the WebSocket upgrade for phase 2.
- The team adopted our "write it up, prototype, measure" process for
  resolving future technical disagreements.`
  );

  // ---- Behavioral Q3 ----
  qa('B3',
    'Describe a production incident you resolved.',
    `SITUATION:
At 2 AM on a Tuesday, our monitoring (PagerDuty + Datadog) alerted me to a
spike in 500 errors on our payment processing service. Error rate jumped
from 0.1% to 35% within 5 minutes. Customer-facing checkout was failing for
a significant portion of users.

TASK:
As the on-call senior engineer, I was responsible for diagnosing the issue,
restoring service, and leading the post-incident review.

ACTION:
1. TRIAGE (first 5 minutes):
   - Checked Datadog dashboards: Node.js event loop lag was normal, CPU/memory
     fine. The errors were all "ETIMEOUT" from our payment gateway client.
   - Checked the payment gateway's status page: no reported outages.
   - Ruled out: our deployment (last deploy was 6 hours ago), infrastructure
     (other services healthy), database (query times normal).

2. DIAGNOSIS (next 15 minutes):
   - Dug into the timeout errors: they were all happening on DNS resolution
     (dns.lookup, not dns.resolve). This uses the libuv thread pool.
   - Checked UV_THREADPOOL_SIZE: default (4). We had recently added a new
     logging feature that wrote to files asynchronously - fs operations also
     use the thread pool.
   - Found it: the new logging feature was writing thousands of small files
     per second, saturating the thread pool. DNS lookups were queued behind
     fs operations and timing out.

3. FIX (next 10 minutes):
   - Immediate fix: set UV_THREADPOOL_SIZE=64 and restarted the service.
     Error rate dropped to 0.2% within 2 minutes.
   - Short-term fix: switched the logging library from file-based to
     stdout (piped to a log aggregator), freeing the thread pool entirely.
   - Long-term fix: implemented dns.resolve() (uses c-ares, bypasses thread
     pool) for the payment client, and added event loop lag + thread pool
     utilization to our monitoring dashboard.

RESULT:
- Total customer impact: ~25 minutes of degraded service
- Root cause identified and permanently fixed
- Led a blameless post-mortem where we:
  - Added thread pool monitoring to all Node.js services
  - Created a "Node.js production checklist" including UV_THREADPOOL_SIZE
    tuning and avoiding thread pool contention
  - Implemented a pre-merge performance review for changes affecting I/O
- This became a teaching case study for our engineering onboarding program`
  );
}

// ============================================================================
// PART G: 6-WEEK STUDY PLAN
// ============================================================================

function sixWeekStudyPlan() {
  section('PART G: 6-WEEK STUDY PLAN FOR NODE.JS SENIOR INTERVIEWS');

  const plan = `
  =====================================================================
  6-WEEK STUDY PLAN FOR SENIOR NODE.JS INTERVIEWS
  =====================================================================
  Time commitment: 2-3 hours per weekday, 4-5 hours on weekends
  Total: ~90-100 hours of focused preparation

  WEEK 1: JAVASCRIPT & TYPESCRIPT FOUNDATIONS
  -------------------------------------------
  Mon:  Event loop deep dive (browser + Node.js). Write demos.
  Tue:  Closures, scope chain, "this" keyword. Tricky edge cases.
  Wed:  Prototypes, inheritance, ES6 classes. Implement a class hierarchy.
  Thu:  TypeScript: types, interfaces, generics, utility types.
  Fri:  TypeScript: advanced patterns (conditional types, mapped types).
  Sat:  Practice 5 LeetCode Easy/Medium in JavaScript. Focus on arrays/strings.
  Sun:  Review week's notes. Write a blog-style summary for retention.

  WEEK 2: NODE.JS INTERNALS & ASYNC PATTERNS
  -------------------------------------------
  Mon:  Node.js event loop phases. libuv, thread pool, process.nextTick.
  Tue:  Streams (readable, writable, transform, duplex). Build a pipeline.
  Wed:  Async patterns: callbacks -> Promises -> async/await. Error handling.
  Thu:  Cluster module, worker_threads. Build a multi-core HTTP server.
  Wed:  CommonJS vs ESM. Module resolution. Package.json deep dive.
  Sat:  Practice 5 LeetCode Medium. Focus on hash maps and two pointers.
  Sun:  Build a small project using this week's concepts (e.g., log processor).

  WEEK 3: SYSTEM DESIGN FUNDAMENTALS
  -------------------------------------------
  Mon:  System design framework (4 steps). Practice with URL shortener.
  Tue:  Load balancing, caching (Redis), CDN. Draw architecture diagrams.
  Wed:  Database design: SQL vs NoSQL, indexing, sharding, replication.
  Thu:  Microservices patterns: API gateway, circuit breaker, saga.
  Fri:  Message queues (RabbitMQ, Kafka). Event-driven architecture.
  Sat:  Practice system design: design Twitter/Instagram feed.
  Sun:  Practice system design: design a chat application.

  WEEK 4: TESTING, SECURITY & DEVOPS
  -------------------------------------------
  Mon:  Testing pyramid: unit (Jest), integration, E2E. Mocking strategies.
  Tue:  API design: REST best practices, GraphQL, WebSockets, gRPC.
  Wed:  Security: OWASP Top 10, JWT, OAuth2, CORS, rate limiting.
  Thu:  Docker, Kubernetes basics. CI/CD pipelines for Node.js.
  Fri:  Monitoring: logging (Pino), metrics (Prometheus), tracing (OpenTelemetry).
  Sat:  Practice 5 LeetCode Medium/Hard. Focus on trees and graphs.
  Sun:  Mock system design interview with a friend or on Pramp.

  WEEK 5: CODING INTERVIEW INTENSIVE
  -------------------------------------------
  Mon:  Data structures review: arrays, linked lists, stacks, queues.
  Tue:  Trees, graphs: BFS, DFS, topological sort.
  Wed:  Dynamic programming: memoization, tabulation. Classic problems.
  Thu:  Sorting, searching, sliding window, binary search patterns.
  Fri:  Practice 3 hard problems. Focus on explaining your thought process.
  Sat:  Full mock coding interview (2 problems, 45 minutes each).
  Sun:  Full mock system design interview (45 minutes).

  WEEK 6: BEHAVIORAL & FINAL REVIEW
  -------------------------------------------
  Mon:  Prepare 7 STAR stories covering all behavioral categories.
  Tue:  Practice behavioral answers out loud. Record and review.
  Wed:  Review all technical notes. Focus on weak areas.
  Thu:  Full mock interview: 1 coding + 1 system design + 1 behavioral.
  Fri:  Light review. Rest. Prepare questions to ask the interviewer.
  Sat:  Light practice. Review your "cheat sheet" of key concepts.
  Sun:  Rest. Confidence. You are prepared.

  DAILY HABITS:
  - Review 3 flashcards from previous weeks (spaced repetition)
  - Read one engineering blog post (Netflix, Uber, Airbnb, Stripe)
  - Explain one concept out loud as if teaching someone (Feynman technique)

  RESOURCES:
  - Books: "Node.js Design Patterns" (Casciaro), "Designing Data-Intensive
    Applications" (Kleppmann), "You Don't Know JS" (Simpson)
  - Practice: LeetCode, NeetCode 150, AlgoExpert
  - System Design: "System Design Interview" (Alex Xu), ByteByteGo
  - Mock interviews: Pramp (free), interviewing.io, Exponent
  - Node.js: Official docs, NodeConf talks, libuv documentation
  `;

  console.log(plan);
}

// ============================================================================
// PART H: CODING INTERVIEW TIPS FOR JAVASCRIPT
// ============================================================================

function codingInterviewTips() {
  section('PART H: CODING INTERVIEW TIPS FOR JAVASCRIPT');

  const tips = `
  =====================================================================
  CODING INTERVIEW TIPS SPECIFIC TO JAVASCRIPT / NODE.JS
  =====================================================================

  BEFORE THE INTERVIEW:
  ---------------------
  1. Know your environment:
     - Ask if you can use Node.js features (Buffer, process, etc.)
     - Ask about ES version: can you use optional chaining, nullish coalescing?
     - Clarify if you can use built-in methods (Array.sort, Map, Set)

  2. Set up your coding environment:
     - If using CoderPad/HackerRank, test that console.log works
     - Know how to run code in the platform

  DURING THE PROBLEM:
  -------------------
  3. Clarify first (2-3 minutes):
     - Input types and constraints (array of numbers? strings? objects?)
     - Edge cases: empty input, single element, duplicates, negative numbers
     - Expected output format
     - Time/space complexity requirements

  4. Think out loud:
     - "I'm thinking of using a hash map because we need O(1) lookups..."
     - "The brute force would be O(n^2), but we can optimize with..."
     - Interviewers evaluate your PROCESS as much as your solution

  5. Start with brute force, then optimize:
     - State the brute force approach and its complexity
     - Identify the bottleneck (usually nested loops or repeated work)
     - Apply patterns: two pointers, sliding window, hash map, etc.

  JAVASCRIPT-SPECIFIC TIPS:
  -------------------------
  6. Leverage built-in data structures:
     - Map (ordered, any key type) over plain objects for hash maps
     - Set for O(1) unique membership checks
     - Array methods: .map(), .filter(), .reduce(), .sort(), .find()

  7. Know the quirks:
     - Array.sort() sorts LEXICOGRAPHICALLY by default:
       [10, 9, 2].sort() => [10, 2, 9]  // WRONG
       [10, 9, 2].sort((a, b) => a - b)  // Correct: [2, 9, 10]
     - typeof null === 'object' (historical bug)
     - NaN !== NaN (use Number.isNaN())
     - === does not work for object comparison (reference equality)

  8. String manipulation:
     - Strings are immutable; concatenation in a loop is O(n^2)
     - Use Array.join('') for building strings
     - .charCodeAt() for character math: 'a'.charCodeAt(0) => 97

  9. Useful patterns in JS:
     - Destructuring: const [first, ...rest] = arr;
     - Spread: const merged = { ...obj1, ...obj2 };
     - Optional chaining: user?.address?.city
     - Nullish coalescing: value ?? defaultValue
     - Short-circuit: const name = user && user.name;

  10. Handle async problems:
      - If the problem involves async operations, use async/await
      - Know Promise.all, Promise.race, Promise.allSettled
      - Understand that async functions return Promises

  COMPLEXITY ANALYSIS:
  --------------------
  11. Common complexities in JS:
      - Array.push/pop: O(1) amortized
      - Array.shift/unshift: O(n) -- prefer a queue class if needed
      - Array.sort: O(n log n) -- TimSort
      - Map/Set.get/.has/.set/.add/.delete: O(1) average
      - String concatenation: O(n) per operation
      - Object property access: O(1) average
      - Array.includes / indexOf: O(n)

  AFTER SOLVING:
  --------------
  12. Test your solution:
      - Walk through with a small example
      - Test edge cases: empty input, single element, large input
      - Check off-by-one errors (common in loops and slicing)

  13. Discuss trade-offs:
      - Time vs space complexity
      - Readability vs performance
      - "In production, I would also consider..."

  14. Be ready for follow-ups:
      - "What if the input doesn't fit in memory?" (streaming / external sort)
      - "What if this needs to be thread-safe?" (worker_threads + locks)
      - "How would you test this?" (unit tests, property-based testing)
  `;

  console.log(tips);
}

// ============================================================================
// PART I: COMMON MISTAKES TO AVOID
// ============================================================================

function commonMistakes() {
  section('PART I: COMMON MISTAKES TO AVOID');

  const mistakes = `
  =====================================================================
  COMMON MISTAKES TO AVOID IN NODE.JS SENIOR INTERVIEWS
  =====================================================================

  TECHNICAL MISTAKES:
  -------------------

  1. BLOCKING THE EVENT LOOP
     BAD:  Using synchronous fs methods (readFileSync) in a server
     BAD:  CPU-intensive operations on the main thread (JSON.parse on huge data)
     BAD:  Using RegExp with catastrophic backtracking
     GOOD: Use async alternatives, worker_threads for CPU work, streaming

  2. NOT HANDLING ERRORS PROPERLY
     BAD:  try { ... } catch(e) { }          // swallowing errors
     BAD:  promise.then(data => ...)          // missing .catch()
     BAD:  async function without try/catch   // unhandled rejection
     GOOD: Always log and propagate errors. Use global handlers as safety nets.

  3. MEMORY LEAKS IN PRODUCTION
     BAD:  Unbounded caches (const cache = {})
     BAD:  Adding event listeners in a loop without removing them
     BAD:  Storing request data in module-level variables
     GOOD: Use LRU caches with max size, remove listeners, scope data to request

  4. SECURITY VULNERABILITIES
     BAD:  eval(userInput)
     BAD:  SQL: \`SELECT * FROM users WHERE id = \${userId}\`
     BAD:  Not validating/sanitizing input
     BAD:  Storing secrets in code or environment variables without encryption
     GOOD: Use parameterized queries, input validation (joi/zod), vault for secrets

  5. IMPROPER ASYNC PATTERNS
     BAD:  Sequential awaits when operations are independent:
           const a = await fetchA(); const b = await fetchB();
     GOOD: const [a, b] = await Promise.all([fetchA(), fetchB()]);

     BAD:  await in a forEach (does not work as expected):
           arr.forEach(async (item) => { await process(item); });
     GOOD: await Promise.all(arr.map(item => process(item)));
           // or: for (const item of arr) { await process(item); }

  6. NOT UNDERSTANDING "this" BINDING
     BAD:  class MyClass { constructor() { emitter.on('event', this.handler); } }
           // "this" is lost inside handler
     GOOD: emitter.on('event', this.handler.bind(this));
           // or: emitter.on('event', (data) => this.handler(data));

  INTERVIEW BEHAVIOR MISTAKES:
  ----------------------------

  7. JUMPING TO CODE IMMEDIATELY
     - Always clarify requirements and constraints first
     - Discuss approach and get interviewer buy-in before coding
     - "Can I take a moment to think about the approach?"

  8. GOING SILENT
     - The interviewer cannot evaluate what they cannot hear
     - Narrate your thought process, even when stuck
     - "I'm considering two approaches: X and Y. X is better because..."

  9. NOT ASKING QUESTIONS
     - "What's the expected scale?"
     - "Should I optimize for reads or writes?"
     - "Are there any constraints I should know about?"
     - Asking smart questions shows senior-level thinking

  10. OVER-ENGINEERING THE SOLUTION
      - Start simple and add complexity only when asked
      - In system design: start with a single server, then scale
      - In coding: write clean, correct code before optimizing
      - "For an MVP, I would start with X. If we need to scale, we add Y."

  11. IGNORING TRADE-OFFS
      - Every decision has trade-offs. Acknowledge them.
      - "The trade-off here is that we gain read performance but
         sacrifice write consistency..."
      - "We could use Redis for caching, which adds operational
         complexity but reduces database load by 90%."

  12. NOT KNOWING YOUR OWN RESUME
      - Be prepared to go deep on any technology listed on your resume
      - If you listed Kubernetes, expect questions about pods, services,
        deployments, health checks, resource limits
      - If you listed "microservices," explain a specific architecture
        you designed and the trade-offs you made

  13. UNDERESTIMATING BEHAVIORAL QUESTIONS
      - Prepare STAR stories BEFORE the interview
      - Behavioral questions carry 20-30% of the evaluation at senior level
      - They assess: leadership, conflict resolution, communication,
        technical judgment, and cultural fit

  14. NOT PREPARING QUESTIONS FOR THE INTERVIEWER
      Good questions to ask:
      - "What does the tech stack look like and how is it evolving?"
      - "How are technical decisions made on the team?"
      - "What does the on-call rotation look like?"
      - "What is the team's approach to technical debt?"
      - "Can you describe a recent technical challenge the team faced?"
      Bad questions (too early):
      - Salary, PTO, benefits (save for recruiter/HR)
      - "When can I get promoted?" (shows wrong priorities)
  `;

  console.log(mistakes);
}

// ============================================================================
// DEMO: Run all sections
// ============================================================================

function main() {
  console.log(`${'*'.repeat(76)}`);
  console.log(`  FILE 16: 30+ REAL INTERVIEW QUESTIONS & ANSWERS`);
  console.log(`  FOR SENIOR NODE.JS ROLES`);
  console.log(`${'*'.repeat(76)}`);
  console.log(`  Total: 30 technical Q&As + 3 behavioral + study plan + tips + mistakes`);
  console.log(`  Categories: Core JS (8), Node.js (6), Async (5), TS (4), Design (4), STAR (3)`);

  // Part A: Core JavaScript
  coreJavaScriptQuestions();

  // Part B: Node.js Specifics
  nodeJsQuestions();

  // Part C: Async / Concurrency
  asyncConcurrencyQuestions();

  // Part D: TypeScript
  typeScriptQuestions();

  // Part E: System Design
  systemDesignQuestions();

  // Part F: Behavioral (STAR)
  behavioralQuestions();

  // Part G: Study Plan
  sixWeekStudyPlan();

  // Part H: Coding Tips
  codingInterviewTips();

  // Part I: Common Mistakes
  commonMistakes();

  // Final summary (delayed to let async demos complete)
  setTimeout(() => {
    console.log(`\n${'='.repeat(76)}`);
    console.log('  ALL SECTIONS COMPLETE');
    console.log(`${'='.repeat(76)}`);
    console.log(`
  Summary of coverage:
  - 8  Core JavaScript questions     (Q1-Q8)
  - 6  Node.js-specific questions    (Q9-Q14)
  - 5  Async/Concurrency questions   (Q15-Q19)
  - 4  TypeScript questions           (Q20-Q23)
  - 4  System Design questions        (Q24-Q27)
  - 3  Behavioral STAR answers        (QB1-QB3)
  - 6-week study plan with daily tasks
  - 14 coding interview tips for JavaScript
  - 14 common mistakes to avoid

  Total: 30 technical Q&As + 3 behavioral + comprehensive prep guide
  Good luck with your interviews!
    `);
  }, 200);
}

// Run everything
main();
