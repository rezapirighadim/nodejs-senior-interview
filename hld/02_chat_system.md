# System Design: Real-Time Chat System (like WhatsApp/Slack)

> **Interview Time Budget:** 40 minutes total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## Step 1: Clarify Requirements (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | 1:1 private messaging | Core feature |
| F2 | Group chat (up to 500 members) | Slack-style channels |
| F3 | Message delivery states | Sent, delivered, read receipts |
| F4 | Online/offline presence | Real-time user status |
| F5 | Push notifications | For offline users |
| F6 | Message history & search | Persistent storage with pagination |
| F7 | Media sharing | Images, files (not video calls) |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Real-time delivery | < 200ms end-to-end for online users |
| NF2 | Message ordering | Per-conversation ordering guaranteed |
| NF3 | At-least-once delivery | No message loss |
| NF4 | High availability | 99.99% uptime |
| NF5 | Horizontal scalability | Support 500M DAU |
| NF6 | Message durability | Messages never lost once accepted |

### Clarifying Questions to Ask

1. "What is the maximum group size? Hundreds or tens of thousands?"
2. "Do we need end-to-end encryption?"
3. "Should message history be limited or infinite?"
4. "Do we need message editing and deletion?"
5. "Is read receipt per-message or per-conversation?"

---

## Step 2: Estimate (5 min)

### Traffic Estimates

```
Users: 500M DAU
Messages: 2B messages/day

Write QPS:
  2B / 86,400 ~= 23,000 messages/sec (average)
  Peak: 23,000 * 3 = ~70,000 messages/sec

WebSocket Connections:
  500M DAU, assume 30% concurrent at peak = 150M connections
  Each WebSocket server handles ~50K connections
  = 3,000 WebSocket gateway servers at peak

Presence Updates:
  500M users going online/offline
  Average 5 status changes/day = 2.5B presence events/day
  ~29,000 events/sec
```

### Storage Estimates

```
Per message:
  - message_id:       16 bytes (UUID)
  - conversation_id:  16 bytes
  - sender_id:        8 bytes
  - content:          ~200 bytes average (text)
  - timestamp:        8 bytes
  - status:           1 byte
  - metadata:         ~50 bytes
  Total: ~300 bytes per message

Daily: 2B * 300 bytes = 600 GB/day
Monthly: 18 TB/month
1 year retention: 216 TB (consider compression: ~70 TB with 3x compression)
```

### Bandwidth Estimates

```
Incoming: 23,000 msg/s * 300 bytes = ~7 MB/s
Outgoing: Fanout factor ~2 (average group size) = 14 MB/s
WebSocket overhead: 150M connections * 40 bytes heartbeat every 30s = ~200 MB/s
Total: ~220 MB/s = ~1.8 Gbps
```

---

## Step 3: High-Level Design (15 min)

### Architecture Diagram

```
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Client A │  │ Client B │  │ Client C │
    │ (Mobile/ │  │ (Mobile/ │  │ (Mobile/ │
    │  Web)    │  │  Web)    │  │  Web)    │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │              │              │
         │   WebSocket  │   WebSocket  │
         │              │              │
    ┌────▼──────────────▼──────────────▼────┐
    │          Load Balancer (L4)            │
    │      (Sticky sessions by user_id)     │
    └──────────────────┬────────────────────┘
                       │
    ┌──────────────────┼──────────────────────┐
    │                  │                      │
    ▼                  ▼                      ▼
┌──────────┐    ┌──────────┐           ┌──────────┐
│ WS Gate- │    │ WS Gate- │    ...    │ WS Gate- │
│ way 1    │    │ way 2    │           │ way N    │
│ (50K     │    │ (50K     │           │ (50K     │
│  conns)  │    │  conns)  │           │  conns)  │
└────┬─────┘    └────┬─────┘           └────┬─────┘
     │               │                      │
     └───────────────┼──────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼────┐  ┌───▼──────────┐
   │  Chat   │  │Presence│  │ Notification │
   │ Service │  │Service │  │ Service      │
   └────┬────┘  └───┬────┘  └───┬──────────┘
        │            │           │
   ┌────▼────────────▼───────────▼──────┐
   │              Kafka                 │
   │  (messages, presence, notif topics)│
   └──────┬───────────┬────────────┬────┘
          │           │            │
   ┌──────▼──────┐ ┌──▼────────┐ ┌▼───────────┐
   │ Cassandra   │ │  Redis    │ │  Push       │
   │ (Messages)  │ │  Cluster  │ │  Provider   │
   │             │ │           │ │  (APNs/FCM) │
   │ - messages  │ │ - presence│ │             │
   │ - convo     │ │ - session │ │             │
   │   history   │ │   mapping │ │             │
   └─────────────┘ │ - unread  │ └─────────────┘
                   │   counts  │
                   └───────────┘
```

