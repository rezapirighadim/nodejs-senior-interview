/**
 * ============================================================================
 * LOW-LEVEL DESIGN: NOTIFICATION SERVICE
 * ============================================================================
 *
 * Problem:
 *   Design a notification service that supports multiple delivery channels,
 *   user preferences, templated content, priority levels, batching, and
 *   notification history.
 *
 * Key Design Patterns:
 *   - Strategy   -- each channel (email, SMS, push) is a pluggable strategy
 *   - Observer   -- users subscribe to notification topics
 *   - Template   -- reusable content templates with variable interpolation
 *
 * Data Structures:
 *   - Map<userId, UserPreferences>
 *   - Map<userId, NotificationRecord[]>  (history)
 *   - Map<templateId, Template>
 *
 * Complexity:
 *   - send()          O(channels)  per recipient
 *   - sendBatch()     O(recipients * channels)
 *   - getHistory()    O(1) lookup + O(n) retrieval
 *
 * Run:  node 06_notification_service.js
 * ============================================================================
 */

'use strict';

// ─── Priority Enum ──────────────────────────────────────────────────────────

/** @enum {string} */
const Priority = Object.freeze({
  URGENT: 'urgent',
  NORMAL: 'normal',
  LOW: 'low',
});

/** @enum {string} */
const ChannelType = Object.freeze({
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
});

// ─── Notification Channel Strategy ──────────────────────────────────────────

/**
 * Base class for all notification channels (Strategy interface).
 * @abstract
 */
class NotificationChannel {
  /** @returns {string} */
  get name() {
    throw new Error('Subclass must implement get name()');
  }

  /**
   * Deliver a notification through this channel.
   * @param {string} userId
   * @param {string} subject
   * @param {string} body
   * @param {Priority} priority
   * @returns {{ success: boolean, channel: string, timestamp: Date }}
   */
  send(userId, subject, body, priority) {
    throw new Error('Subclass must implement send()');
  }
}

/** Email channel strategy. */
class EmailChannel extends NotificationChannel {
  get name() {
    return ChannelType.EMAIL;
  }

  send(userId, subject, body, priority) {
    const timestamp = new Date();
    console.log(
      `  [EMAIL -> ${userId}] Subject: "${subject}" | Priority: ${priority}`
    );
    console.log(`           Body: ${body.slice(0, 80)}...`);
    return { success: true, channel: this.name, timestamp };
  }
}

/** SMS channel strategy. */
class SMSChannel extends NotificationChannel {
  /** @type {number} */
  static MAX_LENGTH = 160;

  get name() {
    return ChannelType.SMS;
  }

  send(userId, subject, body, priority) {
    const timestamp = new Date();
    const truncated =
      body.length > SMSChannel.MAX_LENGTH
        ? body.slice(0, SMSChannel.MAX_LENGTH - 3) + '...'
        : body;
    console.log(
      `  [SMS  -> ${userId}] "${truncated}" | Priority: ${priority}`
    );
    return { success: true, channel: this.name, timestamp };
  }
}

/** Push notification channel strategy. */
class PushChannel extends NotificationChannel {
  get name() {
    return ChannelType.PUSH;
  }

  send(userId, subject, body, priority) {
    const timestamp = new Date();
    console.log(
      `  [PUSH -> ${userId}] Title: "${subject}" | Priority: ${priority}`
    );
    return { success: true, channel: this.name, timestamp };
  }
}

// ─── Notification Template ──────────────────────────────────────────────────

/**
 * A reusable notification template with mustache-style {{variable}} placeholders.
 */
class NotificationTemplate {
  /**
   * @param {string} id
   * @param {string} subjectTemplate
   * @param {string} bodyTemplate
   */
  constructor(id, subjectTemplate, bodyTemplate) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.subjectTemplate = subjectTemplate;
    /** @type {string} */
    this.bodyTemplate = bodyTemplate;
  }

  /**
   * Render the template by replacing {{key}} placeholders.
   * @param {Record<string, string>} variables
   * @returns {{ subject: string, body: string }}
   */
  render(variables) {
    const replace = (tpl) =>
      tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
    return {
      subject: replace(this.subjectTemplate),
      body: replace(this.bodyTemplate),
    };
  }
}

// ─── User Preferences ───────────────────────────────────────────────────────

/**
 * Per-user notification preferences: opt-in/opt-out per channel and quiet hours.
 */
