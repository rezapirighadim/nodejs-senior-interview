# TypeScript Essentials -- Senior Interview Reference

## Table of Contents

- [Basic Types](#basic-types)
- [Interfaces vs Types](#interfaces-vs-types)
- [Unions and Intersections](#unions-and-intersections)
- [Generics](#generics)
- [Utility Types](#utility-types)
- [Mapped Types](#mapped-types)
- [Conditional Types](#conditional-types)
- [Type Guards and Narrowing](#type-guards-and-narrowing)
- [Template Literal Types](#template-literal-types)
- [Enums vs Union Types](#enums-vs-union-types)
- [unknown vs any vs never](#unknown-vs-any-vs-never)
- [Strict Mode](#strict-mode)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Basic Types

```typescript
// Primitives
let str: string = "hello";
let num: number = 42;
let big: bigint = 9007199254740991n;
let bool: boolean = true;
let sym: symbol = Symbol("id");
let undef: undefined = undefined;
let nul: null = null;

// Arrays
let numbers: number[] = [1, 2, 3];
let strings: Array<string> = ["a", "b", "c"]; // generic form

// Tuples
let pair: [string, number] = ["age", 30];
let namedTuple: [name: string, age: number] = ["Alice", 30]; // labeled

// Readonly tuple
let point: readonly [number, number] = [10, 20];
// point[0] = 5; // Error: Cannot assign to '0' because it is a read-only property

// Objects
let user: { name: string; age: number; email?: string } = {
  name: "Alice",
  age: 30,
};

// Functions
type Callback = (error: Error | null, data: string) => void;
type AsyncFn = (id: number) => Promise<string>;

// void vs undefined
function logMessage(msg: string): void {
  console.log(msg);
  // Implicitly returns undefined, but `void` means "ignore the return value"
}

// Function overloads
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  if (typeof input === "string") return parseInt(input, 10);
  return input.toString();
}
```

---

## Interfaces vs Types

### Comparison Table

| Feature                   | `interface`              | `type`                   |
|---------------------------|--------------------------|--------------------------|
| Object shape              | Yes                      | Yes                      |
| Extend/inherit            | `extends`                | `&` (intersection)       |
| Implements (class)        | Yes                      | Yes                      |
| Declaration merging       | Yes                      | No                       |
| Union types               | No                       | Yes                      |
| Mapped types              | No                       | Yes                      |
| Primitive aliases          | No                       | Yes                      |
| Computed properties       | No                       | Yes                      |
| Performance (complex)     | Slightly better caching  | Eagerly evaluated        |

### Interface

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Extending
interface Admin extends User {
  role: "admin";
  permissions: string[];
}

// Declaration merging (unique to interfaces)
interface Config {
  host: string;
}
interface Config {
  port: number;
}
// Config is now { host: string; port: number }

// Index signatures
interface StringMap {
  [key: string]: string;
}

// Call signatures
interface Formatter {
  (value: unknown): string;
  locale: string;
}
```

### Type Alias

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

// Extending via intersection
type Admin = User & {
  role: "admin";
  permissions: string[];
};

// Things only type can do:
type ID = string | number;                     // union
type Pair<T> = [T, T];                         // tuple
type Primitive = string | number | boolean;    // union of primitives
type EventName = `on${string}`;               // template literal
type Point = { x: number; y: number };
type ReadonlyPoint = Readonly<Point>;          // utility type usage
```

### When to Use Which

```typescript
// Use INTERFACE when:
// - Defining object shapes that will be implemented by classes
// - You need declaration merging (e.g., extending third-party types)
// - Defining public API contracts

interface Repository<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// Use TYPE when:
// - You need unions, intersections, or mapped types
// - Defining function types, tuples, or primitives
// - Complex type transformations

type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
type EventHandler<T> = (event: T) => void;
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

---

## Unions and Intersections

### Union Types (`|`)

```typescript
type Status = "pending" | "active" | "inactive";
type ID = string | number;

// Discriminated unions (tagged unions) -- extremely important pattern
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
  }
}

// Exhaustiveness checking with `never`
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function handleShape(shape: Shape): string {
  switch (shape.kind) {
    case "circle":    return "circle";
    case "rectangle": return "rectangle";
    case "triangle":  return "triangle";
    default:          return assertNever(shape); // compile error if a case is missing
  }
}
```

### Intersection Types (`&`)

```typescript
type HasId = { id: string };
type HasTimestamps = { createdAt: Date; updatedAt: Date };
type HasSoftDelete = { deletedAt: Date | null };

type BaseEntity = HasId & HasTimestamps & HasSoftDelete;

// Practical: mixing in behaviors
type Loggable = { log(): void };
type Serializable = { serialize(): string };

type LoggableUser = User & Loggable & Serializable;

// Note: intersecting incompatible types creates `never`
type Impossible = string & number; // never
```

---

## Generics

### Basic Generics

```typescript
// Generic function
function identity<T>(value: T): T {
  return value;
}

const str = identity("hello"); // type: string
const num = identity(42);      // type: number

// Generic interface
interface Box<T> {
  value: T;
  map<U>(fn: (value: T) => U): Box<U>;
}

// Generic class
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);
```

### Generic Constraints

```typescript
// Constrain with extends
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 30 };
getProperty(user, "name");  // OK, type: string
// getProperty(user, "email"); // Error: "email" is not in keyof typeof user

// Multiple constraints
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(value: T): T {
  console.log(value.length);
  return value;
}

logLength("hello");      // OK (string has .length)
logLength([1, 2, 3]);   // OK (array has .length)
// logLength(42);        // Error (number has no .length)

// Default type parameters
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message: string;
}

const response: ApiResponse = { data: null, status: 200, message: "OK" };
const typedResponse: ApiResponse<User[]> = {
  data: [{ id: 1, name: "Alice", email: "alice@example.com" }],
  status: 200,
  message: "OK",
};
```

### Advanced Generic Patterns

```typescript
// Constrained type parameters with conditional inference
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
type A = UnpackPromise<Promise<string>>; // string
type B = UnpackPromise<number>;          // number

// Generic factory
function createInstance<T>(Ctor: new (...args: any[]) => T, ...args: any[]): T {
  return new Ctor(...args);
}

// Builder pattern with generics
class QueryBuilder<T> {
  private conditions: string[] = [];

  where(condition: keyof T & string, value: T[keyof T]): this {
    this.conditions.push(`${condition} = ?`);
    return this;
  }

  build(): string {
    return `SELECT * FROM table WHERE ${this.conditions.join(" AND ")}`;
  }
}

// Variadic tuple types
function concat<T extends unknown[], U extends unknown[]>(
  a: [...T],
  b: [...U]
): [...T, ...U] {
  return [...a, ...b];
}

const result = concat([1, "a"], [true, 42]);
// type: [number, string, boolean, number]
```

---

## Utility Types

### Built-in Utility Types Reference

| Utility Type                | Description                                    | Example                                |
|-----------------------------|------------------------------------------------|----------------------------------------|
| `Partial<T>`               | All properties optional                        | `Partial<User>`                        |
| `Required<T>`              | All properties required                        | `Required<Config>`                     |
| `Readonly<T>`              | All properties readonly                        | `Readonly<State>`                      |
| `Pick<T, K>`               | Select subset of properties                    | `Pick<User, "name" \| "email">`       |
| `Omit<T, K>`               | Remove properties                              | `Omit<User, "password">`              |
| `Record<K, V>`             | Object with keys K and values V                | `Record<string, number>`              |
| `Extract<T, U>`            | Extract members from union                     | `Extract<Status, "active">`           |
| `Exclude<T, U>`            | Remove members from union                      | `Exclude<Status, "deleted">`          |
| `NonNullable<T>`           | Remove null and undefined                      | `NonNullable<string \| null>`         |
| `ReturnType<T>`            | Return type of a function                      | `ReturnType<typeof fn>`               |
| `Parameters<T>`            | Parameter types as tuple                       | `Parameters<typeof fn>`               |
| `ConstructorParameters<T>` | Constructor parameter types                    | `ConstructorParameters<typeof MyClass>`|
| `InstanceType<T>`          | Instance type of a constructor                 | `InstanceType<typeof MyClass>`        |
| `Awaited<T>`               | Unwrap Promise type                            | `Awaited<Promise<string>>`            |

### Practical Examples

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  createdAt: Date;
}

// Partial -- for update operations
function updateUser(id: number, updates: Partial<User>): Promise<User> {
  return db.users.update(id, updates);
}
updateUser(1, { name: "Bob" }); // Only update name

// Pick -- for DTOs / responses
type PublicUser = Pick<User, "id" | "name" | "email">;

// Omit -- remove sensitive fields
type SafeUser = Omit<User, "password">;

// Record -- for lookup maps
type RolePermissions = Record<User["role"], string[]>;
const permissions: RolePermissions = {
  admin: ["read", "write", "delete"],
  user: ["read"],
};

// ReturnType + Parameters -- useful for wrapping functions
function fetchUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then((r) => r.json());
}

type FetchUserReturn = ReturnType<typeof fetchUser>; // Promise<User>
type FetchUserParams = Parameters<typeof fetchUser>; // [number]

// Combine utilities
type CreateUserInput = Omit<User, "id" | "createdAt">;
type UserUpdate = Partial<Omit<User, "id">>;
type ReadonlyUser = Readonly<User>;
```

---

## Mapped Types

Mapped types transform each property in a type according to a rule.

```typescript
// Basic mapped type (how Partial works internally)
type MyPartial<T> = {
  [P in keyof T]?: T[P];
};

// How Readonly works internally
type MyReadonly<T> = {
  readonly [P in keyof T]: T[P];
};

// Remove readonly (using -readonly)
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Make all properties required (using -?)
type MyRequired<T> = {
  [P in keyof T]-?: T[P];
};
```

### Advanced Mapped Types

```typescript
// Key remapping with `as`
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }

// Filter properties by type
type OnlyStrings<T> = {
  [P in keyof T as T[P] extends string ? P : never]: T[P];
};

type StringProps = OnlyStrings<Person>;
// { name: string }

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

// Practical: event map
type EventMap<T> = {
  [P in keyof T as `on${Capitalize<string & P>}Change`]: (
    newValue: T[P],
    oldValue: T[P]
  ) => void;
};

type UserEvents = EventMap<Person>;
// {
//   onNameChange: (newValue: string, oldValue: string) => void;
//   onAgeChange: (newValue: number, oldValue: number) => void;
// }
```

---

## Conditional Types

Conditional types select one of two types based on a condition.

```typescript
// Basic syntax: T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false

// Distributive conditional types (distributes over unions)
type ToArray<T> = T extends unknown ? T[] : never;
type Result = ToArray<string | number>; // string[] | number[]

// Non-distributive (wrap in tuple to prevent distribution)
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;
type Result2 = ToArrayNonDist<string | number>; // (string | number)[]
```

### `infer` Keyword

```typescript
// Extract return type
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type R1 = MyReturnType<() => string>;          // string
type R2 = MyReturnType<(x: number) => boolean>; // boolean

// Extract element type from array
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>; // string

// Extract Promise value type
type Unpacked<T> =
  T extends Promise<infer U> ? Unpacked<U> : // recursive for nested promises
  T extends (infer U)[] ? U :
  T;

type T1 = Unpacked<Promise<Promise<string>>>; // string
type T2 = Unpacked<number[]>;                  // number
type T3 = Unpacked<string>;                    // string

// Infer function parameters
type FirstParam<T> = T extends (first: infer F, ...args: any[]) => any
  ? F
  : never;

type FP = FirstParam<(name: string, age: number) => void>; // string

// Infer from string template types
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractRouteParams<"/api/users/:userId/posts/:postId">;
// "userId" | "postId"
```

---

## Type Guards and Narrowing

### Built-in Narrowing

```typescript
function process(value: string | number | null) {
  // typeof narrowing
  if (typeof value === "string") {
    value.toUpperCase(); // type: string
  }

  // Truthiness narrowing
  if (value) {
    // type: string | number (null eliminated)
  }

  // Equality narrowing
  if (value === null) {
    // type: null
  }

  // instanceof narrowing
  if (value instanceof Date) {
    // doesn't apply here, but for classes/constructors
  }
}
```

### Custom Type Guards

```typescript
// User-defined type guard (type predicate)
interface Cat {
  kind: "cat";
  meow(): void;
}

interface Dog {
  kind: "dog";
  bark(): void;
}

type Animal = Cat | Dog;

function isCat(animal: Animal): animal is Cat {
  return animal.kind === "cat";
}

function handleAnimal(animal: Animal) {
  if (isCat(animal)) {
    animal.meow(); // type: Cat
  } else {
    animal.bark(); // type: Dog
  }
}

// Assertion functions (asserts)
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

function processInput(input: unknown) {
  assertIsString(input);
  // After assertion, TypeScript knows input is string
  console.log(input.toUpperCase());
}

// Discriminated union narrowing
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: ApiResult<T>) {
  if (result.success) {
    console.log(result.data);  // type: T
  } else {
    console.log(result.error); // type: string
  }
}

// `in` operator narrowing
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim(); // type: Fish
  } else {
    animal.fly();  // type: Bird
  }
}
```

### Advanced Narrowing

```typescript
// Control flow analysis
function example(x: string | number | boolean) {
  if (typeof x === "string") {
    return x.toUpperCase(); // string
  }
  // Here x is number | boolean
  if (typeof x === "number") {
    return x.toFixed(2); // number
  }
  // Here x is boolean
  return x ? "yes" : "no"; // boolean
}

// Narrowing with Array.filter
const mixed: (string | null)[] = ["a", null, "b", null, "c"];

// Without type guard: (string | null)[]
const filtered1 = mixed.filter((item) => item !== null);

// With type guard: string[]
const filtered2 = mixed.filter((item): item is string => item !== null);
```

---

## Template Literal Types

```typescript
// Basic template literal types
type EventName = `on${string}`;
type CSSProperty = `--${string}`;

// With unions -- creates all combinations
type Color = "red" | "green" | "blue";
type Size = "small" | "medium" | "large";
type ColorSize = `${Color}-${Size}`;
// "red-small" | "red-medium" | "red-large" | "green-small" | ...

// Intrinsic string manipulation types
type Upper = Uppercase<"hello">;     // "HELLO"
type Lower = Lowercase<"HELLO">;     // "hello"
type Cap = Capitalize<"hello">;      // "Hello"
type Uncap = Uncapitalize<"Hello">; // "hello"

// Type-safe event system
type Model = {
  name: string;
  age: number;
  active: boolean;
};

type ModelEvents = {
  [K in keyof Model as `on${Capitalize<K & string>}Change`]: (
    value: Model[K]
  ) => void;
};
// {
//   onNameChange: (value: string) => void;
//   onAgeChange: (value: number) => void;
//   onActiveChange: (value: boolean) => void;
// }

// Type-safe route parameters
type ExtractParam<Path, NextPart> = Path extends `:${infer Param}`
  ? Record<Param, string> & NextPart
  : NextPart;

type ParseRoute<Route extends string> =
  Route extends `${infer Start}/${infer Rest}`
    ? ExtractParam<Start, ParseRoute<Rest>>
    : ExtractParam<Route, {}>;

type UserRoute = ParseRoute<"users/:id/posts/:postId">;
// { id: string } & { postId: string }
```

---

## Enums vs Union Types

### Comparison Table

| Feature                | Enum                          | Union                           |
|------------------------|-------------------------------|---------------------------------|
| Runtime presence       | Yes (generates JS object)     | No (erased at compile time)     |
| Reverse mapping        | Yes (numeric only)            | No                              |
| Tree-shaking           | Poor (unless `const enum`)    | Perfect                         |
| Computed values        | Limited                       | Full type operations            |
| Iteration at runtime   | `Object.values(MyEnum)`       | Not possible                    |
| Type safety            | Good                          | Excellent                       |
| Bundle size impact     | Adds code                     | Zero                            |

### Enums

```typescript
// Numeric enum
enum Direction {
  Up,     // 0
  Down,   // 1
  Left,   // 2
  Right,  // 3
}

// String enum
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}

// const enum (inlined at compile time, no runtime object)
const enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

// Usage
const method = HttpMethod.GET; // Compiled to: const method = "GET"

// Reverse mapping (numeric enums only)
console.log(Direction[0]); // "Up"
console.log(Direction.Up); // 0
```

### Recommended: Union Types Over Enums

```typescript
// Preferred approach for most cases
type Direction = "up" | "down" | "left" | "right";
type Status = "active" | "inactive" | "pending";
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// If you need runtime values, use `as const`
const DIRECTIONS = ["up", "down", "left", "right"] as const;
type Direction2 = (typeof DIRECTIONS)[number]; // "up" | "down" | "left" | "right"

// Object const pattern (when you need both type and runtime value)
const Status2 = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
  Pending: "PENDING",
} as const;

type Status2Type = (typeof Status2)[keyof typeof Status2];
// "ACTIVE" | "INACTIVE" | "PENDING"

// Iterate at runtime
Object.values(Status2); // ["ACTIVE", "INACTIVE", "PENDING"]
```

---

## unknown vs any vs never

### Comparison Table

| Feature           | `any`               | `unknown`           | `never`                |
|-------------------|---------------------|---------------------|------------------------|
| Assignable to     | Everything          | Only `unknown`/`any`| Everything             |
| Assignable from   | Everything          | Everything          | Nothing                |
| Operations        | All allowed         | None without narrowing | N/A                 |
| Type safety       | None                | Full                | Full                   |
| Use case          | Migration, escape hatch | Safe "any"      | Impossible states      |

```typescript
// any -- disables type checking (avoid in production code)
let anything: any = 42;
anything.nonExistent.method(); // No error at compile time (runtime crash)
anything = "now a string";
const num: number = anything; // No error -- any is assignable to everything

// unknown -- safe top type (must narrow before use)
let uncertain: unknown = 42;
// uncertain.toFixed(); // Error: Object is of type 'unknown'

if (typeof uncertain === "number") {
  uncertain.toFixed(); // OK after narrowing
}

// unknown in practice -- safe API boundaries
async function fetchData(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json();
}

const data = await fetchData("/api/user");
// Must validate before using:
if (isUser(data)) {
  console.log(data.name); // type-safe
}

// never -- the bottom type (no value can be assigned)
// 1. Functions that never return
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {}
}

// 2. Exhaustiveness checking
type Shape = "circle" | "square";

function getArea(shape: Shape): number {
  switch (shape) {
    case "circle": return 3.14;
    case "square": return 1;
    default:
      const _exhaustive: never = shape;
      throw new Error(`Unknown shape: ${_exhaustive}`);
  }
}
// If a new shape is added but not handled, TypeScript will error at compile time
```

---

## Strict Mode

### tsconfig.json Strict Options

```jsonc
{
  "compilerOptions": {
    "strict": true, // Enables ALL strict checks below:
    // "noImplicitAny": true,           // Error on implied 'any' type
    // "strictNullChecks": true,         // null/undefined not assignable to other types
    // "strictFunctionTypes": true,      // Stricter function type checking
    // "strictBindCallApply": true,      // Check bind, call, apply arguments
    // "strictPropertyInitialization": true, // Class properties must be initialized
    // "noImplicitThis": true,           // Error on 'this' with implied 'any' type
    // "useUnknownInCatchVariables": true, // catch variable is 'unknown' not 'any'
    // "alwaysStrict": true              // Emit "use strict" in every file
  }
}
```

### Impact of Each Flag

```typescript
// noImplicitAny
function greet(name) {} // Error: Parameter 'name' implicitly has an 'any' type
function greet(name: string) {} // OK

// strictNullChecks
let name: string;
name = null;      // Error: Type 'null' is not assignable to type 'string'
name = undefined; // Error

let maybeName: string | null = null; // OK

function getLength(str: string | null): number {
  // return str.length;   // Error: str is possibly null
  return str?.length ?? 0; // OK
}

// strictPropertyInitialization
class User {
  name: string;  // Error: Property 'name' has no initializer
  age!: number;  // OK with definite assignment assertion (!)
  email: string = ""; // OK with default value

  constructor(name: string) {
    this.name = name; // OK, initialized in constructor
  }
}

// useUnknownInCatchVariables
try {
  throw new Error("fail");
} catch (error) {
  // With this flag: error is 'unknown'
  // Without: error is 'any'
  if (error instanceof Error) {
    console.log(error.message); // OK after narrowing
  }
}
```

---

## Interview Tips and Key Takeaways

1. **Discriminated unions** are the most important TypeScript pattern for senior interviews. Know them cold -- they are used in Redux actions, API responses, and state machines.

2. **Generics with constraints** -- practice writing functions with `<T extends SomeType>` and using `keyof`, `infer`, and mapped types fluently.

3. **`unknown` over `any`** -- always prefer `unknown` when the type is truly not known. It forces safe narrowing.

4. **Utility types** -- memorize at least `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Parameters`, and `Awaited`. Be able to explain how they work internally using mapped/conditional types.

5. **Type guards** -- know the difference between `typeof`, `instanceof`, `in`, user-defined type predicates (`is`), and assertion functions (`asserts`).

6. **`const` assertions** (`as const`) are the idiomatic alternative to enums in modern TypeScript.

7. **Strict mode** should always be enabled. Be able to explain what each flag does and why it matters.

8. **Interface vs Type** -- the practical answer is "use interface for object shapes that need extension/merging, use type for everything else." But know the nuances.

9. **Template literal types** combined with mapped types enable powerful type-safe APIs (event systems, route parsing, CSS-in-JS).

10. **`never` for exhaustiveness** -- this pattern catches missing cases at compile time and is essential for maintainable switch statements on discriminated unions.

---

## Quick Reference / Cheat Sheet

```text
UTILITY TYPES
  Partial<T>         -> all props optional
  Required<T>        -> all props required
  Readonly<T>        -> all props readonly
  Pick<T, K>         -> select props
  Omit<T, K>         -> remove props
  Record<K, V>       -> object type from keys/values
  Extract<T, U>      -> keep matching union members
  Exclude<T, U>      -> remove matching union members
  NonNullable<T>     -> remove null/undefined
  ReturnType<F>      -> function return type
  Parameters<F>      -> function params as tuple
  Awaited<T>         -> unwrap Promise

NARROWING TECHNIQUES
  typeof x === "string"          -> primitive check
  x instanceof MyClass           -> class check
  "prop" in x                    -> property check
  x.kind === "circle"            -> discriminant check
  isMyType(x): x is MyType       -> custom type guard
  assertIsType(x): asserts x is T -> assertion function

MAPPED TYPE SYNTAX
  { [P in keyof T]: NewType }            -> transform values
  { [P in keyof T as NewKey]: T[P] }     -> transform keys
  { [P in keyof T]-?: T[P] }             -> remove optional
  { -readonly [P in keyof T]: T[P] }     -> remove readonly

CONDITIONAL TYPE SYNTAX
  T extends U ? X : Y                    -> basic conditional
  T extends (infer U)[] ? U : never      -> infer from array
  T extends (...args: infer P) => any ? P : never -> infer params

TOP/BOTTOM TYPES
  any      -> top type (unsafe, allows everything)
  unknown  -> top type (safe, requires narrowing)
  never    -> bottom type (no value, exhaustiveness)
  void     -> no meaningful return value

CONST ASSERTION
  const x = ["a", "b"] as const;  -> readonly ["a", "b"]
  type X = typeof x[number];      -> "a" | "b"
```
