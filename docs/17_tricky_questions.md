# Tricky JavaScript & Node.js Interview Questions

40+ questions that trip up even senior developers, organized by category with code, output, and detailed explanations.

## Table of Contents

- [Type Coercion & Equality (6 Questions)](#type-coercion--equality)
- [Hoisting & Temporal Dead Zone (4 Questions)](#hoisting--temporal-dead-zone)
- [Closures & Scope (5 Questions)](#closures--scope)
- [`this` Binding (5 Questions)](#this-binding)
- [Prototype & Inheritance (4 Questions)](#prototype--inheritance)
- [Async Gotchas (6 Questions)](#async-gotchas)
- [Event Loop Puzzles (4 Questions)](#event-loop-puzzles)
- [Object & Array Tricks (5 Questions)](#object--array-tricks)
- [Comparison & Logic (4 Questions)](#comparison--logic)
- [Node.js Specific (4 Questions)](#nodejs-specific)
- [Key Takeaways](#key-takeaways)

---

## Type Coercion & Equality

### Q1: `[] == ![]` -- Empty Array Equals Not Empty Array?

**Code:**
```javascript
console.log([] == ![]);
```

**Output:**
```
true
```

**Why?**

1. `![]` evaluates first: `[]` is truthy, so `![] === false`
2. Now we have: `[] == false`
3. Abstract equality converts both sides to numbers:
   - `ToNumber(false)` = `0`
   - `ToPrimitive([])` calls `[].toString()` = `""` then `ToNumber("")` = `0`
4. `0 == 0` => `true`

An empty array is truthy, but when compared with `==`, type coercion makes it equal to `false`. This is the most famous JS gotcha.

**Correct way:**
```javascript
console.log([] === ![]); // false -- use strict equality
```

---

### Q2: `{} + []` -- Object Plus Array?

**Code:**
```javascript
// In Node.js console.log:
console.log({} + []);   // "[object Object]"
console.log(({}) + []); // "[object Object]"
```

**Output:**
```
[object Object]
[object Object]
```

**Why?**

In Node.js `console.log`, both `{}` and `({})` are treated as expressions, so `{}.toString()` = `"[object Object]"` and `[].toString()` = `""`, giving `"[object Object]" + "" = "[object Object]"`.

However, in a **browser REPL**, typing `{} + []` at the top level treats `{}` as an empty block (not an object literal), so it becomes: `+[]` which is `+("")` which is `0`. This context-dependent parsing is a classic trap.

**Correct way:**
```javascript
const result = Object({}) + [];
// Or use String() / Number() for intentional conversions.
```

---

### Q3: `null == undefined` -- The Special Pair

**Code:**
```javascript
console.log(null == undefined);  // true
console.log(null === undefined); // false
console.log(null == 0);          // false
console.log(null == false);      // false
console.log(null == '');          // false
```

**Why?**

The spec says `null == undefined` is `true` -- they are "loosely equal" to each other and **nothing else**. `null` does NOT coerce to `0` or `false` with `==`. This is actually a useful feature:

```javascript
if (x == null) // checks for both null AND undefined
```

With `===`, they differ because their types differ (`null` vs `undefined`).

**Correct way:**
```javascript
// Use == null to check for null/undefined together:
if (value == null) { /* value is null or undefined */ }
// Or use the nullish coalescing operator:
const safe = value ?? defaultValue;
```

---

### Q4: `NaN` -- The Value That Hates Itself

**Code:**
```javascript
console.log(NaN === NaN);           // false
console.log(NaN !== NaN);           // true
console.log(typeof NaN);            // "number"
console.log(isNaN("hello"));        // true
console.log(Number.isNaN("hello")); // false
```

**Why?**

`NaN` is the only value in JavaScript that is **not equal to itself**. This is per IEEE 754 floating-point spec.

- `typeof NaN` is `"number"` -- it IS a number type, just Not-a-Number.
- Global `isNaN()` coerces first: `isNaN("hello")` -> `isNaN(NaN)` -> `true`.
- `Number.isNaN()` does NOT coerce: `"hello"` is not `NaN`, it is a string.

**Correct way:**
```javascript
Number.isNaN(value);     // no coercion, no surprises
Object.is(value, NaN);   // true equality check for NaN
```

---

### Q5: `typeof null` -- The Historical Bug

**Code:**
```javascript
console.log(typeof null);          // "object"
console.log(typeof undefined);     // "undefined"
console.log(typeof function(){}); // "function"
console.log(typeof []);            // "object"
console.log(typeof {});            // "object"
```

**Why?**

`typeof null === "object"` is a historical bug from the first JS engine. In the original implementation, values were tagged with a type code; objects had type tag `0`, and `null` was represented as the NULL pointer (`0x00`), so its type tag was also `0`, hence `"object"`.

- `typeof []` is `"object"` because arrays ARE objects.
- `typeof function(){}` is `"function"` -- a special case in the spec.
- Both `[]` and `{}` report `"object"`, so `typeof` alone cannot distinguish them.

**Correct way:**
```javascript
value === null              // check for null
Array.isArray(value)        // check for arrays
Object.prototype.toString.call(value)
// "[object Null]", "[object Array]", "[object Object]", etc.
```

---

### Q6: `0.1 + 0.2` -- Floating Point Surprise

**Code:**
```javascript
console.log(0.1 + 0.2);         // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3); // false
console.log(0.1 + 0.2 > 0.3);   // true
```

**Why?**

IEEE 754 double-precision floating point cannot represent `0.1` or `0.2` exactly in binary. The result is `0.30000000000000004`, which is slightly greater than `0.3`. This is NOT a JavaScript bug -- it affects every language using IEEE 754 (Python, Java, C, etc.).

**Correct way:**
```javascript
// Compare with epsilon tolerance:
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON // true

// For money/financial calculations, use integers (cents):
const total = 10 + 20; // cents
const dollars = total / 100; // 0.3
```

---

## Hoisting & Temporal Dead Zone

### Q7: Function vs `var` Hoisting

**Code:**
```javascript
console.log(foo);
console.log(bar);
var foo = "hello";
function bar() { return "world"; }
```

**Output:**
```
undefined
[Function: bar]
```

**Why?**

`var` declarations are hoisted but NOT their assignments. So `foo` exists but is `undefined` at the point of the `console.log`.

Function declarations are **fully hoisted** -- both the name and the body. So `bar` is already a complete function before any code runs.

**Correct way:**
```javascript
const foo = "hello";
const bar = () => "world";
// ReferenceError if accessed before declaration (TDZ).
```

---

### Q8: `let`/`const` Temporal Dead Zone

**Code:**
```javascript
let x = 'outer';
function inner() {
  console.log(x); // What happens here?
  let x = 'inner';
}
inner();
```

**Output:**
```
ReferenceError: Cannot access 'x' before initialization
```

**Why?**

This is the Temporal Dead Zone (TDZ). Even though there is an outer `x`, the inner function has its own `let x` declaration which is hoisted to the top of the function scope (creating a binding), but it is NOT initialized until the `let x = ...` line is reached.

Accessing a `let`/`const` variable in its TDZ throws a `ReferenceError`. The inner `x` shadows the outer `x` from the start of the block, not from the line where it is declared.

**Correct way:**
```javascript
function inner() {
  const x = 'inner'; // declare before use
  console.log(x);
}
```

---

### Q9: Function Expression vs Declaration

**Code:**
```javascript
console.log(typeof greet);
console.log(typeof sayHi);

function greet() { return "Hello"; }
var sayHi = function() { return "Hi"; };
```

**Output:**
```
function
undefined
```

**Why?**

`function greet()` is a function declaration: fully hoisted. `var sayHi = function()` is a function expression assigned to a `var`:

- The `var 'sayHi'` is hoisted (as `undefined`)
- The function assignment happens at runtime

So `typeof greet` is `"function"` (fully hoisted), but `typeof sayHi` is `"undefined"` (var hoisted, not yet assigned).

**Correct way:**
```javascript
const sayHi = () => "Hi";
// Clear that it cannot be used before this line.
```

---

### Q10: Named Function Expression Scope

**Code:**
```javascript
var f = function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
};

console.log(f(5));            // 120
console.log(typeof factorial); // "undefined"
```

**Why?**

In a named function expression, the name (`factorial`) is **only available inside the function body** itself. It is NOT added to the enclosing scope.

This is useful for recursion in function expressions: the function can call itself by name without polluting the outer scope.

**Correct way:** Named function expressions are useful for:
- Recursion within expressions
- Better stack traces (the name shows in `Error.stack`)
- Self-documenting code

---

## Closures & Scope

### Q11: Classic Loop with `var`

**Code:**
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 10);
}
```

**Output:**
```
3
3
3
```

**Why?**

All three `setTimeout` callbacks share the SAME `i` variable (`var` is function-scoped, not block-scoped). By the time the callbacks execute, the loop has finished and `i === 3`.

The callbacks close over the **variable** `i` itself (a reference), NOT the **value** of `i` at the time the closure was created.

**Correct way:**
```javascript
// Fix 1: use let (block-scoped, new binding per iteration)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 10); // 0, 1, 2
}

// Fix 2: IIFE to capture the value
for (var i = 0; i < 3; i++) {
  ((j) => setTimeout(() => console.log(j), 10))(i);
}
```

---

### Q12: Closure Over Reference -- Independent Counters

**Code:**
```javascript
function makeCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    getCount: () => count,
  };
}
const c1 = makeCounter();
const c2 = makeCounter();
c1.increment();
c1.increment();
c2.increment();
console.log(c1.getCount()); // 2
console.log(c2.getCount()); // 1
```

**Why?**

Each call to `makeCounter()` creates a NEW execution context with its own `count` variable. `c1` and `c2` have completely independent closures. Closures capture the **environment** (the scope chain), not just individual values. Each invocation of `makeCounter` creates a fresh environment.

This pattern is the "module pattern" -- closures providing private state with public methods.

---

### Q13: IIFE and `var` Hoisting Inside

**Code:**
```javascript
var x = 10;
(function() {
  console.log(x);
  var x = 20;
  console.log(x);
})();
console.log(x);
```

**Output:**
```
undefined
20
10
```

**Why?**

The IIFE creates a new function scope. The `var x = 20` inside is hoisted to the top of that function scope (as `undefined`), so the inner `x` shadows the outer `x` from the very beginning of the function.

- First `console.log(x)`: the inner `var x` is hoisted but not assigned -> `undefined`
- Second `console.log(x)`: inner `x` has been assigned `20`
- Third `console.log(x)`: outer `x` is unaffected -> `10`

---

### Q14: `setTimeout` Delay Does Not Affect Captured Value

**Code:**
```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 0, 1, 2

for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), (2 - i) * 100);
}
// Output: 2, 1, 0
```

**Why?**

With `let`, each loop iteration gets its own binding of `i`. The first loop: all timeouts are 0ms, so they fire in order: 0, 1, 2. The second loop: timeouts are 200ms, 100ms, 0ms respectively, so `i=2` fires first (0ms), then `i=1` (100ms), then `i=0` (200ms): 2, 1, 0.

The `setTimeout` delay only affects the **order of execution**, not the captured value.

---

### Q15: Closure Mutation with `var` in Factory

**Code:**
```javascript
function makeArray() {
  const arr = [];
  for (var i = 0; i < 3; i++) {
    arr.push(() => i);
  }
  return arr;
}

const fns = makeArray();
console.log(fns[0]()); // 3
console.log(fns[1]()); // 3
console.log(fns[2]()); // 3
```

**Why?**

All three functions return `3`, not `0, 1, 2`. The arrow functions close over the same `i` variable (`var` is function-scoped). When the functions are called, the loop has completed and `i === 3`.

**Fix:**
```javascript
for (let i = 0; i < 3; i++) {
  arr.push(() => i); // each closure gets its own 'i'
}
// fns[0]() => 0, fns[1]() => 1, fns[2]() => 2
```

---

## `this` Binding

### Q16: Arrow vs Regular Function `this`

**Code:**
```javascript
const obj = {
  name: "Alice",
  regular: function() { return this.name; },
  arrow: () => this.name,
};
console.log(obj.regular()); // "Alice"
console.log(obj.arrow());   // undefined
```

**Why?**

`obj.regular()` is called as a method on `obj`, so `this` is `obj`. Result: `"Alice"`.

`obj.arrow()` is an arrow function. Arrow functions do **NOT** have their own `this` -- they inherit `this` from the enclosing **lexical scope** (where the arrow function was DEFINED, not called). In this case, the enclosing scope is the module/global scope, where `this` is `undefined` (strict mode) or the global object.

**TRAP:** Arrow functions in object literals do NOT get the object as `this`.

**Correct way:**
```javascript
const obj = {
  name: "Alice",
  greet() { return this.name; }, // shorthand method -- correct
};
```

---

### Q17: Method Extraction -- Losing `this`

**Code:**
```javascript
const user = {
  name: "Bob",
  greet() { return "Hello, " + this.name; },
};

const greet = user.greet;
console.log(user.greet()); // "Hello, Bob"
console.log(greet());      // "Hello, undefined"
```

**Why?**

`const greet = user.greet` extracts the function. When called as `greet()`, there is no object context, so `this` is `undefined` (strict mode). This is called "method extraction" or "losing `this`" and is one of the most common bugs in JavaScript.

**Fixes:**
```javascript
const greet = user.greet.bind(user);          // bind
const greet = () => user.greet();             // wrapper arrow
```

---

### Q18: `bind`, `call`, `apply`

**Code:**
```javascript
function greet(greeting, punctuation) {
  return greeting + ", " + this.name + punctuation;
}

const person = { name: "Charlie" };

console.log(greet.call(person, "Hello", "!"));    // "Hello, Charlie!"
console.log(greet.apply(person, ["Hi", "?"]));     // "Hi, Charlie?"

const bound = greet.bind(person, "Hey");
console.log(bound("..."));                        // "Hey, Charlie..."
```

**Why?**

- `call(thisArg, arg1, arg2, ...)`: invokes immediately with args listed.
- `apply(thisArg, [args])`: invokes immediately with args as array.
- `bind(thisArg, arg1, ...)`: returns a NEW function with `this` bound.

`bind()` also supports **partial application**: `bind(person, "Hey")` pre-fills the `greeting` parameter. When `bound("...")` is called, `"..."` becomes the `punctuation` parameter.

**Important:** `bind()` creates a permanently bound function. You cannot re-bind it.

---

### Q19: `this` in Callbacks

**Code:**
```javascript
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // BUG: 'this' is lost in the regular function callback
    setInterval(function() {
      this.seconds++; // 'this' is NOT the Timer instance!
    }, 1000);
  }
}
```

**Why?**

When a regular function is used as a callback (e.g., in `setInterval`, `addEventListener`, `Array.prototype.map`), `this` is NOT automatically bound to the class instance. It defaults to `undefined` (strict mode) or the global object (sloppy mode).

**Fixes:**
```javascript
// Fix 1: arrow function (inherits 'this' from start())
start() {
  setInterval(() => { this.seconds++; }, 1000);
}

// Fix 2: bind in constructor
constructor() {
  this.tick = this.tick.bind(this);
}

// Fix 3: class field arrow
tick = () => { this.seconds++; };
```

---

### Q20: Class Method `this` Loss

**Code:**
```javascript
class Dog {
  constructor(name) { this.name = name; }
  bark() { return this.name + " says woof!"; }
}

const dog = new Dog("Rex");
const bark = dog.bark;

console.log(dog.bark()); // "Rex says woof!"
console.log(bark());     // TypeError: Cannot read properties of undefined
```

**Why?**

`dog.bark()` works because `this === dog`. But `const bark = dog.bark` destructures the method away from the object. `bark()` has no object context, so `this` is `undefined`. This happens when passing methods as callbacks:

```javascript
button.addEventListener('click', dog.bark); // 'this' is the button!
setTimeout(dog.bark, 1000);                  // 'this' is undefined
```

**Fix:**
```javascript
const bark = dog.bark.bind(dog);
// Or use class field arrow:
class Dog {
  bark = () => this.name + " says woof!";
}
```

---

## Prototype & Inheritance

### Q21: Prototype Chain Walk

**Code:**
```javascript
function Animal(name) { this.name = name; }
Animal.prototype.speak = function() { return this.name + " makes a sound"; };

function Dog(name) { Animal.call(this, name); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

const d = new Dog("Rex");
console.log(d.speak());               // "Rex makes a sound"
console.log(d instanceof Dog);        // true
console.log(d instanceof Animal);     // true
console.log(d.constructor === Dog);   // true
```

**Why?**

The prototype chain: `d` -> `Dog.prototype` -> `Animal.prototype` -> `Object.prototype`

- `d.speak()`: not on `d`, not on `Dog.prototype`, found on `Animal.prototype`.
- `d instanceof Dog`: true (`Dog.prototype` is in `d`'s prototype chain).
- Without `Dog.prototype.constructor = Dog`, `d.constructor` would be `Animal`.

**Modern equivalent:**
```javascript
class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + " makes a sound"; }
}
class Dog extends Animal {}
```

---

### Q22: `Object.create(null)` -- The Truly Empty Object

**Code:**
```javascript
const normal = {};
const bare = Object.create(null);

