# HLD 09 -- AI Model Inference Service

> **Interview time budget:** 40 min total
> Clarify (5 min) | Estimate (5 min) | High-Level Design (15 min) | Deep Dive (15 min)

---

## 1. Clarify (5 min)

### Functional Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| F1 | **Synchronous inference** | REST API for small models (< 500 ms response) |
| F2 | **Streaming inference** | SSE/WebSocket for LLMs (token-by-token output) |
| F3 | **Model registry** | Upload, version, and manage ML models |
| F4 | **Dynamic batching** | Batch multiple requests to maximize GPU utilization |
| F5 | **A/B testing** | Route traffic between model versions |
| F6 | **Canary deployments** | Gradually roll out new model versions |
| F7 | **Rate limiting** | Token-based quotas per API key |
| F8 | **Usage metering & billing** | Track tokens consumed per request |
| F9 | **Multi-model serving** | Host multiple models on shared GPU infrastructure |
| F10 | **Semantic caching** | Cache responses for similar prompts |

### Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Throughput | **10,000 requests/sec** across all models |
| NF2 | Latency (small models, p99) | **< 500 ms** (classification, embedding) |
| NF3 | Latency (LLM time-to-first-token, p99) | **< 2 s** |
| NF4 | Availability | **99.95 %** (26 min downtime/month) |
| NF5 | GPU utilization | **> 70 %** average |
| NF6 | Model load time | **< 60 s** for hot-swap |
| NF7 | Cost efficiency | Minimize idle GPU time |

### Users & Access Patterns

- **1,000+** enterprise API customers
- Mix of workloads: real-time chat (LLM), batch embeddings, image classification
- Bursty traffic: spikes around business hours, product launches
- Token distribution: most requests are short (< 500 tokens), 5 % are long (> 4 K tokens)

---

## 2. Estimate (5 min)

### QPS Breakdown

| Model Type | Share | QPS | Avg Latency |
|------------|-------|-----|-------------|
| LLM (chat/completion) | 40 % | 4,000 /s | 2-30 s (streaming) |
| Embeddings | 35 % | 3,500 /s | 50-100 ms |
| Classification/NER | 15 % | 1,500 /s | 20-50 ms |
| Image models | 10 % | 1,000 /s | 100-500 ms |
| **Total** | 100 % | **10,000 /s** | -- |

### GPU Requirements

| Model Type | GPU per Instance | Throughput per GPU | GPUs Needed |
|------------|-----------------|-------------------|-------------|
| LLM (7B params, FP16) | 1x A100 (80 GB) | ~200 req/s (with batching) | 20 |
| LLM (70B params, FP16) | 4x A100 (tensor parallel) | ~50 req/s | 80 (20 groups x 4) |
| Embedding model | 1x A10G | ~1000 req/s | 4 |
| Classification | 1x T4 | ~500 req/s | 3 |
| Image model | 1x A10G | ~100 req/s | 10 |
| **Total GPUs** | -- | -- | **~117 GPUs** (provision 150 for headroom) |

### Storage & Bandwidth

| Data | Calculation | Result |
|------|-------------|--------|
| Model weights (registry) | 50 model versions x avg 20 GB | **1 TB** |
| Request/response logs | 10 K/s x 2 KB avg x 86400 s/day | **~1.7 TB / day** |
| Bandwidth (ingress) | 10 K/s x 1 KB avg request | **10 MB/s** |
| Bandwidth (egress) | 4 K LLM x 5 KB + 6 K small x 0.5 KB | **23 MB/s** |

### Token Economics

| Metric | Calculation | Result |
|--------|-------------|--------|
| Tokens per LLM request (avg) | 500 input + 200 output | 700 tokens |
| Daily LLM tokens | 4 K/s x 700 x 86400 | **~240 B tokens / day** |
| Revenue per 1 M tokens (approx) | $2 input, $6 output (market rate) | -- |
| Daily token revenue | ~140 B input x $2/M + ~70 B output x $6/M | ~$700 K / day |

---

## 3. High-Level Design (15 min)

### Architecture Diagram

