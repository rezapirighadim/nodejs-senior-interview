/**
 * ============================================================================
 * FILE 3: TYPESCRIPT ESSENTIALS — Senior Interview Prep
 * ============================================================================
 *
 * This is a .js file with extensive JSDoc type annotations.
 * Each section shows the JSDoc approach AND the TypeScript equivalent
 * in comments, so you can compare both styles.
 *
 * Topics covered:
 *   - Basic types: string, number, boolean, arrays, tuples
 *   - Interfaces vs type aliases (when to use which)
 *   - Union types, intersection types, literal types
 *   - Generics: functions, classes, constraints
 *   - Utility types: Partial, Required, Pick, Omit, Record, Readonly
 *   - Mapped types and conditional types
 *   - Type guards and narrowing
 *   - Template literal types
 *   - Declaration merging
 *   - Enums vs const enums vs union of literals
 *   - unknown vs any vs never
 *   - Strict mode benefits
 *
 * Run: node 03_typescript_essentials.js
 */

"use strict";

// ---------------------------------------------------------------------------
// Utility
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
// ║  1. BASIC TYPES                                                        ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("1. Basic Types: string, number, boolean, arrays, tuples");

/**
 * TypeScript adds a static type system on top of JavaScript.
 * JSDoc annotations give us type checking in VS Code / tsc without .ts files.
 */

// --- Primitive types ---

/** @type {string} */
const greeting = "Hello, TypeScript!";
// TS equivalent:  const greeting: string = "Hello, TypeScript!";

/** @type {number} */
const count = 42;
// TS equivalent:  const count: number = 42;

/** @type {boolean} */
const isActive = true;
// TS equivalent:  const isActive: boolean = true;

/** @type {bigint} */
const bigNum = 9007199254740991n;
// TS equivalent:  const bigNum: bigint = 9007199254740991n;

/** @type {symbol} */
const uniqueId = Symbol("id");
// TS equivalent:  const uniqueId: symbol = Symbol("id");

/** @type {null} */
const nothing = null;

/** @type {undefined} */
const undef = undefined;

show("Primitives", { greeting, count, isActive, bigNum: bigNum.toString() });

// --- Arrays ---

/** @type {number[]} */
const numbers = [1, 2, 3, 4, 5];
// TS equivalent:  const numbers: number[] = [1, 2, 3, 4, 5];
// Alternative TS:  const numbers: Array<number> = [1, 2, 3, 4, 5];

/** @type {Array<string>} */
const names = ["Alice", "Bob", "Carol"];
// TS equivalent:  const names: Array<string> = ["Alice", "Bob", "Carol"];

show("Arrays", { numbers, names });

// --- Tuples (fixed-length arrays with specific types at each position) ---

/**
 * @type {[string, number, boolean]}
 *
 * TS equivalent:
 *   type MyTuple = [string, number, boolean];
 *   const tuple: MyTuple = ["hello", 42, true];
 */
const tuple = ["hello", 42, true];
show("Tuple", tuple);
show("Tuple[0] (string)", tuple[0]);
show("Tuple[1] (number)", tuple[1]);

/**
 * Named tuples (TS only, JSDoc cannot express names):
 *
 * TS: type Point = [x: number, y: number];
 *     const point: Point = [10, 20];
 *
 * Tuples with rest elements:
 * TS: type StringNumberBooleans = [string, number, ...boolean[]];
 */

// --- Readonly arrays ---

/**
 * @type {readonly number[]}
 *
 * TS equivalent:
 *   const frozen: readonly number[] = [1, 2, 3];
 *   // OR: const frozen: ReadonlyArray<number> = [1, 2, 3];
 */
const frozen = Object.freeze([1, 2, 3]);
show("Frozen array", frozen);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  2. INTERFACES vs TYPE ALIASES                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("2. Interfaces vs Type Aliases");

/**
 * INTERFACES (TS: interface):
 *   - Define object shapes
 *   - Support declaration merging (can be extended across files)
 *   - Can extend other interfaces
 *   - Better error messages in some cases
 *   - Best for: public API contracts, library definitions
 *
 * TYPE ALIASES (TS: type):
 *   - Can represent ANY type (unions, intersections, primitives, tuples, etc.)
 *   - Cannot be merged (redeclaring causes error)
 *   - More powerful for complex type compositions
 *   - Best for: unions, intersections, mapped types, utility compositions
 *
 * RULE OF THUMB:
 *   - Use `interface` for object shapes you expect others to extend
 *   - Use `type` for unions, intersections, and complex compositions
 */

// --- Interface pattern (JSDoc @typedef with @property) ---

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {number} [age]  - optional property
 *
 * TS equivalent:
 *   interface User {
 *     id: string;
 *     name: string;
 *     email: string;
 *     age?: number;
 *   }
 */

/**
 * @typedef {Object} Admin
 * @property {string} role
 * @property {string[]} permissions
 *
 * TS equivalent:
 *   interface Admin {
 *     role: string;
 *     permissions: string[];
 *   }
 */

// --- Extending interfaces ---

/**
 * @typedef {User & Admin} AdminUser
 *
 * TS equivalent:
 *   interface AdminUser extends User, Admin {}
 *   // OR: type AdminUser = User & Admin;
 */

/** @type {AdminUser} */
const adminUser = {
  id: "1",
  name: "Alice",
  email: "alice@example.com",
  role: "superadmin",
  permissions: ["read", "write", "delete"],
};
show("AdminUser (interface extends)", adminUser);

