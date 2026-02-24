/**
 * ============================================================================
 * FILE 1: JAVASCRIPT FUNDAMENTALS — Senior Interview Prep
 * ============================================================================
 *
 * Topics covered:
 *   - Primitive types vs reference types, typeof quirks
 *   - Type coercion rules (== vs ===, truthy/falsy)
 *   - var vs let vs const, hoisting, temporal dead zone
 *   - Closures and lexical scope
 *   - Prototypal inheritance, prototype chain
 *   - ES6+ features: destructuring, spread/rest, template literals
 *   - Arrays: map, filter, reduce, find, flatMap, at()
 *   - Objects: entries, fromEntries, structuredClone, optional chaining,
 *     nullish coalescing
 *   - Map, Set, WeakMap, WeakSet
 *   - Symbols and well-known symbols
 *   - String methods, regex basics
 *   - Error handling patterns (try/catch/finally)
 *   - Common gotchas (NaN, floating point, implicit coercion)
 *
 * Run: node 01_javascript_fundamentals.js
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
// ║  1. PRIMITIVE TYPES vs REFERENCE TYPES                                ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("1. Primitive Types vs Reference Types");

/**
 * JavaScript has 7 primitive types:
 *   string, number, bigint, boolean, undefined, symbol, null
 *
 * Everything else (objects, arrays, functions, dates, regexps, etc.)
 * is a reference type — stored on the heap, variables hold a pointer.
 *
 * KEY INTERVIEW POINT:
 *   Primitives are copied by value; reference types are copied by reference.
 */

// --- Primitives: copied by value ---
let a = 10;
let b = a; // b gets its OWN copy of the value 10
b = 20;
show("a (unchanged)", a); // 10
show("b (changed copy)", b); // 20

// --- Reference types: copied by reference ---
const obj1 = { x: 1 };
const obj2 = obj1; // obj2 points to the SAME object
obj2.x = 99;
show("obj1.x (mutated via obj2)", obj1.x); // 99 — same object!

// --- typeof quirks ---
/**
 * typeof null === "object"           <-- historical bug, never fixed
 * typeof function(){} === "function" <-- functions get their own type string
 * typeof NaN === "number"            <-- NaN is technically a number
 * typeof undeclaredVar === "undefined" <-- safe way to check existence
 */
show('typeof null', typeof null); // "object"
show('typeof (() => {})', typeof (() => {})); // "function"
show('typeof NaN', typeof NaN); // "number"
show('typeof []', typeof []); // "object"
show('typeof undefined', typeof undefined); // "undefined"
show('typeof 42n', typeof 42n); // "bigint"
show('typeof Symbol()', typeof Symbol()); // "symbol"

// Reliable type checking:
show("Array.isArray([])", Array.isArray([])); // true
show("null check (=== null)", null === null); // true

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  2. TYPE COERCION RULES (== vs ===, truthy/falsy)                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("2. Type Coercion Rules");

/**
 * === (strict equality): no coercion, both type AND value must match.
 * == (abstract equality): performs type coercion following a complex algorithm.
 *
 * SENIOR TIP: Always use === except when intentionally checking null/undefined:
 *   value == null  is equivalent to  (value === null || value === undefined)
 */

show("0 == ''", 0 == ""); // true (both coerce to 0)
show("0 === ''", 0 === ""); // false
show("false == ''", false == ""); // true
show("null == undefined", null == undefined); // true
show("null === undefined", null === undefined); // false
show("NaN == NaN", NaN == NaN); // false — NaN is not equal to itself!
show("NaN === NaN", NaN === NaN); // false

// Truthy / Falsy values:
/**
 * FALSY values (exactly 8):
 *   false, 0, -0, 0n, "", null, undefined, NaN
 *
 * EVERYTHING else is truthy, including:
 *   "0", " ", [], {}, new Boolean(false), new Number(0)
 */
const falsyValues = [false, 0, -0, 0n, "", null, undefined, NaN];
const trickyTruthyValues = ["0", " ", [], {}, -1];

show(
  "Falsy values",
  falsyValues.map((v) => `${String(v)} -> ${!!v}`)
);
show(
  "Tricky truthy values",
  trickyTruthyValues.map((v) => `${JSON.stringify(v)} -> ${!!v}`)
);

