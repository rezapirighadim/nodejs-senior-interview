# System Design: News Feed System (like Twitter/Instagram)

> **Interview Time Budget:** 40 minutes total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## Step 1: Clarify Requirements (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | Create posts (text, image, video) | Core write path |
| F2 | View personalized news feed | Core read path -- timeline of followed users' posts |
| F3 | Follow/unfollow users | Social graph |
| F4 | Like, comment, share posts | Engagement features |
| F5 | Feed ranking | Not purely chronological, relevance-based |
| F6 | Celebrity/influencer support | Users with millions of followers |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Feed generation latency | < 200ms p99 |
| NF2 | Post visibility delay | < 5 seconds for normal users |
| NF3 | High availability | 99.99% uptime |
| NF4 | Consistency model | Eventually consistent (slight delay acceptable) |
| NF5 | Scale | 300M MAU, 600M feed reads/day |

### Clarifying Questions to Ask

1. "Should the feed be ranked or purely chronological?"
2. "What is the maximum number of followers a single user can have?"
3. "Should we support 'stories' (ephemeral content) or just permanent posts?"
4. "Do we need to filter out content (spam, blocked users)?"
5. "Is there a follow limit or is it asymmetric (follow without being followed back)?"

---

## Step 2: Estimate (5 min)

### Traffic Estimates

```
Users: 300M MAU, ~100M DAU

Post creation:
  Assume 1% of DAU posts daily = 1M posts/day
  = 1M / 86,400 ~= 12 posts/sec (average)
  Peak: 12 * 5 = 60 posts/sec

Feed reads:
  600M feed reads/day (multiple times per user per day)
  = 600M / 86,400 ~= 7,000 reads/sec (average)
  Peak: 7,000 * 3 = 21,000 reads/sec

Fanout:
  Average user has 200 followers
  12 posts/sec * 200 followers = 2,400 fanout writes/sec (average)
  Celebrity with 10M followers: 1 post = 10M timeline updates
```

### Storage Estimates

```
Per post:
  - post_id:        8 bytes
  - user_id:        8 bytes
  - content:        500 bytes average (text)
  - media_urls:     200 bytes
  - metadata:       100 bytes
  - timestamps:     16 bytes
  Total: ~830 bytes per post

Posts storage:
  1M posts/day * 830 bytes = 830 MB/day
  1 year: ~300 GB (post metadata only)

Media storage:
  Assume 50% posts have images (~500 KB avg)
  500K images/day * 500 KB = 250 GB/day
  1 year: ~90 TB (stored in object storage + CDN)

Timeline cache (Redis):
  Per user: store 800 post IDs in timeline
  800 * 8 bytes = 6.4 KB per user
  100M active users * 6.4 KB = 640 GB
  Fits in a Redis cluster with ~20 shards
```

### Bandwidth Estimates

```
Feed read response (20 posts per page, with media URLs):
  20 * 1 KB (post metadata) + 20 * 500 KB (images from CDN) = ~10 MB
  But images served from CDN, not our servers
  Our API: 7,000 req/s * 20 KB (metadata) = 140 MB/s
  CDN: handles terabits of image/video traffic
```

---

## Step 3: High-Level Design (15 min)

### Architecture Diagram

```
                          ┌──────────────────────┐
                          │      Clients         │
                          │  (Mobile/Web Apps)   │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │     API Gateway       │
                          │  (Auth, Rate Limit)   │
                          └──────────┬───────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
        ┌────────▼───────┐  ┌───────▼────────┐  ┌──────▼───────┐
        │  Post Service  │  │  Feed Service  │  │ Social Graph │
        │                │  │                │  │  Service     │
        │  - Create post │  │  - Get feed    │  │              │
        │  - Delete post │  │  - Ranking     │  │  - Follow    │
        │  - Edit post   │  │  - Pagination  │  │  - Unfollow  │
        └───────┬────────┘  └───────┬────────┘  └──────┬───────┘
                │                   │                   │
                ▼                   │                   │
        ┌──────────────┐           │                   │
        │    Kafka     │           │                   │
        │ (post-events)│           │                   │
        └──────┬───────┘           │                   │
               │                   │                   │
        ┌──────▼───────┐           │                   │
        │  Fan-out     │           │                   │
        │  Service     │           │                   │
        │              │           │                   │
        │  - Normal:   │           │                   │
        │    push to   │           │                   │
        │    timelines │           │                   │
        │  - Celebrity:│           │                   │
        │    skip       │           │                   │
        └──────┬───────┘           │                   │
               │                   │                   │
        ┌──────▼───────────────────▼───────────────────▼──────┐
        │                    Data Layer                        │
        │                                                      │
        │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
        │  │ Redis Cluster │  │  PostgreSQL  │  │  Object   │  │
        │  │               │  │              │  │  Storage  │  │
        │  │ - Timeline    │  │ - Users      │  │  (S3)     │  │
        │  │   cache       │  │ - Posts      │  │           │  │
        │  │ - User feed   │  │ - Follows    │  │ - Images  │  │
        │  │   (post IDs)  │  │ - Likes      │  │ - Videos  │  │
        │  └──────────────┘  └──────────────┘  └───────────┘  │
        │                                                      │
        └──────────────────────────────────────────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │        CDN           │
                          │  (CloudFront / etc.) │
                          │  - Image variants    │
                          │  - Video transcodes  │
                          └──────────────────────┘
```

