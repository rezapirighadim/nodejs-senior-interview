# System Design: Notification System

> **Interview Time Budget:** 40 minutes total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## Step 1: Clarify Requirements (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | Multi-channel delivery | Push (iOS/Android), email, SMS, in-app |
| F2 | Template engine | Reusable templates with variable substitution |
| F3 | Priority levels | Urgent (OTP), normal (social), low (marketing) |
| F4 | User preferences | Per-channel opt-in/opt-out, quiet hours |
| F5 | Delivery tracking | Sent, delivered, opened, failed status per notification |
| F6 | Rate limiting per user | Prevent notification fatigue |
| F7 | Retry with backoff | Automatic retry for failed deliveries |
| F8 | Scheduling | Send at a specific time or in a time zone |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Throughput | 10B notifications/day across all channels |
| NF2 | Latency (urgent) | < 5 seconds end-to-end for OTP/security |
| NF3 | Latency (normal) | < 30 seconds for social notifications |
| NF4 | Reliability | At-least-once delivery; no lost notifications |
| NF5 | Availability | 99.99% uptime |
| NF6 | Scalability | Handle 10x spikes (promotional campaigns) |

### Clarifying Questions to Ask

1. "What channels are required -- push, email, SMS, in-app, or more (Slack, webhook)?"
2. "Should a single event trigger notifications on multiple channels simultaneously?"
3. "Do we need to support notification bundling/digests?"
4. "Is there a regulatory requirement (GDPR opt-out, CAN-SPAM compliance)?"
5. "What external providers do we use (APNs, FCM, Twilio, SES, SendGrid)?"

---

## Step 2: Estimate (5 min)

### Traffic Estimates

```
Total: 10B notifications/day

Channel breakdown (estimated):
  Push:    4B/day  (40%)
  In-app:  3B/day  (30%)
  Email:   2B/day  (20%)
  SMS:     1B/day  (10%)

Average throughput:
  10B / 86,400 = ~116,000 notifications/sec
  Peak (2x): ~232,000 notifications/sec

Event ingestion (before fan-out to channels):
  Many events trigger multiple channels per user
  ~3B events/day → ~35,000 events/sec
```

### Storage Estimates

```
Per notification record:
  - notification_id:   16 bytes (UUID)
  - user_id:           8 bytes
  - channel:           1 byte
  - template_id:       8 bytes
  - variables:         200 bytes (JSON)
  - status:            1 byte
  - priority:          1 byte
  - timestamps:        24 bytes (created, sent, delivered)
  - metadata:          100 bytes
  Total: ~360 bytes

Daily storage: 10B * 360 bytes = 3.6 TB/day
30-day retention (hot): 108 TB
1-year archive (cold, compressed): ~400 TB

User preferences:
  500M users * 200 bytes = 100 GB
  Easily fits in PostgreSQL + Redis cache

Templates:
  ~10,000 templates * 2 KB = 20 MB (negligible)
```

### Bandwidth Estimates

```
Internal (Kafka → workers):
  116,000 msg/s * 500 bytes avg = 58 MB/s

External (to providers):
  Push (APNs/FCM): 46,000/s * 1 KB = 46 MB/s
  Email (SES): 23,000/s * 50 KB = 1.15 GB/s
  SMS (Twilio): 11,600/s * 200 bytes = 2.3 MB/s
```

---

## Step 3: High-Level Design (15 min)

### Architecture Diagram

