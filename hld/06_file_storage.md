# HLD 06 -- File Storage System (Google Drive / Dropbox)

> **Interview time budget:** 40 min total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## 1. Clarify (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | **Upload files** | Chunked upload for files > 5 MB; resumable |
| F2 | **Download files** | Stream via presigned URL or CDN |
| F3 | **Delete files** | Soft-delete with 30-day trash |
| F4 | **File versioning** | Keep last N versions; restore any version |
| F5 | **Sharing & permissions** | Owner, Editor, Viewer roles; link sharing |
| F6 | **Multi-device sync** | Detect local changes, push/pull deltas |
| F7 | **Deduplication** | Content-addressable storage via SHA-256 |
| F8 | **Folder hierarchy** | Nested folders, move/rename operations |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Availability | 99.99 % (52 min downtime / year) |
| NF2 | Durability | 99.999999999 % (eleven 9s -- S3 tier) |
| NF3 | Upload latency | < 2 s for files under 10 MB |
| NF4 | Sync latency | < 5 s propagation to other devices |
| NF5 | Consistency | Eventual for sync; strong for metadata writes |
| NF6 | Security | Encryption at rest (AES-256) and in transit (TLS 1.3) |

### Users & Access Patterns

- **50 M** registered users, **10 M** DAU
- Average **2 GB** stored per user
- Peak hours: 9 AM -- 6 PM local time (spread across time zones)
- Read-heavy: download:upload ratio roughly **3:1**

---

## 2. Estimate (5 min)

### Storage

| Metric | Calculation | Result |
|--------|-------------|--------|
| Total raw storage | 50 M users x 2 GB | **100 PB** |
| With versioning (avg 3 versions) | 100 PB x 1.5 (dedup savings ~50 %) | **150 PB** |
| Metadata (PostgreSQL) | 50 M users x avg 500 files x 1 KB/row | **25 TB** |

### QPS (Queries Per Second)

| Operation | Calculation | QPS |
|-----------|-------------|-----|
| Uploads | 10 M DAU x 2 uploads/day / 86400 | **~230 /s** (peak 3x = **700 /s**) |
| Downloads | 10 M DAU x 6 downloads/day / 86400 | **~700 /s** (peak 3x = **2100 /s**) |
| Metadata reads (sync, list) | 10 M DAU x 20 reads/day / 86400 | **~2300 /s** (peak 3x = **7000 /s**) |
| Sync heartbeats | 10 M DAU x 1 per 30 s (active 8 h) | **~90 K /s** |

### Bandwidth

| Direction | Calculation | Result |
|-----------|-------------|--------|
| Ingress (upload) | 700 /s peak x 5 MB avg | **3.5 GB/s** |
| Egress (download) | 2100 /s peak x 5 MB avg | **10.5 GB/s** (CDN offloads ~80 %) |

---

## 3. High-Level Design (15 min)

### Architecture Diagram

```
 Desktop / Mobile / Web Client
          |
          | HTTPS (TLS 1.3)
          v
 +------------------+
 |   API Gateway    |  -- Auth, rate limiting, routing
 |  (Kong / Nginx)  |
 +--------+---------+
          |
     +----+----+--------------------+--------------------+
     |         |                    |                    |
     v         v                    v                    v
 +--------+ +----------+    +-------------+    +-----------------+
 |Metadata| |  Upload   |    |    Sync     |    |   Sharing &     |
 |Service | |  Service  |    |   Service   |    |  Permissions    |
 +---+----+ +-----+----+    +------+------+    +--------+--------+
     |            |                |                     |
     |      +-----+------+        |                     |
     |      | Chunk Mgr  |        |                     |
     |      +-----+------+        |                     |
     |            |                |                     |
     v            v                v                     v
 +--------+  +---------+   +-------------+     +--------+--------+
 |Postgres|  |   S3    |   | Notification|     |   Postgres      |
 |(Meta DB)|  |(Blobs)  |   |  Service    |     |  (Permissions)  |
 +---+----+  +----+----+   | (WebSocket) |     +-----------------+
     |            |         +------+------+
     |            |                |
     |            v                v
     |       +---------+   +-------------+
     |       |   CDN   |   |   Redis     |
     |       |(CloudF.)|   | (Pub/Sub +  |
     |       +---------+   |  Sessions)  |
     |                     +-------------+
     v
 +------------------+
 | Dedup Service    |
 | (SHA-256 index)  |
 +------------------+
```

