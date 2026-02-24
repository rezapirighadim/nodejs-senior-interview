# Concurrency and Scaling in Node.js -- Senior Interview Reference

## Table of Contents

- [Node.js Single-Threaded Model](#nodejs-single-threaded-model)
- [Cluster Module](#cluster-module)
- [Worker Threads](#worker-threads)
- [Child Processes](#child-processes)
- [When to Use What (Decision Tree)](#when-to-use-what-decision-tree)
- [Connection Pooling](#connection-pooling)
- [Graceful Shutdown](#graceful-shutdown)
- [V8 Memory Management](#v8-memory-management)
- [Memory Leak Detection](#memory-leak-detection)
- [CPU Profiling](#cpu-profiling)
- [PM2 Patterns](#pm2-patterns)
- [Horizontal vs Vertical Scaling](#horizontal-vs-vertical-scaling)
- [Load Balancing Strategies](#load-balancing-strategies)
- [Health Checks](#health-checks)
- [Interview Tips and Key Takeaways](#interview-tips-and-key-takeaways)
- [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

## Node.js Single-Threaded Model

Node.js runs JavaScript on a **single thread** (the main thread), but uses **libuv's thread pool** and the **OS kernel** for non-blocking I/O.

### Architecture Overview

```
 ┌───────────────────────────────────────────────┐
 │                  Your JS Code                 │
 │              (single main thread)             │
 └───────────────────┬───────────────────────────┘
                     │
 ┌───────────────────▼───────────────────────────┐
 │              Node.js Bindings                 │
 │         (V8, libuv, c-ares, etc.)             │
 └───────────────────┬───────────────────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
 ┌────────▼──┐ ┌────▼────┐ ┌──▼────────┐
 │  libuv    │ │  OS     │ │  Thread   │
 │  event    │ │  kernel │ │  pool     │
 │  loop     │ │  async  │ │  (4 def.) │
 │           │ │  I/O    │ │           │
 └───────────┘ └─────────┘ └───────────┘
```

### What Runs Where

| Category               | Where It Runs         | Examples                                   |
|------------------------|-----------------------|--------------------------------------------|
| JavaScript execution   | Main thread           | Your code, callbacks, Promises             |
| Network I/O            | OS kernel (epoll/kqueue) | TCP, UDP, HTTP, DNS (some)              |
| File system I/O        | libuv thread pool     | `fs.readFile`, `fs.stat`                   |
| DNS lookups            | libuv thread pool     | `dns.lookup` (not `dns.resolve`)           |
| Crypto operations      | libuv thread pool     | `crypto.pbkdf2`, `crypto.randomBytes`      |
| Compression            | libuv thread pool     | `zlib.gzip`, `zlib.deflate`                |
| Worker threads         | Separate V8 isolates  | CPU-heavy tasks you explicitly offload     |

### Thread Pool Configuration

```javascript
// Default thread pool size is 4
// Set before any async operations
process.env.UV_THREADPOOL_SIZE = 8; // max recommended: 128

// When to increase: lots of concurrent file I/O or crypto
// When NOT to increase: network-heavy apps (network I/O uses kernel, not pool)
```

> **Interview Tip:** "Single-threaded" refers to JavaScript execution only. Node.js itself is multi-threaded (libuv thread pool + OS threads for I/O). This is the number one misconception to clarify in interviews.

---

## Cluster Module

The **cluster module** forks multiple instances of your application, each running on its own process with its own V8 instance and memory. The master process distributes incoming connections.

### Basic Cluster Setup

```javascript
import cluster from "node:cluster";
import http from "node:http";
import { availableParallelism } from "node:os";

const numCPUs = availableParallelism();

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${numCPUs} workers`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker death
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code})`);
    console.log("Starting a replacement worker...");
    cluster.fork(); // auto-restart
  });
} else {
  // Workers share the TCP connection
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Handled by worker ${process.pid}\n`);
  }).listen(3000);

  console.log(`Worker ${process.pid} started`);
}
```

### Load Balancing Strategies

```javascript
// Node.js cluster uses round-robin by default (except on Windows)
// Can be changed:
cluster.schedulingPolicy = cluster.SCHED_RR;   // round-robin
cluster.schedulingPolicy = cluster.SCHED_NONE; // OS decides
```

### Inter-Process Communication (IPC)

```javascript
if (cluster.isPrimary) {
  const worker = cluster.fork();

  // Send message to worker
  worker.send({ type: "config", data: { maxConnections: 100 } });

  // Receive message from worker
  worker.on("message", (msg) => {
    console.log(`Worker says: ${JSON.stringify(msg)}`);
  });
} else {
  // Receive message from primary
  process.on("message", (msg) => {
    if (msg.type === "config") {
      applyConfig(msg.data);
    }
  });

  // Send message to primary
  process.send({ type: "status", healthy: true, pid: process.pid });
}
```

### Zero-Downtime Restart

```javascript
import cluster from "node:cluster";

if (cluster.isPrimary) {
  const numCPUs = 4;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Rolling restart: replace workers one at a time
  async function rollingRestart() {
    const workers = Object.values(cluster.workers);

    for (const worker of workers) {
      // Fork new worker first
      const replacement = cluster.fork();

      // Wait for new worker to be ready
      await new Promise((resolve) => {
        replacement.on("listening", resolve);
      });

      // Gracefully shut down old worker
      worker.disconnect();

      // Wait for old worker to exit
      await new Promise((resolve) => {
        worker.on("exit", resolve);
      });

      console.log(`Replaced worker ${worker.process.pid} with ${replacement.process.pid}`);
    }
  }

  // Trigger restart on SIGUSR2
  process.on("SIGUSR2", () => {
    console.log("Rolling restart initiated...");
    rollingRestart();
  });
}
```

---

## Worker Threads

**Worker Threads** run JavaScript in separate V8 isolates within the **same process**. They share memory via `SharedArrayBuffer` and communicate via `MessageChannel`.

### Basic Worker Thread

```javascript
// main.js
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

if (isMainThread) {
  // Main thread: create a worker
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { start: 1, end: 1_000_000 }
  });

  worker.on("message", (result) => {
    console.log("Sum:", result);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  worker.on("exit", (code) => {
    if (code !== 0) console.error(`Worker exited with code ${code}`);
  });
} else {
  // Worker thread: do heavy computation
  const { start, end } = workerData;
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum += i;
  }
  parentPort.postMessage(sum);
}
```

### Worker Pool Pattern

```javascript
import { Worker } from "node:worker_threads";
import { EventEmitter } from "node:events";

class WorkerPool extends EventEmitter {
  #workers = [];
  #queue = [];
  #activeWorkers = 0;

  constructor(workerScript, poolSize = 4) {
    super();
    this._workerScript = workerScript;
    this._poolSize = poolSize;

    for (let i = 0; i < poolSize; i++) {
      this.#addWorker();
    }
  }

  #addWorker() {
    const worker = new Worker(this._workerScript);

    worker.on("message", (result) => {
      this.#activeWorkers--;
      worker._resolve(result);
      this.#processQueue();
    });

    worker.on("error", (err) => {
      this.#activeWorkers--;
      worker._reject(err);
      this.#processQueue();
    });

    this.#workers.push(worker);
  }

  exec(data) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ data, resolve, reject });
      this.#processQueue();
    });
  }

  #processQueue() {
    if (this.#queue.length === 0) return;

    const availableWorker = this.#workers.find(
      (w) => !w._busy
    );

    if (!availableWorker) return;

    const { data, resolve, reject } = this.#queue.shift();
    availableWorker._busy = true;
    availableWorker._resolve = (result) => {
      availableWorker._busy = false;
      resolve(result);
    };
    availableWorker._reject = (err) => {
      availableWorker._busy = false;
      reject(err);
    };

    this.#activeWorkers++;
    availableWorker.postMessage(data);
  }

  async destroy() {
    for (const worker of this.#workers) {
      await worker.terminate();
    }
  }
}

// Usage
const pool = new WorkerPool("./compute-worker.js", 4);

const results = await Promise.all([
  pool.exec({ task: "hash", data: "password1" }),
  pool.exec({ task: "hash", data: "password2" }),
  pool.exec({ task: "hash", data: "password3" }),
]);

await pool.destroy();
```

### SharedArrayBuffer and Atomics

```javascript
// Main thread
import { Worker } from "node:worker_threads";

// Shared memory -- accessible by both threads
const sharedBuffer = new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT);
const sharedArray = new Int32Array(sharedBuffer);

const worker = new Worker("./worker.js");
worker.postMessage({ sharedBuffer });

// Atomic operations for thread-safe access
Atomics.store(sharedArray, 0, 42);          // thread-safe write
const val = Atomics.load(sharedArray, 0);   // thread-safe read
Atomics.add(sharedArray, 1, 10);            // thread-safe increment
Atomics.compareExchange(sharedArray, 2, 0, 1); // CAS operation

// Worker notification (sleep/wake)
Atomics.wait(sharedArray, 3, 0);       // block until value changes (worker only)
Atomics.notify(sharedArray, 3, 1);     // wake one waiting thread

// --- worker.js ---
import { parentPort } from "node:worker_threads";

parentPort.on("message", ({ sharedBuffer }) => {
  const sharedArray = new Int32Array(sharedBuffer);

  // Thread-safe counter increment
  for (let i = 0; i < 1_000_000; i++) {
    Atomics.add(sharedArray, 0, 1);
  }

  parentPort.postMessage("done");
});
```

### MessageChannel for Direct Worker-to-Worker Communication

```javascript
import { Worker, MessageChannel } from "node:worker_threads";

const worker1 = new Worker("./worker1.js");
const worker2 = new Worker("./worker2.js");

// Create a channel for direct communication
const { port1, port2 } = new MessageChannel();

// Transfer ports to workers
worker1.postMessage({ port: port1 }, [port1]);
worker2.postMessage({ port: port2 }, [port2]);

// Now worker1 and worker2 can communicate directly
// without going through the main thread
```

---

## Child Processes

The **child_process** module spawns separate OS processes. Unlike worker threads, child processes have completely separate memory and can run any executable.

### spawn -- Streaming I/O

```javascript
import { spawn } from "node:child_process";

const ls = spawn("ls", ["-la", "/tmp"]);

ls.stdout.on("data", (data) => {
  console.log(`stdout: ${data}`);
});

ls.stderr.on("data", (data) => {
  console.error(`stderr: ${data}`);
});

ls.on("close", (code) => {
  console.log(`Process exited with code ${code}`);
});

// Piping between processes
const find = spawn("find", [".", "-name", "*.js"]);
const wc = spawn("wc", ["-l"]);

find.stdout.pipe(wc.stdin);

wc.stdout.on("data", (data) => {
  console.log(`Number of JS files: ${data.toString().trim()}`);
});
```

### exec -- Buffered Output

```javascript
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// exec buffers the entire output (good for small outputs)
const { stdout, stderr } = await execAsync("git log --oneline -5");
console.log(stdout);

// WARNING: exec runs in a shell -- vulnerable to injection
const userInput = "; rm -rf /"; // malicious input
exec(`ls ${userInput}`); // DANGEROUS: runs rm -rf /

// SAFE: use spawn or execFile instead
import { execFile } from "node:child_process";
execFile("ls", [userInput]); // safe -- arguments are not shell-interpreted
```

### fork -- Node.js IPC

```javascript
// parent.js
import { fork } from "node:child_process";

const child = fork("./compute.js");

child.send({ task: "fibonacci", n: 40 });

child.on("message", (result) => {
  console.log("Result:", result);
});

child.on("exit", (code) => {
  console.log(`Child exited with code ${code}`);
});

// compute.js
process.on("message", (msg) => {
  if (msg.task === "fibonacci") {
    const result = fibonacci(msg.n);
    process.send({ result });
  }
});

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

### Comparison Table

| Feature            | `spawn`                  | `exec`                   | `execFile`              | `fork`                   |
|--------------------|--------------------------|--------------------------|-------------------------|--------------------------|
| Output             | Streaming                | Buffered (max 1MB default) | Buffered              | Streaming + IPC          |
| Shell              | No (direct exec)         | Yes (runs in shell)      | No                      | No                       |
| Use case           | Long-running, large output | Short commands, small output | Specific executables | Node.js child scripts    |
| IPC channel        | No (manual with stdio)   | No                       | No                      | Yes (built-in)           |
| Security           | Safe (no shell injection)| Risky (shell injection)  | Safe                    | Safe                     |
| Overhead           | Low                      | Medium                   | Low                     | Higher (full Node.js)    |

---

## When to Use What (Decision Tree)

### Decision Tree Table

| Scenario                                  | Solution                | Why                                              |
|-------------------------------------------|-------------------------|--------------------------------------------------|
| CPU-heavy JS computation                  | Worker Threads          | Shared memory, no serialization overhead          |
| Multiple HTTP server instances            | Cluster module          | Share port, round-robin load balancing            |
| Run external program (ffmpeg, ImageMagick)| `spawn` / `execFile`   | Separate process, streaming I/O                   |
| Quick shell command                       | `exec` (with caution)  | Convenient, but watch output size and injection   |
| Node.js script with IPC                   | `fork`                  | Built-in message passing, full Node.js env        |
| Many concurrent I/O operations            | Default event loop      | Node.js is already optimized for this             |
| Image/video processing                    | Worker Threads or spawn | Offload CPU from main thread                      |
| Crypto operations (bcrypt, etc.)          | Worker Threads          | Avoid blocking event loop                         |
| Serving static files                      | Reverse proxy (nginx)   | Let Node.js handle dynamic content                |
| Need shared state between workers         | SharedArrayBuffer       | Worker Threads with Atomics                       |
| Need process isolation (security)         | Child Processes         | Separate memory space, crash isolation            |

### Visual Decision Flow

```
Is it I/O-bound?
├── Yes -> Use default event loop (async/await)
│         Need to scale? -> Cluster module
└── No (CPU-bound)
    ├── JavaScript computation?
    │   ├── Need shared memory? -> Worker Threads + SharedArrayBuffer
    │   └── Simple offload? -> Worker Threads
    ├── External program?
    │   ├── Large output? -> spawn
    │   └── Small output? -> execFile
    └── Need isolation?
        └── fork or spawn
```

---

## Connection Pooling

### Database Connection Pool

```javascript
import { Pool } from "pg"; // PostgreSQL

const pool = new Pool({
  host: "localhost",
  database: "myapp",
  user: "admin",
  password: "secret",
  max: 20,                // max connections in pool
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail if connection not available in 5s
  maxUses: 7500,          // close connection after N uses (prevent leaks)
});

// Automatic checkout/checkin
const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

// Manual checkout for transactions
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [100, fromId]);
  await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [100, toId]);
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release(); // ALWAYS release back to pool
}

// Pool monitoring
pool.on("connect", () => console.log("New connection created"));
pool.on("acquire", () => console.log("Connection acquired"));
pool.on("remove", () => console.log("Connection removed"));
pool.on("error", (err) => console.error("Idle client error:", err));

// Pool stats
console.log({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount,
});
```

### HTTP Connection Pool (Keep-Alive)

```javascript
import http from "node:http";

// Node.js HTTP agent with connection pooling
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,        // max concurrent connections per host
  maxTotalSockets: 100,  // max total connections
  maxFreeSockets: 10,    // max idle connections to keep
  timeout: 60000,        // socket timeout
});

// Use with fetch or http.request
const response = await fetch("https://api.example.com/data", {
  agent, // Node.js 18+ with undici
});
```

### Redis Connection Pool

```javascript
import { createClient } from "redis";

const redis = createClient({
  url: "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error("Max retries reached");
      return Math.min(retries * 100, 3000); // exponential backoff
    },
  },
});

redis.on("error", (err) => console.error("Redis error:", err));
redis.on("reconnecting", () => console.log("Redis reconnecting..."));

await redis.connect();
```

---

## Graceful Shutdown

### SIGTERM and SIGINT Handling

```javascript
import http from "node:http";

const server = http.createServer(app);
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  isShuttingDown = true;

  // 1. Stop accepting new connections
  server.close(() => {
    console.log("HTTP server closed");
  });

  // 2. Set a hard deadline
  const forceExitTimer = setTimeout(() => {
    console.error("Forceful shutdown -- timeout exceeded");
    process.exit(1);
  }, 30000); // 30 second deadline
  forceExitTimer.unref(); // don't keep process alive

  try {
    // 3. Wait for in-flight requests to complete
    await waitForConnections();

    // 4. Close database connections
    await pool.end();
    console.log("Database pool closed");

    // 5. Close Redis connections
    await redis.quit();
    console.log("Redis disconnected");

    // 6. Flush logs, metrics
    await logger.flush();

    console.log("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

// Handle both signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Middleware to reject new requests during shutdown
function shutdownMiddleware(req, res, next) {
  if (isShuttingDown) {
    res.setHeader("Connection", "close");
    res.status(503).json({ error: "Server is shutting down" });
    return;
  }
  next();
}

// Track active connections
let activeConnections = new Set();

server.on("connection", (conn) => {
  activeConnections.add(conn);
  conn.on("close", () => activeConnections.delete(conn));
});

function waitForConnections(timeout = 10000) {
  return new Promise((resolve) => {
    if (activeConnections.size === 0) return resolve();

    const timer = setTimeout(() => {
      // Destroy remaining connections
      for (const conn of activeConnections) {
        conn.destroy();
      }
      resolve();
    }, timeout);

    const interval = setInterval(() => {
      if (activeConnections.size === 0) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
```

### Signal Reference

| Signal    | Source                    | Default Behavior    | Use Case                   |
|-----------|---------------------------|---------------------|----------------------------|
| `SIGTERM` | `kill <pid>`, Kubernetes  | Terminate process   | Graceful shutdown trigger  |
| `SIGINT`  | Ctrl+C                    | Terminate process   | Developer interrupt        |
| `SIGUSR2` | Custom (`kill -USR2`)     | None (user-defined) | Reload config, restart     |
| `SIGKILL` | `kill -9`                 | Immediate kill      | Cannot be caught           |
| `SIGHUP`  | Terminal close            | Terminate           | Reload configuration       |

---

## V8 Memory Management

### Heap Structure

```
V8 Heap
├── New Space (Young Generation)
│   ├── Semi-space (From)      -- currently active allocations
│   └── Semi-space (To)        -- copy target during scavenge GC
├── Old Space (Old Generation)
│   ├── Old Pointer Space      -- objects with pointers to other objects
│   └── Old Data Space         -- objects with only data (strings, numbers)
├── Large Object Space          -- objects > 512KB (not moved by GC)
├── Code Space                  -- JIT compiled code
└── Map Space                   -- hidden classes (object shapes)
```

### Garbage Collection

```
Scavenge (Minor GC)                   Mark-Sweep-Compact (Major GC)
├── Runs on New Space                 ├── Runs on Old Space
├── Very fast (~1-10ms)               ├── Slower (~50-200ms)
├── Copies live objects to To-space   ├── Marks reachable objects
├── Promotes survivors to Old Space   ├── Sweeps unreachable objects
└── Frequent                          ├── Compacts to reduce fragmentation
                                      └── Less frequent
```

### Memory Configuration

```bash
# Default max old space: ~1.5GB (64-bit systems)
# Increase for memory-intensive apps
node --max-old-space-size=4096 app.js    # 4GB
node --max-old-space-size=8192 app.js    # 8GB

# Monitor memory at runtime
node --expose-gc app.js                  # expose global.gc()
node --trace-gc app.js                   # log GC events
node --max-semi-space-size=64 app.js     # tune new space (MB)
```

### Runtime Memory Monitoring

```javascript
// Memory usage
const mem = process.memoryUsage();
console.log({
  rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,           // total allocated
  heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`, // V8 heap allocated
  heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,   // V8 heap used
  external: `${(mem.external / 1024 / 1024).toFixed(1)} MB`,   // C++ objects (Buffers)
  arrayBuffers: `${(mem.arrayBuffers / 1024 / 1024).toFixed(1)} MB`
});