// --- Type alias patterns ---

/**
 * Type aliases can represent things interfaces cannot:
 *
 * TS: type ID = string | number;              // Union
 * TS: type Pair<T> = [T, T];                  // Generic tuple
 * TS: type Callback = (data: string) => void; // Function type
 * TS: type Status = "active" | "inactive";    // String literal union
 */

/**
 * @typedef {string | number} ID
 */

/**
 * @typedef {(data: string) => void} Callback
 */

/**
 * @typedef {"active" | "inactive" | "suspended"} Status
 */

/** @type {ID} */
const userId = "abc-123";

/** @type {ID} */
const orderId = 42;

/** @type {Status} */
const userStatus = "active";

show("Union type ID (string)", userId);
show("Union type ID (number)", orderId);
show("Literal type Status", userStatus);

// Declaration merging (TS only — interfaces with same name merge):
/**
 * TS example of declaration merging:
 *
 *   interface Config {
 *     host: string;
 *   }
 *   interface Config {
 *     port: number;   // This MERGES with the above
 *   }
 *   // Config now has both 'host' and 'port'
 *
 * This is useful for extending third-party types, e.g.:
 *   declare global {
 *     interface Window {
 *       myApp: MyAppType;
 *     }
 *   }
 */
show("Declaration merging", "Interfaces can be merged; type aliases cannot (TS feature)");

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  3. UNION TYPES, INTERSECTION TYPES, LITERAL TYPES                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("3. Union, Intersection, and Literal Types");

/**
 * UNION TYPES (A | B): value can be type A OR type B
 * INTERSECTION TYPES (A & B): value must be type A AND type B
 * LITERAL TYPES: exact value as a type ("hello", 42, true)
 */

// --- Union types ---

/**
 * @param {string | number} value
 * @returns {string}
 *
 * TS: function formatValue(value: string | number): string
 */
function formatValue(value) {
  if (typeof value === "string") {
    return value.toUpperCase(); // narrowed to string
  }
  return value.toFixed(2); // narrowed to number
}
show("Union (string)", formatValue("hello"));
show("Union (number)", formatValue(3.14159));

// --- Discriminated unions (tagged unions) ---

/**
 * @typedef {{ kind: "circle", radius: number }} Circle
 * @typedef {{ kind: "rectangle", width: number, height: number }} Rectangle
 * @typedef {{ kind: "triangle", base: number, height: number }} Triangle
 * @typedef {Circle | Rectangle | Triangle} Shape
 *
 * TS equivalent:
 *   type Shape =
 *     | { kind: "circle"; radius: number }
 *     | { kind: "rectangle"; width: number; height: number }
 *     | { kind: "triangle"; base: number; height: number };
 */

/**
 * @param {Shape} shape
 * @returns {number}
 */
function calculateArea(shape) {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return 0.5 * shape.base * shape.height;
    default:
      // Exhaustiveness check: if we reach here, we missed a case.
      // TS: const _exhaustive: never = shape;
      throw new Error(`Unknown shape: ${/** @type {any} */ (shape).kind}`);
  }
}

show("Circle area", calculateArea({ kind: "circle", radius: 5 }).toFixed(2));
show("Rectangle area", calculateArea({ kind: "rectangle", width: 4, height: 6 }));
show("Triangle area", calculateArea({ kind: "triangle", base: 10, height: 3 }));

// --- Intersection types ---

/**
 * @typedef {{ name: string, email: string }} HasContact
 * @typedef {{ createdAt: Date, updatedAt: Date }} HasTimestamps
 * @typedef {HasContact & HasTimestamps} ContactWithTimestamps
 *
 * TS: type ContactWithTimestamps = HasContact & HasTimestamps;
 */

/** @type {ContactWithTimestamps} */
const contact = {
  name: "Bob",
  email: "bob@test.com",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-15"),
};
show("Intersection type", contact);

// --- Literal types ---

/**
 * @typedef {"GET" | "POST" | "PUT" | "DELETE" | "PATCH"} HttpMethod
 * @typedef {200 | 201 | 400 | 401 | 403 | 404 | 500} StatusCode
 *
 * TS: type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
 * TS: type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 500;
 */

/**
 * @param {HttpMethod} method
 * @param {string} url
 */
function apiCall(method, url) {
  return `${method} ${url}`;
}
show("Literal type", apiCall("GET", "/api/users"));

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  4. GENERICS                                                           ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("4. Generics: Functions, Classes, Constraints");

/**
 * Generics allow you to write reusable code that works with multiple types
 * while maintaining type safety.
 *
 * TS: function identity<T>(value: T): T { return value; }
 * JSDoc: @template T
 */

// --- Generic function ---

/**
 * @template T
 * @param {T} value
 * @returns {T}
 *
 * TS: function identity<T>(value: T): T
 */
function identity(value) {
  return value;
}
show("identity(42)", identity(42));
show('identity("hello")', identity("hello"));

// --- Generic with constraint ---

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T} obj
 * @param {K} key
 * @returns {T[K]}
 *
 * TS: function getProperty<T extends object, K extends keyof T>(obj: T, key: K): T[K]
 */
function getProperty(obj, key) {
  return obj[key];
}
const person = { name: "Alice", age: 30, active: true };
show("getProperty", getProperty(person, "name")); // "Alice"
show("getProperty", getProperty(person, "age")); // 30

// --- Generic class ---