```
  ┌───────────────────────────────────────────────────────────────────┐
  │                       Event Sources                               │
  │                                                                   │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
  │  │ User     │  │ Order    │  │ Payment  │  │ Marketing /      │ │
  │  │ Service  │  │ Service  │  │ Service  │  │ Campaign Service │ │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────────────┘ │
  └───────┼──────────────┼──────────────┼──────────────┼──────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    Kafka Cluster                                  │
  │                                                                   │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
  │  │ notification  │  │ notification  │  │ notification  │          │
  │  │ .urgent      │  │ .normal      │  │ .low         │           │
  │  │ (partitions) │  │ (partitions) │  │ (partitions) │           │
  │  └──────────────┘  └──────────────┘  └──────────────┘           │
  └──────────┬──────────────┬──────────────┬─────────────────────────┘
             │              │              │
             ▼              ▼              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                 Notification Service                              │
  │                                                                   │
  │  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐     │
  │  │ Preference     │  │ Template     │  │ Rate Limiter     │     │
  │  │ Checker        │  │ Renderer     │  │ (per-user)       │     │
  │  │                │  │              │  │                  │     │
  │  │ - Opt-out?     │  │ - Resolve    │  │ - Max 10 push/hr │     │
  │  │ - Quiet hours? │  │   template   │  │ - Max 3 email/day│     │
  │  │ - Channel ok?  │  │ - Substitute │  │ - Aggregate if   │     │
  │  └────────┬───────┘  │   variables  │  │   over limit    │     │
  │           │          └──────┬───────┘  └──────┬───────────┘     │
  └───────────┼─────────────────┼──────────────────┼─────────────────┘
              │                 │                   │
              ▼                 ▼                   ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │               Channel Dispatch (Kafka topics per channel)        │
  │                                                                   │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
  │  │ push     │  │ email    │  │ sms      │  │ in-app   │        │
  │  │ topic    │  │ topic    │  │ topic    │  │ topic    │        │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
  └───────┼──────────────┼──────────────┼──────────────┼─────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Push     │  │ Email    │  │ SMS      │  │ In-App   │
  │ Workers  │  │ Workers  │  │ Workers  │  │ Workers  │
  │ (pool)   │  │ (pool)   │  │ (pool)   │  │ (pool)   │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ APNs     │  │ Amazon   │  │ Twilio   │  │ WebSocket│
  │ FCM      │  │ SES      │  │          │  │ / SSE    │
  │          │  │ SendGrid │  │          │  │ + DB     │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
       │              │              │              │
       └──────────────┼──────────────┼──────────────┘
                      ▼
            ┌──────────────────┐         ┌──────────────────┐
            │ Delivery Tracker │────────►│ Analytics DB     │
            │ (status updates) │         │ (ClickHouse)     │
            └──────────────────┘         └──────────────────┘
                      │
              ┌───────▼────────┐
              │ Dead Letter    │
              │ Queue (DLQ)    │
              │ (failed after  │
              │  max retries)  │
              └────────────────┘
```

### API Design

```
--- Event Ingestion API (internal, used by other services) ---

POST /api/v1/notifications/send
  Headers: X-Service-Auth: <service-token>
  Body: {
    "event_type": "order_shipped",
    "user_id": "user_123",
    "priority": "normal",                     // urgent | normal | low
    "channels": ["push", "email"],            // optional override; default: user prefs
    "template_id": "tmpl_order_shipped",
    "variables": {
        "user_name": "Jane",
        "order_id": "ORD-456",
        "tracking_url": "https://track.example.com/ORD-456"
    },
    "schedule_at": null,                      // null = immediate
    "idempotency_key": "order_456_shipped"    // prevent duplicate sends
  }
  Response 202: {
    "notification_id": "notif_789",
    "status": "queued"
  }

--- Bulk Send (for campaigns) ---

POST /api/v1/notifications/bulk
  Body: {
    "event_type": "promo_campaign",
    "user_segment": "active_last_30_days",    // resolved by user service
    "priority": "low",
    "template_id": "tmpl_winter_sale",
    "variables": { "discount": "30%" },
    "schedule_at": "2026-02-25T09:00:00Z",
    "throttle": 50000                         // max sends per minute
  }
  Response 202: { "campaign_id": "camp_101", "estimated_recipients": 12000000 }

--- User Preferences API ---

GET /api/v1/users/{user_id}/notification-preferences
  Response 200: {
    "channels": {
        "push":  { "enabled": true,  "quiet_start": "22:00", "quiet_end": "08:00" },
        "email": { "enabled": true,  "frequency": "instant" },
        "sms":   { "enabled": false },
        "in_app": { "enabled": true }
    },
    "categories": {
        "marketing":    { "enabled": false },
        "social":       { "enabled": true },
        "transactional": { "enabled": true },
        "security":     { "enabled": true }
    }
  }

PUT /api/v1/users/{user_id}/notification-preferences
  Body: { "channels": { "sms": { "enabled": true } } }

--- In-App Notifications ---

GET /api/v1/users/{user_id}/notifications?cursor={id}&limit=20
  Response 200: {
    "notifications": [
        {
            "id": "notif_789",
            "title": "Your order has shipped!",
            "body": "Order ORD-456 is on its way...",
            "is_read": false,
            "created_at": "2026-02-24T10:00:00Z",
            "action_url": "/orders/ORD-456"
        }
    ],
    "unread_count": 5,
    "next_cursor": "notif_600"
  }

POST /api/v1/users/{user_id}/notifications/mark-read
  Body: { "notification_ids": ["notif_789", "notif_790"] }
```