```
 Client (REST / WebSocket / SDK)
          |
          | HTTPS / WSS
          v
 +-------------------+
 |   API Gateway     |  -- Auth, rate limiting, request validation
 |   (Kong / Envoy)  |
 +--------+----------+
          |
          |  Route by model + version
          v
 +-------------------+     +-------------------+
 | Traffic Router    |     | A/B Test Config   |
 | & Load Balancer   |<----|  (Feature Flags)  |
 +--------+----------+     +-------------------+
          |
     +----+----+----+
     |         |    |
     v         v    v
 +--------+ +--------+ +--------+
 |Inference| |Inference| |Inference|   <-- Inference Worker Pool
 |Worker 1 | |Worker 2 | |Worker N |       (GPU instances)
 |[GPU]    | |[GPU]    | |[GPU]    |
 +----+----+ +----+----+ +----+----+
      |            |            |
      +------+-----+-----+-----+
             |           |
             v           v
 +-------------------+  +-------------------+
 | Request Queue     |  | Semantic Cache    |
 | (for batching)    |  | (Redis + Vector   |
 | (Redis / SQS)     |  |  similarity)      |
 +-------------------+  +-------------------+

 +-------------------+  +-------------------+  +-------------------+
 | Model Registry    |  | Monitoring &      |  | Billing &         |
 | (S3 + Metadata DB)|  | Auto-Scaler       |  | Metering Service  |
 |                   |  | (Prometheus +     |  | (Kafka + DB)      |
 | - Model versions  |  |  custom scaler)   |  |                   |
 | - A/B configs     |  | - GPU utilization |  | - Token counting  |
 | - Canary rules    |  | - Queue depth     |  | - Rate limiting   |
 +-------------------+  | - Latency targets |  | - Invoice gen     |
                        +-------------------+  +-------------------+
```

### API Design

#### Chat Completion (Streaming)

```
POST /api/v1/chat/completions
Headers:
  Authorization: Bearer sk-xxx
  X-Model-Version: gpt-4-v2 (optional, for A/B override)

Body:
{
  "model": "gpt-4",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain quantum computing." }
  ],
  "max_tokens": 500,
  "temperature": 0.7,
  "stream": true
}

Response (SSE stream):
  data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"Quantum"}}]}
  data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":" computing"}}]}
  ...
  data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"."}}],"usage":{"prompt_tokens":25,"completion_tokens":187}}
  data: [DONE]
```

#### Embeddings

```
POST /api/v1/embeddings
Body: {
  "model": "text-embedding-3-small",
  "input": ["Hello world", "How are you"],
  "encoding_format": "float"
}

Response:
{
  "data": [
    { "index": 0, "embedding": [0.0023, -0.009, ...] },
    { "index": 1, "embedding": [0.0015, -0.012, ...] }
  ],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 8, "total_tokens": 8 }
}
```

#### Model Management

```
# Register a new model version
POST /api/v1/models
Body: {
  "name": "gpt-4",
  "version": "v2.1",
  "framework": "pytorch",
  "artifact_uri": "s3://models/gpt-4/v2.1/weights.safetensors",
  "gpu_requirements": { "type": "A100", "count": 4, "vram_gb": 320 },
  "config": { "max_seq_len": 8192, "vocab_size": 100256 }
}

# Configure canary deployment
POST /api/v1/models/gpt-4/canary
Body: {
  "base_version": "v2.0",
  "canary_version": "v2.1",
  "canary_percentage": 5,
  "success_criteria": {
    "max_p99_latency_ms": 3000,
    "min_success_rate": 0.995
  },
  "auto_promote": true
}
```

### Database Schema