### API Design

```
--- WebSocket Events (bidirectional) ---

Client → Server:
  { "type": "send_message",
    "conversation_id": "conv_123",
    "content": "Hello!",
    "client_msg_id": "uuid-abc",      // idempotency key
    "timestamp": 1708790400000 }

  { "type": "typing",
    "conversation_id": "conv_123",
    "is_typing": true }

  { "type": "mark_read",
    "conversation_id": "conv_123",
    "last_read_msg_id": "msg_456" }

Server → Client:
  { "type": "new_message",
    "message_id": "msg_789",
    "conversation_id": "conv_123",
    "sender_id": "user_456",
    "content": "Hello!",
    "timestamp": 1708790400000,
    "status": "delivered" }

  { "type": "message_status",
    "message_id": "msg_789",
    "status": "read",
    "updated_at": 1708790410000 }

  { "type": "presence_update",
    "user_id": "user_456",
    "status": "online",
    "last_seen": 1708790400000 }

--- REST API (for non-real-time operations) ---

GET  /api/v1/conversations
GET  /api/v1/conversations/{id}/messages?before={msg_id}&limit=50
POST /api/v1/conversations                  // create group
POST /api/v1/conversations/{id}/members     // add member
GET  /api/v1/users/{id}/presence
POST /api/v1/media/upload                   // presigned URL for media
```

### Database Schema

```sql
-- Cassandra: Messages table
-- Partition key: conversation_id (all messages for a conversation on same node)
-- Clustering key: message_id (TimeUUID for ordering)

CREATE TABLE messages (
    conversation_id  UUID,
    message_id       TIMEUUID,
    sender_id        BIGINT,
    content          TEXT,
    content_type     TEXT,          -- 'text', 'image', 'file'
    media_url        TEXT,
    status           TEXT,          -- 'sent', 'delivered', 'read'
    created_at       TIMESTAMP,
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- Cassandra: Conversation index per user (for listing conversations)
CREATE TABLE user_conversations (
    user_id              BIGINT,
    last_message_at      TIMESTAMP,
    conversation_id      UUID,
    conversation_name    TEXT,
    last_message_preview TEXT,
    unread_count         INT,
    PRIMARY KEY (user_id, last_message_at, conversation_id)
) WITH CLUSTERING ORDER BY (last_message_at DESC);

-- Cassandra: Conversation members
CREATE TABLE conversation_members (
    conversation_id  UUID,
    user_id          BIGINT,
    role             TEXT,          -- 'admin', 'member'
    joined_at        TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);
```

```
Redis Data Structures:

  # User session → WebSocket gateway mapping
  HSET user:sessions:{user_id} {device_id} {gateway_id}

  # Presence: online status
  SET presence:{user_id} "online" EX 60  # TTL refreshed by heartbeat

  # Unread counts per conversation
  HSET unread:{user_id} {conversation_id} {count}
```

---

## Step 4: Deep Dive (15 min)

### Deep Dive 1: Message Delivery Flow (1:1 Chat)