class UserPreferences {
  /**
   * @param {string} userId
   * @param {Object} [opts]
   * @param {Set<string>} [opts.enabledChannels]
   * @param {boolean}     [opts.quietHoursEnabled]
   * @param {number}      [opts.quietStart]  hour 0-23
   * @param {number}      [opts.quietEnd]    hour 0-23
   */
  constructor(userId, opts = {}) {
    this.userId = userId;
    /** @type {Set<string>} */
    this.enabledChannels =
      opts.enabledChannels ??
      new Set([ChannelType.EMAIL, ChannelType.SMS, ChannelType.PUSH]);
    this.quietHoursEnabled = opts.quietHoursEnabled ?? false;
    this.quietStart = opts.quietStart ?? 22;
    this.quietEnd = opts.quietEnd ?? 7;
  }

  /**
   * @param {string} channel
   * @returns {boolean}
   */
  isChannelEnabled(channel) {
    return this.enabledChannels.has(channel);
  }

  /** @param {string} channel */
  enableChannel(channel) {
    this.enabledChannels.add(channel);
  }

  /** @param {string} channel */
  disableChannel(channel) {
    this.enabledChannels.delete(channel);
  }

  /**
   * Check if current time falls within quiet hours.
   * Urgent notifications bypass quiet hours.
   * @returns {boolean}
   */
  isQuietHoursActive() {
    if (!this.quietHoursEnabled) return false;
    const hour = new Date().getHours();
    if (this.quietStart > this.quietEnd) {
      // wraps midnight, e.g. 22:00 - 07:00
      return hour >= this.quietStart || hour < this.quietEnd;
    }
    return hour >= this.quietStart && hour < this.quietEnd;
  }
}

// ─── Notification Record ────────────────────────────────────────────────────

/**
 * An immutable record of a delivered (or attempted) notification.
 */
class NotificationRecord {
  /**
   * @param {Object} params
   * @param {string}   params.userId
   * @param {string}   params.channel
   * @param {string}   params.subject
   * @param {string}   params.body
   * @param {Priority} params.priority
   * @param {boolean}  params.success
   * @param {Date}     params.timestamp
   * @param {string}   [params.templateId]
   */
  constructor({ userId, channel, subject, body, priority, success, timestamp, templateId }) {
    this.userId = userId;
    this.channel = channel;
    this.subject = subject;
    this.body = body;
    this.priority = priority;
    this.success = success;
    this.timestamp = timestamp;
    this.templateId = templateId ?? null;
  }
}

// ─── Notification Service (Facade) ──────────────────────────────────────────

/**
 * Central notification service -- the main public API.
 */
class NotificationService {
  constructor() {
    /** @type {Map<string, NotificationChannel>}  channelName -> strategy */
    this.channels = new Map();

    /** @type {Map<string, UserPreferences>}  userId -> prefs */
    this.userPrefs = new Map();

    /** @type {Map<string, NotificationTemplate>}  templateId -> template */
    this.templates = new Map();

    /** @type {Map<string, NotificationRecord[]>}  userId -> history */
    this.history = new Map();

    /** @type {Array<(record: NotificationRecord) => void>} */
    this._observers = [];
  }

  // ── Channel management ──────────────────────────────────────────────────

  /** @param {NotificationChannel} channel */
  registerChannel(channel) {
    this.channels.set(channel.name, channel);
    return this;
  }

  // ── User preferences ───────────────────────────────────────────────────

  /**
   * Register or update preferences for a user.
   * @param {UserPreferences} prefs
   */
  setUserPreferences(prefs) {
    this.userPrefs.set(prefs.userId, prefs);
  }

  /**
   * @param {string} userId
   * @returns {UserPreferences}
   */
  getUserPreferences(userId) {
    if (!this.userPrefs.has(userId)) {
      // return defaults
      const defaults = new UserPreferences(userId);
      this.userPrefs.set(userId, defaults);
      return defaults;
    }
    return this.userPrefs.get(userId);
  }

  // ── Template management ─────────────────────────────────────────────────

  /** @param {NotificationTemplate} template */
  registerTemplate(template) {
    this.templates.set(template.id, template);
    return this;
  }

  /**
   * @param {string} templateId
   * @returns {NotificationTemplate | undefined}
   */
  getTemplate(templateId) {
    return this.templates.get(templateId);
  }

  // ── Observer (post-send hooks) ──────────────────────────────────────────

  /**
   * Register an observer that is called after every notification delivery.
   * @param {(record: NotificationRecord) => void} fn
   */
  onNotificationSent(fn) {
    this._observers.push(fn);
  }

  /** @param {NotificationRecord} record */
  _notifyObservers(record) {
    for (const fn of this._observers) {
      try {
        fn(record);
      } catch {
        /* observer errors must not break delivery */
      }
    }
  }

