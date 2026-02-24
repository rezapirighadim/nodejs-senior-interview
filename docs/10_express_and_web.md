# 10 - Express.js, Web Frameworks & API Design

## Table of Contents

- [Express.js Fundamentals](#expressjs-fundamentals)
- [Routing](#routing)
- [Middleware](#middleware)
- [Error Handling](#error-handling)
- [REST API Design](#rest-api-design)
- [Request Validation (Joi / Zod)](#request-validation-joi--zod)
- [Middleware Patterns](#middleware-patterns)
- [Dependency Injection](#dependency-injection)
- [Custom Error Classes](#custom-error-classes)
- [File Uploads](#file-uploads)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [WebSocket](#websocket)
- [API Versioning](#api-versioning)
- [Security](#security)
- [NestJS Concepts](#nestjs-concepts)
- [Production Project Structure](#production-project-structure)
- [Interview Tips](#interview-tips)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Express.js Fundamentals

Express is a minimal, unopinionated web framework for Node.js. It provides a thin layer over Node's built-in `http` module.

```javascript
import express from 'express';

const app = express();

// Built-in middleware
app.use(express.json());                          // parse JSON bodies
app.use(express.urlencoded({ extended: true }));  // parse URL-encoded bodies
app.use(express.static('public'));                // serve static files

app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Routing

### Basic Routes

```javascript
// HTTP methods
app.get('/users',    (req, res) => { /* list users */ });
app.post('/users',   (req, res) => { /* create user */ });
app.put('/users/:id',    (req, res) => { /* replace user */ });
app.patch('/users/:id',  (req, res) => { /* update fields */ });
app.delete('/users/:id', (req, res) => { /* delete user */ });
```

### Route Parameters & Query Strings

```javascript
// Route params: /users/42
app.get('/users/:id', (req, res) => {
  const { id } = req.params;  // "42"
  res.json({ id });
});

// Query string: /users?page=2&limit=10
app.get('/users', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  // page and limit are strings — cast as needed
});
```

### Router Modules

```javascript
// routes/users.js
import { Router } from 'express';

const router = Router();

router.get('/',     listUsers);
router.get('/:id',  getUser);
router.post('/',    createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;

// app.js
import usersRouter from './routes/users.js';
app.use('/api/users', usersRouter);
```

### Route Chaining

```javascript
app.route('/api/articles')
  .get(listArticles)
  .post(requireAuth, createArticle);

app.route('/api/articles/:id')
  .get(getArticle)
  .put(requireAuth, updateArticle)
  .delete(requireAuth, requireAdmin, deleteArticle);
```

---

## Middleware

Middleware functions have access to `req`, `res`, and `next`. They execute in order.

```
Request --> [middleware1] --> [middleware2] --> [route handler] --> Response
```

### Types of Middleware

| Type | Scope | Example |
|---|---|---|
| Application-level | All routes | `app.use(cors())` |
| Router-level | Router routes | `router.use(authCheck)` |
| Route-level | Single route | `app.get('/x', mw, handler)` |
| Error-handling | 4 params | `app.use((err, req, res, next) => {})` |
| Built-in | Express core | `express.json()`, `express.static()` |
| Third-party | npm packages | `cors`, `helmet`, `morgan` |

### Writing Custom Middleware

```javascript
// Logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}

app.use(requestLogger);

// Request ID middleware
import { randomUUID } from 'node:crypto';

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

app.use(requestId);
```

---

## Error Handling

### Synchronous Errors

Express catches synchronous errors thrown in route handlers automatically.

```javascript
app.get('/fail', (req, res) => {
  throw new Error('Something broke!'); // Express catches this
});
```

### Asynchronous Errors

In Express 4, you must pass async errors to `next()`. Express 5 handles async errors natively.

```javascript
// Express 4 — explicit next(err)
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Helper: async wrapper (eliminates try-catch boilerplate)
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
}));
```

### Centralized Error Handler

```javascript
// Must have 4 parameters — Express identifies error middleware by arity
app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err.message);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});
```

---

## REST API Design

### Resource Naming Conventions

| Pattern | Example | Verb |
|---|---|---|
| List resources | `GET /api/users` | Read |
| Get single | `GET /api/users/:id` | Read |
| Create | `POST /api/users` | Create |
| Full update | `PUT /api/users/:id` | Replace |
| Partial update | `PATCH /api/users/:id` | Modify |
| Delete | `DELETE /api/users/:id` | Delete |
| Nested resource | `GET /api/users/:id/posts` | Read |
| Action | `POST /api/users/:id/activate` | Action |

### Response Envelope

```javascript
// Success
{
  "data": { "id": 1, "name": "Alice" },
  "meta": { "requestId": "abc-123" }
}

// List with pagination
{
  "data": [ ... ],
  "meta": {
    "total": 142,
    "page": 2,
    "limit": 20,
    "totalPages": 8
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "must be a valid email" }
    ]
  }
}
```

### HTTP Status Codes

| Code | Meaning | When to Use |
|---|---|---|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, malformed input |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource, concurrency conflict |
| 422 | Unprocessable Entity | Semantic validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |

---

## Request Validation (Joi / Zod)

### Zod

```javascript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).max(120).optional(),
  role: z.enum(['user', 'admin']).default('user'),
});

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }
    req.body = result.data; // use parsed/coerced data
    next();
  };
}

app.post('/api/users', validate(CreateUserSchema), createUser);
```

### Joi

```javascript
import Joi from 'joi';

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(18).max(120),
  role: Joi.string().valid('user', 'admin').default('user'),
});