console.log(normal.toString);                  // [Function: toString]
console.log(bare.toString);                    // undefined
console.log("toString" in normal);             // true
console.log("toString" in bare);               // false
console.log(Object.getPrototypeOf(bare));      // null
```

**Why?**

`Object.create(null)` creates an object with **no prototype at all**. It has no inherited methods (`toString`, `hasOwnProperty`, `valueOf`, etc.).

- `normal` -> `Object.prototype` (has `toString`, `hasOwnProperty`, etc.)
- `bare` -> `null` (truly empty, no prototype chain)

This is useful for creating "pure dictionaries" where you do not want inherited keys polluting lookups.

**Modern alternative:**
```javascript
const map = new Map(); // preferred for dictionaries
```

---

### Q23: Constructor Return Value Override

**Code:**
```javascript
function Foo() {
  this.name = "foo";
  return { name: "bar" }; // returning an object!
}

function Bar() {
  this.name = "bar";
  return 42; // returning a primitive
}

const foo = new Foo();
const bar = new Bar();
console.log(foo.name); // "bar"
console.log(bar.name); // "bar"
```

**Why?**

When a constructor returns an **object**, `new` uses that object instead of the auto-created `this`. So `new Foo()` returns `{ name: "bar" }`.

When a constructor returns a **primitive** (number, string, boolean, etc.), `new` **ignores** the return value and uses `this` as normal. So `new Bar()` returns the auto-created `this` with `name: "bar"`.

Only object return values override `new`.

---

### Q24: `instanceof` with `Symbol.hasInstance`

**Code:**
```javascript
class EvenNumber {
  static [Symbol.hasInstance](num) {
    return typeof num === 'number' && num % 2 === 0;
  }
}