// Object-to-primitive coercion uses Symbol.toPrimitive, valueOf, toString:
const custom = {
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return 42;
    if (hint === "string") return "hello";
    return true; // default hint
  },
};
show("+custom (number hint)", +custom); // 42
show("`${custom}` (string hint)", `${custom}`); // "hello"

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  3. var vs let vs const — HOISTING & TEMPORAL DEAD ZONE               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("3. var vs let vs const, Hoisting, TDZ");

/**
 * var:   function-scoped, hoisted (initialized to undefined)
 * let:   block-scoped, hoisted but NOT initialized (TDZ until declaration)
 * const: block-scoped, hoisted but NOT initialized, must be initialized,
 *        binding is immutable (value may still be mutable if it is an object)
 *
 * TEMPORAL DEAD ZONE (TDZ):
 *   The region from the start of the block to the point where the variable
 *   is declared. Accessing the variable in the TDZ throws ReferenceError.
 */

// var hoisting:
function varDemo() {
  show("x before declaration (var)", x); // undefined — hoisted
  var x = 5;
  show("x after declaration (var)", x); // 5
}
varDemo();

// let TDZ:
function letTdzDemo() {
  try {
    // Uncommenting the next line would throw ReferenceError
    // console.log(y); // ReferenceError: Cannot access 'y' before initialization
    show("let TDZ", "Accessing let before declaration throws ReferenceError");
  } catch (e) {
    show("TDZ error", e.message);
  }
  let y = 10;
  show("y after declaration (let)", y);
}
letTdzDemo();

// const with mutable value:
const arr = [1, 2, 3];
arr.push(4); // Fine — we are mutating the array, not reassigning the binding
show("const arr after push", arr); // [1, 2, 3, 4]

// Classic var-in-loop gotcha:
const funcsVar = [];
for (var i = 0; i < 3; i++) {
  funcsVar.push(() => i);
}
show(
  "var-in-loop (all share same i)",
  funcsVar.map((f) => f())
); // [3, 3, 3]

const funcsLet = [];
for (let j = 0; j < 3; j++) {
  funcsLet.push(() => j);
}
show(
  "let-in-loop (each gets own j)",
  funcsLet.map((f) => f())
); // [0, 1, 2]

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  4. CLOSURES AND LEXICAL SCOPE                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("4. Closures and Lexical Scope");

/**
 * A CLOSURE is a function that retains access to its lexical scope even
 * when executed outside that scope.
 *
 * Lexical scope = scope is determined by where the function is WRITTEN,
 * not where it is CALLED.
 *
 * INTERVIEW POINT: Closures are the foundation of:
 *   - Data privacy / encapsulation
 *   - Partial application / currying
 *   - Module pattern
 *   - Memoization
 *   - Event handlers and callbacks
 */

// Data encapsulation with closures:
function createCounter(initial = 0) {
  let count = initial; // private — only accessible via returned methods
  return {
    increment() {
      return ++count;
    },
    decrement() {
      return --count;
    },
    getCount() {
      return count;
    },
  };
}

const counter = createCounter(10);
show("counter.increment()", counter.increment()); // 11
show("counter.increment()", counter.increment()); // 12
show("counter.decrement()", counter.decrement()); // 11
// count is not accessible directly — true privacy

// Currying / partial application:
/** @param {number} multiplier */
function multiply(multiplier) {
  /** @param {number} value */
  return function (value) {
    return multiplier * value;
  };
}
const double = multiply(2);
const triple = multiply(3);
show("double(5)", double(5)); // 10
show("triple(5)", triple(5)); // 15

