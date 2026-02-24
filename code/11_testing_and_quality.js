/**
 * =============================================================================
 * FILE 11: TESTING PATTERNS AND CODE QUALITY
 * =============================================================================
 *
 * Senior Node.js Interview Prep
 * Runnable: node 11_testing_and_quality.js
 *
 * Topics covered:
 *   1.  Testing pyramid: unit, integration, e2e
 *   2.  Jest patterns: describe/it/expect, beforeEach/afterEach
 *   3.  Mocking: jest.fn(), jest.mock(), manual mocks, spies
 *   4.  Testing async code
 *   5.  Supertest for HTTP testing patterns
 *   6.  Fixture patterns and test factories
 *   7.  Test doubles: stub, mock, spy, fake
 *   8.  AAA pattern (Arrange, Act, Assert)
 *   9.  Property-based testing concepts (fast-check style)
 *  10.  Code coverage concepts
 *  11.  TDD workflow
 *  12.  Testing event-driven code
 *  13.  Snapshot testing
 *  14.  Code quality: ESLint, Prettier, husky, lint-staged
 *  15.  CI/CD testing strategies
 *
 * NOTE: We build a minimal test runner that mirrors Jest's API shape,
 *       so all patterns are demonstrated without requiring jest installed.
 */

'use strict';

const { EventEmitter } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');

// =============================================================================
// SECTION 1: MINI TEST FRAMEWORK (Jest-like API)
// =============================================================================
//
// This simulates Jest's describe/it/expect/beforeEach/afterEach so we can
// demonstrate real testing patterns without any external dependency.

const testResults = { passed: 0, failed: 0, skipped: 0, suites: [] };

class AssertionError extends Error {
  constructor(message, expected, received) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.received = received;
  }
}

/**
 * Expect-style assertion builder (mirrors Jest's expect API).
 */
function expect(received) {
  const matchers = {
    toBe(expected) {
      if (received !== expected) {
        throw new AssertionError(
          `Expected ${JSON.stringify(expected)} but received ${JSON.stringify(received)}`,
          expected, received
        );
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(received);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new AssertionError(`Expected deep equal\n  Expected: ${b}\n  Received: ${a}`, expected, received);
      }
    },
    toBeGreaterThan(expected) {
      if (!(received > expected)) {
        throw new AssertionError(`Expected ${received} > ${expected}`, expected, received);
      }
    },
    toBeLessThan(expected) {
      if (!(received < expected)) {
        throw new AssertionError(`Expected ${received} < ${expected}`, expected, received);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(received >= expected)) {
        throw new AssertionError(`Expected ${received} >= ${expected}`, expected, received);
      }
    },
    toBeTruthy() {
      if (!received) {
        throw new AssertionError(`Expected truthy but received ${JSON.stringify(received)}`);
      }
    },
    toBeFalsy() {
      if (received) {
        throw new AssertionError(`Expected falsy but received ${JSON.stringify(received)}`);
      }
    },
    toBeNull() {
      if (received !== null) {
        throw new AssertionError(`Expected null but received ${JSON.stringify(received)}`);
      }
    },
    toBeUndefined() {
      if (received !== undefined) {
        throw new AssertionError(`Expected undefined but received ${JSON.stringify(received)}`);
      }
    },
    toBeDefined() {
      if (received === undefined) {
        throw new AssertionError(`Expected defined but received undefined`);
      }
    },
    toBeInstanceOf(expected) {
      if (!(received instanceof expected)) {
        throw new AssertionError(`Expected instance of ${expected.name}`);
      }
    },
    toContain(expected) {
      const has = Array.isArray(received) ? received.includes(expected) : String(received).includes(expected);
      if (!has) {
        throw new AssertionError(`Expected ${JSON.stringify(received)} to contain ${JSON.stringify(expected)}`);
      }
    },
    toHaveLength(expected) {
      if (received.length !== expected) {
        throw new AssertionError(`Expected length ${expected} but received ${received.length}`);
      }
    },
    toThrow(expectedMessage) {
      if (typeof received !== 'function') {
        throw new AssertionError('Expected a function for toThrow');
      }
      let threw = false;
      let thrownError;
      try { received(); } catch (e) { threw = true; thrownError = e; }
      if (!threw) throw new AssertionError('Expected function to throw');
      if (expectedMessage && !thrownError.message.includes(expectedMessage)) {
        throw new AssertionError(
          `Expected throw message to include "${expectedMessage}" but got "${thrownError.message}"`
        );
      }
    },
    async toReject(expectedMessage) {
      if (typeof received !== 'function') {
        throw new AssertionError('Expected a function for toReject');
      }
      let threw = false;
      let thrownError;
      try { await received(); } catch (e) { threw = true; thrownError = e; }
      if (!threw) throw new AssertionError('Expected function to reject');
      if (expectedMessage && !thrownError.message.includes(expectedMessage)) {
        throw new AssertionError(
          `Expected rejection message to include "${expectedMessage}" but got "${thrownError.message}"`
        );
      }
    },
    toMatchObject(expected) {
      for (const [key, val] of Object.entries(expected)) {
        if (JSON.stringify(received[key]) !== JSON.stringify(val)) {
          throw new AssertionError(
            `Expected property ${key} to be ${JSON.stringify(val)} but got ${JSON.stringify(received[key])}`
          );
        }
      }
    },
    toHaveBeenCalled() {
      if (!received._isMockFn || received.calls.length === 0) {
        throw new AssertionError('Expected mock function to have been called');
      }
    },
    toHaveBeenCalledTimes(expected) {
      if (!received._isMockFn || received.calls.length !== expected) {
        throw new AssertionError(
          `Expected ${expected} calls but received ${received._isMockFn ? received.calls.length : 'non-mock'}`
        );
      }
    },
    toHaveBeenCalledWith(...expectedArgs) {
      if (!received._isMockFn) throw new AssertionError('Expected a mock function');
      const found = received.calls.some(
        (callArgs) => JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
      );
      if (!found) {
        throw new AssertionError(
          `Expected mock to have been called with ${JSON.stringify(expectedArgs)}`
        );
      }
    },
    toMatchSnapshot(snapshotStore, snapshotKey) {
      // Simplified snapshot testing
      const serialized = JSON.stringify(received, null, 2);
      if (!snapshotStore.has(snapshotKey)) {
        snapshotStore.set(snapshotKey, serialized);
        return; // First run: snapshot created
      }
      const existing = snapshotStore.get(snapshotKey);
      if (serialized !== existing) {
        throw new AssertionError(
          `Snapshot mismatch for "${snapshotKey}"\n  Expected: ${existing}\n  Received: ${serialized}`
        );
      }
    },
  };

  // Support .not.toBe(...) etc.
  const not = {};
  for (const [name, fn] of Object.entries(matchers)) {
    not[name] = (...args) => {
      let threw = false;
      try { fn(...args); } catch { threw = true; }
      if (!threw) {
        throw new AssertionError(`Expected .not.${name} to fail but it passed`);
      }
    };
  }

  return { ...matchers, not };
}

