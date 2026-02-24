/**
 * =============================================================================
 * FILE 10: EXPRESS.JS, WEB PATTERNS, AND API DESIGN
 * =============================================================================
 *
 * Senior Node.js Interview Prep
 * Runnable: node 10_express_and_web.js
 *
 * Topics covered:
 *   1.  Express.js basics: routing, middleware, error handling
 *   2.  RESTful API design conventions
 *   3.  Request validation patterns (Joi/Zod shape)
 *   4.  Middleware patterns: auth, logging, CORS, rate limiting
 *   5.  Dependency injection in Express
 *   6.  Error handling middleware and custom error classes
 *   7.  File upload handling patterns
 *   8.  Streaming responses (SSE - Server-Sent Events)
 *   9.  WebSocket basics (ws pattern)
 *  10.  API versioning strategies
 *  11.  Request/response lifecycle
 *  12.  Security: helmet patterns, CSRF, XSS prevention
 *  13.  NestJS concepts: modules, controllers, services, decorators
 *  14.  Project structure for production Express app
 *
 * NOTE: We do NOT start a real HTTP server. All patterns are demonstrated
 *       using simulated request/response objects and direct function calls.
 */

'use strict';

const { EventEmitter } = require('node:events');

// =============================================================================
// SECTION 1: SIMULATED EXPRESS-LIKE FRAMEWORK
// =============================================================================
// We build a minimal Express-like framework so every pattern below is runnable.
// This mirrors Express's actual internal architecture:
//   App -> Router -> Layer (route + middleware stack)

/**
 * Simulated HTTP request object.
 * In Express, this wraps Node's http.IncomingMessage.
 */
class MockRequest {
  constructor({ method = 'GET', path = '/', headers = {}, body = null, query = {}, params = {} } = {}) {
    this.method = method.toUpperCase();
    this.path = path;
    this.url = path;
    this.originalUrl = path;
    this.headers = { 'content-type': 'application/json', ...headers };
    this.body = body;
    this.query = query;
    this.params = params;
    this.ip = '127.0.0.1';
    this.cookies = {};
    // Express adds these via middleware:
    this.user = null; // set by auth middleware
  }
  get(headerName) {
    return this.headers[headerName.toLowerCase()];
  }
}

/**
 * Simulated HTTP response object.
 * In Express, this wraps Node's http.ServerResponse.
 */
class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this._body = null;
    this._json = null;
    this._sent = false;
    this._redirectUrl = null;
  }
  status(code) {
    this.statusCode = code;
    return this; // chainable
  }
  set(name, value) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  header(name, value) {
    return this.set(name, value);
  }
  json(data) {
    this._json = data;
    this._body = JSON.stringify(data);
    this._sent = true;
    this.headers['content-type'] = 'application/json';
    return this;
  }
  send(data) {
    this._body = data;
    this._sent = true;
    return this;
  }
  redirect(url) {
    this.statusCode = 302;
    this._redirectUrl = url;
    this._sent = true;
    return this;
  }
  end() {
    this._sent = true;
    return this;
  }
  // SSE helpers
  write(chunk) {
    if (!this._body) this._body = '';
    this._body += chunk;
    return true;
  }
  flush() {} // no-op for simulation
}

/**
 * Minimal Express-like application.
 *
 * Express internals (interview knowledge):
 *   - app.use() registers middleware onto the app's router stack
 *   - app.get/post/etc. register route handlers on the router
 *   - When a request arrives, Express walks the middleware stack top-to-bottom
 *   - Each middleware calls next() to pass control or sends a response
 *   - Error-handling middleware has 4 params: (err, req, res, next)
 */
class MiniExpress {
  constructor() {
    this.middlewareStack = [];
    this.routes = [];
    this.settings = new Map();
  }

  set(key, value) { this.settings.set(key, value); }
  get(pathOrKey, ...handlers) {
    if (handlers.length === 0) return this.settings.get(pathOrKey);
    this.routes.push({ method: 'GET', path: pathOrKey, handlers });
  }
  post(path, ...handlers) {
    this.routes.push({ method: 'POST', path, handlers });
  }
  put(path, ...handlers) {
    this.routes.push({ method: 'PUT', path, handlers });
  }
  patch(path, ...handlers) {
    this.routes.push({ method: 'PATCH', path, handlers });
  }
  delete(path, ...handlers) {
    this.routes.push({ method: 'DELETE', path, handlers });
  }

  use(...args) {
    // use(path, handler) or use(handler)
    if (typeof args[0] === 'string') {
      this.middlewareStack.push({ path: args[0], handler: args[1] });
    } else {
      this.middlewareStack.push({ path: '/', handler: args[0] });
    }
  }

  /**
   * Simulate handling a request through the middleware + route pipeline.
   */
  async handle(req, res) {
    const allMiddleware = [...this.middlewareStack];

    // Find matching route
    const route = this.routes.find(
      (r) => r.method === req.method && this._matchPath(r.path, req.path, req)
    );

    // Build the full handler chain: global middleware -> route middleware -> route handler
    const handlers = allMiddleware
      .filter((m) => req.path.startsWith(m.path === '/' ? '/' : m.path))
      .map((m) => m.handler);

    if (route) {
      handlers.push(...route.handlers);
    } else {
      // 404 if no route matches
      handlers.push((_req, _res) => {
        _res.status(404).json({ error: 'Not Found' });
      });
    }

    // Walk the chain (like Express's next() mechanism)
    let idx = 0;
    const next = async (err) => {
      if (res._sent) return;
      const handler = handlers[idx++];
      if (!handler) return;

      try {
        // Error-handling middleware has 4 params
        if (err && handler.length === 4) {
          await handler(err, req, res, next);
        } else if (!err && handler.length <= 3) {
          await handler(req, res, next);
        } else {
          // Skip non-matching middleware
          await next(err);
        }
      } catch (thrownErr) {
        await next(thrownErr);
      }
    };

    await next();
  }