  // ── Core send ───────────────────────────────────────────────────────────

  /**
   * Send a notification to a single user.
   *
   * @param {Object} opts
   * @param {string}   opts.userId
   * @param {string}   [opts.subject]
   * @param {string}   [opts.body]
   * @param {string}   [opts.templateId]
   * @param {Record<string, string>} [opts.variables]
   * @param {Priority} [opts.priority]
   * @param {string[]} [opts.channels]  override: send only to these channels
   * @returns {NotificationRecord[]}
   */
  send({
    userId,
    subject,
    body,
    templateId,
    variables = {},
    priority = Priority.NORMAL,
    channels,
  }) {
    // Resolve content from template if provided
    if (templateId) {
      const tpl = this.templates.get(templateId);
      if (!tpl) throw new Error(`Template "${templateId}" not found`);
      const rendered = tpl.render(variables);
      subject = rendered.subject;
      body = rendered.body;
    }

    if (!subject || !body) {
      throw new Error('subject and body are required (or provide a templateId)');
    }

    const prefs = this.getUserPreferences(userId);
    const records = [];

    // Determine which channels to use
    const targetChannels = channels ?? [...this.channels.keys()];

    for (const chName of targetChannels) {
      // Respect user preference
      if (!prefs.isChannelEnabled(chName)) {
        continue;
      }

      // Quiet hours -- urgent bypasses
      if (priority !== Priority.URGENT && prefs.isQuietHoursActive()) {
        continue;
      }

      const channel = this.channels.get(chName);
      if (!channel) continue;

      const result = channel.send(userId, subject, body, priority);

      const record = new NotificationRecord({
        userId,
        channel: chName,
        subject,
        body,
        priority,
        success: result.success,
        timestamp: result.timestamp,
        templateId: templateId ?? undefined,
      });

      // Store in history
      if (!this.history.has(userId)) {
        this.history.set(userId, []);
      }
      this.history.get(userId).push(record);

      records.push(record);
      this._notifyObservers(record);
    }

    return records;
  }

  // ── Batch send ──────────────────────────────────────────────────────────

  /**
   * Send the same notification to multiple users.
   *
   * @param {Object} opts
   * @param {string[]}  opts.userIds
   * @param {string}    [opts.subject]
   * @param {string}    [opts.body]
   * @param {string}    [opts.templateId]
   * @param {Record<string, string>} [opts.variables]   shared variables
   * @param {Record<string, Record<string, string>>} [opts.perUserVars]  userId -> extra vars
   * @param {Priority}  [opts.priority]
   * @returns {Map<string, NotificationRecord[]>}  userId -> records
   */
  sendBatch({
    userIds,
    subject,
    body,
    templateId,
    variables = {},
    perUserVars = {},
    priority = Priority.NORMAL,
  }) {
    /** @type {Map<string, NotificationRecord[]>} */
    const results = new Map();

    for (const userId of userIds) {
      const mergedVars = { ...variables, ...(perUserVars[userId] ?? {}) };
      const records = this.send({
        userId,
        subject,
        body,
        templateId,
        variables: mergedVars,
        priority,
      });
      results.set(userId, records);
    }

    return results;
  }

  // ── History ─────────────────────────────────────────────────────────────

  /**
   * Get notification history for a user, optionally filtered.
   *
   * @param {string} userId
   * @param {Object} [filter]
   * @param {string}   [filter.channel]
   * @param {Priority} [filter.priority]
   * @param {number}   [filter.limit]
   * @returns {NotificationRecord[]}
   */
  getHistory(userId, filter = {}) {
    let records = this.history.get(userId) ?? [];

    if (filter.channel) {
      records = records.filter((r) => r.channel === filter.channel);
    }
    if (filter.priority) {
      records = records.filter((r) => r.priority === filter.priority);
    }
    if (filter.limit) {
      records = records.slice(-filter.limit);
    }

    return records;
  }

