# Design Patterns -- Senior Interview Reference

## Table of Contents

- [Singleton](#singleton)
- [Factory](#factory)
- [Abstract Factory](#abstract-factory)
- [Strategy](#strategy)
- [Observer / EventEmitter](#observer--eventemitter)
- [Decorator](#decorator)
- [Builder](#builder)
- [Repository](#repository)
- [Chain of Responsibility](#chain-of-responsibility)
- [Command](#command)
- [Adapter](#adapter)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Singleton

### Intent

Ensure a class has only one instance and provide a global point of access to it.

### When to Use

- Database connection pools
- Configuration managers
- Logging services
- Caches
- Thread pools (Worker pool in Node.js)

### JavaScript / Node.js Example

```javascript
// Pattern 1: ES Module singleton (simplest in Node.js)
// logger.js -- Node.js modules are cached after first load
class Logger {
  #logs = [];

  info(message) {
    const entry = { level: "info", message, timestamp: new Date() };
    this.#logs.push(entry);
    console.log(`[INFO] ${message}`);
  }

  error(message) {
    const entry = { level: "error", message, timestamp: new Date() };
    this.#logs.push(entry);
    console.error(`[ERROR] ${message}`);
  }

  getLogs() {
    return [...this.#logs];
  }
}

// Export a single instance -- all importers get the same object
module.exports = new Logger();

// Usage in any file:
// const logger = require("./logger");
// logger.info("Hello"); // Same instance everywhere
```

```javascript
// Pattern 2: Class-based singleton with lazy initialization
class Database {
  static #instance = null;

  #connection = null;

  constructor() {
    if (Database.#instance) {
      throw new Error("Use Database.getInstance() instead of new");
    }
  }

  static getInstance() {
    if (!Database.#instance) {
      Database.#instance = new Database();
    }
    return Database.#instance;
  }

  async connect(url) {
    if (!this.#connection) {
      this.#connection = await createConnection(url);
    }
    return this.#connection;
  }

  getConnection() {
    if (!this.#connection) {
      throw new Error("Not connected. Call connect() first.");
    }
    return this.#connection;
  }
}

const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2); // true
```

```javascript
// Pattern 3: Proxy-based singleton
function createSingleton(ClassRef) {
  let instance = null;
  return new Proxy(ClassRef, {
    construct(target, args) {
      if (!instance) {
        instance = new target(...args);
      }
      return instance;
    },
  });
}

const SingletonLogger = createSingleton(Logger);
const a = new SingletonLogger();
const b = new SingletonLogger();
console.log(a === b); // true
```

### Real-World Node.js Usage

- **Mongoose** connection: `mongoose.connect()` returns the same connection
- **Winston** logger: typically configured once and exported as a singleton
- **Redis** client: single client instance shared across the app
- **Knex** query builder: single configured instance per database

---

## Factory

### Intent

Define an interface for creating objects, but let subclasses or configuration determine which class to instantiate.

### When to Use

- Object creation logic is complex
- The type of object depends on input
- You want to decouple creation from usage
- Centralizing creation logic for consistency

### JavaScript / Node.js Example

```javascript
// Simple Factory
class Notification {
  send(message) {
    throw new Error("Must implement send()");
  }
}

class EmailNotification extends Notification {
  constructor(to) {
    super();
    this.to = to;
  }

  send(message) {
    console.log(`Sending email to ${this.to}: ${message}`);
  }
}

class SMSNotification extends Notification {
  constructor(phone) {
    super();
    this.phone = phone;
  }

  send(message) {
    console.log(`Sending SMS to ${this.phone}: ${message}`);
  }
}

class PushNotification extends Notification {
  constructor(deviceToken) {
    super();
    this.deviceToken = deviceToken;
  }

  send(message) {
    console.log(`Sending push to ${this.deviceToken}: ${message}`);
  }
}

class SlackNotification extends Notification {
  constructor(webhookUrl) {
    super();
    this.webhookUrl = webhookUrl;
  }

  send(message) {
    console.log(`Posting to Slack: ${message}`);
  }
}

// Factory
class NotificationFactory {
  static create(type, config) {
    switch (type) {
      case "email": return new EmailNotification(config.to);
      case "sms":   return new SMSNotification(config.phone);
      case "push":  return new PushNotification(config.deviceToken);
      case "slack": return new SlackNotification(config.webhookUrl);
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }
}

// Usage
const notification = NotificationFactory.create("email", {
  to: "alice@example.com",
});
notification.send("Hello from the factory!");
```

```javascript
// Registry-based factory (open for extension)
class NotificationRegistry {
  #creators = new Map();

  register(type, creator) {
    this.#creators.set(type, creator);
    return this;
  }

  create(type, config) {
    const creator = this.#creators.get(type);
    if (!creator) throw new Error(`Unknown notification type: ${type}`);
    return creator(config);
  }
}

const registry = new NotificationRegistry();
registry
  .register("email", (c) => new EmailNotification(c.to))
  .register("sms", (c) => new SMSNotification(c.phone))
  .register("push", (c) => new PushNotification(c.deviceToken));

// Third-party can extend without modifying existing code
registry.register("slack", (c) => new SlackNotification(c.webhookUrl));
```

### Real-World Node.js Usage

- **Passport.js** strategies: `passport.use(new GoogleStrategy(...))`
- **Mongoose** model creation: `mongoose.model("User", userSchema)`
- **Winston** transports: factory-like creation of log transports
- **Database drivers**: create connections based on DB type

---

## Abstract Factory

### Intent

Provide an interface for creating families of related objects without specifying their concrete classes.

### When to Use

- You need to create families of related objects
- The system should be independent of how its products are created
- You want to enforce consistency among related objects

### JavaScript / Node.js Example

```javascript
// Abstract Factory for UI components (e.g., supporting multiple themes)
class UIFactory {
  createButton() { throw new Error("Not implemented"); }
  createInput() { throw new Error("Not implemented"); }
  createCard() { throw new Error("Not implemented"); }
}

// Material Design family
class MaterialButton {
  render() { return '<button class="mdc-button">Click me</button>'; }
}
class MaterialInput {
  render() { return '<input class="mdc-text-field" />'; }
}
class MaterialCard {
  render() { return '<div class="mdc-card">Content</div>'; }
}

class MaterialUIFactory extends UIFactory {
  createButton() { return new MaterialButton(); }
  createInput() { return new MaterialInput(); }
  createCard() { return new MaterialCard(); }
}

// Bootstrap family
class BootstrapButton {
  render() { return '<button class="btn btn-primary">Click me</button>'; }
}
class BootstrapInput {
  render() { return '<input class="form-control" />'; }
}
class BootstrapCard {
  render() { return '<div class="card">Content</div>'; }
}

class BootstrapUIFactory extends UIFactory {
  createButton() { return new BootstrapButton(); }
  createInput() { return new BootstrapInput(); }
  createCard() { return new BootstrapCard(); }
}

// Client code is decoupled from concrete implementations
function renderForm(factory) {
  const button = factory.createButton();
  const input = factory.createInput();
  const card = factory.createCard();

  return `
    ${card.render()}
      ${input.render()}
      ${button.render()}
  `;
}

// Switch entire UI family by changing the factory
const html = renderForm(new MaterialUIFactory());
// const html = renderForm(new BootstrapUIFactory());
```

```javascript
// Node.js practical example: Database abstraction
class DatabaseFactory {
  createConnection() { throw new Error("Not implemented"); }
  createQueryBuilder() { throw new Error("Not implemented"); }
  createMigrationRunner() { throw new Error("Not implemented"); }
}

class PostgresFactory extends DatabaseFactory {
  createConnection() { return new PgConnection(); }
  createQueryBuilder() { return new PgQueryBuilder(); }
  createMigrationRunner() { return new PgMigrationRunner(); }
}

class MongoFactory extends DatabaseFactory {
  createConnection() { return new MongoConnection(); }
  createQueryBuilder() { return new MongoQueryBuilder(); }
  createMigrationRunner() { return new MongoMigrationRunner(); }
}
```

### Real-World Node.js Usage

- **Knex.js** multi-dialect support: creates family of query builders, schema builders, and migration tools per database dialect
- **TypeORM** drivers: each database has its own connection, query runner, and schema builder
- **Cloud provider SDKs**: AWS vs GCP vs Azure services (storage, queues, etc.)

---

## Strategy

### Intent

Define a family of algorithms, encapsulate each one, and make them interchangeable at runtime.

### When to Use

- You need different variants of an algorithm
- You want to avoid conditional statements for selecting behavior
- You want to swap behavior at runtime

### JavaScript / Node.js Example

```javascript
// Compression strategies
class CompressionStrategy {
  compress(data) { throw new Error("Not implemented"); }
  decompress(data) { throw new Error("Not implemented"); }
}

class GzipStrategy extends CompressionStrategy {
  compress(data) {
    const zlib = require("zlib");
    return zlib.gzipSync(Buffer.from(data));
  }

  decompress(data) {
    const zlib = require("zlib");
    return zlib.gunzipSync(data).toString();
  }
}

class BrotliStrategy extends CompressionStrategy {
  compress(data) {
    const zlib = require("zlib");
    return zlib.brotliCompressSync(Buffer.from(data));
  }

  decompress(data) {
    const zlib = require("zlib");
    return zlib.brotliDecompressSync(data).toString();
  }
}

class NoCompressionStrategy extends CompressionStrategy {
  compress(data) { return Buffer.from(data); }
  decompress(data) { return data.toString(); }
}

// Context
class FileProcessor {
  #strategy;

  constructor(strategy) {
    this.#strategy = strategy;
  }

  setStrategy(strategy) {
    this.#strategy = strategy;
  }

  async processFile(inputPath, outputPath) {
    const fs = require("fs").promises;
    const data = await fs.readFile(inputPath, "utf-8");
    const compressed = this.#strategy.compress(data);
    await fs.writeFile(outputPath, compressed);
    console.log(
      `Compressed: ${data.length} -> ${compressed.length} bytes ` +
      `(${((1 - compressed.length / data.length) * 100).toFixed(1)}% reduction)`
    );
  }
}

// Usage
const processor = new FileProcessor(new GzipStrategy());
await processor.processFile("input.txt", "output.gz");

// Switch strategy at runtime
processor.setStrategy(new BrotliStrategy());
await processor.processFile("input.txt", "output.br");
```

```javascript
// Functional strategy pattern (idiomatic JavaScript)
const strategies = {
  percentage: (price, value) => price * (value / 100),
  fixed: (price, value) => Math.min(value, price),
  buyXgetY: (price, { buy, free, itemPrice }) =>
    Math.floor(buy / (buy + free)) * itemPrice,
};

function calculateDiscount(price, { type, ...params }) {
  const strategy = strategies[type];
  if (!strategy) throw new Error(`Unknown discount type: ${type}`);
  return strategy(price, params.value ?? params);
}

console.log(calculateDiscount(100, { type: "percentage", value: 15 })); // 15
console.log(calculateDiscount(100, { type: "fixed", value: 20 }));     // 20
```

### Real-World Node.js Usage

- **Passport.js**: authentication strategies (Local, OAuth, JWT)
- **Express middleware**: different body parsers (JSON, URL-encoded, multipart)
- **Payment processing**: different payment providers (Stripe, PayPal, Square)
- **Caching**: different backends (Redis, Memcached, in-memory)

---

## Observer / EventEmitter

### Intent

Define a one-to-many dependency so that when one object changes state, all dependents are notified automatically.

### When to Use

- When changes to one object require updating others
- When an object should notify others without knowing who they are
- Event-driven architectures
- Pub/sub messaging

### JavaScript / Node.js Example

```javascript
// Custom Observer implementation
class EventBus {
  #listeners = new Map();

  on(event, listener) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(listener);
    return () => this.off(event, listener); // Return unsubscribe function
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  emit(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      for (const listener of [...listeners]) { // Copy to handle removal during iteration
        listener(...args);
      }
    }
  }
}
```

```javascript
// Node.js EventEmitter (built-in)
const EventEmitter = require("events");

class OrderSystem extends EventEmitter {
  #orders = [];

  placeOrder(order) {
    order.id = `ORD-${Date.now()}`;
    order.status = "placed";
    this.#orders.push(order);
    this.emit("order:placed", order);
    return order;
  }

  cancelOrder(orderId) {
    const order = this.#orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    order.status = "cancelled";
    this.emit("order:cancelled", order);
    return order;
  }

  shipOrder(orderId) {
    const order = this.#orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    order.status = "shipped";
    this.emit("order:shipped", order);
    return order;
  }
}

// Loosely coupled listeners
const orderSystem = new OrderSystem();

// Inventory service
orderSystem.on("order:placed", (order) => {
  console.log(`[Inventory] Reserving items for ${order.id}`);
});

// Notification service
orderSystem.on("order:placed", (order) => {
  console.log(`[Email] Sending confirmation for ${order.id}`);
});

orderSystem.on("order:shipped", (order) => {
  console.log(`[Email] Sending shipping notification for ${order.id}`);
});

// Analytics service
orderSystem.on("order:placed", (order) => {
  console.log(`[Analytics] Tracking order ${order.id}`);
});

orderSystem.on("order:cancelled", (order) => {
  console.log(`[Analytics] Tracking cancellation ${order.id}`);
});

// Usage
const order = orderSystem.placeOrder({ items: ["Widget"], total: 29.99 });
orderSystem.shipOrder(order.id);
```

```javascript
// Typed event emitter (TypeScript)
// Ensures type safety for event names and payloads
import { EventEmitter } from "events";

interface OrderEvents {
  "order:placed": [order: Order];
  "order:shipped": [order: Order];
  "order:cancelled": [order: Order, reason: string];
}

class TypedOrderSystem extends (EventEmitter as {
  new (): TypedEmitter<OrderEvents>;
}) {
  // Type-safe emit and on methods
}

// Alternative: use strict-event-emitter or eventemitter3 with generics
```

### Real-World Node.js Usage

- **Node.js core**: `EventEmitter` is used in `http.Server`, `Stream`, `process`
- **Express/Koa**: middleware pipeline is observer-like
- **Socket.IO**: real-time event communication
- **RabbitMQ/Redis Pub/Sub**: message broker integration

---

## Decorator

### Intent

Attach additional responsibilities to an object dynamically. Provides a flexible alternative to subclassing.

### When to Use

- Adding behavior to individual objects without affecting others
- When subclassing is impractical (too many combinations)
- Cross-cutting concerns (logging, caching, validation, rate limiting)

### JavaScript / Node.js Example

```javascript
// Function decorators (most common in JS/Node.js)

// Logging decorator
function withLogging(fn, label) {
  return async function (...args) {
    const start = Date.now();
    console.log(`[${label}] Starting with args:`, args);
    try {
      const result = await fn.apply(this, args);
      console.log(`[${label}] Completed in ${Date.now() - start}ms`);
      return result;
    } catch (error) {
      console.error(`[${label}] Failed in ${Date.now() - start}ms:`, error.message);
      throw error;
    }
  };
}

// Caching decorator
function withCache(fn, { ttl = 60000 } = {}) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < ttl) {
      return cached.value;
    }
    const result = await fn.apply(this, args);
    cache.set(key, { value: result, time: Date.now() });
    return result;
  };
}

// Retry decorator
function withRetry(fn, { maxRetries = 3, delay = 1000 } = {}) {
  return async function (...args) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, delay * attempt));
        }
      }
    }
    throw lastError;
  };
}

// Rate limiting decorator
function withRateLimit(fn, { maxCalls = 10, windowMs = 60000 } = {}) {
  const calls = [];
  return async function (...args) {
    const now = Date.now();
    // Remove expired entries
    while (calls.length > 0 && now - calls[0] > windowMs) {
      calls.shift();
    }
    if (calls.length >= maxCalls) {
      throw new Error("Rate limit exceeded");
    }
    calls.push(now);
    return fn.apply(this, args);
  };
}

// Compose decorators
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

const enhancedFetchUser = withLogging(
  withRetry(
    withCache(fetchUser, { ttl: 30000 }),
    { maxRetries: 3 }
  ),
  "fetchUser"
);

await enhancedFetchUser(42);
```

```javascript
// Class-based decorator pattern
class DataService {
  async getData(id) {
    // Simulate API call
    return { id, name: "Item " + id };
  }
}

class LoggingDecorator {
  constructor(service) {
    this.service = service;
  }

  async getData(id) {
    console.log(`Fetching data for id: ${id}`);
    const result = await this.service.getData(id);
    console.log(`Got data:`, result);
    return result;
  }
}

class CachingDecorator {
  #cache = new Map();

  constructor(service) {
    this.service = service;
  }

  async getData(id) {
    if (this.#cache.has(id)) {
      console.log(`Cache hit for id: ${id}`);
      return this.#cache.get(id);
    }
    const result = await this.service.getData(id);
    this.#cache.set(id, result);
    return result;
  }
}

// Stack decorators
let service = new DataService();
service = new CachingDecorator(service);
service = new LoggingDecorator(service);

await service.getData(1); // Logging -> Caching -> DataService
await service.getData(1); // Logging -> Caching (hit!)
```

### Real-World Node.js Usage

- **Express middleware**: each middleware decorates the request/response pipeline
- **NestJS decorators**: `@Controller`, `@Get`, `@Injectable`, `@Guard`
- **TypeORM decorators**: `@Entity`, `@Column`, `@ManyToOne`
- **Caching layers**: Redis cache decorator wrapping database queries

---

## Builder

### Intent

Separate the construction of a complex object from its representation, allowing the same construction process to create different representations.

### When to Use

- Object requires many parameters (constructor with too many args)
- Object creation has multiple steps
- You want to enforce order of construction
- Different representations of the constructed object

### JavaScript / Node.js Example

```javascript
class QueryBuilder {
  #table = "";
  #conditions = [];
  #joins = [];
  #columns = ["*"];
  #orderBy = [];
  #limit = null;
  #offset = null;
  #params = [];

  select(...columns) {
    this.#columns = columns.length > 0 ? columns : ["*"];
    return this;
  }

  from(table) {
    this.#table = table;
    return this;
  }

  where(condition, ...params) {
    this.#conditions.push(condition);
    this.#params.push(...params);
    return this;
  }

  join(table, condition) {
    this.#joins.push(`JOIN ${table} ON ${condition}`);
    return this;
  }

  leftJoin(table, condition) {
    this.#joins.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  orderBy(column, direction = "ASC") {
    this.#orderBy.push(`${column} ${direction}`);
    return this;
  }

  limit(count) {
    this.#limit = count;
    return this;
  }

  offset(count) {
    this.#offset = count;
    return this;
  }

  build() {
    const parts = [
      `SELECT ${this.#columns.join(", ")}`,
      `FROM ${this.#table}`,
    ];

    if (this.#joins.length > 0) {
      parts.push(this.#joins.join("\n"));
    }

    if (this.#conditions.length > 0) {
      parts.push(`WHERE ${this.#conditions.join(" AND ")}`);
    }

    if (this.#orderBy.length > 0) {
      parts.push(`ORDER BY ${this.#orderBy.join(", ")}`);
    }

    if (this.#limit !== null) {
      parts.push(`LIMIT ${this.#limit}`);
    }

    if (this.#offset !== null) {
      parts.push(`OFFSET ${this.#offset}`);
    }

    return {
      sql: parts.join("\n"),
      params: this.#params,
    };
  }
}

// Usage
const query = new QueryBuilder()
  .select("u.id", "u.name", "u.email", "COUNT(o.id) as order_count")
  .from("users u")
  .leftJoin("orders o", "u.id = o.user_id")
  .where("u.active = ?", true)
  .where("u.created_at > ?", "2024-01-01")
  .orderBy("u.name", "ASC")
  .limit(20)
  .offset(0)
  .build();

console.log(query.sql);
// SELECT u.id, u.name, u.email, COUNT(o.id) as order_count
// FROM users u
// LEFT JOIN orders o ON u.id = o.user_id
// WHERE u.active = ? AND u.created_at > ?
// ORDER BY u.name ASC
// LIMIT 20
// OFFSET 0
```

```javascript
// HTTP Request Builder
class RequestBuilder {
  #url = "";
  #method = "GET";
  #headers = {};
  #body = null;
  #timeout = 30000;
  #retries = 0;

  url(url) { this.#url = url; return this; }
  method(m) { this.#method = m; return this; }
  get(url) { this.#method = "GET"; this.#url = url; return this; }
  post(url) { this.#method = "POST"; this.#url = url; return this; }
  put(url) { this.#method = "PUT"; this.#url = url; return this; }
  delete(url) { this.#method = "DELETE"; this.#url = url; return this; }

  header(key, value) { this.#headers[key] = value; return this; }
  auth(token) { this.#headers["Authorization"] = `Bearer ${token}`; return this; }
  contentType(type) { this.#headers["Content-Type"] = type; return this; }
  json(data) {
    this.#body = JSON.stringify(data);
    this.#headers["Content-Type"] = "application/json";
    return this;
  }

  timeout(ms) { this.#timeout = ms; return this; }
  retries(n) { this.#retries = n; return this; }

  async send() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#timeout);

    try {
      const response = await fetch(this.#url, {
        method: this.#method,
        headers: this.#headers,
        body: this.#body,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Usage
const response = await new RequestBuilder()
  .post("https://api.example.com/users")
  .auth("my-token")
  .json({ name: "Alice", email: "alice@example.com" })
  .timeout(5000)
  .retries(3)
  .send();
```

### Real-World Node.js Usage

- **Knex.js**: `knex("users").select("*").where("active", true).orderBy("name")`
- **Supertest**: `request(app).get("/users").expect(200)`
- **Joi/Zod**: `z.string().min(3).max(100).email()`
- **Docker SDK**: building container configurations

---

## Repository

### Intent

Mediate between the domain and data mapping layers, acting like an in-memory collection of domain objects.

### When to Use

- Abstracting data access logic
- Supporting multiple data sources
- Making domain logic testable
- Centralizing query logic

### JavaScript / Node.js Example

```javascript
// Generic repository interface
class BaseRepository {
  async findById(id) { throw new Error("Not implemented"); }
  async findAll(filter = {}) { throw new Error("Not implemented"); }
  async create(entity) { throw new Error("Not implemented"); }
  async update(id, data) { throw new Error("Not implemented"); }
  async delete(id) { throw new Error("Not implemented"); }
  async count(filter = {}) { throw new Error("Not implemented"); }
  async exists(id) { throw new Error("Not implemented"); }
}

// Concrete implementation with PostgreSQL
class PgUserRepository extends BaseRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return rows[0] ? this.#toDomain(rows[0]) : null;
  }

  async findAll({ page = 1, limit = 20, sort = "created_at", order = "DESC" } = {}) {
    const offset = (page - 1) * limit;
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE deleted_at IS NULL
       ORDER BY ${sort} ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map(this.#toDomain);
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email]
    );
    return rows[0] ? this.#toDomain(rows[0]) : null;
  }

  async create(user) {
    const { rows } = await this.pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.name, user.email, user.passwordHash, user.role]
    );
    return this.#toDomain(rows[0]);
  }

  async update(id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");

    const { rows } = await this.pool.query(
      `UPDATE users SET ${setClause}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0] ? this.#toDomain(rows[0]) : null;
  }

  async delete(id) {
    // Soft delete
    await this.pool.query(
      "UPDATE users SET deleted_at = NOW() WHERE id = $1",
      [id]
    );
  }

  // Map database row to domain object
  #toDomain(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// In-memory implementation for testing
class InMemoryUserRepository extends BaseRepository {
  #users = new Map();
  #nextId = 1;

  async findById(id) {
    return this.#users.get(id) || null;
  }

  async findAll() {
    return [...this.#users.values()];
  }

  async create(user) {
    const newUser = { ...user, id: this.#nextId++, createdAt: new Date() };
    this.#users.set(newUser.id, newUser);
    return newUser;
  }

  async update(id, data) {
    const user = this.#users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.#users.set(id, updated);
    return updated;
  }

  async delete(id) {
    this.#users.delete(id);
  }

  // Test helper
  async seed(users) {
    for (const user of users) {
      await this.create(user);
    }
  }
}
```

### Real-World Node.js Usage

- **TypeORM**: built-in repository pattern with `getRepository(User)`
- **Prisma**: the client acts as a repository
- **Sequelize**: models provide repository-like methods
- **Clean Architecture / DDD**: repositories are the standard data access abstraction

---

## Chain of Responsibility

### Intent

Pass a request along a chain of handlers. Each handler decides to process the request or pass it to the next handler.

### When to Use

- Multiple objects may handle a request
- The handler is not known in advance
- The set of handlers should be configurable dynamically
- Processing pipelines

### JavaScript / Node.js Example

```javascript
// Middleware-style chain (Express-like)
class MiddlewareChain {
  #middlewares = [];

  use(middleware) {
    this.#middlewares.push(middleware);
    return this;
  }

  async execute(context) {
    let index = 0;

    const next = async () => {
      if (index < this.#middlewares.length) {
        const middleware = this.#middlewares[index++];
        await middleware(context, next);
      }
    };

    await next();
    return context;
  }
}

// Request validation chain
const chain = new MiddlewareChain();

// Authentication
chain.use(async (ctx, next) => {
  const token = ctx.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    ctx.error = { status: 401, message: "Unauthorized" };
    return; // Stop chain
  }
  ctx.user = await verifyToken(token);
  await next();
});

// Authorization
chain.use(async (ctx, next) => {
  if (ctx.requiredRole && ctx.user.role !== ctx.requiredRole) {
    ctx.error = { status: 403, message: "Forbidden" };
    return;
  }
  await next();
});

// Rate limiting
chain.use(async (ctx, next) => {
  const key = ctx.user?.id || ctx.ip;
  if (await isRateLimited(key)) {
    ctx.error = { status: 429, message: "Too Many Requests" };
    return;
  }
  await next();
});

// Validation
chain.use(async (ctx, next) => {
  if (ctx.schema) {
    const { error } = ctx.schema.validate(ctx.body);
    if (error) {
      ctx.error = { status: 400, message: error.message };
      return;
    }
  }
  await next();
});

// Execute the chain
const result = await chain.execute({
  headers: { authorization: "Bearer abc123" },
  body: { name: "Alice" },
  requiredRole: "admin",
});
```

```javascript
// Approval chain pattern
class ApprovalHandler {
  #next = null;

  setNext(handler) {
    this.#next = handler;
    return handler;
  }

  async handle(request) {
    if (this.#next) {
      return this.#next.handle(request);
    }
    return { approved: false, reason: "No handler could process this request" };
  }
}

class ManagerApproval extends ApprovalHandler {
  async handle(request) {
    if (request.amount <= 1000) {
      return { approved: true, approver: "Manager" };
    }
    return super.handle(request);
  }
}

class DirectorApproval extends ApprovalHandler {
  async handle(request) {
    if (request.amount <= 10000) {
      return { approved: true, approver: "Director" };
    }
    return super.handle(request);
  }
}

class VPApproval extends ApprovalHandler {
  async handle(request) {
    if (request.amount <= 100000) {
      return { approved: true, approver: "VP" };
    }
    return super.handle(request);
  }
}

// Set up the chain
const manager = new ManagerApproval();
const director = new DirectorApproval();
const vp = new VPApproval();

manager.setNext(director).setNext(vp);

console.log(await manager.handle({ amount: 500 }));    // { approved: true, approver: "Manager" }
console.log(await manager.handle({ amount: 5000 }));   // { approved: true, approver: "Director" }
console.log(await manager.handle({ amount: 50000 }));  // { approved: true, approver: "VP" }
console.log(await manager.handle({ amount: 500000 })); // { approved: false, reason: "..." }
```

### Real-World Node.js Usage

- **Express/Koa middleware**: the entire middleware stack is a chain
- **Validation pipelines**: Joi/Zod schema validation chains
- **Error handling middleware**: cascading error handlers
- **Logging pipelines**: Winston transports chain

---

## Command

### Intent

Encapsulate a request as an object, allowing parameterization, queuing, logging, and undo/redo.

### When to Use

- Undo/redo functionality
- Transaction-like operations
- Task queuing
- Audit logging of operations

### JavaScript / Node.js Example

```javascript
// Command interface
class Command {
  async execute() { throw new Error("Not implemented"); }
  async undo() { throw new Error("Not implemented"); }
  describe() { return this.constructor.name; }
}

// Concrete commands
class CreateUserCommand extends Command {
  #userRepo;
  #userData;
  #createdUser = null;

  constructor(userRepo, userData) {
    super();
    this.#userRepo = userRepo;
    this.#userData = userData;
  }

  async execute() {
    this.#createdUser = await this.#userRepo.create(this.#userData);
    return this.#createdUser;
  }

  async undo() {
    if (this.#createdUser) {
      await this.#userRepo.delete(this.#createdUser.id);
      this.#createdUser = null;
    }
  }

  describe() {
    return `CreateUser: ${this.#userData.name}`;
  }
}

class UpdateUserCommand extends Command {
  #userRepo;
  #userId;
  #newData;
  #previousData = null;

  constructor(userRepo, userId, newData) {
    super();
    this.#userRepo = userRepo;
    this.#userId = userId;
    this.#newData = newData;
  }

  async execute() {
    this.#previousData = await this.#userRepo.findById(this.#userId);
    return this.#userRepo.update(this.#userId, this.#newData);
  }

  async undo() {
    if (this.#previousData) {
      await this.#userRepo.update(this.#userId, this.#previousData);
    }
  }

  describe() {
    return `UpdateUser: ${this.#userId}`;
  }
}

// Command invoker with history
class CommandHistory {
  #history = [];
  #undone = [];

  async execute(command) {
    const result = await command.execute();
    this.#history.push(command);
    this.#undone = []; // Clear redo stack
    console.log(`Executed: ${command.describe()}`);
    return result;
  }

  async undo() {
    const command = this.#history.pop();
    if (command) {
      await command.undo();
      this.#undone.push(command);
      console.log(`Undone: ${command.describe()}`);
    }
  }

  async redo() {
    const command = this.#undone.pop();
    if (command) {
      await command.execute();
      this.#history.push(command);
      console.log(`Redone: ${command.describe()}`);
    }
  }

  getHistory() {
    return this.#history.map((cmd) => cmd.describe());
  }
}

// Usage
const history = new CommandHistory();

await history.execute(new CreateUserCommand(userRepo, { name: "Alice" }));
await history.execute(new UpdateUserCommand(userRepo, 1, { name: "Bob" }));

console.log(history.getHistory()); // ["CreateUser: Alice", "UpdateUser: 1"]

await history.undo(); // Reverts the update
await history.redo(); // Re-applies the update
```

### Real-World Node.js Usage

- **Task queues**: Bull/BullMQ job processing
- **Database migrations**: up/down commands (Knex, Sequelize)
- **CLI tools**: Commander.js command registration
- **CQRS**: Command Query Responsibility Segregation pattern

---

## Adapter

### Intent

Convert the interface of a class into another interface that clients expect. Lets classes work together that otherwise could not.

### When to Use

- Integrating third-party libraries with different interfaces
- Supporting multiple implementations with a unified API
- Wrapping legacy code
- Making incompatible interfaces work together

### JavaScript / Node.js Example

```javascript
// Different payment provider APIs (third-party, cannot modify)
class StripeAPI {
  async createCharge({ amount, currency, source, description }) {
    console.log(`[Stripe] Charging ${amount} ${currency}`);
    return { id: `ch_${Date.now()}`, status: "succeeded", amount };
  }

  async refundCharge(chargeId) {
    console.log(`[Stripe] Refunding charge ${chargeId}`);
    return { id: `re_${Date.now()}`, status: "succeeded" };
  }
}

class PayPalAPI {
  async createPayment(paymentDetails) {
    console.log(`[PayPal] Creating payment for $${paymentDetails.total}`);
    return { paymentId: `PAY-${Date.now()}`, state: "approved" };
  }

  async executeRefund(paymentId, refundDetails) {
    console.log(`[PayPal] Refunding payment ${paymentId}`);
    return { refundId: `REF-${Date.now()}`, state: "completed" };
  }
}

class SquareAPI {
  async processPayment(body) {
    console.log(`[Square] Processing ${body.amountMoney.amount} cents`);
    return { payment: { id: `sq_${Date.now()}`, status: "COMPLETED" } };
  }

  async refundPayment(body) {
    console.log(`[Square] Refunding payment ${body.paymentId}`);
    return { refund: { id: `sqr_${Date.now()}`, status: "COMPLETED" } };
  }
}

// Unified payment interface (what our app expects)
class PaymentAdapter {
  async charge(amount, currency, metadata) { throw new Error("Not implemented"); }
  async refund(transactionId, amount) { throw new Error("Not implemented"); }
}

// Adapters
class StripeAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.stripe = new StripeAPI();
  }

  async charge(amount, currency, metadata) {
    const result = await this.stripe.createCharge({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency,
      source: metadata.source,
      description: metadata.description,
    });
    return {
      transactionId: result.id,
      status: result.status === "succeeded" ? "success" : "failed",
      provider: "stripe",
    };
  }

  async refund(transactionId) {
    const result = await this.stripe.refundCharge(transactionId);
    return {
      refundId: result.id,
      status: result.status === "succeeded" ? "success" : "failed",
      provider: "stripe",
    };
  }
}

class PayPalAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.paypal = new PayPalAPI();
  }

  async charge(amount, currency, metadata) {
    const result = await this.paypal.createPayment({
      total: amount.toFixed(2),
      currency,
      description: metadata.description,
    });
    return {
      transactionId: result.paymentId,
      status: result.state === "approved" ? "success" : "failed",
      provider: "paypal",
    };
  }

  async refund(transactionId) {
    const result = await this.paypal.executeRefund(transactionId, {});
    return {
      refundId: result.refundId,
      status: result.state === "completed" ? "success" : "failed",
      provider: "paypal",
    };
  }
}

// Client code uses the unified interface
class PaymentService {
  constructor(paymentAdapter) {
    this.adapter = paymentAdapter;
  }

  async processOrder(order) {
    const result = await this.adapter.charge(
      order.total,
      order.currency,
      { description: `Order ${order.id}` }
    );

    if (result.status !== "success") {
      throw new Error("Payment failed");
    }

    return result;
  }
}

// Swap providers without changing business logic
const service = new PaymentService(new StripeAdapter());
// const service = new PaymentService(new PayPalAdapter());
```

### Real-World Node.js Usage

- **Database ORMs**: adapting different DB drivers to a unified query interface
- **Cloud storage**: AWS S3 vs GCS vs Azure Blob with unified API
- **Message queues**: RabbitMQ vs Kafka vs SQS behind a common interface
- **Logging libraries**: adapting Winston, Pino, Bunyan to a common logger interface

---

## Interview Tips and Key Takeaways

1. **Do not memorize patterns blindly.** Understand the **problem** each pattern solves and when to use it. Interviewers test judgment, not recall.

2. **Singleton in Node.js** is usually just a module export. No need for complex class patterns -- module caching provides it for free.

3. **Strategy pattern** is extremely common in Node.js. Passport.js, payment processors, and compression are perfect real-world examples.

4. **Observer/EventEmitter** is the backbone of Node.js. Know the `EventEmitter` API, error event handling, and memory leak potential with listeners.

5. **Decorator pattern** maps perfectly to Express middleware and higher-order functions. Show you can compose behaviors.

6. **Builder pattern** shines in Node.js for query builders (Knex), test data factories, and configuration objects.

7. **Repository pattern** is essential for clean architecture. Demonstrate you understand the separation between domain logic and data access.

8. **Chain of Responsibility** IS Express middleware. If you understand middleware, you understand this pattern.

9. **Adapter pattern** is crucial for third-party integration. Show you can abstract over different provider APIs.

10. **Functional patterns often replace class-based patterns in JavaScript.** A factory function can replace Factory pattern, a closure can replace Singleton, and composed functions can replace Chain of Responsibility.

---

## Quick Reference / Cheat Sheet

```text
CREATIONAL PATTERNS
  Singleton          -> One instance globally (module export in Node.js)
  Factory            -> Create objects without specifying exact class
  Abstract Factory   -> Create families of related objects
  Builder            -> Step-by-step construction of complex objects

STRUCTURAL PATTERNS
  Adapter            -> Convert one interface to another
  Decorator          -> Add behavior dynamically (middleware, HOFs)
  Repository         -> Abstract data access behind collection-like interface

BEHAVIORAL PATTERNS
  Strategy           -> Swap algorithms at runtime (Passport, compression)
  Observer           -> Notify dependents of state changes (EventEmitter)
  Chain of Resp.     -> Pass request through handler chain (Express middleware)
  Command            -> Encapsulate operations as objects (undo/redo, queues)

PATTERN SELECTION GUIDE
  Need one instance?          -> Singleton (module export)
  Creating varied objects?    -> Factory / Abstract Factory
  Complex construction?       -> Builder
  Different algorithms?       -> Strategy
  Event notification?         -> Observer / EventEmitter
  Adding behavior?            -> Decorator / Middleware
  Processing pipeline?        -> Chain of Responsibility
  Undo/redo/queuing?          -> Command
  Incompatible interfaces?    -> Adapter
  Data access abstraction?    -> Repository

NODE.JS PATTERN MAPPING
  Express middleware       -> Chain of Responsibility + Decorator
  EventEmitter             -> Observer
  Module caching           -> Singleton
  Passport strategies      -> Strategy
  Knex query builder       -> Builder
  TypeORM repositories     -> Repository
  Payment integrations     -> Adapter + Strategy
  Bull job queue           -> Command
```