/**
 * @template T
 *
 * TS equivalent:
 *   class Stack<T> {
 *     private items: T[] = [];
 *     push(item: T): void { this.items.push(item); }
 *     pop(): T | undefined { return this.items.pop(); }
 *     peek(): T | undefined { return this.items[this.items.length - 1]; }
 *     get size(): number { return this.items.length; }
 *   }
 */
class Stack {
  /** @type {T[]} */
  #items = [];

  /** @param {T} item */
  push(item) {
    this.#items.push(item);
  }

  /** @returns {T | undefined} */
  pop() {
    return this.#items.pop();
  }

  /** @returns {T | undefined} */
  peek() {
    return this.#items[this.#items.length - 1];
  }

  /** @returns {number} */
  get size() {
    return this.#items.length;
  }

  /** @returns {T[]} */
  toArray() {
    return [...this.#items];
  }
}

/** @type {Stack<number>} */
const numStack = new Stack();
numStack.push(10);
numStack.push(20);
numStack.push(30);
show("Stack peek", numStack.peek()); // 30
show("Stack pop", numStack.pop()); // 30
show("Stack size", numStack.size); // 2
show("Stack array", numStack.toArray()); // [10, 20]

// --- Generic constraint with interface ---

/**
 * @typedef {Object} HasLength
 * @property {number} length
 */

/**
 * @template {HasLength} T
 * @param {T} item
 * @returns {number}
 *
 * TS: function getLength<T extends { length: number }>(item: T): number
 */
function getLength(item) {
  return item.length;
}
show("getLength([1,2,3])", getLength([1, 2, 3])); // 3
show('getLength("hello")', getLength("hello")); // 5

// --- Multiple generic parameters ---

/**
 * @template T, U
 * @param {T[]} array
 * @param {(item: T) => U} mapFn
 * @returns {U[]}
 *
 * TS: function mapArray<T, U>(array: T[], mapFn: (item: T) => U): U[]
 */
function mapArray(array, mapFn) {
  return array.map(mapFn);
}
const lengths = mapArray(["hi", "hello", "hey"], (s) => s.length);
show("mapArray (string -> number)", lengths); // [2, 5, 3]

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  5. UTILITY TYPES                                                      ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("5. Utility Types: Partial, Required, Pick, Omit, Record, Readonly");

/**
 * TypeScript provides built-in utility types. In JSDoc, we simulate
 * these or show the TS equivalents.
 *
 * Partial<T>   — All properties optional
 * Required<T>  — All properties required
 * Readonly<T>  — All properties readonly
 * Pick<T, K>   — Select subset of properties
 * Omit<T, K>   — Exclude subset of properties
 * Record<K, V> — Object type with keys K and values V
 * NonNullable<T> — Exclude null and undefined
 * ReturnType<F> — Extract return type of a function
 * Parameters<F> — Extract parameter types of a function
 * Awaited<T>   — Unwrap Promise type
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {number} age
 * @property {string} role
 */

// --- Partial<T>: make all properties optional ---
/**
 * @typedef {Partial<UserProfile>} UserProfileUpdate
 *
 * TS: type UserProfileUpdate = Partial<UserProfile>;
 * Equivalent to:
 *   { id?: string; name?: string; email?: string; age?: number; role?: string }
 *
 * @param {string} userId
 * @param {Partial<UserProfile>} updates
 * @returns {UserProfile}
 */
function updateUser(userId, updates) {
  /** @type {UserProfile} */
  const existing = { id: userId, name: "Old", email: "old@test.com", age: 25, role: "user" };
  return { ...existing, ...updates };
}
show("Partial update", updateUser("1", { name: "New Name", age: 30 }));

// --- Pick<T, K>: select specific properties ---
/**
 * TS: type UserSummary = Pick<UserProfile, "id" | "name">;
 * Equivalent to: { id: string; name: string }
 *
 * @typedef {Pick<UserProfile, "id" | "name">} UserSummary
 */

/**
 * @param {UserProfile} user
 * @returns {Pick<UserProfile, "id" | "name">}
 */
function summarizeUser(user) {
  return { id: user.id, name: user.name };
}
show("Pick (summary)", summarizeUser({
  id: "1", name: "Alice", email: "a@b.com", age: 30, role: "admin"
}));

// --- Omit<T, K>: exclude properties ---
/**
 * TS: type PublicUser = Omit<UserProfile, "email" | "role">;
 * Equivalent to: { id: string; name: string; age: number }
 *
 * @typedef {Omit<UserProfile, "email" | "role">} PublicUser
 */

/**
 * @param {UserProfile} user
 * @returns {Omit<UserProfile, "email" | "role">}
 */
function toPublicUser(user) {
  const { email, role, ...publicData } = user;
  return publicData;
}
show("Omit (public)", toPublicUser({
  id: "1", name: "Alice", email: "a@b.com", age: 30, role: "admin"
}));

// --- Record<K, V>: create object type ---
/**
 * TS: type RolePermissions = Record<string, string[]>;
 *
 * @type {Record<string, string[]>}
 */
const rolePermissions = {
  admin: ["read", "write", "delete", "manage"],
  editor: ["read", "write"],
  viewer: ["read"],
};
show("Record type", rolePermissions);

// --- Readonly<T> ---
/**
 * TS: type ReadonlyUser = Readonly<UserProfile>;
 * All properties become readonly — cannot be reassigned.
 *
 * In JS, we can use Object.freeze for a runtime equivalent:
 */
const readonlyConfig = Object.freeze({
  host: "localhost",
  port: 3000,
  debug: false,
});
show("Readonly (frozen)", readonlyConfig);

// --- ReturnType<F> and Parameters<F> ---
/**
 * TS: type AddReturn = ReturnType<typeof add>; // number
 * TS: type AddParams = Parameters<typeof add>; // [number, number]
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}

// In JSDoc, ReturnType is implicit from the @returns annotation.
show("ReturnType concept", "typeof add returns number (inferred from @returns)");

// --- Required<T> ---
/**
 * TS: type RequiredUser = Required<Partial<UserProfile>>;
 * Makes all optional properties required.
 *
 * The inverse of Partial. Useful when you receive partial data
 * but need to ensure everything is present before processing.
 */
show("Required<T>", "Makes all optional properties required (TS utility)");

// --- NonNullable<T> ---
/**
 * TS: type NonNullableString = NonNullable<string | null | undefined>;
 * Removes null and undefined from the type.
 *
 * @type {string | null | undefined}
 */
let maybeString = "hello";
/** @type {string} */
const definiteString = maybeString ?? "fallback"; // runtime equivalent
show("NonNullable concept", definiteString);

// --- Awaited<T> ---
/**
 * TS: type AwaitedResult = Awaited<Promise<Promise<string>>>; // string
 * Recursively unwraps Promise types.
 */
show("Awaited<T>", "Unwraps nested Promise types: Awaited<Promise<Promise<string>>> = string");

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  6. MAPPED TYPES AND CONDITIONAL TYPES                                 ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("6. Mapped Types and Conditional Types");

/**
 * MAPPED TYPES (TS only — cannot express in JSDoc):
 *   Transform properties of an existing type.
 *
 * TS syntax:
 *   type Mapped<T> = { [K in keyof T]: NewType };
 *
 * Examples:
 *
 *   // Make all properties optional:
 *   type MyPartial<T> = { [K in keyof T]?: T[K] };
 *
 *   // Make all properties readonly:
 *   type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
 *
 *   // Make all properties nullable:
 *   type Nullable<T> = { [K in keyof T]: T[K] | null };
 *
 *   // Map property types to getters:
 *   type Getters<T> = {
 *     [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
 *   };
 *
 *   // Remove specific properties:
 *   type RemoveKind<T> = { [K in keyof T as Exclude<K, "kind">]: T[K] };
 */

// We can demonstrate the concept at runtime using Object.fromEntries:
/**
 * Runtime equivalent of a "Nullable" mapped type.
 * @template {Record<string, *>} T
 * @param {T} obj
 * @returns {Record<keyof T, T[keyof T] | null>}
 */
function makeNullable(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v])
  );
}