### API Design

```
POST /api/v1/posts
  Headers: Authorization: Bearer <token>
  Body: {
    "content": "Check out this sunset!",
    "media_ids": ["media_abc123"],         // pre-uploaded via media service
    "location": { "lat": 37.77, "lng": -122.41 }
  }
  Response 201: {
    "post_id": "post_789",
    "created_at": "2026-02-24T10:00:00Z"
  }

GET /api/v1/feed?cursor={post_id}&limit=20
  Headers: Authorization: Bearer <token>
  Response 200: {
    "posts": [
      {
        "post_id": "post_789",
        "author": { "id": "user_123", "name": "Jane", "avatar_url": "..." },
        "content": "Check out this sunset!",
        "media": [{ "url": "https://cdn.example.com/...", "type": "image" }],
        "likes_count": 1523,
        "comments_count": 42,
        "is_liked": true,
        "created_at": "2026-02-24T10:00:00Z"
      },
      ...
    ],
    "next_cursor": "post_456",
    "has_more": true
  }

POST /api/v1/users/{user_id}/follow
POST /api/v1/users/{user_id}/unfollow

POST /api/v1/posts/{post_id}/like
DELETE /api/v1/posts/{post_id}/like

GET /api/v1/posts/{post_id}/comments?cursor={id}&limit=20
POST /api/v1/posts/{post_id}/comments
  Body: { "content": "Amazing photo!" }
```

### Database Schema

```sql
-- PostgreSQL

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(30) UNIQUE NOT NULL,
    display_name    VARCHAR(100),
    avatar_url      TEXT,
    bio             TEXT,
    followers_count BIGINT DEFAULT 0,     -- denormalized counter
    following_count BIGINT DEFAULT 0,
    is_celebrity    BOOLEAN DEFAULT FALSE, -- flag for hybrid fan-out
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threshold: is_celebrity = TRUE when followers_count > 100,000

CREATE TABLE posts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    content         TEXT,
    media_urls      JSONB,               -- [{"url": "...", "type": "image"}]
    location        JSONB,
    likes_count     BIGINT DEFAULT 0,
    comments_count  BIGINT DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON posts (user_id, created_at DESC);

CREATE TABLE follows (
    follower_id     BIGINT NOT NULL REFERENCES users(id),
    followee_id     BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id)
);

-- Index for "who follows this user" (needed for fan-out)
CREATE INDEX idx_follows_followee ON follows (followee_id);

CREATE TABLE likes (
    user_id         BIGINT NOT NULL REFERENCES users(id),
    post_id         BIGINT NOT NULL REFERENCES posts(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
    id              BIGSERIAL PRIMARY KEY,
    post_id         BIGINT NOT NULL REFERENCES posts(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments (post_id, created_at);
```

```
Redis Data Structures:

  # User's precomputed timeline (sorted set: score = timestamp)
  ZADD timeline:{user_id} {timestamp} {post_id}
  # Keep only latest 800 entries
  ZREMRANGEBYRANK timeline:{user_id} 0 -(801)

  # Post metadata cache (avoid DB reads for hot posts)
  HSET post:{post_id} content "..." user_id "123" likes_count "1523" ...
  EXPIRE post:{post_id} 86400  # 24 hour TTL
```

---

## Step 4: Deep Dive (15 min)

### Deep Dive 1: Fan-Out Strategies

