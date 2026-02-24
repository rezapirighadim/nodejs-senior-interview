# Functional Programming in JavaScript -- Senior Interview Reference

## Table of Contents

- [Pure Functions](#pure-functions)
- [Higher-Order Functions](#higher-order-functions)
- [Function Composition (Pipe and Compose)](#function-composition-pipe-and-compose)
- [Currying](#currying)
- [Partial Application](#partial-application)
- [Immutability](#immutability)
- [Functors](#functors)
- [Monads (Maybe, Either, Result)](#monads-maybe-either-result)
- [Memoization](#memoization)
- [Lazy Evaluation with Generators](#lazy-evaluation-with-generators)
- [Transducers](#transducers)
- [Point-Free Style](#point-free-style)
- [FP Error Handling Patterns](#fp-error-handling-patterns)
- [Data Pipelines](#data-pipelines)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Pure Functions

A **pure function** always returns the same output for the same input and produces no side effects (no mutation of external state, no I/O, no randomness).

### Characteristics

| Property            | Pure Function                 | Impure Function               |
|---------------------|-------------------------------|-------------------------------|
| Deterministic       | Yes -- same input = same out  | No -- may depend on state     |
| Side effects        | None                          | May read/write external state |
| Referential transparency | Yes -- can be replaced with its value | No               |
| Testability         | Trivial to test               | May need mocking              |
| Cacheability        | Safe to memoize               | Risky to cache                |

### Examples

```javascript
// Pure -- depends only on its arguments
function add(a, b) {
  return a + b;
}

// Pure -- no mutation, returns a new array
function appendItem(arr, item) {
  return [...arr, item];
}

// Impure -- depends on external mutable state
let taxRate = 0.2;
function calculateTax(amount) {
  return amount * taxRate; // taxRate can change
}

// Impure -- side effect (console I/O)
function logAndReturn(value) {
  console.log(value); // side effect
  return value;
}

// Impure -- non-deterministic
function getRandomId() {
  return Math.random().toString(36).slice(2);
}
```

### Making Impure Functions Purer

```javascript
// Before: impure -- reads from external state
let discount = 0.1;
function applyDiscount(price) {
  return price * (1 - discount);
}

// After: pure -- all dependencies are explicit parameters
function applyDiscount(price, discount) {
  return price * (1 - discount);
}

// Pushing side effects to the boundary
// Core logic is pure
function formatUser(name, email) {
  return { name: name.trim(), email: email.toLowerCase() };
}

// Side effects isolated at the boundary
async function saveUser(name, email) {
  const user = formatUser(name, email); // pure
  await db.save(user);                  // impure, at the edge
  return user;
}
```

> **Interview Tip:** Explain that real applications always have side effects (DB writes, network calls). The FP approach is to push impure code to the boundaries and keep the core logic pure. This is sometimes called "functional core, imperative shell."

---

## Higher-Order Functions

A **higher-order function** (HOF) either takes a function as an argument, returns a function, or both.

### Built-in Higher-Order Functions

```javascript
const numbers = [1, 2, 3, 4, 5];

// map -- transform each element
const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

// filter -- keep elements matching a predicate
const evens = numbers.filter(n => n % 2 === 0);
// [2, 4]

// reduce -- accumulate to a single value
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15

// find -- first match
const firstEven = numbers.find(n => n % 2 === 0);
// 2

// every / some -- boolean checks
const allPositive = numbers.every(n => n > 0);  // true
const hasNeg = numbers.some(n => n < 0);         // false

// flatMap -- map + flatten one level
const nested = [[1, 2], [3, 4]];
const flat = nested.flatMap(arr => arr.map(n => n * 10));
// [10, 20, 30, 40]
```

### Writing Custom Higher-Order Functions

```javascript
// Returns a function (closure)
function multiplier(factor) {
  return function (n) {
    return n * factor;
  };
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5)); // 10
console.log(triple(5)); // 15

// Takes a function and wraps it
function withLogging(fn) {
  return function (...args) {
    console.log(`Calling ${fn.name} with`, args);
    const result = fn(...args);
    console.log(`Result:`, result);
    return result;
  };
}
const loggedAdd = withLogging(add);
loggedAdd(2, 3); // logs: Calling add with [2, 3] \n Result: 5

// Retry wrapper -- higher-order async function
function withRetry(fn, retries = 3) {
  return async function (...args) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn(...args);
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 2 ** i * 1000));
      }
    }
  };
}
const fetchWithRetry = withRetry(fetch, 3);
```

> **Interview Tip:** HOFs are the backbone of FP in JavaScript. `map`, `filter`, and `reduce` should be second nature. Be ready to implement any of them from scratch.

---

## Function Composition (Pipe and Compose)

Composition combines simple functions to build complex behavior. Data flows through a chain of transformations.

### Compose (right-to-left)

```javascript
// compose: f(g(h(x))) -- reads right to left
function compose(...fns) {
  return function (x) {
    return fns.reduceRight((acc, fn) => fn(acc), x);
  };
}

const trim = s => s.trim();
const toLower = s => s.toLowerCase();
const split = sep => s => s.split(sep);

const processInput = compose(
  split(" "),   // step 3: split into words
  toLower,      // step 2: lowercase
  trim          // step 1: trim whitespace
);

processInput("  Hello World  ");
// ["hello", "world"]
```

### Pipe (left-to-right)

```javascript
// pipe: h(g(f(x))) -- reads left to right (more natural)
function pipe(...fns) {
  return function (x) {
    return fns.reduce((acc, fn) => fn(acc), x);
  };
}

const processInput = pipe(
  trim,         // step 1: trim whitespace
  toLower,      // step 2: lowercase
  split(" ")    // step 3: split into words
);

processInput("  Hello World  ");
// ["hello", "world"]
```

### Async Pipe

```javascript
function asyncPipe(...fns) {
  return function (input) {
    return fns.reduce(
      (chain, fn) => chain.then(fn),
      Promise.resolve(input)
    );
  };
}

const processOrder = asyncPipe(
  validateOrder,    // may be async
  calculateTotal,   // pure
  applyDiscount,    // pure
  saveToDatabase,   // async
  sendConfirmation  // async
);

await processOrder(orderData);
```

### Multi-Argument Pipe with Reduce

```javascript
// For the first function accepting multiple arguments
function pipeWith(...fns) {
  return function (...args) {
    const [first, ...rest] = fns;
    return rest.reduce((acc, fn) => fn(acc), first(...args));
  };
}

const calculatePrice = pipeWith(
  (price, qty) => price * qty,   // accepts two args
  total => total * 1.2,          // add VAT
  total => total.toFixed(2),     // format
  str => `$${str}`               // prefix
);

calculatePrice(9.99, 3); // "$35.96"
```

> **Interview Tip:** Prefer `pipe` over `compose` in interviews -- it reads naturally left-to-right. Mention that TC39 has a pipe operator proposal (`|>`) that would make this native syntax.

---

## Currying

**Currying** transforms a function that takes multiple arguments into a sequence of functions, each taking a single argument: `f(a, b, c)` becomes `f(a)(b)(c)`.

### Manual Currying

```javascript
// Non-curried
function add(a, b) {
  return a + b;
}

// Curried
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

const add5 = curriedAdd(5);
console.log(add5(3)); // 8
console.log(curriedAdd(2)(7)); // 9
```

### Generic Curry Utility

```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...moreArgs) {
      return curried.apply(this, [...args, ...moreArgs]);
    };
  };
}

const curriedAdd = curry((a, b, c) => a + b + c);

curriedAdd(1)(2)(3);    // 6
curriedAdd(1, 2)(3);    // 6
curriedAdd(1)(2, 3);    // 6
curriedAdd(1, 2, 3);    // 6
```

### Practical Currying

```javascript
// Reusable configuration
const request = curry((method, url, body) => {
  return fetch(url, { method, body: JSON.stringify(body) });
});

const get = request("GET");
const post = request("POST");
const postToApi = post("https://api.example.com/data");

await postToApi({ name: "Alice" });

// Event handling
const handleEvent = curry((handler, eventName, element) => {
  element.addEventListener(eventName, handler);
  return () => element.removeEventListener(eventName, handler);
});

const onClick = handleEvent(myHandler, "click");
const removeClickOnBtn = onClick(button);

// Data transformation pipelines
const map = curry((fn, arr) => arr.map(fn));
const filter = curry((pred, arr) => arr.filter(pred));
const prop = curry((key, obj) => obj[key]);

const getNames = map(prop("name"));
const getAdultNames = pipe(
  filter(user => user.age >= 18),
  getNames
);

getAdultNames([
  { name: "Alice", age: 25 },
  { name: "Bob", age: 15 },
  { name: "Carol", age: 30 }
]);
// ["Alice", "Carol"]
```

---

## Partial Application

**Partial application** fixes some arguments of a function, producing a new function with fewer parameters. Unlike currying, it can fix any number of arguments at once.

### Using `Function.prototype.bind`

```javascript
function greet(greeting, punctuation, name) {
  return `${greeting}, ${name}${punctuation}`;
}

const greetHello = greet.bind(null, "Hello", "!");
greetHello("Alice"); // "Hello, Alice!"
greetHello("Bob");   // "Hello, Bob!"
```

### Custom Partial Application

```javascript
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

const double = partial(multiply, 2);
double(5); // 10

// With placeholder support
const _ = Symbol("placeholder");

function partialWithPlaceholders(fn, ...presetArgs) {
  return function (...laterArgs) {
    const args = presetArgs.map(arg =>
      arg === _ ? laterArgs.shift() : arg
    );
    return fn(...args, ...laterArgs);
  };
}

const divideBy2 = partialWithPlaceholders(divide, _, 2);
divideBy2(10); // 5

const divide10By = partialWithPlaceholders(divide, 10, _);
divide10By(2); // 5
```

### Currying vs Partial Application

| Feature              | Currying                          | Partial Application              |
|----------------------|-----------------------------------|----------------------------------|
| Transformation       | Unary chain: `f(a)(b)(c)`        | Fix some args: `f(a, b)` -> `g(c)` |
| Arguments per call   | Always one                        | Any number                       |
| Total calls          | Always `n` (one per argument)     | Flexible                         |
| Implementation       | Generic, auto-curries             | Manual or with `bind`/utility    |
| Use case             | Building specialized functions    | Presetting configuration         |

---

## Immutability

Immutability means data cannot be changed after creation. Instead, new data structures are created with the desired changes.

### Object.freeze (Shallow)

```javascript
const config = Object.freeze({
  host: "localhost",
  port: 3000,
  db: { name: "mydb" } // nested objects are NOT frozen
});

config.port = 8080;       // silently fails (throws in strict mode)
config.db.name = "other"; // WORKS -- freeze is shallow

console.log(config.port);    // 3000
console.log(config.db.name); // "other"
```

### Deep Freeze

```javascript
function deepFreeze(obj) {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = obj[key];
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

const config = deepFreeze({
  host: "localhost",
  db: { name: "mydb" }
});

config.db.name = "other"; // silently fails -- frozen deeply
```

### Immutable Updates with Spread

```javascript
// Updating objects
const user = { name: "Alice", age: 25, address: { city: "NYC" } };

const updated = {
  ...user,
  age: 26,
  address: { ...user.address, city: "LA" }
};

// Updating arrays
const items = [1, 2, 3, 4, 5];

const appended = [...items, 6];
const prepended = [0, ...items];
const removed = items.filter((_, i) => i !== 2);    // remove index 2
const replaced = items.map((v, i) => i === 2 ? 99 : v); // replace index 2
const inserted = [...items.slice(0, 2), 99, ...items.slice(2)];
```

### structuredClone (Deep Copy)

```javascript
// structuredClone -- built-in deep clone (Node 17+, modern browsers)
const original = {
  name: "Alice",
  date: new Date(),
  nested: { scores: [1, 2, 3] },
  regex: /test/gi,
  map: new Map([["key", "value"]])
};

const clone = structuredClone(original);
clone.nested.scores.push(4);

console.log(original.nested.scores); // [1, 2, 3] -- untouched
console.log(clone.nested.scores);    // [1, 2, 3, 4]

// Limitations:
// - Cannot clone functions
// - Cannot clone DOM nodes
// - Cannot clone symbols
// - Prototype chain is not preserved
```

### Immutable Update Patterns for Nested State

```javascript
// Deeply nested update helper
function updateIn(obj, path, updater) {
  const [head, ...tail] = path;
  if (tail.length === 0) {
    return { ...obj, [head]: updater(obj[head]) };
  }
  return { ...obj, [head]: updateIn(obj[head], tail, updater) };
}

const state = {
  users: {
    alice: { profile: { score: 10 } }
  }
};

const newState = updateIn(state, ["users", "alice", "profile", "score"], s => s + 1);
// state.users.alice.profile.score is still 10
// newState.users.alice.profile.score is 11
```

> **Interview Tip:** Mention that structural sharing (used by libraries like Immer and Immutable.js) makes immutable updates efficient by reusing unchanged subtrees, avoiding full deep copies.

---

## Functors

A **functor** is any type that implements a `map` method obeying two laws: identity and composition.

### Functor Laws

```javascript
// Identity law: mapping the identity function returns the same functor
// functor.map(x => x) === functor
[1, 2, 3].map(x => x); // [1, 2, 3]

// Composition law: mapping f then g equals mapping their composition
// functor.map(g).map(f) === functor.map(x => f(g(x)))
[1, 2, 3].map(x => x + 1).map(x => x * 2);
// is equivalent to
[1, 2, 3].map(x => (x + 1) * 2);
```

### Implementing a Box Functor

```javascript
class Box {
  constructor(value) {
    this._value = value;
  }

  map(fn) {
    return new Box(fn(this._value));
  }

  fold(fn) {
    return fn(this._value);
  }

  inspect() {
    return `Box(${JSON.stringify(this._value)})`;
  }
}

const result = new Box(2)
  .map(x => x + 3)      // Box(5)
  .map(x => x * 2)      // Box(10)
  .fold(x => x);         // 10

// Practical: safely chaining transformations
const moneyToFloat = str =>
  new Box(str)
    .map(s => s.replace(/\$/g, ""))
    .map(parseFloat)
    .fold(n => n);

moneyToFloat("$5.99"); // 5.99
```

### Arrays as Functors

```javascript
// Array is the most common functor in JS
const users = [
  { name: "Alice", age: 25 },
  { name: "Bob", age: 30 }
];

const names = users
  .map(u => u.name)           // ["Alice", "Bob"]
  .map(n => n.toUpperCase()); // ["ALICE", "BOB"]
```

---

## Monads (Maybe, Either, Result)

A **monad** is a functor that also implements `flatMap` (also called `chain` or `bind`). It allows sequencing operations that each return a wrapped value, avoiding nested wrappers.

### Monad Laws

```javascript
// 1. Left identity:  M.of(a).flatMap(f) === f(a)
// 2. Right identity: m.flatMap(M.of) === m
// 3. Associativity:  m.flatMap(f).flatMap(g) === m.flatMap(x => f(x).flatMap(g))
```

### Maybe Monad (handles null/undefined)

```javascript
class Maybe {
  constructor(value) {
    this._value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  get isNothing() {
    return this._value === null || this._value === undefined;
  }

  map(fn) {
    return this.isNothing ? this : Maybe.of(fn(this._value));
  }

  flatMap(fn) {
    return this.isNothing ? this : fn(this._value);
  }

  getOrElse(defaultValue) {
    return this.isNothing ? defaultValue : this._value;
  }

  filter(pred) {
    if (this.isNothing) return this;
    return pred(this._value) ? this : Maybe.of(null);
  }

  inspect() {
    return this.isNothing ? "Nothing" : `Just(${JSON.stringify(this._value)})`;
  }
}

// Safely accessing deeply nested properties
function safeProp(key, obj) {
  return Maybe.of(obj[key]);
}

const user = { profile: { address: { city: "NYC" } } };

const city = Maybe.of(user)
  .flatMap(u => safeProp("profile", u))
  .flatMap(p => safeProp("address", p))
  .flatMap(a => safeProp("city", a))
  .getOrElse("Unknown");

console.log(city); // "NYC"

const missing = Maybe.of({})
  .flatMap(u => safeProp("profile", u))
  .flatMap(p => safeProp("address", p))
  .flatMap(a => safeProp("city", a))
  .getOrElse("Unknown");

console.log(missing); // "Unknown" -- no errors thrown
```

### Either Monad (handles errors with context)

```javascript
class Left {
  constructor(value) {
    this._value = value;
  }
  map(_fn) { return this; }
  flatMap(_fn) { return this; }
  fold(leftFn, _rightFn) { return leftFn(this._value); }
  inspect() { return `Left(${JSON.stringify(this._value)})`; }
}

class Right {
  constructor(value) {
    this._value = value;
  }
  map(fn) { return new Right(fn(this._value)); }
  flatMap(fn) { return fn(this._value); }
  fold(_leftFn, rightFn) { return rightFn(this._value); }
  inspect() { return `Right(${JSON.stringify(this._value)})`; }
}

// Helper constructors
const left = value => new Left(value);
const right = value => new Right(value);

// tryCatch wraps throwing functions
function tryCatch(fn) {
  try {
    return right(fn());
  } catch (e) {
    return left(e.message);
  }
}

// Practical example: validation pipeline
function parseJSON(str) {
  return tryCatch(() => JSON.parse(str));
}

function validateAge(obj) {
  return obj.age >= 18
    ? right(obj)
    : left("Must be 18 or older");
}

function validateEmail(obj) {
  return obj.email.includes("@")
    ? right(obj)
    : left("Invalid email");
}

const result = parseJSON('{"age": 25, "email": "a@b.com"}')
  .flatMap(validateAge)
  .flatMap(validateEmail)
  .fold(
    err => ({ success: false, error: err }),
    user => ({ success: true, user })
  );

console.log(result);
// { success: true, user: { age: 25, email: "a@b.com" } }
```

### Result Pattern (TypeScript-friendly)

```javascript
// A simpler Result pattern often used in Node.js
class Result {
  constructor(ok, value, error) {
    this._ok = ok;
    this._value = value;
    this._error = error;
  }

  static ok(value) { return new Result(true, value, null); }
  static err(error) { return new Result(false, null, error); }

  get isOk() { return this._ok; }
  get isErr() { return !this._ok; }

  map(fn) {
    return this._ok ? Result.ok(fn(this._value)) : this;
  }

  flatMap(fn) {
    return this._ok ? fn(this._value) : this;
  }

  mapErr(fn) {
    return this._ok ? this : Result.err(fn(this._error));
  }

  unwrap() {
    if (this._ok) return this._value;
    throw new Error(`Unwrap called on Err: ${this._error}`);
  }

  unwrapOr(defaultValue) {
    return this._ok ? this._value : defaultValue;
  }

  match({ ok, err }) {
    return this._ok ? ok(this._value) : err(this._error);
  }
}

// Usage
function divide(a, b) {
  return b === 0
    ? Result.err("Division by zero")
    : Result.ok(a / b);
}

const answer = divide(10, 2)
  .map(n => n * 3)
  .match({
    ok: val => `Result: ${val}`,
    err: msg => `Error: ${msg}`
  });

console.log(answer); // "Result: 15"
```

---

## Memoization

**Memoization** caches the results of pure function calls to avoid redundant computation.

### Basic Memoize

```javascript
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n) => {
  console.log("Computing...");
  return n * n;
});

expensiveCalc(5); // Computing... -> 25
expensiveCalc(5); // -> 25 (cached, no log)
```

### Memoize with LRU Eviction

```javascript
function memoizeLRU(fn, maxSize = 100) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      // Move to end (most recently used)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    // Evict oldest entry if over limit
    if (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    return result;
  };
}
```

### Memoize Async Functions

```javascript
function memoizeAsync(fn, ttlMs = 60000) {
  const cache = new Map();

  return async function (...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.value;
    }

    const value = await fn.apply(this, args);
    cache.set(key, { value, timestamp: Date.now() });
    return value;
  };
}

const fetchUser = memoizeAsync(async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}, 30000); // 30-second TTL
```

### WeakMap-based Memoization (for Object Keys)

```javascript
function memoizeByRef(fn) {
  const cache = new WeakMap();
  return function (obj) {
    if (cache.has(obj)) return cache.get(obj);
    const result = fn(obj);
    cache.set(obj, result);
    return result;
  };
}

// Objects are garbage collected when no longer referenced
const getSize = memoizeByRef(obj => JSON.stringify(obj).length);
```

> **Interview Tip:** Always mention that memoization only works correctly with pure functions. For impure functions (DB calls, API calls), you need TTL-based caching, not true memoization.

---

## Lazy Evaluation with Generators

**Lazy evaluation** defers computation until the value is actually needed. Generators are JavaScript's built-in mechanism for this.

### Lazy Sequences

```javascript
// Eager: processes ALL elements immediately
const eagerResult = [1, 2, 3, 4, 5]
  .map(x => x * 2)     // creates full intermediate array
  .filter(x => x > 4)  // creates full intermediate array
  .slice(0, 2);         // only need 2!

// Lazy: processes elements on demand
function* lazyMap(iterable, fn) {
  for (const item of iterable) {
    yield fn(item);
  }
}

function* lazyFilter(iterable, pred) {
  for (const item of iterable) {
    if (pred(item)) yield item;
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

// Processes only as many elements as needed
const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const mapped = lazyMap(source, x => x * 2);
const filtered = lazyFilter(mapped, x => x > 4);
const result = [...lazyTake(filtered, 2)];
// [6, 8] -- only processed elements 1-4
```

### Infinite Sequences

```javascript
function* naturals(start = 1) {
  let n = start;
  while (true) {
    yield n++;
  }
}

function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Take first 10 Fibonacci numbers
const firstTenFib = [...lazyTake(fibonacci(), 10)];
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

// Find first 5 primes above 1000
function* primes() {
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  }
  for (const n of naturals(2)) {
    if (isPrime(n)) yield n;
  }
}

const largePrimes = [...lazyTake(
  lazyFilter(primes(), p => p > 1000),
  5
)];
// [1009, 1013, 1019, 1021, 1031]
```

### Lazy Pipeline Builder

```javascript
class LazyPipeline {
  constructor(iterable) {
    this._iterable = iterable;
  }

  static from(iterable) {
    return new LazyPipeline(iterable);
  }

  map(fn) {
    return new LazyPipeline(lazyMap(this._iterable, fn));
  }

  filter(pred) {
    return new LazyPipeline(lazyFilter(this._iterable, pred));
  }

  take(n) {
    return new LazyPipeline(lazyTake(this._iterable, n));
  }

  toArray() {
    return [...this._iterable];
  }

  reduce(fn, init) {
    let acc = init;
    for (const item of this._iterable) {
      acc = fn(acc, item);
    }
    return acc;
  }
}

const result = LazyPipeline.from(naturals())
  .map(n => n * n)
  .filter(n => n % 2 === 0)
  .take(5)
  .toArray();
// [4, 16, 36, 64, 100]
```

---

## Transducers

**Transducers** are composable transformation pipelines that are independent of the input/output data structure. They eliminate intermediate collections.

### The Problem Transducers Solve

```javascript
// This creates 3 intermediate arrays
const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .filter(x => x % 2 === 0)   // intermediate array 1
  .map(x => x * 3)             // intermediate array 2
  .filter(x => x > 10);        // intermediate array 3
// For large datasets this wastes memory and time
```

### Building Transducers

```javascript
// A transducer is a function that takes a reducer and returns a reducer
// reducer signature: (accumulator, value) => accumulator

// Transducer-compatible map
const tMap = (fn) => (nextReducer) => (acc, val) =>
  nextReducer(acc, fn(val));

// Transducer-compatible filter
const tFilter = (pred) => (nextReducer) => (acc, val) =>
  pred(val) ? nextReducer(acc, val) : acc;

// Transducer-compatible take
const tTake = (n) => (nextReducer) => {
  let taken = 0;
  return (acc, val) => {
    if (taken >= n) return acc; // short-circuit
    taken++;
    return nextReducer(acc, val);
  };
};

// Compose transducers (note: left-to-right, unlike regular compose)
function composeTransducers(...xfs) {
  return (reducer) => xfs.reduceRight((r, xf) => xf(r), reducer);
}

// Usage
const xform = composeTransducers(
  tFilter(x => x % 2 === 0),
  tMap(x => x * 3),
  tFilter(x => x > 10)
);

// Apply to array
const concatReducer = (arr, val) => { arr.push(val); return arr; };
const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .reduce(xform(concatReducer), []);
// [12, 18, 24, 30] -- single pass, no intermediate arrays

// Apply to sum instead (same transducer, different reducer!)
const sumReducer = (sum, val) => sum + val;
const total = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .reduce(xform(sumReducer), 0);
// 84
```

> **Interview Tip:** Transducers are an advanced topic. Showing awareness of them demonstrates deep FP knowledge. The key insight is that transducers decouple "what transformation" from "what data structure," enabling single-pass processing over any reducible source.

---

## Point-Free Style

**Point-free** (or tacit) programming defines functions without explicitly mentioning their arguments.

### Examples

```javascript
// Pointed (explicitly names the argument)
const getNames = users => users.map(user => user.name);

// Point-free
const prop = key => obj => obj[key];
const map = fn => arr => arr.map(fn);
const getNames = map(prop("name"));

// More examples
// Pointed
const isEven = n => n % 2 === 0;
const getEvens = arr => arr.filter(n => n % 2 === 0);

// Point-free
const getEvens = filter(isEven);

// Pointed
const sum = arr => arr.reduce((a, b) => a + b, 0);
const doubleAndSum = arr => sum(arr.map(n => n * 2));

// Point-free
const add = (a, b) => a + b;
const double = n => n * 2;
const doubleAndSum = pipe(map(double), reduce(add, 0));
```

### When Point-Free Helps and When It Hurts

```javascript
// Good: simple, readable composition
const processName = pipe(trim, toLower, capitalize);

// Good: reusable predicate composition
const not = fn => (...args) => !fn(...args);
const isOdd = not(isEven);

// Bad: overly clever, hard to read
const sumOfEvensSquared = pipe(
  filter(pipe(modulo(2), equals(0))),
  map(pipe(duplicate, multiply)),
  reduce(add, 0)
);

// Better: mix styles for clarity
const sumOfEvensSquared = pipe(
  filter(n => n % 2 === 0),
  map(n => n * n),
  reduce(add, 0)
);
```

> **Interview Tip:** Point-free style is a tool, not a goal. Use it where it improves readability (simple compositions, predicate logic). Drop it when it makes code cryptic. Pragmatic FP is about choosing the clearest approach.

---

## FP Error Handling Patterns

### Railway-Oriented Programming

```javascript
// Each function returns Either (Right for success, Left for error)
// The "railway" switches to the error track on first failure

function validateName(input) {
  return input.name && input.name.length >= 2
    ? right(input)
    : left("Name must be at least 2 characters");
}

function validateEmail(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
    ? right(input)
    : left("Invalid email format");
}

function validateAge(input) {
  return input.age >= 18
    ? right(input)
    : left("Must be 18 or older");
}

// Chain validations -- first failure short-circuits
function validateRegistration(input) {
  return right(input)
    .flatMap(validateName)
    .flatMap(validateEmail)
    .flatMap(validateAge);
}

validateRegistration({ name: "A", email: "bad", age: 15 });
// Left("Name must be at least 2 characters")

validateRegistration({ name: "Alice", email: "a@b.com", age: 25 });
// Right({ name: "Alice", email: "a@b.com", age: 25 })
```

### Collecting All Errors (Validation Applicative)

```javascript
function validateAll(input, validators) {
  const errors = [];
  for (const validator of validators) {
    const result = validator(input);
    if (result.isErr) {
      errors.push(result._error);
    }
  }
  return errors.length > 0
    ? Result.err(errors)
    : Result.ok(input);
}

const checkName = input =>
  input.name?.length >= 2 ? Result.ok(input) : Result.err("Name too short");

const checkEmail = input =>
  input.email?.includes("@") ? Result.ok(input) : Result.err("Invalid email");

const checkAge = input =>
  input.age >= 18 ? Result.ok(input) : Result.err("Too young");

validateAll(
  { name: "A", email: "bad", age: 15 },
  [checkName, checkEmail, checkAge]
);
// Err(["Name too short", "Invalid email", "Too young"])
```

### Option/Nullable Chaining (Native JS)

```javascript
// JavaScript's optional chaining IS a Maybe monad in disguise
const city = user?.profile?.address?.city ?? "Unknown";

// Nullish coalescing with functional style
const getCity = pipe(
  user => user?.profile,
  profile => profile?.address,
  address => address?.city ?? "Unknown"
);
```

---

## Data Pipelines

### ETL Pipeline with FP

```javascript
// Extract-Transform-Load pipeline using functional composition
const processCSVData = pipe(
  // Extract
  readCSVLines,

  // Transform
  filter(line => line.trim() !== ""),           // remove blanks
  map(line => line.split(",")),                 // parse CSV
  filter(([name]) => name !== "header"),        // skip header
  map(([name, age, email]) => ({               // structure
    name: name.trim(),
    age: parseInt(age, 10),
    email: email.trim().toLowerCase()
  })),
  filter(user => !isNaN(user.age)),            // validate
  map(user => ({
    ...user,
    ageGroup: user.age < 30 ? "young" : "senior"
  })),

  // Load
  groupBy(user => user.ageGroup)
);

// Utility: groupBy as a pure function
function groupBy(keyFn) {
  return function (items) {
    return items.reduce((groups, item) => {
      const key = keyFn(item);
      return {
        ...groups,
        [key]: [...(groups[key] || []), item]
      };
    }, {});
  };
}
```

### Streaming Pipeline (Node.js)

```javascript
import { Transform, pipeline } from "node:stream";
import { promisify } from "node:util";

const pipelineAsync = promisify(pipeline);

// Functional transform factory
function mapStream(fn) {
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      try {
        callback(null, fn(chunk));
      } catch (err) {
        callback(err);
      }
    }
  });
}

function filterStream(pred) {
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      if (pred(chunk)) {
        callback(null, chunk);
      } else {
        callback(); // skip without error
      }
    }
  });
}

// Usage: streaming FP pipeline
await pipelineAsync(
  readStream,
  mapStream(JSON.parse),
  filterStream(record => record.status === "active"),
  mapStream(record => ({ ...record, processed: true })),
  writeStream
);
```

### Async Data Pipeline

```javascript
// Composable async pipeline steps
const asyncPipe = (...fns) => input =>
  fns.reduce((chain, fn) => chain.then(fn), Promise.resolve(input));

const processOrder = asyncPipe(
  async (orderId) => {
    const order = await db.orders.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  },
  async (order) => {
    const items = await db.items.findByIds(order.itemIds);
    return { ...order, items };
  },
  (order) => ({
    ...order,
    total: order.items.reduce((sum, item) => sum + item.price, 0)
  }),
  async (order) => {
    if (order.total > 100) {
      order.discount = order.total * 0.1;
      order.total -= order.discount;
    }
    return order;
  },
  async (order) => {
    await db.orders.update(order.id, order);
    await emailService.sendConfirmation(order);
    return order;
  }
);

const processed = await processOrder("order-123");
```

---

## Interview Tips and Key Takeaways

1. **Start with pure functions:** In any FP discussion, anchor your answer to purity -- it enables everything else (composition, memoization, testing, parallelism).

2. **Know the tradeoffs:** FP is not always better. Immutable updates create garbage-collection pressure. Over-abstracting with monads can hurt readability. Be pragmatic.

3. **Real-world FP in Node.js:** Stream pipelines, Express/Koa middleware, Redux reducers, validation chains, and data transformation pipelines are all FP in practice.

4. **Libraries to mention:** Ramda (FP utility library), fp-ts (TypeScript FP), Immer (immutable state), RxJS (reactive/functional streams).

5. **When asked "What is a monad?":** A monad is a design pattern for chaining operations on wrapped values. It needs `of` (to wrap a value) and `flatMap` (to chain operations that return wrapped values). `Promise` is essentially a monad (`.then` is `flatMap`).

6. **Functional core, imperative shell:** The most practical architecture pattern for FP in Node.js. Pure business logic in the core, side effects pushed to the edges.

7. **Performance awareness:** `map().filter().reduce()` creates intermediate arrays. For large data, use transducers, lazy generators, or streams.

---

## Quick Reference / Cheat Sheet

| Concept              | What It Does                                  | Key Method / Pattern         |
|----------------------|-----------------------------------------------|------------------------------|
| Pure Function        | Same input = same output, no side effects     | All dependencies as params   |
| Higher-Order Fn      | Takes/returns functions                       | `map`, `filter`, `reduce`    |
| Composition          | Combine small functions into larger ones       | `pipe(f, g, h)(x)`          |
| Currying             | `f(a,b,c)` -> `f(a)(b)(c)`                   | `curry(fn)`                  |
| Partial Application  | Fix some arguments upfront                    | `fn.bind(null, arg1)`       |
| Immutability         | Never mutate, always copy                     | Spread, `structuredClone`    |
| Functor              | Mappable container                            | `.map(fn)`                   |
| Monad                | Chainable container (flatMap)                 | `.flatMap(fn)`               |
| Maybe                | Handles null safely                           | `Maybe.of(x).map(fn)`       |
| Either               | Error with context                            | `Left(err)` / `Right(val)`  |
| Memoization          | Cache pure function results                   | `memoize(fn)`                |
| Lazy Evaluation      | Compute on demand                             | Generators (`function*`)     |
| Transducers          | Composable reducers, no intermediates         | `tMap(fn)(reducer)`          |
| Point-Free           | Define functions without naming arguments     | `pipe(map(double), sum)`     |

### Common FP Conversions

```javascript
// Imperative -> Functional
// Before:
let result = [];
for (let i = 0; i < arr.length; i++) {
  if (arr[i] > 10) {
    result.push(arr[i] * 2);
  }
}

// After:
const result = arr
  .filter(x => x > 10)
  .map(x => x * 2);

// Nested ifs -> Railway (Either/Result chain)
// Try/catch -> tryCatch returning Either
// Null checks -> Maybe or optional chaining
// for loops -> map/filter/reduce
// Mutable accumulator -> reduce
// Shared state -> pure functions with explicit params
```