console.log(2 instanceof EvenNumber);   // true
console.log(3 instanceof EvenNumber);   // false
console.log("4" instanceof EvenNumber); // false
```

**Why?**

`Symbol.hasInstance` allows you to customize `instanceof`. When you write `x instanceof Y`, the engine calls `Y[Symbol.hasInstance](x)`. Here, `EvenNumber` checks if the operand is an even number.

---

## Async Gotchas

### Q25: Promise Resolution Order

**Code:**
```javascript
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));
console.log("5");
```

**Output:**
```
1
5
3
4
2
```

**Why?**

1. `console.log("1")` -- synchronous
2. `setTimeout` callback queued as a **macrotask**
3. `Promise.then` callbacks queued as **microtasks**
4. `console.log("5")` -- synchronous
5. Drain microtask queue: `"3"` then `"4"`
6. Pick next macrotask: `"2"`

**Key rule:** ALL microtasks run before the next macrotask.

---

### Q26: `async` Functions Always Return Promises

**Code:**
```javascript
async function getValue() {
  return 42;
}

console.log(getValue());               // Promise { 42 }
console.log(getValue() instanceof Promise); // true
```

**Why?**

An `async` function **always** returns a Promise, even if you `return` a plain value. `return 42` is equivalent to `return Promise.resolve(42)`.

If you return a Promise from an async function, it does NOT get double-wrapped. `return Promise.resolve(42)` still gives `Promise { 42 }`, not `Promise { Promise { 42 } }`.

**Trap:**
```javascript
if (getValue()) // ALWAYS truthy -- the Promise object is truthy!
```

---

### Q27: `await` on Non-Promise Values

**Code:**
```javascript
async function example() {
  const a = await 42;
  const b = await "hello";
  const c = await { x: 1 };
  console.log(a, b, c); // 42 "hello" { x: 1 }
}
```

**Why?**

`await` on a non-Promise value wraps it in `Promise.resolve()` first, then immediately resolves. So `await 42` is equivalent to `await Promise.resolve(42)`. This means `await` always introduces an asynchronous boundary, even for plain values. You can safely `await` a function that may or may not return a Promise.

---

### Q28: `forEach` with `async` -- The Silent Bug

**Code:**
```javascript
async function processItems(items) {
  const results = [];

  items.forEach(async (item) => {
    const result = await doWork(item);
    results.push(result);
  });

  console.log(results); // [] -- EMPTY!
  return results;
}
```

**Why?**

`forEach` does NOT await async callbacks. It calls each callback and **ignores the returned Promise**. So:
1. `forEach` kicks off 3 async functions (they start but are suspended at `await`)
2. `console.log(results)` runs immediately -- results is still `[]`
3. The async callbacks complete LATER

**Fixes:**
```javascript
// Fix 1: for...of (sequential)
for (const item of items) {
  results.push(await doWork(item));
}

