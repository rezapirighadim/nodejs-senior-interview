/**
 * ============================================================================
 * LOW-LEVEL DESIGN: EVENT BUS / MESSAGE BROKER
 * ============================================================================
 *
 * Problem:
 *   Design an in-process event bus that supports pub/sub with wildcard topics,
 *   middleware pipelines, once-only subscriptions, async handlers, dead-letter
 *   handling, and event replay.
 *
 * Key Design Patterns:
 *   - Observer / Pub-Sub  -- decouple publishers from subscribers
 *   - Middleware chain     -- transform or filter messages before delivery
 *   - Iterator             -- replay stored event history
 *
 * Topic Matching:
 *   Dot-separated segments with wildcards:
 *     *   matches exactly one segment   ("user.*"  matches "user.created")
 *     #   matches zero or more segments ("log.#"   matches "log", "log.error",
 *                                        "log.error.fatal")
 *
 * Complexity:
 *   publish   O(S)  where S = number of matching subscriptions
 *   subscribe O(1)
 *
 * Run:  node 08_event_bus.js
 * ============================================================================
 */

'use strict';

// ─── Subscription ───────────────────────────────────────────────────────────

let _subIdCounter = 0;

/**
 * Represents a single subscription to a topic pattern.
 */
class Subscription {
  /**
   * @param {string}   pattern   topic pattern (may include * and #)
   * @param {Function} handler   callback(data, meta)
   * @param {Object}   [opts]
   * @param {boolean}  [opts.once]  auto-unsubscribe after first delivery
   */
  constructor(pattern, handler, opts = {}) {
    this.id = ++_subIdCounter;
    this.pattern = pattern;
    this.handler = handler;
    this.once = opts.once ?? false;
    this.active = true;
    this._regex = Subscription._patternToRegex(pattern);
  }

  /**
   * Convert a dot-separated wildcard pattern to a RegExp.
   *   *  -> matches one segment
   *   #  -> matches zero or more segments
   * @param {string} pattern
   * @returns {RegExp}
   */
  static _patternToRegex(pattern) {
    const segments = pattern.split('.');
    let regex = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg === '#') {
        // # matches zero or more dot-separated segments
        // If # is not the first segment, we need an optional dot before it
        if (i > 0) {
          // Replace the trailing \\. from the previous join with an optional group
          regex += '(\\.[a-zA-Z0-9_]+(\\.[a-zA-Z0-9_]+)*)?';
        } else {
          regex += '([a-zA-Z0-9_]+(\\.[a-zA-Z0-9_]+)*)?';
        }
      } else {
        if (i > 0) regex += '\\.';
        if (seg === '*') {
          regex += '[a-zA-Z0-9_]+';
        } else {
          regex += seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
    }

    return new RegExp(`^${regex}$`);
  }

  /**
   * Test whether a concrete topic matches this subscription's pattern.
   * @param {string} topic
   * @returns {boolean}
   */
  matches(topic) {
    return this._regex.test(topic);
  }
}

// ─── Dead Letter Record ─────────────────────────────────────────────────────

/**
 * A record of a failed delivery, stored in the dead-letter queue.
 */
class DeadLetter {
  /**
   * @param {string}  topic
   * @param {*}       data
   * @param {number}  subscriptionId
   * @param {Error}   error
   * @param {Date}    timestamp
   */
  constructor(topic, data, subscriptionId, error, timestamp) {
    this.topic = topic;
    this.data = data;
    this.subscriptionId = subscriptionId;
    this.error = error;
    this.timestamp = timestamp;
  }
}

// ─── Event Record (for history / replay) ────────────────────────────────────