```
┌──────────────────────────────────────────────────────────────────┐
│                     Fan-Out Approaches                          │
│                                                                  │
│  Fan-out on WRITE             Fan-out on READ                    │
│  ─────────────────            ─────────────────                  │
│  Post created →               User requests feed →               │
│  Push post_id to              Pull posts from all                │
│  every follower's             followed users,                    │
│  timeline cache               merge and rank                     │
│                                                                  │
│  Pros:                        Pros:                              │
│  - Fast reads (O(1))          - No wasted work for               │
│  - Feed is pre-built            inactive users                   │
│                               - No celebrity problem             │
│  Cons:                                                           │
│  - Celebrity problem           Cons:                             │
│    (10M followers =           - Slow reads (O(N)                 │
│     10M writes)                 where N = following count)       │
│  - Wasted for inactive        - Higher read latency              │
│    users                                                         │
└──────────────────────────────────────────────────────────────────┘

  HYBRID APPROACH (Recommended):
  ─────────────────────────────
  - Normal users (< 100K followers): Fan-out on WRITE
  - Celebrities (> 100K followers): Fan-out on READ
  - At read time: merge pre-built timeline + celebrity posts
```

```javascript
class FanOutService {
    CELEBRITY_THRESHOLD = 100_000;

    async handleNewPost(post) {
        const author = await this.userService.getUser(post.user_id);

        if (author.followers_count > this.CELEBRITY_THRESHOLD) {
            // Celebrity: DON'T fan out -- their posts pulled at read time
            // Just publish event for real-time subscribers
            await this.publishRealTimeEvent(post);
            return;
        }

        // Normal user: fan out to all followers' timelines
        const followers = await this.getFollowerIds(post.user_id);

        // Process in batches to avoid memory issues
        const BATCH_SIZE = 1000;
        for (let i = 0; i < followers.length; i += BATCH_SIZE) {
            const batch = followers.slice(i, i + BATCH_SIZE);
            const pipeline = this.redis.pipeline();

            for (const followerId of batch) {
                pipeline.zadd(
                    `timeline:${followerId}`,
                    post.created_at.getTime(),
                    post.id.toString()
                );
                // Trim to keep only latest 800 posts
                pipeline.zremrangebyrank(`timeline:${followerId}`, 0, -801);
            }

            await pipeline.exec();
        }
    }
}

class FeedService {
    async getFeed(userId, cursor, limit = 20) {
        // Step 1: Get pre-built timeline (from fan-out on write)
        const timelinePostIds = await this.redis.zrevrangebyscore(
            `timeline:${userId}`,
            cursor ? cursor - 1 : '+inf',
            '-inf',
            'LIMIT', 0, limit + 50  // fetch extra for merging
        );

        // Step 2: Get posts from celebrities the user follows
        const followedCelebrities = await this.getFollowedCelebrities(userId);
        let celebrityPosts = [];

        if (followedCelebrities.length > 0) {
            // Fetch recent posts from each celebrity
            const celebrityPostPromises = followedCelebrities.map(celeb =>
                this.db.query(
                    `SELECT id, created_at FROM posts
                     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                     ORDER BY created_at DESC LIMIT 10`,
                    [celeb.id]
                )
            );
            const results = await Promise.all(celebrityPostPromises);
            celebrityPosts = results.flatMap(r => r.rows);
        }

        // Step 3: Merge and rank
        const allPostIds = this.mergeAndSort(timelinePostIds, celebrityPosts);

        // Step 4: Fetch full post data (from cache or DB)
        const posts = await this.hydratePosts(allPostIds.slice(0, limit));

        // Step 5: Apply ranking
        const rankedPosts = await this.rankingService.rank(userId, posts);

        return {
            posts: rankedPosts,
            next_cursor: rankedPosts[rankedPosts.length - 1]?.created_at,
            has_more: allPostIds.length > limit,
        };
    }
}
```

---

### Deep Dive 2: Feed Ranking Algorithm

```
Ranking Pipeline:

  Raw Posts (merged timeline)
       │
       ▼
  ┌────────────────┐
  │ Candidate       │  Filter out: blocked users, muted, already seen,
  │ Filtering       │  reported content, posts older than 7 days
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ Feature         │  Extract signals for each post:
  │ Extraction      │  - Engagement: likes, comments, shares, saves
  └───────┬────────┘  - Recency: time since posted
          │            - Author: relationship strength, past interactions
          ▼            - Content: type (image/video/text), quality score
  ┌────────────────┐
  │ Scoring         │  score = w1*engagement + w2*recency + w3*affinity
  │ Model           │         + w4*content_quality + w5*diversity_boost
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │ Post-Ranking    │  - Diversity injection (avoid same author in sequence)
  │ Rules           │  - Ads insertion (every 5th position)
  └───────┬────────┘  - Mix content types (not all images)
          │
          ▼
  Final Ranked Feed
```