```
User A sends message to User B:

  User A        WS Gateway 1     Chat Service      Kafka        WS Gateway 2     User B
    │                │                │               │               │              │
    │── send_msg ──► │                │               │               │              │
    │                │── validate ──► │               │               │              │
    │                │                │── produce ──► │               │              │
    │                │                │               │               │              │
    │◄── ack ────────│                │  (persisted)  │               │              │
    │  (status:sent) │                │               │               │              │
    │                │                │               │── consume ──► │              │
    │                │                │               │    (Chat      │              │
    │                │                │               │    Worker)    │              │
    │                │                │               │       │       │              │
    │                │                │               │       │  ┌────┘              │
    │                │                │               │       │  │ lookup user_B     │
    │                │                │               │       │  │ gateway in Redis  │
    │                │                │               │       │  └────┐              │
    │                │                │               │       │       │              │
    │                │                │               │       │── push_msg ────────► │
    │                │                │               │       │       │   (online)   │
    │                │                │               │       │       │              │
    │                │                │               │  ◄── delivery_ack ───────────│
    │◄── status: ────│◄───────────── │◄──────────────│       │       │              │
    │   delivered    │               │               │       │       │              │
```

```javascript
// Chat Service: Message handling
class ChatService {
    async handleSendMessage(senderId, message) {
        const { conversation_id, content, client_msg_id } = message;

        // 1. Idempotency check (prevent duplicate sends)
        const exists = await this.redis.get(`dedup:${client_msg_id}`);
        if (exists) return JSON.parse(exists);

        // 2. Validate sender is member of conversation
        const isMember = await this.cassandra.execute(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversation_id, senderId]
        );
        if (!isMember.rows.length) throw new ForbiddenError();

        // 3. Generate message ID (TimeUUID for ordering)
        const messageId = TimeUuid.now();

        // 4. Produce to Kafka (durably stored before ack)
        await this.kafka.produce('chat-messages', {
            key: conversation_id,  // ensures ordering per conversation
            value: {
                message_id: messageId,
                conversation_id,
                sender_id: senderId,
                content,
                content_type: 'text',
                created_at: Date.now(),
            }
        });

        // 5. Set idempotency key
        await this.redis.setex(`dedup:${client_msg_id}`, 3600, JSON.stringify({ message_id: messageId }));

        // 6. Ack to sender (message accepted)
        return { message_id: messageId, status: 'sent' };
    }
}

// Message Worker: Consumes from Kafka and delivers
class MessageWorker {
    async processMessage(event) {
        const { message_id, conversation_id, sender_id, content, created_at } = event;

        // 1. Persist to Cassandra
        await this.cassandra.execute(
            `INSERT INTO messages (conversation_id, message_id, sender_id, content, status, created_at)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [conversation_id, message_id, sender_id, content, created_at]
        );

        // 2. Get conversation members
        const members = await this.cassandra.execute(
            'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
            [conversation_id]
        );

        // 3. Deliver to each member
        for (const member of members.rows) {
            if (member.user_id === sender_id) continue;

            const sessions = await this.redis.hgetall(`user:sessions:${member.user_id}`);

            if (Object.keys(sessions).length > 0) {
                // User is online -- push via WebSocket gateway
                for (const [deviceId, gatewayId] of Object.entries(sessions)) {
                    await this.pushToGateway(gatewayId, member.user_id, {
                        type: 'new_message',
                        message_id,
                        conversation_id,
                        sender_id,
                        content,
                        created_at,
                    });
                }
            } else {
                // User is offline -- send push notification
                await this.notificationService.send(member.user_id, {
                    title: `New message from ${sender_id}`,
                    body: content.substring(0, 100),
                    data: { conversation_id },
                });
            }

            // 4. Update unread count
            await this.redis.hincrby(`unread:${member.user_id}`, conversation_id, 1);
        }

        // 5. Update conversation preview for all members
        await this.updateConversationPreview(conversation_id, content, created_at);
    }
}
```

---

### Deep Dive 2: Fan-Out Strategy for Groups

```
Small Group (< 500 members): Fan-out on WRITE
  - When a message is sent, push to all members immediately
  - Each member gets the message in their WebSocket or notification queue
  - Latency: O(N) where N = group size, but N is small