/**
 * Mock function factory (mirrors jest.fn()).
 */
function fn(implementation) {
  const mockFn = (...args) => {
    mockFn.calls.push(args);
    if (mockFn._implementation) {
      const result = mockFn._implementation(...args);
      mockFn.results.push({ type: 'return', value: result });
      return result;
    }
    mockFn.results.push({ type: 'return', value: undefined });
    return undefined;
  };

  mockFn._isMockFn = true;
  mockFn.calls = [];
  mockFn.results = [];
  mockFn._implementation = implementation || null;

  mockFn.mockReturnValue = (val) => {
    mockFn._implementation = () => val;
    return mockFn;
  };
  mockFn.mockReturnValueOnce = (val) => {
    const orig = mockFn._implementation;
    let called = false;
    mockFn._implementation = (...a) => {
      if (!called) { called = true; return val; }
      return orig ? orig(...a) : undefined;
    };
    return mockFn;
  };
  mockFn.mockImplementation = (impl) => {
    mockFn._implementation = impl;
    return mockFn;
  };
  mockFn.mockReset = () => {
    mockFn.calls = [];
    mockFn.results = [];
    mockFn._implementation = null;
  };
  mockFn.mockClear = () => {
    mockFn.calls = [];
    mockFn.results = [];
  };

  return mockFn;
}

/**
 * Spy factory - wraps an existing method to track calls while preserving behavior.
 */
function spyOn(obj, method) {
  const original = obj[method];
  const spy = fn((...args) => original.apply(obj, args));
  spy._original = original;
  spy.restore = () => { obj[method] = original; };
  obj[method] = spy;
  return spy;
}

// ── describe / it / hooks ────────────────────────────────────────────────

const suiteStack = [];
let currentSuite = null;

function describe(name, callback) {
  const suite = {
    name,
    tests: [],
    beforeEachFns: [],
    afterEachFns: [],
    beforeAllFns: [],
    afterAllFns: [],
    children: [],
    parent: currentSuite,
  };

  if (currentSuite) {
    currentSuite.children.push(suite);
  }

  suiteStack.push(currentSuite);
  currentSuite = suite;
  callback();
  currentSuite = suiteStack.pop();

  if (!currentSuite) {
    // Top-level suite: store for execution
    testResults.suites.push(suite);
  }
}

function it(name, testFn) {
  if (!currentSuite) throw new Error('it() must be inside describe()');
  currentSuite.tests.push({ name, testFn });
}
// Alias
const test = it;

function beforeEach(fn) { currentSuite.beforeEachFns.push(fn); }
function afterEach(fn) { currentSuite.afterEachFns.push(fn); }
function beforeAll(fn) { currentSuite.beforeAllFns.push(fn); }
function afterAll(fn) { currentSuite.afterAllFns.push(fn); }

/**
 * Execute all registered test suites.
 */
async function runTests() {
  for (const suite of testResults.suites) {
    await runSuite(suite, 0);
  }
}