// Runtime equivalent of "Getters" mapped type:
/**
 * @param {Record<string, *>} obj
 */
function createGetters(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const getterName = `get${key.charAt(0).toUpperCase() + key.slice(1)}`;
    result[getterName] = () => value;
  }
  return result;
}

const getters = createGetters({ name: "Alice", age: 30 });
show("Runtime Getters pattern", {
  getName: getters.getName(),
  getAge: getters.getAge(),
});

/**
 * CONDITIONAL TYPES (TS only):
 *   type IsString<T> = T extends string ? "yes" : "no";
 *   type A = IsString<string>;  // "yes"
 *   type B = IsString<number>;  // "no"
 *
 * With infer (extract types):
 *   type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
 *   type A = UnpackPromise<Promise<string>>; // string
 *   type B = UnpackPromise<number>;          // number
 *
 *   type First<T> = T extends [infer F, ...any[]] ? F : never;
 *   type A = First<[string, number]>; // string
 *
 * Distributive conditional types:
 *   type NonNullable<T> = T extends null | undefined ? never : T;
 *   type A = NonNullable<string | null>; // string
 */

// Runtime demonstration of conditional logic (simulating conditional types):

/**
 * @template T
 * @param {T} value
 * @returns {T extends string ? "string" : T extends number ? "number" : "other"}
 */
function describeType(value) {
  if (typeof value === "string") return /** @type {any} */ ("string");
  if (typeof value === "number") return /** @type {any} */ ("number");
  return /** @type {any} */ ("other");
}
show("Conditional type concept", {
  string: describeType("hello"),
  number: describeType(42),
  other: describeType(true),
});

console.log(`
  Key TS mapped/conditional types to know:

  Mapped Types:
    { [K in keyof T]: ...}           — iterate over keys
    { [K in keyof T]?: T[K] }       — Partial
    { readonly [K in keyof T]: T[K] } — Readonly
    { [K in keyof T as \`get\${Capitalize<K>}\`]: () => T[K] } — Key remapping

  Conditional Types:
    T extends U ? X : Y              — basic conditional
    T extends (...args: infer P) => infer R ? [P, R] : never  — infer
    [T] extends [never] ? true : false — check for never
`);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  7. TYPE GUARDS AND NARROWING                                          ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("7. Type Guards and Narrowing");

/**
 * Type narrowing: reducing a type from a broader to a more specific type.
 *
 * Narrowing techniques:
 *   1. typeof checks
 *   2. instanceof checks
 *   3. 'in' operator
 *   4. Truthiness checks
 *   5. Equality checks
 *   6. Discriminated unions (switch on a tag)
 *   7. Custom type guard functions (TS: `is` return type)
 *   8. Assertion functions (TS: `asserts` return type)
 */