```sql
-- Models
CREATE TABLE models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,         -- "gpt-4"
    version         VARCHAR(50) NOT NULL,          -- "v2.1"
    framework       VARCHAR(50) NOT NULL,          -- "pytorch", "tensorrt"
    artifact_uri    VARCHAR(1024) NOT NULL,        -- S3 path to model weights
    config          JSONB NOT NULL,                -- model-specific config
    gpu_type        VARCHAR(50),                   -- "A100", "A10G", "T4"
    gpu_count       INT DEFAULT 1,
    status          VARCHAR(20) DEFAULT 'registered',  -- registered, loading, active, deprecated
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, version)
);

-- Deployment configurations
CREATE TABLE deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id        UUID REFERENCES models(id),
    replicas        INT DEFAULT 1,
    min_replicas    INT DEFAULT 1,
    max_replicas    INT DEFAULT 10,
    traffic_weight  INT DEFAULT 100,               -- for A/B: 0-100
    is_canary       BOOLEAN DEFAULT false,
    auto_scale_config JSONB,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, running, draining, stopped
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- API keys and rate limits
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash        CHAR(64) NOT NULL UNIQUE,      -- SHA-256 of API key
    org_id          UUID NOT NULL,
    name            VARCHAR(255),
    rate_limit_rpm  INT DEFAULT 60,                -- requests per minute
    rate_limit_tpm  INT DEFAULT 100000,            -- tokens per minute
    allowed_models  TEXT[],                         -- NULL = all models
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking
CREATE TABLE usage_records (
    id              BIGSERIAL PRIMARY KEY,
    api_key_id      UUID REFERENCES api_keys(id),
    model_name      VARCHAR(255),
    model_version   VARCHAR(50),
    request_id      UUID,
    prompt_tokens   INT,
    completion_tokens INT,
    total_tokens    INT,
    latency_ms      INT,
    status_code     SMALLINT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_usage_key_time ON usage_records(api_key_id, created_at);
CREATE INDEX idx_usage_model    ON usage_records(model_name, created_at);
```

---

## 4. Deep Dive (15 min)

### Deep Dive A: Dynamic Batching for GPU Efficiency

GPUs achieve maximum throughput when processing batches, not individual requests. The dynamic batcher collects incoming requests and forms optimal batches.

**Architecture:**

```
 Incoming Requests
   r1  r2  r3  r4  r5  r6
    |   |   |   |   |   |
    v   v   v   v   v   v
 +----------------------------+
 |     Request Queue          |
 |  (per model, sorted by     |
 |   arrival time)            |
 +-------------+--------------+
               |
               v
 +----------------------------+
 |     Dynamic Batcher        |
 |                            |
 |  Trigger conditions:       |
 |  1. Batch full (32 reqs)   |
 |  2. Timeout (50ms since    |
 |     first request in batch)|
 |  3. Queue pressure         |
 +-------------+--------------+
               |
               v
 +----------------------------+
 |     GPU Inference          |
 |  (process batch together)  |
 +----------------------------+
               |
        +------+------+
        |      |      |
        v      v      v
       r1     r2     r3   ... (responses routed back)
```

**Batching algorithm:**

```typescript
class DynamicBatcher {
  private queue: InferenceRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize: number;
  private readonly maxWaitMs: number;
  private readonly maxBatchTokens: number;

  constructor(config: {
    maxBatchSize: number;      // e.g., 32
    maxWaitMs: number;         // e.g., 50ms
    maxBatchTokens: number;    // e.g., 4096 total tokens in batch
  }) {
    this.maxBatchSize = config.maxBatchSize;
    this.maxWaitMs = config.maxWaitMs;
    this.maxBatchTokens = config.maxBatchTokens;
  }

  addRequest(req: InferenceRequest): Promise<InferenceResponse> {
    return new Promise((resolve, reject) => {
      req._resolve = resolve;
      req._reject = reject;
      this.queue.push(req);

      // Start timer on first request in a new batch window
      if (this.queue.length === 1) {
        this.batchTimer = setTimeout(() => this.flushBatch(), this.maxWaitMs);
      }

      // Flush immediately if batch is full
      if (this.queue.length >= this.maxBatchSize ||
          this.currentBatchTokens() >= this.maxBatchTokens) {
        this.flushBatch();
      }
    });
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) clearTimeout(this.batchTimer);

    // Take up to maxBatchSize requests
    const batch = this.queue.splice(0, this.maxBatchSize);
    if (batch.length === 0) return;

    try {
      // Pad sequences to same length, run inference
      const paddedInputs = this.padSequences(batch);
      const results = await this.gpuInference(paddedInputs);

      // Route results back to individual requests
      for (let i = 0; i < batch.length; i++) {
        batch[i]._resolve(results[i]);
      }
    } catch (err) {
      for (const req of batch) {
        req._reject(err);
      }
    }
  }

  private currentBatchTokens(): number {
    return this.queue.reduce((sum, r) => sum + r.tokenCount, 0);
  }
}
```

