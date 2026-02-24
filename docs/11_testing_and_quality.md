# 11 - Testing & Code Quality

## Table of Contents

- [Testing Pyramid](#testing-pyramid)
- [Jest Fundamentals](#jest-fundamentals)
- [Mocking](#mocking)
- [Async Testing](#async-testing)
- [HTTP Testing with Supertest](#http-testing-with-supertest)
- [Fixtures & Factories](#fixtures--factories)
- [Test Doubles](#test-doubles)
- [AAA Pattern](#aaa-pattern)
- [Property-Based Testing](#property-based-testing)
- [Code Coverage](#code-coverage)
- [TDD Workflow](#tdd-workflow)
- [Snapshot Testing](#snapshot-testing)
- [ESLint](#eslint)
- [Prettier](#prettier)
- [Husky & lint-staged](#husky--lint-staged)
- [CI/CD Testing](#cicd-testing)
- [Interview Tips](#interview-tips)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Testing Pyramid

```
        /  E2E   \        Few — slow, expensive, brittle
       /----------\
      / Integration \     Moderate — test interactions
     /----------------\
    /    Unit Tests     \  Many — fast, isolated, cheap
   /____________________\
```

| Level | What it tests | Speed | Tools |
|---|---|---|---|
| **Unit** | Single function/class in isolation | Very fast | Jest |
| **Integration** | Multiple modules together, DB, APIs | Medium | Jest + Supertest, Testcontainers |
| **E2E** | Full user flow through the system | Slow | Playwright, Cypress |

### Test Distribution Rule of Thumb

| Level | Percentage | Count (example) |
|---|---|---|
| Unit | ~70% | 700 tests |
| Integration | ~20% | 200 tests |
| E2E | ~10% | 100 tests |

---

## Jest Fundamentals

### Structure: describe / it / expect

```javascript
describe('UserService', () => {
  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const user = await userService.register({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
      });

      expect(user).toBeDefined();
      expect(user.name).toBe('Alice');
      expect(user.email).toBe('alice@example.com');
      expect(user.password).not.toBe('secret123'); // hashed
    });

    it('should throw ConflictError if email already exists', async () => {
      await userService.register({ name: 'A', email: 'a@b.com', password: '123' });

      await expect(
        userService.register({ name: 'B', email: 'a@b.com', password: '456' })
      ).rejects.toThrow(ConflictError);
    });
  });
});
```

### Lifecycle Hooks

```javascript
describe('Database tests', () => {
  beforeAll(async () => {
    // Runs once before all tests in this describe block
    await db.connect();
  });

  afterAll(async () => {
    // Runs once after all tests
    await db.disconnect();
  });

  beforeEach(async () => {
    // Runs before each test
    await db.truncateAll();
  });

  afterEach(() => {
    // Runs after each test
    jest.restoreAllMocks();
  });
});
```

### Common Matchers

```javascript
// Equality
expect(value).toBe(5);                    // strict ===
expect(obj).toEqual({ a: 1, b: 2 });     // deep equality
expect(obj).toStrictEqual({ a: 1 });      // deep + type checking

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(num).toBeGreaterThan(3);
expect(num).toBeGreaterThanOrEqual(3);
expect(num).toBeLessThan(10);
expect(0.1 + 0.2).toBeCloseTo(0.3);       // floating point

// Strings
expect(str).toMatch(/regex/);
expect(str).toContain('substring');

// Arrays / Iterables
expect(arr).toContain('item');
expect(arr).toContainEqual({ id: 1 });     // deep equality in array
expect(arr).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('nested.key', 'value');
expect(obj).toMatchObject({ name: 'Alice' }); // partial match

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(TypeError);
expect(() => fn()).toThrow('message');

// Asymmetric matchers
expect(obj).toEqual({
  id: expect.any(Number),
  name: expect.any(String),
  createdAt: expect.any(Date),
  tags: expect.arrayContaining(['important']),
  metadata: expect.objectContaining({ version: 2 }),
});
```

---

## Mocking

### jest.fn() — Mock Functions

```javascript
const mockCallback = jest.fn();

// Call it
mockCallback('hello');
mockCallback('world');

// Assertions
expect(mockCallback).toHaveBeenCalledTimes(2);
expect(mockCallback).toHaveBeenCalledWith('hello');
expect(mockCallback).toHaveBeenLastCalledWith('world');
expect(mockCallback).toHaveBeenNthCalledWith(1, 'hello');

// Return values
const mockFn = jest.fn()
  .mockReturnValueOnce(10)
  .mockReturnValueOnce(20)
  .mockReturnValue(99);  // default after once-values exhausted

mockFn(); // 10
mockFn(); // 20
mockFn(); // 99

// Async mock
const mockAsync = jest.fn()
  .mockResolvedValueOnce({ id: 1, name: 'Alice' })
  .mockRejectedValueOnce(new Error('DB error'));
```

### jest.mock() — Module Mocking

```javascript
// Mock an entire module
jest.mock('../services/emailService.js');

import { sendEmail } from '../services/emailService.js';

// sendEmail is now a jest.fn() — all exports are auto-mocked

beforeEach(() => {
  sendEmail.mockResolvedValue({ messageId: 'abc' });
});

it('should send a welcome email', async () => {
  await userService.register({ name: 'Alice', email: 'a@b.com' });
  expect(sendEmail).toHaveBeenCalledWith({
    to: 'a@b.com',
    subject: expect.stringContaining('Welcome'),
    body: expect.any(String),
  });
});
```

### Partial Module Mock

```javascript
jest.mock('../utils/helpers.js', () => ({
  ...jest.requireActual('../utils/helpers.js'), // keep real implementations
  generateId: jest.fn(() => 'mock-id-123'),     // override specific exports
}));
```

### jest.spyOn() — Spy on Methods

```javascript
const spy = jest.spyOn(userRepo, 'findById').mockResolvedValue({ id: 1, name: 'Alice' });

const user = await userService.getUser(1);

expect(spy).toHaveBeenCalledWith(1);
expect(user.name).toBe('Alice');

spy.mockRestore(); // restore original implementation
```

### Mocking Timers

```javascript
jest.useFakeTimers();

it('should retry after delay', async () => {
  const mockFn = jest.fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValueOnce('success');

  const promise = retryWithDelay(mockFn, { delay: 1000, retries: 3 });

  // Fast-forward time
  jest.advanceTimersByTime(1000);

  const result = await promise;
  expect(result).toBe('success');
  expect(mockFn).toHaveBeenCalledTimes(2);
});

afterEach(() => {
  jest.useRealTimers();
});
```

---

## Async Testing

### Promises

```javascript
// Return the promise
it('should resolve with user', () => {
  return userService.findById(1).then((user) => {
    expect(user.name).toBe('Alice');
  });
});

// async/await (preferred)
it('should resolve with user', async () => {
  const user = await userService.findById(1);
  expect(user.name).toBe('Alice');
});

// Rejection
it('should reject if not found', async () => {
  await expect(userService.findById(999)).rejects.toThrow('Not found');
});

// resolves / rejects matchers
it('should resolve', () => {
  return expect(fetchData()).resolves.toEqual({ data: 42 });
});

it('should reject', () => {
  return expect(fetchBroken()).rejects.toThrow('Network error');
});
```

### Testing Event Emitters

```javascript
it('should emit user:created event', (done) => {
  userService.on('user:created', (user) => {
    expect(user.name).toBe('Alice');
    done(); // signal async completion
  });

  userService.register({ name: 'Alice', email: 'a@b.com' });
});

// Or with a promise wrapper
it('should emit user:created event', async () => {
  const eventPromise = new Promise((resolve) => {
    userService.once('user:created', resolve);
  });

  await userService.register({ name: 'Alice', email: 'a@b.com' });

  const user = await eventPromise;
  expect(user.name).toBe('Alice');
});
```

---

## HTTP Testing with Supertest

```javascript
import request from 'supertest';
import app from '../app.js';

describe('GET /api/users', () => {
  it('should return a list of users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
    });
  });
});

describe('POST /api/users', () => {
  it('should create a user and return 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Alice', email: 'alice@example.com' })
      .expect(201);

    expect(res.body.data).toMatchObject({
      id: expect.any(Number),
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should return 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '' }) // invalid
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 without auth token', async () => {
    await request(app)
      .post('/api/users')
      .send({ name: 'Alice', email: 'a@b.com' })
      .expect(401);
  });
});
```

---

## Fixtures & Factories

### Fixtures (Static Test Data)

```javascript
// __fixtures__/users.js
export const validUser = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'Secret123!',
  role: 'user',
};

export const adminUser = {
  name: 'Admin',
  email: 'admin@example.com',
  password: 'Admin123!',
  role: 'admin',
};

// Usage in tests
import { validUser, adminUser } from '../__fixtures__/users.js';
```

### Factories (Dynamic Test Data)

```javascript
// __factories__/userFactory.js
let idCounter = 0;

export function buildUser(overrides = {}) {
  idCounter++;
  return {
    id: idCounter,
    name: `User ${idCounter}`,
    email: `user${idCounter}@example.com`,
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildUsers(count, overrides = {}) {
  return Array.from({ length: count }, () => buildUser(overrides));
}

// Usage
const user = buildUser({ role: 'admin' });
const users = buildUsers(5, { role: 'user' });
```

### Factory with Fishery

```javascript
import { Factory } from 'fishery';

const userFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  name: `User ${sequence}`,
  email: `user${sequence}@test.com`,
  role: 'user',
  createdAt: new Date(),
}));

// Traits
const adminFactory = userFactory.params({ role: 'admin' });

// Usage
const user = userFactory.build();
const admin = adminFactory.build({ name: 'Super Admin' });
const users = userFactory.buildList(10);
```

---

## Test Doubles

| Double | Purpose | Behavior |
|---|---|---|
| **Dummy** | Fill a parameter slot | Never actually used |
| **Stub** | Return predetermined data | Replaces real implementation with fixed responses |
| **Spy** | Record calls while keeping real behavior | Wraps real method, tracks calls |
| **Mock** | Pre-programmed with expectations | Verifies interactions (called with X args, N times) |
| **Fake** | Working implementation (simplified) | In-memory DB, local file system |

```javascript
// STUB — returns canned data
const userRepoStub = {
  findById: jest.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
  create: jest.fn().mockResolvedValue({ id: 2, name: 'Bob' }),
};

// SPY — tracks calls to real method
const spy = jest.spyOn(realUserRepo, 'findById');
// Real implementation still runs, but calls are tracked

// MOCK — verify interactions
const mockEmailService = {
  sendWelcome: jest.fn().mockResolvedValue(true),
};
// After test:
expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(
  expect.objectContaining({ email: 'alice@example.com' })
);

// FAKE — in-memory implementation
class FakeUserRepo {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
  }

  async create(data) {
    const user = { ...data, id: this.nextId++ };
    this.users.set(user.id, user);
    return user;
  }

  async findById(id) {
    return this.users.get(id) || null;
  }

  async findByEmail(email) {
    return [...this.users.values()].find((u) => u.email === email) || null;
  }
}
```

---

## AAA Pattern

**Arrange-Act-Assert** — the standard structure for every test.

```javascript
it('should calculate total with discount', () => {
  // Arrange — set up preconditions
  const cart = new ShoppingCart();
  cart.addItem({ name: 'Laptop', price: 1000, quantity: 1 });
  cart.addItem({ name: 'Mouse', price: 50, quantity: 2 });
  const discount = { type: 'percentage', value: 10 };

  // Act — perform the action under test
  const total = cart.calculateTotal(discount);

  // Assert — verify the outcome
  expect(total).toBe(990); // (1000 + 100) * 0.9
});
```

### Anti-Patterns to Avoid

```javascript
// BAD: Multiple acts in one test
it('should create and update user', async () => {
  const user = await service.create({ name: 'Alice' }); // Act 1
  const updated = await service.update(user.id, { name: 'Bob' }); // Act 2
  expect(updated.name).toBe('Bob');
});

// GOOD: One act per test
it('should create user', async () => {
  const user = await service.create({ name: 'Alice' });
  expect(user.name).toBe('Alice');
});

it('should update user name', async () => {
  const user = await service.create({ name: 'Alice' });
  const updated = await service.update(user.id, { name: 'Bob' });
  expect(updated.name).toBe('Bob');
});
```

---

## Property-Based Testing

Instead of testing specific examples, property-based testing generates random inputs and verifies invariants.

### fast-check

```javascript
import fc from 'fast-check';

describe('sort', () => {
  it('should return an array of the same length', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        expect(sorted).toHaveLength(arr.length);
      })
    );
  });

  it('should return elements in ascending order', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
        }
      })
    );
  });

  it('should contain the same elements', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        expect(sorted).toEqual(expect.arrayContaining(arr));
        expect(arr).toEqual(expect.arrayContaining(sorted));
      })
    );
  });
});

// Testing a serialization roundtrip
describe('JSON serialization', () => {
  it('parse(stringify(x)) === x for valid objects', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          age: fc.integer({ min: 0, max: 150 }),
          active: fc.boolean(),
        }),
        (obj) => {
          expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
        }
      )
    );
  });
});
```

### When to Use Property-Based Testing

| Good Fit | Not a Good Fit |
|---|---|
| Pure functions (sort, parse, encode/decode) | Complex integration flows |
| Serialization roundtrips | UI behavior |
| Invariants that must always hold | Tests with side effects |
| Edge case discovery | When examples suffice |

---

## Code Coverage

```bash
# Run with coverage
npx jest --coverage

# Coverage thresholds in jest.config.js
```

```javascript
// jest.config.js
export default {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__fixtures__/**',
    '!src/**/index.js',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
};
```

### Coverage Metrics

| Metric | What it measures |
|---|---|
| **Statements** | % of statements executed |
| **Branches** | % of if/else/switch branches taken |
| **Functions** | % of functions called |
| **Lines** | % of lines executed |

> **Important:** 100% coverage does not mean bug-free code. Coverage measures execution, not correctness. Focus on meaningful tests, not chasing numbers.

---

## TDD Workflow

**Red-Green-Refactor:**

1. **Red** — Write a failing test first
2. **Green** — Write the minimum code to make it pass
3. **Refactor** — Improve the code while keeping tests green

```javascript
// Step 1: RED — write the failing test
describe('fizzbuzz', () => {
  it('should return "Fizz" for multiples of 3', () => {
    expect(fizzbuzz(3)).toBe('Fizz');
    expect(fizzbuzz(9)).toBe('Fizz');
  });

  it('should return "Buzz" for multiples of 5', () => {
    expect(fizzbuzz(5)).toBe('Buzz');
    expect(fizzbuzz(10)).toBe('Buzz');
  });

  it('should return "FizzBuzz" for multiples of 15', () => {
    expect(fizzbuzz(15)).toBe('FizzBuzz');
    expect(fizzbuzz(30)).toBe('FizzBuzz');
  });

  it('should return the number as string otherwise', () => {
    expect(fizzbuzz(1)).toBe('1');
    expect(fizzbuzz(7)).toBe('7');
  });
});

// Step 2: GREEN — minimal implementation
function fizzbuzz(n) {
  if (n % 15 === 0) return 'FizzBuzz';
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}

// Step 3: REFACTOR (in this case, already clean)
```

---

## Snapshot Testing

Snapshots capture the output of a function and compare it against a stored reference.

```javascript
// First run: creates __snapshots__/component.test.js.snap
it('should match user response shape', () => {
  const response = formatUserResponse({
    id: 1,
    name: 'Alice',
    email: 'a@b.com',
    createdAt: new Date('2024-01-01'),
  });

  expect(response).toMatchSnapshot();
});

// Inline snapshot (stored in test file)
it('should format error response', () => {
  const error = formatError(new NotFoundError('User'));

  expect(error).toMatchInlineSnapshot(`
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "User not found",
      },
    }
  `);
});
```

### When to Use Snapshots

| Good Use | Bad Use |
|---|---|
| API response shapes | Frequently changing output |
| Error message formats | Large complex objects |
| Config objects | Anything with random/time-based data |
| Serialized output | As a replacement for specific assertions |

> **Tip:** Use `toMatchObject()` or specific assertions for critical fields. Reserve snapshots for "shape verification" where exact values matter less.

---

## ESLint

```javascript
// eslint.config.js (flat config — ESLint 9+)
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off', // allow expect() chains
    },
  },
];
```

---

## Prettier

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```gitignore
# .prettierignore
node_modules
dist
coverage
*.min.js
```

### ESLint + Prettier Integration

```bash
npm install -D eslint-config-prettier
```

```javascript
// eslint.config.js
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,  // must be last — disables ESLint rules that conflict with Prettier
  { /* your rules */ },
];
```

---

## Husky & lint-staged

### Setup

```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

```bash
# .husky/commit-msg (optional — enforce conventional commits)
npx commitlint --edit $1
```

### What This Achieves

| Hook | Action |
|---|---|
| **pre-commit** | Lint + format only staged files (fast) |
| **commit-msg** | Validate commit message format |
| **pre-push** | Run full test suite (optional) |

---

## CI/CD Testing

### GitHub Actions Example

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20, 22]

    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        if: matrix.node-version == 20
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

### CI Testing Best Practices

| Practice | Reason |
|---|---|
| Use `npm ci` (not `npm install`) | Exact versions, faster |
| Cache `node_modules` | Faster builds |
| Run lint before tests | Fail fast |
| Test against multiple Node versions | Compatibility |
| Use service containers | Real Redis/Postgres in CI |
| Set timeouts | Prevent hung builds |
| Separate unit and integration | Run units first (faster feedback) |

---

## Interview Tips

1. **"What is the testing pyramid?"** — Many fast unit tests at the base, fewer integration tests, minimal E2E at the top. The pyramid reflects the cost/speed trade-off.

2. **Know your test doubles.** Clearly explain the difference between stubs, mocks, spies, and fakes. Use the correct term.

3. **AAA is the universal pattern.** Every test should have a clear Arrange, Act, Assert structure. One act per test.

4. **Mocking strategy matters.** Over-mocking leads to tests that pass but the system is broken. Under-mocking leads to slow, flaky tests. Find the balance.

5. **Coverage is a metric, not a goal.** 80% is a good threshold. Focus on testing critical paths and edge cases, not chasing 100%.

6. **TDD is a design tool.** It forces you to think about the interface before the implementation, leading to more testable and modular code.

7. **Property-based testing finds edge cases** you would never think of. Mention fast-check for bonus points.

---

## Quick Reference / Cheat Sheet

```
Jest CLI:
  npx jest                       # run all tests
  npx jest --watch               # watch mode
  npx jest --coverage            # with coverage
  npx jest path/to/file.test.js  # run specific file
  npx jest -t "should create"    # run matching test name
  npx jest --verbose             # detailed output

Jest Matchers Quick Reference:
  .toBe(x)                  exact match (===)
  .toEqual(x)               deep equality
  .toMatchObject(x)         partial deep match
  .toContain(x)             array/string contains
  .toThrow(x)               function throws
  .toHaveBeenCalledWith(x)  mock called with args
  .resolves.toEqual(x)      promise resolves to
  .rejects.toThrow(x)       promise rejects with

Mock Patterns:
  jest.fn()                 create mock function
  jest.fn().mockReturnValue(x)       sync return
  jest.fn().mockResolvedValue(x)     async resolve
  jest.fn().mockRejectedValue(x)     async reject
  jest.fn().mockImplementation(fn)   custom impl
  jest.spyOn(obj, 'method')         spy on real method
  jest.mock('./module')              mock entire module

Test Structure:
  describe('Module', () => {
    describe('method', () => {
      it('should [expected behavior]', () => {
        // Arrange
        // Act
        // Assert
      });
    });
  });

Quality Pipeline:
  Code -> ESLint (lint) -> Prettier (format) -> Jest (test) -> Commit
  Husky pre-commit: lint-staged (lint + format staged files)
  Husky pre-push: npm test (full test suite)
  CI: lint -> unit tests -> integration tests -> coverage report
```
