/**
 * ============================================================================
 * FILE 5: DESIGN PATTERNS IN NODE.JS
 * ============================================================================
 *
 * A comprehensive guide to the most important design patterns for senior
 * Node.js engineers. Each pattern includes:
 *   - Problem statement: why the pattern exists
 *   - Implementation: idiomatic Node.js code
 *   - Usage demo: practical, runnable examples
 *
 * Run: node 05_design_patterns.js
 * ============================================================================
 */

'use strict';

// ---------------------------------------------------------------------------
// Helper: section printer
// ---------------------------------------------------------------------------
const section = (title) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(72));
};

// ===========================================================================
// 1. SINGLETON
// ===========================================================================
// Problem: You need exactly one instance of something across the entire app —
//   a database connection pool, a logger, a configuration object, etc.
//   Creating multiple instances wastes resources or causes inconsistency.
//
// In Node.js, `require()` caches modules by resolved filename, so every file
// that requires the same module gets the same exports object. This is a
// natural singleton mechanism. Below we also show a class-based approach.
// ===========================================================================

// --- 1a. Module-level singleton (the Node.js way) ---
// In a real app this would be in its own file, e.g. db.js
const createDatabaseConnection = (() => {
  let instance = null;

  return function getDatabaseConnection(config = {}) {
    if (!instance) {
      // Simulate expensive connection setup
      instance = Object.freeze({
        host: config.host ?? 'localhost',
        port: config.port ?? 5432,
        connected: true,
        query(sql) {
          return `[DB @ ${this.host}:${this.port}] Executing: ${sql}`;
        },
      });
      console.log('    [Singleton] New DB connection created');
    } else {
      console.log('    [Singleton] Returning cached DB connection');
    }
    return instance;
  };
})();

// --- 1b. Class-based singleton with private constructor pattern ---
class Logger {
  static #instance = null;

  #level;
  #logs = [];

  constructor(level = 'info') {
    if (Logger.#instance) {
      return Logger.#instance;
    }
    this.#level = level;
    Logger.#instance = this;
    console.log('    [Singleton] Logger instance created');
  }

  log(message) {
    const entry = `[${this.#level.toUpperCase()}] ${new Date().toISOString()} — ${message}`;
    this.#logs.push(entry);
    return entry;
  }