```javascript
class RankingService {
    async rank(userId, posts) {
        // Feature extraction
        const scoredPosts = await Promise.all(posts.map(async (post) => {
            const features = await this.extractFeatures(userId, post);
            const score = this.computeScore(features);
            return { ...post, score, features };
        }));

        // Sort by score descending
        scoredPosts.sort((a, b) => b.score - a.score);

        // Apply diversity rules
        return this.applyDiversityRules(scoredPosts);
    }

    async extractFeatures(userId, post) {
        const hoursSincePosted = (Date.now() - post.created_at) / 3600000;

        return {
            // Engagement signals
            engagement_rate: (post.likes_count + post.comments_count * 2) /
                             Math.max(post.author.followers_count, 1),

            // Recency decay (exponential)
            recency: Math.exp(-0.05 * hoursSincePosted),

            // User-author affinity (how much this user engages with the author)
            affinity: await this.getAffinityScore(userId, post.user_id),

            // Content quality
            has_media: post.media_urls?.length > 0 ? 1.0 : 0.0,
            content_length: Math.min(post.content?.length / 500, 1.0),
        };
    }

    computeScore(features) {
        // Weighted linear combination (in production, use ML model)
        const weights = {
            engagement_rate: 0.30,
            recency:         0.25,
            affinity:        0.25,
            has_media:       0.10,
            content_length:  0.10,
        };

        return Object.entries(weights).reduce(
            (score, [feature, weight]) => score + (features[feature] || 0) * weight,
            0
        );
    }

    applyDiversityRules(posts) {
        // Ensure no more than 2 posts from the same author in sequence
        const result = [];
        const recentAuthors = [];

        for (const post of posts) {
            const recentCount = recentAuthors
                .slice(-3)
                .filter(id => id === post.user_id).length;

            if (recentCount < 2) {
                result.push(post);
                recentAuthors.push(post.user_id);
            } else {
                // Defer this post to later in the feed
                result.push(null); // placeholder
                result.push(post);
                recentAuthors.push(null, post.user_id);
            }
        }

        return result.filter(Boolean);
    }
}
```

---

### Deep Dive 3: Media Storage and CDN Pipeline

```
Media Upload Flow:

  Client                  Media Service          Object Storage        CDN
    │                         │                       │                 │
    │── POST /media/upload ──►│                       │                 │
    │                         │── generate presigned──►│                 │
    │◄── presigned URL ───────│     PUT URL           │                 │
    │                         │                       │                 │
    │── PUT to S3 directly ──────────────────────────►│                 │
    │                         │                       │                 │
    │                         │◄── S3 Event ──────────│                 │
    │                         │                       │                 │
    │                    ┌────▼─────────┐             │                 │
    │                    │ Image Worker │             │                 │
    │                    │ - Resize     │             │                 │
    │                    │ - Thumbnail  │──variants──►│────replicate───►│
    │                    │ - Compress   │             │                 │
    │                    │ - EXIF strip │             │                 │
    │                    └──────────────┘             │                 │
    │                         │                       │                 │
    │◄── media_id ────────────│                       │                 │
    │   (ready to attach      │                       │                 │
    │    to post)             │                       │                 │
```

