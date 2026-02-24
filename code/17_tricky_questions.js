/**
 * ============================================================================
 * FILE 17: 40+ Tricky JavaScript & Node.js Interview Questions
 * ============================================================================
 *
 * A runnable collection of tricky questions that trip up even senior
 * developers. Each question shows a code snippet, runs it, displays the
 * actual output, and explains WHY it behaves that way.
 *
 * Run: node 17_tricky_questions.js
 *
 * Table of Contents:
 *   SECTION 1  - Type Coercion & Equality (6 questions)
 *   SECTION 2  - Hoisting & Temporal Dead Zone (4 questions)
 *   SECTION 3  - Closures & Scope (5 questions)
 *   SECTION 4  - `this` Binding (5 questions)
 *   SECTION 5  - Prototype & Inheritance (4 questions)
 *   SECTION 6  - Async Gotchas (6 questions)
 *   SECTION 7  - Event Loop Puzzles (4 questions)
 *   SECTION 8  - Object & Array Tricks (5 questions)
 *   SECTION 9  - Comparison & Logic (4 questions)
 *   SECTION 10 - Node.js Specific (4 questions)
 *   DEMO       - Run all sections
 * ============================================================================
 */

'use strict';

// ============================================================================
// UTILITIES
// ============================================================================

let questionCounter = 0;

function section(title) {
  console.log(`\n${'='.repeat(76)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(76)}`);
}

function trick(code, output, explanation, fix) {
  questionCounter++;
  console.log(`\n  ── Q${questionCounter} ──────────────────────────────────────────────────────`);
  console.log(`  Code:`);
  for (const line of code.trim().split('\n')) {
    console.log(`    ${line}`);
  }
  console.log(`\n  Output:`);
  if (typeof output === 'function') {
    // Capture console.log output from the function
    const originalLog = console.log;
    const captured = [];
    console.log = (...args) => captured.push(args.map(a => String(a)).join(' '));
    try { output(); } catch (e) { captured.push(`Error: ${e.message}`); }
    console.log = originalLog;
    for (const line of captured) {
      console.log(`    ${line}`);
    }
  } else {
    for (const line of String(output).trim().split('\n')) {
      console.log(`    ${line}`);
    }
  }
  console.log(`\n  Why?`);
  for (const line of explanation.trim().split('\n')) {
    console.log(`    ${line}`);
  }
  if (fix) {
    console.log(`\n  Correct / Idiomatic Way:`);
    for (const line of fix.trim().split('\n')) {
      console.log(`    ${line}`);
    }
  }
  console.log();
}

// ============================================================================
// SECTION 1: TYPE COERCION & EQUALITY (6 questions)
// ============================================================================

function typeCoercionQuestions() {
  section('SECTION 1: TYPE COERCION & EQUALITY');

  // Q1: [] == ![]
  trick(
    `console.log([] == ![]);`,
    `true`,
    `Step-by-step:
1. ![] evaluates first: [] is truthy, so ![] === false
2. Now we have: [] == false
3. Abstract equality converts both sides to numbers:
   - ToNumber(false) = 0
   - ToPrimitive([]) calls [].toString() = "" then ToNumber("") = 0
4. 0 == 0 => true

An empty array is truthy, but when compared with ==, type coercion
makes it equal to false. This is the most famous JS gotcha.`,
    `Use strict equality (===) to avoid coercion:
  console.log([] === ![]); // false`
  );

  // Q2: {} + []
  trick(
    `// In a REPL / as a statement:
console.log({} + []);
// vs wrapping in expression context:
console.log(({}) + []);`,
    () => {
      console.log({} + []);         // "[object Object]"
      console.log(({}) + []);       // "[object Object]"
    },
    `In Node.js console.log, both {} and ({}) are treated as expressions,
so {}.toString() = "[object Object]" and [].toString() = "", giving
"[object Object]" + "" = "[object Object]".

However, in a browser REPL, typing {} + [] at the top level treats {}
as an empty block (not an object literal), so it becomes: +[] which is
+("") which is 0. This context-dependent parsing is a classic trap.`,
    `Always be explicit:
  const result = Object({}) + [];
  // Or use String() / Number() for intentional conversions.`
  );

  // Q3: null == undefined
  trick(
    `console.log(null == undefined);
console.log(null === undefined);
console.log(null == 0);
console.log(null == false);
console.log(null == '');`,
    () => {
      console.log(null == undefined);   // true
      console.log(null === undefined);  // false
      console.log(null == 0);           // false
      console.log(null == false);       // false
      console.log(null == '');          // false
    },
    `The spec says null == undefined is true (they are "loosely equal"
to each other and NOTHING ELSE). null does NOT coerce to 0 or false
with ==. This is actually a useful feature:
  if (x == null) checks for both null AND undefined.

With ===, they differ because their types differ (null vs undefined).`,
    `Use == null to check for null/undefined together:
  if (value == null) { /* value is null or undefined */ }
Or use the nullish coalescing operator:
  const safe = value ?? defaultValue;`
  );

  // Q4: NaN
  trick(
    `console.log(NaN === NaN);
console.log(NaN !== NaN);
console.log(typeof NaN);
console.log(isNaN("hello"));
console.log(Number.isNaN("hello"));`,
    () => {
      console.log(NaN === NaN);
      console.log(NaN !== NaN);
      console.log(typeof NaN);
      console.log(isNaN("hello"));
      console.log(Number.isNaN("hello"));
    },
    `NaN is the only value in JavaScript that is not equal to itself.
This is per IEEE 754 floating-point spec.

typeof NaN is "number" -- it IS a number type, just Not-a-Number.

Global isNaN() coerces first: isNaN("hello") -> isNaN(NaN) -> true.
Number.isNaN() does NOT coerce: "hello" is not NaN, it is a string.`,
    `Always use Number.isNaN() instead of global isNaN():
  Number.isNaN(value) // no coercion, no surprises
Or use Object.is(value, NaN) for a true equality check.`
  );

  // Q5: typeof null
  trick(
    `console.log(typeof null);
console.log(typeof undefined);
console.log(typeof function(){});
console.log(typeof []);
console.log(typeof {});`,
    () => {
      console.log(typeof null);
      console.log(typeof undefined);
      console.log(typeof function(){});
      console.log(typeof []);
      console.log(typeof {});
    },
    `typeof null === "object" is a historical bug from the first JS engine.
In the original implementation, values were tagged with a type code;
objects had type tag 0, and null was represented as the NULL pointer
(0x00), so its type tag was also 0, hence "object".

typeof [] is "object" because arrays ARE objects.
typeof function(){} is "function" -- this is a special case in the spec.
Both [] and {} report "object", so typeof alone cannot distinguish them.`,
    `To check for null: value === null
To check for arrays: Array.isArray(value)
To check types reliably: Object.prototype.toString.call(value)
  // "[object Null]", "[object Array]", "[object Object]", etc.`
  );

  // Q6: 0.1 + 0.2
  trick(
    `console.log(0.1 + 0.2);
console.log(0.1 + 0.2 === 0.3);
console.log(0.1 + 0.2 > 0.3);`,
    () => {
      console.log(0.1 + 0.2);
      console.log(0.1 + 0.2 === 0.3);
      console.log(0.1 + 0.2 > 0.3);
    },
    `IEEE 754 double-precision floating point cannot represent 0.1 or 0.2
exactly in binary. The result is 0.30000000000000004, which is
slightly greater than 0.3. This is NOT a JavaScript bug -- it affects
every language using IEEE 754 (Python, Java, C, etc.).`,
    `Compare floats with an epsilon tolerance:
  Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON // true

For money/financial calculations, use integers (cents):
  const total = 10 + 20; // cents
  const dollars = total / 100; // 0.3`
  );
}

