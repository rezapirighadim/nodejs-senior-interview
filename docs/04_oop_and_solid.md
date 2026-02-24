# OOP and SOLID Principles -- Senior Interview Reference

## Table of Contents

- [Classes in JavaScript](#classes-in-javascript)
- [Inheritance](#inheritance)
- [Composition](#composition)
- [Private Fields and Methods](#private-fields-and-methods)
- [Static Members](#static-members)
- [Abstract Class Pattern](#abstract-class-pattern)
- [Mixins](#mixins)
- [SOLID Principles](#solid-principles)
  - [Single Responsibility Principle (SRP)](#1-single-responsibility-principle-srp)
  - [Open/Closed Principle (OCP)](#2-openclosed-principle-ocp)
  - [Liskov Substitution Principle (LSP)](#3-liskov-substitution-principle-lsp)
  - [Interface Segregation Principle (ISP)](#4-interface-segregation-principle-isp)
  - [Dependency Inversion Principle (DIP)](#5-dependency-inversion-principle-dip)
- [Composition Over Inheritance](#composition-over-inheritance)
- [Factory Functions vs Classes](#factory-functions-vs-classes)
- [Module Pattern](#module-pattern)
- [Dependency Injection](#dependency-injection)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Classes in JavaScript

ES6 classes are syntactic sugar over prototypal inheritance.

```javascript
class User {
  // Class fields (public)
  name;
  email;

  // Constructor
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  // Instance method
  greet() {
    return `Hello, I'm ${this.name}`;
  }

  // Getter
  get displayName() {
    return `${this.name} <${this.email}>`;
  }

  // Setter
  set displayName(value) {
    const [name, email] = value.split(" <");
    this.name = name;
    this.email = email.replace(">", "");
  }

  // toString for implicit string conversion
  toString() {
    return this.displayName;
  }

  // Makes the class iterable
  [Symbol.iterator]() {
    const entries = Object.entries(this);
    let index = 0;
    return {
      next() {
        if (index < entries.length) {
          return { value: entries[index++], done: false };
        }
        return { done: true };
      },
    };
  }
}

const user = new User("Alice", "alice@example.com");
console.log(user.greet());       // "Hello, I'm Alice"
console.log(user.displayName);   // "Alice <alice@example.com>"
console.log(`${user}`);          // "Alice <alice@example.com>"
```

---

## Inheritance

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name} makes a sound.`;
  }

  move(distance = 0) {
    return `${this.name} moved ${distance}m.`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // Must call super() before using `this`
    this.breed = breed;
  }

  // Override parent method
  speak() {
    return `${this.name} barks.`;
  }

  // Call parent method via super
  fetch(item) {
    const movement = super.move(10);
    return `${movement} ${this.name} fetched the ${item}!`;
  }
}

class ServiceDog extends Dog {
  constructor(name, breed, task) {
    super(name, breed);
    this.task = task;
  }

  // Multi-level super access
  speak() {
    return `${super.speak()} (but softly, working dog)`;
  }
}

const rex = new Dog("Rex", "Labrador");
console.log(rex.speak());       // "Rex barks."
console.log(rex.fetch("ball")); // "Rex moved 10m. Rex fetched the ball!"

console.log(rex instanceof Dog);    // true
console.log(rex instanceof Animal); // true
```

### Inheritance Pitfalls

```javascript
// The "gorilla banana problem" -- you wanted a banana but got
// a gorilla holding the banana and the entire jungle

class Vehicle {
  constructor() {
    this.hasEngine = true;
    this.hasSteering = true;
    this.hasWheels = true;
    this.passengers = [];
    this.fuelType = "gasoline";
    this.insurancePolicy = {};
    this.registrationDetails = {};
    // ... 20 more properties you may not need
  }
}

class ElectricScooter extends Vehicle {
  // Inherits hasEngine: true (wrong!)
  // Inherits fuelType: "gasoline" (wrong!)
  // Inherits all the passenger/insurance logic (unnecessary!)
}
// This is a sign you should use composition instead
```

---

## Composition

Composition builds objects by combining small, focused pieces of functionality.

```javascript
// Composition with factory functions
const canWalk = (state) => ({
  walk() {
    state.position += state.speed;
    return `Walking... position: ${state.position}`;
  },
});

const canSwim = (state) => ({
  swim() {
    state.position += state.speed * 2;
    return `Swimming... position: ${state.position}`;
  },
});

const canFly = (state) => ({
  fly() {
    state.position += state.speed * 5;
    return `Flying... position: ${state.position}`;
  },
});

function createDuck(name) {
  const state = { name, position: 0, speed: 1 };
  return {
    ...canWalk(state),
    ...canSwim(state),
    ...canFly(state),
    getName: () => state.name,
  };
}

function createPenguin(name) {
  const state = { name, position: 0, speed: 1 };
  return {
    ...canWalk(state),
    ...canSwim(state),
    // No canFly -- penguins can't fly
    getName: () => state.name,
  };
}

const donald = createDuck("Donald");
console.log(donald.walk()); // "Walking... position: 1"
console.log(donald.fly());  // "Flying... position: 6"

const opus = createPenguin("Opus");
console.log(opus.walk()); // "Walking... position: 1"
console.log(opus.swim()); // "Swimming... position: 3"
// opus.fly(); // TypeError: opus.fly is not a function
```

---

## Private Fields and Methods

### True Private Fields (#)

```javascript
class BankAccount {
  // Private fields (truly private, not accessible outside)
  #balance;
  #owner;
  #transactions = [];

  constructor(owner, initialBalance = 0) {
    this.#owner = owner;
    this.#balance = initialBalance;
  }

  // Private method
  #recordTransaction(type, amount) {
    this.#transactions.push({
      type,
      amount,
      date: new Date(),
      balance: this.#balance,
    });
  }

  deposit(amount) {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.#balance += amount;
    this.#recordTransaction("deposit", amount);
    return this;
  }

  withdraw(amount) {
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
    this.#recordTransaction("withdrawal", amount);
    return this;
  }

  get balance() {
    return this.#balance;
  }

  get statement() {
    return [...this.#transactions]; // Return a copy
  }

  // Private static field
  static #instances = 0;
  static getInstanceCount() {
    return BankAccount.#instances;
  }
}

const account = new BankAccount("Alice", 1000);
account.deposit(500).withdraw(200);
console.log(account.balance);   // 1300
// console.log(account.#balance); // SyntaxError: Private field
```

### Comparison: Private Mechanisms

| Mechanism          | Truly Private | Runtime Enforcement | TypeScript | ES Standard |
|--------------------|---------------|---------------------|------------|-------------|
| `#field`           | Yes           | Yes (SyntaxError)   | Yes        | ES2022      |
| `_convention`      | No            | No                  | No         | Convention  |
| `Symbol` keys      | Semi          | No (getOwnPropertySymbols) | No  | ES2015      |
| WeakMap            | Yes           | Yes                 | No         | ES2015      |
| TypeScript `private` | No (erased) | No                  | Yes        | TS only     |

```javascript
// WeakMap-based privacy (pre-ES2022 pattern)
const _balance = new WeakMap();

class Account {
  constructor(balance) {
    _balance.set(this, balance);
  }

  get balance() {
    return _balance.get(this);
  }

  deposit(amount) {
    _balance.set(this, _balance.get(this) + amount);
  }
}
```

---

## Static Members

```javascript
class Config {
  // Static field
  static instance = null;

  // Static method
  static getInstance() {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  // Static initialization block (ES2022)
  static {
    // Complex static initialization
    console.log("Config class loaded");
  }

  #settings = new Map();

  get(key) {
    return this.#settings.get(key);
  }

  set(key, value) {
    this.#settings.set(key, value);
  }
}

// Static factory methods
class User {
  constructor(name, email, role) {
    this.name = name;
    this.email = email;
    this.role = role;
  }

  static fromJSON(json) {
    const data = JSON.parse(json);
    return new User(data.name, data.email, data.role);
  }

  static createAdmin(name, email) {
    return new User(name, email, "admin");
  }

  static createGuest() {
    return new User("Guest", "guest@example.com", "guest");
  }
}

const admin = User.createAdmin("Alice", "alice@example.com");
const user = User.fromJSON('{"name":"Bob","email":"bob@example.com","role":"user"}');
```

---

## Abstract Class Pattern

JavaScript does not have native abstract classes, but we can emulate them.

```javascript
// Pattern 1: Throw in constructor and methods
class AbstractShape {
  constructor() {
    if (new.target === AbstractShape) {
      throw new Error("Cannot instantiate abstract class AbstractShape");
    }
  }

  // Abstract method -- must be overridden
  area() {
    throw new Error("Method 'area()' must be implemented by subclass");
  }

  // Abstract method
  perimeter() {
    throw new Error("Method 'perimeter()' must be implemented by subclass");
  }

  // Concrete method (template method pattern)
  describe() {
    return `Shape with area ${this.area().toFixed(2)} and perimeter ${this.perimeter().toFixed(2)}`;
  }
}

class Circle extends AbstractShape {
  constructor(radius) {
    super();
    this.radius = radius;
  }

  area() {
    return Math.PI * this.radius ** 2;
  }

  perimeter() {
    return 2 * Math.PI * this.radius;
  }
}

class Rectangle extends AbstractShape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }

  area() {
    return this.width * this.height;
  }

  perimeter() {
    return 2 * (this.width + this.height);
  }
}

// const shape = new AbstractShape(); // Error: Cannot instantiate abstract class
const circle = new Circle(5);
console.log(circle.describe()); // "Shape with area 78.54 and perimeter 31.42"
```

```typescript
// TypeScript native abstract classes
abstract class AbstractRepository<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract save(entity: T): Promise<T>;
  abstract delete(id: string): Promise<void>;

  // Concrete method available to all subclasses
  async findByIdOrThrow(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) throw new Error(`Entity ${id} not found`);
    return entity;
  }
}

class UserRepository extends AbstractRepository<User> {
  async findById(id: string): Promise<User | null> {
    return db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  async save(user: User): Promise<User> {
    return db.query("INSERT INTO users ...", [user]);
  }

  async delete(id: string): Promise<void> {
    await db.query("DELETE FROM users WHERE id = ?", [id]);
  }
}
```

---

## Mixins

Mixins allow you to compose behavior from multiple sources into a class.

```javascript
// Mixin pattern: functions that take a superclass and return a subclass
const Timestamped = (superclass) =>
  class extends superclass {
    constructor(...args) {
      super(...args);
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    touch() {
      this.updatedAt = new Date();
    }
  };

const SoftDeletable = (superclass) =>
  class extends superclass {
    #deleted = false;

    delete() {
      this.#deleted = true;
      this.deletedAt = new Date();
    }

    restore() {
      this.#deleted = false;
      this.deletedAt = null;
    }

    get isDeleted() {
      return this.#deleted;
    }
  };

const Validatable = (superclass) =>
  class extends superclass {
    validate() {
      const errors = [];
      for (const [key, rules] of Object.entries(this.constructor.validationRules || {})) {
        for (const rule of rules) {
          const error = rule(this[key], key);
          if (error) errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(", ")}`);
      }
      return true;
    }
  };

// Compose mixins
class BaseModel {
  constructor(data = {}) {
    Object.assign(this, data);
  }
}

class User extends Timestamped(SoftDeletable(Validatable(BaseModel))) {
  static validationRules = {
    name: [(v, k) => (!v ? `${k} is required` : null)],
    email: [(v, k) => (!v?.includes("@") ? `${k} must be a valid email` : null)],
  };
}

const user = new User({ name: "Alice", email: "alice@example.com" });
console.log(user.createdAt);   // Date (from Timestamped)
user.validate();                // OK (from Validatable)
user.delete();                  // (from SoftDeletable)
console.log(user.isDeleted);   // true
```

---

## SOLID Principles

### 1. Single Responsibility Principle (SRP)

> A class should have only one reason to change.

```javascript
// BAD: UserService does too many things
class UserServiceBad {
  createUser(data) { /* create user in DB */ }
  sendWelcomeEmail(user) { /* send email */ }
  generateReport(users) { /* generate PDF report */ }
  validatePassword(password) { /* validate password rules */ }
  logActivity(user, action) { /* write to activity log */ }
}

// GOOD: Each class has a single responsibility
class UserRepository {
  async create(data) {
    return db.users.insert(data);
  }

  async findById(id) {
    return db.users.findOne({ id });
  }

  async update(id, data) {
    return db.users.update({ id }, data);
  }
}

class EmailService {
  async sendWelcome(user) {
    await this.mailer.send({
      to: user.email,
      template: "welcome",
      data: { name: user.name },
    });
  }
}

class PasswordValidator {
  validate(password) {
    const errors = [];
    if (password.length < 8) errors.push("Must be at least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("Must contain uppercase letter");
    if (!/[0-9]/.test(password)) errors.push("Must contain a number");
    return { valid: errors.length === 0, errors };
  }
}

class ActivityLogger {
  async log(userId, action, metadata = {}) {
    await db.activityLogs.insert({
      userId,
      action,
      metadata,
      timestamp: new Date(),
    });
  }
}

// Orchestrate in a use case / application service
class CreateUserUseCase {
  constructor(userRepo, emailService, passwordValidator, activityLogger) {
    this.userRepo = userRepo;
    this.emailService = emailService;
    this.passwordValidator = passwordValidator;
    this.activityLogger = activityLogger;
  }

  async execute(data) {
    const { valid, errors } = this.passwordValidator.validate(data.password);
    if (!valid) throw new ValidationError(errors);

    const user = await this.userRepo.create(data);
    await this.emailService.sendWelcome(user);
    await this.activityLogger.log(user.id, "USER_CREATED");

    return user;
  }
}
```

### 2. Open/Closed Principle (OCP)

> Software entities should be open for extension, but closed for modification.

```javascript
// BAD: Must modify existing code to add new discount types
class DiscountCalculatorBad {
  calculate(order, discountType) {
    switch (discountType) {
      case "percentage":
        return order.total * 0.1;
      case "fixed":
        return 10;
      case "bogo":  // Added later -- modifying existing class
        return order.items[0]?.price || 0;
      // Every new discount type requires changing this class
    }
  }
}

// GOOD: Extend via new classes without modifying existing code
class DiscountStrategy {
  calculate(order) {
    throw new Error("Must implement calculate()");
  }
}

class PercentageDiscount extends DiscountStrategy {
  constructor(percent) {
    super();
    this.percent = percent;
  }

  calculate(order) {
    return order.total * (this.percent / 100);
  }
}

class FixedDiscount extends DiscountStrategy {
  constructor(amount) {
    super();
    this.amount = amount;
  }

  calculate(order) {
    return Math.min(this.amount, order.total);
  }
}

class BuyOneGetOneFreeDiscount extends DiscountStrategy {
  calculate(order) {
    const sorted = [...order.items].sort((a, b) => a.price - b.price);
    return sorted[0]?.price || 0;
  }
}

// New discount types can be added without modifying any existing class
class LoyaltyDiscount extends DiscountStrategy {
  constructor(loyaltyTier) {
    super();
    this.tiers = { bronze: 5, silver: 10, gold: 15, platinum: 20 };
    this.tier = loyaltyTier;
  }

  calculate(order) {
    return order.total * (this.tiers[this.tier] / 100);
  }
}

class OrderService {
  applyDiscount(order, strategy) {
    const discount = strategy.calculate(order);
    return { ...order, total: order.total - discount, discount };
  }
}
```

### 3. Liskov Substitution Principle (LSP)

> Objects of a superclass should be replaceable with objects of its subclasses without breaking the application.

```javascript
// BAD: Square violates LSP when substituted for Rectangle
class RectangleBad {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  setWidth(w) { this.width = w; }
  setHeight(h) { this.height = h; }

  area() { return this.width * this.height; }
}

class SquareBad extends RectangleBad {
  setWidth(w) {
    this.width = w;
    this.height = w; // Unexpected side effect -- breaks LSP
  }

  setHeight(h) {
    this.width = h;
    this.height = h; // Unexpected side effect -- breaks LSP
  }
}

function testRectangle(rect) {
  rect.setWidth(5);
  rect.setHeight(4);
  console.assert(rect.area() === 20); // FAILS for SquareBad (area is 16)
}

// GOOD: Design that respects LSP
class Shape {
  area() {
    throw new Error("Must implement area()");
  }
}

class Rectangle extends Shape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }

  area() { return this.width * this.height; }
}

class Square extends Shape {
  constructor(side) {
    super();
    this.side = side;
  }

  area() { return this.side ** 2; }
}

// Both can be used as Shape without surprise behavior
function printArea(shape) {
  console.log(`Area: ${shape.area()}`); // Works correctly for any Shape
}

printArea(new Rectangle(5, 4)); // Area: 20
printArea(new Square(5));       // Area: 25
```

### 4. Interface Segregation Principle (ISP)

> Clients should not be forced to depend on interfaces they do not use.

```javascript
// BAD: One fat interface forces implementers to handle irrelevant methods
class MultiFunctionPrinterBad {
  print(doc) { /* ... */ }
  scan(doc) { /* ... */ }
  fax(doc) { /* ... */ }
  staple(doc) { /* ... */ }
}

class SimplePrinter extends MultiFunctionPrinterBad {
  print(doc) { /* works */ }
  scan(doc) { throw new Error("Not supported"); }   // Forced to implement
  fax(doc) { throw new Error("Not supported"); }    // Forced to implement
  staple(doc) { throw new Error("Not supported"); } // Forced to implement
}

// GOOD: Segregated interfaces (using composition)
class Printer {
  print(doc) {
    console.log(`Printing: ${doc.title}`);
  }
}

class Scanner {
  scan(doc) {
    console.log(`Scanning: ${doc.title}`);
    return { /* scanned data */ };
  }
}

class FaxMachine {
  fax(doc, number) {
    console.log(`Faxing ${doc.title} to ${number}`);
  }
}

// Compose only what you need
class SimplePrinterGood {
  constructor() {
    this.printer = new Printer();
  }

  print(doc) {
    return this.printer.print(doc);
  }
}

class MultiFunctionDevice {
  constructor() {
    this.printer = new Printer();
    this.scanner = new Scanner();
    this.fax = new FaxMachine();
  }

  print(doc) { return this.printer.print(doc); }
  scan(doc) { return this.scanner.scan(doc); }
  sendFax(doc, number) { return this.fax.fax(doc, number); }
}
```

```typescript
// TypeScript ISP example
// BAD
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

// GOOD
interface Workable {
  work(): void;
}

interface Eatable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class HumanWorker implements Workable, Eatable, Sleepable {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
}

class RobotWorker implements Workable {
  work() { /* ... */ }
  // Does not need eat() or sleep()
}
```

### 5. Dependency Inversion Principle (DIP)

> High-level modules should not depend on low-level modules. Both should depend on abstractions.

```javascript
// BAD: High-level OrderService directly depends on low-level MySQLDatabase
class MySQLDatabase {
  query(sql) { /* MySQL-specific query */ }
}

class OrderServiceBad {
  constructor() {
    this.db = new MySQLDatabase(); // Direct dependency on concrete implementation
  }

  getOrders() {
    return this.db.query("SELECT * FROM orders");
  }
}

// GOOD: Both depend on abstraction (interface/contract)
// The abstraction (what both high-level and low-level depend on)
class OrderRepository {
  findAll() { throw new Error("Not implemented"); }
  findById(id) { throw new Error("Not implemented"); }
  save(order) { throw new Error("Not implemented"); }
}

// Low-level module implements the abstraction
class MySQLOrderRepository extends OrderRepository {
  constructor(connection) {
    super();
    this.connection = connection;
  }

  async findAll() {
    return this.connection.query("SELECT * FROM orders");
  }

  async findById(id) {
    return this.connection.query("SELECT * FROM orders WHERE id = ?", [id]);
  }

  async save(order) {
    return this.connection.query("INSERT INTO orders ...", [order]);
  }
}

class MongoOrderRepository extends OrderRepository {
  constructor(collection) {
    super();
    this.collection = collection;
  }

  async findAll() {
    return this.collection.find({}).toArray();
  }

  async findById(id) {
    return this.collection.findOne({ _id: id });
  }

  async save(order) {
    return this.collection.insertOne(order);
  }
}

// High-level module depends on abstraction, not concrete implementation
class OrderService {
  constructor(orderRepository) {
    this.orderRepo = orderRepository; // Injected dependency
  }

  async getOrders() {
    return this.orderRepo.findAll();
  }

  async getOrder(id) {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new Error("Order not found");
    return order;
  }
}

// Usage -- the dependency is injected from outside
const mysqlRepo = new MySQLOrderRepository(mysqlConnection);
const mongoRepo = new MongoOrderRepository(mongoCollection);

const service1 = new OrderService(mysqlRepo);   // Uses MySQL
const service2 = new OrderService(mongoRepo);    // Uses MongoDB
// Easy to swap implementations, easy to test with mocks
```

---

## Composition Over Inheritance

### When to Use Inheritance vs Composition

| Use Inheritance When                | Use Composition When                     |
|-------------------------------------|------------------------------------------|
| True "is-a" relationship            | "Has-a" or "uses-a" relationship         |
| Subclass is genuinely a specialization | Combining behaviors from multiple sources |
| Shallow hierarchy (1-2 levels)      | Deep hierarchies (3+ levels)            |
| Behavior is tightly coupled         | Behaviors are independent/interchangeable |
| Framework requires it               | Default choice for new designs           |

```javascript
// Inheritance: Dog IS an Animal (clear is-a)
class Animal {
  breathe() { return "breathing"; }
}
class Dog extends Animal {
  bark() { return "woof"; }
}

// Composition: Car HAS an Engine (clear has-a)
class Engine {
  start() { return "Engine started"; }
  stop() { return "Engine stopped"; }
}

class Transmission {
  shift(gear) { return `Shifted to gear ${gear}`; }
}

class GPS {
  navigate(destination) { return `Navigating to ${destination}`; }
}

class Car {
  constructor() {
    this.engine = new Engine();
    this.transmission = new Transmission();
    this.gps = new GPS();
  }

  start() {
    return this.engine.start();
  }

  drive(destination) {
    this.engine.start();
    this.transmission.shift(1);
    return this.gps.navigate(destination);
  }
}

// Flexible: can easily swap GPS implementation
class Car2 {
  constructor(engine, transmission, navigator) {
    this.engine = engine;
    this.transmission = transmission;
    this.navigator = navigator;
  }
}
```

---

## Factory Functions vs Classes

### Comparison Table

| Feature              | Factory Function          | Class                     |
|----------------------|---------------------------|---------------------------|
| `new` keyword        | Not required              | Required                  |
| `this` binding       | No `this` issues          | `this` can be lost        |
| Private data         | Closure (true privacy)    | `#` fields (ES2022)      |
| `instanceof`         | Not supported             | Supported                 |
| Memory efficiency    | Methods created per instance | Methods shared on prototype |
| Inheritance          | Composition-based         | `extends`-based           |
| Simplicity           | Simple                    | More ceremony             |

```javascript
// Factory function
function createUser(name, email) {
  // Private state via closure
  let loginCount = 0;

  return {
    getName() { return name; },
    getEmail() { return email; },
    login() {
      loginCount++;
      return `${name} logged in (${loginCount} times)`;
    },
    getLoginCount() { return loginCount; },
  };
}

const user = createUser("Alice", "alice@example.com");
console.log(user.login());         // "Alice logged in (1 times)"
console.log(user.getLoginCount()); // 1
// No way to access loginCount directly

// Class equivalent
class UserClass {
  #loginCount = 0;

  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  login() {
    this.#loginCount++;
    return `${this.name} logged in (${this.#loginCount} times)`;
  }

  get loginCount() {
    return this.#loginCount;
  }
}
```

### When to Choose Which

```javascript
// Use factory functions when:
// - You want true encapsulation without #fields
// - You want to avoid `this` binding issues
// - You are doing functional composition
// - You do not need instanceof checks

// Use classes when:
// - You need instanceof checks
// - Memory efficiency matters (shared prototype methods)
// - You are using a framework that expects classes (Angular, NestJS)
// - The hierarchy is well-defined and stable
```

---

## Module Pattern

```javascript
// IIFE Module Pattern (pre-ES6)
const UserModule = (function () {
  // Private
  const users = [];
  let nextId = 1;

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Public API
  return {
    create(name, email) {
      if (!validateEmail(email)) {
        throw new Error("Invalid email");
      }
      const user = { id: nextId++, name, email };
      users.push(user);
      return user;
    },

    findById(id) {
      return users.find((u) => u.id === id) || null;
    },

    getAll() {
      return [...users]; // Return a copy
    },

    count() {
      return users.length;
    },
  };
})();

UserModule.create("Alice", "alice@example.com");
console.log(UserModule.count()); // 1
// console.log(users);           // ReferenceError: users is not defined

// Revealing Module Pattern
const Calculator = (function () {
  function add(a, b) { return a + b; }
  function subtract(a, b) { return a - b; }
  function multiply(a, b) { return a * b; }
  function divide(a, b) {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  }

  // Reveal only selected functions
  return { add, subtract, multiply, divide };
})();
```

---

## Dependency Injection

### Manual DI

```javascript
// Service definitions
class Logger {
  info(msg) { console.log(`[INFO] ${msg}`); }
  error(msg) { console.error(`[ERROR] ${msg}`); }
}

class UserRepository {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async findById(id) {
    this.logger.info(`Finding user ${id}`);
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}

class UserService {
  constructor(userRepo, logger, emailService) {
    this.userRepo = userRepo;
    this.logger = logger;
    this.emailService = emailService;
  }

  async getUser(id) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      this.logger.error(`User ${id} not found`);
      throw new Error("User not found");
    }
    return user;
  }
}

// Composition root -- where all dependencies are wired together
function createApp() {
  const db = new Database(process.env.DATABASE_URL);
  const logger = new Logger();
  const emailService = new EmailService(process.env.SMTP_URL);
  const userRepo = new UserRepository(db, logger);
  const userService = new UserService(userRepo, logger, emailService);

  return { userService, logger };
}
```

### Simple DI Container

```javascript
class Container {
  #services = new Map();
  #singletons = new Map();

  register(name, factory, { singleton = false } = {}) {
    this.#services.set(name, { factory, singleton });
    return this;
  }

  resolve(name) {
    const service = this.#services.get(name);
    if (!service) throw new Error(`Service "${name}" not registered`);

    if (service.singleton) {
      if (!this.#singletons.has(name)) {
        this.#singletons.set(name, service.factory(this));
      }
      return this.#singletons.get(name);
    }

    return service.factory(this);
  }
}

// Usage
const container = new Container();

container.register("logger", () => new Logger(), { singleton: true });
container.register("db", () => new Database(process.env.DB_URL), { singleton: true });

container.register("userRepo", (c) => new UserRepository(
  c.resolve("db"),
  c.resolve("logger"),
));

container.register("userService", (c) => new UserService(
  c.resolve("userRepo"),
  c.resolve("logger"),
  c.resolve("emailService"),
));

const userService = container.resolve("userService");
```

### DI Benefits for Testing

```javascript
// Easy to mock dependencies in tests
class MockUserRepository {
  constructor() {
    this.users = [
      { id: "1", name: "Alice", email: "alice@example.com" },
    ];
  }

  async findById(id) {
    return this.users.find((u) => u.id === id) || null;
  }
}

class MockLogger {
  info() {}
  error() {}
}

// In tests:
const mockRepo = new MockUserRepository();
const mockLogger = new MockLogger();
const service = new UserService(mockRepo, mockLogger, null);

const user = await service.getUser("1");
console.assert(user.name === "Alice");
```

---

## Interview Tips and Key Takeaways

1. **SOLID principles** -- be able to explain all 5 with real JavaScript/Node.js examples. These are fundamental senior-level expectations.

2. **Composition over inheritance** is the default recommendation for modern JavaScript. Know why and when inheritance is still appropriate.

3. **Private fields (#)** are real ES2022 features. Know the difference between `#field`, TypeScript `private`, and the `_convention`.

4. **Factory functions vs classes** -- articulate trade-offs. Factories give true encapsulation without `this` issues; classes give shared prototypes and `instanceof`.

5. **Dependency Injection** is critical for testable, maintainable code. Be able to implement a simple DI container.

6. **Mixins** are the JavaScript way to achieve multiple inheritance. Know the "class expression" mixin pattern.

7. **Module pattern** (IIFE) is legacy but still appears in codebases and interviews. Understand it to read older code.

8. **Abstract class emulation** in JavaScript uses `new.target` checks. TypeScript provides native `abstract` keyword.

9. **SRP** is the most commonly violated SOLID principle. Be able to identify God classes and propose refactorings.

10. **DIP** is the hardest to explain clearly. The key insight: both high-level and low-level modules depend on abstractions, not on each other.

---

## Quick Reference / Cheat Sheet

```text
SOLID PRINCIPLES
  S - Single Responsibility  -> One reason to change
  O - Open/Closed            -> Open for extension, closed for modification
  L - Liskov Substitution    -> Subtypes must be substitutable
  I - Interface Segregation  -> Many specific interfaces > one general
  D - Dependency Inversion   -> Depend on abstractions, not concretions

CLASS FEATURES (ES2022)
  class Foo {
    publicField = "value";           // Public field
    #privateField = "secret";        // Private field
    static staticField = "shared";   // Static field
    static #privateStatic = "x";     // Private static field

    #privateMethod() {}              // Private method
    static staticMethod() {}         // Static method
    get prop() {}                    // Getter
    set prop(v) {}                   // Setter
    static { /* init block */ }      // Static initialization
  }

COMPOSITION PATTERNS
  Mixin:     const Mix = (Base) => class extends Base { ... }
  Factory:   function create() { return { method() {} }; }
  Module:    const mod = (() => { return { publicAPI }; })();

DEPENDENCY INJECTION
  1. Constructor injection (most common)
  2. Method injection
  3. Property injection
  Container: register(name, factory) -> resolve(name)

INHERITANCE vs COMPOSITION
  Inheritance: "is-a" (Dog is an Animal)
  Composition: "has-a" (Car has an Engine)
  Default to composition; use inheritance for true specialization
```