Large Channel (500+ members): Fan-out on READ
  - Store message once in conversation timeline
  - When a user opens the channel, pull latest messages
  - Only push a notification badge, not full message

  ┌─────────────────────────────────────────────────────────┐
  │              Fan-out Decision Matrix                    │
  │                                                         │
  │  Group Size     Strategy          Why                   │
  │  ─────────     ──────────        ─────────────────────  │
  │  1:1           Fan-out write     Only 1 recipient       │
  │  < 500         Fan-out write     Bounded, fast delivery │
  │  500-10K       Hybrid            Push notif + pull msgs │
  │  > 10K         Fan-out read      Too expensive to push  │
  └─────────────────────────────────────────────────────────┘
```

```javascript
class FanOutService {
    async fanOut(message, members) {
        const groupSize = members.length;

        if (groupSize <= 500) {
            // Fan-out on write: push to every member
            await this.fanOutOnWrite(message, members);
        } else {
            // Fan-out on read: store once, notify with badge
            await this.fanOutOnRead(message, members);
        }
    }

    async fanOutOnWrite(message, members) {
        // Parallel delivery to all members
        const deliveryPromises = members
            .filter(m => m.user_id !== message.sender_id)
            .map(member => this.deliverToUser(member.user_id, message));

        // Use Promise.allSettled to not fail on individual delivery errors
        const results = await Promise.allSettled(deliveryPromises);

        // Retry failed deliveries
        const failed = results
            .map((r, i) => r.status === 'rejected' ? members[i] : null)
            .filter(Boolean);

        if (failed.length > 0) {
            await this.kafka.produce('retry-delivery', {
                message,
                members: failed,
                attempt: 1,
            });
        }
    }

    async fanOutOnRead(message, members) {
        // 1. Store message in conversation timeline (already done)

        // 2. Increment unread badge for all members (batched Redis pipeline)
        const pipeline = this.redis.pipeline();
        for (const member of members) {
            if (member.user_id !== message.sender_id) {
                pipeline.hincrby(`unread:${member.user_id}`, message.conversation_id, 1);
            }
        }
        await pipeline.exec();

        // 3. Send lightweight push notification (badge only, no content)
        await this.notificationService.sendBadgeUpdate(
            members.map(m => m.user_id),
            message.conversation_id
        );
    }
}
```

---

### Deep Dive 3: Presence System

```
Presence Architecture:

  Client heartbeat (every 30s)
       │
       ▼
  ┌──────────┐    ┌────────────┐    ┌─────────────┐
  │ WS Gate- │──► │  Presence  │──► │   Redis     │
  │ way      │    │  Service   │    │             │
  └──────────┘    └──────┬─────┘    │ SET         │
                         │          │ presence:uid│
                         │          │ "online"    │
                         │          │ EX 60       │
                         ▼          └─────────────┘
                  ┌──────────────┐
                  │ Pub/Sub or   │  Subscribe: friends/contacts
                  │ Presence     │  of the user get notified
                  │ Channel      │
                  └──────────────┘
```

```javascript
class PresenceService {
    constructor(redis) {
        this.redis = redis;
        this.HEARTBEAT_TTL = 60;     // seconds
        this.HEARTBEAT_INTERVAL = 30; // client sends every 30s
    }

    async handleHeartbeat(userId) {
        const wasOffline = !(await this.redis.exists(`presence:${userId}`));

        // Refresh TTL
        await this.redis.setex(`presence:${userId}`, this.HEARTBEAT_TTL, 'online');

        if (wasOffline) {
            // User just came online -- broadcast to their contacts
            await this.broadcastPresence(userId, 'online');
        }
    }

    async handleDisconnect(userId) {
        // Don't immediately mark offline -- user might reconnect
        // Instead, set a shorter TTL and let it expire naturally

        // If user has no other active sessions
        const sessions = await this.redis.hgetall(`user:sessions:${userId}`);
        if (Object.keys(sessions).length === 0) {
            // Set last_seen timestamp
            await this.redis.set(`lastseen:${userId}`, Date.now().toString());
            // Let TTL expire naturally (grace period for reconnect)
        }
    }

    // Efficient: only subscribe to presence of visible contacts
    // Not all 500M users
    async getPresenceForContacts(userId) {
        const contacts = await this.getContactList(userId);

        // Pipeline: batch check all contacts in one Redis round-trip
        const pipeline = this.redis.pipeline();
        for (const contactId of contacts) {
            pipeline.exists(`presence:${contactId}`);
        }
        const results = await pipeline.exec();

        return contacts.map((contactId, i) => ({
            user_id: contactId,
            status: results[i][1] ? 'online' : 'offline',
        }));
    }