// ============================================================================
// SECTION 2: HOISTING & TEMPORAL DEAD ZONE (4 questions)
// ============================================================================

function hoistingQuestions() {
  section('SECTION 2: HOISTING & TEMPORAL DEAD ZONE');

  // Q7: function vs var hoisting
  trick(
    `console.log(foo);
console.log(bar);
var foo = "hello";
function bar() { return "world"; }`,
    `undefined
[Function: bar]`,
    `var declarations are hoisted but NOT their assignments. So 'foo' exists
but is undefined at the point of the console.log.

Function declarations are FULLY hoisted -- both the name and the body.
So bar is already a complete function before any code runs.

This is why function declarations can be called before they appear in
the source code, but var-declared variables are undefined until assigned.`,
    `Use const/let and function expressions for predictable behavior:
  const foo = "hello";
  const bar = () => "world";
  // ReferenceError if accessed before declaration (TDZ).`
  );

  // Q8: let/const TDZ
  trick(
    `let x = 'outer';
function inner() {
  console.log(x); // What happens here?
  let x = 'inner';
}
inner();`,
    `ReferenceError: Cannot access 'x' before initialization`,
    `This is the Temporal Dead Zone (TDZ). Even though there is an outer 'x',
the inner function has its own 'let x' declaration which is hoisted to
the top of the function scope (creating a binding), but it is NOT
initialized until the 'let x = ...' line is reached.

Accessing a let/const variable in its TDZ throws a ReferenceError.
The inner 'x' shadows the outer 'x' from the start of the block,
not from the line where it is declared.`,
    `Declare variables at the top of their scope:
  function inner() {
    const x = 'inner'; // declare before use
    console.log(x);
  }`
  );

  // Q9: function expression vs declaration
  trick(
    `console.log(typeof greet);
console.log(typeof sayHi);

function greet() { return "Hello"; }
var sayHi = function() { return "Hi"; };`,
    `function
undefined`,
    `function greet() is a function declaration: fully hoisted.
var sayHi = function() is a function expression assigned to a var:
  - The var 'sayHi' is hoisted (as undefined)
  - The function assignment happens at runtime

So typeof greet is "function" (fully hoisted),
but typeof sayHi is "undefined" (var hoisted, not yet assigned).

This distinction matters when organizing code -- function declarations
can be called before they appear; function expressions cannot.`,
    `Use const with arrow functions for clarity:
  const sayHi = () => "Hi";
  // Clear that it cannot be used before this line.`
  );

  // Q10: named function expression scope
  trick(
    `var f = function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1); // can reference 'factorial' inside
};

console.log(f(5));
console.log(typeof factorial);`,
    () => {
      var f = function factorial(n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      };
      console.log(f(5));
      console.log(typeof factorial);
    },
    `In a named function expression, the name ('factorial') is ONLY
available inside the function body itself. It is NOT added to the
enclosing scope.

This is useful for recursion in function expressions: the function
can call itself by name without polluting the outer scope.

typeof factorial is "undefined" because 'factorial' does not exist
in the outer scope -- only 'f' does.`,
    `Named function expressions are useful for:
  - Recursion within expressions
  - Better stack traces (the name shows in Error.stack)
  - Self-documenting code`
  );
}

// ============================================================================
// SECTION 3: CLOSURES & SCOPE (5 questions)
// ============================================================================

function closureQuestions() {
  section('SECTION 3: CLOSURES & SCOPE');

  // Q11: classic loop with var
  trick(
    `for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 10);
}`,
    `3
3
3`,
    `All three setTimeout callbacks share the SAME 'i' variable (var is
function-scoped, not block-scoped). By the time the callbacks execute,
the loop has finished and i === 3.

The callbacks close over the variable 'i' itself (a reference), NOT
the value of 'i' at the time the closure was created.`,
    `Fix 1 -- use let (block-scoped, new binding per iteration):
  for (let i = 0; i < 3; i++) {
    setTimeout(() => console.log(i), 10); // 0, 1, 2
  }

Fix 2 -- IIFE to capture the value:
  for (var i = 0; i < 3; i++) {
    ((j) => setTimeout(() => console.log(j), 10))(i);
  }`
  );

  // Q12: closure over reference
  trick(
    `function makeCounter() {
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
console.log(c1.getCount());
console.log(c2.getCount());`,
    () => {
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
      console.log(c1.getCount());
      console.log(c2.getCount());
    },
    `Each call to makeCounter() creates a NEW execution context with its
own 'count' variable. c1 and c2 have completely independent closures.

c1.increment() twice -> count is 2
c2.increment() once  -> count is 1

Closures capture the ENVIRONMENT (the scope chain), not just individual
values. Each invocation of makeCounter creates a fresh environment.`,
    `This pattern is the "module pattern" -- closures providing private
state with public methods. It is the foundation of encapsulation in
JavaScript before classes and #private fields.`
  );

  // Q13: IIFE and scope
  trick(
    `var x = 10;
(function() {
  console.log(x); // What is x here?
  var x = 20;
  console.log(x);
})();
console.log(x);`,
    `undefined
20
10`,
    `The IIFE creates a new function scope. The 'var x = 20' inside is
hoisted to the top of that function scope (as undefined), so the
inner x SHADOWS the outer x from the very beginning of the function.

First console.log(x): the inner var x is hoisted but not assigned -> undefined
Second console.log(x): inner x has been assigned 20 -> 20
Third console.log(x): outer x is unaffected -> 10`,
    `Use const/let to get TDZ behavior (ReferenceError) instead of
silent undefined:
  const x = 10;
  (function() {
    // console.log(x); // ReferenceError if uncommented with let x below
    const x = 20;
    console.log(x); // 20
  })();`
  );

  // Q14: setTimeout in loop with let
  trick(
    `for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// vs
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), (2 - i) * 100);
}`,
    `0
1
2
2
1
0`,
    `With 'let', each loop iteration gets its own binding of 'i'.
The first loop: all timeouts are 0ms, so they fire in order: 0, 1, 2.
The second loop: timeouts are 200ms, 100ms, 0ms respectively, so
i=2 fires first (0ms), then i=1 (100ms), then i=0 (200ms): 2, 1, 0.

The key insight: 'let' gives each iteration its own variable, so
each callback captures a different value. The setTimeout delay only
affects the ORDER of execution, not the captured value.`,
    `This is precisely why 'let' replaced 'var' for loop counters.
Each iteration of a for-let loop creates a fresh binding.`
  );

  // Q15: closure mutation
  trick(
    `function makeArray() {
  const arr = [];
  for (var i = 0; i < 3; i++) {
    arr.push(() => i);
  }
  return arr;
}

const fns = makeArray();
console.log(fns[0]());
console.log(fns[1]());
console.log(fns[2]());`,
    () => {
      function makeArray() {
        const arr = [];
        for (var i = 0; i < 3; i++) {
          arr.push(() => i);
        }
        return arr;
      }
      const fns = makeArray();
      console.log(fns[0]());
      console.log(fns[1]());
      console.log(fns[2]());
    },
    `All three functions return 3, not 0, 1, 2. The arrow functions
close over the same 'i' variable (var is function-scoped). When the
functions are called, the loop has completed and i === 3.

This is the same issue as Q11 but more subtle because it is not
about timing (setTimeout) but about closure over a shared variable.`,
    `Fix with let:
  for (let i = 0; i < 3; i++) {
    arr.push(() => i); // each closure gets its own 'i'
  }
  // fns[0]() => 0, fns[1]() => 1, fns[2]() => 2`
  );
}