async function runSuite(suite, depth) {
  const indent = '  '.repeat(depth + 1);
  console.log(`${indent}${suite.name}`);

  // beforeAll
  for (const fn of suite.beforeAllFns) await fn();

  // Run tests
  for (const test of suite.tests) {
    // Collect all beforeEach from ancestor suites
    const beforeFns = collectHooks(suite, 'beforeEachFns');
    const afterFns = collectHooks(suite, 'afterEachFns');

    for (const fn of beforeFns) await fn();

    try {
      await test.testFn();
      testResults.passed++;
      console.log(`${indent}  PASS  ${test.name}`);
    } catch (err) {
      testResults.failed++;
      console.log(`${indent}  FAIL  ${test.name}`);
      console.log(`${indent}        ${err.message}`);
    }

    for (const fn of afterFns) await fn();
  }

  // Run child suites
  for (const child of suite.children) {
    await runSuite(child, depth + 1);
  }

  // afterAll
  for (const fn of suite.afterAllFns) await fn();
}

function collectHooks(suite, hookName) {
  const hooks = [];
  let s = suite;
  while (s) {
    hooks.unshift(...s[hookName]);
    s = s.parent;
  }
  return hooks;
}

// =============================================================================
// SECTION 2: CODE UNDER TEST (sample application code)
// =============================================================================

/**
 * UserService - business logic to test.
 */
class UserService {
  constructor(userRepository, emailService, logger) {
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.logger = logger;
  }