### API Design

#### Upload (Chunked)

```
POST /api/v1/files/upload/init
  Body: { fileName, fileSize, mimeType, parentFolderId, sha256 }
  Response: { uploadId, chunkSize, presignedUrls: [...] }

PUT /api/v1/files/upload/{uploadId}/chunk/{chunkIndex}
  Body: <binary chunk>
  Response: { chunkIndex, etag }

POST /api/v1/files/upload/{uploadId}/complete
  Body: { parts: [{ chunkIndex, etag }] }
  Response: { fileId, version, createdAt }
```

#### Download

```
GET /api/v1/files/{fileId}/download?version={v}
  Response: 302 redirect to presigned S3 / CDN URL
```

#### Sync

```
GET /api/v1/sync/changes?cursor={lastSyncTimestamp}
  Response: { changes: [{ fileId, action, version, timestamp }], newCursor }
```

#### Sharing

```
POST /api/v1/files/{fileId}/share
  Body: { email, role: "viewer" | "editor" }
  Response: { shareId, link }
```

### Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    name          VARCHAR(255) NOT NULL,
    storage_quota BIGINT DEFAULT 15737418240, -- 15 GB
    storage_used  BIGINT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Files (metadata only -- blobs live in S3)
CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(id),
    parent_folder   UUID REFERENCES files(id),  -- NULL = root
    name            VARCHAR(1024) NOT NULL,
    is_folder       BOOLEAN DEFAULT false,
    mime_type       VARCHAR(255),
    size            BIGINT,
    sha256          CHAR(64),              -- content hash for dedup
    s3_key          VARCHAR(2048),
    latest_version  INT DEFAULT 1,
    is_deleted      BOOLEAN DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(owner_id, parent_folder, name)  -- no duplicate names in folder
);
CREATE INDEX idx_files_owner    ON files(owner_id);
CREATE INDEX idx_files_parent   ON files(parent_folder);
CREATE INDEX idx_files_sha256   ON files(sha256);

-- Versions
CREATE TABLE file_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id     UUID REFERENCES files(id),
    version     INT NOT NULL,
    size        BIGINT,
    sha256      CHAR(64),
    s3_key      VARCHAR(2048),
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(file_id, version)
);

-- Permissions
CREATE TABLE file_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id     UUID REFERENCES files(id),
    user_id     UUID REFERENCES users(id),
    role        VARCHAR(20) CHECK (role IN ('owner','editor','viewer')),
    granted_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(file_id, user_id)
);