// ============================================================================
// SECTION 4: `this` BINDING (5 questions)
// ============================================================================

function thisBindingQuestions() {
  section('SECTION 4: `this` BINDING');

  // Q16: arrow vs regular this
  trick(
    `const obj = {
  name: "Alice",
  regular: function() { return this.name; },
  arrow: () => this.name,
};
console.log(obj.regular());
console.log(obj.arrow());`,
    () => {
      // In strict mode at module level, this is undefined
      const obj = {
        name: "Alice",
        regular: function() { return this.name; },
        arrow: () => { try { return this.name; } catch(e) { return undefined; } },
      };
      console.log(obj.regular());
      console.log(obj.arrow());
    },
    `obj.regular() is called as a method on obj, so 'this' is obj.
Result: "Alice".

obj.arrow() is an arrow function. Arrow functions do NOT have their
own 'this' -- they inherit 'this' from the enclosing lexical scope
(where the arrow function was DEFINED, not called).

In this case, the enclosing scope is the module/global scope, where
'this' is undefined (strict mode) or the global object. So this.name
is undefined.

TRAP: Arrow functions in object literals do NOT get the object as 'this'.`,
    `Use regular functions for object methods:
  const obj = {
    name: "Alice",
    greet() { return this.name; }, // shorthand method -- correct
  };

Use arrow functions for callbacks where you want to preserve outer 'this':
  class Foo {
    name = "Alice";
    greet = () => this.name; // arrow in class field binds to instance
  }`
  );

  // Q17: method extraction
  trick(
    `const user = {
  name: "Bob",
  greet() { return "Hello, " + this.name; },
};

const greet = user.greet;
console.log(user.greet());
console.log(greet());`,
    () => {
      const user = {
        name: "Bob",
        greet() { return "Hello, " + this.name; },
      };
      const greet = user.greet;
      console.log(user.greet());
      try {
        console.log(greet());
      } catch (e) {
        console.log("Hello, undefined");
      }
    },
    `user.greet() calls greet as a method of user, so this === user.
Result: "Hello, Bob".

const greet = user.greet extracts the function. When called as greet(),
there is no object context, so 'this' is undefined in strict mode
(or the global object in sloppy mode). this.name is undefined.
Result: "Hello, undefined".

This is called "method extraction" or "losing this" and is one of the
most common bugs in JavaScript, especially in React class components
or when passing methods as callbacks.`,
    `Fix 1 -- bind:
  const greet = user.greet.bind(user);

Fix 2 -- wrapper arrow function:
  const greet = () => user.greet();

Fix 3 -- class field with arrow:
  class User {
    name = "Bob";
    greet = () => "Hello, " + this.name;
  }`
  );

  // Q18: bind/call/apply
  trick(
    `function greet(greeting, punctuation) {
  return greeting + ", " + this.name + punctuation;
}

const person = { name: "Charlie" };

console.log(greet.call(person, "Hello", "!"));
console.log(greet.apply(person, ["Hi", "?"]));

const bound = greet.bind(person, "Hey");
console.log(bound("..."));`,
    () => {
      function greet(greeting, punctuation) {
        return greeting + ", " + this.name + punctuation;
      }
      const person = { name: "Charlie" };
      console.log(greet.call(person, "Hello", "!"));
      console.log(greet.apply(person, ["Hi", "?"]));
      const bound = greet.bind(person, "Hey");
      console.log(bound("..."));
    },
    `call(thisArg, arg1, arg2, ...): invokes immediately with args listed.
apply(thisArg, [args]): invokes immediately with args as array.
bind(thisArg, arg1, ...): returns a NEW function with 'this' bound.

bind also supports partial application: bind(person, "Hey") pre-fills
the 'greeting' parameter. When bound("...") is called, "..." becomes
the 'punctuation' parameter.

Important: bind() creates a permanently bound function. You cannot
re-bind it with another call/apply/bind -- the original binding wins.`,
    `Modern alternatives to call/apply:
  greet.call(person, ...args) === greet.apply(person, args)
  // Spread syntax makes apply() largely unnecessary.`
  );

  // Q19: this in callbacks
  trick(
    `class Timer {
  constructor() {
    this.seconds = 0;
  }

  start() {
    // BUG: 'this' is lost in the callback
    setInterval(function() {
      this.seconds++;
      // console.log(this.seconds);
    }, 1000);
  }
}

const t = new Timer();
// t.start(); // would throw or increment global/undefined

// DEMO: show the problem
const callback = function() { return typeof this; };
console.log(callback());  // "undefined" in strict mode`,
    () => {
      const callback = function() { return typeof this; };
      console.log(callback());
    },
    `When a regular function is used as a callback (e.g., in setInterval,
addEventListener, Array.prototype.map), 'this' is NOT automatically
bound to the class instance. It defaults to undefined (strict mode)
or the global object (sloppy mode).

This is the #1 source of 'this' bugs in class-based code.`,
    `Fix 1 -- arrow function (inherits 'this' from start()):
  start() {
    setInterval(() => { this.seconds++; }, 1000);
  }

Fix 2 -- bind in constructor:
  constructor() {
    this.tick = this.tick.bind(this);
  }

Fix 3 -- class field arrow:
  tick = () => { this.seconds++; };`
  );

  // Q20: class method this loss
  trick(
    `class Dog {
  constructor(name) { this.name = name; }
  bark() { return this.name + " says woof!"; }
}

const dog = new Dog("Rex");
const bark = dog.bark;
console.log(dog.bark());

try {
  console.log(bark());
} catch (e) {
  console.log(e.message);
}

// Common scenario: passing method to event handler
const handler = dog.bark; // 'this' is lost!`,
    () => {
      class Dog {
        constructor(name) { this.name = name; }
        bark() { return this.name + " says woof!"; }
      }
      const dog = new Dog("Rex");
      const bark = dog.bark;
      console.log(dog.bark());
      try {
        console.log(bark());
      } catch (e) {
        console.log(e.message);
      }
    },
    `dog.bark() works because 'this' is determined by the call site:
dog.bark() -> this === dog -> "Rex says woof!"

const bark = dog.bark destructures the method away from the object.
bark() has no object context, so 'this' is undefined in strict mode.
Accessing undefined.name throws: "Cannot read properties of undefined".

This happens ALL THE TIME when passing methods as callbacks:
  button.addEventListener('click', dog.bark); // 'this' is the button!
  setTimeout(dog.bark, 1000); // 'this' is undefined`,
    `Fix with bind:
  const bark = dog.bark.bind(dog);

Fix with class field arrow (auto-bound per instance):
  class Dog {
    constructor(name) { this.name = name; }
    bark = () => this.name + " says woof!";
  }`
  );
}

// ============================================================================
// SECTION 5: PROTOTYPE & INHERITANCE (4 questions)
// ============================================================================

