/**
 * ============================================================================
 * FILE 8: CONCURRENCY AND SCALING IN NODE.JS
 * ============================================================================
 *
 * A comprehensive guide to Node.js concurrency primitives, process management,
 * scaling strategies, and production-readiness patterns.
 *
 * Run: node 08_concurrency_and_scaling.js
 * ============================================================================
 */

'use strict';

const { Worker, isMainThread, parentPort, workerData, MessageChannel } = require('worker_threads');
const { fork, spawn, execSync } = require('child_process');
const cluster = require('cluster');
const os = require('os');
const { EventEmitter } = require('events');
const v8 = require('v8');

// ---------------------------------------------------------------------------
// Helper: section printer
// ---------------------------------------------------------------------------
const section = (title) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(72));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
// CHECK: Are we in a worker thread? (This file doubles as worker code)
// ===========================================================================
// When this file is loaded as a Worker, isMainThread is false. We handle
// the worker logic here and exit early so the demos don't run in workers.
// ===========================================================================

if (!isMainThread) {
  // We're inside a worker thread — handle messages and exit
  const { task, data } = workerData ?? {};

  if (task === 'fibonacci') {
    function fib(n) {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    }
    const result = fib(data.n);
    parentPort.postMessage({ task, result, threadId: require('worker_threads').threadId });
  }

  if (task === 'prime-check') {
    function isPrime(n) {
      if (n < 2) return false;
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
      }
      return true;
    }
    const result = isPrime(data.number);
    parentPort.postMessage({ task, result, number: data.number });
  }

  if (task === 'shared-buffer-worker') {
    // Demonstrate SharedArrayBuffer and Atomics
    const { port } = workerData;
    const sharedArray = new Int32Array(workerData.sharedBuffer);
    for (let i = 0; i < 1000; i++) {
      Atomics.add(sharedArray, 0, 1);
    }
    parentPort.postMessage({ done: true, finalValue: Atomics.load(sharedArray, 0) });
  }

  if (task === 'heavy-computation') {
    // Simulate CPU-intensive work
    let sum = 0;
    for (let i = 0; i < data.iterations; i++) {
      sum += Math.sqrt(i);
    }
    parentPort.postMessage({ result: sum });
  }

  // Don't proceed to main thread code
  // (worker will exit when message is posted and event loop drains)
} else {
  // ===========================================================================
  // MAIN THREAD CODE STARTS HERE
  // ===========================================================================

  // ===========================================================================
  // 1. NODE.JS SINGLE-THREADED MODEL EXPLAINED
  // ===========================================================================
  // Node.js runs JavaScript on a single thread (the main/event-loop thread).
  // However, Node.js is NOT single-threaded overall:
  //   - libuv maintains a thread pool (default 4 threads) for blocking I/O
  //   - DNS lookups, file system operations, crypto, and zlib use this pool
  //   - Network I/O uses OS-level async primitives (epoll, kqueue, IOCP)
  //   - Worker threads provide true parallelism for CPU-bound work
  //
  // The event loop allows non-blocking I/O by delegating work and receiving
  // callbacks when complete. This is why a single Node.js process can handle
  // thousands of concurrent connections efficiently — as long as no single
  // operation blocks the event loop.
  //
  // GOLDEN RULE: Never block the event loop.
  //   - CPU-intensive work -> Worker threads or child_process
  //   - Sync I/O (readFileSync, etc.) -> Only at startup
  //   - Long-running loops -> Break into chunks with setImmediate
  // ===========================================================================

  function explainSingleThreaded() {
    console.log(`  CPU cores available: ${os.cpus().length}`);
    console.log(`  Process PID: ${process.pid}`);
    console.log(`  Node.js version: ${process.version}`);
    console.log(`  UV_THREADPOOL_SIZE: ${process.env.UV_THREADPOOL_SIZE ?? '4 (default)'}`);
    console.log(`  Main thread ID: 0 (always)`);

    // Demonstrate non-blocking behavior
    console.log('\n  Non-blocking I/O demonstration:');
    console.log('    Node handles I/O asynchronously on a single thread.');
    console.log('    While waiting for I/O, other callbacks can execute.');
    console.log('    This is why Node.js excels at I/O-heavy workloads.');
  }

  // ===========================================================================
  // 2. THE CLUSTER MODULE
  // ===========================================================================
  // cluster.fork() creates child processes (not threads) that share the same
  // server port. The OS (or Node.js) load-balances incoming connections among
  // workers. Each worker has its own V8 instance and memory space.
  //
  // Use case: Utilize all CPU cores for HTTP servers.
  // Note: We demonstrate the concepts without actually forking because this
  // file is meant to be run standalone. In production, you'd use the full
  // cluster pattern shown below.
  // ===========================================================================

  function clusterExample() {
    // This is the PATTERN — not executed because we don't want to fork
    const clusterCode = `
    // --- cluster-server.js (production pattern) ---
    const cluster = require('cluster');
    const http = require('http');
    const os = require('os');

    if (cluster.isPrimary) {
      const numCPUs = os.cpus().length;
      console.log(\`Primary \${process.pid} forking \${numCPUs} workers\`);

      // Fork workers
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      // Handle worker death — restart for zero-downtime
      cluster.on('exit', (worker, code, signal) => {
        console.log(\`Worker \${worker.process.pid} died (\${signal || code})\`);
        if (code !== 0 && !worker.exitedAfterDisconnect) {
          console.log('Starting replacement worker...');
          cluster.fork();
        }
      });

      // Graceful rolling restart
      process.on('SIGUSR2', () => {
        const workers = Object.values(cluster.workers);
        const restartWorker = (i) => {
          if (i >= workers.length) return;
          const worker = workers[i];
          console.log(\`Restarting worker \${worker.process.pid}\`);
          worker.disconnect();
          worker.on('exit', () => {
            if (!worker.exitedAfterDisconnect) return;
            const newWorker = cluster.fork();
            newWorker.on('listening', () => restartWorker(i + 1));
          });
        };
        restartWorker(0);
      });

    } else {
      // Worker process
      http.createServer((req, res) => {
        res.writeHead(200);
        res.end(\`Hello from worker \${process.pid}\\n\`);
      }).listen(8000);

      console.log(\`Worker \${process.pid} started\`);
    }`;

    console.log('  Cluster module pattern (code, not executed):');
    console.log('    - Primary process forks N workers (one per CPU core)');
    console.log('    - Workers share the same server port');
    console.log('    - OS load-balances connections among workers');
    console.log(`    - Available cores: ${os.cpus().length}`);
    console.log('    - Each worker has independent V8 heap and memory');
    console.log('    - SIGUSR2 handler enables zero-downtime restart');
    return clusterCode;
  }

  // ===========================================================================
  // 3. WORKER THREADS: SharedArrayBuffer, MessageChannel, Atomics
  // ===========================================================================
  // Worker threads run JavaScript in parallel on separate threads but within
  // the same process. They share memory via SharedArrayBuffer and communicate
  // via message passing.
  //
  // Use case: CPU-intensive computation (image processing, crypto, parsing).
  // ===========================================================================

  // --- 3a. Basic worker thread ---
  function runWorkerTask(task, data) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { task, data },
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
      });
    });
  }

  // --- 3b. Worker pool ---
  class WorkerPool {
    #size;
    #workers = [];
    #queue = [];
    #activeWorkers = 0;

    constructor(size = os.cpus().length) {
      this.#size = size;
    }

    async execute(task, data) {
      return new Promise((resolve, reject) => {
        const work = { task, data, resolve, reject };

        if (this.#activeWorkers < this.#size) {
          this.#runWorker(work);
        } else {
          this.#queue.push(work);
        }
      });
    }

    #runWorker(work) {
      this.#activeWorkers++;
      const worker = new Worker(__filename, {
        workerData: { task: work.task, data: work.data },
      });

      worker.on('message', (result) => {
        work.resolve(result);
        this.#activeWorkers--;
        this.#processQueue();
      });

      worker.on('error', (err) => {
        work.reject(err);
        this.#activeWorkers--;
        this.#processQueue();
      });
    }

    #processQueue() {
      if (this.#queue.length > 0 && this.#activeWorkers < this.#size) {
        this.#runWorker(this.#queue.shift());
      }
    }

    get activeCount() { return this.#activeWorkers; }
    get pendingCount() { return this.#queue.length; }
  }

  // --- 3c. SharedArrayBuffer and Atomics demo ---
  async function sharedMemoryDemo() {
    const sharedBuffer = new SharedArrayBuffer(4); // 4 bytes = 1 Int32
    const mainView = new Int32Array(sharedBuffer);
    mainView[0] = 0;

    // Spawn 4 workers that each increment the shared counter 1000 times
    const workers = [];
    for (let i = 0; i < 4; i++) {
      workers.push(new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
          workerData: { task: 'shared-buffer-worker', sharedBuffer },
        });
        worker.on('message', resolve);
        worker.on('error', reject);
      }));
    }

    await Promise.all(workers);
    const finalValue = Atomics.load(mainView, 0);
    return finalValue; // Should be 4000 (4 workers x 1000 increments)
  }

  // --- 3d. MessageChannel for direct worker-to-worker communication ---
  function messageChannelExample() {
    // MessageChannel creates a pair of connected ports
    const { port1, port2 } = new MessageChannel();

    // In a real scenario, you'd transfer these ports to different workers
    // worker1.postMessage({ port: port1 }, [port1]);
    // worker2.postMessage({ port: port2 }, [port2]);

    return new Promise((resolve) => {
      port2.on('message', (msg) => {
        resolve(msg);
        port1.close();
        port2.close();
      });
      port1.postMessage('Hello via MessageChannel');
    });
  }

  // ===========================================================================
  // 4. CHILD_PROCESS: spawn, exec, fork, IPC
  // ===========================================================================
  // child_process creates entirely separate OS processes.
  //   - spawn: stream-based, for long-running processes
  //   - exec: buffered output, for short commands (has maxBuffer)
  //   - fork: specialized spawn for Node.js scripts with built-in IPC
  //
  // Use case: Running shell commands, legacy scripts, or isolated processes.
  // ===========================================================================

  function childProcessExamples() {
    // exec (synchronous version for demo brevity)
    const nodeVersion = execSync('node --version').toString().trim();

    // spawn example (we'll describe the pattern)
    const spawnPattern = `
    // Stream-based: good for large output
    const { spawn } = require('child_process');
    const ls = spawn('ls', ['-la', '/tmp']);
    ls.stdout.on('data', (data) => console.log(data.toString()));
    ls.stderr.on('data', (data) => console.error(data.toString()));
    ls.on('close', (code) => console.log('Exit code:', code));`;

    // fork example with IPC
    const forkPattern = `
    // Fork creates a Node.js child with IPC channel
    const child = fork('./worker.js');
    child.send({ type: 'compute', data: [1, 2, 3] });
    child.on('message', (msg) => console.log('From child:', msg));

    // In worker.js:
    process.on('message', (msg) => {
      const result = msg.data.reduce((a, b) => a + b, 0);
      process.send({ type: 'result', value: result });
    });`;

    return { nodeVersion, spawnPattern, forkPattern };
  }

  // ===========================================================================
  // 5. WHEN TO USE WHAT: cluster vs workers vs child_process
  // ===========================================================================

  function whenToUseWhat() {
    return {
      cluster: {
        useCase: 'Multi-core HTTP servers',
        how: 'Forks the entire process, workers share server port',
        memory: 'Each worker has its own heap (high memory usage)',
        communication: 'IPC via process.send()',
        bestFor: [
          'Web servers that need to use all CPU cores',
          'Stateless request handling',
          'Zero-downtime restarts',
        ],
      },
      workerThreads: {
        useCase: 'CPU-intensive computation within a process',
        how: 'Separate JS threads in the same process',
        memory: 'Can share memory via SharedArrayBuffer',
        communication: 'postMessage() or SharedArrayBuffer + Atomics',
        bestFor: [
          'Image/video processing',
          'Heavy crypto or compression',
          'Parsing large files',
          'Machine learning inference',
        ],
      },
      childProcess: {
        useCase: 'Running external commands or isolated processes',
        how: 'Spawns a new OS process',
        memory: 'Completely separate memory space',
        communication: 'stdin/stdout/stderr streams, IPC for fork()',
        bestFor: [
          'Running shell commands (git, ffmpeg, etc.)',
          'Legacy script integration',
          'Process isolation for crash safety',
          'Running non-Node.js programs',
        ],
      },
    };
  }

  // ===========================================================================
  // 6. CONNECTION POOLING PATTERNS
  // ===========================================================================
  // Creating a new connection for every request is expensive. Pools maintain
  // a set of reusable connections, borrowing and returning them as needed.
  // ===========================================================================

  class ConnectionPool {
    #maxSize;
    #minSize;
    #connections = [];
    #available = [];
    #waiting = [];
    #nextId = 1;
    #stats = { created: 0, reused: 0, destroyed: 0 };

    constructor({ maxSize = 10, minSize = 2 } = {}) {
      this.#maxSize = maxSize;
      this.#minSize = minSize;
    }

    async initialize() {
      // Pre-warm the pool with minimum connections
      for (let i = 0; i < this.#minSize; i++) {
        const conn = await this.#createConnection();
        this.#available.push(conn);
      }
      console.log(`    Pool initialized with ${this.#minSize} connections`);
    }

    async #createConnection() {
      const id = this.#nextId++;
      this.#stats.created++;
      const conn = {
        id,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        healthy: true,
        query: async (sql) => {
          await sleep(5); // simulate query time
          return { rows: [{ result: `Connection ${id}: ${sql}` }] };
        },
      };
      this.#connections.push(conn);
      return conn;
    }

    async acquire() {
      // Try to get an available connection
      while (this.#available.length > 0) {
        const conn = this.#available.pop();
        if (conn.healthy) {
          conn.lastUsed = Date.now();
          this.#stats.reused++;
          return conn;
        }
        // Unhealthy — destroy it
        this.#destroyConnection(conn);
      }

      // Create a new one if pool isn't full
      if (this.#connections.length < this.#maxSize) {
        const conn = await this.#createConnection();
        conn.lastUsed = Date.now();
        return conn;
      }

      // Pool is full — wait for a connection to be released
      return new Promise((resolve) => {
        this.#waiting.push(resolve);
      });
    }

    release(conn) {
      conn.lastUsed = Date.now();

      // If someone is waiting, give them this connection directly
      if (this.#waiting.length > 0) {
        const waiter = this.#waiting.shift();
        this.#stats.reused++;
        waiter(conn);
        return;
      }

      this.#available.push(conn);
    }

    #destroyConnection(conn) {
      const idx = this.#connections.indexOf(conn);
      if (idx !== -1) this.#connections.splice(idx, 1);
      this.#stats.destroyed++;
    }

    async drain() {
      // Close all connections
      for (const conn of this.#connections) {
        conn.healthy = false;
      }
      this.#connections.length = 0;
      this.#available.length = 0;
    }

    get stats() {
      return {
        ...this.#stats,
        total: this.#connections.length,
        available: this.#available.length,
        waiting: this.#waiting.length,
      };
    }
  }

  // Helper: use pool safely
  async function withConnection(pool, fn) {
    const conn = await pool.acquire();
    try {
      return await fn(conn);
    } finally {
      pool.release(conn);
    }
  }

  // ===========================================================================
  // 7. GRACEFUL SHUTDOWN HANDLING
  // ===========================================================================
  // When a process receives SIGTERM (from Kubernetes, PM2, systemd) or SIGINT
  // (Ctrl+C), it should:
  //   1. Stop accepting new work
  //   2. Finish in-progress work
  //   3. Release resources (close DB pools, flush logs)
  //   4. Exit cleanly
  // ===========================================================================

  class GracefulServer extends EventEmitter {
    #isShuttingDown = false;
    #connections = new Set();
    #shutdownTimeout;

    constructor({ shutdownTimeout = 10_000 } = {}) {
      super();
      this.#shutdownTimeout = shutdownTimeout;
    }

    // Simulates a server with active connections
    addConnection(id) {
      if (this.#isShuttingDown) return false;
      this.#connections.add(id);
      return true;
    }

    removeConnection(id) {
      this.#connections.delete(id);
      if (this.#isShuttingDown && this.#connections.size === 0) {
        this.emit('drained');
      }
    }

    async shutdown(signal = 'SIGTERM') {
      if (this.#isShuttingDown) return;
      this.#isShuttingDown = true;

      console.log(`    [${signal}] Graceful shutdown initiated...`);
      console.log(`    [${signal}] Active connections: ${this.#connections.size}`);

      // Stop accepting new connections
      this.emit('closing');

      // Wait for existing connections to drain (with timeout)
      if (this.#connections.size > 0) {
        await Promise.race([
          new Promise((resolve) => this.on('drained', resolve)),
          sleep(this.#shutdownTimeout).then(() => {
            console.log(`    [${signal}] Timeout reached, forcing shutdown`);
          }),
        ]);
      }

      // Cleanup resources
      console.log(`    [${signal}] Releasing resources...`);
      this.emit('cleanup');

      console.log(`    [${signal}] Shutdown complete`);
      return true;
    }

    get isShuttingDown() { return this.#isShuttingDown; }
    get connectionCount() { return this.#connections.size; }
  }

  // Production shutdown handler pattern
  function setupShutdownHandlers() {
    // In production you'd register these:
    const handlers = `
    const server = createServer();

    async function gracefulShutdown(signal) {
      console.log(\`Received \${signal}\`);

      // 1. Stop accepting new connections
      server.close();

      // 2. Close database pools
      await dbPool.drain();

      // 3. Flush logs and metrics
      await logger.flush();

      // 4. Exit
      process.exit(0);
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

    // Catch uncaught exceptions — log and exit
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      // Don't exit immediately — let the process handle it
    });`;

    return handlers;
  }

  // ===========================================================================
  // 8. MEMORY MANAGEMENT
  // ===========================================================================
  // V8 manages memory with a generational garbage collector:
  //   - Young generation (Scavenger): short-lived objects, frequent GC
  //   - Old generation (Mark-Sweep/Compact): long-lived objects, less frequent
  //
  // Key settings:
  //   --max-old-space-size=SIZE_MB  (default ~1.7GB on 64-bit)
  //   --max-semi-space-size=SIZE_MB (young generation)
  //
  // Common memory leak causes:
  //   - Growing arrays/maps that are never cleaned
  //   - Closures capturing large scopes
  //   - Event listeners not removed
  //   - Unclosed streams/connections
  //   - Global caches without TTL/LRU eviction
  // ===========================================================================

  function memoryInfo() {
    const heapStats = v8.getHeapStatistics();
    const memUsage = process.memoryUsage();

    return {
      heap: {
        total: `${(heapStats.total_heap_size / 1024 / 1024).toFixed(1)} MB`,
        used: `${(heapStats.used_heap_size / 1024 / 1024).toFixed(1)} MB`,
        limit: `${(heapStats.heap_size_limit / 1024 / 1024).toFixed(0)} MB`,
      },
      process: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        external: `${(memUsage.external / 1024 / 1024).toFixed(1)} MB`,
        arrayBuffers: `${(memUsage.arrayBuffers / 1024 / 1024).toFixed(1)} MB`,
      },
    };
  }

  // --- Memory leak detector pattern ---
  class MemoryLeakDetector {
    #samples = [];
    #threshold;

    constructor({ threshold = 50 } = {}) {
      // Threshold: MB growth that triggers warning
      this.#threshold = threshold;
    }

    sample() {
      const usage = process.memoryUsage();
      this.#samples.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        rss: usage.rss,
      });
    }

    analyze() {
      if (this.#samples.length < 2) return { leakDetected: false };

      const first = this.#samples[0];
      const last = this.#samples[this.#samples.length - 1];
      const heapGrowthMB = (last.heapUsed - first.heapUsed) / 1024 / 1024;
      const rssGrowthMB = (last.rss - first.rss) / 1024 / 1024;

      return {
        leakDetected: heapGrowthMB > this.#threshold,
        heapGrowthMB: heapGrowthMB.toFixed(2),
        rssGrowthMB: rssGrowthMB.toFixed(2),
        samples: this.#samples.length,
        durationMs: last.timestamp - first.timestamp,
      };
    }
  }

  // --- LRU cache to prevent memory leaks ---
  class LRUCache {
    #maxSize;
    #cache = new Map();

    constructor(maxSize = 1000) {
      this.#maxSize = maxSize;
    }

    get(key) {
      if (!this.#cache.has(key)) return undefined;
      // Move to end (most recent)
      const value = this.#cache.get(key);
      this.#cache.delete(key);
      this.#cache.set(key, value);
      return value;
    }

    set(key, value) {
      if (this.#cache.has(key)) this.#cache.delete(key);
      this.#cache.set(key, value);
      // Evict oldest if over limit
      if (this.#cache.size > this.#maxSize) {
        const oldest = this.#cache.keys().next().value;
        this.#cache.delete(oldest);
      }
    }

    get size() { return this.#cache.size; }
    clear() { this.#cache.clear(); }
  }

  // ===========================================================================
  // 9. CPU PROFILING BASICS
  // ===========================================================================
  // Techniques for finding CPU bottlenecks:
  //   - node --prof app.js (V8 profiler, outputs tick-processor log)
  //   - node --inspect app.js (Chrome DevTools profiler)
  //   - perf_hooks module for programmatic measurement
  //   - clinic.js (clinic doctor, clinic flame, clinic bubbleprof)
  // ===========================================================================

  function cpuProfilingPatterns() {
    const { performance: perf, PerformanceObserver } = require('perf_hooks');

    // --- 9a. Manual timing with performance.now() ---
    function timeFunction(fn, label) {
      const start = perf.now();
      const result = fn();
      const elapsed = perf.now() - start;
      return { result, elapsed: elapsed.toFixed(3) + 'ms', label };
    }

    // --- 9b. Performance marks and measures ---
    perf.mark('sort-start');
    const arr = Array.from({ length: 10000 }, () => Math.random());
    arr.sort((a, b) => a - b);
    perf.mark('sort-end');
    perf.measure('sort-duration', 'sort-start', 'sort-end');

    const measures = perf.getEntriesByType('measure');
    const sortMeasure = measures.find((m) => m.name === 'sort-duration');

    // --- 9c. Simple profiler class ---
    class SimpleProfiler {
      #timers = new Map();
      #results = [];

      start(label) {
        this.#timers.set(label, perf.now());
      }

      end(label) {
        const start = this.#timers.get(label);
        if (start === undefined) return;
        const duration = perf.now() - start;
        this.#results.push({ label, duration });
        this.#timers.delete(label);
        return duration;
      }

      report() {
        return this.#results
          .sort((a, b) => b.duration - a.duration)
          .map((r) => `${r.label}: ${r.duration.toFixed(3)}ms`);
      }
    }

    return {
      sortDuration: sortMeasure ? `${sortMeasure.duration.toFixed(3)}ms` : 'N/A',
      timeFunction,
      SimpleProfiler,
      tips: [
        'node --prof app.js -> produces v8.log',
        'node --prof-process v8.log -> human-readable',
        'node --inspect -> Chrome DevTools CPU profiler',
        'clinic flame -- node app.js -> flamegraph',
      ],
    };
  }

  // ===========================================================================
  // 10. PROCESS MANAGERS (PM2 PATTERNS)
  // ===========================================================================
  // PM2 is the most popular Node.js process manager. It handles:
  //   - Process forking (cluster mode)
  //   - Auto-restart on crash
  //   - Log management
  //   - Zero-downtime reload
  //   - Monitoring
  // ===========================================================================

  function pm2Patterns() {
    const ecosystemConfig = {
      apps: [
        {
          name: 'api-server',
          script: './src/server.js',
          instances: 'max',              // One per CPU core
          exec_mode: 'cluster',          // Cluster mode
          max_memory_restart: '500M',    // Restart if memory exceeds
          env: {
            NODE_ENV: 'development',
            PORT: 3000,
          },
          env_production: {
            NODE_ENV: 'production',
            PORT: 8080,
          },
          // Logging
          error_file: './logs/err.log',
          out_file: './logs/out.log',
          merge_logs: true,
          log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
          // Restart policies
          autorestart: true,
          watch: false,                  // Don't watch in production
          max_restarts: 10,
          min_uptime: '5s',
          restart_delay: 4000,
          // Graceful shutdown
          kill_timeout: 5000,
          listen_timeout: 10000,
          shutdown_with_message: true,
        },
        {
          name: 'worker',
          script: './src/worker.js',
          instances: 2,
          exec_mode: 'fork',            // Fork mode for non-HTTP workers
          cron_restart: '0 */6 * * *',  // Restart every 6 hours
        },
      ],
    };

    const commands = {
      start: 'pm2 start ecosystem.config.js --env production',
      stop: 'pm2 stop all',
      restart: 'pm2 restart all',
      reload: 'pm2 reload all --update-env',  // Zero-downtime
      logs: 'pm2 logs --lines 100',
      monit: 'pm2 monit',                     // Real-time monitoring
      list: 'pm2 list',
      save: 'pm2 save',                       // Save process list
      startup: 'pm2 startup',                 // Auto-start on boot
    };

    return { ecosystemConfig, commands };
  }

  // ===========================================================================
  // 11. HORIZONTAL VS VERTICAL SCALING
  // ===========================================================================

  function scalingStrategies() {
    return {
      vertical: {
        description: 'Scale UP: add more resources to a single machine',
        strategies: [
          'Increase --max-old-space-size for more heap',
          'Add CPU cores + use cluster module',
          'Upgrade to faster hardware (more RAM, NVMe SSD)',
          'Increase UV_THREADPOOL_SIZE for I/O-heavy apps',
        ],
        pros: ['Simple to implement', 'No distributed system complexity'],
        cons: ['Hardware limits', 'Single point of failure', 'Expensive at scale'],
      },
      horizontal: {
        description: 'Scale OUT: add more machines',
        strategies: [
          'Run multiple instances behind a load balancer',
          'Use container orchestration (Kubernetes, ECS)',
          'Stateless application design (externalize state to Redis/DB)',
          'Service decomposition (microservices)',
          'Event-driven architecture (message queues)',
        ],
        pros: ['Near-infinite scalability', 'Fault tolerance', 'Cost effective'],
        cons: ['Distributed system complexity', 'Network latency', 'Data consistency challenges'],
      },
      nodeSpecific: [
        'Use cluster module for multi-core utilization',
        'Move CPU work to worker threads',
        'Cache aggressively (Redis, in-memory with LRU)',
        'Use streams for large data instead of buffering',
        'Connection pooling for databases',
        'Implement circuit breakers for external services',
        'Use CDN for static assets',
      ],
    };
  }

  // ===========================================================================
  // 12. LOAD BALANCING STRATEGIES
  // ===========================================================================

  function loadBalancingStrategies() {
    return {
      algorithms: {
        roundRobin: {
          description: 'Distribute requests sequentially to each server',
          pros: 'Simple, fair distribution',
          cons: 'Ignores server load/capacity differences',
          nodeJS: 'Default strategy for cluster module (on most OSes)',
        },
        leastConnections: {
          description: 'Send to the server with fewest active connections',
          pros: 'Adapts to varying request durations',
          cons: 'Slightly more complex to track',
          nodeJS: 'Not built-in; use Nginx or HAProxy',
        },
        ipHash: {
          description: 'Hash client IP to consistently route to same server',
          pros: 'Session affinity without sticky sessions',
          cons: 'Uneven distribution if IP ranges cluster',
          nodeJS: 'Nginx: ip_hash directive',
        },
        weightedRoundRobin: {
          description: 'Like round-robin but servers have different weights',
          pros: 'Accounts for different server capacities',
          cons: 'Requires manual weight configuration',
          nodeJS: 'Nginx: weight parameter in upstream block',
        },
        random: {
          description: 'Randomly select a server',
          pros: 'Simple, no state needed',
          cons: 'Can be uneven with small request counts',
          nodeJS: 'Custom implementation',
        },
      },
      tools: [
        'Nginx (most common reverse proxy/LB)',
        'HAProxy (high-performance TCP/HTTP LB)',
        'AWS ALB/NLB (cloud-native)',
        'Kubernetes Service (in-cluster LB)',
        'Traefik (modern, auto-discovery)',
      ],
    };
  }

  // Simple round-robin load balancer implementation
  class RoundRobinBalancer {
    #servers;
    #current = 0;

    constructor(servers) {
      this.#servers = servers;
    }

    next() {
      const server = this.#servers[this.#current];
      this.#current = (this.#current + 1) % this.#servers.length;
      return server;
    }
  }

  // Least-connections load balancer
  class LeastConnectionsBalancer {
    #servers;

    constructor(servers) {
      this.#servers = servers.map((s) => ({ ...s, connections: 0 }));
    }

    acquire() {
      const server = this.#servers.reduce((min, s) =>
        s.connections < min.connections ? s : min
      );
      server.connections++;
      return {
        server,
        release: () => { server.connections = Math.max(0, server.connections - 1); },
      };
    }
  }

  // ===========================================================================
  // 13. HEALTH CHECKS AND READINESS PROBES
  // ===========================================================================
  // In containerized/orchestrated environments, you need:
  //   - Liveness probe: Is the process alive? (restart if not)
  //   - Readiness probe: Can it accept traffic? (remove from LB if not)
  //   - Startup probe: Has it finished initializing? (don't check liveness yet)
  // ===========================================================================

  class HealthChecker {
    #checks = new Map();
    #startTime = Date.now();

    addCheck(name, checkFn) {
      this.#checks.set(name, checkFn);
    }

    async liveness() {
      // Basic: is the process responsive?
      return {
        status: 'ok',
        uptime: Math.floor((Date.now() - this.#startTime) / 1000),
        pid: process.pid,
        memory: process.memoryUsage().heapUsed,
      };
    }

    async readiness() {
      const results = {};
      let allHealthy = true;

      for (const [name, checkFn] of this.#checks) {
        try {
          await checkFn();
          results[name] = { status: 'ok' };
        } catch (err) {
          results[name] = { status: 'error', message: err.message };
          allHealthy = false;
        }
      }

      return {
        status: allHealthy ? 'ready' : 'not_ready',
        checks: results,
      };
    }
  }

  // Production health check endpoint pattern
  function healthCheckEndpointPattern() {
    return `
    const http = require('http');
    const healthChecker = new HealthChecker();

    // Register dependency checks
    healthChecker.addCheck('database', async () => {
      await pool.query('SELECT 1');
    });

    healthChecker.addCheck('redis', async () => {
      await redis.ping();
    });

    healthChecker.addCheck('external-api', async () => {
      const res = await fetch('https://api.example.com/health');
      if (!res.ok) throw new Error('External API unavailable');
    });

    // Health endpoints
    // GET /health/live  -> liveness (is process alive?)
    // GET /health/ready -> readiness (can accept traffic?)

    // Kubernetes config:
    // livenessProbe:
    //   httpGet:
    //     path: /health/live
    //     port: 3000
    //   initialDelaySeconds: 5
    //   periodSeconds: 10
    // readinessProbe:
    //   httpGet:
    //     path: /health/ready
    //     port: 3000
    //   initialDelaySeconds: 10
    //   periodSeconds: 5`;
  }

  // ===========================================================================
  // DEMO / TEST SECTION
  // ===========================================================================

  async function runDemos() {
    // ---- 1. Single-threaded model ----
    section('1. NODE.JS SINGLE-THREADED MODEL');
    explainSingleThreaded();

    // ---- 2. Cluster module ----
    section('2. THE CLUSTER MODULE');
    clusterExample();
    console.log('\n  Zero-downtime restart: Send SIGUSR2 to primary process');
    console.log('  Workers restart one-by-one, maintaining availability');

    // ---- 3. Worker Threads ----
    section('3. WORKER THREADS');

    console.log('  Running fibonacci(35) in a worker thread:');
    const fibResult = await runWorkerTask('fibonacci', { n: 35 });
    console.log(`    Result: fib(35) = ${fibResult.result} (thread ${fibResult.threadId})`);

    console.log('\n  Running prime check in a worker:');
    const primeResult = await runWorkerTask('prime-check', { number: 104729 });
    console.log(`    Is 104729 prime? ${primeResult.result}`);

    console.log('\n  Worker Pool (parallel fibonacci):');
    const pool = new WorkerPool(4);
    const start = performance.now();
    const fibResults = await Promise.all([
      pool.execute('fibonacci', { n: 30 }),
      pool.execute('fibonacci', { n: 31 }),
      pool.execute('fibonacci', { n: 32 }),
      pool.execute('fibonacci', { n: 33 }),
    ]);
    const poolTime = (performance.now() - start).toFixed(0);
    console.log(`    Results: ${fibResults.map((r) => r.result).join(', ')} in ~${poolTime}ms`);

    console.log('\n  SharedArrayBuffer + Atomics (4 workers x 1000 increments):');
    const sharedResult = await sharedMemoryDemo();
    console.log(`    Final counter value: ${sharedResult} (expected: 4000)`);

    console.log('\n  MessageChannel:');
    const channelMsg = await messageChannelExample();
    console.log(`    Received: "${channelMsg}"`);

    // ---- 4. Child process ----
    section('4. CHILD_PROCESS');

    const { nodeVersion } = childProcessExamples();
    console.log(`  Node version (via execSync): ${nodeVersion}`);
    console.log('  spawn: Stream-based, for long-running processes');
    console.log('  exec:  Buffered, for short commands (maxBuffer limit)');
    console.log('  fork:  For Node.js scripts, built-in IPC channel');

    // ---- 5. When to use what ----
    section('5. WHEN TO USE WHAT');

    const guide = whenToUseWhat();
    for (const [mechanism, info] of Object.entries(guide)) {
      console.log(`\n  ${mechanism}:`);
      console.log(`    Use case: ${info.useCase}`);
      console.log(`    Memory: ${info.memory}`);
      console.log(`    Communication: ${info.communication}`);
      console.log(`    Best for: ${info.bestFor.join(', ')}`);
    }

    // ---- 6. Connection pooling ----
    section('6. CONNECTION POOLING');

    const connPool = new ConnectionPool({ maxSize: 5, minSize: 2 });
    await connPool.initialize();

    // Simulate concurrent queries
    const queryPromises = [];
    for (let i = 0; i < 8; i++) {
      queryPromises.push(
        withConnection(connPool, async (conn) => {
          return conn.query(`SELECT ${i}`);
        })
      );
    }
    await Promise.all(queryPromises);
    console.log(`    Pool stats: ${JSON.stringify(connPool.stats)}`);
    await connPool.drain();

    // ---- 7. Graceful shutdown ----
    section('7. GRACEFUL SHUTDOWN');

    const server = new GracefulServer({ shutdownTimeout: 2000 });
    server.addConnection('conn-1');
    server.addConnection('conn-2');
    console.log(`    Active connections: ${server.connectionCount}`);

    // Simulate shutdown while connections are active
    const shutdownPromise = server.shutdown('SIGTERM');
    // Connections draining...
    await sleep(50);
    server.removeConnection('conn-1');
    server.removeConnection('conn-2');
    await shutdownPromise;

    // ---- 8. Memory management ----
    section('8. MEMORY MANAGEMENT');

    const memInfo = memoryInfo();
    console.log('  Current memory:');
    console.log(`    Heap total: ${memInfo.heap.total}`);
    console.log(`    Heap used:  ${memInfo.heap.used}`);
    console.log(`    Heap limit: ${memInfo.heap.limit}`);
    console.log(`    RSS:        ${memInfo.process.rss}`);

    console.log('\n  LRU Cache:');
    const lru = new LRUCache(3);
    lru.set('a', 1); lru.set('b', 2); lru.set('c', 3);
    lru.get('a'); // 'a' is now most recent
    lru.set('d', 4); // 'b' evicted (oldest)
    console.log(`    After set(a,b,c), get(a), set(d): size=${lru.size}`);
    console.log(`    get('b') = ${lru.get('b')} (evicted)`);
    console.log(`    get('a') = ${lru.get('a')} (still present)`);

    console.log('\n  Memory leak detection:');
    const detector = new MemoryLeakDetector({ threshold: 50 });
    detector.sample();
    // Simulate some allocation
    const tmp = Array.from({ length: 10000 }, (_, i) => ({ index: i, data: 'x'.repeat(100) }));
    detector.sample();
    console.log(`    Analysis: ${JSON.stringify(detector.analyze())}`);

    // ---- 9. CPU profiling ----
    section('9. CPU PROFILING');

    const profiling = cpuProfilingPatterns();
    console.log(`  Sorting 10000 elements: ${profiling.sortDuration}`);

    const profiler = new profiling.SimpleProfiler();
    profiler.start('array-fill');
    Array.from({ length: 100000 }, (_, i) => i * 2);
    profiler.end('array-fill');

    profiler.start('set-ops');
    const s = new Set(Array.from({ length: 10000 }, (_, i) => i));
    for (let i = 0; i < 10000; i++) s.has(i);
    profiler.end('set-ops');

    console.log('  Profiler report:');
    for (const line of profiler.report()) {
      console.log(`    ${line}`);
    }

    console.log('\n  Profiling tips:');
    for (const tip of profiling.tips) {
      console.log(`    - ${tip}`);
    }

    // ---- 10. PM2 patterns ----
    section('10. PROCESS MANAGERS (PM2)');

    const { ecosystemConfig, commands } = pm2Patterns();
    console.log('  ecosystem.config.js:');
    console.log(`    ${JSON.stringify(ecosystemConfig.apps[0].name)}: ${ecosystemConfig.apps[0].instances} instances, ${ecosystemConfig.apps[0].exec_mode} mode`);
    console.log(`    Max memory restart: ${ecosystemConfig.apps[0].max_memory_restart}`);

    console.log('\n  Key PM2 commands:');
    for (const [action, cmd] of Object.entries(commands)) {
      console.log(`    ${action.padEnd(10)} ${cmd}`);
    }

    // ---- 11. Scaling strategies ----
    section('11. HORIZONTAL VS VERTICAL SCALING');

    const strategies = scalingStrategies();
    console.log('  Vertical (Scale UP):');
    for (const s of strategies.vertical.strategies) {
      console.log(`    - ${s}`);
    }
    console.log('\n  Horizontal (Scale OUT):');
    for (const s of strategies.horizontal.strategies) {
      console.log(`    - ${s}`);
    }
    console.log('\n  Node.js-specific optimizations:');
    for (const s of strategies.nodeSpecific) {
      console.log(`    - ${s}`);
    }

    // ---- 12. Load balancing ----
    section('12. LOAD BALANCING STRATEGIES');

    const lbStrategies = loadBalancingStrategies();
    for (const [name, info] of Object.entries(lbStrategies.algorithms)) {
      console.log(`  ${name}:`);
      console.log(`    ${info.description}`);
      console.log(`    Pros: ${info.pros}`);
    }

    console.log('\n  Round-robin demo:');
    const rr = new RoundRobinBalancer([
      { host: 'server-1', port: 3001 },
      { host: 'server-2', port: 3002 },
      { host: 'server-3', port: 3003 },
    ]);
    for (let i = 0; i < 6; i++) {
      const s = rr.next();
      console.log(`    Request ${i + 1} -> ${s.host}:${s.port}`);
    }

    console.log('\n  Least-connections demo:');
    const lc = new LeastConnectionsBalancer([
      { host: 'server-1' },
      { host: 'server-2' },
      { host: 'server-3' },
    ]);
    const handle1 = lc.acquire();
    const handle2 = lc.acquire();
    const handle3 = lc.acquire();
    console.log(`    3 requests -> ${handle1.server.host}(${handle1.server.connections}), ${handle2.server.host}(${handle2.server.connections}), ${handle3.server.host}(${handle3.server.connections})`);
    handle1.release(); // release server-1
    const handle4 = lc.acquire();
    console.log(`    After release: next -> ${handle4.server.host} (least connections)`);

    // ---- 13. Health checks ----
    section('13. HEALTH CHECKS AND READINESS PROBES');

    const health = new HealthChecker();
    health.addCheck('database', async () => { /* simulated OK */ });
    health.addCheck('cache', async () => { /* simulated OK */ });
    health.addCheck('external-api', async () => {
      throw new Error('Connection refused');
    });

    const liveness = await health.liveness();
    console.log(`  Liveness: ${JSON.stringify(liveness)}`);

    const readiness = await health.readiness();
    console.log(`  Readiness: ${readiness.status}`);
    for (const [name, check] of Object.entries(readiness.checks)) {
      console.log(`    ${name}: ${check.status}${check.message ? ' - ' + check.message : ''}`);
    }

    console.log('\n  Kubernetes probe types:');
    console.log('    livenessProbe:  Is the process alive? (restart if failing)');
    console.log('    readinessProbe: Can it accept traffic? (remove from LB if failing)');
    console.log('    startupProbe:   Has it finished init? (delay other probes)');

    // ---- Summary ----
    section('SUMMARY');
    console.log(`
  Topic                   | Key Takeaway
  ------------------------|------------------------------------------------
  Single-threaded         | JS runs on one thread; libuv pool for blocking I/O
  Cluster module          | Fork workers per CPU core, share server port
  Worker threads          | True parallelism for CPU-bound work
  child_process           | External commands, isolated processes
  Connection pooling      | Reuse expensive connections (DB, HTTP)
  Graceful shutdown       | Drain connections, release resources, then exit
  Memory management       | Monitor heap, use LRU caches, avoid leaks
  CPU profiling           | --prof, --inspect, perf_hooks, clinic.js
  PM2                     | Production process manager with cluster mode
  Scaling                 | Vertical (bigger machine) vs Horizontal (more machines)
  Load balancing          | Round-robin, least-connections, IP hash
  Health checks           | Liveness + readiness probes for orchestrators
    `);
  }

  runDemos().catch(console.error);
}