**Continuous batching for LLMs (key optimization):**

Traditional batching waits for all sequences in a batch to finish generating before starting the next batch. Continuous batching (also called iteration-level batching) allows:

1. New requests join the batch at any iteration (step)
2. Completed sequences leave the batch immediately
3. GPU is never idle waiting for the longest sequence

```
Iteration 1: [req1(step 3), req2(step 1), req3(step 1)]
Iteration 2: [req1(step 4), req2(step 2), req3(step 2), req4(step 1)]  <- req4 joined
Iteration 3: [req1(DONE),   req2(step 3), req3(step 3), req4(step 2)]  <- req1 done, slot freed
Iteration 4: [req5(step 1), req2(step 4), req3(DONE),   req4(step 3)]  <- req5 fills req1's slot
```

This improves GPU utilization from ~40 % (static batching) to ~85 % (continuous batching).

### Deep Dive B: Auto-Scaling and GPU Resource Management

**Scaling signals (multi-signal approach):**

```typescript
interface ScalingMetrics {
  queueDepth: number;           // pending requests in queue
  avgLatencyMs: number;         // recent p50 latency
  p99LatencyMs: number;         // recent p99 latency
  gpuUtilization: number;       // 0-100%
  gpuMemoryUsage: number;       // 0-100%
  activeRequests: number;       // in-flight requests
  tokenThroughput: number;      // tokens/sec being generated
}

class AutoScaler {
  private readonly targetLatencyMs: number;
  private readonly targetGpuUtil: number;
  private readonly scaleUpThreshold: number;
  private readonly scaleDownThreshold: number;
  private readonly cooldownMs: number;

  calculateDesiredReplicas(metrics: ScalingMetrics, currentReplicas: number): number {
    let desiredReplicas = currentReplicas;

    // Signal 1: Queue depth (most responsive)
    if (metrics.queueDepth > 100) {
      desiredReplicas = Math.ceil(currentReplicas * 1.5);
    }

    // Signal 2: Latency target breach
    if (metrics.p99LatencyMs > this.targetLatencyMs * 1.2) {
      desiredReplicas = Math.max(desiredReplicas, currentReplicas + 2);
    }

    // Signal 3: GPU utilization
    if (metrics.gpuUtilization > 90) {
      desiredReplicas = Math.max(desiredReplicas, currentReplicas + 1);
    } else if (metrics.gpuUtilization < 30 && metrics.queueDepth === 0) {
      desiredReplicas = Math.max(1, currentReplicas - 1);  // scale down
    }

    // Signal 4: Predictive scaling (time-of-day pattern)
    const predictedLoad = this.loadPredictor.predict(Date.now() + 600_000); // 10 min ahead
    desiredReplicas = Math.max(desiredReplicas,
      Math.ceil(predictedLoad / this.throughputPerReplica));

    return clamp(desiredReplicas, this.minReplicas, this.maxReplicas);
  }
}
```

**GPU resource management strategy:**

```
 GPU Cluster (150 GPUs total)
 +--------------------------------------------------+
 |                                                    |
 |  Reserved Pool (60%)         Spot Pool (40%)       |
 |  +--------------------+     +------------------+   |
 |  | LLM-70B: 80 GPUs  |     | Burst capacity   |   |
 |  | (20 x 4-GPU groups)|     | Auto-scaled      |   |
 |  +--------------------+     | Can be preempted  |   |
 |  | LLM-7B: 15 GPUs   |     +------------------+   |
 |  +--------------------+                            |
 |  | Embedding: 3 GPUs  |     Warm Pool (standby)    |
 |  +--------------------+     +------------------+   |
 |  | Other: 2 GPUs      |     | Pre-loaded models|   |
 |  +--------------------+     | 30s startup time |   |
 |                              +------------------+   |
 +--------------------------------------------------+
```