// Fix 2: Promise.all + map (parallel)
const results = await Promise.all(items.map(item => doWork(item)));
```

**NEVER use `forEach` with `async/await`!**

---

### Q29: `Promise.all` Short-Circuit

**Code:**
```javascript
Promise.all([
  Promise.resolve(1),
  Promise.reject(new Error("fail")),
  Promise.resolve(3),
])
.then(results => console.log("Success:", results))
.catch(err => console.log("Error:", err.message));
// Output: "Error: fail"
```

**Why?**

`Promise.all` rejects **as soon as** any single promise rejects. It does NOT wait for the other promises. The other promises are NOT cancelled -- they continue running, but their results are discarded.

**Alternative:**
```javascript
// Promise.allSettled waits for ALL promises:
const results = await Promise.allSettled(promises);
const successes = results.filter(r => r.status === 'fulfilled');
const failures = results.filter(r => r.status === 'rejected');
```

---

### Q30: Unhandled Promise Rejections

**Code:**
```javascript
async function dangerous() {
  throw new Error("oops");
}

// BAD: calling without catch
dangerous(); // UnhandledPromiseRejection -- crashes Node.js v15+!

// GOOD:
dangerous().catch(e => console.log("Caught:", e.message));
```

**Why?**

In modern Node.js (v15+), unhandled promise rejections **crash the process** with exit code 1. Common mistakes:
1. Calling an async function without `await` or `.catch()`
2. Using `.then()` without a `.catch()`
3. Missing `try/catch` around `await`

**Correct way:**
```javascript
try { await dangerous(); } catch (e) { /* handle */ }
// or
dangerous().catch(handleError);
```

---

## Event Loop Puzzles

### Q31: `setTimeout` vs `Promise` vs `process.nextTick`

**Code:**
```javascript
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));
console.log("sync");
```

**Output:**
```
sync
nextTick
promise
timeout
```

**Why?**

Priority in Node.js:
1. **Synchronous code** (call stack) -- `"sync"`
2. **`process.nextTick`** queue -- `"nextTick"`
3. **Microtask queue** (Promises) -- `"promise"`
4. **Macrotask queue** (setTimeout) -- `"timeout"`

`process.nextTick` has **higher priority** than Promise microtasks. Both run before any macrotask. This is Node.js-specific -- browsers do not have `process.nextTick`.

---

### Q32: `setImmediate` vs `setTimeout` in I/O Callbacks

**Code:**
```javascript
const fs = require('fs');

