/**
 * ============================================================================
 * LOW-LEVEL DESIGN: Task Scheduler
 * ============================================================================
 *
 * Problem:
 *   Design a task scheduler that supports one-time and recurring tasks with
 *   priorities, state management, retries, and cancellation.
 *
 * Key Concepts:
 *   - Priority Queue implemented as a MinHeap (lower priority number = higher priority)
 *   - State Machine for task lifecycle (pending -> running -> completed/failed)
 *   - Command pattern: tasks encapsulate their own execution logic
 *   - Retry with configurable max attempts
 *   - Cron-like recurring tasks re-enqueue after completion
 *
 * Classes:
 *   TaskPriority / TaskState   -- enum-like constants
 *   MinHeap                    -- generic heap for the priority queue
 *   Task                       -- base task with priority, state, retry config
 *   RecurringTask              -- extends Task with interval-based re-scheduling
 *   TaskScheduler              -- orchestrator: enqueue, execute, cancel
 *
 * Run: node 04_task_scheduler.js
 * ============================================================================
 */

// ─── Enum-like Constants ────────────────────────────────────────────────────

/** @enum {number} Lower number = higher priority */
const TaskPriority = Object.freeze({
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10,
});

/** @enum {string} */
const TaskState = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

// ─── MinHeap (Priority Queue) ───────────────────────────────────────────────

/**
 * Generic min-heap. The comparator should return negative if a < b.
 */
class MinHeap {
  /**
   * @param {(a: any, b: any) => number} comparator
   */
  constructor(comparator) {
    /** @type {any[]} */
    this.data = [];
    this.comparator = comparator;
  }

  get size() {
    return this.data.length;
  }

  get isEmpty() {
    return this.data.length === 0;
  }

  /** @returns {any | undefined} */
  peek() {
    return this.data[0];
  }

  /** @param {any} value */
  push(value) {
    this.data.push(value);
    this.#bubbleUp(this.data.length - 1);
  }

  /** @returns {any | undefined} */
  pop() {
    if (this.isEmpty) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this.#sinkDown(0);
    }
    return top;
  }

  /**
   * Remove a specific item from the heap.
   * @param {(item: any) => boolean} predicate
   * @returns {boolean} true if removed
   */
  remove(predicate) {
    const idx = this.data.findIndex(predicate);
    if (idx === -1) return false;
    const last = this.data.pop();
    if (idx < this.data.length) {
      this.data[idx] = last;
      this.#bubbleUp(idx);
      this.#sinkDown(idx);
    }
    return true;
  }

  /** Convert to sorted array (non-destructive). */
  toSortedArray() {
    return [...this.data].sort(this.comparator);
  }

  #bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.comparator(this.data[i], this.data[parent]) >= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  #sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.comparator(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this.comparator(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

// ─── Task ───────────────────────────────────────────────────────────────────

class Task {
  static #nextId = 1;

  /**
   * @param {string} name
   * @param {() => any | Promise<any>} action - the work to execute
   * @param {object} [options]
   * @param {number} [options.priority] - TaskPriority value
   * @param {number} [options.maxRetries] - max retry attempts on failure
   * @param {Date} [options.scheduledAt] - when to run (defaults to now)
   */
  constructor(name, action, { priority = TaskPriority.MEDIUM, maxRetries = 0, scheduledAt = new Date() } = {}) {
    this.id = Task.#nextId++;
    this.name = name;
    this.action = action;
    this.priority = priority;
    this.maxRetries = maxRetries;
    this.scheduledAt = scheduledAt;

    /** @type {string} */
    this.state = TaskState.PENDING;
    this.attempts = 0;
    /** @type {any} */
    this.result = null;
    /** @type {Error | null} */
    this.lastError = null;
    this.createdAt = new Date();
    /** @type {Date | null} */
    this.completedAt = null;
  }

  /** @returns {boolean} */
  get canRetry() {
    return this.attempts <= this.maxRetries;
  }

  /** @returns {boolean} */
  get isReadyToRun() {
    return this.state === TaskState.PENDING && new Date() >= this.scheduledAt;
  }

  /**
   * Execute the task action.
   * @returns {Promise<any>}
   */
  async execute() {
    this.state = TaskState.RUNNING;
    this.attempts++;

    try {
      this.result = await this.action();
      this.state = TaskState.COMPLETED;
      this.completedAt = new Date();
      return this.result;
    } catch (err) {
      this.lastError = err;
      if (this.canRetry) {
        this.state = TaskState.PENDING; // re-enqueue for retry
      } else {
        this.state = TaskState.FAILED;
        this.completedAt = new Date();
      }
      throw err;
    }
  }

  toString() {
    return `Task#${this.id}[${this.name}, pri=${this.priority}, state=${this.state}]`;
  }
}

// ─── Recurring Task ─────────────────────────────────────────────────────────