  async createUser(data) {
    // Validate
    if (!data.email || !data.name) {
      throw new Error('Name and email are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Check for duplicates
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // Create
    const user = await this.userRepository.create({
      id: `user_${Date.now()}`,
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString(),
    });

    // Side effects
    await this.emailService.sendWelcome(user.email, user.name);
    this.logger.info(`User created: ${user.id}`);

    return user;
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async deactivateUser(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new Error('User not found');
    user.active = false;
    await this.userRepository.update(user);
    await this.emailService.sendDeactivationNotice(user.email);
    return user;
  }
}

/**
 * ShoppingCart - synchronous logic for unit testing.
 */
class ShoppingCart {
  constructor() {
    this.items = [];
  }

  addItem(product, quantity = 1) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (product.price < 0) throw new Error('Price cannot be negative');

    const existing = this.items.find((i) => i.product.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({ product, quantity });
    }
  }

  removeItem(productId) {
    const idx = this.items.findIndex((i) => i.product.id === productId);
    if (idx === -1) throw new Error('Item not in cart');
    this.items.splice(idx, 1);
  }

  getTotal() {
    return this.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  clear() {
    this.items = [];
  }

  applyDiscount(percentage) {
    if (percentage < 0 || percentage > 100) throw new Error('Invalid discount');
    const total = this.getTotal();
    return total * (1 - percentage / 100);
  }
}

/**
 * EventProcessor - for testing event-driven code.
 */
class EventProcessor extends EventEmitter {
  constructor() {
    super();
    this.processedEvents = [];
  }

  async process(event) {
    this.emit('processing', event);
    // Simulate async work
    await sleep(10);
    const result = { ...event, processedAt: Date.now(), status: 'processed' };
    this.processedEvents.push(result);
    this.emit('processed', result);
    return result;
  }

  async processBatch(events) {
    const results = [];
    for (const event of events) {
      try {
        results.push(await this.process(event));
      } catch (err) {
        this.emit('error', err);
      }
    }
    return results;
  }
}

// =============================================================================
// SECTION 3: TEST DOUBLES EXPLAINED
// =============================================================================
//
// Test doubles replace real dependencies in tests. Five types:
//
// 1. Dummy  - Passed around but never used. Satisfies a parameter.
//             Example: fn(dummyLogger) where logger is never called.
//
// 2. Stub   - Returns predefined values. No behavior verification.
//             Example: userRepo.findById = () => ({ id: '1', name: 'Alice' })
//
// 3. Spy    - Records calls for later verification. May delegate to real impl.
//             Example: spyOn(service, 'save') then check spy.calls
//
// 4. Mock   - Like spy but with pre-programmed expectations.
//             Example: mock.expects('save').once().withArgs(user)
//
// 5. Fake   - Working implementation but unsuitable for production.
//             Example: InMemoryDatabase instead of real PostgreSQL

/** Fake repository (in-memory implementation). */
class FakeUserRepository {
  constructor() {
    this.users = new Map();
  }
  async findById(id) { return this.users.get(id) || null; }
  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
  async create(data) {
    this.users.set(data.id, { ...data, active: true });
    return this.users.get(data.id);
  }
  async update(user) {
    this.users.set(user.id, user);
    return user;
  }
  async delete(id) { return this.users.delete(id); }
}

// =============================================================================
// SECTION 4: TEST FACTORY / FIXTURE PATTERNS
// =============================================================================
//
// Factories create test data with sensible defaults that can be overridden.
// This avoids duplicating setup across tests and keeps tests focused on
// what they're actually testing.

function createUserFactory(overrides = {}) {
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test User',
    email: `test_${Math.random().toString(36).slice(2, 6)}@example.com`,
    active: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createProductFactory(overrides = {}) {
  return {
    id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Product',
    price: 29.99,
    category: 'general',
    ...overrides,
  };
}

/** Builder pattern for complex fixtures. */
class UserBuilder {
  constructor() {
    this._data = createUserFactory();
  }
  withName(name) { this._data.name = name; return this; }
  withEmail(email) { this._data.email = email; return this; }
  inactive() { this._data.active = false; return this; }
  build() { return { ...this._data }; }
}

// =============================================================================
// SECTION 5: PROPERTY-BASED TESTING CONCEPTS
// =============================================================================
//
// Instead of testing specific inputs, property-based testing generates
// MANY random inputs and checks that invariants (properties) hold.
//
// Library: fast-check
// Example properties:
//   - "sorting is idempotent: sort(sort(arr)) === sort(arr)"
//   - "reverse(reverse(arr)) === arr"
//   - "parse(stringify(obj)) === obj"
//
// Below we implement a simplified property-based test runner.

function forAll(generator, property, { numRuns = 100 } = {}) {
  for (let i = 0; i < numRuns; i++) {
    const input = generator();
    try {
      property(input);
    } catch (err) {
      throw new Error(`Property failed for input: ${JSON.stringify(input)}\n${err.message}`);
    }
  }
}

// Generators
const generators = {
  integer(min = -1000, max = 1000) {
    return () => Math.floor(Math.random() * (max - min + 1)) + min;
  },
  positiveInteger(max = 1000) {
    return () => Math.floor(Math.random() * max) + 1;
  },
  string(maxLen = 20) {
    return () => {
      const len = Math.floor(Math.random() * maxLen);
      return Array.from({ length: len }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26))
      ).join('');
    };
  },
  array(elemGen, maxLen = 20) {
    return () => {
      const len = Math.floor(Math.random() * maxLen);
      return Array.from({ length: len }, elemGen);
    };
  },
  boolean() {
    return () => Math.random() > 0.5;
  },
};

// =============================================================================
// SECTION 6: SNAPSHOT TESTING CONCEPT
// =============================================================================
//
// Snapshot testing captures the output of a component/function and compares
// it against a stored reference (the "snapshot").
//
// Workflow:
//   1. First run: snapshot is created and stored
//   2. Subsequent runs: output is compared to stored snapshot
//   3. If they differ: test fails (review change and update snapshot)
//
// Jest: expect(component).toMatchSnapshot()
// Use cases: UI component rendering, API response shapes, serialized data

const snapshotStore = new Map(); // In Jest, this is stored in __snapshots__/*.snap

// =============================================================================
// SECTION 7: CODE COVERAGE CONCEPTS
// =============================================================================
//
// Coverage measures how much of your code is exercised by tests.
// Four types:
//
//   1. Line coverage     - % of lines executed
//   2. Branch coverage   - % of if/else branches taken
//   3. Function coverage - % of functions called
//   4. Statement coverage - % of statements executed
//
// Tools: Istanbul/nyc (standalone), c8 (V8 native), Jest --coverage
//
// Good coverage targets:
//   - 80% overall is a reasonable target
//   - 100% is not always worth the effort (diminishing returns)
//   - Focus on covering critical paths and edge cases
//   - Coverage does NOT guarantee correctness (you can cover a line without
//     asserting correct behavior)
//
// Jest config example:
//   {
//     "collectCoverage": true,
//     "coverageThreshold": {
//       "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 }
//     },
//     "coveragePathIgnorePatterns": ["/node_modules/", "/tests/"]
//   }

// =============================================================================
// SECTION 8: TDD WORKFLOW
// =============================================================================
//
// Test-Driven Development:
//
//   1. RED   - Write a failing test for the feature you want
//   2. GREEN - Write the minimum code to make the test pass
//   3. REFACTOR - Clean up the code while keeping tests green
//
// Benefits:
//   - Forces you to think about the API before implementation
//   - Produces naturally testable code
//   - Provides documentation through tests
//   - Catches regressions immediately
//
// TDD Example: Building a Stack (we demonstrate the workflow below)

// =============================================================================
// SECTION 9: SUPERTEST PATTERN (HTTP endpoint testing)
// =============================================================================
//
// Supertest tests Express routes without starting a real server.
//
// Real usage:
//
//   const request = require('supertest');
//   const app = require('../app');
//
//   describe('GET /api/users', () => {
//     it('returns 200 with user list', async () => {
//       const response = await request(app)
//         .get('/api/users')
//         .set('Authorization', 'Bearer valid-token')
//         .expect(200)
//         .expect('Content-Type', /json/);
//
//       expect(response.body.data).toHaveLength(2);
//       expect(response.body.data[0]).toHaveProperty('id');
//     });
//
//     it('returns 401 without token', async () => {
//       await request(app)
//         .get('/api/users')
//         .expect(401);
//     });
//   });
//
// Below we simulate supertest's fluent API for demo purposes.

class MockSupertest {
  constructor(app) {
    this.app = app;
    this._method = 'GET';
    this._path = '/';
    this._headers = {};
    this._body = null;
    this._expectations = [];
  }

  get(path) { this._method = 'GET'; this._path = path; return this; }
  post(path) { this._method = 'POST'; this._path = path; return this; }
  put(path) { this._method = 'PUT'; this._path = path; return this; }
  delete(path) { this._method = 'DELETE'; this._path = path; return this; }

  set(header, value) { this._headers[header.toLowerCase()] = value; return this; }
  send(body) { this._body = body; return this; }

  expect(statusOrHeaderOrFn, value) {
    if (typeof statusOrHeaderOrFn === 'number') {
      this._expectations.push((res) => {
        if (res.statusCode !== statusOrHeaderOrFn) {
          throw new Error(`Expected status ${statusOrHeaderOrFn} but got ${res.statusCode}`);
        }
      });
    } else if (typeof statusOrHeaderOrFn === 'string' && value) {
      this._expectations.push((res) => {
        const header = res.headers[statusOrHeaderOrFn.toLowerCase()];
        const match = value instanceof RegExp ? value.test(header) : header === value;
        if (!match) {
          throw new Error(`Expected header ${statusOrHeaderOrFn} to match ${value}`);
        }
      });
    }
    return this;
  }

  async then(resolve, reject) {
    try {
      // Simulate request
      const req = {
        method: this._method,
        path: this._path,
        url: this._path,
        originalUrl: this._path,
        headers: this._headers,
        body: this._body,
        query: {},
        params: {},
        ip: '127.0.0.1',
        cookies: {},
        get: (h) => this._headers[h.toLowerCase()],
      };

      const res = {
        statusCode: 200,
        headers: {},
        _body: null,
        _json: null,
        _sent: false,
        status(code) { this.statusCode = code; return this; },
        set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        header(name, value) { return this.set(name, value); },
        json(data) { this._json = data; this._body = JSON.stringify(data); this._sent = true; this.headers['content-type'] = 'application/json'; return this; },
        send(data) { this._body = data; this._sent = true; return this; },
        end() { this._sent = true; return this; },
      };

      await this.app(req, res);

      for (const check of this._expectations) {
        check(res);
      }

      resolve({ statusCode: res.statusCode, headers: res.headers, body: res._json || res._body });
    } catch (err) {
      reject(err);
    }
  }
}

function supertest(app) {
  return {
    get: (path) => new MockSupertest(app).get(path),
    post: (path) => new MockSupertest(app).post(path),
    put: (path) => new MockSupertest(app).put(path),
    delete: (path) => new MockSupertest(app).delete(path),
  };
}

// =============================================================================
// SECTION 10: CODE QUALITY TOOLS (explained in comments + concepts)
// =============================================================================
//
// ESLint:
//   - Static analysis tool for JavaScript/TypeScript
//   - Catches bugs, enforces style, prevents anti-patterns
//   - Configured via .eslintrc.js or eslint.config.js (flat config, new standard)
//   - Common presets: eslint:recommended, @typescript-eslint/recommended
//   - Custom rules for project conventions
//
//   // eslint.config.js (flat config, ESLint 9+)
//   import js from '@eslint/js';
//   import tseslint from 'typescript-eslint';
//   export default [
//     js.configs.recommended,
//     ...tseslint.configs.recommended,
//     {
//       rules: {
//         'no-unused-vars': 'error',
//         'no-console': 'warn',
//         'prefer-const': 'error',
//       },
//     },
//   ];
//
// Prettier:
//   - Opinionated code formatter (no style debates)
//   - Supports JS, TS, JSON, CSS, HTML, Markdown
//   - Works alongside ESLint (eslint-config-prettier disables conflicting rules)
//
//   // .prettierrc
//   {
//     "singleQuote": true,
//     "trailingComma": "all",
//     "printWidth": 100,
//     "tabWidth": 2,
//     "semi": true
//   }
//
// Husky + lint-staged:
//   - Husky: Git hook manager (runs scripts on commit, push, etc.)
//   - lint-staged: runs linters only on staged files (fast!)
//
//   // package.json
//   {
//     "lint-staged": {
//       "*.{js,ts}": ["eslint --fix", "prettier --write"],
//       "*.{json,md}": ["prettier --write"]
//     }
//   }
//
//   // .husky/pre-commit
//   npx lint-staged
//
// CI/CD Testing Strategy:
//   - Pre-commit: lint + format (via husky/lint-staged)
//   - PR checks: unit tests + integration tests + coverage check
//   - Merge to main: full test suite + e2e tests
//   - Deploy: smoke tests in staging, canary deploys
//
//   // GitHub Actions example:
//   // .github/workflows/test.yml
//   // name: Test
//   // on: [push, pull_request]
//   // jobs:
//   //   test:
//   //     runs-on: ubuntu-latest
//   //     services:
//   //       postgres:
//   //         image: postgres:16
//   //       redis:
//   //         image: redis:7
//   //     steps:
//   //       - uses: actions/checkout@v4
//   //       - uses: actions/setup-node@v4
//   //         with: { node-version: 20 }
//   //       - run: npm ci
//   //       - run: npm run lint
//   //       - run: npm run test:unit -- --coverage
//   //       - run: npm run test:integration
//   //       - run: npm run test:e2e

// =============================================================================
// TEST SUITES
// =============================================================================

// ── SUITE 1: ShoppingCart Unit Tests (AAA pattern) ───────────────────────
describe('ShoppingCart', () => {
  let cart;
  const apple = { id: 'apple', name: 'Apple', price: 1.5 };
  const banana = { id: 'banana', name: 'Banana', price: 0.75 };

  beforeEach(() => {
    // Arrange: fresh cart for each test
    cart = new ShoppingCart();
  });

  describe('addItem', () => {
    it('should add a new item to the cart', () => {
      // Act
      cart.addItem(apple, 2);
      // Assert
      expect(cart.getItemCount()).toBe(2);
      expect(cart.getTotal()).toBe(3.0);
    });

    it('should increase quantity for existing items', () => {
      cart.addItem(apple, 1);
      cart.addItem(apple, 3);
      expect(cart.getItemCount()).toBe(4);
    });

    it('should throw for non-positive quantity', () => {
      expect(() => cart.addItem(apple, 0)).toThrow('Quantity must be positive');
      expect(() => cart.addItem(apple, -1)).toThrow('Quantity must be positive');
    });

    it('should throw for negative price', () => {
      expect(() => cart.addItem({ id: 'bad', price: -5 }, 1)).toThrow('Price cannot be negative');
    });
  });

  describe('removeItem', () => {
    it('should remove an item from the cart', () => {
      cart.addItem(apple, 2);
      cart.addItem(banana, 1);
      cart.removeItem('apple');
      expect(cart.getItemCount()).toBe(1);
      expect(cart.getTotal()).toBe(0.75);
    });

    it('should throw when removing non-existent item', () => {
      expect(() => cart.removeItem('nonexistent')).toThrow('Item not in cart');
    });
  });

  describe('getTotal', () => {
    it('should return 0 for empty cart', () => {
      expect(cart.getTotal()).toBe(0);
    });

    it('should calculate total for multiple items', () => {
      cart.addItem(apple, 3);  // 4.50
      cart.addItem(banana, 2); // 1.50
      expect(cart.getTotal()).toBe(6.0);
    });
  });

  describe('applyDiscount', () => {
    it('should apply percentage discount', () => {
      cart.addItem(apple, 10); // $15.00
      const discounted = cart.applyDiscount(20); // 20% off
      expect(discounted).toBe(12.0);
    });

    it('should reject invalid discount percentages', () => {
      expect(() => cart.applyDiscount(-5)).toThrow('Invalid discount');
      expect(() => cart.applyDiscount(101)).toThrow('Invalid discount');
    });
  });
});

// ── SUITE 2: UserService with Mocks/Stubs/Spies ─────────────────────────
describe('UserService', () => {
  let userService;
  let fakeRepo;
  let mockEmailService;
  let mockLogger;

  beforeEach(() => {
    // Arrange: create test doubles
    fakeRepo = new FakeUserRepository();

    // Mock: email service with tracked calls
    mockEmailService = {
      sendWelcome: fn().mockReturnValue(Promise.resolve({ sent: true })),
      sendDeactivationNotice: fn().mockReturnValue(Promise.resolve({ sent: true })),
    };

    // Stub: logger that does nothing
    mockLogger = {
      info: fn(),
      error: fn(),
      warn: fn(),
    };

    userService = new UserService(fakeRepo, mockEmailService, mockLogger);
  });

  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = { name: 'Alice', email: 'alice@example.com' };
      // Act
      const user = await userService.createUser(userData);
      // Assert
      expect(user.name).toBe('Alice');
      expect(user.email).toBe('alice@example.com');
      expect(user.id).toBeDefined();
      expect(user.active).toBe(true);
    });

    it('should send welcome email after creation', async () => {
      await userService.createUser({ name: 'Bob', email: 'bob@example.com' });
      expect(mockEmailService.sendWelcome).toHaveBeenCalled();
      expect(mockEmailService.sendWelcome).toHaveBeenCalledWith('bob@example.com', 'Bob');
    });

    it('should log user creation', async () => {
      const user = await userService.createUser({ name: 'Charlie', email: 'charlie@example.com' });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should throw for missing name', async () => {
      await expect(() => userService.createUser({ email: 'a@b.com' })).toReject('Name and email are required');
    });

    it('should throw for invalid email', async () => {
      await expect(() => userService.createUser({ name: 'X', email: 'invalid' })).toReject('Invalid email');
    });

    it('should throw for duplicate email', async () => {
      await userService.createUser({ name: 'Alice', email: 'alice@example.com' });
      await expect(() =>
        userService.createUser({ name: 'Alice2', email: 'alice@example.com' })
      ).toReject('already registered');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate an existing user', async () => {
      const user = await userService.createUser({ name: 'Dave', email: 'dave@example.com' });
      const deactivated = await userService.deactivateUser(user.id);
      expect(deactivated.active).toBe(false);
    });

    it('should send deactivation notice', async () => {
      const user = await userService.createUser({ name: 'Eve', email: 'eve@example.com' });
      await userService.deactivateUser(user.id);
      expect(mockEmailService.sendDeactivationNotice).toHaveBeenCalledWith('eve@example.com');
    });

    it('should throw for non-existent user', async () => {
      await expect(() => userService.deactivateUser('nonexistent')).toReject('User not found');
    });
  });
});