class EventRecord {
  /**
   * @param {string} topic
   * @param {*}      data
   * @param {Date}   timestamp
   */
  constructor(topic, data, timestamp) {
    this.topic = topic;
    this.data = data;
    this.timestamp = timestamp;
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * @callback MiddlewareFn
 * @param {string}   topic
 * @param {*}        data
 * @param {Function} next   call next(topic, data) to continue the chain
 * @returns {void | Promise<void>}
 */

// ─── Event Bus ──────────────────────────────────────────────────────────────

class EventBus {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.historyLimit]  max events to retain (0 = unlimited)
   */
  constructor(opts = {}) {
    /** @type {Subscription[]} */
    this._subscriptions = [];

    /** @type {MiddlewareFn[]} */
    this._middleware = [];

    /** @type {EventRecord[]} */
    this._history = [];

    /** @type {DeadLetter[]} */
    this._deadLetters = [];

    /** @type {number} */
    this._historyLimit = opts.historyLimit ?? 1000;

    /** @type {number} */
    this._publishedCount = 0;
    this._deliveredCount = 0;
    this._failedCount = 0;
  }

  // ── Subscribe ─────────────────────────────────────────────────────────

  /**
   * Subscribe to a topic pattern.
   * @param {string}   pattern
   * @param {Function} handler
   * @param {Object}   [opts]
   * @param {boolean}  [opts.once]
   * @returns {number}  subscription id (for unsubscribe)
   */
  subscribe(pattern, handler, opts = {}) {
    const sub = new Subscription(pattern, handler, opts);
    this._subscriptions.push(sub);
    return sub.id;
  }

  /**
   * Subscribe for a single delivery, then auto-unsubscribe.
   * @param {string}   pattern
   * @param {Function} handler
   * @returns {number}
   */
  once(pattern, handler) {
    return this.subscribe(pattern, handler, { once: true });
  }

  /**
   * Unsubscribe by subscription id.
   * @param {number} id
   * @returns {boolean}
   */
  unsubscribe(id) {
    const idx = this._subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this._subscriptions[idx].active = false;
    this._subscriptions.splice(idx, 1);
    return true;
  }

  /**
   * Remove all subscriptions matching a pattern string.
   * @param {string} pattern
   * @returns {number} count removed
   */
  unsubscribeAll(pattern) {
    const before = this._subscriptions.length;
    this._subscriptions = this._subscriptions.filter((s) => {
      if (s.pattern === pattern) {
        s.active = false;
        return false;
      }
      return true;
    });
    return before - this._subscriptions.length;
  }

  // ── Middleware ─────────────────────────────────────────────────────────

  /**
   * Register a middleware function.
   * Middleware receives (topic, data, next) and must call next() to continue.
   * It can modify topic/data, or not call next() to filter the message.
   * @param {MiddlewareFn} fn
   */
  use(fn) {
    this._middleware.push(fn);
  }

  /**
   * Run the middleware chain, returning the (possibly transformed) topic+data.
   * If any middleware does not call next(), returns null (filtered out).
   * @param {string} topic
   * @param {*}      data
   * @returns {Promise<{ topic: string, data: * } | null>}
   */
  async _runMiddleware(topic, data) {
    let currentTopic = topic;
    let currentData = data;
    let index = 0;
    let proceeded = true;

    const next = (nextTopic, nextData) => {
      currentTopic = nextTopic ?? currentTopic;
      currentData = nextData ?? currentData;
      proceeded = true;
    };

    for (index = 0; index < this._middleware.length; index++) {
      proceeded = false;
      await this._middleware[index](currentTopic, currentData, next);
      if (!proceeded) return null; // filtered
    }

    return { topic: currentTopic, data: currentData };
  }

  // ── Publish ───────────────────────────────────────────────────────────

  /**
   * Publish an event to a specific topic.
   * Runs middleware, then delivers to all matching subscriptions.
   *
   * @param {string} topic  concrete topic (no wildcards)
   * @param {*}      data   payload
   * @returns {Promise<{ delivered: number, failed: number }>}
   */
  async publish(topic, data) {
    this._publishedCount++;

    // Run middleware pipeline
    const result = await this._runMiddleware(topic, data);
    if (!result) {
      // Filtered by middleware
      return { delivered: 0, failed: 0 };
    }

    const { topic: finalTopic, data: finalData } = result;

    // Store in history
    const record = new EventRecord(finalTopic, finalData, new Date());
    this._history.push(record);
    if (this._historyLimit > 0 && this._history.length > this._historyLimit) {
      this._history.shift();
    }

    let delivered = 0;
    let failed = 0;

    // Find matching subscriptions
    const toRemove = [];

    for (const sub of this._subscriptions) {
      if (!sub.active) continue;
      if (!sub.matches(finalTopic)) continue;

      const meta = { topic: finalTopic, timestamp: record.timestamp, subscriptionId: sub.id };

      try {
        await sub.handler(finalData, meta);
        delivered++;
        this._deliveredCount++;
      } catch (err) {
        failed++;
        this._failedCount++;
        this._deadLetters.push(
          new DeadLetter(finalTopic, finalData, sub.id, err, record.timestamp)
        );
      }

      if (sub.once) {
        toRemove.push(sub.id);
      }
    }

    // Clean up once-only subscriptions
    for (const id of toRemove) {
      this.unsubscribe(id);
    }

    return { delivered, failed };
  }

  // ── History & Replay ──────────────────────────────────────────────────

  /**
   * Get event history, optionally filtered by topic pattern.
   * @param {Object}  [filter]
   * @param {string}  [filter.topic]   exact topic
   * @param {string}  [filter.pattern] wildcard pattern
   * @param {number}  [filter.limit]
   * @returns {EventRecord[]}
   */
  getHistory(filter = {}) {
    let events = [...this._history];

    if (filter.topic) {
      events = events.filter((e) => e.topic === filter.topic);
    } else if (filter.pattern) {
      const sub = new Subscription(filter.pattern, () => {});
      events = events.filter((e) => sub.matches(e.topic));
    }

    if (filter.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Replay historical events to current subscribers.
   * @param {Object}  [filter]   same filter as getHistory()
   * @returns {Promise<{ replayed: number, delivered: number, failed: number }>}
   */
  async replay(filter = {}) {
    const events = this.getHistory(filter);
    let totalDelivered = 0;
    let totalFailed = 0;

    for (const event of events) {
      // Skip middleware on replay -- deliver directly
      for (const sub of this._subscriptions) {
        if (!sub.active || !sub.matches(event.topic)) continue;
        const meta = {
          topic: event.topic,
          timestamp: event.timestamp,
          subscriptionId: sub.id,
          isReplay: true,
        };
        try {
          await sub.handler(event.data, meta);
          totalDelivered++;
        } catch {
          totalFailed++;
        }
      }
    }

    return { replayed: events.length, delivered: totalDelivered, failed: totalFailed };
  }

  // ── Dead Letters ──────────────────────────────────────────────────────

  /** @returns {DeadLetter[]} */
  getDeadLetters() {
    return [...this._deadLetters];
  }

  /** Clear the dead-letter queue. */
  clearDeadLetters() {
    this._deadLetters.length = 0;
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  stats() {
    return {
      subscriptions: this._subscriptions.length,
      published: this._publishedCount,
      delivered: this._deliveredCount,
      failed: this._failedCount,
      historySize: this._history.length,
      deadLetters: this._deadLetters.length,
    };
  }
}

// ============================================================================
// DEMO
// ============================================================================

async function demo() {
  console.log('='.repeat(72));
  console.log(' EVENT BUS / MESSAGE BROKER -- DEMO');
  console.log('='.repeat(72));

  const bus = new EventBus({ historyLimit: 50 });

  // ── 1. Basic pub/sub ──────────────────────────────────────────────────
  console.log('\n--- 1. Basic Pub/Sub ---');

  bus.subscribe('user.created', (data) => {
    console.log(`  [user.created handler] New user: ${data.name} (${data.email})`);
  });

  bus.subscribe('user.deleted', (data) => {
    console.log(`  [user.deleted handler] Removed user: ${data.id}`);
  });

  await bus.publish('user.created', { name: 'Alice', email: 'alice@example.com' });
  await bus.publish('user.deleted', { id: 42 });

  // ── 2. Wildcard subscriptions ─────────────────────────────────────────
  console.log('\n--- 2. Wildcard Subscriptions ---');

  bus.subscribe('order.*', (data, meta) => {
    console.log(`  [order.* handler] topic=${meta.topic}, orderId=${data.orderId}`);
  });

  bus.subscribe('log.#', (data, meta) => {
    console.log(`  [log.# handler] topic=${meta.topic}, message=${data.message}`);
  });

  await bus.publish('order.placed', { orderId: 'ORD-001', total: 99.99 });
  await bus.publish('order.shipped', { orderId: 'ORD-001', carrier: 'FedEx' });
  await bus.publish('log.error', { message: 'Something broke' });
  await bus.publish('log.error.fatal', { message: 'Critical failure' });

  // ── 3. Once-only subscription ─────────────────────────────────────────
  console.log('\n--- 3. Once-Only Subscription ---');

  bus.once('app.initialized', (data) => {
    console.log(`  [once handler] App initialized: v${data.version}`);
  });

  await bus.publish('app.initialized', { version: '2.0.0' });
  const result = await bus.publish('app.initialized', { version: '2.0.1' });
  console.log(`  Second publish delivered to ${result.delivered} handlers (should be 0)`);

  // ── 4. Middleware ─────────────────────────────────────────────────────
  console.log('\n--- 4. Middleware ---');

  // Middleware: add timestamp to all events
  bus.use((topic, data, next) => {
    next(topic, { ...data, _processedAt: new Date().toISOString() });
  });

  // Middleware: filter out events with { blocked: true }
  bus.use((topic, data, next) => {
    if (data.blocked) {
      console.log(`  [middleware] Blocked event on topic: ${topic}`);
      return; // do not call next() -> filters the message
    }
    next(topic, data);
  });

  bus.subscribe('payment.*', (data, meta) => {
    console.log(`  [payment handler] topic=${meta.topic}, amount=${data.amount}, processedAt=${data._processedAt}`);
  });

  await bus.publish('payment.received', { amount: 150 });
  await bus.publish('payment.refunded', { amount: 50, blocked: true });

  // ── 5. Async handlers ────────────────────────────────────────────────
  console.log('\n--- 5. Async Handler ---');

  bus.subscribe('email.send', async (data) => {
    await new Promise((r) => setTimeout(r, 50));
    console.log(`  [async email handler] Sent email to ${data.to} after 50ms delay`);
  });

  await bus.publish('email.send', { to: 'bob@example.com', subject: 'Hello' });

  // ── 6. Dead letter handling ───────────────────────────────────────────
  console.log('\n--- 6. Dead Letter Handling ---');

  bus.subscribe('risky.operation', () => {
    throw new Error('Handler crashed!');
  });

  const riskyResult = await bus.publish('risky.operation', { attempt: 1 });
  console.log(`  Delivered: ${riskyResult.delivered}, Failed: ${riskyResult.failed}`);

  const deadLetters = bus.getDeadLetters();
  console.log(`  Dead letters: ${deadLetters.length}`);
  for (const dl of deadLetters) {
    console.log(`    topic=${dl.topic}, error="${dl.error.message}", subId=${dl.subscriptionId}`);
  }

  // ── 7. Unsubscribe ───────────────────────────────────────────────────
  console.log('\n--- 7. Unsubscribe ---');

  const tempId = bus.subscribe('temp.event', () => {
    console.log('  [temp handler] This should not appear after unsubscribe');
  });

  await bus.publish('temp.event', {});
  bus.unsubscribe(tempId);
  const afterUnsub = await bus.publish('temp.event', {});
  console.log(`  After unsubscribe: delivered=${afterUnsub.delivered} (should be 0)`);

  // ── 8. Event history ──────────────────────────────────────────────────
  console.log('\n--- 8. Event History ---');

  const allHistory = bus.getHistory();
  console.log(`  Total events in history: ${allHistory.length}`);

  const userHistory = bus.getHistory({ pattern: 'user.*' });
  console.log(`  Events matching "user.*": ${userHistory.length}`);
  for (const evt of userHistory) {
    console.log(`    ${evt.topic} @ ${evt.timestamp.toISOString()}`);
  }

  // ── 9. Replay ─────────────────────────────────────────────────────────
  console.log('\n--- 9. Replay ---');

  const replayLog = [];
  bus.subscribe('order.*', (data, meta) => {
    if (meta.isReplay) {
      replayLog.push(`  [replay] ${meta.topic}: orderId=${data.orderId}`);
    }
  });

  const replayResult = await bus.replay({ pattern: 'order.*' });
  for (const line of replayLog) console.log(line);
  console.log(
    `  Replayed ${replayResult.replayed} events, delivered ${replayResult.delivered}, failed ${replayResult.failed}`
  );

  // ── 10. Stats ─────────────────────────────────────────────────────────
  console.log('\n--- 10. Bus Statistics ---');
  console.log(bus.stats());

  console.log('\n' + '='.repeat(72));
  console.log(' DEMO COMPLETE');
  console.log('='.repeat(72));
}

demo();