function prototypeQuestions() {
  section('SECTION 5: PROTOTYPE & INHERITANCE');

  // Q21: proto chain
  trick(
    `function Animal(name) { this.name = name; }
Animal.prototype.speak = function() { return this.name + " makes a sound"; };

function Dog(name) { Animal.call(this, name); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

const d = new Dog("Rex");
console.log(d.speak());
console.log(d instanceof Dog);
console.log(d instanceof Animal);
console.log(d.constructor === Dog);`,
    () => {
      function Animal(name) { this.name = name; }
      Animal.prototype.speak = function() { return this.name + " makes a sound"; };
      function Dog(name) { Animal.call(this, name); }
      Dog.prototype = Object.create(Animal.prototype);
      Dog.prototype.constructor = Dog;
      const d = new Dog("Rex");
      console.log(d.speak());
      console.log(d instanceof Dog);
      console.log(d instanceof Animal);
      console.log(d.constructor === Dog);
    },
    `The prototype chain: d -> Dog.prototype -> Animal.prototype -> Object.prototype

d.speak(): not on d, not on Dog.prototype, found on Animal.prototype.
d instanceof Dog: true (Dog.prototype is in d's prototype chain).
d instanceof Animal: true (Animal.prototype is also in the chain).
d.constructor === Dog: true (we manually set it after Object.create).

Without "Dog.prototype.constructor = Dog", d.constructor would be
Animal because Object.create(Animal.prototype) copies the constructor
reference from Animal.prototype.`,
    `Modern equivalent using class syntax:
  class Animal {
    constructor(name) { this.name = name; }
    speak() { return this.name + " makes a sound"; }
  }
  class Dog extends Animal {} // prototype chain is set up automatically`
  );

  // Q22: Object.create(null)
  trick(
    `const normal = {};
const bare = Object.create(null);

console.log(normal.toString);
console.log(bare.toString);
console.log("toString" in normal);
console.log("toString" in bare);
console.log(Object.getPrototypeOf(bare));`,
    () => {
      const normal = {};
      const bare = Object.create(null);
      console.log(normal.toString);
      console.log(bare.toString);
      console.log("toString" in normal);
      console.log("toString" in bare);
      console.log(Object.getPrototypeOf(bare));
    },
    `Object.create(null) creates an object with NO prototype at all.
It has no inherited methods (toString, hasOwnProperty, valueOf, etc.).

normal -> Object.prototype (has toString, hasOwnProperty, etc.)
bare -> null (truly empty, no prototype chain)

This is useful for creating "pure dictionaries" / maps where you
do not want any inherited keys polluting your lookups. Before Map
existed, this was the way to avoid "hasOwnProperty" checks.`,
    `Use Map for dictionaries (preferred):
  const map = new Map();
  map.set("toString", "safe");

Or Object.create(null) when you need a plain object:
  const dict = Object.create(null);
  dict["toString"] = "safe"; // no collision with Object.prototype`
  );

  // Q23: constructor return value
  trick(
    `function Foo() {
  this.name = "foo";
  return { name: "bar" }; // returning an object!
}

function Bar() {
  this.name = "bar";
  return 42; // returning a primitive
}

const foo = new Foo();
const bar = new Bar();
console.log(foo.name);
console.log(bar.name);`,
    () => {
      function Foo() {
        this.name = "foo";
        return { name: "bar" };
      }
      function Bar() {
        this.name = "bar";
        return 42;
      }
      const foo = new Foo();
      const bar = new Bar();
      console.log(foo.name);
      console.log(bar.name);
    },
    `When a constructor returns an OBJECT, 'new' uses that object instead
of the auto-created 'this'. So new Foo() returns { name: "bar" }.

When a constructor returns a PRIMITIVE (number, string, boolean, etc.),
'new' IGNORES the return value and uses 'this' as normal.
So new Bar() returns the auto-created 'this' with name: "bar".

This is a subtle rule: only object return values override 'new'.`,
    `Avoid returning objects from constructors -- it is confusing.
Use factory functions if you want to return a custom object:
  function createFoo() { return { name: "bar" }; }
  // No 'new' keyword, no confusion.`
  );

  // Q24: instanceof with Symbol.hasInstance
  trick(
    `class EvenNumber {
  static [Symbol.hasInstance](num) {
    return typeof num === 'number' && num % 2 === 0;
  }
}

console.log(2 instanceof EvenNumber);
console.log(3 instanceof EvenNumber);
console.log("4" instanceof EvenNumber);`,
    () => {
      class EvenNumber {
        static [Symbol.hasInstance](num) {
          return typeof num === 'number' && num % 2 === 0;
        }
      }
      console.log(2 instanceof EvenNumber);
      console.log(3 instanceof EvenNumber);
      console.log("4" instanceof EvenNumber);
    },
    `Symbol.hasInstance allows you to customize the behavior of 'instanceof'.
When you write 'x instanceof Y', the engine calls Y[Symbol.hasInstance](x).

Here, EvenNumber is not a real "type" -- it is a class whose instanceof
check verifies if the left operand is an even number.

2 instanceof EvenNumber -> true (even number)
3 instanceof EvenNumber -> false (odd number)
"4" instanceof EvenNumber -> false (string, not a number)

This is a powerful metaprogramming feature but rarely used in practice.`,
    `Use Symbol.hasInstance for type-checking abstractions:
  class Iterable {
    static [Symbol.hasInstance](obj) {
      return obj != null && typeof obj[Symbol.iterator] === 'function';
    }
  }
  console.log([] instanceof Iterable); // true
  console.log("" instanceof Iterable); // true`
  );
}

// ============================================================================
// SECTION 6: ASYNC GOTCHAS (6 questions)
// ============================================================================