  getHistory() {
    return [...this.#logs];
  }

  // Allow resetting for tests
  static _reset() {
    Logger.#instance = null;
  }
}

// ===========================================================================
// 2. FACTORY & ABSTRACT FACTORY
// ===========================================================================
// Problem: You need to create objects without specifying the exact class.
//   The creation logic may depend on runtime conditions (config, user input,
//   environment). Factories encapsulate that decision.
// ===========================================================================

// --- 2a. Simple Factory ---
class InMemoryCache {
  #store = new Map();
  get(k) { return this.#store.get(k); }
  set(k, v) { this.#store.set(k, v); }
  toString() { return 'InMemoryCache'; }
}

class RedisCache {
  get(k) { return `[Redis] GET ${k}`; }
  set(k, v) { return `[Redis] SET ${k} = ${v}`; }
  toString() { return 'RedisCache (simulated)'; }
}

class FileCache {
  get(k) { return `[File] read(${k})`; }
  set(k, v) { return `[File] write(${k}, ${v})`; }
  toString() { return 'FileCache (simulated)'; }
}

function createCache(type = 'memory') {
  const caches = {
    memory: InMemoryCache,
    redis: RedisCache,
    file: FileCache,
  };
  const CacheClass = caches[type];
  if (!CacheClass) throw new Error(`Unknown cache type: ${type}`);
  return new CacheClass();
}

// --- 2b. Abstract Factory ---
// Produces families of related objects (e.g., UI components for different
// themes, or database drivers for different engines).
class PostgresFactory {
  createConnection() {
    return { type: 'pg', connect: () => 'Connected to PostgreSQL' };
  }
  createQueryBuilder() {
    return { build: (table) => `SELECT * FROM "${table}"` };
  }
}

class MySQLFactory {
  createConnection() {
    return { type: 'mysql', connect: () => 'Connected to MySQL' };
  }
  createQueryBuilder() {
    return { build: (table) => `SELECT * FROM \`${table}\`` };
  }
}

function getDatabaseFactory(engine = 'pg') {
  const factories = { pg: PostgresFactory, mysql: MySQLFactory };
  const Factory = factories[engine];
  if (!Factory) throw new Error(`Unsupported engine: ${engine}`);
  return new Factory();
}

// ===========================================================================
// 3. STRATEGY
// ===========================================================================
// Problem: You have multiple interchangeable algorithms for a task (payment
//   processing, sorting, compression, auth). Hard-coding them makes the
//   code rigid. Strategy lets you swap algorithms at runtime.
// ===========================================================================

// --- 3a. Payment processing strategies ---
const paymentStrategies = {
  creditCard: {
    name: 'Credit Card',
    process(amount) {
      const fee = amount * 0.029 + 0.30; // typical 2.9% + $0.30
      return { method: 'credit_card', amount, fee, total: amount + fee, status: 'charged' };
    },
  },
  paypal: {
    name: 'PayPal',
    process(amount) {
      const fee = amount * 0.0349 + 0.49;
      return { method: 'paypal', amount, fee, total: amount + fee, status: 'charged' };
    },
  },
  crypto: {
    name: 'Cryptocurrency',
    process(amount) {
      const fee = amount * 0.01; // flat 1%
      return { method: 'crypto', amount, fee, total: amount + fee, status: 'pending_confirmation' };
    },
  },
};

class PaymentProcessor {
  #strategy;

  constructor(strategyName) {
    this.setStrategy(strategyName);
  }

  setStrategy(name) {
    const strategy = paymentStrategies[name];
    if (!strategy) throw new Error(`Unknown payment strategy: ${name}`);
    this.#strategy = strategy;
  }

  checkout(amount) {
    console.log(`    Processing $${amount.toFixed(2)} via ${this.#strategy.name}...`);
    return this.#strategy.process(amount);
  }
}

// --- 3b. Sorting strategies ---
const sortStrategies = {
  alphabetical: (a, b) => a.name.localeCompare(b.name),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
};

function sortProducts(products, strategyName) {
  const comparator = sortStrategies[strategyName];
  if (!comparator) throw new Error(`Unknown sort: ${strategyName}`);
  return [...products].sort(comparator);
}

// ===========================================================================
// 4. OBSERVER / EVENT EMITTER
// ===========================================================================
// Problem: When something happens (user signup, order placed, file uploaded),
//   multiple parts of the system need to react. Tight coupling between the
//   trigger and the reactors is brittle. Observer decouples them.
//
// Node.js has EventEmitter built in — it IS the Observer pattern.
// ===========================================================================

const { EventEmitter } = require('events');

// --- 4a. Custom EventEmitter subclass ---
class OrderSystem extends EventEmitter {
  #orders = [];

  placeOrder(order) {
    const enriched = { ...order, id: this.#orders.length + 1, timestamp: Date.now() };
    this.#orders.push(enriched);
    // Notify all observers
    this.emit('order:placed', enriched);
    return enriched;
  }

  cancelOrder(id) {
    const order = this.#orders.find((o) => o.id === id);
    if (order) {
      order.status = 'cancelled';
      this.emit('order:cancelled', order);
    }
    return order;
  }
}

// --- 4b. Typed event emitter (safer pattern) ---
class TypedEventEmitter {
  #listeners = new Map();

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(listener);
    return this; // allow chaining
  }

  off(event, listener) {
    const arr = this.#listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
    return this;
  }

  emit(event, ...args) {
    const arr = this.#listeners.get(event) ?? [];
    for (const fn of arr) fn(...args);
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// ===========================================================================
// 5. DECORATOR
// ===========================================================================
// Problem: You want to add behavior (logging, timing, caching, auth checks)
//   to existing functions or objects WITHOUT modifying them. Decorator wraps
//   the original and augments it.
// ===========================================================================

// --- 5a. Function decorators (higher-order functions) ---
function withLogging(fn, label) {
  return function (...args) {
    console.log(`    [LOG] ${label ?? fn.name} called with:`, args);
    const result = fn.apply(this, args);
    console.log(`    [LOG] ${label ?? fn.name} returned:`, result);
    return result;
  };
}

function withTiming(fn, label) {
  return function (...args) {
    const start = performance.now();
    const result = fn.apply(this, args);
    const elapsed = (performance.now() - start).toFixed(3);
    console.log(`    [TIMER] ${label ?? fn.name} took ${elapsed}ms`);
    return result;
  };
}

function withRetry(fn, { retries = 3, delay = 100 } = {}) {
  return async function (...args) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (err) {
        lastError = err;
        console.log(`    [RETRY] Attempt ${attempt}/${retries} failed: ${err.message}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delay * attempt));
        }
      }
    }
    throw lastError;
  };
}

// --- 5b. Object decorator (wrapping an object) ---
function withCaching(repository, ttlMs = 5000) {
  const cache = new Map();

  return new Proxy(repository, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== 'function') return original;

      if (prop.startsWith('get') || prop.startsWith('find')) {
        return function (...args) {
          const key = `${prop}:${JSON.stringify(args)}`;
          const cached = cache.get(key);
          if (cached && Date.now() - cached.time < ttlMs) {
            console.log(`    [CACHE HIT] ${key}`);
            return cached.value;
          }
          console.log(`    [CACHE MISS] ${key}`);
          const result = original.apply(target, args);
          cache.set(key, { value: result, time: Date.now() });
          return result;
        };
      }
      return original.bind(target);
    },
  });
}

// ===========================================================================
// 6. BUILDER
// ===========================================================================
// Problem: Constructing complex objects with many optional parameters leads
//   to telescoping constructors or confusing config objects. Builder provides
//   a fluent API that assembles the object step by step.
// ===========================================================================

// --- 6a. Query Builder ---
class QueryBuilder {
  #table = '';
  #conditions = [];
  #columns = ['*'];
  #orderBy = [];
  #limitVal = null;
  #offsetVal = null;
  #joins = [];

  static from(table) {
    const qb = new QueryBuilder();
    qb.#table = table;
    return qb;
  }

  select(...cols) {
    this.#columns = cols.length ? cols : ['*'];
    return this;
  }

  where(condition, ...params) {
    // Simple parameterization: replace ? with param values
    let filled = condition;
    for (const p of params) {
      filled = filled.replace('?', typeof p === 'string' ? `'${p}'` : String(p));
    }
    this.#conditions.push(filled);
    return this;
  }

  join(table, on) {
    this.#joins.push(`JOIN ${table} ON ${on}`);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this.#orderBy.push(`${column} ${direction}`);
    return this;
  }

  limit(n) {
    this.#limitVal = n;
    return this;
  }

  offset(n) {
    this.#offsetVal = n;
    return this;
  }

  build() {
    const parts = [`SELECT ${this.#columns.join(', ')} FROM ${this.#table}`];
    if (this.#joins.length) parts.push(this.#joins.join(' '));
    if (this.#conditions.length) parts.push(`WHERE ${this.#conditions.join(' AND ')}`);
    if (this.#orderBy.length) parts.push(`ORDER BY ${this.#orderBy.join(', ')}`);
    if (this.#limitVal !== null) parts.push(`LIMIT ${this.#limitVal}`);
    if (this.#offsetVal !== null) parts.push(`OFFSET ${this.#offsetVal}`);
    return parts.join(' ');
  }
}

// --- 6b. HTTP Request Builder ---
class RequestBuilder {
  #method = 'GET';
  #url = '';
  #headers = {};
  #body = null;
  #timeout = 30_000;
  #retries = 0;

  static to(url) {
    const rb = new RequestBuilder();
    rb.#url = url;
    return rb;
  }

  method(m) { this.#method = m.toUpperCase(); return this; }
  get() { return this.method('GET'); }
  post() { return this.method('POST'); }
  put() { return this.method('PUT'); }
  delete() { return this.method('DELETE'); }

  header(key, value) { this.#headers[key] = value; return this; }
  bearerToken(token) { return this.header('Authorization', `Bearer ${token}`); }
  contentType(ct) { return this.header('Content-Type', ct); }

  json(data) {
    this.#body = JSON.stringify(data);
    return this.contentType('application/json');
  }

  timeout(ms) { this.#timeout = ms; return this; }
  retries(n) { this.#retries = n; return this; }

  build() {
    return Object.freeze({
      method: this.#method,
      url: this.#url,
      headers: { ...this.#headers },
      body: this.#body,
      timeout: this.#timeout,
      retries: this.#retries,
    });
  }
}

// ===========================================================================
// 7. REPOSITORY
// ===========================================================================
// Problem: Business logic should not care about WHERE data lives (Postgres,
//   MongoDB, in-memory, file, API). Repository abstracts the storage layer
//   behind a consistent interface. Enables testing with in-memory stores
//   and swapping databases without changing business code.
// ===========================================================================

// --- Repository interface (duck-typed in JS) ---
class InMemoryUserRepository {
  #users = new Map();
  #nextId = 1;

  async findById(id) {
    return this.#users.get(id) ?? null;
  }

  async findAll(filter = {}) {
    let results = [...this.#users.values()];
    if (filter.role) results = results.filter((u) => u.role === filter.role);
    if (filter.active !== undefined) results = results.filter((u) => u.active === filter.active);
    return results;
  }

  async create(data) {
    const user = { id: this.#nextId++, ...data, createdAt: new Date().toISOString() };
    this.#users.set(user.id, user);
    return user;
  }

  async update(id, data) {
    const existing = this.#users.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.#users.set(id, updated);
    return updated;
  }

  async delete(id) {
    return this.#users.delete(id);
  }
}

// --- Service that depends only on the repository interface ---
class UserService {
  #repo;

  constructor(repository) {
    this.#repo = repository;
  }

  async registerUser(name, email, role = 'user') {
    // Business logic: validate, then delegate to repo
    if (!name || !email) throw new Error('Name and email are required');
    if (!email.includes('@')) throw new Error('Invalid email');
    return this.#repo.create({ name, email, role, active: true });
  }

  async deactivateUser(id) {
    const user = await this.#repo.findById(id);
    if (!user) throw new Error(`User ${id} not found`);
    return this.#repo.update(id, { active: false });
  }

  async getActiveUsers() {
    return this.#repo.findAll({ active: true });
  }
}

// ===========================================================================
// 8. CHAIN OF RESPONSIBILITY
// ===========================================================================
// Problem: A request must pass through multiple processing steps (validation,
//   authentication, authorization, rate-limiting, logging). Each step either
//   handles it, transforms it, or passes it along. This is exactly how
//   Express/Koa middleware works.
// ===========================================================================

// --- 8a. Classic middleware pipeline ---
class MiddlewarePipeline {
  #middlewares = [];

  use(fn) {
    this.#middlewares.push(fn);
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

// Individual middleware functions
function authMiddleware(ctx, next) {
  if (!ctx.headers?.authorization) {
    ctx.status = 401;
    ctx.body = 'Unauthorized';
    return; // do NOT call next — halt the chain
  }
  ctx.user = { id: 1, name: 'Alice', role: 'admin' };
  console.log('    [MW] Auth passed');
  return next();
}

function roleMiddleware(...allowedRoles) {
  return function (ctx, next) {
    if (!allowedRoles.includes(ctx.user?.role)) {
      ctx.status = 403;
      ctx.body = 'Forbidden';
      return;
    }
    console.log(`    [MW] Role check passed (${ctx.user.role})`);
    return next();
  };
}

function rateLimitMiddleware(maxRequests = 5) {
  const requests = new Map();
  return function (ctx, next) {
    const ip = ctx.ip ?? '127.0.0.1';
    const count = (requests.get(ip) ?? 0) + 1;
    requests.set(ip, count);
    if (count > maxRequests) {
      ctx.status = 429;
      ctx.body = 'Too Many Requests';
      return;
    }
    console.log(`    [MW] Rate limit OK (${count}/${maxRequests})`);
    return next();
  };
}

async function loggingMiddleware(ctx, next) {
  const start = Date.now();
  await next();
  const elapsed = Date.now() - start;
  console.log(`    [MW] ${ctx.method} ${ctx.path} — ${elapsed}ms`);
}

// --- 8b. Simpler linked-list chain ---
class Handler {
  #nextHandler = null;

  setNext(handler) {
    this.#nextHandler = handler;
    return handler; // allow chaining: a.setNext(b).setNext(c)
  }

  handle(request) {
    if (this.#nextHandler) return this.#nextHandler.handle(request);
    return null;
  }
}

class ValidationHandler extends Handler {
  handle(request) {
    if (!request.body || Object.keys(request.body).length === 0) {
      return { error: 'Validation failed: empty body' };
    }
    console.log('    [Chain] Validation passed');
    return super.handle(request);
  }
}

class SanitizationHandler extends Handler {
  handle(request) {
    // Strip HTML tags from all string fields
    for (const [key, val] of Object.entries(request.body)) {
      if (typeof val === 'string') {
        request.body[key] = val.replace(/<[^>]*>/g, '');
      }
    }
    console.log('    [Chain] Sanitization done');
    return super.handle(request);
  }
}

class PersistenceHandler extends Handler {
  handle(request) {
    console.log('    [Chain] Data persisted:', request.body);
    return { success: true, data: request.body };
  }
}

// ===========================================================================
// 9. COMMAND
// ===========================================================================
// Problem: You want to parameterize operations, queue them, support undo/redo,
//   or log every action. The Command pattern encapsulates an operation as an
//   object with execute() and undo() methods.
// ===========================================================================

class TextEditor {
  #content = '';
  #history = [];     // executed commands (for undo)
  #redoStack = [];   // undone commands (for redo)

  get content() { return this.#content; }

  execute(command) {
    command.execute(this);
    this.#history.push(command);
    this.#redoStack.length = 0; // clear redo after new action
  }

  undo() {
    const command = this.#history.pop();
    if (command) {
      command.undo(this);
      this.#redoStack.push(command);
    }
  }

  redo() {
    const command = this.#redoStack.pop();
    if (command) {
      command.execute(this);
      this.#history.push(command);
    }
  }

  // Low-level mutators (used by commands)
  _setContent(value) { this.#content = value; }
  _getContent() { return this.#content; }
}

class InsertTextCommand {
  #text;
  #position;

  constructor(text, position = -1) {
    this.#text = text;
    this.#position = position;
  }

  execute(editor) {
    const current = editor._getContent();
    const pos = this.#position === -1 ? current.length : this.#position;
    editor._setContent(current.slice(0, pos) + this.#text + current.slice(pos));
  }

  undo(editor) {
    const current = editor._getContent();
    const pos = this.#position === -1 ? current.length - this.#text.length : this.#position;
    editor._setContent(current.slice(0, pos) + current.slice(pos + this.#text.length));
  }
}

class DeleteTextCommand {
  #position;
  #length;
  #deleted = '';

  constructor(position, length) {
    this.#position = position;
    this.#length = length;
  }

  execute(editor) {
    const current = editor._getContent();
    this.#deleted = current.slice(this.#position, this.#position + this.#length);
    editor._setContent(current.slice(0, this.#position) + current.slice(this.#position + this.#length));
  }

  undo(editor) {
    const current = editor._getContent();
    editor._setContent(current.slice(0, this.#position) + this.#deleted + current.slice(this.#position));
  }
}

// --- 9b. Task queue using command pattern ---
class TaskQueue {
  #queue = [];
  #results = [];
  #running = false;

  enqueue(command) {
    this.#queue.push(command);
  }

  async processAll() {
    this.#running = true;
    while (this.#queue.length > 0) {
      const cmd = this.#queue.shift();
      try {
        const result = await cmd.execute();
        this.#results.push({ status: 'fulfilled', value: result });
      } catch (err) {
        this.#results.push({ status: 'rejected', reason: err.message });
      }
    }
    this.#running = false;
    return this.#results;
  }

  get pending() { return this.#queue.length; }
  get results() { return [...this.#results]; }
}

// ===========================================================================
// 10. ADAPTER
// ===========================================================================
// Problem: You need to integrate with a third-party library or legacy system
//   whose interface doesn't match what your code expects. An Adapter wraps
//   the incompatible interface and translates calls.
// ===========================================================================

// --- Legacy payment gateway (incompatible interface) ---
class LegacyPaymentGateway {
  submitPayment(xmlPayload) {
    // Simulates processing XML
    return `<response><status>OK</status><ref>LGW-${Date.now()}</ref></response>`;
  }

  queryStatus(referenceId) {
    return `<response><status>COMPLETED</status><ref>${referenceId}</ref></response>`;
  }
}

// --- New payment gateway (the interface our app expects) ---
// interface ModernPaymentGateway {
//   charge(amount: number, currency: string, card: object): Promise<{success, transactionId}>
//   getStatus(transactionId: string): Promise<{status}>
// }

// --- Adapter ---
class LegacyPaymentAdapter {
  #legacy;

  constructor() {
    this.#legacy = new LegacyPaymentGateway();
  }

  async charge(amount, currency, card) {
    // Convert JSON to "XML"
    const xml = `<payment><amount>${amount}</amount><currency>${currency}</currency><card>${card.number}</card></payment>`;
    const response = this.#legacy.submitPayment(xml);

    // Parse "XML" response
    const refMatch = response.match(/<ref>(.*?)<\/ref>/);
    const statusMatch = response.match(/<status>(.*?)<\/status>/);

    return {
      success: statusMatch?.[1] === 'OK',
      transactionId: refMatch?.[1] ?? null,
    };
  }

  async getStatus(transactionId) {
    const response = this.#legacy.queryStatus(transactionId);
    const statusMatch = response.match(/<status>(.*?)<\/status>/);
    return {
      status: statusMatch?.[1]?.toLowerCase() ?? 'unknown',
    };
  }
}

// --- Another adapter example: logging ---
// Old logger uses .write(level, msg); new code expects .info(), .error(), etc.
class OldLogger {
  write(level, message) {
    return `[${level}] ${message}`;
  }
}

class LoggerAdapter {
  #oldLogger;

  constructor(oldLogger) {
    this.#oldLogger = oldLogger;
  }

  info(msg) { return this.#oldLogger.write('INFO', msg); }
  warn(msg) { return this.#oldLogger.write('WARN', msg); }
  error(msg) { return this.#oldLogger.write('ERROR', msg); }
  debug(msg) { return this.#oldLogger.write('DEBUG', msg); }
}

// ===========================================================================
// DEMO / TEST SECTION
// ===========================================================================

async function runDemos() {
  // ---- 1. Singleton ----
  section('1. SINGLETON');

  const db1 = createDatabaseConnection({ host: 'db.example.com', port: 5432 });
  const db2 = createDatabaseConnection(); // returns cached
  console.log(`  Same instance? ${db1 === db2}`); // true
  console.log(`  ${db1.query('SELECT NOW()')}`);

  const log1 = new Logger('debug');
  const log2 = new Logger('info'); // returns existing instance
  console.log(`  Same Logger? ${log1 === log2}`); // true
  console.log(`  ${log1.log('Application started')}`);
  Logger._reset();

  // ---- 2. Factory & Abstract Factory ----
  section('2. FACTORY & ABSTRACT FACTORY');

  console.log('  Simple Factory:');
  for (const type of ['memory', 'redis', 'file']) {
    const cache = createCache(type);
    console.log(`    createCache('${type}') -> ${cache}`);
  }

  console.log('\n  Abstract Factory:');
  for (const engine of ['pg', 'mysql']) {
    const factory = getDatabaseFactory(engine);
    const conn = factory.createConnection();
    const qb = factory.createQueryBuilder();
    console.log(`    [${engine}] ${conn.connect()}`);
    console.log(`    [${engine}] ${qb.build('users')}`);
  }

  // ---- 3. Strategy ----
  section('3. STRATEGY');

  console.log('  Payment strategies:');
  const processor = new PaymentProcessor('creditCard');
  console.log('   ', processor.checkout(100.00));

  processor.setStrategy('paypal');
  console.log('   ', processor.checkout(100.00));

  processor.setStrategy('crypto');
  console.log('   ', processor.checkout(100.00));

  console.log('\n  Sorting strategies:');
  const products = [
    { name: 'Laptop', price: 999, rating: 4.5 },
    { name: 'Mouse', price: 29, rating: 4.8 },
    { name: 'Keyboard', price: 79, rating: 4.2 },
    { name: 'Monitor', price: 399, rating: 4.7 },
  ];
  for (const strategy of ['alphabetical', 'price_asc', 'rating']) {
    const sorted = sortProducts(products, strategy);
    console.log(`    [${strategy}]:`, sorted.map((p) => `${p.name}($${p.price})`).join(', '));
  }

  // ---- 4. Observer / EventEmitter ----
  section('4. OBSERVER / EVENT EMITTER');

  const orderSystem = new OrderSystem();

  // Register observers
  orderSystem.on('order:placed', (order) =>
    console.log(`    [Email] Confirmation sent for order #${order.id}`)
  );
  orderSystem.on('order:placed', (order) =>
    console.log(`    [Inventory] Reserved items for order #${order.id}`)
  );
  orderSystem.on('order:placed', (order) =>
    console.log(`    [Analytics] Tracked order #${order.id} — $${order.total}`)
  );
  orderSystem.on('order:cancelled', (order) =>
    console.log(`    [Refund] Processing refund for order #${order.id}`)
  );

  const order1 = orderSystem.placeOrder({ items: ['widget'], total: 49.99 });
  orderSystem.cancelOrder(order1.id);

  console.log('\n  Typed EventEmitter:');
  const bus = new TypedEventEmitter();
  bus.on('message', (msg) => console.log(`    Received: ${msg}`));
  bus.once('message', (msg) => console.log(`    (once) Got: ${msg}`));
  bus.emit('message', 'Hello');
  bus.emit('message', 'World'); // "once" handler won't fire again

  // ---- 5. Decorator ----
  section('5. DECORATOR');

  console.log('  Function decorators:');
  const add = (a, b) => a + b;
  const loggedAdd = withLogging(add, 'add');
  const timedAdd = withTiming(add, 'add');
  loggedAdd(3, 4);
  timedAdd(3, 4);

  console.log('\n  Retry decorator:');
  let attemptCount = 0;
  const flaky = async () => {
    attemptCount++;
    if (attemptCount < 3) throw new Error('Service unavailable');
    return 'Success on attempt ' + attemptCount;
  };
  const resilient = withRetry(flaky, { retries: 3, delay: 50 });
  const retryResult = await resilient();
  console.log(`    Final result: ${retryResult}`);

  console.log('\n  Object decorator (caching proxy):');
  const repo = new InMemoryUserRepository();
  await repo.create({ name: 'Alice', email: 'alice@test.com', role: 'admin', active: true });
  const cachedRepo = withCaching(repo, 10_000);
  await cachedRepo.findById(1); // cache miss
  await cachedRepo.findById(1); // cache hit

  // ---- 6. Builder ----
  section('6. BUILDER');

  console.log('  Query Builder:');
  const query = QueryBuilder.from('users')
    .select('id', 'name', 'email')
    .where('active = ?', true)
    .where('role = ?', 'admin')
    .join('orders', 'orders.user_id = users.id')
    .orderBy('name')
    .limit(10)
    .offset(20)
    .build();
  console.log(`    ${query}`);

  console.log('\n  Request Builder:');
  const request = RequestBuilder.to('https://api.example.com/users')
    .post()
    .bearerToken('eyJhbGciOiJIUzI1NiJ9...')
    .json({ name: 'Bob', email: 'bob@test.com' })
    .timeout(5000)
    .retries(2)
    .build();
  console.log('   ', request);

  // ---- 7. Repository ----
  section('7. REPOSITORY');

  const userRepo = new InMemoryUserRepository();
  const userService = new UserService(userRepo);

  const alice = await userService.registerUser('Alice', 'alice@example.com', 'admin');
  const bob = await userService.registerUser('Bob', 'bob@example.com');
  console.log('  Registered:', alice);
  console.log('  Registered:', bob);

  const active = await userService.getActiveUsers();
  console.log(`  Active users: ${active.length}`);

  await userService.deactivateUser(bob.id);
  const activeAfter = await userService.getActiveUsers();
  console.log(`  Active after deactivation: ${activeAfter.length}`);

  // ---- 8. Chain of Responsibility ----
  section('8. CHAIN OF RESPONSIBILITY');

  console.log('  Middleware pipeline:');
  const pipeline = new MiddlewarePipeline();
  pipeline
    .use(rateLimitMiddleware(10))
    .use(authMiddleware)
    .use(roleMiddleware('admin', 'editor'));

  const ctx = {
    method: 'GET',
    path: '/admin/users',
    headers: { authorization: 'Bearer token123' },
    ip: '192.168.1.1',
  };
  await pipeline.execute(ctx);
  console.log(`    Final context status: ${ctx.status ?? 'OK'}`);

  console.log('\n  Linked-list chain:');
  const validation = new ValidationHandler();
  const sanitization = new SanitizationHandler();
  const persistence = new PersistenceHandler();
  validation.setNext(sanitization).setNext(persistence);

  const chainResult = validation.handle({
    body: { name: 'Bob <script>alert("xss")</script>', age: 30 },
  });
  console.log('    Result:', chainResult);

  // ---- 9. Command ----
  section('9. COMMAND (Undo/Redo)');

  const editor = new TextEditor();
  console.log('  Building text with commands:');

  editor.execute(new InsertTextCommand('Hello'));
  console.log(`    After insert "Hello":    "${editor.content}"`);

  editor.execute(new InsertTextCommand(' World'));
  console.log(`    After insert " World":   "${editor.content}"`);

  editor.execute(new InsertTextCommand(' Beautiful', 5));
  console.log(`    After insert at pos 5:   "${editor.content}"`);

  editor.execute(new DeleteTextCommand(5, 10));
  console.log(`    After delete 10 @ pos 5: "${editor.content}"`);

  editor.undo();
  console.log(`    After undo:              "${editor.content}"`);

  editor.undo();
  console.log(`    After undo:              "${editor.content}"`);

  editor.redo();
  console.log(`    After redo:              "${editor.content}"`);

  console.log('\n  Task Queue:');
  const taskQueue = new TaskQueue();
  taskQueue.enqueue({ execute: async () => 'Task A done' });
  taskQueue.enqueue({ execute: async () => 'Task B done' });
  taskQueue.enqueue({
    execute: async () => {
      throw new Error('Task C failed');
    },
  });
  const queueResults = await taskQueue.processAll();
  console.log('    Results:', queueResults);

  // ---- 10. Adapter ----
  section('10. ADAPTER');

  console.log('  Legacy payment gateway adapter:');
  const gateway = new LegacyPaymentAdapter();
  const chargeResult = await gateway.charge(99.99, 'USD', { number: '4111111111111111' });
  console.log('    Charge:', chargeResult);

  if (chargeResult.transactionId) {
    const statusResult = await gateway.getStatus(chargeResult.transactionId);
    console.log('    Status:', statusResult);
  }

  console.log('\n  Logger adapter:');
  const oldLog = new OldLogger();
  const newLog = new LoggerAdapter(oldLog);
  console.log(`    ${newLog.info('Server started')}`);
  console.log(`    ${newLog.error('Disk full')}`);
  console.log(`    ${newLog.debug('Variable x = 42')}`);

  // ---- Summary ----
  section('SUMMARY');
  console.log(`
  Pattern               | When to Use
  ----------------------|------------------------------------------------
  Singleton             | Shared resource (DB pool, config, logger)
  Factory               | Object creation depends on runtime conditions
  Abstract Factory      | Families of related objects
  Strategy              | Interchangeable algorithms at runtime
  Observer / EE         | Decouple event producers from consumers
  Decorator             | Add behavior without modifying originals
  Builder               | Complex object construction with many options
  Repository            | Abstract data access from business logic
  Chain of Resp.        | Sequential processing pipeline (middleware)
  Command               | Encapsulate operations (undo, queuing, logging)
  Adapter               | Integrate incompatible interfaces
  `);
}

runDemos().catch(console.error);