// --- typeof guard ---
/**
 * @param {string | number | boolean} value
 * @returns {string}
 */
function processValue(value) {
  if (typeof value === "string") {
    return value.toUpperCase(); // narrowed to string
  } else if (typeof value === "number") {
    return value.toFixed(2); // narrowed to number
  } else {
    return value ? "yes" : "no"; // narrowed to boolean
  }
}
show("typeof guard", processValue("hello"));
show("typeof guard", processValue(3.14));
show("typeof guard", processValue(true));

// --- instanceof guard ---
class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * @param {Error} error
 * @returns {string}
 */
function handleError(error) {
  if (error instanceof ApiError) {
    return `API Error (${error.status}): ${error.message}`; // narrowed to ApiError
  }
  if (error instanceof TypeError) {
    return `Type Error: ${error.message}`; // narrowed to TypeError
  }
  return `Unknown error: ${error.message}`;
}
show("instanceof guard", handleError(new ApiError("Not found", 404)));
show("instanceof guard", handleError(new TypeError("bad type")));

// --- 'in' operator guard ---
/**
 * @typedef {{ type: "dog", bark: () => string }} Dog
 * @typedef {{ type: "cat", meow: () => string }} Cat
 * @typedef {Dog | Cat} Pet
 *
 * TS:
 *   interface Dog { type: "dog"; bark(): string; }
 *   interface Cat { type: "cat"; meow(): string; }
 *   type Pet = Dog | Cat;
 */

/**
 * @param {Pet} pet
 * @returns {string}
 */
function petSound(pet) {
  if ("bark" in pet) {
    return pet.bark(); // narrowed to Dog
  }
  return pet.meow(); // narrowed to Cat
}
show("in operator", petSound({ type: "dog", bark: () => "Woof!" }));
show("in operator", petSound({ type: "cat", meow: () => "Meow!" }));

// --- Custom type guard function ---
/**
 * TS:
 *   function isString(value: unknown): value is string {
 *     return typeof value === "string";
 *   }
 *
 * JSDoc cannot express 'value is string' return type directly.
 * We write the guard function and annotate with a comment.
 *
 * @param {unknown} value
 * @returns {boolean} — in TS this would be: value is string
 */
function isString(value) {
  return typeof value === "string";
}

/**
 * @param {unknown} value
 * @returns {boolean} — in TS: value is {name: string, age: number}
 */
function isUser(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "age" in value &&
    typeof /** @type {any} */ (value).name === "string" &&
    typeof /** @type {any} */ (value).age === "number"
  );
}

const maybeUser = { name: "Alice", age: 30 };
show("Custom type guard", isUser(maybeUser)); // true
show("Custom type guard", isUser({ name: "Bob" })); // false (no age)

// --- Assertion function ---
/**
 * TS:
 *   function assertDefined<T>(val: T | undefined | null, msg: string): asserts val is T {
 *     if (val === undefined || val === null) throw new Error(msg);
 *   }
 *
 * @template T
 * @param {T | undefined | null} val
 * @param {string} msg
 * @returns {asserts val is T}
 */
function assertDefined(val, msg) {
  if (val === undefined || val === null) {
    throw new Error(msg);
  }
}

/** @type {string | undefined} */
const maybeName = "Alice";
assertDefined(maybeName, "Name is required");
// After assertion, TS knows maybeName is string (not undefined)
show("Assertion function", maybeName.toUpperCase());

// --- Discriminated union narrowing ---
/**
 * @typedef {{ status: "loading" }} Loading
 * @typedef {{ status: "success", data: string }} Success
 * @typedef {{ status: "error", error: string }} Failure
 * @typedef {Loading | Success | Failure} AsyncState
 */

/**
 * @param {AsyncState} state
 * @returns {string}
 */