// Memoization:
/** @param {(n: number) => number} fn */
function memoize(fn) {
  /** @type {Map<string, *>} */
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveSquare = memoize((n) => {
  console.log(`    (computing ${n}^2...)`);
  return n * n;
});
show("expensiveSquare(5)", expensiveSquare(5)); // computes
show("expensiveSquare(5) (cached)", expensiveSquare(5)); // cached

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  5. PROTOTYPAL INHERITANCE & PROTOTYPE CHAIN                          ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("5. Prototypal Inheritance & Prototype Chain");

/**
 * JavaScript uses PROTOTYPAL inheritance (not classical).
 * Every object has an internal [[Prototype]] link (accessible via
 * Object.getPrototypeOf() or the deprecated __proto__).
 *
 * When you access a property on an object:
 *   1. JS looks on the object itself
 *   2. If not found, it walks up the prototype chain
 *   3. Until it reaches Object.prototype (whose prototype is null)
 *
 * The `class` keyword is syntactic sugar over prototypes.
 */

// Constructor function pattern (pre-ES6):
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a noise.`;
};

function Dog(name, breed) {
  Animal.call(this, name); // "super" call
  this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype); // set up chain
Dog.prototype.constructor = Dog; // fix constructor reference
Dog.prototype.bark = function () {
  return `${this.name} barks!`;
};

const rex = new Dog("Rex", "Shepherd");
show("rex.speak()", rex.speak()); // inherited from Animal
show("rex.bark()", rex.bark()); // own method
show("rex instanceof Dog", rex instanceof Dog); // true
show("rex instanceof Animal", rex instanceof Animal); // true

// Prototype chain inspection:
show(
  "Object.getPrototypeOf(rex) === Dog.prototype",
  Object.getPrototypeOf(rex) === Dog.prototype
);
show(
  "Object.getPrototypeOf(Dog.prototype) === Animal.prototype",
  Object.getPrototypeOf(Dog.prototype) === Animal.prototype
);

// hasOwnProperty vs 'in':
show("rex.hasOwnProperty('name')", rex.hasOwnProperty("name")); // true — own
show("rex.hasOwnProperty('speak')", rex.hasOwnProperty("speak")); // false — inherited
show("'speak' in rex", "speak" in rex); // true — found in chain

// Object.create for direct prototype setup:
const vehicleProto = {
  start() {
    return `${this.make} started`;
  },
};
const car = Object.create(vehicleProto, {
  make: { value: "Toyota", writable: true, enumerable: true },
});
show("car.start()", car.start());

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  6. ES6+ FEATURES                                                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("6. ES6+ Features: Destructuring, Spread/Rest, Template Literals");

// --- Destructuring ---
// Object destructuring with renaming, defaults, nested:
const person = { name: "Alice", age: 30, address: { city: "NYC", zip: "10001" } };
const {
  name: personName,
  age,
  address: { city },
  job = "Engineer", // default value
} = person;
show("Destructured", { personName, age, city, job });

// Array destructuring with skipping and rest:
const [first, , third, ...remaining] = [10, 20, 30, 40, 50];
show("Array destructure", { first, third, remaining }); // 10, 30, [40, 50]

// Swapping without temp variable:
let x = 1,
  y = 2;
[x, y] = [y, x];
show("Swapped", { x, y }); // x=2, y=1

// --- Spread operator ---
// Shallow clone objects/arrays:
const original = { a: 1, nested: { b: 2 } };
const shallowClone = { ...original, a: 99 }; // override a
show("Spread clone (a overridden)", shallowClone);
show(
  "Nested is same ref",
  original.nested === shallowClone.nested
); // true — shallow!

// Merge arrays:
const merged = [...[1, 2], ...[3, 4]];
show("Merged arrays", merged); // [1, 2, 3, 4]

// --- Rest parameters ---
/** @param {number} multiplierVal @param {...number} nums */
function multiplyAll(multiplierVal, ...nums) {
  return nums.map((n) => n * multiplierVal);
}
show("Rest params", multiplyAll(3, 1, 2, 3)); // [3, 6, 9]

// --- Template literals ---
const multiLine = `
  This is a multi-line
  template literal with ${2 + 2} interpolation.
`.trim();
show("Template literal", multiLine);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  7. ARRAY METHODS                                                      ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("7. Array Methods: map, filter, reduce, find, flatMap, at()");

const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// map: transform each element, returns new array
show(
  "map (squared)",
  nums.map((n) => n ** 2)
);

// filter: keep elements matching predicate
show(
  "filter (even)",
  nums.filter((n) => n % 2 === 0)
);

// reduce: accumulate to single value
/**
 * INTERVIEW TIP: reduce is the most powerful — you can implement
 * map, filter, flatMap, groupBy etc. with reduce.
 */
const sum = nums.reduce((acc, n) => acc + n, 0);
show("reduce (sum)", sum); // 55

// Reduce to build an object (group by even/odd):
const grouped = nums.reduce((acc, n) => {
  const key = n % 2 === 0 ? "even" : "odd";
  (acc[key] ??= []).push(n);
  return acc;
}, /** @type {Record<string, number[]>} */ ({}));
show("reduce (group by)", grouped);

// find / findIndex:
show(
  "find (first > 5)",
  nums.find((n) => n > 5)
); // 6
show(
  "findIndex (first > 5)",
  nums.findIndex((n) => n > 5)
); // 5

// findLast / findLastIndex (ES2023):
show(
  "findLast (last even)",
  nums.findLast((n) => n % 2 === 0)
); // 10
show(
  "findLastIndex (last even)",
  nums.findLastIndex((n) => n % 2 === 0)
); // 9

// flatMap: map then flatten one level
const sentences = ["hello world", "foo bar"];
show(
  "flatMap (split words)",
  sentences.flatMap((s) => s.split(" "))
); // ['hello','world','foo','bar']

// at(): access by positive or negative index (ES2022)
show("at(0)", nums.at(0)); // 1
show("at(-1)", nums.at(-1)); // 10 — last element
show("at(-2)", nums.at(-2)); // 9

// toSorted, toReversed, with (ES2023 — immutable variants):
const unsorted = [3, 1, 4, 1, 5];
show("toSorted()", unsorted.toSorted((a, b) => a - b)); // [1, 1, 3, 4, 5]
show("original unchanged", unsorted); // [3, 1, 4, 1, 5]
show("toReversed()", unsorted.toReversed()); // [5, 1, 4, 1, 3]
show("with(2, 99)", unsorted.with(2, 99)); // [3, 1, 99, 1, 5]

// some / every:
show(
  "some (has even)",
  nums.some((n) => n % 2 === 0)
); // true
show(
  "every (all positive)",
  nums.every((n) => n > 0)
); // true

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  8. OBJECT UTILITIES                                                   ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("8. Object Utilities");

// Object.entries / Object.fromEntries — convert between objects and arrays
const config = { host: "localhost", port: 3000, debug: true };
const entries = Object.entries(config);
show("Object.entries", entries);

// Transform values via entries:
const uppercased = Object.fromEntries(
  Object.entries(config).map(([k, v]) => [k, String(v).toUpperCase()])
);
show("fromEntries (uppercased)", uppercased);

// Object.keys, Object.values:
show("Object.keys", Object.keys(config));
show("Object.values", Object.values(config));

// structuredClone — deep clone (ES2022):
/**
 * Unlike JSON.parse(JSON.stringify(...)), structuredClone:
 *   - Handles Date, RegExp, Map, Set, ArrayBuffer, Error, etc.
 *   - Handles circular references
 *   - Does NOT clone functions, DOM nodes, or symbols
 */
const deep = { date: new Date(), set: new Set([1, 2, 3]), nested: { a: 1 } };
const cloned = structuredClone(deep);
cloned.nested.a = 999;
show("structuredClone — original.nested.a", deep.nested.a); // 1 (unaffected)
show("structuredClone — cloned.nested.a", cloned.nested.a); // 999
show("Date preserved", cloned.date instanceof Date); // true
show("Set preserved", cloned.set instanceof Set); // true

// Optional chaining (?.) and nullish coalescing (??):
/**
 * ?. short-circuits to undefined if left side is null/undefined
 * ?? returns right side only if left side is null or undefined
 *    (unlike || which also triggers on falsy values like 0, "", false)
 */
const user = { profile: { name: "Bob" }, scores: [100, 0, 85] };
show("optional chaining", user?.profile?.name); // "Bob"
show("optional chaining (missing)", user?.address?.street); // undefined
show("optional chaining method", user?.toString?.()); // "[object Object]"
show("optional chaining array", user?.scores?.[0]); // 100

// ?? vs ||
const port1 = 0 ?? 3000; // 0 — because 0 is NOT null/undefined
const port2 = 0 || 3000; // 3000 — because 0 is falsy
show("0 ?? 3000", port1);
show("0 || 3000", port2);

const emptyStr1 = "" ?? "default"; // ""
const emptyStr2 = "" || "default"; // "default"
show('"" ?? "default"', emptyStr1);
show('"" || "default"', emptyStr2);

// Object.hasOwn (ES2022) — better than hasOwnProperty:
const proto = { inherited: true };
const child = Object.create(proto);
child.own = true;
show("Object.hasOwn(child, 'own')", Object.hasOwn(child, "own")); // true
show("Object.hasOwn(child, 'inherited')", Object.hasOwn(child, "inherited")); // false

// Object.groupBy (ES2024):
const people = [
  { name: "Alice", dept: "Eng" },
  { name: "Bob", dept: "Eng" },
  { name: "Carol", dept: "Sales" },
];
if (typeof Object.groupBy === "function") {
  const byDept = Object.groupBy(people, (p) => p.dept);
  show("Object.groupBy", byDept);
} else {
  show("Object.groupBy", "Not available in this Node version");
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  9. Map, Set, WeakMap, WeakSet                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("9. Map, Set, WeakMap, WeakSet");

/**
 * Map vs Object:
 *   - Map keys can be ANY type (objects, functions, etc.)
 *   - Map maintains insertion order (guaranteed)
 *   - Map has .size property
 *   - Map is optimized for frequent additions/deletions
 *   - No prototype pollution risk
 */
const map = new Map();
const objKey = { id: 1 };
map.set(objKey, "value for object key");
map.set(42, "value for number key");
map.set("str", "value for string key");
show("Map size", map.size); // 3
show("Map.get(objKey)", map.get(objKey));
show("Map has 42", map.has(42));

// Iterate a Map:
console.log("  Map iteration:");
for (const [key, value] of map) {
  console.log(`    ${JSON.stringify(key)} => ${value}`);
}

/**
 * Set: collection of unique values
 */
const set = new Set([1, 2, 3, 2, 1]);
show("Set from [1,2,3,2,1]", [...set]); // [1, 2, 3]
set.add(4);
set.delete(1);
show("Set after add(4), delete(1)", [...set]); // [2, 3, 4]

// Set operations (ES2025 — may not be available, fallback included):
const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5, 6]);

if (typeof setA.union === "function") {
  show("Set.union", [...setA.union(setB)]);
  show("Set.intersection", [...setA.intersection(setB)]);
  show("Set.difference", [...setA.difference(setB)]);
} else {
  // Manual set operations:
  const union = new Set([...setA, ...setB]);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const difference = new Set([...setA].filter((x) => !setB.has(x)));
  show("Set union (manual)", [...union]);
  show("Set intersection (manual)", [...intersection]);
  show("Set difference (manual)", [...difference]);
}

/**
 * WeakMap / WeakSet:
 *   - Keys must be objects (or symbols in WeakMap)
 *   - Keys are held WEAKLY — if no other reference exists, they can be GC'd
 *   - NOT iterable, no .size, no .clear()
 *   - Use cases: caching metadata about objects without preventing GC,
 *     storing private data associated with objects
 */
const weakMap = new WeakMap();
let tempObj = { data: "important" };
weakMap.set(tempObj, "metadata about tempObj");
show("WeakMap.get(tempObj)", weakMap.get(tempObj));
// When tempObj is set to null and GC runs, the entry is automatically removed.

const weakSet = new WeakSet();
const wsObj = { visited: true };
weakSet.add(wsObj);
show("WeakSet.has(wsObj)", weakSet.has(wsObj)); // true

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  10. SYMBOLS AND WELL-KNOWN SYMBOLS                                    ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("10. Symbols and Well-Known Symbols");

/**
 * Symbols are unique, immutable identifiers.
 * Every Symbol() call creates a new, unique symbol — even with the same description.
 *
 * Use cases:
 *   - Unique property keys (avoid name collisions)
 *   - Well-known symbols to customize language behavior
 *   - Private-ish properties (not truly private, but not enumerable by default)
 */
const sym1 = Symbol("id");
const sym2 = Symbol("id");
show("sym1 === sym2", sym1 === sym2); // false — always unique
show("sym1.description", sym1.description); // "id"

// Symbol.for — global symbol registry:
const globalSym1 = Symbol.for("app.id");
const globalSym2 = Symbol.for("app.id");
show("Symbol.for equality", globalSym1 === globalSym2); // true — same global symbol
show("Symbol.keyFor", Symbol.keyFor(globalSym1)); // "app.id"

// Symbols as property keys:
const ID = Symbol("id");
const item = { [ID]: 123, name: "Widget" };
show("item[ID]", item[ID]); // 123
show("Object.keys (no symbols)", Object.keys(item)); // ["name"]
show("Object.getOwnPropertySymbols", Object.getOwnPropertySymbols(item)); // [Symbol(id)]

// Well-known symbols:

// Symbol.iterator — make an object iterable:
class Range {
  /** @param {number} start @param {number} end */
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { done: true, value: undefined };
      },
    };
  }
}
show("Custom iterable Range(1,5)", [...new Range(1, 5)]); // [1,2,3,4,5]

// Symbol.toPrimitive — control type conversion:
class Money {
  /** @param {number} amount @param {string} currency */
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `${this.amount} ${this.currency}`;
    return this.amount; // default
  }
}
const price = new Money(42.5, "USD");
show("+price (number hint)", +price); // 42.5
show("`${price}` (string hint)", `${price}`); // "42.5 USD"

// Symbol.hasInstance — customize instanceof:
class EvenNumber {
  static [Symbol.hasInstance](num) {
    return typeof num === "number" && num % 2 === 0;
  }
}
show("4 instanceof EvenNumber", 4 instanceof EvenNumber); // true
show("5 instanceof EvenNumber", 5 instanceof EvenNumber); // false

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  11. STRING METHODS & REGEX BASICS                                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("11. String Methods & Regex Basics");

const str = "  Hello, World! Hello, JavaScript!  ";

// Trimming:
show("trim()", str.trim());
show("trimStart()", str.trimStart());
show("trimEnd()", str.trimEnd());

// Searching:
show("includes('World')", str.includes("World")); // true
show("startsWith('  Hello')", str.startsWith("  Hello")); // true
show("endsWith('!  ')", str.endsWith("!  ")); // true
show("indexOf('Hello')", str.indexOf("Hello")); // 2
show("lastIndexOf('Hello')", str.lastIndexOf("Hello")); // 18

// Extraction:
show("slice(2, 7)", str.slice(2, 7)); // "Hello"
show("slice(-3)", str.slice(-3)); // "!  "

// Transformation:
show("replaceAll('Hello', 'Hi')", str.replaceAll("Hello", "Hi"));
show("padStart(40, '-')", "hi".padStart(10, "-")); // "--------hi"
show("padEnd(10, '-')", "hi".padEnd(10, "-")); // "hi--------"
show("repeat(3)", "ab".repeat(3)); // "ababab"

// at() (ES2022):
show("'hello'.at(-1)", "hello".at(-1)); // "o"

// Regex basics:
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
show("Email valid", emailRegex.test("user@example.com")); // true
show("Email invalid", emailRegex.test("not-an-email")); // false

// matchAll (returns iterator):
const text = "Dates: 2024-01-15 and 2024-06-20";
const dateRegex = /(\d{4})-(\d{2})-(\d{2})/g;
const matches = [...text.matchAll(dateRegex)];
show(
  "matchAll results",
  matches.map((m) => ({ full: m[0], year: m[1], month: m[2], day: m[3] }))
);

// replaceAll with regex:
show(
  "Replace digits",
  "a1b2c3".replaceAll(/\d/g, "#")
); // "a#b#c#"

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  12. ERROR HANDLING PATTERNS                                           ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("12. Error Handling Patterns");

/**
 * INTERVIEW POINTS:
 *   - try/catch/finally — finally ALWAYS runs (even after return)
 *   - Custom error classes for domain-specific errors
 *   - Error cause (ES2022) for error chaining
 *   - Never catch errors silently in production
 */

// Basic try/catch/finally:
function riskyOperation() {
  try {
    const result = JSON.parse('{"valid": true}');
    show("Parsed successfully", result);
    return result;
  } catch (error) {
    console.error("  Parse failed:", error.message);
    return null;
  } finally {
    // This runs even after the return above
    console.log("  (finally block always executes)");
  }
}
riskyOperation();

// Custom error classes:
class AppError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} statusCode
   * @param {object} [options]
   */
  constructor(message, code, statusCode, options) {
    super(message, options); // options.cause for error chaining
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

class NotFoundError extends AppError {
  /** @param {string} resource @param {string} id */
  constructor(resource, id) {
    super(`${resource} with id '${id}' not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
    this.resource = resource;
  }
}