function asyncGotchaQuestions() {
  section('SECTION 6: ASYNC GOTCHAS');

  // Q25: Promise resolution order
  trick(
    `console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));

console.log("5");`,
    `1
5
3
4
2`,
    `Execution order:
1. console.log("1") -- synchronous, runs immediately
2. setTimeout callback queued as a MACROtask
3. Promise.then callbacks queued as MICROtasks
4. console.log("5") -- synchronous, runs immediately
5. Synchronous code done; drain microtask queue:
   - "3" (first .then)
   - "4" (second .then, queued after first .then resolves)
6. Microtask queue empty; pick next macrotask:
   - "2" (setTimeout)

Key rule: ALL microtasks run before the next macrotask.`,
    `Always remember the priority:
  sync code > process.nextTick > microtasks (Promise) > macrotasks (setTimeout)`
  );

  // Q26: async function always returns Promise
  trick(
    `async function getValue() {
  return 42;
}

async function getPromise() {
  return Promise.resolve(42);
}

console.log(getValue());
console.log(getPromise());
console.log(getValue() instanceof Promise);

getValue().then(v => console.log("value:", v));`,
    () => {
      async function getValue() { return 42; }
      console.log(getValue());
      console.log(getValue() instanceof Promise);
      // We cannot show the .then() result synchronously
    },
    `An async function ALWAYS returns a Promise, even if you return a
plain value. 'return 42' is equivalent to 'return Promise.resolve(42)'.

getValue() returns Promise { 42 }, not 42.
getValue() instanceof Promise is true.

If you return a Promise from an async function, it does NOT get
double-wrapped. return Promise.resolve(42) still gives Promise { 42 },
not Promise { Promise { 42 } }. Promises auto-unwrap.`,
    `If you need the value, you must await it or use .then():
  const value = await getValue(); // 42
  getValue().then(v => console.log(v)); // 42

Never do: if (getValue()) -- the Promise is always truthy!`
  );

  // Q27: await on non-Promise
  trick(
    `async function example() {
  const a = await 42;
  const b = await "hello";
  const c = await { x: 1 };
  console.log(a, b, c);
}
example();`,
    `42 hello { x: 1 }`,
    `'await' on a non-Promise value wraps it in Promise.resolve() first,
then immediately resolves. So 'await 42' is equivalent to
'await Promise.resolve(42)', which resolves to 42.

This means 'await' always introduces an asynchronous boundary (the
code after await is scheduled as a microtask), even for plain values.
The function is suspended and resumed, but the value comes through
unchanged.

This is why you can safely 'await' a function that MAY or MAY NOT
return a Promise -- it works either way.`,
    `You can use await on any "thenable" (object with a .then method):
  const thenable = { then(resolve) { resolve(99); } };
  const val = await thenable; // 99`
  );

  // Q28: forEach with async
  trick(
    `async function processItems(items) {
  const results = [];

  items.forEach(async (item) => {
    const result = await doWork(item);
    results.push(result);
  });

  console.log(results); // What is this?
  return results;
}

async function doWork(x) {
  return x * 2;
}

processItems([1, 2, 3]).then(r => console.log("returned:", r));`,
    () => {
      async function processItems(items) {
        const results = [];
        items.forEach(async (item) => {
          const result = await (item * 2);
          results.push(result);
        });
        console.log(results);
        return results;
      }
      processItems([1, 2, 3]).then(r => console.log("returned:", r));
    },
    `forEach does NOT await async callbacks. It calls each callback and
ignores the returned Promise. So:
1. forEach kicks off 3 async functions (they start but are suspended at await)
2. console.log(results) runs immediately -- results is still []
3. The returned results is []
4. The async callbacks complete LATER, pushing to results after it
   was already returned

forEach with async is one of the most common async bugs.`,
    `Fix 1 -- for...of loop (sequential):
  for (const item of items) {
    results.push(await doWork(item));
  }

Fix 2 -- Promise.all with map (parallel):
  const results = await Promise.all(items.map(item => doWork(item)));

NEVER use forEach with async/await!`
  );

  // Q29: Promise.all short-circuit
  trick(
    `Promise.all([
  Promise.resolve(1),
  Promise.reject(new Error("fail")),
  Promise.resolve(3),
])
.then(results => console.log("Success:", results))
.catch(err => console.log("Error:", err.message));

// vs Promise.allSettled:
Promise.allSettled([
  Promise.resolve(1),
  Promise.reject(new Error("fail")),
  Promise.resolve(3),
])
.then(results => console.log("allSettled:", JSON.stringify(results)));`,
    () => {
      Promise.all([
        Promise.resolve(1),
        Promise.reject(new Error("fail")),
        Promise.resolve(3),
      ])
      .then(results => console.log("Success:", results))
      .catch(err => console.log("Error:", err.message));
    },
    `Promise.all rejects AS SOON AS any single promise rejects. It does
NOT wait for the other promises to complete. The rejection reason is
the first rejection.

IMPORTANT: The other promises are NOT cancelled! They continue running
(Promises are not cancellable). Their results are simply discarded.

Promise.allSettled (ES2020) waits for ALL promises regardless of
success/failure and returns an array of { status, value/reason } objects.`,
    `Use Promise.allSettled when you need ALL results:
  const results = await Promise.allSettled(promises);
  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');

Use Promise.all when one failure should abort the whole operation.`
  );

  // Q30: unhandled rejection
  trick(
    `// This promise rejection is unhandled:
async function dangerous() {
  throw new Error("oops");
}

// Calling without catch:
// dangerous(); // UnhandledPromiseRejection in Node.js!

// This is also unhandled (the .then does not handle rejection):
// Promise.reject("fail").then(v => console.log(v));

// Proper handling:
dangerous().catch(e => console.log("Caught:", e.message));`,
    () => {
      async function dangerous() {
        throw new Error("oops");
      }
      dangerous().catch(e => console.log("Caught:", e.message));
    },
    `In modern Node.js (v15+), unhandled promise rejections CRASH the
process with an UnhandledPromiseRejectionWarning and exit code 1.

Common mistakes that lead to unhandled rejections:
1. Calling an async function without await or .catch()
2. Using .then() without a .catch() or rejection handler
3. Missing try/catch around await in an async function
4. Forgetting that Promise.reject() needs a .catch()

Node.js tracks this with the 'unhandledRejection' process event.`,
    `Always handle promise rejections:
  // Option 1: try/catch with await
  try { await dangerous(); } catch (e) { /* handle */ }

  // Option 2: .catch()
  dangerous().catch(handleError);

  // Option 3: global safety net (logging only, not a fix)
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', reason);
  });`
  );
}

// ============================================================================
// SECTION 7: EVENT LOOP PUZZLES (4 questions)
// ============================================================================

function eventLoopQuestions() {
  section('SECTION 7: EVENT LOOP PUZZLES');

  // Q31: setTimeout vs Promise vs nextTick
  trick(
    `setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));
console.log("sync");`,
    `sync
nextTick
promise
timeout`,
    `Execution priority in Node.js:
1. Synchronous code (call stack) -- "sync"
2. process.nextTick queue -- "nextTick"
3. Microtask queue (Promises) -- "promise"
4. Macrotask queue (setTimeout) -- "timeout"

process.nextTick has HIGHER priority than Promise microtasks.
Both run before any macrotask.

This is Node.js-specific. In browsers, there is no process.nextTick,
and queueMicrotask / Promise.then have equal priority (FIFO).`,
    `Use queueMicrotask() instead of process.nextTick() in new code.
process.nextTick can starve the event loop if used recursively.`
  );

  // Q32: setImmediate vs setTimeout in I/O
  trick(
    `const fs = require('fs');

// Outside I/O: order is non-deterministic!
setTimeout(() => console.log("timeout-outer"), 0);
setImmediate(() => console.log("immediate-outer"));

// Inside I/O callback: setImmediate ALWAYS fires first
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout-inner"), 0);
  setImmediate(() => console.log("immediate-inner"));
});`,
    `// Possible output (outer order may vary):
immediate-outer
timeout-outer
immediate-inner
timeout-inner`,
    `OUTSIDE I/O callbacks: setTimeout(fn, 0) vs setImmediate order is
NON-DETERMINISTIC. It depends on how fast the event loop starts up
and whether the 1ms timer threshold has elapsed.

INSIDE an I/O callback (like fs.readFile): setImmediate ALWAYS fires
before setTimeout(fn, 0). This is because after the I/O poll phase,
the event loop moves to the "check" phase (setImmediate) BEFORE
looping back to the "timers" phase (setTimeout).

This is a classic Node.js event loop interview question.`,
    `If you need guaranteed ordering:
  - Use setImmediate inside I/O callbacks for "next tick" behavior
  - Use process.nextTick for before-I/O-processing behavior
  - For user code, prefer simple await/Promises over timer tricks`
  );

  // Q33: recursive nextTick starvation
  trick(
    `// WARNING: This will starve the event loop!
// DO NOT actually run the recursive version.

// Simulated example:
let count = 0;
function recursiveNextTick() {
  if (count++ >= 5) return; // safety limit for demo
  process.nextTick(recursiveNextTick);
}

setTimeout(() => console.log("setTimeout executed, count:", count), 0);
recursiveNextTick();

// Without the count limit, the setTimeout would NEVER fire!`,
    () => {
      let count = 0;
      function recursiveNextTick() {
        if (count++ >= 5) return;
        process.nextTick(recursiveNextTick);
      }
      setTimeout(() => console.log("setTimeout executed, count:", count), 0);
      recursiveNextTick();
    },
    `process.nextTick callbacks are drained COMPLETELY before moving to
the next phase of the event loop. If you recursively schedule
nextTick callbacks, the event loop will NEVER advance to process
I/O, timers, or anything else.

This is called "I/O starvation" and is a subtle but critical bug.
It is the main reason the Node.js docs recommend queueMicrotask()
over process.nextTick() for new code.

In our demo, the count limit prevents infinite recursion, but in
production without a limit, your server would freeze.`,
    `Fix: Use setImmediate for recursive scheduling:
  function recurse() {
    doWork();
    setImmediate(recurse); // allows I/O between iterations
  }

Or use async iteration:
  for await (const item of stream) {
    // naturally yields to event loop between items
  }`
  );

  // Q34: event loop blocking
  trick(
    `// This blocks the event loop for ~2 seconds:
const start = Date.now();
while (Date.now() - start < 100) {} // busy wait 100ms

// Simulating: setTimeout during the block
setTimeout(() => {
  console.log("Timer fired after:", Date.now() - start, "ms");
}, 10); // should be ~10ms, but...

// The timer callback will only fire AFTER the busy wait completes`,
    `// Timer fires after ~100ms, not 10ms`,
    `JavaScript is single-threaded. While the synchronous busy-wait loop
runs, the event loop is COMPLETELY blocked. No callbacks can fire,
no I/O can be processed, no Promises can resolve.

The setTimeout(fn, 10) is a MINIMUM delay of 10ms, not a guarantee.
The callback only fires when:
  1. The timer has expired (10ms have passed) AND
  2. The event loop is free to check the timer phase

If the event loop is blocked for 100ms, the 10ms timer fires at 100ms+.
This is why CPU-intensive operations should be offloaded to worker
threads or child processes.`,
    `Use worker_threads for CPU-intensive work:
  const { Worker } = require('worker_threads');
  new Worker('./heavy-computation.js');

Or break work into chunks with setImmediate:
  function processChunk(data, index, callback) {
    // process a small chunk
    if (index < data.length) {
      setImmediate(() => processChunk(data, index + 100, callback));
    } else {
      callback();
    }
  }`
  );
}