function renderState(state) {
  switch (state.status) {
    case "loading":
      return "Loading...";
    case "success":
      return `Data: ${state.data}`;
    case "error":
      return `Error: ${state.error}`;
    default: {
      /** @type {never} */
      const _exhaustive = /** @type {never} */ (state);
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
show("Discriminated union", renderState({ status: "success", data: "Hello!" }));
show("Discriminated union", renderState({ status: "error", error: "Failed" }));

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  8. TEMPLATE LITERAL TYPES                                             ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("8. Template Literal Types");

/**
 * TS template literal types create types from string concatenation:
 *
 *   type EventName = `on${Capitalize<string>}`;
 *   // matches: "onClick", "onHover", "onSubmit", etc.
 *
 *   type Getter<T extends string> = `get${Capitalize<T>}`;
 *   type NameGetter = Getter<"name">; // "getName"
 *
 *   type CSSUnit = `${number}${"px" | "em" | "rem" | "%"}`;
 *   const width: CSSUnit = "100px";  // OK
 *   const bad: CSSUnit = "100vw";    // Error!
 *
 * Intrinsic string manipulation types:
 *   Uppercase<T>   — "hello" -> "HELLO"
 *   Lowercase<T>   — "HELLO" -> "hello"
 *   Capitalize<T>  — "hello" -> "Hello"
 *   Uncapitalize<T> — "Hello" -> "hello"
 *
 * Practical example — event emitter type:
 *
 *   type Events = {
 *     click: MouseEvent;
 *     focus: FocusEvent;
 *   };
 *
 *   type EventHandler<T extends keyof Events> = `on${Capitalize<T>}`;
 *   // "onClick" | "onFocus"
 */

// Runtime demonstration of the concepts:
/**
 * @param {string} event
 * @returns {string}
 */
function toHandlerName(event) {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

const events = ["click", "focus", "submit", "change"];
const handlers = events.map(toHandlerName);
show("Template literal type concept", handlers);

/**
 * Advanced TS example — path-based API types:
 *
 *   type ApiPath = `/api/${"users" | "posts" | "comments"}`;
 *   type ApiPathWithId = `${ApiPath}/${number}`;
 *
 *   function fetchApi(path: ApiPath): Promise<any>;
 *   fetchApi("/api/users");    // OK
 *   fetchApi("/api/unknown");  // Error!
 */
show("Template literal types", "Powerful for type-safe strings (CSS, routes, events, etc.)");

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  9. DECLARATION MERGING                                                ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("9. Declaration Merging");

/**
 * Declaration merging: TypeScript combines multiple declarations with the
 * same name into a single definition.
 *
 * Types that merge:
 *   - interface + interface → merged interface
 *   - namespace + namespace → merged namespace
 *   - class + interface → class implements the merged interface
 *   - function + namespace → function with added properties
 *   - enum + namespace → enum with static methods
 *
 * DOES NOT MERGE:
 *   - type aliases (error: duplicate identifier)
 *   - class + class (error)
 *
 * TS Example — interface merging:
 *
 *   interface Box {
 *     width: number;
 *   }
 *   interface Box {
 *     height: number;
 *   }
 *   // Box now has both width AND height
 *
 * Module augmentation (extending third-party types):
 *
 *   // express.d.ts
 *   declare module "express" {
 *     interface Request {
 *       userId?: string;  // Add custom property
 *     }
 *   }
 *
 * Global augmentation:
 *
 *   declare global {
 *     interface Array<T> {
 *       customMethod(): T[];
 *     }
 *   }
 */

// Runtime demonstration of the concept — adding properties to function:
function greet(name) {
  return `Hello, ${name}!`;
}
greet.defaultName = "World";
greet.polite = function (name) {
  return `Good day, ${name}. How do you do?`;
};

show("Function + namespace pattern", greet("Alice"));
show("Static property", greet.defaultName);
show("Static method", greet.polite("Bob"));

/**
 * TS function + namespace merging:
 *
 *   function greet(name: string): string;
 *   namespace greet {
 *     export const defaultName = "World";
 *     export function polite(name: string): string;
 *   }
 */

show("Declaration merging", "Key TS feature for extending interfaces and modules");

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  10. ENUMS vs CONST ENUMS vs UNION OF LITERALS                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("10. Enums vs Const Enums vs Union of Literals");

/**
 * THREE APPROACHES to defining a fixed set of values in TypeScript:
 *
 * 1. ENUM (TS: enum):
 *    - Generates runtime JavaScript (object with reverse mapping for numeric)
 *    - Can be numeric or string
 *    - Supports computed members
 *    - Creates a type AND a value
 *
 * 2. CONST ENUM (TS: const enum):
 *    - Inlined at compile time (no runtime object generated)
 *    - Better performance (no lookup)
 *    - Cannot be used where runtime object is needed
 *    - Disabled by default with isolatedModules
 *
 * 3. UNION OF LITERALS:
 *    - type Status = "active" | "inactive" | "pending"
 *    - No runtime cost (just a type)
 *    - Preferred by many TS teams
 *    - Works naturally with exhaustiveness checking
 *
 * RECOMMENDATION:
 *   Prefer UNION OF LITERALS for most cases. Use enum only when you
 *   need both a type and a runtime value.
 */

// Simulating TS enum in JavaScript:
/**
 * TS: enum Direction { Up = "UP", Down = "DOWN", Left = "LEFT", Right = "RIGHT" }
 */
const Direction = Object.freeze({
  Up: "UP",
  Down: "DOWN",
  Left: "LEFT",
  Right: "RIGHT",
});
show("Enum (object)", Direction);
show("Enum access", Direction.Up); // "UP"

/**
 * TS numeric enum (auto-incrementing):
 * enum Color { Red, Green, Blue } // Red=0, Green=1, Blue=2
 *
 * Numeric enums create REVERSE MAPPINGS:
 *   Color[0] === "Red"
 *   Color["Red"] === 0
 */

// Simulating numeric enum with reverse mapping:
function createNumericEnum(names) {
  const result = {};
  names.forEach((name, index) => {
    result[name] = index;
    result[index] = name; // reverse mapping
  });
  return Object.freeze(result);
}

const Color = createNumericEnum(["Red", "Green", "Blue"]);
show("Numeric enum", { Red: Color.Red, "0": Color[0] });

// Union of literals approach (preferred):
/**
 * @typedef {"active" | "inactive" | "pending"} UserStatus
 *
 * TS: type UserStatus = "active" | "inactive" | "pending";
 */

/** @type {readonly string[]} */
const USER_STATUSES = /** @type {const} */ (["active", "inactive", "pending"]);

/**
 * @param {UserStatus} status
 * @returns {string}
 */
function describeStatus(status) {
  const descriptions = {
    active: "User is currently active",
    inactive: "User account is inactive",
    pending: "User is awaiting approval",
  };
  return descriptions[status] ?? "Unknown status";
}
show("Union of literals", describeStatus("active"));
show("Union of literals", describeStatus("pending"));

/**
 * TS: const enum (inlined — no runtime object):
 *
 *   const enum Flags {
 *     None = 0,
 *     Bold = 1 << 0,
 *     Italic = 1 << 1,
 *     Underline = 1 << 2,
 *   }
 *   let style = Flags.Bold | Flags.Italic;
 *   // Compiled JS: let style = 1 | 2;  (inlined!)
 */
show("const enum", "Inlined at compile time — no runtime object. Best for perf-critical flags.");

console.log(`
  Comparison table:

  ┌─────────────────┬──────────────┬──────────────┬───────────────────┐
  │ Feature         │ enum         │ const enum   │ Union of literals │
  ├─────────────────┼──────────────┼──────────────┼───────────────────┤
  │ Runtime object  │ Yes          │ No (inlined) │ No (type only)    │
  │ Tree-shakeable  │ No           │ Yes          │ Yes               │
  │ Reverse mapping │ Numeric only │ No           │ No                │
  │ Computed values │ Yes          │ Yes          │ No                │
  │ Iterable        │ Yes          │ No           │ Array needed      │
  │ Recommended     │ Sometimes    │ Rarely       │ Usually           │
  └─────────────────┴──────────────┴──────────────┴───────────────────┘`);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  11. unknown vs any vs never                                           ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("11. unknown vs any vs never");

/**
 * any:
 *   - Disables ALL type checking
 *   - Any operation is allowed
 *   - Contagious: any spreads through your codebase
 *   - Use: migration from JS, quick prototyping, truly dynamic content
 *   - AVOID in production code
 *
 * unknown:
 *   - Type-safe counterpart of any
 *   - You CAN assign anything to unknown
 *   - You CANNOT use it without narrowing first
 *   - Preferred over any for values of unknown type
 *   - Use: function parameters that accept anything, API responses
 *
 * never:
 *   - The "empty" type — no value can ever be of type never
 *   - A function returning never: throws or runs forever
 *   - Used for exhaustiveness checking
 *   - Appears when narrowing eliminates all possibilities
 *
 * void:
 *   - Function returns nothing (undefined implicitly)
 *   - Different from undefined in TS context
 */

// --- unknown: must narrow before use ---

/**
 * @param {unknown} input
 * @returns {string}
 */
function safeStringify(input) {
  if (typeof input === "string") return input;
  if (typeof input === "number") return input.toString();
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return JSON.stringify(input);
  if (typeof input === "object" && input !== null) return JSON.stringify(input);
  return String(input);
}
show("unknown narrowing (string)", safeStringify("hello"));
show("unknown narrowing (number)", safeStringify(42));
show("unknown narrowing (Date)", safeStringify(new Date("2024-01-01")));
show("unknown narrowing (array)", safeStringify([1, 2, 3]));

// --- never: exhaustiveness and impossible states ---

/**
 * @param {never} value
 * @returns {never}
 *
 * TS: function assertNever(value: never): never
 */
function assertNever(value) {
  throw new Error(`Unexpected value: ${value}`);
}

/**
 * @param {"circle" | "square"} shape
 * @returns {string}
 */
function describeShape(shape) {
  switch (shape) {
    case "circle":
      return "round";
    case "square":
      return "angular";
    default:
      return assertNever(/** @type {never} */ (shape)); // compiler catches missing cases
  }
}
show("Exhaustiveness with never", describeShape("circle"));

// Function that returns never (always throws):
/**
 * @param {string} message
 * @returns {never}
 */
function throwError(message) {
  throw new Error(message);
}

// Function that returns never (infinite loop):
/**
 * @returns {never}
 */
function infiniteLoop() {
  while (true) {
    // This function NEVER returns
  }
}

console.log(`
  Type hierarchy (top to bottom):
    unknown    ← accepts any value (top type)
      ↓
    string, number, boolean, object, etc. ← specific types
      ↓
    literal types ("hello", 42, true)
      ↓
    never      ← accepts NO value (bottom type)

  Key rules:
    - any bypasses the type system entirely
    - unknown is the safe "I don't know the type" — must narrow before use
    - never is the "impossible" type — used for exhaustiveness checks
    - Prefer unknown over any; use never for exhaustiveness
`);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  12. STRICT MODE BENEFITS                                              ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("12. TypeScript Strict Mode Benefits");

/**
 * tsconfig.json "strict": true enables ALL strict checks:
 *
 * 1. strictNullChecks:
 *    - null and undefined are NOT assignable to other types
 *    - Forces you to handle null/undefined explicitly
 *    - const name: string = null; // Error!
 *    - const name: string | null = null; // OK
 *
 * 2. strictFunctionTypes:
 *    - Enforces contravariance for function parameter types
 *    - Catches subtle bugs in callback types
 *
 * 3. strictBindCallApply:
 *    - Type-checks bind(), call(), apply() arguments
 *
 * 4. strictPropertyInitialization:
 *    - Class properties must be initialized in constructor
 *    - Or marked with ! (definite assignment assertion)
 *
 * 5. noImplicitAny:
 *    - Parameters without types are errors (not implicitly any)
 *
 * 6. noImplicitThis:
 *    - 'this' must have an explicit type in functions
 *
 * 7. alwaysStrict:
 *    - Emits "use strict" in all output files
 *
 * 8. useUnknownInCatchVariables:
 *    - catch(e) gives e type unknown instead of any
 *    - Forces you to check error type before using properties
 *
 * INTERVIEW TIP: Always enable "strict": true for new projects.
 * It catches many bugs at compile time and is considered best practice.
 */

// Demonstrating strictNullChecks concept:
/**
 * @param {Map<string, number>} map
 * @param {string} key
 * @returns {number}
 */
function safeGet(map, key) {
  const value = map.get(key); // type: number | undefined (with strictNullChecks)
  if (value === undefined) {
    throw new Error(`Key "${key}" not found`);
  }
  return value; // narrowed to number
}

const myMap = new Map([["a", 1], ["b", 2]]);
show("strictNullChecks pattern", safeGet(myMap, "a"));

// Demonstrating useUnknownInCatchVariables:
try {
  throw new Error("test error");
} catch (e) {
  // With useUnknownInCatchVariables: e is unknown
  // Must narrow before using:
  if (e instanceof Error) {
    show("catch with unknown", e.message);
  }
}

// strictPropertyInitialization:
class StrictClass {
  /** @type {string} */
  name;

  /** @type {number} */
  value;

  /**
   * @param {string} name
   * @param {number} value
   */
  constructor(name, value) {
    this.name = name; // Must initialize in constructor!
    this.value = value;
  }
}

show("strictPropertyInitialization", new StrictClass("test", 42));

console.log(`
  Recommended tsconfig.json strict settings:
  {
    "compilerOptions": {
      "strict": true,                    // enables ALL strict checks
      "noUncheckedIndexedAccess": true,  // arr[0] is T | undefined
      "exactOptionalPropertyTypes": true, // optional != undefined
      "noImplicitReturns": true,         // all paths must return
      "noFallthroughCasesInSwitch": true, // switch cases must break/return
      "forceConsistentCasingInFileNames": true
    }
  }
`);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  13. TYPESCRIPT PATTERNS — JSDoc + TS COMPARISON                       ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("13. TypeScript Patterns — JSDoc + TS Side by Side");

// Pattern 1: Builder pattern with generics
/**
 * @template T
 *
 * TS:
 *   class Builder<T extends Record<string, any>> {
 *     private data: Partial<T> = {};
 *     set<K extends keyof T>(key: K, value: T[K]): this {
 *       this.data[key] = value;
 *       return this;
 *     }
 *     build(): T {
 *       return this.data as T;
 *     }
 *   }
 */
class Builder {
  /** @type {Partial<T>} */
  #data = {};

  /**
   * @param {string} key
   * @param {*} value
   * @returns {this}
   */
  set(key, value) {
    this.#data[key] = value;
    return this;
  }

  /** @returns {T} */
  build() {
    return /** @type {T} */ ({ ...this.#data });
  }
}

const user = new Builder()
  .set("name", "Alice")
  .set("age", 30)
  .set("role", "admin")
  .build();
show("Builder pattern", user);

// Pattern 2: Result type (like Rust)
/**
 * @template T, E
 * @typedef {{ ok: true, value: T } | { ok: false, error: E }} Result
 *
 * TS:
 *   type Result<T, E> =
 *     | { ok: true; value: T }
 *     | { ok: false; error: E };
 */

/**
 * @param {string} json
 * @returns {Result<object, string>}
 */
function safeParse(json) {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const good = safeParse('{"name": "Alice"}');
const bad = safeParse("not json");
show("Result (success)", good);
show("Result (failure)", bad);

if (good.ok) {
  show("Narrowed success", good.value); // narrowed: has .value
}
if (!bad.ok) {
  show("Narrowed error", bad.error); // narrowed: has .error
}

// Pattern 3: Branded/Nominal types
/**
 * TS:
 *   type UserId = string & { readonly __brand: unique symbol };
 *   type OrderId = string & { readonly __brand: unique symbol };
 *
 *   function createUserId(id: string): UserId { return id as UserId; }
 *   function createOrderId(id: string): OrderId { return id as OrderId; }
 *
 *   // Now these are incompatible even though both are strings:
 *   const uid: UserId = createUserId("user-1");
 *   const oid: OrderId = createOrderId("order-1");
 *   // const wrong: UserId = oid; // Error!
 */

// Runtime branding pattern:
const BRAND = Symbol("brand");

function createUserId(id) {
  return Object.freeze({ value: id, [BRAND]: "UserId" });
}

function createOrderId(id) {
  return Object.freeze({ value: id, [BRAND]: "OrderId" });
}

const uid = createUserId("user-123");
const oid = createOrderId("order-456");
show("Branded UserId", uid.value);
show("Branded OrderId", oid.value);
show("Same brand?", uid[BRAND] === oid[BRAND]); // false — different brands

// Pattern 4: Type-safe event emitter
/**
 * TS:
 *   interface EventMap {
 *     click: { x: number; y: number };
 *     submit: { formId: string };
 *     close: void;
 *   }
 *
 *   class TypedEmitter<T extends Record<string, any>> {
 *     private listeners = new Map<keyof T, Set<(data: T[keyof T]) => void>>();
 *
 *     on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void { ... }
 *     emit<K extends keyof T>(event: K, data: T[K]): void { ... }
 *   }
 */

class TypedEmitter {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(handler);
    return this;
  }

  /**
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const handlers = this.#listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
    return this;
  }
}

const emitter = new TypedEmitter();
emitter.on("click", (data) => show("Event: click", data));
emitter.on("submit", (data) => show("Event: submit", data));
emitter.emit("click", { x: 100, y: 200 });
emitter.emit("submit", { formId: "login" });

console.log(`\n${"=".repeat(72)}`);
console.log("  03_typescript_essentials.js — All sections complete!");
console.log(`${"=".repeat(72)}\n`);