### Database Schema

```sql
-- PostgreSQL: Templates, preferences, delivery tracking

CREATE TABLE notification_templates (
    id              VARCHAR(50) PRIMARY KEY,   -- e.g., 'tmpl_order_shipped'
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL,       -- 'transactional', 'social', 'marketing'
    channels        JSONB NOT NULL,             -- per-channel content
    -- Example channels JSON:
    -- {
    --   "push":  { "title": "{{user_name}}, your order shipped!", "body": "Track: {{tracking_url}}" },
    --   "email": { "subject": "Order Shipped", "html_template": "order_shipped.html" },
    --   "sms":   { "body": "Your order {{order_id}} has shipped. Track: {{tracking_url}}" },
    --   "in_app": { "title": "Order Shipped", "body": "{{order_id}} is on the way", "action_url": "/orders/{{order_id}}" }
    -- }
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_preferences (
    user_id         BIGINT PRIMARY KEY,
    channel_prefs   JSONB NOT NULL DEFAULT '{}',
    category_prefs  JSONB NOT NULL DEFAULT '{}',
    timezone        VARCHAR(50) DEFAULT 'UTC',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_log (
    id              UUID PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    template_id     VARCHAR(50),
    channel         VARCHAR(10) NOT NULL,
    priority        VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL,       -- queued, sent, delivered, opened, failed
    provider_id     VARCHAR(100),               -- external ID from provider
    error_message   TEXT,
    attempts        SMALLINT DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at         TIMESTAMP WITH TIME ZONE,
    delivered_at    TIMESTAMP WITH TIME ZONE,
    opened_at       TIMESTAMP WITH TIME ZONE
) PARTITION BY RANGE (created_at);

-- Monthly partitions (auto-create with pg_partman)
CREATE TABLE notification_log_2026_02 PARTITION OF notification_log
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE INDEX idx_notif_log_user ON notification_log (user_id, created_at DESC);
CREATE INDEX idx_notif_log_status ON notification_log (status) WHERE status IN ('queued', 'failed');

-- In-app notifications (separate table for fast user-facing queries)
CREATE TABLE in_app_notifications (
    id              UUID PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    action_url      TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_in_app_user ON in_app_notifications (user_id, created_at DESC)
    WHERE is_read = FALSE;
```

```
Redis Data Structures:

  # User device tokens (for push notifications)
  HSET devices:{user_id} {device_id} '{"token":"abc...","platform":"ios","app_version":"3.2"}'

  # User preferences cache
  SET prefs:{user_id} '{"channels":{...},"categories":{...}}' EX 3600

  # Per-user rate limiting (sliding window)
  ZADD rl:notif:{user_id}:push {timestamp} {notification_id}

  # Unread count (for badge)
  SET unread:{user_id} 5

  # Idempotency keys
  SET idemp:{idempotency_key} "notif_789" EX 86400
```

---

## Step 4: Deep Dive (15 min)

### Deep Dive 1: Notification Processing Pipeline

```
Event arrives → Notification Service Pipeline:

  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
  │ 1. Validate  │──► │ 2. Dedup     │──► │ 3. Preference│
  │    & Parse   │    │   Check      │    │    Filter    │
  └─────────────┘    └──────────────┘    └──────┬───────┘
                                                │
                     ┌──────────────┐    ┌──────▼───────┐
                     │ 5. Per-User  │◄── │ 4. Template  │
                     │    Rate Limit│    │    Render    │
                     └──────┬───────┘    └──────────────┘
                            │
                     ┌──────▼───────┐
                     │ 6. Dispatch  │
                     │   to Channel │
                     │   Topics     │
                     └──────────────┘
```