  /**
   * Simple path matching with :param support.
   * Real Express uses path-to-regexp for full pattern matching.
   */
  _matchPath(pattern, requestPath, req) {
    const patternParts = pattern.split('/');
    const pathParts = requestPath.split('/');
    if (patternParts.length !== pathParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        // Extract param
        req.params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }
    return true;
  }
}

// =============================================================================
// SECTION 2: CUSTOM ERROR CLASSES
// =============================================================================
//
// Interview point: Custom errors allow middleware to distinguish between
// operational errors (expected, like 404) and programmer errors (bugs).

class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Operational errors are expected and handled
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 400, 'VALIDATION_ERROR');
    this.errors = errors; // Array of field-level errors
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class TooManyRequestsError extends AppError {
  constructor(retryAfterSeconds = 60) {
    super('Too many requests', 429, 'RATE_LIMITED');
    this.retryAfter = retryAfterSeconds;
  }
}

// =============================================================================
// SECTION 3: REQUEST VALIDATION (Zod/Joi-like shape)
// =============================================================================
//
// In production, use Zod (TypeScript-first) or Joi for schema validation.
// Below we build a mini validator that shows the pattern.

class Schema {
  constructor() {
    this.fields = {};
  }

  static object(fields) {
    const schema = new Schema();
    schema.fields = fields;
    return schema;
  }