```javascript
class MediaService {
    async getUploadUrl(userId, contentType) {
        const mediaId = uuid();
        const key = `uploads/${userId}/${mediaId}`;

        // Generate pre-signed URL (client uploads directly to S3)
        const presignedUrl = await this.s3.getSignedUrl('putObject', {
            Bucket: 'media-uploads',
            Key: key,
            ContentType: contentType,
            Expires: 3600,  // 1 hour
        });

        // Track upload in DB
        await this.db.query(
            `INSERT INTO media (id, user_id, status, original_key)
             VALUES ($1, $2, 'pending', $3)`,
            [mediaId, userId, key]
        );

        return { media_id: mediaId, upload_url: presignedUrl };
    }

    // Triggered by S3 event via Lambda or SQS
    async processUpload(mediaId) {
        const media = await this.getMedia(mediaId);

        // Generate variants
        const variants = [
            { name: 'thumbnail', width: 150, height: 150 },
            { name: 'small',     width: 320 },
            { name: 'medium',    width: 640 },
            { name: 'large',     width: 1080 },
        ];

        const original = await this.s3.getObject({
            Bucket: 'media-uploads',
            Key: media.original_key,
        }).promise();

        const variantUrls = {};
        for (const variant of variants) {
            const processed = await sharp(original.Body)
                .resize(variant.width, variant.height, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const variantKey = `processed/${media.id}/${variant.name}.jpg`;
            await this.s3.putObject({
                Bucket: 'media-cdn',
                Key: variantKey,
                Body: processed,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000',  // 1 year
            }).promise();

            variantUrls[variant.name] = `https://cdn.example.com/${variantKey}`;
        }

        // Update media record
        await this.db.query(
            `UPDATE media SET status = 'ready', variants = $1 WHERE id = $2`,
            [JSON.stringify(variantUrls), mediaId]
        );
    }
}
```

---

## Trade-Offs Summary

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Fan-out strategy | Pure write | Pure read | **Hybrid** | Balances celebrity problem with read performance |
| Feed ranking | Chronological | ML-ranked | **Weighted scoring** | Simple but effective; ML for production at scale |
| Timeline storage | PostgreSQL | Redis sorted sets | **Redis** | O(log N) reads, perfect for ranked timeline |
| Media upload | Through API server | Direct to S3 (presigned) | **Presigned URL** | Don't bottleneck API servers with large uploads |
| Celebrity threshold | 50K followers | 500K followers | **100K** | Balances write amplification vs read latency |
| Post metadata store | NoSQL | PostgreSQL | **PostgreSQL** | 12 writes/sec easily handled; need ACID for counts |

---

## Scaling Strategy

### Phase 1: Single Region (0-10M MAU)
- 4 App servers (Post + Feed services combined)
- PostgreSQL primary + 2 read replicas
- Redis (single instance, 32 GB) for timelines
- S3 + CloudFront for media
- No fan-out for celebrities yet

### Phase 2: Growth (10M-100M MAU)
- Separate Post Service, Feed Service, Fan-out Service
- Redis Cluster (10+ nodes, 640 GB for timelines)
- Kafka for async fan-out processing
- Celebrity detection and hybrid fan-out
- Multiple CDN edge locations
- Read replicas per service

### Phase 3: Global (100M-300M MAU)
- Multi-region deployment
- Feed pre-computation on schedule (hourly for cold users)
- Ranking model upgraded to ML-based
- Separate analytics pipeline for engagement signals
- Graph database for social connections (Neo4j or custom)
- Multi-tier caching: L1 (app memory) + L2 (Redis) + L3 (PostgreSQL)

---

## Failure Scenarios & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Redis timeline cache lost | Feed reads hit DB (slow) | Rebuild from followers list + recent posts; PostgreSQL has all data |
| Fan-out service backlog | Delayed post visibility | Scale Kafka consumers horizontally; monitor consumer lag |
| Celebrity post storm | Spike in feed reads | Celebrity posts served from cache with high TTL; read replicas |
| CDN origin overload | Slow media loading | S3 multi-region replication; CDN shields origin |
| PostgreSQL primary down | Cannot create posts | Promote replica; queue writes during failover |
| Ranking service slow | Feed latency spike | Circuit breaker: fall back to chronological ordering |

---

## Key Interview Talking Points

1. **Why hybrid fan-out?** -- Pure write fan-out breaks with celebrities (1 post = 10M writes). Pure read fan-out is too slow (N queries per feed read). Hybrid gives the best of both worlds.
2. **How to handle unfollows?** -- Lazy deletion: when building the feed, filter out posts from unfollowed users. Don't eagerly remove from all timelines (too expensive).
3. **Why Redis sorted sets for timelines?** -- ZADD is O(log N), ZRANGEBYSCORE for pagination is O(log N + M). Perfect for time-ordered feeds with cursor-based pagination.
4. **How to prevent stale feeds?** -- Publish new posts via WebSocket/SSE for real-time updates when user has the app open. Pull-to-refresh triggers full feed rebuild.
5. **Why not just use a graph database?** -- Social graph queries (followers list) are simple lookups, not complex graph traversals. PostgreSQL with proper indexes handles this efficiently. Consider a graph DB only if you need friend-of-friend recommendations or complex social queries.