```javascript
class NotificationPipeline {
    async process(event) {
        // Step 1: Validate and parse
        const { user_id, event_type, template_id, variables, priority, channels } = event;

        // Step 2: Idempotency check
        if (event.idempotency_key) {
            const existing = await this.redis.get(`idemp:${event.idempotency_key}`);
            if (existing) {
                return { status: 'duplicate', notification_id: existing };
            }
        }

        // Step 3: User preference check
        const prefs = await this.getPreferences(user_id);
        const template = await this.getTemplate(template_id);

        const allowedChannels = this.filterChannels(
            channels || Object.keys(template.channels),
            prefs,
            template.category,
            priority
        );

        if (allowedChannels.length === 0) {
            return { status: 'filtered', reason: 'user opted out of all channels' };
        }

        // Step 4: Render template for each channel
        const renderedMessages = {};
        for (const channel of allowedChannels) {
            const channelTemplate = template.channels[channel];
            renderedMessages[channel] = this.renderTemplate(channelTemplate, variables);
        }

        // Step 5: Per-user rate limiting
        const notification_id = uuid();

        for (const channel of allowedChannels) {
            const rateLimitResult = await this.checkUserRateLimit(user_id, channel, priority);

            if (rateLimitResult.allowed) {
                // Step 6: Dispatch to channel-specific Kafka topic
                await this.kafka.produce(`notifications.${channel}`, {
                    notification_id,
                    user_id,
                    channel,
                    priority,
                    message: renderedMessages[channel],
                    template_id,
                    created_at: Date.now(),
                });
            } else if (rateLimitResult.action === 'aggregate') {
                // Too many notifications -- add to digest queue
                await this.addToDigest(user_id, channel, renderedMessages[channel]);
            }
            // else: silently drop (user already got too many)
        }

        // Set idempotency key
        if (event.idempotency_key) {
            await this.redis.setex(`idemp:${event.idempotency_key}`, 86400, notification_id);
        }

        // Log notification
        await this.logNotification(notification_id, user_id, template_id, allowedChannels);

        return { status: 'queued', notification_id };
    }

    filterChannels(requestedChannels, prefs, category, priority) {
        return requestedChannels.filter(channel => {
            // Security/urgent notifications bypass preferences
            if (priority === 'urgent') return true;

            // Check channel enabled
            if (!prefs.channel_prefs[channel]?.enabled) return false;

            // Check category enabled
            if (!prefs.category_prefs[category]?.enabled) return false;

            // Check quiet hours
            if (this.isQuietHours(prefs, channel)) {
                // Queue for later delivery (after quiet hours end)
                this.scheduleAfterQuietHours(prefs, channel);
                return false;
            }

            return true;
        });
    }

    renderTemplate(template, variables) {
        // Simple variable substitution: {{var_name}} → value
        let result = {};
        for (const [key, value] of Object.entries(template)) {
            if (typeof value === 'string') {
                result[key] = value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
                    return variables[varName] !== undefined ? variables[varName] : match;
                });
            } else {
                result[key] = value;
            }
        }
        return result;
    }
}
```

---

### Deep Dive 2: Channel Workers and Retry Logic

```
Channel Worker Architecture (Push as example):

  Kafka (push topic)
       │
       ▼
  ┌──────────────┐
  │  Push Worker  │
  │  Pool (N=50)  │
  │               │         ┌──────────────┐
  │  Consumer ────┼────────►│ Provider     │
  │  Group        │         │ Router       │
  │               │         │              │
  │               │         │ iOS → APNs   │
  │               │         │ Android → FCM│
  │               │         └──────┬───────┘
  │               │                │
  │  Retry logic: │         ┌──────▼───────┐
  │  1st: 1s      │         │ Rate Limiter │
  │  2nd: 5s      │         │ (per provider│
  │  3rd: 30s     │         │  API limits) │
  │  4th: 5m      │         └──────┬───────┘
  │  5th: 30m     │                │
  │  GIVE UP → DLQ│         ┌──────▼───────┐
  └──────────────┘         │ Provider API │
                            │ (APNs/FCM)   │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │ Status Update│
                            │ → Kafka      │
                            │ → Tracker    │
                            └──────────────┘
```