    async broadcastPresence(userId, status) {
        // Publish to a per-user presence channel
        // Only users who have subscribed to this user's presence will receive it
        await this.redis.publish(`presence:${userId}`, JSON.stringify({
            user_id: userId,
            status,
            timestamp: Date.now(),
        }));
    }
}
```

**Key Design Decision: Why Redis TTL for Presence?**
- Simple heartbeat → TTL refresh model
- If a client crashes, the key naturally expires (no stale "online" states)
- Redis Pub/Sub for broadcasting presence changes to interested subscribers
- Scales to millions with Redis Cluster (partition by user_id)

---

## Trade-Offs Summary

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Transport | WebSocket | Long polling | **WebSocket** (with LP fallback) | Sub-100ms latency for real-time |
| Message store | PostgreSQL | Cassandra | **Cassandra** | Optimized for write-heavy, time-series data |
| Message ordering | Global sequence | Per-conversation | **Per-conversation** | Global ordering doesn't scale, per-convo is sufficient |
| Fan-out | Always write | Always read | **Hybrid** | Small groups: write-fanout. Large channels: read-fanout |
| Presence | Polling | Pub/Sub + TTL | **Pub/Sub + TTL** | Real-time with automatic cleanup |
| Message queue | RabbitMQ | Kafka | **Kafka** | Durable, replayable, handles 70K msg/s easily |

---

## Scaling Strategy

### Phase 1: MVP (0-1M DAU)
- 10 WebSocket gateway servers
- Single Cassandra cluster (3 nodes, RF=3)
- Redis primary + replica for presence/sessions
- Single Kafka cluster (3 brokers)

### Phase 2: Growth (1M-100M DAU)
- WebSocket gateways auto-scale (100-500 instances)
- Cassandra: expand to multi-DC, 20+ nodes
- Redis Cluster (10+ shards) for presence
- Kafka: partition messages topic by conversation_id
- Separate read/write services

### Phase 3: Global (100M-500M DAU)
- Multi-region deployment
- Regional WebSocket gateways (users connect to nearest region)
- Cassandra with cross-DC replication
- Regional Redis clusters for low-latency presence
- Cross-region message routing through Kafka MirrorMaker
- Edge CDN for media delivery

---

## Failure Scenarios & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|------------|
| WebSocket gateway crash | Users on that gateway disconnected | Client auto-reconnect with exponential backoff; LB health checks |
| Cassandra node down | Read/write still works (RF=3) | Consistency level QUORUM; repair after recovery |
| Redis presence down | Presence shows stale data | Clients fallback to polling REST endpoint; presence is eventually consistent |
| Kafka broker down | Message delivery delayed | Kafka replication factor 3; producers retry; consumer lag monitoring |
| Network partition | Split-brain in chat delivery | Idempotency keys prevent duplicate messages; last-write-wins for presence |
| Message delivery fails | User doesn't receive message | Store-and-forward: messages persist in Cassandra; client pulls missed messages on reconnect |

---

## Key Interview Talking Points

1. **Why Cassandra over PostgreSQL for messages?** -- Write-optimized, handles 70K writes/sec easily, automatic partitioning by conversation_id, time-series friendly with TimeUUID clustering.
2. **How to ensure message ordering?** -- Kafka partitions by conversation_id guarantee per-conversation ordering. TimeUUID as Cassandra clustering key ensures storage order.
3. **How to handle user on multiple devices?** -- Session map in Redis tracks all active device sessions. Messages fan out to all devices. Read receipts sync across devices.
4. **How to handle thundering herd on reconnect?** -- After a gateway restart, thousands of clients reconnect simultaneously. Use jittered backoff on clients and connection rate limiting on gateways.
5. **End-to-end encryption?** -- Server never sees plaintext. Signal Protocol (used by WhatsApp) with pre-key bundles stored on server. Group messages use sender keys. This is a great extension to discuss if time permits.