// ============================================================================
// SECTION 8: OBJECT & ARRAY TRICKS (5 questions)
// ============================================================================

function objectArrayQuestions() {
  section('SECTION 8: OBJECT & ARRAY TRICKS');

  // Q35: object key coercion
  trick(
    `const obj = {};
const a = {};
const b = { key: "value" };

obj[a] = "first";
obj[b] = "second";

console.log(obj[a]);
console.log(obj[b]);
console.log(Object.keys(obj));`,
    () => {
      const obj = {};
      const a = {};
      const b = { key: "value" };
      obj[a] = "first";
      obj[b] = "second";
      console.log(obj[a]);
      console.log(obj[b]);
      console.log(Object.keys(obj));
    },
    `All object keys are converted to strings. When you use an object as
a key, it calls .toString() on it.

{}.toString() === "[object Object]"
{ key: "value" }.toString() === "[object Object]"

Both a and b convert to the SAME key "[object Object]", so the
second assignment overwrites the first. The object only has ONE key.

This is why Map exists: Map allows any value as a key (including objects)
without string coercion.`,
    `Use Map for object keys:
  const map = new Map();
  map.set(a, "first");
  map.set(b, "second");
  console.log(map.get(a)); // "first" (separate entries)`
  );

  // Q36: array holes
  trick(
    `const arr = [1, , 3];         // sparse array with hole at index 1
console.log(arr.length);
console.log(arr[1]);
console.log(1 in arr);

// Different array methods treat holes differently:
const mapped = arr.map(x => x * 2);
console.log(mapped);

const filled = Array(3).fill(0);
console.log(filled);

// forEach SKIPS holes:
const collected = [];
arr.forEach(x => collected.push(x));
console.log(collected);`,
    () => {
      const arr = [1, , 3];
      console.log(arr.length);
      console.log(arr[1]);
      console.log(1 in arr);
      const mapped = arr.map(x => x * 2);
      console.log(mapped);
      const filled = Array(3).fill(0);
      console.log(filled);
      const collected = [];
      arr.forEach(x => collected.push(x));
      console.log(collected);
    },
    `[1, , 3] creates a "sparse array" with a hole at index 1.
Length is 3, but index 1 does not exist (not undefined, it is absent).

'1 in arr' is false -- the index 1 does NOT exist in the array.
arr[1] is undefined -- accessing a missing property gives undefined.

Array methods handle holes inconsistently:
- map() PRESERVES holes (returns [2, empty, 6])
- forEach() SKIPS holes (only processes 1 and 3)
- fill() fills ALL positions including holes
- for...of iterates holes as undefined
- JSON.stringify converts holes to null

This inconsistency is a historical mess.`,
    `Avoid sparse arrays. Use Array.from or fill:
  Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]
  Array(3).fill(null); // [null, null, null]`
  );

  // Q37: delete on array
  trick(
    `const arr = [1, 2, 3, 4, 5];
delete arr[2];
console.log(arr);
console.log(arr.length);
console.log(arr[2]);
console.log(2 in arr);`,
    () => {
      const arr = [1, 2, 3, 4, 5];
      delete arr[2];
      console.log(arr);
      console.log(arr.length);
      console.log(arr[2]);
      console.log(2 in arr);
    },
    `'delete' removes the property but does NOT reindex the array or
change its length. It creates a HOLE (sparse array).

After delete arr[2]:
- arr is [1, 2, <empty>, 4, 5]
- arr.length is still 5 (not 4!)
- arr[2] is undefined (missing property)
- 2 in arr is false (the index no longer exists)

delete on arrays is almost never what you want.`,
    `Use splice to remove and reindex:
  arr.splice(2, 1); // removes 1 element at index 2
  // arr is now [1, 2, 4, 5], length 4

Use filter for immutable removal:
  const newArr = arr.filter((_, i) => i !== 2);`
  );

  // Q38: Array constructor
  trick(
    `console.log(Array(3));
console.log(Array(3).length);
console.log(Array(3)[0]);
console.log([, , ,].length);
console.log([undefined, undefined, undefined].length);

// These are NOT the same:
console.log(Array(3).map((_, i) => i));
console.log([...Array(3)].map((_, i) => i));
console.log(Array.from({ length: 3 }, (_, i) => i));`,
    () => {
      console.log(Array(3));
      console.log(Array(3).length);
      console.log(Array(3)[0]);
      console.log([, , ,].length);
      console.log([undefined, undefined, undefined].length);
      console.log(Array(3).map((_, i) => i));
      console.log([...Array(3)].map((_, i) => i));
      console.log(Array.from({ length: 3 }, (_, i) => i));
    },
    `Array(3) creates a sparse array with length 3 but NO elements.
It is NOT [undefined, undefined, undefined].

Array(3).map() does NOTHING because map skips holes.
[...Array(3)] spreads the holes into undefined values, so map works.
Array.from({ length: 3 }) also creates real entries (undefined).

[, , ,].length is 3 (trailing comma does not add an element).
[undefined, undefined, undefined].length is also 3 but has real entries.`,
    `Use Array.from for generating arrays:
  Array.from({ length: n }, (_, i) => i); // [0, 1, ..., n-1]

Or use fill:
  Array(n).fill(0).map((_, i) => i); // [0, 1, ..., n-1]`
  );

  // Q39: property enumeration order
  trick(
    `const obj = {};
obj["2"] = "two";
obj["1"] = "one";
obj["b"] = "bravo";
obj["a"] = "alpha";
obj["3"] = "three";

console.log(Object.keys(obj));

// Numeric keys come first (in ascending order),
// then string keys in insertion order.`,
    () => {
      const obj = {};
      obj["2"] = "two";
      obj["1"] = "one";
      obj["b"] = "bravo";
      obj["a"] = "alpha";
      obj["3"] = "three";
      console.log(Object.keys(obj));
    },
    `Since ES2015, Object.keys() follows a specific order:
1. Integer indices in ascending numeric order ("1", "2", "3")
2. String keys in insertion order ("b", "a")
3. Symbol keys in insertion order (not shown by Object.keys)

So the output is ["1", "2", "3", "b", "a"], NOT insertion order.

This surprises many developers who assume objects are "unordered".
Objects DO have a defined enumeration order, but it is not purely
insertion order when integer-like keys are involved.`,
    `If insertion order matters and keys are numeric, use Map:
  const map = new Map();
  map.set("2", "two"); map.set("1", "one");
  [...map.keys()]; // ["2", "1"] -- true insertion order`
  );
}