// Outside I/O: order is NON-DETERMINISTIC
setTimeout(() => console.log("timeout-outer"), 0);
setImmediate(() => console.log("immediate-outer"));

// Inside I/O callback: setImmediate ALWAYS fires first
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout-inner"), 0);
  setImmediate(() => console.log("immediate-inner"));
});
```

**Why?**

**Outside I/O callbacks:** `setTimeout(fn, 0)` vs `setImmediate` order is non-deterministic. It depends on how fast the event loop starts up.

**Inside an I/O callback:** `setImmediate` ALWAYS fires before `setTimeout(fn, 0)`. After the I/O poll phase, the event loop moves to the "check" phase (`setImmediate`) BEFORE looping back to the "timers" phase (`setTimeout`).

---

### Q33: Recursive `process.nextTick` Starvation

**Code:**
```javascript
// WARNING: without a limit, this starves the event loop!
function recursiveNextTick() {
  process.nextTick(recursiveNextTick);
}

setTimeout(() => console.log("This NEVER fires!"), 0);
recursiveNextTick();
```

**Why?**

`process.nextTick` callbacks are drained **completely** before moving to the next phase. If you recursively schedule nextTick callbacks, the event loop will NEVER advance to process I/O, timers, or anything else. This is called "I/O starvation."

**Fix:**
```javascript
function recurse() {
  doWork();
  setImmediate(recurse); // allows I/O between iterations
}
```

---

### Q34: Event Loop Blocking

**Code:**
```javascript
const start = Date.now();
while (Date.now() - start < 100) {} // busy wait 100ms

