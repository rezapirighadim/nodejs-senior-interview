# JavaScript Fundamentals -- Senior Interview Reference

## Table of Contents

- [Primitive vs Reference Types](#primitive-vs-reference-types)
- [Type Coercion](#type-coercion)
- [Variable Declarations: var, let, const](#variable-declarations-var-let-const)
- [Hoisting](#hoisting)
- [Closures](#closures)
- [Prototypes and the Prototype Chain](#prototypes-and-the-prototype-chain)
- [ES6+ Features](#es6-features)
- [Destructuring](#destructuring)
- [Spread and Rest Operators](#spread-and-rest-operators)
- [Map, Set, WeakMap, WeakSet](#map-set-weakmap-weakset)
- [Symbols](#symbols)
- [Error Handling](#error-handling)
- [Common Gotchas](#common-gotchas)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Primitive vs Reference Types

JavaScript has **7 primitive types** and **1 structural (reference) type**.

### Primitive Types

Primitives are immutable, stored on the stack, and compared by value.

| Type        | `typeof` Result | Example                |
|-------------|-----------------|------------------------|
| `string`    | `"string"`      | `"hello"`              |
| `number`    | `"number"`      | `42`, `3.14`, `NaN`    |
| `bigint`    | `"bigint"`      | `9007199254740991n`    |
| `boolean`   | `"boolean"`     | `true`, `false`        |
| `undefined` | `"undefined"`   | `undefined`            |
| `null`      | `"object"` (!)  | `null`                 |
| `symbol`    | `"symbol"`      | `Symbol("id")`        |

> **Gotcha:** `typeof null === "object"` is a legacy bug from the first JS implementation. It was never fixed to preserve backward compatibility.

### Reference Types

Reference types are mutable, stored on the heap, and compared by reference.

```javascript
// Primitives -- compared by value
let a = 10;
let b = 10;
console.log(a === b); // true

// References -- compared by reference (memory address)
let obj1 = { name: "Alice" };
let obj2 = { name: "Alice" };
console.log(obj1 === obj2); // false (different references)

let obj3 = obj1;
console.log(obj1 === obj3); // true (same reference)
```

### Pass-by-Value vs Pass-by-Reference

```javascript
// Primitives are passed by value (a copy is made)
function increment(num) {
  num++;
  return num;
}
let x = 5;
increment(x);
console.log(x); // 5 -- unchanged

// Objects are passed by sharing (the reference is copied)
function rename(user) {
  user.name = "Bob"; // mutates the original
}
let user = { name: "Alice" };
rename(user);
console.log(user.name); // "Bob" -- changed

// But reassigning the parameter does NOT affect the original
function replace(user) {
  user = { name: "Charlie" }; // local reassignment only
}
replace(user);
console.log(user.name); // "Bob" -- still Bob
```

---

## Type Coercion

JavaScript performs implicit type conversions in many contexts.

### `==` vs `===` Comparison

| Expression            | `==`    | `===`   | Explanation                              |
|-----------------------|---------|---------|------------------------------------------|
| `0 == ""`             | `true`  | `false` | Both coerce to `0`                       |
| `0 == "0"`            | `true`  | `false` | `"0"` coerces to `0`                     |
| `"" == "0"`           | `false` | `false` | No numeric coercion for two strings      |
| `false == "false"`    | `false` | `false` | `false` -> `0`, `"false"` -> `NaN`      |
| `false == "0"`        | `true`  | `false` | `false` -> `0`, `"0"` -> `0`            |
| `false == null`       | `false` | `false` | `null` only `==` to `null`/`undefined`   |
| `false == undefined`  | `false` | `false` | Same as above                            |
| `null == undefined`   | `true`  | `false` | Special rule in the spec                 |
| `NaN == NaN`          | `false` | `false` | `NaN` is not equal to anything           |

> **Rule of thumb:** Always use `===` unless you have a deliberate reason to use `==` (e.g., `value == null` to check both `null` and `undefined`).

### Implicit Coercion Rules

```javascript
// String coercion (+ with a string operand)
console.log(1 + "2");         // "12"
console.log("3" + 4);         // "34"
console.log(1 + 2 + "3");    // "33" (left-to-right: 3 + "3")

// Numeric coercion (-, *, /, and unary +)
console.log("6" - 1);         // 5
console.log("3" * "2");       // 6
console.log(+"42");           // 42
console.log(+true);           // 1
console.log(+false);          // 0
console.log(+"");             // 0
console.log(+null);           // 0
console.log(+undefined);      // NaN

// Boolean coercion
// Falsy values: false, 0, -0, 0n, "", null, undefined, NaN
// Everything else is truthy (including "0", "false", [], {})
console.log(Boolean([]));     // true  (!)
console.log(Boolean({}));     // true
console.log(Boolean("0"));   // true  (!)
```

### Object-to-Primitive Coercion

```javascript
const obj = {
  valueOf()  { return 42; },
  toString() { return "hello"; },
  [Symbol.toPrimitive](hint) {
    if (hint === "number")  return 42;
    if (hint === "string")  return "hello";
    return true; // "default" hint
  }
};

console.log(+obj);          // 42      (hint: "number")
console.log(`${obj}`);      // "hello" (hint: "string")
console.log(obj + "");      // "true"  (hint: "default")
```

---

## Variable Declarations: var, let, const

### Comparison Table

| Feature            | `var`                  | `let`                  | `const`                |
|--------------------|------------------------|------------------------|------------------------|
| Scope              | Function-scoped        | Block-scoped           | Block-scoped           |
| Hoisting           | Yes (initialized to `undefined`) | Yes (TDZ)     | Yes (TDZ)              |
| Re-declaration     | Allowed                | Not allowed            | Not allowed            |
| Re-assignment      | Allowed                | Allowed                | Not allowed            |
| Global object prop | Yes (`window.x`)       | No                     | No                     |
| TDZ                | No                     | Yes                    | Yes                    |

> **TDZ (Temporal Dead Zone):** The period between entering a scope and the variable's declaration being evaluated. Accessing the variable during TDZ throws a `ReferenceError`.

```javascript
// var is function-scoped
function example() {
  if (true) {
    var x = 10;
  }
  console.log(x); // 10 -- accessible outside the block
}

// let/const are block-scoped
function example2() {
  if (true) {
    let y = 20;
    const z = 30;
  }
  // console.log(y); // ReferenceError
  // console.log(z); // ReferenceError
}

// const does NOT mean immutable -- it means the binding cannot be reassigned
const arr = [1, 2, 3];
arr.push(4);          // Allowed -- mutating the array
// arr = [5, 6, 7];   // TypeError -- reassigning the binding
```

### Loop Behavior

```javascript
// Classic interview question: var in a loop
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Prints: 3, 3, 3 (all share the same `i`)

// Fix with let
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Prints: 0, 1, 2 (each iteration gets its own `i`)

// Fix with IIFE (pre-ES6)
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 100);
  })(i);
}
// Prints: 0, 1, 2
```

---

## Hoisting

Hoisting moves **declarations** (not initializations) to the top of their scope during the compilation phase.

```javascript
// What you write:
console.log(x);     // undefined (var is hoisted and initialized to undefined)
var x = 5;

// How the engine interprets it:
var x;              // declaration hoisted
console.log(x);     // undefined
x = 5;              // assignment stays in place

// Function declarations are fully hoisted
sayHello();         // "Hello!" -- works
function sayHello() {
  console.log("Hello!");
}

// Function expressions are NOT fully hoisted
// sayGoodbye();    // TypeError: sayGoodbye is not a function
var sayGoodbye = function() {
  console.log("Goodbye!");
};

// let/const hoist but enter TDZ
// console.log(a);  // ReferenceError: Cannot access 'a' before initialization
let a = 10;
```

### Hoisting Priority

When there are naming conflicts, the priority is:

1. Function parameters
2. Function declarations (override parameters)
3. Variable declarations (do NOT override existing bindings)

```javascript
function test(a) {
  console.log(a);       // [Function: a]
  function a() {}       // function declaration overrides parameter
  var a;                // var declaration does NOT override
  console.log(a);       // [Function: a]
}
test(42);
```

---

## Closures

A closure is a function that retains access to its lexical scope, even after the outer function has returned.

```javascript
function createCounter(initialValue = 0) {
  let count = initialValue; // enclosed variable

  return {
    increment() { return ++count; },
    decrement() { return --count; },
    getCount()  { return count; },
  };
}

const counter = createCounter(10);
console.log(counter.increment()); // 11
console.log(counter.increment()); // 12
console.log(counter.getCount());  // 12
// `count` is not accessible from outside -- true encapsulation
```

### Practical Uses of Closures

```javascript
// 1. Data privacy / encapsulation
function createBankAccount(initialBalance) {
  let balance = initialBalance;

  return {
    deposit(amount) {
      if (amount <= 0) throw new Error("Invalid amount");
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) throw new Error("Insufficient funds");
      balance -= amount;
      return balance;
    },
    getBalance() { return balance; },
  };
}

// 2. Function factories
function multiplier(factor) {
  return (number) => number * factor;
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5)); // 10
console.log(triple(5)); // 15

// 3. Memoization
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
expensiveCalc(5); // "Computing..." -> 25
expensiveCalc(5); // 25 (cached, no log)
```

### Closure Pitfalls

```javascript
// Stale closures in React-like scenarios
function createHandlers() {
  let value = "initial";

  const getValue = () => value; // captures `value` by reference

  value = "updated";

  return getValue();
}
console.log(createHandlers()); // "updated" -- not "initial"

// Closures and memory leaks
function leakySetup() {
  const largeData = new Array(1_000_000).fill("x");
  return function () {
    // Even if we don't use largeData, the closure retains it
    // V8 is smart about this in many cases, but be cautious
    console.log("handler called");
  };
}
```

---

## Prototypes and the Prototype Chain

Every JavaScript object has an internal `[[Prototype]]` link to another object, forming a chain.

```javascript
// Prototype chain visualization
const animal = {
  alive: true,
  eat() { console.log("Eating..."); }
};

const dog = Object.create(animal);
dog.bark = function () { console.log("Woof!"); };

const puppy = Object.create(dog);
puppy.cute = true;

// puppy -> dog -> animal -> Object.prototype -> null

console.log(puppy.cute);   // true (own property)
console.log(puppy.bark);   // [Function] (from dog)
console.log(puppy.alive);  // true (from animal)
console.log(puppy.toString); // [Function] (from Object.prototype)
```

### Constructor Functions and `new`

```javascript
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};

const alice = new Person("Alice", 30);
console.log(alice.greet()); // "Hi, I'm Alice"

// What `new` does internally:
// 1. Creates a new empty object: {}
// 2. Sets its [[Prototype]] to Person.prototype
// 3. Executes the constructor with `this` bound to the new object
// 4. Returns the object (unless the constructor returns a different object)
```

### ES6 Classes (Syntactic Sugar)

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name} makes a sound.`;
  }
}

class Dog extends Animal {
  speak() {
    return `${this.name} barks.`;
  }
}

const d = new Dog("Rex");
console.log(d.speak()); // "Rex barks."

// Under the hood, this is still prototypal inheritance:
console.log(d.__proto__ === Dog.prototype);        // true
console.log(Dog.prototype.__proto__ === Animal.prototype); // true
```

---

## ES6+ Features

### Arrow Functions

```javascript
// Concise syntax
const add = (a, b) => a + b;
const square = x => x * x;
const getObj = () => ({ key: "value" }); // wrap in parens for object literal

// Key difference: arrow functions do NOT have their own `this`
const obj = {
  name: "Alice",
  regularMethod() {
    console.log(this.name); // "Alice"
    setTimeout(function () {
      console.log(this.name); // undefined (or global in non-strict)
    }, 100);
    setTimeout(() => {
      console.log(this.name); // "Alice" (inherits from enclosing scope)
    }, 100);
  }
};

// Arrow functions also lack: arguments, super, new.target
// They cannot be used as constructors (no `new`)
```

### Template Literals

```javascript
const name = "World";
console.log(`Hello, ${name}!`);

// Multi-line strings
const html = `
  <div>
    <h1>${name}</h1>
  </div>
`;

// Tagged templates
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? `<b>${values[i]}</b>` : "");
  }, "");
}

const user = "Alice";
const role = "admin";
console.log(highlight`User ${user} has role ${role}`);
// "User <b>Alice</b> has role <b>admin</b>"
```

### Optional Chaining and Nullish Coalescing

```javascript
const user = {
  address: {
    street: "123 Main St",
  },
};

// Optional chaining (?.)
console.log(user?.address?.street);    // "123 Main St"
console.log(user?.phone?.number);      // undefined (no error)
console.log(user?.getAddress?.());     // undefined (safe method call)
console.log(user?.friends?.[0]);       // undefined (safe array access)

// Nullish coalescing (??)
// Only triggers on null/undefined (NOT on 0, "", false)
const port = 0;
console.log(port || 3000);  // 3000  (0 is falsy)
console.log(port ?? 3000);  // 0     (0 is not null/undefined)

const name = "";
console.log(name || "Anonymous");  // "Anonymous"
console.log(name ?? "Anonymous");  // ""
```

### Other Notable ES6+ Features

```javascript
// for...of (iterates values)
for (const item of [1, 2, 3]) { /* ... */ }

// Object.entries / Object.fromEntries
const obj = { a: 1, b: 2 };
const entries = Object.entries(obj); // [["a",1],["b",2]]
const back = Object.fromEntries(entries); // { a: 1, b: 2 }

// Array.prototype.at()
const arr = [1, 2, 3, 4, 5];
console.log(arr.at(-1)); // 5

// structuredClone (deep clone)
const original = { nested: { value: 42 } };
const clone = structuredClone(original);
clone.nested.value = 99;
console.log(original.nested.value); // 42

// Object.hasOwn (replaces hasOwnProperty)
console.log(Object.hasOwn(obj, "a")); // true

// Logical assignment operators
let a = null;
a ??= "default";  // a = "default"
let b = "";
b ||= "fallback"; // b = "fallback"
let c = 1;
c &&= 2;          // c = 2
```

---

## Destructuring

### Array Destructuring

```javascript
const [first, second, ...rest] = [1, 2, 3, 4, 5];
console.log(first); // 1
console.log(rest);  // [3, 4, 5]

// Skipping elements
const [, , third] = [1, 2, 3];
console.log(third); // 3

// Default values
const [a = 10, b = 20] = [1];
console.log(a, b); // 1, 20

// Swapping
let x = 1, y = 2;
[x, y] = [y, x];
console.log(x, y); // 2, 1

// Nested
const [a1, [b1, b2]] = [1, [2, 3]];
console.log(b2); // 3
```

### Object Destructuring

```javascript
const { name, age, city = "Unknown" } = { name: "Alice", age: 30 };
console.log(name, age, city); // "Alice", 30, "Unknown"

// Renaming
const { name: userName, age: userAge } = { name: "Bob", age: 25 };
console.log(userName); // "Bob"

// Nested destructuring
const {
  address: { street, zip }
} = {
  address: { street: "123 Main", zip: "12345" }
};

// In function parameters
function createUser({ name, age, role = "user" } = {}) {
  return { name, age, role };
}
createUser({ name: "Alice", age: 30 });

// Computed property names
const key = "name";
const { [key]: value } = { name: "Alice" };
console.log(value); // "Alice"
```

---

## Spread and Rest Operators

```javascript
// Spread: expanding iterables
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

// Shallow clone
const original = { a: 1, b: { c: 2 } };
const clone = { ...original };
clone.b.c = 99;
console.log(original.b.c); // 99 -- shallow clone, nested refs shared

// Merging objects (later properties win)
const defaults = { theme: "light", lang: "en", debug: false };
const userPrefs = { theme: "dark", debug: true };
const config = { ...defaults, ...userPrefs };
// { theme: "dark", lang: "en", debug: true }

// Rest: collecting remaining elements
function sum(...numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
console.log(sum(1, 2, 3, 4)); // 10

// Rest in destructuring
const { a, ...remaining } = { a: 1, b: 2, c: 3 };
console.log(remaining); // { b: 2, c: 3 }
```

---

## Map, Set, WeakMap, WeakSet

### Comparison Table

| Feature            | `Object`      | `Map`              | `WeakMap`          |
|--------------------|---------------|--------------------|--------------------|
| Key types          | String/Symbol | Any value          | Objects only       |
| Key order          | Insertion*    | Insertion          | N/A                |
| Size               | Manual        | `.size`            | N/A                |
| Iterable           | No (by default)| Yes               | No                 |
| GC of keys         | No            | No                 | Yes                |
| Performance        | Good for small| Better for frequent add/remove | Same |

| Feature            | `Array`       | `Set`              | `WeakSet`          |
|--------------------|---------------|--------------------|--------------------|
| Value uniqueness   | No            | Yes                | Yes                |
| Value types        | Any           | Any                | Objects only       |
| Iterable           | Yes           | Yes                | No                 |
| GC of values       | No            | No                 | Yes                |

### Map

```javascript
const map = new Map();

// Any value as key
map.set("string", 1);
map.set(42, 2);
map.set(true, 3);
const objKey = { id: 1 };
map.set(objKey, "found");

console.log(map.get(objKey)); // "found"
console.log(map.size);        // 4
console.log(map.has("string")); // true

// Iteration (maintains insertion order)
for (const [key, value] of map) {
  console.log(key, value);
}

// Conversion
const obj = Object.fromEntries(map); // Map -> Object (string keys only)
const map2 = new Map(Object.entries(obj)); // Object -> Map
```

### Set

```javascript
const set = new Set([1, 2, 3, 3, 2, 1]);
console.log(set.size); // 3
console.log([...set]); // [1, 2, 3]

// Useful operations
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// Union
const union = new Set([...a, ...b]); // {1, 2, 3, 4}

// Intersection
const intersection = new Set([...a].filter(x => b.has(x))); // {2, 3}

// Difference
const difference = new Set([...a].filter(x => !b.has(x))); // {1}

// Deduplicate an array
const unique = [...new Set([1, 1, 2, 3, 3])]; // [1, 2, 3]
```

### WeakMap and WeakSet

```javascript
// WeakMap: keys must be objects, and they are held weakly (GC-friendly)
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = { /* expensive computation */ };
  cache.set(user, result);
  return result;
}

let user = { name: "Alice" };
processUser(user);

user = null; // The WeakMap entry becomes eligible for GC

// WeakSet: same principle for tracking object membership
const visited = new WeakSet();

function visit(node) {
  if (visited.has(node)) return; // prevent cycles
  visited.add(node);
  // process node...
}
```

---

## Symbols

Symbols are unique, immutable identifiers.

```javascript
// Creating symbols
const sym1 = Symbol("description");
const sym2 = Symbol("description");
console.log(sym1 === sym2); // false -- always unique

// Global symbol registry
const globalSym = Symbol.for("shared");
const sameSym = Symbol.for("shared");
console.log(globalSym === sameSym); // true

console.log(Symbol.keyFor(globalSym)); // "shared"

// As object property keys (not enumerable by default methods)
const ID = Symbol("id");
const user = {
  [ID]: 123,
  name: "Alice",
};

console.log(user[ID]);          // 123
console.log(Object.keys(user)); // ["name"] -- Symbol not included
console.log(Object.getOwnPropertySymbols(user)); // [Symbol(id)]

// Well-known symbols
class CustomArray {
  static [Symbol.hasInstance](instance) {
    return Array.isArray(instance);
  }
}
console.log([] instanceof CustomArray); // true

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        return current <= end
          ? { value: current++, done: false }
          : { done: true };
      }
    };
  }
}

for (const n of new Range(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}
```

---

## Error Handling

### Error Types

| Error Type        | When It Occurs                                |
|-------------------|-----------------------------------------------|
| `Error`           | Base error type                               |
| `TypeError`       | Wrong type (e.g., calling non-function)       |
| `ReferenceError`  | Accessing undeclared variable                 |
| `SyntaxError`     | Invalid syntax                                |
| `RangeError`      | Value out of range (e.g., invalid array length)|
| `URIError`        | Malformed URI                                 |
| `EvalError`       | Errors with `eval()` (rarely used)            |
| `AggregateError`  | Multiple errors (e.g., `Promise.any`)         |

### Custom Errors

```javascript
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

class ValidationError extends AppError {
  constructor(field, message) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.field = field;
  }
}

// Usage
try {
  throw new NotFoundError("User");
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(error.statusCode); // 404
    console.log(error.code);       // "NOT_FOUND"
  }
}
```

### try/catch/finally

```javascript
function readConfig(path) {
  let handle;
  try {
    handle = openFile(path);
    return parseJSON(handle.read());
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("Invalid JSON in config");
      return getDefaultConfig();
    }
    throw error; // re-throw unexpected errors
  } finally {
    // ALWAYS runs, even after return or throw
    if (handle) handle.close();
  }
}
```

### Error Handling Best Practices

```javascript
// 1. Distinguish operational vs programmer errors
//    Operational: expected failures (network timeout, file not found)
//    Programmer: bugs (accessing undefined property, type errors)

// 2. Use error codes, not just messages
class DatabaseError extends Error {
  constructor(message, { code, query, params } = {}) {
    super(message);
    this.code = code;       // "UNIQUE_VIOLATION", "CONNECTION_LOST"
    this.query = query;
    this.params = params;
  }
}

// 3. Error cause chaining (ES2022)
try {
  await connectToDatabase();
} catch (error) {
  throw new Error("Service initialization failed", { cause: error });
}

// Accessing the cause
try {
  await initService();
} catch (error) {
  console.log(error.message);       // "Service initialization failed"
  console.log(error.cause.message); // Original DB error message
}
```

---

## Common Gotchas

### 1. `this` Binding

```javascript
const obj = {
  name: "Alice",
  getName: function () { return this.name; },
  getNameArrow: () => this.name, // `this` is NOT obj
};

console.log(obj.getName());      // "Alice"
console.log(obj.getNameArrow()); // undefined (arrow captures outer `this`)

const fn = obj.getName;
console.log(fn()); // undefined (lost `this` context)

// Fixes:
console.log(fn.call(obj));       // "Alice"
console.log(fn.bind(obj)());     // "Alice"
```

### 2. Floating Point Precision

```javascript
console.log(0.1 + 0.2 === 0.3);         // false
console.log(0.1 + 0.2);                  // 0.30000000000000004

// Fix: use epsilon comparison
function areEqual(a, b) {
  return Math.abs(a - b) < Number.EPSILON;
}

// Or work with integers (cents instead of dollars)
const price = 199; // $1.99 in cents
```

### 3. Array and Object Gotchas

```javascript
// typeof for arrays
console.log(typeof []);         // "object"
console.log(Array.isArray([])); // true (correct check)

// Empty array is truthy
if ([]) console.log("truthy!"); // prints

// Array holes
const arr = [1, , 3]; // sparse array
console.log(arr.length); // 3
arr.forEach(x => console.log(x)); // 1, 3 (skips holes)
console.log(arr.map(x => x * 2)); // [2, empty, 6]

// Object property order
// Integer keys first (sorted), then string keys (insertion order), then Symbols
const obj = { b: 1, a: 2, 2: "two", 1: "one", [Symbol()]: "sym" };
console.log(Object.keys(obj)); // ["1", "2", "b", "a"]
```

### 4. parseInt Gotchas

```javascript
console.log(parseInt("08"));      // 8 (was 0 in older engines with octal)
console.log(parseInt("0xF"));     // 15 (hex prefix recognized)
console.log(parseInt("123abc"));  // 123 (parses until invalid char)
console.log(parseInt("abc"));     // NaN

// Always specify radix
console.log(parseInt("08", 10));  // 8

// Fun gotcha
console.log(["1", "2", "3"].map(parseInt));
// [1, NaN, NaN]
// Because map passes (value, index): parseInt("1",0), parseInt("2",1), parseInt("3",2)
// Fix:
console.log(["1", "2", "3"].map(Number)); // [1, 2, 3]
```

---

## Interview Tips and Key Takeaways

1. **Always use `===` over `==`** unless you explicitly want type coercion (e.g., `x == null` to check for null/undefined).
2. **Prefer `const` by default**, use `let` when reassignment is needed, avoid `var`.
3. **Understand closures deeply** -- they are the foundation of data privacy, factory functions, and memoization in JavaScript.
4. **Know the prototype chain** -- even though classes exist, understanding prototypes is essential for debugging and advanced patterns.
5. **Be able to explain `this`** in all contexts: global, method, arrow function, `call/apply/bind`, `new`, event handler.
6. **`typeof null === "object"`** is the most commonly asked gotcha -- know its history.
7. **Map/Set vs Object/Array** -- know when to use each and articulate the performance/ergonomic trade-offs.
8. **WeakMap/WeakSet** for caching and metadata on objects without preventing garbage collection.
9. **Error handling** should be hierarchical with custom error classes in production code.
10. **Immutability awareness** -- know the difference between `Object.freeze()` (shallow), `structuredClone()` (deep clone), and spread (shallow copy).

---

## Quick Reference / Cheat Sheet

```text
TYPES
  Primitives: string, number, bigint, boolean, undefined, null, symbol
  Reference:  object (includes arrays, functions, dates, regex, etc.)

EQUALITY
  ==   loose equality (with coercion)
  ===  strict equality (no coercion)
  Object.is(a, b)  same-value equality (handles NaN, -0)

SCOPE
  var     -> function scope, hoisted (undefined)
  let     -> block scope, TDZ
  const   -> block scope, TDZ, no reassignment

TRUTHY/FALSY
  Falsy:  false, 0, -0, 0n, "", null, undefined, NaN
  Truthy: everything else (including [], {}, "0", "false")

THIS BINDING (priority order)
  1. new            -> newly created object
  2. call/apply/bind -> specified object
  3. obj.method()   -> obj
  4. default        -> undefined (strict) or globalThis (sloppy)
  Arrow functions   -> inherits from enclosing lexical scope

COERCION SHORTCUTS
  +value    -> Number(value)
  value+""  -> String(value)
  !!value   -> Boolean(value)

USEFUL CHECKS
  Array.isArray(x)          -> is array?
  typeof x === "function"   -> is function?
  x == null                 -> is null or undefined?
  Number.isNaN(x)           -> is NaN? (don't use global isNaN)
  Number.isFinite(x)        -> is finite number?
```