  /**
   * Summary statistics for a user's notification history.
   * @param {string} userId
   */
  getStats(userId) {
    const records = this.history.get(userId) ?? [];
    const byChannel = {};
    const byPriority = {};
    let successCount = 0;

    for (const r of records) {
      byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
      byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
      if (r.success) successCount++;
    }

    return {
      total: records.length,
      successCount,
      failureCount: records.length - successCount,
      byChannel,
      byPriority,
    };
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('='.repeat(72));
  console.log(' NOTIFICATION SERVICE -- DEMO');
  console.log('='.repeat(72));

  // 1. Bootstrap the service with channels and templates
  const service = new NotificationService();

  service
    .registerChannel(new EmailChannel())
    .registerChannel(new SMSChannel())
    .registerChannel(new PushChannel());

  service.registerTemplate(
    new NotificationTemplate(
      'welcome',
      'Welcome to {{appName}}, {{name}}!',
      'Hi {{name}}, thanks for signing up for {{appName}}. Get started at {{url}}.'
    )
  );

  service.registerTemplate(
    new NotificationTemplate(
      'order_shipped',
      'Your order #{{orderId}} has shipped!',
      'Hi {{name}}, your order #{{orderId}} is on its way. Track it here: {{trackingUrl}}'
    )
  );

  service.registerTemplate(
    new NotificationTemplate(
      'security_alert',
      'Security Alert: {{event}}',
      'We detected a {{event}} on your account at {{time}}. If this was not you, reset your password immediately.'
    )
  );

  // 2. Set up user preferences
  console.log('\n--- Setting user preferences ---');

  service.setUserPreferences(
    new UserPreferences('alice', {
      enabledChannels: new Set([ChannelType.EMAIL, ChannelType.PUSH]),
    })
  );
  console.log('Alice: email + push only (no SMS)');

  service.setUserPreferences(
    new UserPreferences('bob', {
      enabledChannels: new Set([ChannelType.SMS]),
    })
  );
  console.log('Bob:   SMS only');

  service.setUserPreferences(
    new UserPreferences('carol') // defaults: all channels
  );
  console.log('Carol: all channels (default)');

  // 3. Register an observer (e.g. for analytics)
  let observerCallCount = 0;
  service.onNotificationSent(() => {
    observerCallCount++;
  });

  // 4. Send individual notification using a template
  console.log('\n--- Send welcome notification to Alice (template) ---');
  service.send({
    userId: 'alice',
    templateId: 'welcome',
    variables: { appName: 'Acme', name: 'Alice', url: 'https://acme.io/start' },
  });

  // 5. Send direct notification (no template)
  console.log('\n--- Send direct notification to Carol ---');
  service.send({
    userId: 'carol',
    subject: 'Maintenance Window',
    body: 'Our platform will undergo maintenance tonight from 2 AM to 4 AM UTC.',
    priority: Priority.LOW,
  });

  // 6. Send urgent notification (bypasses quiet hours)
  console.log('\n--- Send URGENT security alert to Bob ---');
  service.send({
    userId: 'bob',
    templateId: 'security_alert',
    variables: { event: 'login from new device', time: '2026-02-24 14:33 UTC' },
    priority: Priority.URGENT,
  });

  // 7. Batch send
  console.log('\n--- Batch send: order shipped to Alice, Bob, Carol ---');
  service.sendBatch({
    userIds: ['alice', 'bob', 'carol'],
    templateId: 'order_shipped',
    variables: { trackingUrl: 'https://track.acme.io/' },
    perUserVars: {
      alice: { name: 'Alice', orderId: 'A-1001' },
      bob: { name: 'Bob', orderId: 'B-2002' },
      carol: { name: 'Carol', orderId: 'C-3003' },
    },
  });

  // 8. History and stats
  console.log('\n--- Notification history for Alice ---');
  const aliceHistory = service.getHistory('alice');
  for (const r of aliceHistory) {
    console.log(
      `  [${r.timestamp.toISOString()}] ${r.channel.padEnd(5)} | ${r.priority.padEnd(6)} | ${r.subject}`
    );
  }

  console.log('\n--- Stats for Alice ---');
  console.log(service.getStats('alice'));

  console.log('\n--- Stats for Carol ---');
  console.log(service.getStats('carol'));

  console.log(`\n--- Observer was called ${observerCallCount} time(s) ---`);

  // 9. Filtered history
  console.log('\n--- Carol: email-only history ---');
  const carolEmail = service.getHistory('carol', { channel: ChannelType.EMAIL });
  for (const r of carolEmail) {
    console.log(`  ${r.subject}`);
  }

  // 10. Channel preference change
  console.log('\n--- Bob enables push, send again ---');
  service.getUserPreferences('bob').enableChannel(ChannelType.PUSH);
  service.send({
    userId: 'bob',
    subject: 'Feature Update',
    body: 'Check out the new dashboard!',
    priority: Priority.NORMAL,
  });

  console.log('\n--- Final stats for Bob ---');
  console.log(service.getStats('bob'));

  console.log('\n' + '='.repeat(72));
  console.log(' DEMO COMPLETE');
  console.log('='.repeat(72));
}

demo();