```javascript
class PushWorker {
    constructor(kafka, providers, redis) {
        this.kafka = kafka;
        this.providers = providers;  // { ios: ApnsProvider, android: FcmProvider }
        this.redis = redis;
        this.MAX_RETRIES = 5;
        this.RETRY_DELAYS = [1000, 5000, 30000, 300000, 1800000]; // ms
    }

    async processNotification(event) {
        const { notification_id, user_id, message, priority } = event;
        const attempt = event.attempt || 0;

        try {
            // Get user's device tokens
            const devices = await this.redis.hgetall(`devices:${user_id}`);

            if (!devices || Object.keys(devices).length === 0) {
                await this.updateStatus(notification_id, 'no_device');
                return;
            }

            // Send to each device
            const results = await Promise.allSettled(
                Object.entries(devices).map(async ([deviceId, deviceInfo]) => {
                    const device = JSON.parse(deviceInfo);
                    const provider = this.providers[device.platform];

                    return provider.send({
                        token: device.token,
                        title: message.title,
                        body: message.body,
                        data: message.data,
                        priority: priority === 'urgent' ? 'high' : 'normal',
                    });
                })
            );

            // Check results
            const allFailed = results.every(r => r.status === 'rejected');
            const anySucceeded = results.some(r => r.status === 'fulfilled');

            if (anySucceeded) {
                await this.updateStatus(notification_id, 'sent');
            }

            // Handle invalid tokens (unregister device)
            for (const [i, result] of results.entries()) {
                if (result.status === 'rejected') {
                    const deviceId = Object.keys(devices)[i];
                    if (this.isInvalidTokenError(result.reason)) {
                        await this.redis.hdel(`devices:${user_id}`, deviceId);
                    }
                }
            }

            if (allFailed && !this.isInvalidTokenError(results[0].reason)) {
                throw results[0].reason;  // trigger retry
            }

        } catch (error) {
            await this.handleRetry(event, attempt, error);
        }
    }

    async handleRetry(event, attempt, error) {
        if (attempt >= this.MAX_RETRIES) {
            // Send to Dead Letter Queue
            await this.kafka.produce('notifications.dlq', {
                ...event,
                error: error.message,
                failed_at: Date.now(),
            });
            await this.updateStatus(event.notification_id, 'failed', error.message);
            return;
        }

        // Exponential backoff with jitter
        const baseDelay = this.RETRY_DELAYS[attempt];
        const jitter = Math.random() * baseDelay * 0.1;
        const delay = baseDelay + jitter;

        // Re-enqueue with delay
        // Option A: Kafka delayed message (if supported)
        // Option B: Redis sorted set as delay queue
        await this.redis.zadd(
            'retry:push',
            Date.now() + delay,
            JSON.stringify({ ...event, attempt: attempt + 1 })
        );
    }

    isInvalidTokenError(error) {
        // APNs: BadDeviceToken, Unregistered
        // FCM: NotRegistered, InvalidRegistration
        const invalidCodes = ['BadDeviceToken', 'Unregistered', 'NotRegistered', 'InvalidRegistration'];
        return invalidCodes.includes(error?.code);
    }

    async updateStatus(notificationId, status, errorMessage = null) {
        await this.kafka.produce('notifications.status', {
            notification_id: notificationId,
            status,
            error_message: errorMessage,
            timestamp: Date.now(),
        });
    }
}

// Retry queue processor (polls Redis sorted set)
class RetryProcessor {
    async poll() {
        const now = Date.now();
        // Get all items whose scheduled time has passed
        const items = await this.redis.zrangebyscore('retry:push', '-inf', now, 'LIMIT', 0, 100);

        for (const item of items) {
            const removed = await this.redis.zrem('retry:push', item);
            if (removed) {
                // Re-enqueue to Kafka for processing
                const event = JSON.parse(item);
                await this.kafka.produce('notifications.push', event);
            }
        }
    }
}

// Email Worker with provider abstraction
class EmailWorker {
    constructor(providers) {
        this.providers = providers;  // [SesProvider, SendGridProvider]
        this.primaryIndex = 0;
    }

    async send(notification) {
        const { user_id, message } = notification;
        const userEmail = await this.getUserEmail(user_id);

        const emailPayload = {
            to: userEmail,
            subject: message.subject,
            html: message.html_body,
            text: message.text_body,
            headers: {
                'List-Unsubscribe': `<https://example.com/unsubscribe/${user_id}>`,
            },
        };

        // Try primary provider, fallback to secondary
        try {
            return await this.providers[this.primaryIndex].send(emailPayload);
        } catch (error) {
            // Failover to next provider
            const fallbackIndex = (this.primaryIndex + 1) % this.providers.length;
            return await this.providers[fallbackIndex].send(emailPayload);
        }
    }
}
```

---

### Deep Dive 3: Per-User Rate Limiting and Notification Fatigue

```
Rate Limiting Strategy:

  ┌────────────────────────────────────────────────────────────┐
  │              Per-User Notification Limits                   │
  │                                                             │
  │  Channel    │ Limit          │ Window  │ If exceeded        │
  │  ──────────│───────────────│────────│──────────────────── │
  │  Push       │ 10 per hour    │ 1 hour  │ Aggregate/batch    │
  │  Email      │ 3 per day      │ 24 hours│ Digest email       │
  │  SMS        │ 2 per day      │ 24 hours│ Drop (expensive)   │
  │  In-app     │ 50 per day     │ 24 hours│ Keep, don't push   │
  │                                                             │
  │  Urgent (OTP, security) ALWAYS bypasses rate limiting       │
  └────────────────────────────────────────────────────────────┘