class ValidationError extends AppError {
  /** @param {string} field @param {string} reason */
  constructor(field, reason) {
    super(`Validation failed for '${field}': ${reason}`, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.field = field;
  }
}

// Error cause chaining (ES2022):
function fetchUser(id) {
  try {
    if (id < 0) throw new RangeError("ID must be positive");
    throw new NotFoundError("User", String(id));
  } catch (originalError) {
    throw new AppError("Failed to fetch user", "FETCH_ERROR", 500, {
      cause: originalError,
    });
  }
}

try {
  fetchUser(999);
} catch (error) {
  show("Error name", error.name);
  show("Error message", error.message);
  show("Error cause", error.cause?.message);
  show("instanceof AppError", error instanceof AppError);
}

// Pattern: aggregate errors
const errors = [
  new ValidationError("email", "Invalid format"),
  new ValidationError("age", "Must be positive"),
];
const aggError = new AggregateError(errors, "Multiple validation errors");
show("AggregateError.errors count", aggError.errors.length);

// Error.isError (if available — very new proposal):
show("error instanceof Error", new Error() instanceof Error); // true

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  13. COMMON GOTCHAS                                                    ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("13. Common Gotchas (NaN, floating point, implicit coercion)");

// --- NaN ---
/**
 * NaN is the only value in JS that is not equal to itself.
 * Use Number.isNaN() — NOT the global isNaN() which coerces first.
 */
show("NaN === NaN", NaN === NaN); // false
show("Number.isNaN(NaN)", Number.isNaN(NaN)); // true
show("Number.isNaN('hello')", Number.isNaN("hello")); // false (correct)
show("isNaN('hello')", isNaN("hello")); // true (misleading! coerces to NaN first)
show("Object.is(NaN, NaN)", Object.is(NaN, NaN)); // true — Object.is handles NaN

// --- Floating point ---
show("0.1 + 0.2 === 0.3", 0.1 + 0.2 === 0.3); // false
show("0.1 + 0.2", 0.1 + 0.2); // 0.30000000000000004

// Solutions:
show(
  "Math.abs difference < epsilon",
  Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON
); // true
show("Multiply first", (0.1 * 10 + 0.2 * 10) / 10 === 0.3); // true

// --- Implicit coercion gotchas ---
show("[] + []", [] + []); // "" (arrays coerce to strings)
show("[] + {}", [] + {}); // "[object Object]"
show("{} + []", {} + []); // "[object Object]" (in expression context)
show("[1] + [2]", [1] + [2]); // "12"
show("true + true", true + true); // 2
show("'5' - 3", "5" - 3); // 2 (- coerces to number)
show("'5' + 3", "5" + 3); // "53" (+ prefers string concatenation)

// --- Other gotchas ---
show("+0 === -0", +0 === -0); // true
show("Object.is(+0, -0)", Object.is(+0, -0)); // false
show("1 / +0", 1 / +0); // Infinity
show("1 / -0", 1 / -0); // -Infinity

// parseInt gotcha:
show("parseInt('08')", parseInt("08")); // 8 (OK in modern JS)
show("parseInt('0x10')", parseInt("0x10")); // 16 (hex prefix)
show("parseInt('123abc')", parseInt("123abc")); // 123 (stops at non-digit)
show("parseInt('')", parseInt("")); // NaN
show("Number('')", Number("")); // 0 — different from parseInt!

// Array sort gotcha:
const numArr = [10, 9, 8, 1, 2, 3];
show("sort() default (lexicographic)", [...numArr].sort()); // [1, 10, 2, 3, 8, 9]
show(
  "sort() numeric",
  [...numArr].sort((a, b) => a - b)
); // [1, 2, 3, 8, 9, 10]

// delete does not change array length:
const delArr = [1, 2, 3];
delete delArr[1];
show("After delete arr[1]", delArr); // [1, <1 empty item>, 3]
show("Length unchanged", delArr.length); // 3

// typeof in expressions:
show("typeof typeof 42", typeof typeof 42); // "string" — typeof always returns a string

console.log(`\n${"=".repeat(72)}`);
console.log("  01_javascript_fundamentals.js — All sections complete!");
console.log(`${"=".repeat(72)}\n`);