class RecurringTask extends Task {
  /**
   * @param {string} name
   * @param {() => any | Promise<any>} action
   * @param {number} intervalMs - interval in milliseconds between runs
   * @param {object} [options]
   * @param {number} [options.priority]
   * @param {number} [options.maxRetries]
   * @param {number} [options.maxRuns] - max times to run (0 = unlimited)
   */
  constructor(name, action, intervalMs, { priority = TaskPriority.MEDIUM, maxRetries = 0, maxRuns = 0 } = {}) {
    super(name, action, { priority, maxRetries });
    this.intervalMs = intervalMs;
    this.maxRuns = maxRuns;
    this.runCount = 0;
    this.isRecurring = true;
  }

  get shouldRecur() {
    return this.maxRuns === 0 || this.runCount < this.maxRuns;
  }

  /**
   * After completion, prepare for next run.
   */
  resetForNextRun() {
    this.state = TaskState.PENDING;
    this.scheduledAt = new Date(Date.now() + this.intervalMs);
    this.attempts = 0;
    this.result = null;
    this.lastError = null;
    this.completedAt = null;
  }

  toString() {
    return `RecurringTask#${this.id}[${this.name}, every ${this.intervalMs}ms, runs=${this.runCount}/${this.maxRuns || "inf"}]`;
  }
}

// ─── Task Scheduler ─────────────────────────────────────────────────────────

class TaskScheduler {
  constructor() {
    /** @type {MinHeap} priority queue ordered by (priority, scheduledAt) */
    this.queue = new MinHeap((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
    /** @type {Map<number, Task>} taskId -> Task (for lookup) */
    this.tasks = new Map();
    /** @type {Task[]} */
    this.completedTasks = [];
  }

  /**
   * Schedule a task.
   * @param {Task} task
   * @returns {Task}
   */
  schedule(task) {
    this.queue.push(task);
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Cancel a pending task.
   * @param {number} taskId
   * @returns {boolean}
   */
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== TaskState.PENDING) return false;
    task.state = TaskState.CANCELLED;
    this.queue.remove((t) => t.id === taskId);
    this.tasks.delete(taskId);
    return true;
  }

  /**
   * Execute the next ready task from the queue.
   * @returns {Promise<{ task: Task, success: boolean } | null>}
   */
  async executeNext() {
    // Skip cancelled or not-yet-ready tasks
    while (!this.queue.isEmpty) {
      const top = this.queue.peek();
      if (top.state === TaskState.CANCELLED) {
        this.queue.pop();
        continue;
      }
      if (!top.isReadyToRun) {
        // The highest-priority ready task isn't ready yet
        break;
      }
      break;
    }

    if (this.queue.isEmpty) return null;

    const task = this.queue.peek();
    if (!task.isReadyToRun) return null;

    this.queue.pop();
    let success = false;

    try {
      await task.execute();
      success = true;
    } catch (err) {
      // If it can retry, re-enqueue
      if (task.state === TaskState.PENDING) {
        this.queue.push(task);
        return { task, success: false };
      }
    }

    // Handle recurring tasks
    if (success && task instanceof RecurringTask) {
      task.runCount++;
      if (task.shouldRecur) {
        task.resetForNextRun();
        this.queue.push(task);
      } else {
        this.completedTasks.push(task);
        this.tasks.delete(task.id);
      }
    } else if (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) {
      this.completedTasks.push(task);
      this.tasks.delete(task.id);
    }

    return { task, success };
  }

  /**
   * Execute all ready tasks in priority order.
   * @returns {Promise<Array<{ task: Task, success: boolean }>>}
   */
  async executeAll() {
    const results = [];
    while (true) {
      const result = await this.executeNext();
      if (!result) break;
      results.push(result);
    }
    return results;
  }

  /** @returns {{ pending: number, completed: number, failed: number }} */
  getStats() {
    let pending = 0;
    for (const t of this.tasks.values()) {
      if (t.state === TaskState.PENDING) pending++;
    }
    const completed = this.completedTasks.filter((t) => t.state === TaskState.COMPLETED).length;
    const failed = this.completedTasks.filter((t) => t.state === TaskState.FAILED).length;
    return { pending, completed, failed, queueSize: this.queue.size };
  }

  /** Display queue contents. */
  displayQueue() {
    console.log(`\n  Queue (${this.queue.size} tasks):`);
    const sorted = this.queue.toSortedArray();
    for (const t of sorted) {
      console.log(`    ${t}`);
    }
  }
}

// ─── Demo ───────────────────────────────────────────────────────────────────

async function demo() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       TASK SCHEDULER  —  LLD DEMO           ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const scheduler = new TaskScheduler();

  // 1. Schedule one-time tasks with different priorities
  console.log("--- Schedule one-time tasks ---");