// Periodic monitoring
setInterval(() => {
  const { heapUsed, heapTotal } = process.memoryUsage();
  const usagePercent = ((heapUsed / heapTotal) * 100).toFixed(1);
  if (usagePercent > 85) {
    console.warn(`High memory usage: ${usagePercent}%`);
  }
}, 30000);

// V8 heap statistics (more detailed)
import v8 from "node:v8";
const heapStats = v8.getHeapStatistics();
console.log({
  totalHeapSize: heapStats.total_heap_size,
  usedHeapSize: heapStats.used_heap_size,
  heapSizeLimit: heapStats.heap_size_limit,
  mallocedMemory: heapStats.malloced_memory,
});
```

---

## Memory Leak Detection

### Common Leak Sources

| Source                 | Example                              | Fix                                  |
|------------------------|--------------------------------------|--------------------------------------|
| Event listeners        | Never removing listeners             | `removeListener` or `AbortController`|
| Closures               | Closure referencing large scope      | Nullify references after use         |
| Global state           | Unbounded caches or arrays           | Use LRU cache with max size          |
| Timers                 | `setInterval` without `clearInterval`| Clean up on shutdown                 |
| Streams                | Not consuming readable stream data   | Always pipe or consume               |
| Promises               | Accumulating unresolved promises     | Set timeouts, cancel stale promises  |

### Detecting Leaks

```javascript
// Strategy 1: Monitor heap growth over time
const snapshots = [];
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  snapshots.push({ time: Date.now(), heapUsed });

  // Check for consistent growth
  if (snapshots.length > 10) {
    const first = snapshots[0].heapUsed;
    const last = snapshots[snapshots.length - 1].heapUsed;
    const growth = ((last - first) / first * 100).toFixed(1);
    console.log(`Heap growth: ${growth}% over ${snapshots.length} samples`);
  }
}, 60000);