-- Sync journal (append-only change log)
CREATE TABLE sync_journal (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    file_id     UUID REFERENCES files(id),
    action      VARCHAR(20) CHECK (action IN ('create','update','delete','move','rename')),
    version     INT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sync_user_time ON sync_journal(user_id, created_at);
```

---

## 4. Deep Dive (15 min)

### Deep Dive A: Chunked Upload with Presigned URLs

The upload flow must handle files from a few KB to multiple GB reliably over unreliable networks.

**Flow:**

```
Client                    Upload Service              S3
  |                            |                       |
  |-- POST /upload/init ------>|                       |
  |                            |-- generate presigned->|
  |<-- { presignedUrls[] } ----|     PUT URLs          |
  |                            |                       |
  |-- PUT chunk 0 directly --------------------------->|
  |<-- 200 + ETag ------------------------------------|
  |-- PUT chunk 1 directly --------------------------->|
  |<-- 200 + ETag ------------------------------------|
  |   ... (parallel, up to 6 concurrent)               |
  |                            |                       |
  |-- POST /upload/complete -->|                       |
  |                            |-- completeMultipart ->|
  |                            |<-- OK + final ETag ---|
  |                            |                       |
  |                            |-- SHA-256 dedup check |
  |                            |-- write metadata to PG|
  |                            |-- publish sync event  |
  |<-- { fileId, version } ----|                       |
```

**Key design decisions:**

1. **Chunk size:** 5 MB default (S3 multipart minimum), configurable up to 100 MB for fast networks. The client calculates optimal chunk size based on measured upload speed.

2. **Resumability:** Each chunk is independently uploaded. The server tracks which chunks are received. If the connection drops, the client calls `GET /upload/{uploadId}/status` to discover which chunks need retrying.

3. **Presigned URLs bypass the API servers:** The binary data flows directly from client to S3, so the API servers handle only lightweight metadata. This is critical at 700 uploads/s peak -- routing 3.5 GB/s through application servers would be prohibitively expensive.

4. **Deduplication at completion:** After S3 confirms the multipart upload, the Upload Service computes/verifies the SHA-256 hash. If an identical blob already exists in S3:
   - The new S3 object is deleted
   - The metadata record points to the existing S3 key
   - Saves up to ~30-50 % storage in practice

5. **Virus scanning:** An async Lambda/worker scans newly uploaded objects before marking them as available. The file status transitions through `uploading -> scanning -> available | quarantined`.

### Deep Dive B: Multi-Device Sync Protocol

Sync is the hardest problem in file storage. We need a protocol that is correct, efficient, and tolerant of conflicts.

**Architecture:**

```
                  +-------------------+
                  |   Notification    |
                  |   Service (WS)   |
                  +--------+----------+
                           |  push events
          +----------------+----------------+
          |                                 |
  +-------v--------+              +--------v-------+
  | Device A       |              | Device B       |
  | (Desktop App)  |              | (Mobile App)   |
  | File Watcher   |              | File Watcher   |
  +-------+--------+              +--------+-------+
          |                                 |
          |  GET /sync/changes?cursor=X     |
          +-------------+------------------+
                        |
                +-------v--------+
                |  Sync Service  |
                +-------+--------+
                        |
                +-------v--------+
                | sync_journal   |
                |  (PostgreSQL)  |
                +----------------+
```

**Sync protocol (cursor-based):**

1. Each device maintains a `cursor` (last seen `sync_journal.id` or timestamp).
2. On app launch or push notification, the device calls `GET /sync/changes?cursor=X`.
3. The server returns all changes since that cursor, ordered by timestamp.
4. The device applies changes and advances its cursor.
5. When a local change is detected (file watcher), the device uploads the file and calls `POST /sync/report` to record the change, which triggers push to other devices.

**Conflict resolution strategy:**

| Scenario | Resolution |
|----------|------------|
| Same file edited on two devices while offline | Keep both: rename the later one as `file (conflict copy - DeviceB - 2024-01-15).txt` |
| File edited on A, deleted on B | Edit wins: restore the file |
| File moved on A, renamed on B | Apply both: move + rename |
| Folder deleted on A, file added inside on B | Restore folder, keep the new file |

**Change detection on the client side:**

- **Desktop:** OS-level file watchers (FSEvents on macOS, inotify on Linux, ReadDirectoryChangesW on Windows). Maintain a local SQLite database of `(path, mtime, size, localSha256)`. On watcher event, compare with stored state to classify as create/update/delete.
- **Mobile:** Limited background execution. Sync on app foreground. Use OS-provided photo/file change APIs where available.

### Deep Dive C: Sharing and Permission Model

**Permission hierarchy:**

```
Owner  -->  Can share, edit, delete, transfer ownership
Editor -->  Can view, edit, add files (in shared folders)
Viewer -->  Can view, download only
```

**Implementation:**

1. **Direct sharing:** Insert a row in `file_permissions`. The shared file appears in the recipient's "Shared with me" virtual folder.

2. **Link sharing:** Generate a random token stored in a `shared_links` table with optional password and expiration. Anyone with the link can access at the specified role level.

3. **Folder-level sharing:** When a folder is shared, all files and sub-folders inherit the permission. The permission is checked by walking up the folder tree (with caching):

```
function checkPermission(userId, fileId, requiredRole):
    -- Direct permission on this file?
    perm = db.query("SELECT role FROM file_permissions WHERE file_id=$1 AND user_id=$2", fileId, userId)
    if perm and roleLevel(perm.role) >= roleLevel(requiredRole):
        return true

    -- Check parent folder (recursive, but cached in Redis)
    file = db.query("SELECT parent_folder, owner_id FROM files WHERE id=$1", fileId)
    if file.owner_id == userId:
        return true
    if file.parent_folder is not null:
        return checkPermission(userId, file.parent_folder, requiredRole)

    return false
```

4. **Permission cache:** Resolved permissions are cached in Redis with a TTL of 5 minutes. Cache is invalidated on permission changes via pub/sub.

---

## Trade-offs

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Upload path | Through API server | Presigned URL to S3 | **B** | Eliminates data bottleneck at API tier; 10x cheaper |
| Sync model | Polling | WebSocket push + polling fallback | **Both** | Push for low latency; poll as fallback and consistency check |
| Conflict resolution | Last-writer-wins | Fork (conflict copies) | **B** | Data loss unacceptable for user files |
| Dedup scope | Per-user | Global | **Global** | 30-50 % storage savings justify the shared index |
| Metadata DB | NoSQL (DynamoDB) | PostgreSQL | **B** | Folder hierarchy needs recursive queries; strong consistency for permissions |
| Chunk size | Fixed 5 MB | Adaptive | **Adaptive** | Better UX on varying network conditions |
| File versioning | Keep all | Keep last N (e.g., 100) | **Last N** | Bounded storage cost; configurable per plan |

---

## Scaling Strategy

| Component | Strategy |
|-----------|----------|
| API Gateway | Horizontal auto-scale behind NLB; stateless |
| Metadata Service | Horizontal scale; read replicas for PostgreSQL |
| PostgreSQL | Shard by `owner_id`; each shard handles ~5 M users |
| S3 | Virtually unlimited; use S3 Intelligent-Tiering for cost |
| Sync Service | Partition users across WebSocket servers by consistent hashing |
| Redis | Cluster mode; separate clusters for pub/sub vs. caching |
| CDN | CloudFront with regional edge caches; cache popular downloads |
| Upload Service | Stateless; scale based on pending upload count |

**Storage tiering:**

```
Hot  (< 30 days since last access)  -->  S3 Standard
Warm (30-90 days)                   -->  S3 Infrequent Access
Cold (> 90 days)                    -->  S3 Glacier Instant Retrieval
Archive (deleted / old versions)    -->  S3 Glacier Deep Archive
```

---

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| S3 region outage | Uploads/downloads fail | Cross-region replication for critical data; circuit breaker returns 503 |
| PostgreSQL primary down | Metadata writes fail | Automated failover to synchronous replica (RDS Multi-AZ); < 60 s downtime |
| Upload interrupted mid-chunk | Partial upload | Resumable: client retries only missing chunks; server garbage-collects incomplete uploads after 24 h |
| Sync service crash | Devices stop receiving push updates | Clients fall back to polling every 30 s; stateless restart picks up from journal |
| Redis cluster failure | Permission cache miss; sync pub/sub down | Fallback to direct DB reads (higher latency but correct); sync falls back to polling |
| CDN cache poisoned | Users receive wrong file version | S3 object versioning + CDN cache key includes version hash; invalidation API |
| Concurrent writes to same file | Data conflict | Conflict copy created; user merges manually; for collaborative editing, use OT/CRDT (out of scope) |
| Disk corruption on S3 | Data loss | S3 provides eleven 9s durability via redundant storage; cross-region replication adds extra safety |

---

## Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Upload success rate | < 99.5 % |
| p99 upload latency (< 10 MB) | > 3 s |
| Sync propagation delay | > 10 s |
| S3 error rate | > 0.1 % |
| Metadata DB query latency (p99) | > 100 ms |
| Active WebSocket connections | > 80 % of capacity |
| Storage growth rate | > 5 % week-over-week (anomaly) |
| Dedup ratio | < 20 % (investigate if dropping) |
