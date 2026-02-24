/**
 * ============================================================================
 * FILE 4: OOP AND SOLID PRINCIPLES — Senior Interview Prep
 * ============================================================================
 *
 * Topics covered:
 *   - Classes: constructor, methods, getters/setters
 *   - Inheritance vs composition
 *   - Private fields (#field) and methods
 *   - Static methods and properties
 *   - Abstract classes (pattern in JS)
 *   - Mixins pattern
 *   - SOLID principles with JS examples:
 *     - Single Responsibility Principle (SRP)
 *     - Open/Closed Principle (OCP)
 *     - Liskov Substitution Principle (LSP)
 *     - Interface Segregation Principle (ISP)
 *     - Dependency Inversion Principle (DIP)
 *   - Composition over inheritance
 *   - Factory functions vs classes
 *   - The module pattern
 *
 * Run: node 04_oop_and_solid.js
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
// ║  1. CLASSES: CONSTRUCTOR, METHODS, GETTERS/SETTERS                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("1. Classes: Constructor, Methods, Getters/Setters");

/**
 * ES6 classes are syntactic sugar over prototypal inheritance.
 * Under the hood, they use constructor functions and prototype chains.
 *
 * Class declarations are NOT hoisted (unlike function declarations).
 * Class bodies run in strict mode automatically.
 */

class BankAccount {
  /** @type {string} */
  #owner; // private field (ES2022)

  /** @type {number} */
  #balance;

  /** @type {string[]} */
  #transactions;

  /**
   * @param {string} owner
   * @param {number} [initialBalance=0]
   */
  constructor(owner, initialBalance = 0) {
    this.#owner = owner;
    this.#balance = initialBalance;
    this.#transactions = [];
    this.id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }

  // --- Getter: computed property ---
  /** @returns {number} */
  get balance() {
    return this.#balance;
  }

  // --- Setter with validation ---
  /** @param {number} amount */
  set balance(amount) {
    throw new Error("Cannot set balance directly. Use deposit() or withdraw().");
  }

  /** @returns {string} */
  get owner() {
    return this.#owner;
  }

  /** @returns {string} */
  get summary() {
    return `${this.#owner}'s account: $${this.#balance.toFixed(2)}`;
  }

  // --- Methods ---
  /** @param {number} amount @returns {BankAccount} */
  deposit(amount) {
    if (amount <= 0) throw new RangeError("Deposit amount must be positive");
    this.#balance += amount;
    this.#transactions.push(`+$${amount.toFixed(2)}`);
    return this; // enable chaining
  }