  scheduler.schedule(
    new Task("Send welcome email", () => "Email sent!", { priority: TaskPriority.HIGH })
  );
  scheduler.schedule(
    new Task("Generate report", () => "Report generated!", { priority: TaskPriority.LOW })
  );
  scheduler.schedule(
    new Task("Process payment", () => "Payment processed!", { priority: TaskPriority.HIGH })
  );
  scheduler.schedule(
    new Task("Update search index", () => "Index updated!", { priority: TaskPriority.MEDIUM })
  );

  scheduler.displayQueue();

  // 2. Execute all -- they should run in priority order
  console.log("\n--- Execute all (priority order) ---");
  const results = await scheduler.executeAll();
  for (const { task, success } of results) {
    console.log(`  Executed: ${task.name} (pri=${task.priority}) -> ${success ? task.result : "FAILED"}`);
  }

  console.log(`  Stats:`, scheduler.getStats());

  // 3. Task with retries
  console.log("\n--- Task with retries ---");
  let failCount = 0;
  const flaky = new Task(
    "Flaky API call",
    () => {
      failCount++;
      if (failCount <= 2) throw new Error(`Attempt ${failCount} failed`);
      return "API call succeeded on attempt 3!";
    },
    { priority: TaskPriority.HIGH, maxRetries: 3 }
  );
  scheduler.schedule(flaky);

  // Execute multiple times to see retries
  for (let i = 0; i < 4; i++) {
    const r = await scheduler.executeNext();
    if (r) {
      console.log(
        `  Attempt: ${r.task.name} -> ${r.success ? r.task.result : `Failed (${r.task.lastError.message}), state=${r.task.state}`}`
      );
    }
  }
  console.log(`  Final state: ${flaky.state}, attempts: ${flaky.attempts}`);

  // 4. Task that exhausts retries
  console.log("\n--- Task that exhausts all retries ---");
  const alwaysFails = new Task(
    "Bad task",
    () => { throw new Error("Always fails"); },
    { priority: TaskPriority.MEDIUM, maxRetries: 1 }
  );
  scheduler.schedule(alwaysFails);

  for (let i = 0; i < 3; i++) {
    const r = await scheduler.executeNext();
    if (r) {
      console.log(
        `  ${r.task.name}: attempt=${r.task.attempts}, state=${r.task.state}`
      );
    }
  }
  console.log(`  Final state: ${alwaysFails.state}`);

  // 5. Recurring task
  console.log("\n--- Recurring task (max 3 runs) ---");
  let heartbeatCount = 0;
  const heartbeat = new RecurringTask(
    "Heartbeat",
    () => {
      heartbeatCount++;
      return `beat #${heartbeatCount}`;
    },
    100, // 100ms interval (ignored in sync demo, but models the concept)
    { priority: TaskPriority.LOW, maxRuns: 3 }
  );
  // Force scheduledAt to now for demo
  heartbeat.scheduledAt = new Date();
  scheduler.schedule(heartbeat);

  for (let i = 0; i < 4; i++) {
    // Force next run to be ready immediately for demo
    if (heartbeat.state === TaskState.PENDING) {
      heartbeat.scheduledAt = new Date();
    }
    const r = await scheduler.executeNext();
    if (r) {
      console.log(
        `  ${r.task}: result=${r.task.result}, runCount=${heartbeat.runCount}`
      );
    } else {
      console.log(`  No more tasks to execute.`);
    }
  }

  // 6. Cancel a task
  console.log("\n--- Cancel a task ---");
  const cancelMe = new Task("Cancel me", () => "Should not run", { priority: TaskPriority.LOW });
  scheduler.schedule(cancelMe);
  console.log(`  Before cancel: ${cancelMe}`);
  const cancelled = scheduler.cancel(cancelMe.id);
  console.log(`  Cancelled: ${cancelled}, state: ${cancelMe.state}`);
  const r = await scheduler.executeNext();
  console.log(`  Execute after cancel: ${r ?? "null (nothing to run)"}`);

  // 7. Scheduled in the future
  console.log("\n--- Future-scheduled task ---");
  const futureTask = new Task(
    "Future task",
    () => "Ran in the future!",
    { priority: TaskPriority.HIGH, scheduledAt: new Date(Date.now() + 60000) }
  );
  scheduler.schedule(futureTask);
  const futureResult = await scheduler.executeNext();
  console.log(`  Execute future task now: ${futureResult ?? "null (not ready yet)"}`);
  console.log(`  Task state: ${futureTask.state}, scheduledAt: ${futureTask.scheduledAt}`);

  // 8. MinHeap standalone verification
  console.log("\n--- MinHeap verification ---");
  const heap = new MinHeap((a, b) => a - b);
  [5, 3, 8, 1, 4, 7, 2].forEach((n) => heap.push(n));
  const sorted = [];
  while (!heap.isEmpty) sorted.push(heap.pop());
  console.log(`  Heap sort: [${sorted}] (expected: 1,2,3,4,5,7,8)`);

  console.log("\n  Final stats:", scheduler.getStats());
  console.log("\n--- Done ---");
}

demo();