**Model loading optimization:**

Loading a 70 B parameter model takes ~90 s from cold storage. We optimize:

1. **Model sharding on S3:** Split model weights into 4 shards matching tensor parallelism. Each GPU downloads only its shard in parallel.
2. **Memory-mapped loading:** Use `mmap` to load model weights. The OS pages in data as needed, reducing cold-start time to ~30 s.
3. **Warm pool:** Keep 2-3 standby instances per popular model with weights already loaded. Scale-up latency drops from 90 s to < 5 s.
4. **Weight sharing (multi-model serving):** Use LoRA adapters on a base model. Multiple "models" share the same base weights, with only small adapter layers (< 1 % of params) swapped.

### Deep Dive C: Semantic Caching

Many users ask similar (not identical) questions. Semantic caching reduces GPU cost and latency by serving cached responses for semantically similar prompts.

**Architecture:**

```
 Incoming Request
      |
      v
 +-------------------+
 | Embed the prompt   |  -- Use a small, fast embedding model
 | (text-embedding-   |     (~5ms per request)
 |  3-small)          |
 +--------+----------+
          |
          v
 +-------------------+
 | Vector similarity  |  -- Search Redis + pgvector
 | search             |     for nearest neighbor
 +--------+----------+
          |
    +-----+------+
    | Sim > 0.98? |
    +-----+------+
    Yes   |    No
    |     |     |
    v     |     v
 Return   | Forward to
 cached   | inference worker
 response |
          |
          +---> Cache the new response
                with its embedding
```

**Implementation details:**

```typescript
class SemanticCache {
  private readonly similarityThreshold = 0.98;
  private readonly maxCacheSize = 1_000_000;
  private readonly ttlMs = 3600_000;  // 1 hour

  async lookup(prompt: string, model: string): Promise<CacheResult | null> {
    // 1. Generate embedding for the prompt
    const embedding = await this.embedModel.encode(prompt);

    // 2. Search vector store for similar prompts
    // Using Redis with RediSearch vector similarity
    const results = await this.redis.call(
      'FT.SEARCH', `idx:cache:${model}`,
      `@embedding:[VECTOR_RANGE 0.02 $vec]`,  // cosine distance < 0.02
      'PARAMS', '2', 'vec', Buffer.from(new Float32Array(embedding).buffer),
      'SORTBY', '__vector_score', 'ASC',
      'LIMIT', '0', '1'
    );

    if (results.length > 0 && results[0].score >= this.similarityThreshold) {
      // 3. Additional validation: check that model, temperature, and
      //    system prompt match exactly (semantic cache only for user prompt)
      const cached = results[0];
      if (cached.model === model && cached.temperature === request.temperature) {
        return {
          response: cached.response,
          cached: true,
          originalPrompt: cached.prompt,
          similarity: results[0].score,
        };
      }
    }

    return null;  // cache miss
  }

  async store(prompt: string, model: string, response: string,
              embedding: number[]): Promise<void> {
    const key = `cache:${model}:${uuidv4()}`;
    await this.redis.hset(key, {
      prompt, model, response,
      embedding: Buffer.from(new Float32Array(embedding).buffer),
      temperature: request.temperature,
      created_at: Date.now(),
    });
    await this.redis.expire(key, this.ttlMs / 1000);
  }
}
```

**Cache invalidation rules:**

| Rule | Reason |
|------|--------|
| TTL of 1 hour | Prevents stale responses for time-sensitive queries |
| Model version change | New model may give different answers |
| Temperature > 0.5 | High temperature means user wants variety; skip cache |
| System prompt differs | Different instructions = different expected output |
| Prompt > 2000 tokens | Long prompts are less likely to match; skip embedding cost |

**Expected hit rates:**

- Customer support bots: **30-40 %** (many repeated questions)
- Code generation: **5-10 %** (highly unique prompts)
- General chat: **15-20 %**
- Embeddings: **25-35 %** (repeated documents)

---