  validate(data) {
    const errors = [];
    for (const [field, rules] of Object.entries(this.fields)) {
      const value = data?.[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push({ field, message: `${field} must be a number` });
      }
      if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({ field, message: `${field} must be a valid email` });
      }
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      }
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        errors.push({ field, message: `${field} must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
        errors.push({ field, message: `${field} must be at most ${rules.max}` });
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, message: `${field} has invalid format` });
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Validation middleware factory.
 * Usage: app.post('/users', validate(createUserSchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const { valid, errors } = schema.validate(req.body);
    if (!valid) {
      throw new ValidationError(errors);
    }
    next();
  };
}

// =============================================================================
// SECTION 4: MIDDLEWARE PATTERNS
// =============================================================================

/**
 * Request logging middleware.
 * In production: use morgan or pino-http.
 */
function requestLogger(req, res, next) {
  req._startTime = Date.now();
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    const duration = Date.now() - req._startTime;
    req._log = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    return originalJson(data);
  };
  next();
}

/**
 * CORS middleware.
 *
 * Interview points:
 *   - CORS is enforced by the BROWSER, not the server
 *   - Simple requests (GET, POST with form data) go straight through
 *   - Preflighted requests send an OPTIONS request first
 *   - Access-Control-Allow-Origin: specific origin or * (not both with credentials)
 *   - Access-Control-Allow-Credentials: true allows cookies
 *   - Access-Control-Max-Age: caches preflight response
 */
function cors(options = {}) {
  const {
    origin = '*',
    methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders = 'Content-Type,Authorization',
    credentials = false,
    maxAge = 86400,
  } = options;

  return (req, res, next) => {
    const originValue = typeof origin === 'function' ? origin(req.get('origin')) : origin;
    res.set('Access-Control-Allow-Origin', originValue);
    res.set('Access-Control-Allow-Methods', methods);
    res.set('Access-Control-Allow-Headers', allowedHeaders);
    if (credentials) res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Max-Age', String(maxAge));

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  };
}

/**
 * Authentication middleware.
 *
 * Interview points:
 *   - JWT (JSON Web Token): header.payload.signature, stateless
 *   - Bearer token in Authorization header
 *   - Session-based: server stores session data, client sends session ID cookie
 *   - OAuth 2.0: authorization code flow, client credentials
 */
function authenticate(req, res, next) {
  const authHeader = req.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  // In production: jwt.verify(token, secret)
  // Simulated token validation:
  if (token === 'valid-token') {
    req.user = { id: 'user_123', email: 'alice@example.com', roles: ['user', 'admin'] };
    next();
  } else {
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Role-based authorization middleware factory.
 * Usage: app.delete('/admin/users/:id', authenticate, authorize('admin'), handler)
 */
function authorize(...requiredRoles) {
  return (req, res, next) => {
    if (!req.user) throw new UnauthorizedError();
    const hasRole = requiredRoles.some((role) => req.user.roles.includes(role));
    if (!hasRole) throw new ForbiddenError();
    next();
  };
}

/**
 * Rate limiting middleware (in-memory, per-IP).
 * In production: use Redis-backed rate limiter (see file 09).
 */
function rateLimit({ windowMs = 60_000, max = 100 } = {}) {
  const hits = new Map(); // ip -> { count, resetTime }

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const record = hits.get(key);

    if (!record || now > record.resetTime) {
      hits.set(key, { count: 1, resetTime: now + windowMs });
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(max - 1));
      next();
    } else if (record.count < max) {
      record.count++;
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(max - record.count));
      next();
    } else {
      throw new TooManyRequestsError(Math.ceil((record.resetTime - now) / 1000));
    }
  };
}

/**
 * Security headers middleware (helmet-like).
 *
 * Interview points:
 *   - Content-Security-Policy: controls which resources the browser can load
 *   - X-Content-Type-Options: nosniff prevents MIME type sniffing
 *   - X-Frame-Options: DENY prevents clickjacking
 *   - Strict-Transport-Security: enforces HTTPS
 *   - X-XSS-Protection: deprecated but still sometimes set
 *   - Referrer-Policy: controls the Referer header
 */
function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '0'); // Modern CSP replaces this
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('Content-Security-Policy', "default-src 'self'");
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Request ID middleware (for distributed tracing).
 */
function requestId(req, res, next) {
  const id = req.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = id;
  res.set('X-Request-Id', id);
  next();
}

// =============================================================================
// SECTION 5: ERROR HANDLING MIDDLEWARE
// =============================================================================
//
// Interview point: Express error handlers have FOUR parameters (err, req, res, next).
// They MUST be registered AFTER all routes. Express detects the 4-param signature
// and treats the middleware as an error handler.

function errorHandler(err, req, res, next) {
  // Log the error (in production: use structured logging)
  const errorLog = {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode || 500,
    stack: err.isOperational ? undefined : err.stack,
    requestId: req.requestId,
  };

  // Don't leak internal errors to the client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err instanceof ValidationError ? { details: err.errors } : {}),
        ...(err instanceof TooManyRequestsError ? { retryAfter: err.retryAfter } : {}),
      },
    });
  } else {
    // Programmer error - don't expose details
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }

  return errorLog; // returned for testing purposes
}

// =============================================================================
// SECTION 6: DEPENDENCY INJECTION PATTERN
// =============================================================================
//
// DI decouples components, making them testable and swappable.
// Express doesn't have built-in DI; common approaches:
//   1. Closure-based (factory functions)
//   2. Class-based with constructor injection
//   3. Container-based (awilix, tsyringe, InversifyJS)

/**
 * Approach 1: Factory function (most common in Express).
 * The factory receives dependencies and returns a router/handler.
 */
function createUserRouter(userService, logger) {
  // In real Express: const router = express.Router();
  const routes = {};

  routes['GET /users'] = async (req, res) => {
    const users = await userService.findAll();
    logger.info('Fetched all users');
    res.json({ data: users });
  };

  routes['GET /users/:id'] = async (req, res) => {
    const user = await userService.findById(req.params.id);
    if (!user) throw new NotFoundError('User');
    res.json({ data: user });
  };

  routes['POST /users'] = async (req, res) => {
    const user = await userService.create(req.body);
    logger.info(`Created user ${user.id}`);
    res.status(201).json({ data: user });
  };

  return routes;
}

/**
 * Approach 2: Class with constructor injection.
 */
class UserController {
  constructor(userService, authService) {
    this.userService = userService;
    this.authService = authService;
  }

  async getProfile(req, res) {
    const user = await this.userService.findById(req.user.id);
    res.json({ data: user });
  }

  async updateProfile(req, res) {
    const user = await this.userService.update(req.user.id, req.body);
    res.json({ data: user });
  }
}

/**
 * Approach 3: Simple DI container.
 * Production: use awilix or tsyringe.
 */
class Container {
  constructor() {
    this.registrations = new Map();
    this.singletons = new Map();
  }

  register(name, factory, { singleton = false } = {}) {
    this.registrations.set(name, { factory, singleton });
  }

  resolve(name) {
    const reg = this.registrations.get(name);
    if (!reg) throw new Error(`Dependency '${name}' not registered`);

    if (reg.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, reg.factory(this));
      }
      return this.singletons.get(name);
    }
    return reg.factory(this);
  }
}

// =============================================================================
// SECTION 7: FILE UPLOAD HANDLING PATTERNS
// =============================================================================
//
// In production: use multer (disk/memory storage) for multipart/form-data.
//
// Key concepts:
//   - Multer adds files to req.file (single) or req.files (multiple)
//   - Storage engines: disk storage, memory storage, S3 (multer-s3)
//   - File validation: size limits, MIME type checks
//   - Streaming uploads for large files (avoid memory issues)

/**
 * Simulated multer-like middleware.
 */
function fileUpload(options = {}) {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'] } = options;

  return (req, res, next) => {
    // In real multer, this parses multipart form data
    if (req.body?._file) {
      const file = req.body._file;
      if (file.size > maxSize) {
        throw new ValidationError([{ field: 'file', message: `File exceeds max size of ${maxSize} bytes` }]);
      }
      if (!allowedTypes.includes(file.mimetype)) {
        throw new ValidationError([{ field: 'file', message: `File type ${file.mimetype} not allowed` }]);
      }
      req.file = {
        fieldname: file.fieldname || 'file',
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer || Buffer.alloc(0),
        destination: '/uploads/',
        filename: `${Date.now()}-${file.originalname}`,
        path: `/uploads/${Date.now()}-${file.originalname}`,
      };
    }
    next();
  };
}

// =============================================================================
// SECTION 8: STREAMING RESPONSES - SSE (Server-Sent Events)
// =============================================================================
//
// SSE is a one-way channel from server to client over HTTP.
// Format: each message is "data: <content>\n\n"
//
// Interview points:
//   - SSE vs WebSocket: SSE is simpler, HTTP-based, one-direction
//   - Auto-reconnection built into EventSource API
//   - Event types: data, event, id, retry
//   - Good for: notifications, live feeds, progress updates

function sseHandler(req, res) {
  res.set('Content-Type', 'text/event-stream');
  res.set('Cache-Control', 'no-cache');
  res.set('Connection', 'keep-alive');

  // Send events
  const events = [
    { event: 'message', data: { text: 'Hello!' } },
    { event: 'notification', data: { type: 'info', text: 'New update available' } },
    { event: 'progress', data: { percent: 50 } },
    { event: 'progress', data: { percent: 100 } },
  ];

  for (const evt of events) {
    // SSE format: "event: <type>\ndata: <json>\n\n"
    res.write(`event: ${evt.event}\n`);
    res.write(`data: ${JSON.stringify(evt.data)}\n\n`);
  }

  return events;
}

// =============================================================================
// SECTION 9: WEBSOCKET BASICS (ws pattern)
// =============================================================================
//
// WebSocket provides full-duplex communication over a single TCP connection.
//
// Interview points:
//   - HTTP Upgrade handshake initiates the connection
//   - Both sides can send/receive at any time
//   - Binary and text frames supported
//   - Use cases: chat, gaming, real-time dashboards
//   - Libraries: ws (Node.js), Socket.IO (adds rooms, namespaces, fallbacks)

class MockWebSocketServer extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  simulateConnection(clientSocket) {
    this.clients.add(clientSocket);
    clientSocket._server = this;
    this.emit('connection', clientSocket);
  }

  broadcast(data, excludeClient = null) {
    for (const client of this.clients) {
      if (client !== excludeClient && client.readyState === 'OPEN') {
        client.send(data);
      }
    }
  }
}

class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 'OPEN';
    this.messages = [];
    this._server = null;
  }

  send(data) {
    if (this.readyState !== 'OPEN') throw new Error('WebSocket is not open');
    this.messages.push({ direction: 'outgoing', data, timestamp: Date.now() });
    this.emit('outgoing', data);
  }

  receive(data) {
    this.messages.push({ direction: 'incoming', data, timestamp: Date.now() });
    this.emit('message', data);
  }

  close() {
    this.readyState = 'CLOSED';
    this._server?.clients.delete(this);
    this.emit('close');
  }
}

/**
 * Example WebSocket chat server setup.
 *
 * Real code with 'ws' library:
 *
 *   const WebSocket = require('ws');
 *   const wss = new WebSocket.Server({ port: 8080 });
 *
 *   wss.on('connection', (ws) => {
 *     ws.on('message', (message) => {
 *       // Broadcast to all other clients
 *       wss.clients.forEach((client) => {
 *         if (client !== ws && client.readyState === WebSocket.OPEN) {
 *           client.send(message);
 *         }
 *       });
 *     });
 *     ws.on('close', () => console.log('Client disconnected'));
 *   });
 */
function setupChatServer(wss) {
  const chatLog = [];

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'system', text: 'Welcome to the chat!' }));

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      const chatMsg = { type: 'chat', user: msg.user, text: msg.text, timestamp: Date.now() };
      chatLog.push(chatMsg);
      // Broadcast to all other connected clients
      wss.broadcast(JSON.stringify(chatMsg), ws);
    });
  });

  return chatLog;
}

// =============================================================================
// SECTION 10: API VERSIONING STRATEGIES
// =============================================================================
//
// Three main approaches:
//
// 1. URL Path versioning: /api/v1/users, /api/v2/users
//    Pros: explicit, easy to understand, cacheable
//    Cons: duplicates routes
//
// 2. Header versioning: Accept: application/vnd.myapi.v2+json
//    Pros: clean URLs
//    Cons: hidden, harder to test
//
// 3. Query parameter: /api/users?version=2
//    Pros: easy to implement
//    Cons: can't be cached independently, messy

function apiVersionRouter() {
  const versions = {};

  return {
    version(v, routes) {
      versions[v] = routes;
    },
    // Middleware that extracts version and routes to correct handler
    middleware(req, res, next) {
      // Strategy 1: URL path - /api/v1/resource -> version=1
      const pathMatch = req.path.match(/^\/api\/v(\d+)\//);
      // Strategy 2: Accept header
      const headerMatch = req.get('accept')?.match(/application\/vnd\.myapi\.v(\d+)\+json/);
      // Strategy 3: Query param
      const queryVersion = req.query.version;

      const version = pathMatch?.[1] || headerMatch?.[1] || queryVersion || '1';
      req.apiVersion = version;

      const versionRoutes = versions[version];
      if (!versionRoutes) {
        res.status(400).json({ error: `API version ${version} not supported` });
        return;
      }

      // Resolve the handler (simplified)
      const resourcePath = req.path.replace(/^\/api\/v\d+/, '');
      const handler = versionRoutes[`${req.method} ${resourcePath}`];
      if (handler) {
        handler(req, res, next);
      } else {
        next();
      }
    },
  };
}

// =============================================================================
// SECTION 11: REQUEST/RESPONSE LIFECYCLE
// =============================================================================
//
// The full lifecycle of an Express request:
//
//   1. Client sends HTTP request
//   2. Node.js http module receives it, creates IncomingMessage + ServerResponse
//   3. Express wraps them into req/res with extended methods
//   4. Request enters middleware pipeline (top to bottom of app.use())
//   5. Each middleware either:
//      a. Calls next() to pass to next middleware
//      b. Sends a response (res.json/send/end)
//      c. Calls next(err) to trigger error handling
//   6. If no middleware handles it, Express sends 404
//   7. Error middleware catches thrown errors or next(err)
//   8. Response is sent back to client
//   9. "finish" event fires on res

// =============================================================================
// SECTION 12: SECURITY PATTERNS
// =============================================================================
//
// XSS Prevention:
//   - Always escape user input in HTML output
//   - Use Content-Security-Policy header
//   - Use httpOnly cookies (JS can't read them)
//   - Use DOMPurify on client side
//
// CSRF Prevention:
//   - CSRF token: server generates token, client sends it with each request
//   - SameSite cookie attribute (Lax or Strict)
//   - Check Origin/Referer headers
//
// SQL Injection:
//   - Use parameterized queries (never string concatenation)
//   - Use ORM (Prisma, TypeORM, Sequelize)
//
// Other:
//   - bcrypt for password hashing (cost factor 12+)
//   - Helmet.js for security headers
//   - Input validation on every endpoint
//   - Rate limiting
//   - HTTPS everywhere

function sanitizeHtml(input) {
  // Basic HTML entity encoding to prevent XSS
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function csrfProtection() {
  const tokens = new Map();

  return {
    generateToken(sessionId) {
      const token = `csrf_${Math.random().toString(36).slice(2)}`;
      tokens.set(sessionId, token);
      return token;
    },
    middleware(req, res, next) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      const sessionId = req.cookies?.sessionId || req.get('x-session-id');
      const csrfToken = req.get('x-csrf-token') || req.body?._csrf;
      if (!sessionId || tokens.get(sessionId) !== csrfToken) {
        throw new ForbiddenError('Invalid CSRF token');
      }
      next();
    },
  };
}

// =============================================================================
// SECTION 13: NestJS CONCEPTS
// =============================================================================
//
// NestJS is a framework for building scalable server-side applications.
// It uses TypeScript decorators and is inspired by Angular's architecture.
//
// Key concepts (explained as simulated patterns since we can't use decorators):
//
// @Module()     - Organizes code into cohesive blocks
// @Controller() - Handles incoming requests for a specific route prefix
// @Injectable() - Marks a class as a provider that can be injected
// @Get(), @Post() etc. - Route method decorators
// Guards        - Authorization checks before handler executes
// Pipes         - Input validation/transformation
// Interceptors  - AOP-like cross-cutting concerns (logging, caching, timeout)
// Filters       - Exception handling

/**
 * NestJS-style module/controller/service without TypeScript decorators.
 * Shows the architecture pattern.
 */

// Service (Injectable)
class CatService {
  constructor() {
    this.cats = [
      { id: 1, name: 'Whiskers', age: 3 },
      { id: 2, name: 'Mittens', age: 5 },
    ];
  }

  findAll() {
    return this.cats;
  }

  findOne(id) {
    return this.cats.find((c) => c.id === Number(id));
  }

  create(dto) {
    const cat = { id: this.cats.length + 1, ...dto };
    this.cats.push(cat);
    return cat;
  }
}

// Controller (decorated routes would look like:)
//   @Controller('cats')
//   class CatsController {
//     constructor(private catsService: CatsService) {}
//
//     @Get()
//     findAll() { return this.catsService.findAll(); }
//
//     @Get(':id')
//     findOne(@Param('id') id: string) { return this.catsService.findOne(id); }
//
//     @Post()
//     @UsePipes(new ValidationPipe())
//     create(@Body() createCatDto: CreateCatDto) { return this.catsService.create(createCatDto); }
//   }

class CatsController {
  constructor(catsService) {
    this.catsService = catsService;
    // Route metadata (in NestJS, decorators provide this)
    this.routes = {
      'GET /cats': (req, res) => res.json(this.catsService.findAll()),
      'GET /cats/:id': (req, res) => {
        const cat = this.catsService.findOne(req.params.id);
        if (!cat) throw new NotFoundError('Cat');
        res.json(cat);
      },
      'POST /cats': (req, res) => {
        const cat = this.catsService.create(req.body);
        res.status(201).json(cat);
      },
    };
  }
}

// Module
//   @Module({
//     imports: [DatabaseModule],
//     controllers: [CatsController],
//     providers: [CatsService],
//     exports: [CatsService],
//   })
//   class CatsModule {}

class CatsModule {
  static register() {
    const service = new CatService();
    const controller = new CatsController(service);
    return { controller, service, routes: controller.routes };
  }
}

/**
 * NestJS Guard example (checks authorization before handler):
 *
 *   @Injectable()
 *   class RolesGuard implements CanActivate {
 *     canActivate(context: ExecutionContext): boolean {
 *       const request = context.switchToHttp().getRequest();
 *       const requiredRoles = Reflect.getMetadata('roles', context.getHandler());
 *       return requiredRoles.some(role => request.user.roles.includes(role));
 *     }
 *   }
 *
 * NestJS Interceptor example (logging):
 *
 *   @Injectable()
 *   class LoggingInterceptor implements NestInterceptor {
 *     intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
 *       const now = Date.now();
 *       return next.handle().pipe(
 *         tap(() => console.log(`After... ${Date.now() - now}ms`))
 *       );
 *     }
 *   }
 *
 * NestJS Pipe example (validation):
 *
 *   @Injectable()
 *   class ValidationPipe implements PipeTransform {
 *     transform(value: any, metadata: ArgumentMetadata) {
 *       const schema = Joi.object(...);
 *       const { error } = schema.validate(value);
 *       if (error) throw new BadRequestException('Validation failed');
 *       return value;
 *     }
 *   }
 */

// =============================================================================
// SECTION 14: PRODUCTION PROJECT STRUCTURE
// =============================================================================
//
// Recommended Express project structure (feature-based / modular):
//
// project/
// +-- src/
// |   +-- config/
// |   |   +-- index.js          # Environment config (dotenv)
// |   |   +-- database.js       # Database connection
// |   |   +-- redis.js          # Redis connection
// |   +-- middleware/
// |   |   +-- auth.js           # Authentication
// |   |   +-- errorHandler.js   # Global error handler
// |   |   +-- validate.js       # Request validation
// |   |   +-- rateLimiter.js    # Rate limiting
// |   +-- modules/
// |   |   +-- user/
// |   |   |   +-- user.controller.js  # Route handlers
// |   |   |   +-- user.service.js     # Business logic
// |   |   |   +-- user.model.js       # Database model
// |   |   |   +-- user.schema.js      # Validation schemas
// |   |   |   +-- user.routes.js      # Express Router
// |   |   |   +-- user.test.js        # Tests
// |   |   +-- auth/
// |   |   |   +-- auth.controller.js
// |   |   |   +-- auth.service.js
// |   |   |   +-- ...
// |   +-- shared/
// |   |   +-- errors/
// |   |   |   +-- AppError.js
// |   |   +-- utils/
// |   |   |   +-- logger.js
// |   |   |   +-- helpers.js
// |   +-- app.js                # Express app setup (middleware + routes)
// |   +-- server.js             # HTTP server + graceful shutdown
// +-- tests/
// |   +-- integration/
// |   +-- e2e/
// +-- .env
// +-- .eslintrc.js
// +-- jest.config.js
// +-- Dockerfile
// +-- docker-compose.yml
// +-- package.json

// =============================================================================
// DEMO / TESTS
// =============================================================================

async function main() {
  let passed = 0;
  let failed = 0;

  function assert(condition, label) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`  FAIL: ${label}`);
    }
  }

  // ── DEMO 1: Express-like app with middleware pipeline ──────────────────
  console.log('\n=== DEMO 1: Express Middleware Pipeline ===');
  {
    const app = new MiniExpress();

    // Register middleware in order (this order matters!)
    app.use(requestId);          // 1. Assign request ID
    app.use(securityHeaders);    // 2. Security headers
    app.use(cors({ origin: 'https://example.com', credentials: true }));
    app.use(requestLogger);      // 3. Log requests
    app.use(rateLimit({ windowMs: 60_000, max: 100 }));

    // Routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    app.get('/api/users/:id', authenticate, async (req, res) => {
      res.json({ data: { id: req.params.id, name: 'Alice', email: req.user.email } });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    // Test 1: Health check
    const req1 = new MockRequest({ method: 'GET', path: '/api/health' });
    const res1 = new MockResponse();
    await app.handle(req1, res1);
    assert(res1.statusCode === 200, 'Health check returns 200');
    assert(res1._json.status === 'ok', 'Health check body');
    assert(res1.headers['x-request-id'], 'Request ID header set');
    assert(res1.headers['x-content-type-options'] === 'nosniff', 'Security headers set');
    assert(res1.headers['access-control-allow-origin'] === 'https://example.com', 'CORS origin set');
    console.log(`  Health: ${JSON.stringify(res1._json)}`);
    console.log(`  Headers: ${JSON.stringify(res1.headers)}`);

    // Test 2: Authenticated route
    const req2 = new MockRequest({
      method: 'GET',
      path: '/api/users/42',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res2 = new MockResponse();
    await app.handle(req2, res2);
    assert(res2.statusCode === 200, 'Auth route returns 200');
    assert(res2._json.data.id === '42', 'Param extraction works');
    console.log(`  User: ${JSON.stringify(res2._json)}`);

    // Test 3: Unauthenticated route -> 401
    const req3 = new MockRequest({ method: 'GET', path: '/api/users/42' });
    const res3 = new MockResponse();
    await app.handle(req3, res3);
    assert(res3.statusCode === 401, 'Missing auth returns 401');
    console.log(`  Unauth: ${res3.statusCode} ${res3._json?.error?.message}`);

    // Test 4: 404
    const req4 = new MockRequest({ method: 'GET', path: '/api/nonexistent' });
    const res4 = new MockResponse();
    await app.handle(req4, res4);
    assert(res4.statusCode === 404, 'Unknown route returns 404');
    console.log(`  404: ${JSON.stringify(res4._json)}`);
  }

  // ── DEMO 2: Request Validation ─────────────────────────────────────────
  console.log('\n=== DEMO 2: Request Validation ===');
  {
    const createUserSchema = Schema.object({
      name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
      email: { type: 'email', required: true },
      age: { type: 'number', min: 18, max: 120 },
      role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
    });

    // Valid input
    const valid = createUserSchema.validate({
      name: 'Alice', email: 'alice@example.com', age: 30, role: 'user',
    });
    assert(valid.valid, 'Valid input passes');

    // Invalid input
    const invalid = createUserSchema.validate({
      name: 'A', email: 'not-an-email', age: 15, role: 'superuser',
    });
    assert(!invalid.valid, 'Invalid input fails');
    assert(invalid.errors.length === 4, 'All 4 validation errors caught');
    console.log(`  Valid: ${valid.valid}`);
    console.log(`  Invalid errors: ${invalid.errors.map((e) => e.message).join('; ')}`);

    // Validation middleware
    const app = new MiniExpress();
    app.post('/api/users', validate(createUserSchema), (req, res) => {
      res.status(201).json({ data: { id: 1, ...req.body } });
    });
    app.use(errorHandler);

    const reqBad = new MockRequest({ method: 'POST', path: '/api/users', body: { name: '' } });
    const resBad = new MockResponse();
    await app.handle(reqBad, resBad);
    assert(resBad.statusCode === 400, 'Validation middleware returns 400');
    console.log(`  Middleware: ${resBad.statusCode} ${resBad._json?.error?.code}`);
  }

  // ── DEMO 3: Dependency Injection ───────────────────────────────────────
  console.log('\n=== DEMO 3: Dependency Injection ===');
  {
    // Simulated services
    const mockUserService = {
      users: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }],
      findAll() { return this.users; },
      findById(id) { return this.users.find((u) => u.id === id); },
      create(data) { const u = { id: String(this.users.length + 1), ...data }; this.users.push(u); return u; },
    };
    const mockLogger = { info: () => {}, error: () => {} };

    // Factory-based DI
    const userRoutes = createUserRouter(mockUserService, mockLogger);
    assert(typeof userRoutes['GET /users'] === 'function', 'Factory DI: routes created');

    // Container-based DI
    const container = new Container();
    container.register('logger', () => mockLogger, { singleton: true });
    container.register('userService', () => mockUserService, { singleton: true });
    container.register('userController', (c) => new UserController(c.resolve('userService'), null));

    const ctrl = container.resolve('userController');
    assert(ctrl.userService === mockUserService, 'Container DI: service injected');
    console.log(`  Factory routes: ${Object.keys(userRoutes).join(', ')}`);
    console.log(`  Container resolved: UserController with UserService`);
  }

  // ── DEMO 4: File Upload Pattern ────────────────────────────────────────
  console.log('\n=== DEMO 4: File Upload ===');
  {
    const app = new MiniExpress();
    app.use(fileUpload({ maxSize: 1024, allowedTypes: ['image/png'] }));
    app.post('/api/upload', (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      res.json({ filename: req.file.filename, size: req.file.size });
    });
    app.use(errorHandler);

    // Valid upload
    const req1 = new MockRequest({
      method: 'POST',
      path: '/api/upload',
      body: { _file: { originalname: 'photo.png', mimetype: 'image/png', size: 512 } },
    });
    const res1 = new MockResponse();
    await app.handle(req1, res1);
    assert(res1.statusCode === 200, 'Valid upload succeeds');
    console.log(`  Upload: ${JSON.stringify(res1._json)}`);

    // Oversized file
    const req2 = new MockRequest({
      method: 'POST',
      path: '/api/upload',
      body: { _file: { originalname: 'huge.png', mimetype: 'image/png', size: 9999 } },
    });
    const res2 = new MockResponse();
    await app.handle(req2, res2);
    assert(res2.statusCode === 400, 'Oversized file rejected');
    console.log(`  Oversized: ${res2.statusCode} ${res2._json?.error?.code}`);
  }

  // ── DEMO 5: SSE Streaming ─────────────────────────────────────────────
  console.log('\n=== DEMO 5: Server-Sent Events ===');
  {
    const req = new MockRequest({ method: 'GET', path: '/api/events' });
    const res = new MockResponse();
    const events = sseHandler(req, res);
    assert(res.headers['content-type'] === 'text/event-stream', 'SSE content type set');
    assert(res._body.includes('event: progress'), 'SSE contains progress events');
    assert(res._body.includes('"percent":100'), 'SSE contains completion');
    console.log(`  Events sent: ${events.length}`);
    console.log(`  Sample output:\n${res._body.split('\n').slice(0, 6).map((l) => `    ${l}`).join('\n')}`);
  }

  // ── DEMO 6: WebSocket Chat ────────────────────────────────────────────
  console.log('\n=== DEMO 6: WebSocket Chat ===');
  {
    const wss = new MockWebSocketServer();
    const chatLog = setupChatServer(wss);

    // Two clients connect
    const client1 = new MockWebSocket();
    const client2 = new MockWebSocket();
    wss.simulateConnection(client1);
    wss.simulateConnection(client2);

    // Check welcome messages
    assert(client1.messages.some((m) => m.data.includes('Welcome')), 'Client1 received welcome');
    assert(client2.messages.some((m) => m.data.includes('Welcome')), 'Client2 received welcome');

    // Client1 sends a message -> should be broadcast to client2
    client1.receive(JSON.stringify({ user: 'Alice', text: 'Hello!' }));
    assert(chatLog.length === 1, 'Chat message logged');
    assert(client2.messages.some((m) => m.data.includes('Alice')), 'Client2 received broadcast');

    // Client1 should NOT receive their own broadcast
    const client1ChatMsgs = client1.messages.filter(
      (m) => m.direction === 'outgoing' && m.data.includes('chat')
    );
    assert(client1ChatMsgs.length === 0, 'Sender does not receive own broadcast');

    console.log(`  Clients: ${wss.clients.size}, Chat log: ${chatLog.length} messages`);
    console.log(`  Client2 messages: ${client2.messages.map((m) => JSON.parse(m.data).text || JSON.parse(m.data).type).join(', ')}`);
  }

  // ── DEMO 7: API Versioning ────────────────────────────────────────────
  console.log('\n=== DEMO 7: API Versioning ===');
  {
    const versioner = apiVersionRouter();
    versioner.version('1', {
      'GET /users': (req, res) => res.json({ version: 1, users: ['Alice'] }),
    });
    versioner.version('2', {
      'GET /users': (req, res) => res.json({ version: 2, users: [{ name: 'Alice', id: 1 }] }),
    });

    // URL-based versioning
    const req1 = new MockRequest({ method: 'GET', path: '/api/v1/users' });
    const res1 = new MockResponse();
    versioner.middleware(req1, res1, () => {});
    assert(res1._json?.version === 1, 'V1 endpoint works');

    const req2 = new MockRequest({ method: 'GET', path: '/api/v2/users' });
    const res2 = new MockResponse();
    versioner.middleware(req2, res2, () => {});
    assert(res2._json?.version === 2, 'V2 endpoint works');

    console.log(`  V1: ${JSON.stringify(res1._json)}`);
    console.log(`  V2: ${JSON.stringify(res2._json)}`);
  }

  // ── DEMO 8: NestJS Module Pattern ─────────────────────────────────────
  console.log('\n=== DEMO 8: NestJS Module Pattern ===');
  {
    const { controller, service, routes } = CatsModule.register();

    // Simulate GET /cats
    const req1 = new MockRequest({ method: 'GET', path: '/cats' });
    const res1 = new MockResponse();
    routes['GET /cats'](req1, res1);
    assert(res1._json.length === 2, 'NestJS GET /cats returns 2 cats');

    // Simulate POST /cats
    const req2 = new MockRequest({ method: 'POST', path: '/cats', body: { name: 'Shadow', age: 2 } });
    const res2 = new MockResponse();
    routes['POST /cats'](req2, res2);
    assert(res2.statusCode === 201, 'NestJS POST /cats returns 201');
    assert(res2._json.name === 'Shadow', 'NestJS POST /cats creates cat');

    assert(service.findAll().length === 3, 'Service now has 3 cats');
    console.log(`  Cats: ${service.findAll().map((c) => c.name).join(', ')}`);
  }

  // ── DEMO 9: Security Patterns ─────────────────────────────────────────
  console.log('\n=== DEMO 9: Security Patterns ===');
  {
    // XSS sanitization
    const malicious = '<script>alert("XSS")</script>';
    const safe = sanitizeHtml(malicious);
    assert(!safe.includes('<script>'), 'HTML sanitized');
    assert(safe.includes('&lt;script&gt;'), 'Entities encoded');
    console.log(`  Sanitized: "${safe}"`);

    // CSRF protection
    const csrf = csrfProtection();
    const token = csrf.generateToken('session_abc');
    assert(token.startsWith('csrf_'), 'CSRF token generated');

    // Valid CSRF
    const reqValid = new MockRequest({
      method: 'POST',
      path: '/api/transfer',
      headers: { 'x-session-id': 'session_abc', 'x-csrf-token': token },
    });
    let csrfPassed = false;
    csrf.middleware(reqValid, new MockResponse(), () => { csrfPassed = true; });
    assert(csrfPassed, 'Valid CSRF token passes');

    // Invalid CSRF
    const reqInvalid = new MockRequest({
      method: 'POST',
      path: '/api/transfer',
      headers: { 'x-session-id': 'session_abc', 'x-csrf-token': 'wrong' },
    });
    let csrfBlocked = false;
    try {
      csrf.middleware(reqInvalid, new MockResponse(), () => {});
    } catch (e) {
      csrfBlocked = e instanceof ForbiddenError;
    }
    assert(csrfBlocked, 'Invalid CSRF token blocked');
    console.log(`  CSRF: valid=${csrfPassed}, blocked=${csrfBlocked}`);
  }

  // ── DEMO 10: Custom Error Classes ─────────────────────────────────────
  console.log('\n=== DEMO 10: Custom Error Classes ===');
  {
    const errors = [
      new NotFoundError('Product'),
      new ValidationError([{ field: 'name', message: 'required' }]),
      new UnauthorizedError(),
      new ForbiddenError(),
      new ConflictError(),
      new TooManyRequestsError(30),
    ];

    for (const err of errors) {
      assert(err instanceof AppError, `${err.constructor.name} extends AppError`);
      assert(err.isOperational, `${err.constructor.name} is operational`);
    }

    console.log(`  Error types: ${errors.map((e) => `${e.constructor.name}(${e.statusCode})`).join(', ')}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