// ── SUITE 3: Testing Event-Driven Code ──────────────────────────────────
describe('EventProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new EventProcessor();
  });

  it('should emit "processing" event before processing', async () => {
    const events = [];
    processor.on('processing', (evt) => events.push({ type: 'processing', data: evt }));
    processor.on('processed', (evt) => events.push({ type: 'processed', data: evt }));

    await processor.process({ id: 1, action: 'test' });

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('processing');
    expect(events[1].type).toBe('processed');
    expect(events[1].data.status).toBe('processed');
  });

  it('should track processed events', async () => {
    await processor.process({ id: 1 });
    await processor.process({ id: 2 });
    expect(processor.processedEvents).toHaveLength(2);
  });

  it('should use a spy to verify event emission', async () => {
    const emitSpy = spyOn(processor, 'emit');
    await processor.process({ id: 1 });
    expect(emitSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('processing', { id: 1 });
    emitSpy.restore();
  });
});

// ── SUITE 4: Snapshot Testing ────────────────────────────────────────────
describe('Snapshot Testing', () => {
  it('should match API response shape snapshot', () => {
    const apiResponse = {
      data: {
        id: 'user_1',
        name: 'Alice',
        email: 'alice@example.com',
        roles: ['user'],
      },
      meta: {
        requestId: 'req_123',
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    // First call creates the snapshot; subsequent calls compare against it.
    expect(apiResponse).toMatchSnapshot(snapshotStore, 'API response shape');
    // This second call should pass (matches stored snapshot)
    expect(apiResponse).toMatchSnapshot(snapshotStore, 'API response shape');
  });

  it('should detect snapshot changes', () => {
    const originalConfig = { version: 1, features: ['auth', 'logging'] };
    expect(originalConfig).toMatchSnapshot(snapshotStore, 'config snapshot');

    // If config changes, snapshot test would catch it:
    const modifiedConfig = { version: 2, features: ['auth', 'logging', 'metrics'] };
    let caught = false;
    try {
      expect(modifiedConfig).toMatchSnapshot(snapshotStore, 'config snapshot');
    } catch {
      caught = true;
    }
    expect(caught).toBeTruthy();
  });
});

// ── SUITE 5: Property-Based Testing ─────────────────────────────────────
describe('Property-Based Testing', () => {
  it('array reverse is involutory: reverse(reverse(arr)) === arr', () => {
    forAll(generators.array(generators.integer(), 30), (arr) => {
      const reversed = [...arr].reverse().reverse();
      expect(reversed).toEqual(arr);
    }, { numRuns: 50 });
  });

  it('sorting is idempotent: sort(sort(arr)) === sort(arr)', () => {
    forAll(generators.array(generators.integer(), 20), (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const doubleSorted = [...sorted].sort((a, b) => a - b);
      expect(doubleSorted).toEqual(sorted);
    }, { numRuns: 50 });
  });

  it('string concatenation length: (a+b).length === a.length + b.length', () => {
    const genPair = () => ({
      a: generators.string(15)(),
      b: generators.string(15)(),
    });
    forAll(genPair, ({ a, b }) => {
      expect((a + b).length).toBe(a.length + b.length);
    }, { numRuns: 50 });
  });

  it('JSON round-trip: parse(stringify(obj)) === obj', () => {
    const genObj = () => ({
      x: generators.integer()(),
      y: generators.string(10)(),
      z: generators.boolean()(),
    });
    forAll(genObj, (obj) => {
      expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
    }, { numRuns: 50 });
  });
});

// ── SUITE 6: TDD Workflow Demonstration ──────────────────────────────────
// Step-by-step TDD building a Stack:
//   RED -> GREEN -> REFACTOR for each feature

class Stack {
  constructor() { this._items = []; }
  push(item) { this._items.push(item); }
  pop() {
    if (this.isEmpty()) throw new Error('Stack underflow');
    return this._items.pop();
  }
  peek() {
    if (this.isEmpty()) throw new Error('Stack is empty');
    return this._items[this._items.length - 1];
  }
  isEmpty() { return this._items.length === 0; }
  get size() { return this._items.length; }
}

describe('TDD: Stack', () => {
  let stack;
  beforeEach(() => { stack = new Stack(); });

  // Feature 1: empty by default
  it('should be empty when created', () => {
    expect(stack.isEmpty()).toBe(true);
    expect(stack.size).toBe(0);
  });

  // Feature 2: push items
  it('should not be empty after push', () => {
    stack.push(42);
    expect(stack.isEmpty()).toBe(false);
    expect(stack.size).toBe(1);
  });

  // Feature 3: pop items (LIFO)
  it('should pop in LIFO order', () => {
    stack.push('a');
    stack.push('b');
    stack.push('c');
    expect(stack.pop()).toBe('c');
    expect(stack.pop()).toBe('b');
    expect(stack.pop()).toBe('a');
  });

  // Feature 4: peek without removing
  it('should peek at top without removing', () => {
    stack.push(99);
    expect(stack.peek()).toBe(99);
    expect(stack.size).toBe(1); // not removed
  });

  // Feature 5: error on empty pop/peek
  it('should throw on pop when empty', () => {
    expect(() => stack.pop()).toThrow('Stack underflow');
  });
  it('should throw on peek when empty', () => {
    expect(() => stack.peek()).toThrow('Stack is empty');
  });
});

// ── SUITE 7: Supertest-style HTTP Testing ────────────────────────────────
describe('HTTP Testing (Supertest pattern)', () => {
  // Mini app handler (simulates Express app)
  const app = async (req, res) => {
    if (req.method === 'GET' && req.path === '/api/health') {
      return res.status(200).json({ status: 'ok' });
    }
    if (req.method === 'POST' && req.path === '/api/users') {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Name required' });
      }
      return res.status(201).json({ id: 1, name: req.body.name });
    }
    res.status(404).json({ error: 'Not Found' });
  };

  it('GET /api/health should return 200', async () => {
    const response = await supertest(app)
      .get('/api/health')
      .expect(200)
      .expect('content-type', /json/);

    expect(response.body.status).toBe('ok');
  });

  it('POST /api/users should create user', async () => {
    const response = await supertest(app)
      .post('/api/users')
      .send({ name: 'Alice' })
      .expect(201);

    expect(response.body.name).toBe('Alice');
    expect(response.body.id).toBeDefined();
  });

  it('POST /api/users without name should return 400', async () => {
    const response = await supertest(app)
      .post('/api/users')
      .send({})
      .expect(400);

    expect(response.body.error).toContain('Name required');
  });

  it('Unknown route should return 404', async () => {
    await supertest(app)
      .get('/api/unknown')
      .expect(404);
  });
});

// ── SUITE 8: Test Factories and Builders ─────────────────────────────────
describe('Test Factories', () => {
  it('should create users with default values', () => {
    const user = createUserFactory();
    expect(user.name).toBe('Test User');
    expect(user.active).toBe(true);
    expect(user.id).toBeDefined();
  });

  it('should allow overriding defaults', () => {
    const user = createUserFactory({ name: 'Custom', active: false });
    expect(user.name).toBe('Custom');
    expect(user.active).toBe(false);
  });

  it('should use builder pattern for complex fixtures', () => {
    const user = new UserBuilder()
      .withName('Alice')
      .withEmail('alice@test.com')
      .inactive()
      .build();

    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@test.com');
    expect(user.active).toBe(false);
  });
});

// ── SUITE 9: Mock Function Features ──────────────────────────────────────
describe('Mock Functions (jest.fn() equivalent)', () => {
  it('should track calls', () => {
    const mock = fn();
    mock('a', 'b');
    mock('c');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith('a', 'b');
  });

  it('should return configured values', () => {
    const mock = fn().mockReturnValue(42);
    expect(mock()).toBe(42);
    expect(mock()).toBe(42);
  });

  it('should support custom implementation', () => {
    const mock = fn().mockImplementation((x) => x * 2);
    expect(mock(5)).toBe(10);
    expect(mock(3)).toBe(6);
  });

  it('should support mockReset', () => {
    const mock = fn().mockReturnValue(1);
    mock();
    mock();
    mock.mockReset();
    expect(mock.calls).toHaveLength(0);
    expect(mock()).toBeUndefined();
  });

  it('should track spy calls while preserving behavior', () => {
    const obj = {
      add(a, b) { return a + b; },
    };
    const spy = spyOn(obj, 'add');

    const result = obj.add(2, 3);
    expect(result).toBe(5);
    expect(spy).toHaveBeenCalledWith(2, 3);

    spy.restore();
  });
});

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function main() {
  console.log('\n=== RUNNING TEST SUITES ===\n');
  await runTests();

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${testResults.passed} passed, ${testResults.failed} failed`);
  console.log('='.repeat(60));

  // ── Bonus: Testing Pyramid explanation ─────────────────────────────────
  console.log(`
TESTING PYRAMID (interview reference):

              /\\
             /  \\        E2E Tests (few)
            / E2E\\       - Selenium, Playwright, Cypress
           /------\\      - Full user flows through real UI
          /        \\     - Slowest, most brittle
         / Integr.  \\
        /   Tests    \\   Integration Tests (some)
       /--------------\\  - Supertest + real DB/Redis
      /                \\ - Test module interactions
     /   Unit Tests     \\- Medium speed
    /____________________\\
                          Unit Tests (many)
                          - Jest, Vitest
                          - Test individual functions/classes
                          - Fast, isolated, mocked dependencies
  `);

  if (testResults.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