  /** @param {number} amount @returns {BankAccount} */
  withdraw(amount) {
    if (amount <= 0) throw new RangeError("Withdrawal amount must be positive");
    if (amount > this.#balance) throw new RangeError("Insufficient funds");
    this.#balance -= amount;
    this.#transactions.push(`-$${amount.toFixed(2)}`);
    return this;
  }

  /** @returns {string[]} */
  getTransactionHistory() {
    return [...this.#transactions]; // return copy, not reference
  }

  /** @returns {string} */
  toString() {
    return this.summary;
  }

  /** @returns {object} */
  toJSON() {
    return {
      owner: this.#owner,
      balance: this.#balance,
      transactionCount: this.#transactions.length,
    };
  }
}

const account = new BankAccount("Alice", 100);
account.deposit(50).deposit(25).withdraw(30); // method chaining
show("Account", account.summary);
show("Balance (getter)", account.balance);
show("Transactions", account.getTransactionHistory());
show("JSON", JSON.stringify(account));

try {
  account.balance = 1000; // triggers setter
} catch (e) {
  show("Setter guard", e.message);
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  2. INHERITANCE vs COMPOSITION                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("2. Inheritance vs Composition");

/**
 * INHERITANCE ("is-a" relationship):
 *   - Child class extends parent class
 *   - Inherits all properties and methods
 *   - Can override methods
 *   - Creates tight coupling
 *   - Fragile base class problem: changes to parent break children
 *
 * COMPOSITION ("has-a" relationship):
 *   - Object contains other objects as components
 *   - Delegates behavior to components
 *   - Loose coupling
 *   - More flexible — can swap components at runtime
 *   - Favored by modern design patterns
 */

// --- INHERITANCE approach ---
class Vehicle {
  /** @param {string} make @param {string} model */
  constructor(make, model) {
    this.make = make;
    this.model = model;
  }

  start() {
    return `${this.make} ${this.model} started`;
  }

  stop() {
    return `${this.make} ${this.model} stopped`;
  }
}

class ElectricCar extends Vehicle {
  /** @param {string} make @param {string} model @param {number} batteryKWh */
  constructor(make, model, batteryKWh) {
    super(make, model); // MUST call super before using 'this'
    this.batteryKWh = batteryKWh;
  }

  // Override:
  start() {
    return `${super.start()} silently (electric, ${this.batteryKWh}kWh)`;
  }

  charge() {
    return `${this.make} ${this.model} is charging`;
  }
}

const tesla = new ElectricCar("Tesla", "Model 3", 75);
show("Inheritance: start()", tesla.start());
show("Inheritance: charge()", tesla.charge());
show("instanceof Vehicle", tesla instanceof Vehicle); // true

// --- COMPOSITION approach (preferred) ---

/**
 * Instead of inheriting, we compose behavior from smaller, focused objects.
 */

// Behavior components (strategies):
const withEngine = (state) => ({
  start: () => `${state.make} ${state.model} engine started`,
  stop: () => `${state.make} ${state.model} engine stopped`,
});

const withElectricMotor = (state) => ({
  start: () => `${state.make} ${state.model} motor started silently`,
  stop: () => `${state.make} ${state.model} motor stopped`,
  charge: () => `${state.make} ${state.model} is charging (${state.batteryKWh}kWh)`,
});

const withGPS = (state) => ({
  navigate: (dest) => `Navigating ${state.make} to ${dest}`,
  currentLocation: () => "GPS: 37.7749, -122.4194",
});

const withAutopilot = (state) => ({
  enableAutopilot: () => `${state.make} autopilot engaged`,
  disableAutopilot: () => `${state.make} autopilot disengaged`,
});

// Compose a vehicle from components:
function createElectricCar(make, model, batteryKWh) {
  const state = { make, model, batteryKWh };
  return {
    ...state,
    ...withElectricMotor(state),
    ...withGPS(state),
    ...withAutopilot(state),
  };
}

function createGasCar(make, model) {
  const state = { make, model };
  return {
    ...state,
    ...withEngine(state),
    ...withGPS(state),
  };
}

const composedTesla = createElectricCar("Tesla", "Model S", 100);
show("Composition: start()", composedTesla.start());
show("Composition: charge()", composedTesla.charge());
show("Composition: navigate()", composedTesla.navigate("San Francisco"));
show("Composition: autopilot()", composedTesla.enableAutopilot());

const gasCar = createGasCar("Toyota", "Camry");
show("Gas car: start()", gasCar.start());
show("Gas car: navigate()", gasCar.navigate("Los Angeles"));
// gasCar.charge() — does not exist! (no electric motor component)

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  3. PRIVATE FIELDS (#field) AND METHODS                                ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("3. Private Fields (#field) and Methods");

/**
 * ES2022 introduced true private fields and methods using # prefix.
 * These are TRULY private — not accessible outside the class, not even
 * by subclasses or through reflection (unlike the _convention or closures).
 *
 * INTERVIEW POINT: # fields are enforced at the language level.
 *   obj.#field from outside the class is a SyntaxError.
 */

class SecureVault {
  // Private fields:
  /** @type {Map<string, string>} */
  #secrets = new Map();

  /** @type {string} */
  #masterKey;

  // Private static field:
  static #instanceCount = 0;

  /** @param {string} masterKey */
  constructor(masterKey) {
    this.#masterKey = masterKey;
    SecureVault.#instanceCount++;
  }

  // Private method:
  /** @param {string} key @returns {boolean} */
  #validateKey(key) {
    return key === this.#masterKey;
  }

  // Private method for encryption (simplified):
  /** @param {string} value @returns {string} */
  #encrypt(value) {
    // Simple XOR-based "encryption" for demonstration:
    return Buffer.from(value)
      .map((byte) => byte ^ 0x42)
      .toString("base64");
  }

  /** @param {string} encoded @returns {string} */
  #decrypt(encoded) {
    return Buffer.from(encoded, "base64")
      .map((byte) => byte ^ 0x42)
      .toString();
  }

  /**
   * @param {string} masterKey
   * @param {string} name
   * @param {string} value
   */
  store(masterKey, name, value) {
    if (!this.#validateKey(masterKey)) throw new Error("Invalid master key");
    this.#secrets.set(name, this.#encrypt(value));
  }

  /**
   * @param {string} masterKey
   * @param {string} name
   * @returns {string | undefined}
   */
  retrieve(masterKey, name) {
    if (!this.#validateKey(masterKey)) throw new Error("Invalid master key");
    const encrypted = this.#secrets.get(name);
    return encrypted ? this.#decrypt(encrypted) : undefined;
  }

  /** @returns {number} */
  get secretCount() {
    return this.#secrets.size;
  }

  static get instanceCount() {
    return SecureVault.#instanceCount;
  }
}

const vault = new SecureVault("my-master-key");
vault.store("my-master-key", "password", "super-secret-123");
vault.store("my-master-key", "apiKey", "sk-abc-def");
show("Retrieve secret", vault.retrieve("my-master-key", "password"));
show("Secret count", vault.secretCount);
show("Instance count", SecureVault.instanceCount);

try {
  vault.retrieve("wrong-key", "password");
} catch (e) {
  show("Auth guard", e.message);
}

// Cannot access private fields from outside:
// vault.#secrets  — SyntaxError
// vault.#masterKey  — SyntaxError
show("Private fields", "Truly private — #fields are a SyntaxError outside class");

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  4. STATIC METHODS AND PROPERTIES                                      ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("4. Static Methods and Properties");

/**
 * Static members belong to the CLASS, not to instances.
 * Accessed via ClassName.method(), not instance.method().
 *
 * Use cases:
 *   - Factory methods (alternative constructors)
 *   - Utility methods related to the class
 *   - Singleton pattern
 *   - Configuration/constants
 */

class Temperature {
  /** @type {number} */
  #celsius;

  // Static property:
  static ABSOLUTE_ZERO = -273.15;

  /** @param {number} celsius */
  constructor(celsius) {
    if (celsius < Temperature.ABSOLUTE_ZERO) {
      throw new RangeError(`Temperature below absolute zero: ${celsius}`);
    }
    this.#celsius = celsius;
  }

  /** @returns {number} */
  get celsius() {
    return this.#celsius;
  }

  /** @returns {number} */
  get fahrenheit() {
    return this.#celsius * (9 / 5) + 32;
  }

  /** @returns {number} */
  get kelvin() {
    return this.#celsius - Temperature.ABSOLUTE_ZERO;
  }

  // --- Static factory methods ---
  /** @param {number} f @returns {Temperature} */
  static fromFahrenheit(f) {
    return new Temperature((f - 32) * (5 / 9));
  }

  /** @param {number} k @returns {Temperature} */
  static fromKelvin(k) {
    return new Temperature(k + Temperature.ABSOLUTE_ZERO);
  }

  // Static utility:
  /**
   * @param {Temperature} a
   * @param {Temperature} b
   * @returns {Temperature}
   */
  static average(a, b) {
    return new Temperature((a.celsius + b.celsius) / 2);
  }

  // Static initializer block (ES2022):
  static {
    // Runs once when the class is defined
    console.log("  [static init] Temperature class loaded");
  }

  toString() {
    return `${this.#celsius.toFixed(1)}C / ${this.fahrenheit.toFixed(1)}F / ${this.kelvin.toFixed(1)}K`;
  }
}

const boiling = new Temperature(100);
const bodyTemp = Temperature.fromFahrenheit(98.6);
const space = Temperature.fromKelvin(2.7); // cosmic background radiation

show("Boiling", boiling.toString());
show("Body temp", bodyTemp.toString());
show("Space", space.toString());
show("Average", Temperature.average(boiling, bodyTemp).toString());
show("Absolute zero", Temperature.ABSOLUTE_ZERO);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  5. ABSTRACT CLASSES (Pattern in JS)                                   ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("5. Abstract Classes (Pattern in JS)");

/**
 * JavaScript does not have native `abstract` keyword (TypeScript does).
 * We simulate abstract classes by:
 *   1. Throwing errors in methods that must be overridden
 *   2. Checking new.target in constructor to prevent direct instantiation
 *
 * TS: abstract class Shape { abstract area(): number; }
 */

class Shape {
  /**
   * @param {string} type
   */
  constructor(type) {
    if (new.target === Shape) {
      throw new Error("Cannot instantiate abstract class Shape directly");
    }
    this.type = type;
  }

  // "Abstract" methods — must be overridden:
  /** @returns {number} */
  area() {
    throw new Error(`${this.constructor.name} must implement area()`);
  }

  /** @returns {number} */
  perimeter() {
    throw new Error(`${this.constructor.name} must implement perimeter()`);
  }

  // Concrete method — shared by all subclasses (template method):
  /** @returns {string} */
  describe() {
    return `${this.type}: area=${this.area().toFixed(2)}, perimeter=${this.perimeter().toFixed(2)}`;
  }
}

class Circle extends Shape {
  /** @param {number} radius */
  constructor(radius) {
    super("Circle");
    this.radius = radius;
  }

  area() {
    return Math.PI * this.radius ** 2;
  }

  perimeter() {
    return 2 * Math.PI * this.radius;
  }
}

class Rectangle extends Shape {
  /** @param {number} width @param {number} height */
  constructor(width, height) {
    super("Rectangle");
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

const circle = new Circle(5);
const rect = new Rectangle(4, 6);
show("Circle", circle.describe());
show("Rectangle", rect.describe());

// Cannot instantiate abstract class:
try {
  new Shape("direct");
} catch (e) {
  show("Abstract guard", e.message);
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  6. MIXINS PATTERN                                                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("6. Mixins Pattern");

/**
 * JavaScript only supports single inheritance. Mixins let us compose
 * behaviors from multiple sources into a single class.
 *
 * Pattern: A mixin is a function that takes a base class and returns
 * a new class extending it with additional behavior.
 *
 * This avoids the diamond problem and keeps code composable.
 */

// Base class:
class BaseEntity {
  /** @param {string} id */
  constructor(id) {
    this.id = id;
  }
}

// Mixin: Timestamped
/** @template {new (...args: any[]) => any} T @param {T} Base */
function Timestamped(Base) {
  return class extends Base {
    constructor(...args) {
      super(...args);
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    touch() {
      this.updatedAt = new Date();
      return this;
    }
  };
}

// Mixin: Serializable
/** @template {new (...args: any[]) => any} T @param {T} Base */
function Serializable(Base) {
  return class extends Base {
    /** @returns {string} */
    serialize() {
      return JSON.stringify(this, null, 2);
    }

    /**
     * @param {string} json
     * @returns {object}
     */
    static deserialize(json) {
      return Object.assign(new this(""), JSON.parse(json));
    }
  };
}

// Mixin: Validatable
/** @template {new (...args: any[]) => any} T @param {T} Base */
function Validatable(Base) {
  return class extends Base {
    /** @type {Map<string, (value: *) => boolean>} */
    #validators = new Map();

    /**
     * @param {string} field
     * @param {(value: *) => boolean} validator
     */
    addValidator(field, validator) {
      this.#validators.set(field, validator);
      return this;
    }

    /** @returns {{ valid: boolean, errors: string[] }} */
    validate() {
      const errors = [];
      for (const [field, validator] of this.#validators) {
        if (!validator(this[field])) {
          errors.push(`Validation failed for "${field}"`);
        }
      }
      return { valid: errors.length === 0, errors };
    }
  };
}

// Mixin: SoftDeletable
/** @template {new (...args: any[]) => any} T @param {T} Base */
function SoftDeletable(Base) {
  return class extends Base {
    /** @type {Date | null} */
    deletedAt = null;

    /** @returns {boolean} */
    get isDeleted() {
      return this.deletedAt !== null;
    }

    softDelete() {
      this.deletedAt = new Date();
      return this;
    }

    restore() {
      this.deletedAt = null;
      return this;
    }
  };
}

// Compose mixins — order matters (later mixins override earlier ones):
class UserModel extends SoftDeletable(Validatable(Serializable(Timestamped(BaseEntity)))) {
  /**
   * @param {string} id
   * @param {string} name
   * @param {string} email
   */
  constructor(id, name, email) {
    super(id);
    this.name = name;
    this.email = email;
  }
}

const mixedUser = new UserModel("1", "Alice", "alice@example.com");
mixedUser
  .addValidator("name", (v) => typeof v === "string" && v.length > 0)
  .addValidator("email", (v) => typeof v === "string" && v.includes("@"));

show("Mixin: createdAt", mixedUser.createdAt instanceof Date);
show("Mixin: serialize()", typeof mixedUser.serialize());
show("Mixin: validate()", mixedUser.validate());
show("Mixin: isDeleted", mixedUser.isDeleted);
mixedUser.softDelete();
show("Mixin: after softDelete", mixedUser.isDeleted);
mixedUser.restore();
show("Mixin: after restore", mixedUser.isDeleted);

// Verify prototype chain:
show("instanceof BaseEntity", mixedUser instanceof BaseEntity);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  7. SOLID PRINCIPLES                                                   ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// -----------------------------------------------------------------------
// 7a. SINGLE RESPONSIBILITY PRINCIPLE (SRP)
// -----------------------------------------------------------------------

section("7a. SOLID — Single Responsibility Principle (SRP)");

/**
 * SRP: A class should have only ONE reason to change.
 * Each class/module should be responsible for one thing.
 *
 * VIOLATION: A User class that handles validation, persistence, AND email sending.
 * FIX: Separate into UserValidator, UserRepository, EmailService.
 */

// BAD: Multiple responsibilities
class UserBad {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  validate() { /* validates user data */ }
  save() { /* saves to database */ }
  sendWelcomeEmail() { /* sends email */ }
  generateReport() { /* generates PDF report */ }
  // This class has 4 reasons to change!
}
show("BAD", "User class does validation + persistence + email + reporting");

// GOOD: Each class has one responsibility
class User {
  /** @param {string} name @param {string} email */
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
}

class UserValidator {
  /** @param {User} user @returns {{ valid: boolean, errors: string[] }} */
  validate(user) {
    const errors = [];
    if (!user.name || user.name.length < 2) errors.push("Name too short");
    if (!user.email || !user.email.includes("@")) errors.push("Invalid email");
    return { valid: errors.length === 0, errors };
  }
}

class UserRepository {
  /** @type {Map<string, User>} */
  #store = new Map();

  /** @param {User} user */
  save(user) {
    this.#store.set(user.email, user);
    return `Saved user: ${user.name}`;
  }

  /** @param {string} email @returns {User | undefined} */
  findByEmail(email) {
    return this.#store.get(email);
  }
}

class EmailService {
  /** @param {User} user */
  sendWelcome(user) {
    return `Welcome email sent to ${user.email}`;
  }
}

const user = new User("Alice", "alice@test.com");
const validator = new UserValidator();
const repo = new UserRepository();
const emailSvc = new EmailService();

show("SRP Validate", validator.validate(user));
show("SRP Save", repo.save(user));
show("SRP Email", emailSvc.sendWelcome(user));

// -----------------------------------------------------------------------
// 7b. OPEN/CLOSED PRINCIPLE (OCP)
// -----------------------------------------------------------------------

section("7b. SOLID — Open/Closed Principle (OCP)");

/**
 * OCP: Software entities should be open for extension but closed for modification.
 *
 * Instead of modifying existing code to add new behavior,
 * extend it through abstraction (interfaces, polymorphism, strategy pattern).
 */

// BAD: Must modify this function every time we add a new shape
function calculateAreaBad(shape) {
  if (shape.type === "circle") return Math.PI * shape.radius ** 2;
  if (shape.type === "rectangle") return shape.width * shape.height;
  // Every new shape requires modifying this function!
}
show("BAD", "calculateArea must be modified for each new shape type");

// GOOD: Use polymorphism — each shape calculates its own area

/** @typedef {{ area(): number, describe(): string }} AreaCalculable */

class OCPCircle {
  /** @param {number} radius */
  constructor(radius) {
    this.radius = radius;
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
  describe() {
    return `Circle(r=${this.radius})`;
  }
}

class OCPRectangle {
  /** @param {number} w @param {number} h */
  constructor(w, h) {
    this.w = w;
    this.h = h;
  }
  area() {
    return this.w * this.h;
  }
  describe() {
    return `Rect(${this.w}x${this.h})`;
  }
}

// Adding a new shape requires NO changes to existing code:
class OCPTriangle {
  /** @param {number} base @param {number} height */
  constructor(base, height) {
    this.base = base;
    this.height = height;
  }
  area() {
    return 0.5 * this.base * this.height;
  }
  describe() {
    return `Triangle(b=${this.base},h=${this.height})`;
  }
}

// This function works with ANY shape that has area() — open for extension!
/** @param {AreaCalculable[]} shapes @returns {number} */
function totalArea(shapes) {
  return shapes.reduce((sum, s) => sum + s.area(), 0);
}

const shapes = [new OCPCircle(5), new OCPRectangle(4, 6), new OCPTriangle(10, 3)];
show(
  "OCP total area",
  `${totalArea(shapes).toFixed(2)} from [${shapes.map((s) => s.describe()).join(", ")}]`
);

// Strategy pattern (another OCP example):
class PaymentProcessor {
  /** @type {Map<string, (amount: number) => string>} */
  #strategies = new Map();

  /** @param {string} method @param {(amount: number) => string} strategy */
  registerStrategy(method, strategy) {
    this.#strategies.set(method, strategy);
    return this;
  }

  /**
   * @param {string} method
   * @param {number} amount
   * @returns {string}
   */
  process(method, amount) {
    const strategy = this.#strategies.get(method);
    if (!strategy) throw new Error(`Unknown payment method: ${method}`);
    return strategy(amount);
  }
}

const payments = new PaymentProcessor();
payments
  .registerStrategy("credit", (amt) => `Charged $${amt} to credit card`)
  .registerStrategy("paypal", (amt) => `Sent $${amt} via PayPal`)
  .registerStrategy("crypto", (amt) => `Transferred $${amt} in crypto`);

show("Strategy: credit", payments.process("credit", 99.99));
show("Strategy: crypto", payments.process("crypto", 50));

// -----------------------------------------------------------------------
// 7c. LISKOV SUBSTITUTION PRINCIPLE (LSP)
// -----------------------------------------------------------------------

section("7c. SOLID — Liskov Substitution Principle (LSP)");

/**
 * LSP: Subtypes must be substitutable for their base types without
 * altering the correctness of the program.
 *
 * If code works with a base class, it MUST also work with any subclass.
 * Subtypes should:
 *   - Not strengthen preconditions
 *   - Not weaken postconditions
 *   - Preserve invariants
 *
 * CLASSIC VIOLATION: Square extends Rectangle (width/height coupling)
 */

// BAD: LSP violation — Square breaks Rectangle's contract
class RectangleBad {
  constructor(w, h) {
    this.width = w;
    this.height = h;
  }
  setWidth(w) {
    this.width = w;
  }
  setHeight(h) {
    this.height = h;
  }
  area() {
    return this.width * this.height;
  }
}

class SquareBad extends RectangleBad {
  constructor(size) {
    super(size, size);
  }
  setWidth(w) {
    this.width = w;
    this.height = w; // side effect — breaks expected Rectangle behavior!
  }
  setHeight(h) {
    this.width = h; // side effect!
    this.height = h;
  }
}

// This function expects Rectangle behavior:
function doubleWidth(rect) {
  const originalHeight = rect.height;
  rect.setWidth(rect.width * 2);
  // EXPECTATION: height should be unchanged
  return rect.height === originalHeight;
}

const rectGood = new RectangleBad(3, 4);
const squareBad = new SquareBad(3);
show("LSP Rectangle (height unchanged?)", doubleWidth(rectGood)); // true
show("LSP Square VIOLATION (height changed!)", doubleWidth(squareBad)); // false!

// GOOD: Use separate, non-hierarchical types or composition
class LSPShape {
  /** @param {number} area */
  constructor(area) {
    this._area = area;
  }
  area() {
    return this._area;
  }
}

function createRectangle(w, h) {
  return {
    type: "rectangle",
    width: w,
    height: h,
    area: () => w * h,
  };
}

function createSquare(size) {
  return {
    type: "square",
    size,
    area: () => size * size,
  };
}

// Both work correctly wherever area() is expected:
const lspRect = createRectangle(3, 4);
const lspSquare = createSquare(5);
show("LSP-compliant rectangle area", lspRect.area()); // 12
show("LSP-compliant square area", lspSquare.area()); // 25

// -----------------------------------------------------------------------
// 7d. INTERFACE SEGREGATION PRINCIPLE (ISP)
// -----------------------------------------------------------------------

section("7d. SOLID — Interface Segregation Principle (ISP)");

/**
 * ISP: No client should be forced to depend on methods it does not use.
 * Break large interfaces into smaller, focused ones.
 *
 * In JS (no native interfaces), we apply ISP through:
 *   - Composition of small behavior objects
 *   - Checking for capability before calling
 *   - Separating concerns into small mixins/modules
 */

// BAD: Fat interface — not all workers need all methods
class WorkerBad {
  work() {
    return "working";
  }
  eat() {
    return "eating";
  }
  sleep() {
    return "sleeping";
  }
  attendMeeting() {
    return "in meeting";
  }
  writeCode() {
    return "coding";
  }
}
// A robot worker doesn't eat or sleep — forced to implement unused methods!
show("BAD", "Fat interface forces implementors to have unused methods");

// GOOD: Segregated behaviors

/** @returns {{ work: () => string }} */
function Workable() {
  return {
    work() {
      return "working";
    },
  };
}

/** @returns {{ eat: () => string, sleep: () => string }} */
function BiologicalNeeds() {
  return {
    eat() {
      return "eating";
    },
    sleep() {
      return "sleeping";
    },
  };
}

/** @returns {{ attendMeeting: () => string }} */
function Meetable() {
  return {
    attendMeeting() {
      return "in meeting";
    },
  };
}

/** @returns {{ writeCode: () => string }} */
function Codeable() {
  return {
    writeCode() {
      return "coding";
    },
  };
}

// Human developer: needs all behaviors
function createDeveloper(name) {
  return {
    name,
    role: "developer",
    ...Workable(),
    ...BiologicalNeeds(),
    ...Meetable(),
    ...Codeable(),
  };
}

// Robot worker: only needs work-related behaviors
function createRobotWorker(id) {
  return {
    id,
    role: "robot",
    ...Workable(),
    ...Codeable(),
    // No eat/sleep — ISP satisfied!
  };
}

const dev = createDeveloper("Alice");
const robot = createRobotWorker("R2D2");
show("Developer capabilities", Object.keys(dev).filter((k) => typeof dev[k] === "function"));
show("Robot capabilities", Object.keys(robot).filter((k) => typeof robot[k] === "function"));
show("Developer eat", dev.eat());
show("Robot work", robot.work());

// -----------------------------------------------------------------------
// 7e. DEPENDENCY INVERSION PRINCIPLE (DIP)
// -----------------------------------------------------------------------

section("7e. SOLID — Dependency Inversion Principle (DIP)");

/**
 * DIP:
 *   1. High-level modules should not depend on low-level modules.
 *      Both should depend on abstractions.
 *   2. Abstractions should not depend on details.
 *      Details should depend on abstractions.
 *
 * In practice: use DEPENDENCY INJECTION instead of direct instantiation.
 */

// BAD: High-level directly depends on low-level
class MySQLDatabaseBad {
  save(data) {
    return `Saved to MySQL: ${JSON.stringify(data)}`;
  }
}

class UserServiceBad {
  constructor() {
    this.db = new MySQLDatabaseBad(); // direct dependency — tightly coupled!
  }
  createUser(data) {
    return this.db.save(data);
  }
}
show("BAD", "UserService directly instantiates MySQLDatabase — cannot swap");

// GOOD: Depend on abstraction, inject dependency

/**
 * @typedef {Object} Database
 * @property {(data: *) => string} save
 * @property {(id: string) => *} find
 */

class MySQLDatabase {
  /** @param {*} data @returns {string} */
  save(data) {
    return `[MySQL] Saved: ${JSON.stringify(data)}`;
  }
  /** @param {string} id @returns {*} */
  find(id) {
    return `[MySQL] Found user ${id}`;
  }
}

class MongoDatabase {
  /** @param {*} data @returns {string} */
  save(data) {
    return `[MongoDB] Saved: ${JSON.stringify(data)}`;
  }
  /** @param {string} id @returns {*} */
  find(id) {
    return `[MongoDB] Found user ${id}`;
  }
}

class InMemoryDatabase {
  /** @type {Map<string, *>} */
  #store = new Map();

  /** @param {*} data @returns {string} */
  save(data) {
    const id = String(this.#store.size + 1);
    this.#store.set(id, data);
    return `[InMemory] Saved with id ${id}`;
  }

  /** @param {string} id @returns {*} */
  find(id) {
    return this.#store.get(id) ?? `[InMemory] Not found: ${id}`;
  }
}

/**
 * @typedef {Object} Logger
 * @property {(msg: string) => void} info
 * @property {(msg: string) => void} error
 */

const consoleLogger = {
  info: (msg) => console.log(`    [INFO] ${msg}`),
  error: (msg) => console.error(`    [ERROR] ${msg}`),
};

const silentLogger = {
  info: () => {},
  error: () => {},
};

// High-level module depends on abstractions (injected):
class UserService {
  /**
   * @param {Database} db - injected dependency
   * @param {Logger} logger - injected dependency
   */
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /** @param {{ name: string, email: string }} userData */
  createUser(userData) {
    this.logger.info(`Creating user: ${userData.name}`);
    const result = this.db.save(userData);
    this.logger.info(`User created: ${result}`);
    return result;
  }

  /** @param {string} id */
  getUser(id) {
    return this.db.find(id);
  }
}

// Can swap implementations without changing UserService:
const mysqlService = new UserService(new MySQLDatabase(), consoleLogger);
const mongoService = new UserService(new MongoDatabase(), silentLogger);
const testService = new UserService(new InMemoryDatabase(), silentLogger);

show("DIP MySQL", mysqlService.createUser({ name: "Alice", email: "a@b.com" }));
show("DIP MongoDB", mongoService.createUser({ name: "Bob", email: "b@b.com" }));
show("DIP InMemory", testService.createUser({ name: "Test", email: "test@test.com" }));

// Simple DI container:
class DIContainer {
  /** @type {Map<string, () => *>} */
  #factories = new Map();

  /** @type {Map<string, *>} */
  #singletons = new Map();

  /**
   * @param {string} name
   * @param {() => *} factory
   */
  register(name, factory) {
    this.#factories.set(name, factory);
    return this;
  }

  /**
   * @param {string} name
   * @param {() => *} factory
   */
  registerSingleton(name, factory) {
    this.#factories.set(name, () => {
      if (!this.#singletons.has(name)) {
        this.#singletons.set(name, factory());
      }
      return this.#singletons.get(name);
    });
    return this;
  }

  /**
   * @param {string} name
   * @returns {*}
   */
  resolve(name) {
    const factory = this.#factories.get(name);
    if (!factory) throw new Error(`No registration for: ${name}`);
    return factory();
  }
}

const container = new DIContainer();
container
  .registerSingleton("logger", () => consoleLogger)
  .registerSingleton("database", () => new InMemoryDatabase())
  .register("userService", () =>
    new UserService(container.resolve("database"), container.resolve("logger"))
  );

const resolvedService = container.resolve("userService");
show("DI Container", resolvedService.createUser({ name: "Container User", email: "di@test.com" }));

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  8. COMPOSITION OVER INHERITANCE                                       ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("8. Composition Over Inheritance");

/**
 * "Favor object composition over class inheritance."
 *   — Gang of Four, Design Patterns (1994)
 *
 * WHY:
 *   - Inheritance creates tight coupling (fragile base class problem)
 *   - Deep hierarchies are hard to understand and refactor
 *   - Inheritance is decided at compile time; composition at runtime
 *   - Multiple inheritance is messy (diamond problem)
 *   - "Is-a" vs "Has-a": most relationships are "has-a"
 *
 * WHEN TO USE INHERITANCE:
 *   - True "is-a" relationship (Dog is an Animal)
 *   - Shared implementation that changes together
 *   - Framework requires it (e.g., React class components — now legacy)
 *
 * WHEN TO USE COMPOSITION:
 *   - "Has-a" or "uses-a" relationship
 *   - Behavior varies independently
 *   - Need to swap behavior at runtime
 *   - Multiple concerns to mix
 */

// Full composition example: game character system

// Behavior factories (these are the "components"):
function createHealthComponent(maxHP) {
  let hp = maxHP;
  return {
    get hp() { return hp; },
    get maxHP() { return maxHP; },
    get isAlive() { return hp > 0; },
    takeDamage(amount) {
      hp = Math.max(0, hp - amount);
      return `Took ${amount} damage. HP: ${hp}/${maxHP}`;
    },
    heal(amount) {
      hp = Math.min(maxHP, hp + amount);
      return `Healed ${amount}. HP: ${hp}/${maxHP}`;
    },
  };
}

function createAttackComponent(baseDamage) {
  return {
    attack(target) {
      const damage = baseDamage + Math.floor(Math.random() * 5);
      return target.takeDamage?.(damage) ?? `Attacked for ${damage}`;
    },
  };
}

function createMagicComponent(mana) {
  let currentMana = mana;
  return {
    get mana() { return currentMana; },
    castSpell(name, cost) {
      if (currentMana < cost) return `Not enough mana for ${name}!`;
      currentMana -= cost;
      return `Cast ${name}! (Mana: ${currentMana}/${mana})`;
    },
  };
}

function createInventory(maxSlots) {
  /** @type {string[]} */
  const items = [];
  return {
    get items() { return [...items]; },
    addItem(item) {
      if (items.length >= maxSlots) return `Inventory full!`;
      items.push(item);
      return `Added ${item}`;
    },
    removeItem(item) {
      const idx = items.indexOf(item);
      if (idx === -1) return `${item} not found`;
      items.splice(idx, 1);
      return `Removed ${item}`;
    },
  };
}

// Compose different character types from components:
function createWarrior(name) {
  return {
    name,
    class: "Warrior",
    ...createHealthComponent(150),
    ...createAttackComponent(20),
    ...createInventory(10),
    // Warriors don't have magic — ISP!
  };
}

function createMage(name) {
  return {
    name,
    class: "Mage",
    ...createHealthComponent(80),
    ...createAttackComponent(5),
    ...createMagicComponent(100),
    ...createInventory(5),
  };
}

function createPaladin(name) {
  return {
    name,
    class: "Paladin",
    ...createHealthComponent(120),
    ...createAttackComponent(15),
    ...createMagicComponent(50), // Paladins have SOME magic
    ...createInventory(8),
  };
}

const warrior = createWarrior("Thorin");
const mage = createMage("Gandalf");
const paladin = createPaladin("Arthur");

show("Warrior HP", `${warrior.hp}/${warrior.maxHP}`);
show("Warrior attack mage", warrior.attack(mage));
show("Mage HP after attack", `${mage.hp}/${mage.maxHP}`);
show("Mage cast spell", mage.castSpell("Fireball", 30));
show("Mage mana", mage.mana);
show("Paladin cast spell", paladin.castSpell("Holy Light", 20));
show("Warrior add item", warrior.addItem("Sword of Power"));
show("Warrior items", warrior.items);

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  9. FACTORY FUNCTIONS vs CLASSES                                       ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("9. Factory Functions vs Classes");

/**
 * FACTORY FUNCTIONS:
 *   - Return plain objects (no `new` keyword)
 *   - True privacy via closures (no # needed)
 *   - No `this` binding issues
 *   - Easy composition
 *   - No instanceof support (can be a feature or bug)
 *   - Slightly more memory: each instance has own function copies
 *
 * CLASSES:
 *   - Use `new` keyword
 *   - True private fields with #
 *   - Methods on prototype (shared, memory efficient)
 *   - instanceof support
 *   - `this` binding gotchas
 *   - Familiar to developers from other languages
 *
 * INTERVIEW TIP: Neither is universally better. Choose based on:
 *   - Need prototype chain / instanceof? Use class.
 *   - Need simple composition and privacy? Use factory.
 *   - Team convention matters most.
 */

// --- Class approach ---
class TimerClass {
  #startTime = null;
  #label;

  /** @param {string} label */
  constructor(label) {
    this.#label = label;
  }

  start() {
    this.#startTime = Date.now();
    return this;
  }

  stop() {
    if (!this.#startTime) throw new Error("Timer not started");
    const elapsed = Date.now() - this.#startTime;
    this.#startTime = null;
    return `[${this.#label}] ${elapsed}ms`;
  }
}

const classTimer = new TimerClass("ClassTimer");
classTimer.start();
show("Class timer", classTimer.stop());
show("instanceof", classTimer instanceof TimerClass); // true

// --- Factory function approach ---
function createTimer(label) {
  let startTime = null; // private via closure

  return {
    start() {
      startTime = Date.now();
      return this;
    },

    stop() {
      if (!startTime) throw new Error("Timer not started");
      const elapsed = Date.now() - startTime;
      startTime = null;
      return `[${label}] ${elapsed}ms`;
    },
  };
}

const factoryTimer = createTimer("FactoryTimer");
factoryTimer.start();
show("Factory timer", factoryTimer.stop());
// No instanceof support — factoryTimer is just a plain object

// --- Comparison: this binding ---
class CounterClass {
  #count = 0;
  increment() {
    return ++this.#count;
  }
}

const cc = new CounterClass();
const incrementFn = cc.increment;
try {
  incrementFn(); // `this` is undefined in strict mode!
} catch (e) {
  show("Class 'this' issue", e.message);
}

// Fix: bind in constructor
class CounterClassFixed {
  #count = 0;
  constructor() {
    this.increment = this.increment.bind(this);
  }
  increment() {
    return ++this.#count;
  }
}

// Factory: no `this` issue at all
function createCounter() {
  let count = 0;
  return {
    increment() {
      return ++count; // no `this` needed
    },
    getCount() {
      return count;
    },
  };
}

const fc = createCounter();
const detachedIncrement = fc.increment;
show("Factory (no this issue)", detachedIncrement()); // 1 — works fine!
show("Factory (detached again)", detachedIncrement()); // 2

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  10. THE MODULE PATTERN                                                ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("10. The Module Pattern");

/**
 * The Module Pattern uses an IIFE (Immediately Invoked Function Expression)
 * or closures to create a private scope and expose a public API.
 *
 * HISTORICAL CONTEXT:
 *   Before ES Modules (import/export), this was THE way to encapsulate code.
 *   Still useful for:
 *     - Creating singleton services
 *     - Namespace isolation
 *     - Configuration objects
 *     - Plugin systems
 *
 * VARIANTS:
 *   - Revealing Module Pattern: all functions defined privately, chosen ones revealed
 *   - Augmentation Pattern: extend existing modules
 *   - Submodule Pattern: nested modules
 */

// --- Classic Module Pattern (IIFE) ---
const AppConfig = (() => {
  // Private state:
  const defaults = {
    env: "development",
    port: 3000,
    debug: true,
    logLevel: "info",
  };

  let config = { ...defaults };

  // Private functions:
  function validate(key, value) {
    if (key === "port" && (typeof value !== "number" || value < 0 || value > 65535)) {
      throw new RangeError(`Invalid port: ${value}`);
    }
    if (key === "logLevel" && !["debug", "info", "warn", "error"].includes(value)) {
      throw new TypeError(`Invalid logLevel: ${value}`);
    }
    return true;
  }

  // Public API (revealing module pattern):
  return Object.freeze({
    get(key) {
      return config[key];
    },

    set(key, value) {
      validate(key, value);
      config[key] = value;
      return this;
    },

    getAll() {
      return { ...config }; // return copy
    },

    reset() {
      config = { ...defaults };
      return this;
    },

    get env() {
      return config.env;
    },
  });
})();

show("Module get", AppConfig.get("port"));
AppConfig.set("port", 8080).set("logLevel", "debug");
show("Module getAll", AppConfig.getAll());
AppConfig.reset();
show("Module after reset", AppConfig.getAll());

// --- Singleton via Module Pattern ---
const EventBus = (() => {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return Object.freeze({
    /**
     * @param {string} event
     * @param {Function} handler
     * @returns {{ unsubscribe: () => void }}
     */
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(handler);
      return {
        unsubscribe: () => listeners.get(event)?.delete(handler),
      };
    },

    /** @param {string} event @param {*} data */
    emit(event, data) {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.forEach((h) => h(data));
      }
    },

    /** @param {string} [event] */
    clear(event) {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    },

    /** @returns {string[]} */
    get events() {
      return [...listeners.keys()];
    },
  });
})();

// Usage:
const sub1 = EventBus.on("userCreated", (data) =>
  show("EventBus handler 1", `User created: ${data.name}`)
);
const sub2 = EventBus.on("userCreated", (data) =>
  show("EventBus handler 2", `Welcome email for: ${data.email}`)
);

EventBus.emit("userCreated", { name: "Alice", email: "alice@test.com" });

sub1.unsubscribe();
show("After unsubscribe, emit again:", "");
EventBus.emit("userCreated", { name: "Bob", email: "bob@test.com" });

EventBus.clear();
show("EventBus events after clear", EventBus.events);

// --- Namespace module pattern ---
const MathUtils = (() => {
  // Private helpers:
  function validateNumber(n) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      throw new TypeError(`Expected number, got: ${n}`);
    }
  }

  return Object.freeze({
    /** @param {number} n @returns {number} */
    factorial(n) {
      validateNumber(n);
      if (n < 0) throw new RangeError("Factorial of negative number");
      if (n <= 1) return 1;
      let result = 1;
      for (let i = 2; i <= n; i++) result *= i;
      return result;
    },

    /** @param {number} min @param {number} max @returns {number} */
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    /**
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /** @param {number[]} nums @returns {number} */
    average(nums) {
      if (nums.length === 0) throw new RangeError("Empty array");
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
  });
})();

show("MathUtils.factorial(6)", MathUtils.factorial(6));
show("MathUtils.clamp(15, 0, 10)", MathUtils.clamp(15, 0, 10));
show("MathUtils.randomInt(1, 100)", MathUtils.randomInt(1, 100));
show("MathUtils.average([10, 20, 30])", MathUtils.average([10, 20, 30]));

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  BONUS: SUMMARY COMPARISON TABLE                                       ║
// ╚═════════════════════════════════════════════════════════════════════════╝

section("Summary: OOP Patterns Comparison");

console.log(`
  ┌────────────────────┬──────────────────────────────────────────────┐
  │ Pattern            │ When to Use                                  │
  ├────────────────────┼──────────────────────────────────────────────┤
  │ Class              │ Need prototype chain, instanceof, clear API  │
  │ Factory Function   │ Need privacy, composition, no 'this' issues │
  │ Module Pattern     │ Singletons, namespace isolation, config      │
  │ Mixin              │ Share behavior across unrelated classes      │
  │ Composition        │ Default choice — flexible and maintainable   │
  │ Inheritance        │ True "is-a" with shared implementation      │
  │ Strategy Pattern   │ Swappable algorithms (OCP)                   │
  │ DI Container       │ Decouple creation from usage (DIP)           │
  └────────────────────┴──────────────────────────────────────────────┘

  SOLID Quick Reference:
    S — Single Responsibility: One reason to change per class
    O — Open/Closed: Extend behavior without modifying existing code
    L — Liskov Substitution: Subtypes must honor base type contracts
    I — Interface Segregation: Small, focused interfaces
    D — Dependency Inversion: Depend on abstractions, not concretions
`);

console.log(`${"=".repeat(72)}`);
console.log("  04_oop_and_solid.js — All sections complete!");
console.log(`${"=".repeat(72)}\n`);