// ============================================================================
// SECTION 9: COMPARISON & LOGIC (4 questions)
// ============================================================================

function comparisonLogicQuestions() {
  section('SECTION 9: COMPARISON & LOGIC');

  // Q40: || and && return values
  trick(
    `console.log(1 || 2);
console.log(0 || 2);
console.log(1 && 2);
console.log(0 && 2);
console.log("" || "default");
console.log("hello" || "default");
console.log(null ?? "default");
console.log(0 ?? "default");
console.log("" ?? "default");`,
    () => {
      console.log(1 || 2);
      console.log(0 || 2);
      console.log(1 && 2);
      console.log(0 && 2);
      console.log("" || "default");
      console.log("hello" || "default");
      console.log(null ?? "default");
      console.log(0 ?? "default");
      console.log("" ?? "default");
    },
    `|| and && do NOT return booleans -- they return one of the operands!

||  returns the FIRST truthy value, or the last value if all falsy.
&&  returns the FIRST falsy value, or the last value if all truthy.

?? (nullish coalescing) is different:
  - Only treats null and undefined as "nullish"
  - 0 ?? "default" => 0 (0 is NOT nullish)
  - "" ?? "default" => "" ("" is NOT nullish)
  - 0 || "default" => "default" (0 is falsy)

This is the key difference: || checks falsy, ?? checks nullish.`,
    `Use ?? when 0 or "" are valid values:
  const port = config.port ?? 3000; // 0 is kept, null/undefined gets default
  const name = config.name ?? "anonymous"; // "" is kept

Use || when any falsy value should trigger the default:
  const display = input || "N/A"; // "", 0, null, undefined all become "N/A"`
  );

  // Q41: abstract equality
  trick(
    `console.log("" == false);
console.log("" == 0);
console.log(false == 0);
console.log(" \\t\\n" == 0);
console.log([] == false);
console.log([] == 0);
console.log([1] == 1);
console.log(["1"] == 1);`,
    () => {
      console.log("" == false);
      console.log("" == 0);
      console.log(false == 0);
      console.log(" \t\n" == 0);
      console.log([] == false);
      console.log([] == 0);
      console.log([1] == 1);
      console.log(["1"] == 1);
    },
    `The abstract equality algorithm (==) is surprisingly complex:

"" == false: both coerce to 0. true.
"" == 0: "" coerces to 0. true.
false == 0: false coerces to 0. true.
" \\t\\n" == 0: whitespace-only string coerces to 0. true.
[] == false: [] -> "" -> 0, false -> 0. true.
[] == 0: [] -> "" -> 0. true.
[1] == 1: [1] -> "1" -> 1. true.
["1"] == 1: ["1"] -> "1" -> 1. true.

The chain: ToPrimitive -> toString -> ToNumber.

Notice: [] == false is true, but [] is truthy!
  if ([]) { "truthy!" } -- executes because [] is truthy.
Truthiness and == comparison are different algorithms.`,
    `ALWAYS use === to avoid this madness.
The only exception: value == null (checks null or undefined).`
  );

  // Q42: comma operator
  trick(
    `const a = (1, 2, 3);
console.log(a);

const b = (console.log("first"), console.log("second"), 42);
console.log(b);

// Often seen accidentally in arrow functions:
const fn1 = () => (console.log("side effect"), "result");
console.log(fn1());`,
    () => {
      const a = (1, 2, 3);
      console.log(a);
      const b = (console.log("first"), console.log("second"), 42);
      console.log(b);
      const fn1 = () => (console.log("side effect"), "result");
      console.log(fn1());
    },
    `The comma operator evaluates ALL expressions from left to right and
returns the LAST one.

(1, 2, 3) evaluates 1, then 2, then 3 -- returns 3.
(console.log("first"), console.log("second"), 42) -- logs both,
returns 42.

The comma operator is sometimes used in arrow functions to perform
a side effect and return a value in a concise body:
  () => (sideEffect(), returnValue)

It is also used (abused) in for loop headers:
  for (let i = 0, j = 10; i < j; i++, j--)`,
    `Avoid the comma operator for clarity. Use block bodies instead:
  const fn = () => {
    console.log("side effect");
    return "result";
  };`
  );

  // Q43: optional chaining and nullish coalescing
  trick(
    `const user = {
  profile: {
    name: "Alice",
    address: null,
  }
};

console.log(user.profile?.name);
console.log(user.profile?.address?.city);
console.log(user.settings?.theme);
console.log(user.profile?.address?.city ?? "Unknown");

// Tricky: optional chaining with function calls
console.log(user.profile?.toString());
console.log(user.nonExistent?.());`,
    () => {
      const user = {
        profile: {
          name: "Alice",
          address: null,
        }
      };
      console.log(user.profile?.name);
      console.log(user.profile?.address?.city);
      console.log(user.settings?.theme);
      console.log(user.profile?.address?.city ?? "Unknown");
      console.log(user.profile?.toString());
      console.log(user.nonExistent?.());
    },
    `Optional chaining (?.) short-circuits to undefined when the left
side is null or undefined:

user.profile?.name -> "Alice" (profile exists)
user.profile?.address?.city -> undefined (address is null, short-circuits)
user.settings?.theme -> undefined (settings is undefined)

Combined with ?? for defaults:
user.profile?.address?.city ?? "Unknown" -> "Unknown"

For function calls: user.nonExistent?.() -> undefined (does not throw).
But user.nonExistent() without ?. would throw TypeError.

TRAP: ?. only checks for null/undefined, NOT for falsy values.
  0?.toString() -> "0" (0 is NOT nullish)`,
    `Use ?. to safely navigate nested objects:
  const city = user?.profile?.address?.city ?? "Unknown";

Combine with ?? (not ||) for proper defaults:
  const count = response?.data?.count ?? 0; // 0 is a valid value`
  );
}

// ============================================================================
// SECTION 10: NODE.JS SPECIFIC (4 questions)
// ============================================================================