// Strategy 2: Heap snapshots
import v8 from "node:v8";
import fs from "node:fs";

function takeHeapSnapshot() {
  const snapshotStream = v8.writeHeapSnapshot();
  console.log(`Heap snapshot written to: ${snapshotStream}`);
  // Open in Chrome DevTools: Memory tab -> Load
}

// Strategy 3: Use --inspect flag
// node --inspect app.js
// Open chrome://inspect in Chrome
// Take heap snapshots, compare allocations
```

### Fixing Common Leaks

```javascript
// Leak: unbounded cache
const cache = {};
function getData(key) {
  if (!cache[key]) {
    cache[key] = expensiveComputation(key); // grows forever
  }
  return cache[key];
}

// Fix: LRU cache with max size
class LRUCache {
  #max;
  #cache;

  constructor(max = 1000) {
    this.#max = max;
    this.#cache = new Map();
  }

  get(key) {
    if (!this.#cache.has(key)) return undefined;
    const value = this.#cache.get(key);
    // Move to end (most recently used)
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.#cache.has(key)) this.#cache.delete(key);
    this.#cache.set(key, value);
    if (this.#cache.size > this.#max) {
      // Delete oldest (first) entry
      const oldestKey = this.#cache.keys().next().value;
      this.#cache.delete(oldestKey);
    }
  }
}

// Leak: event listeners piling up
class Connector {
  connect() {
    // Bug: adds a NEW listener on every reconnect
    this.socket.on("error", this.handleError);
  }
}

// Fix: remove old listener first, or use { once: true }
class Connector {
  connect() {
    this.socket.removeAllListeners("error");
    this.socket.on("error", this.handleError);
  }
}
```

---

## CPU Profiling

### Built-in Profiler

```bash
# Generate a V8 CPU profile
node --prof app.js
# Process the generated isolate-*.log file
node --prof-process isolate-*.log > profile.txt
```

### Chrome DevTools Profiling

```bash
# Start with inspector
node --inspect app.js

# Or break on start
node --inspect-brk app.js

# Open chrome://inspect
# Go to Performance tab
# Click Record, perform actions, stop
```

### Programmatic Profiling

```javascript
import { Session } from "node:inspector/promises";

async function profile(fn, filename = "profile.cpuprofile") {
  const session = new Session();
  session.connect();

  await session.post("Profiler.enable");
  await session.post("Profiler.start");

  // Run the function to profile
  await fn();

  const { profile } = await session.post("Profiler.stop");

  // Write profile to file (open in Chrome DevTools)
  const fs = await import("node:fs/promises");
  await fs.writeFile(filename, JSON.stringify(profile));
  console.log(`Profile written to ${filename}`);

  session.disconnect();
}

// Usage
await profile(async () => {
  // Code to profile
  for (let i = 0; i < 1_000_000; i++) {
    JSON.parse(JSON.stringify({ i }));
  }
});
```

### Identifying Hot Paths

```javascript
// Common performance bottlenecks in Node.js
// 1. Synchronous operations blocking the event loop
const data = fs.readFileSync("large-file"); // blocks everything
// Fix: use fs.promises.readFile

// 2. JSON.parse/stringify on large objects
JSON.stringify(hugeObject); // can take 100ms+ for large objects
// Fix: use streaming JSON parsers

// 3. Regular expressions (ReDoS)
const evilRegex = /^(a+)+$/;
evilRegex.test("aaaaaaaaaaaaaaaaaaaaaa!"); // exponential backtracking
// Fix: use safe regex patterns, set timeouts

// 4. Excessive object creation in hot loops
for (const item of largeArray) {
  const temp = { ...item, computed: heavyFn(item) }; // GC pressure
}
// Fix: reuse objects, use object pools
```

---

## PM2 Patterns

### Basic PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "my-api",
    script: "./dist/server.js",
    instances: "max",            // use all CPU cores
    exec_mode: "cluster",        // cluster mode
    max_memory_restart: "500M",  // restart if memory exceeds 500MB
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    env_staging: {
      NODE_ENV: "staging",
      PORT: 3001,
    },

    // Restart policies
    watch: false,                // disable in production
    max_restarts: 10,
    min_uptime: "10s",
    restart_delay: 4000,

    // Logging
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    merge_logs: true,

    // Graceful shutdown
    kill_timeout: 5000,          // wait 5s before SIGKILL
    listen_timeout: 10000,       // wait 10s for app to start
    shutdown_with_message: true, // use process.send for shutdown
  }]
};
```

### PM2 Commands

```bash
# Start
pm2 start ecosystem.config.js

# Zero-downtime reload (cluster mode)
pm2 reload my-api

# Scale up/down
pm2 scale my-api 8
pm2 scale my-api +2

# Monitor
pm2 monit
pm2 status
pm2 logs

# Save and resurrect on reboot
pm2 save
pm2 startup
```

### PM2 Graceful Shutdown

```javascript
// Handle PM2 shutdown message
process.on("message", (msg) => {
  if (msg === "shutdown") {
    gracefulShutdown("PM2 shutdown").then(() => {
      process.exit(0);
    });
  }
});

// PM2 sends SIGINT then waits kill_timeout before SIGKILL
process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").then(() => {
    process.exit(0);
  });
});
```

---

## Horizontal vs Vertical Scaling

### Comparison

| Aspect              | Vertical Scaling             | Horizontal Scaling            |
|---------------------|------------------------------|-------------------------------|
| Approach            | Bigger machine               | More machines                 |
| Cost curve          | Exponential                  | Linear                        |
| Downtime            | Usually requires restart     | Zero-downtime possible        |
| Complexity          | Simple                       | Complex (load balancing, state) |
| Limit               | Hardware ceiling              | Practically unlimited          |
| State management    | Easy (single machine)        | Hard (distributed state)       |
| Node.js approach    | Cluster + more RAM/CPU       | Multiple servers + LB          |

### Node.js Scaling Strategies

```
Single Server Scaling:
├── 1. Cluster module (use all CPU cores)
├── 2. Increase --max-old-space-size
├── 3. Worker threads for CPU tasks
└── 4. Optimize code (profiling, caching)

Multi-Server Scaling:
├── 1. Load balancer (nginx, HAProxy, ALB)
├── 2. Sticky sessions or stateless design
├── 3. Shared session store (Redis)
├── 4. Shared cache (Redis, Memcached)
├── 5. Database replication (read replicas)
├── 6. Message queues for async work
└── 7. CDN for static assets
```

---

## Load Balancing Strategies

| Strategy            | How It Works                         | Pros                        | Cons                          |
|---------------------|--------------------------------------|-----------------------------|-------------------------------|
| Round Robin         | Requests distributed in order        | Simple, even distribution   | Ignores server capacity       |
| Least Connections   | Routes to server with fewest active  | Adapts to load              | Slightly more complex         |
| Weighted Round Robin| Proportional distribution by weight  | Accounts for server sizes   | Requires manual weight config |
| IP Hash             | Same client IP always hits same server | Session affinity          | Uneven if IP distribution skewed |
| Random              | Random server selection              | Simple, good with many servers | Not optimal for few servers|
| Least Response Time | Routes to fastest server             | Best user experience        | Requires response time tracking |

### Nginx Load Balancer Configuration

```nginx
upstream node_app {
    # least_conn;                 # least connections strategy
    # ip_hash;                    # sticky sessions

    server 127.0.0.1:3001 weight=3;
    server 127.0.0.1:3002 weight=2;
    server 127.0.0.1:3003 weight=1;

    # Health checks
    server 127.0.0.1:3004 backup;  # only used if others are down

    keepalive 64;                   # connection pooling
}

server {
    listen 80;

    location / {
        proxy_pass http://node_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## Health Checks

### Implementation Patterns

```javascript
import express from "express";

const app = express();

// Liveness check: "Is the process alive?"
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Readiness check: "Can it handle requests?"
app.get("/readyz", async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    memory: false,
  };