setTimeout(() => {
  console.log("Timer fired after:", Date.now() - start, "ms");
}, 10);
// Timer fires after ~100ms, NOT 10ms!
```

**Why?**

JavaScript is single-threaded. While the synchronous busy-wait loop runs, the event loop is **completely blocked**. No callbacks can fire, no I/O can be processed. `setTimeout(fn, 10)` is a **minimum** delay, not a guarantee. The callback only fires when the event loop is free.

**Fix:**
```javascript
const { Worker } = require('worker_threads');
new Worker('./heavy-computation.js'); // offload to worker thread
```

---

## Object & Array Tricks

### Q35: Object Key Coercion

**Code:**
```javascript
const obj = {};
const a = {};
const b = { key: "value" };

obj[a] = "first";
obj[b] = "second";

console.log(obj[a]);           // "second"
console.log(obj[b]);           // "second"
console.log(Object.keys(obj)); // ["[object Object]"]
```

**Why?**

All object keys are converted to **strings**. When you use an object as a key, it calls `.toString()`:

- `{}.toString()` === `"[object Object]"`
- `{ key: "value" }.toString()` === `"[object Object]"`

Both `a` and `b` convert to the **same key**, so the second assignment overwrites the first.

**Fix:** Use `Map` for object keys:
```javascript
const map = new Map();
map.set(a, "first");
map.set(b, "second"); // separate entries
```

---

### Q36: Array Holes (Sparse Arrays)

**Code:**
```javascript
const arr = [1, , 3]; // sparse array with hole at index 1
console.log(arr.length); // 3
console.log(arr[1]);     // undefined
console.log(1 in arr);   // false -- the index does NOT exist!