function validateJoi(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          details: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        },
      });
    }
    req.body = value;
    next();
  };
}
```

### Zod vs Joi Comparison

| Feature | Zod | Joi |
|---|---|---|
| TypeScript inference | Built-in (`z.infer<typeof schema>`) | Needs separate types |
| Bundle size | Smaller | Larger |
| API style | Functional chaining | Fluent chaining |
| Ecosystem | Growing fast | Mature, widely used |
| Error format | `ZodError` with `issues[]` | `ValidationError` with `details[]` |

---

## Middleware Patterns

### Authentication Middleware

```javascript
import jwt from 'jsonwebtoken';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing token' } });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
}

// Role-based authorization
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }
    next();
  };
}

app.delete('/api/users/:id', authenticate, authorize('admin'), deleteUser);
```

### CORS Middleware

```javascript
import cors from 'cors';

app.use(cors({
  origin: ['https://example.com', 'https://staging.example.com'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,  // preflight cache: 24 hours
}));
```

### Rate Limiting Middleware

```javascript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // limit per window per IP
  standardHeaders: true,      // RateLimit-* headers
  legacyHeaders: false,
  message: { error: { message: 'Too many requests' } },
});

app.use('/api/', apiLimiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
```

### Logging with Morgan

```javascript
import morgan from 'morgan';

// Development
app.use(morgan('dev'));  // :method :url :status :response-time ms

// Production — structured JSON
morgan.token('body', (req) => JSON.stringify(req.body));
app.use(morgan(
  '{"method":":method","url":":url","status":":status","duration":":response-time ms","ip":":remote-addr"}',
  { stream: { write: (msg) => logger.info(JSON.parse(msg)) } }
));
```

---

## Dependency Injection

### Manual DI (No Framework)

```javascript
// services/userService.js
export function createUserService({ userRepo, emailService, logger }) {
  return {
    async register(data) {
      logger.info('Registering user', { email: data.email });
      const user = await userRepo.create(data);
      await emailService.sendWelcome(user);
      return user;
    },

    async findById(id) {
      return userRepo.findById(id);
    },
  };
}

// container.js — composition root
import { createUserService } from './services/userService.js';
import { createUserRepo } from './repos/userRepo.js';
import { createEmailService } from './services/emailService.js';
import { logger } from './lib/logger.js';

const userRepo = createUserRepo({ db, logger });
const emailService = createEmailService({ mailer, logger });
const userService = createUserService({ userRepo, emailService, logger });

export { userService };

// routes/users.js
import { userService } from '../container.js';

router.post('/', validate(CreateUserSchema), async (req, res) => {
  const user = await userService.register(req.body);
  res.status(201).json({ data: user });
});
```

### DI with Awilix

```javascript
import { createContainer, asClass, asFunction, Lifetime } from 'awilix';

const container = createContainer();

container.register({
  // Repositories
  userRepo: asClass(UserRepository).scoped(),

  // Services
  userService: asClass(UserService).scoped(),
  emailService: asClass(EmailService).singleton(),

  // Infrastructure
  logger: asFunction(() => createLogger()).singleton(),
  db: asFunction(() => connectDB()).singleton(),
});

// Per-request scope
app.use((req, res, next) => {
  req.scope = container.createScope();
  next();
});

app.get('/api/users/:id', async (req, res) => {
  const userService = req.scope.resolve('userService');
  const user = await userService.findById(req.params.id);
  res.json({ data: user });
});
```

---

## Custom Error Classes

```javascript
// errors/AppError.js
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;  // distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super('Validation failed', 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

// Usage in route handlers
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json({ data: user });
}));
```

---

## File Uploads

```javascript
import multer from 'multer';
import path from 'node:path';

// Disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError([{ field: 'file', message: 'Only JPEG, PNG, and WebP are allowed' }]));
  }
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Single file upload
app.post('/api/avatar', authenticate, upload.single('avatar'), (req, res) => {
  res.json({ data: { url: `/uploads/${req.file.filename}` } });
});

// Multiple files
app.post('/api/gallery', authenticate, upload.array('photos', 10), (req, res) => {
  const urls = req.files.map((f) => `/uploads/${f.filename}`);
  res.json({ data: { urls } });
});

// Upload to S3 using memory storage
const memoryUpload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload-s3', memoryUpload.single('file'), async (req, res) => {
  const { buffer, mimetype, originalname } = req.file;
  const key = `uploads/${Date.now()}-${originalname}`;

  await s3.putObject({
    Bucket: 'my-bucket',
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }).promise();

  res.json({ data: { url: `https://my-bucket.s3.amazonaws.com/${key}` } });
});
```

---

## Server-Sent Events (SSE)

SSE provides a one-way channel from server to client over HTTP. Simpler than WebSocket for broadcast/push scenarios.

```javascript
app.get('/api/events', authenticate, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial connection event
  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Send events
  function sendEvent(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Listen for events (e.g., from Redis Pub/Sub or EventEmitter)
  const handler = (notification) => {
    if (notification.userId === req.user.id) {
      sendEvent('notification', notification);
    }
  };

  notificationEmitter.on('new', handler);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    notificationEmitter.off('new', handler);
  });
});
```

---

## WebSocket

```javascript
import { WebSocketServer } from 'ws';
import http from 'node:http';

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Connection map for user tracking
const clients = new Map();