  try {
    // Database check
    await pool.query("SELECT 1");
    checks.database = true;
  } catch (err) {
    checks.database = false;
  }

  try {
    // Redis check
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    checks.redis = false;
  }

  // Memory check
  const { heapUsed, heapTotal } = process.memoryUsage();
  checks.memory = (heapUsed / heapTotal) < 0.9;

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ready" : "not ready",
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Startup check: "Has it finished initializing?"
let isStarted = false;

app.get("/startupz", (req, res) => {
  res.status(isStarted ? 200 : 503).json({
    status: isStarted ? "started" : "starting",
  });
});

async function initialize() {
  await connectToDatabase();
  await connectToRedis();
  await warmCaches();
  isStarted = true;
}
```

### Kubernetes Health Check Configuration

```yaml
# Kubernetes deployment with health checks
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3      # restart after 3 consecutive failures

readinessProbe:
  httpGet:
    path: /readyz
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 2      # remove from LB after 2 failures

startupProbe:
  httpGet:
    path: /startupz
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 5
  failureThreshold: 30     # allow up to 150s for startup
```

---

## Interview Tips and Key Takeaways

1. **Single-threaded does NOT mean single-process:** Node.js runs JS on one thread but offloads I/O to the kernel and thread pool. Cluster, Workers, and child processes add parallelism.

2. **Know the scaling ladder:** Single process -> Cluster (multi-core) -> Worker threads (CPU offload) -> Multiple servers (horizontal) -> Microservices.

3. **Graceful shutdown is non-negotiable in production:** Stop accepting new connections, drain in-flight requests, close resources, exit. Know SIGTERM vs SIGINT vs SIGKILL.

4. **Memory leaks in production:** Mention heap snapshots, `--inspect`, growing RSS over time, common causes (event listeners, unbounded caches, closures). Show you have debugging experience.

5. **Connection pooling is essential:** Database connections are expensive to create. Always use pools with proper configuration (max size, idle timeout, connection timeout).

6. **PM2 or container orchestration:** Know PM2 for traditional deployment, Kubernetes for containerized deployments. Mention cluster mode, zero-downtime reloads.

7. **Health checks are three-tier:** Liveness (process alive), Readiness (can handle traffic), Startup (initialization complete).

---

## Quick Reference / Cheat Sheet

### Scaling Decision Quick Reference

```
Performance issue?
├── I/O bottleneck
│   ├── Database slow? -> Connection pooling, read replicas, caching
│   ├── External API slow? -> Queue, cache, circuit breaker
│   └── File I/O slow? -> Streaming, increase UV_THREADPOOL_SIZE
├── CPU bottleneck
│   ├── Single request slow? -> Worker threads, optimize algorithm
│   ├── All requests slow? -> Cluster module, horizontal scaling
│   └── Specific operation? -> Profile, optimize, or offload
└── Memory bottleneck
    ├── Leak? -> Heap snapshots, find root cause
    ├── Large datasets? -> Streams, pagination
    └── Need more? -> --max-old-space-size, vertical scaling
```

### Memory Limits Quick Reference

| V8 Flag                    | Default         | Description                    |
|----------------------------|-----------------|--------------------------------|
| `--max-old-space-size`     | ~1.5GB (64-bit) | Max old generation heap size   |
| `--max-semi-space-size`    | 16MB            | Max young generation semi-space|
| `UV_THREADPOOL_SIZE`       | 4               | libuv thread pool size         |
| `--stack-size`             | ~1MB            | Call stack size                 |

### Process Communication

| Mechanism          | Use With             | Transfer Speed | Shared Memory? |
|--------------------|----------------------|----------------|----------------|
| IPC (messages)     | cluster, fork        | Fast           | No             |
| MessagePort        | worker_threads       | Fast           | No             |
| SharedArrayBuffer  | worker_threads       | Instant        | Yes            |
| Pipe (stdin/stdout)| spawn, exec          | Medium         | No             |
| File/Socket        | Any                  | Slow           | No             |
| Redis/Queue        | Any (cross-machine)  | Network speed  | No             |