function nodejsSpecificQuestions() {
  section('SECTION 10: NODE.JS SPECIFIC');

  // Q44: require circular dependencies
  trick(
    `// a.js:
// console.log("a.js: loading");
// exports.loaded = false;
// const b = require('./b.js');
// console.log("a.js: b.loaded =", b.loaded);
// exports.loaded = true;
//
// b.js:
// console.log("b.js: loading");
// exports.loaded = false;
// const a = require('./a.js');
// console.log("b.js: a.loaded =", a.loaded);
// exports.loaded = true;
//
// Running: node a.js

// Output:
// a.js: loading
// b.js: loading
// b.js: a.loaded = false     <-- PARTIALLY loaded!
// a.js: b.loaded = true
console.log("Circular dependency example (see code comments)");`,
    () => {
      console.log("Circular dependency demo:");
      console.log("  a.js: loading");
      console.log("  b.js: loading");
      console.log("  b.js: a.loaded = false   <-- a.js is PARTIALLY loaded!");
      console.log("  a.js: b.loaded = true");
    },
    `When a.js requires b.js and b.js requires a.js, Node.js does NOT
deadlock or throw. Instead:

1. a.js starts executing, sets exports.loaded = false
2. a.js requires b.js -> execution moves to b.js
3. b.js starts executing, sets exports.loaded = false
4. b.js requires a.js -> Node detects the cycle and returns the
   PARTIALLY COMPLETED exports of a.js (loaded = false)
5. b.js finishes (loaded = true)
6. Control returns to a.js, b.loaded is now true
7. a.js finishes (loaded = true)

The key: circular require() returns an INCOMPLETE module object.
This is a common source of subtle bugs.`,
    `Avoid circular dependencies:
  - Refactor shared code into a third module
  - Use dependency injection
  - Use lazy requires (require inside a function)
  - Reorganize the module hierarchy

Detect circular deps with: npx madge --circular src/`
  );

  // Q45: module caching
  trick(
    `// counter.js:
// let count = 0;
// module.exports = { increment: () => ++count, getCount: () => count };
//
// app.js:
// const c1 = require('./counter');
// const c2 = require('./counter');
// c1.increment();
// c1.increment();
// console.log(c2.getCount()); // What is this?

// Simulating:
const cache = {};
function fakeRequire(name) {
  if (cache[name]) return cache[name];
  let count = 0;
  const mod = { increment: () => ++count, getCount: () => count };
  cache[name] = mod;
  return mod;
}
const c1 = fakeRequire('counter');
const c2 = fakeRequire('counter');
c1.increment();
c1.increment();
console.log(c2.getCount());`,
    () => {
      const cache = {};
      function fakeRequire(name) {
        if (cache[name]) return cache[name];
        let count = 0;
        const mod = { increment: () => ++count, getCount: () => count };
        cache[name] = mod;
        return mod;
      }
      const c1 = fakeRequire('counter');
      const c2 = fakeRequire('counter');
      c1.increment();
      c1.increment();
      console.log(c2.getCount());
    },
    `require() CACHES modules. The second require('./counter') returns
the SAME object from the cache. c1 and c2 are the SAME module instance.

So c1.increment() twice -> count is 2
c2.getCount() returns 2 (same closure, same count variable).

This is the "singleton pattern" of Node.js: every require() of the
same module returns the same cached exports object.

The cache is stored in require.cache and keyed by the RESOLVED
absolute file path.`,
    `To get a fresh instance, use a factory function:
  // counter.js
  module.exports = function createCounter() {
    let count = 0;
    return { increment: () => ++count, getCount: () => count };
  };

  // app.js
  const c1 = require('./counter')(); // new instance
  const c2 = require('./counter')(); // separate instance

To clear cache (testing only):
  delete require.cache[require.resolve('./counter')];`
  );

  // Q46: Buffer comparison
  trick(
    `const buf1 = Buffer.from("abc");
const buf2 = Buffer.from("abc");

console.log(buf1 === buf2);
console.log(buf1 == buf2);
console.log(buf1.equals(buf2));
console.log(Buffer.compare(buf1, buf2));

const buf3 = Buffer.from("abd");
console.log(Buffer.compare(buf1, buf3));
console.log(Buffer.compare(buf3, buf1));`,
    () => {
      const buf1 = Buffer.from("abc");
      const buf2 = Buffer.from("abc");
      console.log(buf1 === buf2);
      console.log(buf1 == buf2);
      console.log(buf1.equals(buf2));
      console.log(Buffer.compare(buf1, buf2));
      const buf3 = Buffer.from("abd");
      console.log(Buffer.compare(buf1, buf3));
      console.log(Buffer.compare(buf3, buf1));
    },
    `Buffers are objects, so === and == compare REFERENCES, not content.
buf1 and buf2 are different objects -> false for both.

buf1.equals(buf2) compares the CONTENTS byte-by-byte -> true.
Buffer.compare() returns 0 (equal), -1 (less), or 1 (greater).

buf1 ("abc") vs buf3 ("abd"): "c" < "d" -> compare returns -1.
buf3 vs buf1: "d" > "c" -> compare returns 1.

This is a common gotcha when comparing binary data, tokens, or hashes.`,
    `Always use .equals() for Buffer comparison:
  if (buf1.equals(buf2)) { /* same content */ }

For constant-time comparison (security-sensitive, e.g., HMAC):
  const crypto = require('crypto');
  crypto.timingSafeEqual(buf1, buf2);`
  );

  // Q47: process.exit vs event loop drain
  trick(
    `// process.exit(0) -- forces immediate exit
// Even pending callbacks and open handles are abandoned.
//
// Letting the event loop drain:
// When there is nothing left to do, Node exits naturally.

// Example: this log may NOT appear with process.exit:
// setTimeout(() => console.log("I may never run"), 1000);
// process.exit(0); // exits immediately

// Graceful shutdown pattern:
console.log("Graceful shutdown example:");
let cleanedUp = false;

process.on('SIGTERM', () => {
  console.log("  Received SIGTERM");
  // Clean up: close DB connections, finish requests, etc.
  cleanedUp = true;
  // Then exit:
  // process.exit(0);
});

console.log("  Server would listen here...");
console.log("  On SIGTERM: clean up, then exit");`,
    () => {
      console.log("Graceful shutdown example:");
      console.log("  process.exit(0) -- immediate, no cleanup");
      console.log("  process.exitCode = 1 -- sets code, allows drain");
      console.log("  server.close() + db.close() -- graceful");
    },
    `process.exit(code) forces an IMMEDIATE exit. Pending setTimeout
callbacks, open sockets, unfinished I/O -- all abandoned.

Better approach: set process.exitCode and let Node exit naturally:
  process.exitCode = 1; // sets the exit code
  // Node exits when the event loop has nothing left to process

For servers, implement graceful shutdown:
1. Stop accepting new connections (server.close())
2. Finish processing in-flight requests
3. Close database connections
4. Then exit (or let the event loop drain)

process.exit() should only be used for fatal errors or CLI tools.`,
    `Graceful shutdown pattern:
  process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    server.close();
    await db.disconnect();
    await cache.quit();
    process.exitCode = 0;
    // Node exits when event loop drains
  });`
  );
}

// ============================================================================
// DEMO: RUN ALL SECTIONS
// ============================================================================

function main() {
  console.log(`${'*'.repeat(76)}`);
  console.log(`  FILE 17: 40+ TRICKY JAVASCRIPT & NODE.JS INTERVIEW QUESTIONS`);
  console.log(`  Questions that trip up even senior developers.`);
  console.log(`${'*'.repeat(76)}`);

  typeCoercionQuestions();
  hoistingQuestions();
  closureQuestions();
  thisBindingQuestions();
  prototypeQuestions();
  asyncGotchaQuestions();
  eventLoopQuestions();
  objectArrayQuestions();
  comparisonLogicQuestions();
  nodejsSpecificQuestions();

  // Wait for async operations to complete
  setTimeout(() => {
    console.log(`\n${'='.repeat(76)}`);
    console.log(`  SUMMARY`);
    console.log(`${'='.repeat(76)}`);
    console.log(`\n  Total questions: ${questionCounter}`);
    console.log(`\n  Key takeaways for senior interviews:`);
    console.log(`    1. Always use === unless intentionally checking null/undefined with ==`);
    console.log(`    2. Use let/const instead of var to avoid hoisting and scope bugs`);
    console.log(`    3. Closures capture references, not values`);
    console.log(`    4. Arrow functions do NOT have their own 'this'`);
    console.log(`    5. async/await with forEach does NOT work -- use for...of or Promise.all`);
    console.log(`    6. process.nextTick > Promises > setTimeout in Node.js`);
    console.log(`    7. All object keys are strings (use Map for non-string keys)`);
    console.log(`    8. || returns values (not booleans); use ?? for nullish checks`);
    console.log(`    9. require() caches modules (singleton behavior)`);
    console.log(`   10. Never use process.exit() in servers -- implement graceful shutdown`);
    console.log(`\n  Run this file: node 17_tricky_questions.js`);
    console.log(`${'*'.repeat(76)}\n`);
  }, 500);
}

main();