```

```javascript
class UserNotificationRateLimiter {
    constructor(redis) {
        this.redis = redis;
        this.limits = {
            push:   { count: 10, windowSeconds: 3600 },
            email:  { count: 3,  windowSeconds: 86400 },
            sms:    { count: 2,  windowSeconds: 86400 },
            in_app: { count: 50, windowSeconds: 86400 },
        };
    }

    async checkLimit(userId, channel, priority) {
        // Urgent notifications always pass
        if (priority === 'urgent') {
            return { allowed: true, action: 'send' };
        }

        const limit = this.limits[channel];
        if (!limit) return { allowed: true, action: 'send' };

        const key = `rl:notif:${userId}:${channel}`;
        const now = Date.now();
        const windowStart = now - (limit.windowSeconds * 1000);

        // Atomic: remove old entries + count + conditionally add
        const script = `
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local window_start = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local notif_id = ARGV[4]

            redis.call('zremrangebyscore', key, '-inf', window_start)
            local count = redis.call('zcard', key)

            if count < limit then
                redis.call('zadd', key, now, notif_id)
                redis.call('expire', key, tonumber(ARGV[5]))
                return {1, limit - count - 1}
            else
                return {0, 0}
            end
        `;

        const [allowed, remaining] = await this.redis.eval(
            script, 1, key,
            limit.count,
            windowStart,
            now,
            `${now}:${Math.random()}`,
            limit.windowSeconds + 60
        );

        if (allowed) {
            return { allowed: true, action: 'send', remaining };
        }

        // Decide what to do when rate limited
        return this.getOverflowAction(channel, userId);
    }

    getOverflowAction(channel, userId) {
        switch (channel) {
            case 'push':
                // Aggregate: batch multiple push notifications into one summary
                return { allowed: false, action: 'aggregate' };
            case 'email':
                // Add to daily digest
                return { allowed: false, action: 'digest' };
            case 'sms':
                // Drop (SMS is expensive and intrusive)
                return { allowed: false, action: 'drop' };
            case 'in_app':
                // Store but don't push/notify
                return { allowed: false, action: 'silent_store' };
            default:
                return { allowed: false, action: 'drop' };
        }
    }
}

// Digest aggregator: bundles notifications into a single email
class DigestService {
    async addToDigest(userId, channel, message) {
        const key = `digest:${userId}:${channel}`;

        // Add to list of pending digest items
        await this.redis.rpush(key, JSON.stringify(message));
        await this.redis.expire(key, 86400);
    }