wss.on('connection', (ws, req) => {
  const userId = authenticateWs(req); // parse token from query/cookie
  clients.set(userId, ws);

  ws.on('message', (raw) => {
    const message = JSON.parse(raw);

    switch (message.type) {
      case 'chat':
        broadcastToRoom(message.roomId, {
          type: 'chat',
          from: userId,
          text: message.text,
          timestamp: Date.now(),
        });
        break;

      case 'typing':
        broadcastToRoom(message.roomId, {
          type: 'typing',
          from: userId,
        }, [userId]); // exclude sender
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for user ${userId}:`, err);
  });
});

function broadcastToRoom(roomId, data, excludeIds = []) {
  const members = getRoomMembers(roomId);
  const payload = JSON.stringify(data);

  for (const memberId of members) {
    if (excludeIds.includes(memberId)) continue;
    const ws = clients.get(memberId);
    if (ws?.readyState === ws?.OPEN) {
      ws.send(payload);
    }
  }
}

server.listen(3000);
```

---

## API Versioning

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| URL path | `/api/v1/users` | Clear, easy routing | URL pollution |
| Header | `Accept: application/vnd.api.v2+json` | Clean URLs | Less discoverable |
| Query param | `/api/users?version=2` | Easy to implement | Caching issues |

```javascript
// URL path versioning (most common)
import v1Router from './routes/v1/index.js';
import v2Router from './routes/v2/index.js';

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Header-based versioning middleware
function versionRouter(versions) {
  return (req, res, next) => {
    const accept = req.headers.accept || '';
    const match = accept.match(/application\/vnd\.api\.v(\d+)\+json/);
    const version = match ? parseInt(match[1]) : Math.max(...Object.keys(versions).map(Number));

    const router = versions[version];
    if (!router) {
      return res.status(400).json({ error: { message: `API version ${version} not supported` } });
    }
    router(req, res, next);
  };
}

app.use('/api/users', versionRouter({
  1: v1UsersRouter,
  2: v2UsersRouter,
}));
```

---

## Security

### Helmet

```javascript
import helmet from 'helmet';

app.use(helmet());  // sets many security headers at once

// Equivalent to:
// X-Content-Type-Options: nosniff
// X-Frame-Options: DENY
// X-XSS-Protection: 0  (modern browsers use CSP instead)
// Strict-Transport-Security: max-age=15552000; includeSubDomains
// Content-Security-Policy: default-src 'self'
```

### CSRF Protection

```javascript
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// For SPA: send token via endpoint
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// For APIs with JWT: CSRF is generally not needed
// because the token is sent in Authorization header, not cookies
```

### XSS Prevention

```javascript
// 1. Always sanitize user input before storing
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty);
}

// 2. Set Content-Security-Policy header
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
}));

// 3. Escape output in templates (EJS example)
// Use <%= %> (escaped) NOT <%- %> (unescaped)
```

### Security Best Practices Checklist

| Practice | Implementation |
|---|---|
| Input validation | Zod/Joi on every endpoint |
| SQL injection | Parameterized queries / ORM |
| XSS | Sanitize HTML, CSP headers |
| CSRF | Token-based for cookies, not needed for Bearer tokens |
| Rate limiting | express-rate-limit |
| HTTPS | TLS termination at LB/reverse proxy |
| Auth | JWT with short expiry + refresh tokens |
| Headers | helmet middleware |
| Dependencies | `npm audit`, Snyk, Dependabot |
| Secrets | Environment variables, never commit |

---

## NestJS Concepts

NestJS is an opinionated, TypeScript-first framework inspired by Angular's architecture.

### Module

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // available to other modules
})
export class UsersModule {}
```

### Controller

```typescript
// users.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

### Service

```typescript
// users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }
}
```

### Dependency Injection in NestJS

```typescript
// NestJS uses constructor injection with decorators

// Custom provider
const CONFIG_PROVIDER = {
  provide: 'APP_CONFIG',
  useFactory: () => ({
    apiKey: process.env.API_KEY,
    dbUrl: process.env.DATABASE_URL,
  }),
};

@Module({
  providers: [CONFIG_PROVIDER, UsersService],
})
export class AppModule {}

// Inject in service
@Injectable()
export class UsersService {
  constructor(@Inject('APP_CONFIG') private config: AppConfig) {}
}
```

### NestJS vs Express Comparison

| Feature | Express | NestJS |
|---|---|---|
| Structure | Unopinionated | Opinionated (modules) |
| Language | JavaScript / TypeScript | TypeScript-first |
| DI | Manual | Built-in (decorators) |
| Validation | Manual (Zod/Joi) | class-validator + pipes |
| Testing | Manual setup | Built-in testing module |
| Learning curve | Low | Medium-High |
| Use case | Small-medium APIs | Large enterprise apps |

---

## Production Project Structure

```
src/
  app.js                  # Express app setup (middleware, routes)
  server.js               # HTTP server + graceful shutdown
  config/
    index.js              # Centralized config from env vars
    database.js           # DB connection config
  routes/
    index.js              # Mount all route modules
    users.js              # /api/users routes
    orders.js             # /api/orders routes
  controllers/
    usersController.js    # Request/response handling
    ordersController.js
  services/
    userService.js        # Business logic
    orderService.js
    emailService.js
  repositories/
    userRepo.js           # Database queries
    orderRepo.js
  models/
    User.js               # ORM model / schema
    Order.js
  middleware/
    authenticate.js
    authorize.js
    validate.js
    errorHandler.js
    requestLogger.js
  errors/
    AppError.js           # Custom error classes
  utils/
    logger.js             # Winston / Pino
    helpers.js
  validators/
    userSchemas.js        # Zod / Joi schemas
  container.js            # DI composition root
  __tests__/
    integration/
    unit/
```

---

## Interview Tips

1. **Explain the middleware pipeline.** Draw the request flow: request -> middleware stack -> route handler -> error handler -> response.

2. **Error handling is critical.** Distinguish operational errors (user input, network) from programming errors (bugs). Only show safe messages to clients in production.

3. **Validation belongs at the boundary.** Validate on entry (controller/route), not deep in business logic.

4. **Know REST conventions.** Use nouns for resources, correct HTTP methods, proper status codes, and consistent response format.

5. **Security is not optional.** Mention helmet, rate limiting, input validation, parameterized queries, and CORS in every API design discussion.

6. **NestJS signals you think about architecture.** Even if the team uses Express, discussing NestJS patterns shows you value structure, DI, and testability.

---

## Quick Reference / Cheat Sheet

```
Express Middleware Order:
  1. helmet()                    # Security headers
  2. cors()                      # CORS
  3. express.json()              # Parse JSON
  4. requestId()                 # Attach request ID
  5. requestLogger()             # Log requests
  6. rateLimit()                 # Rate limiting
  7. routes                      # App routes
  8. 404 handler                 # Not found
  9. errorHandler()              # Centralized error handler

HTTP Methods:
  GET    -> Read (200)
  POST   -> Create (201)
  PUT    -> Replace (200)
  PATCH  -> Update (200)
  DELETE -> Remove (204)

Error Handling Checklist:
  [ ] asyncHandler wrapper for all async routes
  [ ] Custom AppError class with statusCode + isOperational
  [ ] Centralized error middleware (4 params)
  [ ] Different behavior for dev vs prod
  [ ] Log errors with context (request ID, user)
  [ ] Graceful shutdown on unhandledRejection / uncaughtException

NestJS Building Blocks:
  Module     -> organizes code into cohesive blocks
  Controller -> handles HTTP requests, delegates to services
  Service    -> business logic (Injectable)
  Guard      -> authentication / authorization
  Pipe       -> validation / transformation
  Interceptor -> modify request/response (logging, caching)
  Filter     -> handle exceptions
```