## Trade-offs

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Batching | Static batching | Continuous batching | **Continuous** | 2x better GPU utilization; critical for LLM workloads |
| Serving framework | Custom (PyTorch) | vLLM / TensorRT-LLM | **vLLM** for LLMs; **TensorRT** for other models | vLLM has best continuous batching; TensorRT fastest for fixed models |
| Streaming protocol | WebSocket | SSE (Server-Sent Events) | **SSE** | Simpler, works through proxies/CDNs, HTTP-native; WebSocket for bidirectional needs |
| Model storage | Shared NFS | S3 + local SSD cache | **S3 + local SSD** | NFS is SPOF and bandwidth bottleneck; S3 is durable, SSD gives fast local access |
| Semantic cache DB | pgvector | Redis with vector search | **Redis** | Sub-millisecond latency for cache lookups; pgvector for larger-scale analytics |
| Auto-scaling | Reactive only | Reactive + predictive | **Both** | Predictive handles known traffic patterns; reactive handles unexpected spikes |
| Multi-model serving | Dedicated GPUs | Shared with LoRA | **Hybrid** | Base models get dedicated GPUs; fine-tuned variants share via LoRA |
| Rate limiting | Fixed window | Token bucket + sliding window | **Token bucket** | Smoother rate limiting; handles bursts better |

---

## Scaling Strategy

| Component | Strategy |
|-----------|----------|
| API Gateway | Horizontal auto-scale; stateless; regional deployment |
| Inference Workers | GPU auto-scale based on queue depth + latency; 30 s warm pool for fast scale-up |
| Model Registry | S3 for artifacts (unlimited); PostgreSQL for metadata |
| Request Queue | Redis cluster; partition by model name |
| Semantic Cache | Redis cluster; shard by model; evict LRU when memory full |
| Monitoring | Prometheus + Grafana; per-model dashboards |
| Billing Service | Kafka for event streaming; ClickHouse for aggregation |

**Multi-region strategy:**

```
 US-East (Primary)              EU-West (Secondary)
 +--------------------+         +--------------------+
 | Full GPU cluster   |         | Reduced cluster    |
 | All models served  |         | Top 5 models only  |
 | Model registry     |<------->| Registry replica   |
 |   (source of truth)|  sync   |                    |
 +--------------------+         +--------------------+
         |                               |
         +---------- Global LB ----------+
                (latency-based routing)
```

---

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| GPU hardware failure | Inference worker down | Health checks every 10 s; auto-replace from warm pool; retry request on different worker |
| Model loading OOM | Worker crashes during model load | Pre-validate memory requirements; staged rollout; automatic rollback |
| Inference timeout (model hang) | Request stuck | 30 s hard timeout; kill inference process; recycle worker |
| Request queue overflow | New requests rejected | Back-pressure: return 429; auto-scale triggers; prioritize by API tier (paid > free) |
| Canary version regression | Degraded quality for canary traffic | Automated canary analysis; auto-rollback if error rate > 1 % or latency > 2x baseline |
| Semantic cache corruption | Wrong responses served | TTL limits blast radius; cache is advisory (correctness never depends on it); purge and rebuild |
| S3 outage (model weights) | Cannot load new models | Local SSD cache of active model weights; existing workers unaffected |
| Billing pipeline lag | Usage not metered accurately | Kafka with durable storage; reconciliation job runs daily; usage logged locally as fallback |
| Cold start (all workers down) | Total service outage | Keep minimum 2 workers always running per model (never scale to 0 for production models) |

---

## Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Time to first token (LLM, p99) | > 3 s |
| Token generation speed | < 20 tokens/s per stream |
| GPU utilization (average) | < 40 % (wasting money) or > 95 % (saturated) |
| Request queue depth | > 500 (per model) |
| Error rate (5xx) | > 0.5 % |
| Model load time | > 120 s |
| Semantic cache hit rate | -- (track, no alert; useful for cost optimization) |
| Token metering accuracy | > 99.9 % (reconciliation delta) |
| Canary error rate delta | > 1 % above baseline |
| GPU memory utilization | > 90 % (risk of OOM) |