    // Runs on a schedule (e.g., every hour for push, daily for email)
    async processDigests(channel) {
        // Scan for users with pending digests
        const keys = await this.redis.keys(`digest:*:${channel}`);

        for (const key of keys) {
            const userId = key.split(':')[1];
            const items = await this.redis.lrange(key, 0, -1);

            if (items.length === 0) continue;

            const messages = items.map(i => JSON.parse(i));

            // Render digest template
            const digest = {
                title: `You have ${messages.length} new notifications`,
                body: messages.map(m => `- ${m.title}`).join('\n'),
                items: messages,
            };

            // Send single digest notification (bypasses per-user rate limit)
            await this.sendDigest(userId, channel, digest);

            // Clear processed items
            await this.redis.del(key);
        }
    }
}
```

---

## Trade-Offs Summary

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Message queue | RabbitMQ | Kafka | **Kafka** | Handles 116K msg/s; durability; replay capability |
| Priority handling | Single topic with priority | Separate topics per priority | **Separate topics** | Independent consumer groups; urgent never blocked by low |
| Template rendering | Client-side | Server-side | **Server-side** | Consistent rendering; easier to update templates |
| Rate limit overflow | Drop | Digest/aggregate | **Digest** (channel-dependent) | No lost info; better UX |
| Delivery tracking | Sync (in-worker) | Async (Kafka) | **Async** | Don't slow down delivery with tracking writes |
| Provider failover | Active-passive | Active-active | **Active-passive** with auto-failover | Simpler; avoid duplicate sends |

---

## Scaling Strategy

### Phase 1: MVP (0-10M notifications/day)
- Single Kafka cluster (3 brokers)
- 5 workers per channel
- PostgreSQL for all storage
- Single Redis instance for rate limiting + device tokens

### Phase 2: Growth (10M-1B notifications/day)
- Kafka cluster expansion (10+ brokers, separate clusters per priority)
- Worker pools auto-scale (50-200 per channel)
- PostgreSQL partitioned by month, read replicas
- Redis Cluster for rate limiting
- CDN for email images/assets
- Multiple provider accounts for higher quotas

### Phase 3: Hyperscale (1B-10B notifications/day)
- Multi-region Kafka clusters
- Regional workers (send from closest region to provider)
- ClickHouse for analytics (delivery rates, open rates)
- Dedicated SMS gateway (avoid per-message Twilio costs)
- Machine learning for send-time optimization (send when user most likely to engage)
- Notification quality scoring (predict user engagement before sending)

---

## Failure Scenarios & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Kafka broker down | Message ingestion delayed | Kafka replication (RF=3); producers buffer locally |
| APNs outage | iOS push fails | Retry with backoff; fallback to in-app + email |
| SES rate limit | Email sends throttled | Multiple SES accounts; failover to SendGrid |
| Redis down | Rate limiting disabled | Local in-memory rate limiting; allow slightly over |
| Worker pool overwhelmed | Message backlog grows | Auto-scale workers based on consumer lag; prioritize urgent topic |
| Duplicate events | User gets notification twice | Idempotency key check before processing |
| Template rendering error | Malformed notification sent | Template validation on save; fallback to plain text |
| DLQ overflow | Failed notifications pile up | Alert on DLQ depth; manual review dashboard |

---

## Key Interview Talking Points

1. **Why separate Kafka topics per priority?** -- A flood of marketing (low-priority) notifications should never delay OTP codes (urgent). Separate topics with independent consumer groups ensure urgent messages are processed first regardless of queue depth.

2. **Why at-least-once over exactly-once?** -- Exactly-once delivery across distributed providers (APNs, SES, Twilio) is practically impossible. Instead, we use idempotency keys to deduplicate on our side, and accept that providers may occasionally deliver duplicates (users tolerate a rare duplicate notification better than a missing OTP).

3. **Why not just use a third-party notification service (OneSignal, Firebase)?** -- At 10B notifications/day, costs become prohibitive. Custom infrastructure gives control over routing, rate limiting, and analytics. However, we still use providers (APNs, FCM) for the last-mile delivery.

4. **How to handle time zones for scheduled notifications?** -- Store user timezone in preferences. When scheduling a campaign for "9 AM local time," create separate delayed messages per timezone bucket. Use a scheduler service that polls for messages whose scheduled time has arrived.

5. **How to measure notification effectiveness?** -- Track the full funnel: sent -> delivered -> opened -> acted. For push: delivery receipt from APNs/FCM, open tracked when user taps notification. For email: pixel tracking for opens, link tracking for clicks. Feed this data back into the ranking/filtering pipeline.