// Methods handle holes inconsistently:
arr.map(x => x * 2);    // [2, empty, 6]   -- preserves holes
arr.forEach(x => ...);  // skips holes
[...arr];               // [1, undefined, 3] -- fills with undefined
```

**Why?**

`[1, , 3]` creates a "sparse array" with a hole at index 1. The index does not exist (not `undefined`, it is **absent**). Array methods handle holes inconsistently -- `map` preserves them, `forEach` skips them, spread fills them with `undefined`.

---

### Q37: `delete` on Arrays

**Code:**
```javascript
const arr = [1, 2, 3, 4, 5];
delete arr[2];

console.log(arr);        // [1, 2, <empty>, 4, 5]
console.log(arr.length); // 5 -- NOT 4!
console.log(arr[2]);     // undefined
console.log(2 in arr);   // false
```

**Why?**

`delete` removes the property but does NOT reindex the array or change its length. It creates a hole (sparse array).

**Fix:**
```javascript
arr.splice(2, 1); // removes and reindexes -- arr is [1, 2, 4, 5]
```

---

### Q38: `Array(3)` vs `[undefined, undefined, undefined]`

**Code:**
```javascript
console.log(Array(3));                              // [ <3 empty items> ]
console.log(Array(3).map((_, i) => i));             // [ <3 empty items> ]
console.log([...Array(3)].map((_, i) => i));        // [0, 1, 2]
console.log(Array.from({ length: 3 }, (_, i) => i)); // [0, 1, 2]
```

**Why?**

`Array(3)` creates a sparse array with length 3 but **no elements**. `map()` skips holes, so `Array(3).map()` does nothing. Spreading `[...Array(3)]` converts holes to `undefined`, making `map()` work. `Array.from` also creates real entries.

**Correct way:**
```javascript
Array.from({ length: n }, (_, i) => i); // [0, 1, ..., n-1]
```

---

### Q39: Property Enumeration Order

**Code:**
```javascript
const obj = {};
obj["2"] = "two";
obj["1"] = "one";
obj["b"] = "bravo";
obj["a"] = "alpha";
obj["3"] = "three";

console.log(Object.keys(obj));
// ["1", "2", "3", "b", "a"]
```

**Why?**

Since ES2015, `Object.keys()` follows a specific order:
1. **Integer indices** in ascending numeric order (`"1"`, `"2"`, `"3"`)
2. **String keys** in insertion order (`"b"`, `"a"`)
3. **Symbol keys** in insertion order

Objects DO have a defined enumeration order, but it is not purely insertion order when integer-like keys are involved.

**Fix:** Use `Map` for guaranteed insertion order:
```javascript
const map = new Map();
map.set("2", "two");
map.set("1", "one");
[...map.keys()]; // ["2", "1"] -- true insertion order
```

---

## Comparison & Logic

### Q40: `||` and `&&` Return Values, Not Booleans

**Code:**
```javascript
console.log(1 || 2);          // 1
console.log(0 || 2);          // 2
console.log(1 && 2);          // 2
console.log(0 && 2);          // 0
console.log("" || "default"); // "default"
console.log(null ?? "default"); // "default"
console.log(0 ?? "default");   // 0
console.log("" ?? "default");  // ""
```

**Why?**

- `||` returns the **first truthy** value, or the last value if all falsy.
- `&&` returns the **first falsy** value, or the last value if all truthy.
- `??` only treats `null` and `undefined` as "nullish" -- `0` and `""` pass through.

**Key difference:** `||` checks falsy, `??` checks nullish. Use `??` when `0` or `""` are valid values.

---

### Q41: Abstract Equality Madness

**Code:**
```javascript
console.log("" == false);    // true
console.log("" == 0);        // true
console.log(false == 0);     // true
console.log(" \t\n" == 0);   // true
console.log([] == false);    // true
console.log([] == 0);        // true
console.log([1] == 1);       // true
console.log(["1"] == 1);     // true
```

**Why?**

The abstract equality algorithm chain: `ToPrimitive` -> `toString` -> `ToNumber`.

Notice: `[] == false` is `true`, but `[]` is truthy! `if ([])` executes because `[]` is truthy. Truthiness and `==` comparison are different algorithms.

**Rule:** ALWAYS use `===` except for `value == null`.

---

### Q42: The Comma Operator

**Code:**
```javascript
const a = (1, 2, 3);
console.log(a); // 3

const b = (console.log("first"), console.log("second"), 42);
console.log(b); // 42
```

**Why?**

The comma operator evaluates ALL expressions left to right and returns the **last** one. `(1, 2, 3)` evaluates `1`, then `2`, then `3` -- returns `3`.

**Avoid for clarity.** Use block bodies instead:
```javascript
const fn = () => {
  console.log("side effect");
  return "result";
};
```

---

### Q43: Optional Chaining with Nullish Coalescing

**Code:**
```javascript
const user = {
  profile: { name: "Alice", address: null }
};

console.log(user.profile?.name);              // "Alice"
console.log(user.profile?.address?.city);     // undefined
console.log(user.settings?.theme);            // undefined
console.log(user.profile?.address?.city ?? "Unknown"); // "Unknown"
console.log(user.nonExistent?.());            // undefined (no TypeError)
```

**Why?**

Optional chaining (`?.`) short-circuits to `undefined` when the left side is `null` or `undefined`. Combined with `??` for defaults, it provides safe nested access.

**Trap:** `?.` only checks for `null`/`undefined`, NOT falsy values:
```javascript
0?.toString() // "0" -- 0 is NOT nullish
```

---

## Node.js Specific

### Q44: `require` Circular Dependencies

**Code:**
```javascript
// a.js
exports.loaded = false;
const b = require('./b.js');
console.log("a.js: b.loaded =", b.loaded);
exports.loaded = true;

// b.js
exports.loaded = false;
const a = require('./a.js');
console.log("b.js: a.loaded =", a.loaded); // false -- PARTIAL!
exports.loaded = true;
```

**Output (running `node a.js`):**
```
b.js: a.loaded = false    <-- a.js is partially loaded!
a.js: b.loaded = true
```

**Why?**

When `a.js` requires `b.js` and `b.js` requires `a.js`, Node.js detects the cycle and returns the **partially completed** exports of `a.js` (at that point, `loaded` is still `false`). Node does NOT deadlock or throw. This is a common source of subtle bugs.

**Fix:** Avoid circular dependencies. Refactor shared code into a third module, or use lazy requires inside functions.

---

### Q45: Module Caching (Singleton Behavior)

**Code:**
```javascript
// counter.js
let count = 0;
module.exports = {
  increment: () => ++count,
  getCount: () => count
};

// app.js
const c1 = require('./counter');
const c2 = require('./counter');
c1.increment();
c1.increment();
console.log(c2.getCount()); // 2 -- same instance!
```

**Why?**

`require()` **caches** modules. The second `require('./counter')` returns the **same** object from the cache. `c1` and `c2` are the same module instance. This is the "singleton pattern" of Node.js.

**To get fresh instances, use a factory:**
```javascript
module.exports = function createCounter() {
  let count = 0;
  return { increment: () => ++count, getCount: () => count };
};
```

---

### Q46: Buffer Comparison Gotcha

**Code:**
```javascript
const buf1 = Buffer.from("abc");
const buf2 = Buffer.from("abc");

console.log(buf1 === buf2);       // false -- different objects!
console.log(buf1 == buf2);        // false
console.log(buf1.equals(buf2));   // true  -- same content
console.log(Buffer.compare(buf1, buf2)); // 0 (equal)
```

**Why?**

Buffers are objects, so `===` and `==` compare **references**, not content. Use `.equals()` for content comparison. For security-sensitive comparisons (HMAC, tokens), use `crypto.timingSafeEqual()` to prevent timing attacks.

---

### Q47: `process.exit()` vs Graceful Shutdown

**Code:**
```javascript
// BAD: process.exit(0) -- immediate, no cleanup
setTimeout(() => console.log("I may never run"), 1000);
process.exit(0); // pending callbacks abandoned!

// GOOD: graceful shutdown
process.on('SIGTERM', async () => {
  server.close();
  await db.disconnect();
  process.exitCode = 0; // let event loop drain
});
```

**Why?**

`process.exit()` forces an **immediate** exit. Pending callbacks, open sockets, unfinished I/O -- all abandoned. Better approach: set `process.exitCode` and let Node exit naturally when the event loop has nothing left.

For servers, implement graceful shutdown: stop accepting new connections, finish in-flight requests, close resources, then exit.

---

## Key Takeaways

| # | Rule | Why It Matters |
|---|------|----------------|
| 1 | Always use `===` unless checking `== null` | Avoids type coercion surprises |
| 2 | Use `let`/`const` instead of `var` | Block scoping, TDZ, no hoisting bugs |
| 3 | Closures capture references, not values | Classic loop/callback bug |
| 4 | Arrow functions do NOT have their own `this` | Wrong `this` in object methods |
| 5 | `forEach` with `async` does NOT work | Use `for...of` or `Promise.all` |
| 6 | `process.nextTick` > Promises > `setTimeout` | Event loop priority order |
| 7 | All object keys are strings | Use `Map` for non-string keys |
| 8 | `\|\|` returns values; use `??` for nullish | `0` and `""` are valid with `??` |
| 9 | `require()` caches modules (singletons) | Shared state across imports |
| 10 | Never use `process.exit()` in servers | Implement graceful shutdown |

---

> Run the interactive version: `node 17_tricky_questions.js`
