# Node.js Senior Interview Prep

Complete guide for senior **Node.js / TypeScript** developer interviews at top tech companies (FAANG, startups, scale-ups). Covers core JavaScript, TypeScript, async patterns, system design, data structures, and real-world architecture -- everything you need in one repo.

---

## Project Structure

```
nodejs-senior-interview/
├── README.md
├── PRACTICE_90MIN.md            # 90-minute rapid practice sheet
├── code/                        # 16 runnable TypeScript / JavaScript files
│   ├── 01_js_fundamentals.ts
│   ├── 02_typescript_deep_dive.ts
│   ├── 03_closures_scope_hoisting.ts
│   ├── 04_oop_classes.ts
│   ├── 05_design_patterns.ts
│   ├── 06_solid_principles.ts
│   ├── 07_async_promises.ts
│   ├── 08_event_loop_concurrency.ts
│   ├── 09_streams_buffers.ts
│   ├── 10_express_fastify_nest.ts
│   ├── 11_testing_jest_vitest.ts
│   ├── 12_data_structures.ts
│   ├── 13_leetcode_patterns.ts
│   ├── 14_system_design_basics.ts
│   ├── 15_ai_ml_integration.ts
│   └── 16_mock_interview_questions.ts
├── docs/                        # 16 companion deep-dive documents
│   ├── 01_js_fundamentals.md
│   ├── 02_typescript_deep_dive.md
│   ├── 03_closures_scope_hoisting.md
│   ├── 04_oop_classes.md
│   ├── 05_design_patterns.md
│   ├── 06_solid_principles.md
│   ├── 07_async_promises.md
│   ├── 08_event_loop_concurrency.md
│   ├── 09_streams_buffers.md
│   ├── 10_express_fastify_nest.md
│   ├── 11_testing_jest_vitest.md
│   ├── 12_data_structures.md
│   ├── 13_leetcode_patterns.md
│   ├── 14_system_design_basics.md
│   ├── 15_ai_ml_integration.md
│   └── 16_mock_interview_questions.md
├── lld/                         # 10 low-level design problems
│   ├── 01_parking_lot.ts
│   ├── 02_lru_cache.ts
│   ├── 03_task_scheduler.ts
│   ├── 04_rate_limiter.ts
│   ├── 05_pub_sub_system.ts
│   ├── 06_file_system.ts
│   ├── 07_elevator_system.ts
│   ├── 08_snake_game.ts
│   ├── 09_logger_framework.ts
│   └── 10_connection_pool.ts
└── hld/                         # 10 high-level design documents
    ├── 01_url_shortener.md
    ├── 02_chat_application.md
    ├── 03_notification_service.md
    ├── 04_rate_limiter.md
    ├── 05_distributed_cache.md
    ├── 06_search_engine.md
    ├── 07_video_streaming.md
    ├── 08_payment_system.md
    ├── 09_social_media_feed.md
    └── 10_ci_cd_pipeline.md
```

---

## Topics Covered

| # | Topic | Code | Doc |
|---|-------|------|-----|
| 01 | JavaScript Fundamentals (types, coercion, prototypes, iterators) | `code/01` | `docs/01` |
| 02 | TypeScript Deep Dive (generics, mapped types, conditional types, utility types) | `code/02` | `docs/02` |
| 03 | Closures, Scope & Hoisting | `code/03` | `docs/03` |
| 04 | OOP & Classes (inheritance, mixins, abstract classes) | `code/04` | `docs/04` |
| 05 | Design Patterns (strategy, factory, observer, decorator, singleton) | `code/05` | `docs/05` |
| 06 | SOLID Principles in TypeScript | `code/06` | `docs/06` |
| 07 | Async & Promises (Promise.all, race, allSettled, custom combinators) | `code/07` | `docs/07` |
| 08 | Event Loop & Concurrency (worker threads, cluster, child_process) | `code/08` | `docs/08` |
| 09 | Streams & Buffers (readable, writable, transform, pipeline) | `code/09` | `docs/09` |
| 10 | Web Frameworks (Express, Fastify, NestJS patterns) | `code/10` | `docs/10` |
| 11 | Testing (Jest, Vitest, supertest, mocking, TDD) | `code/11` | `docs/11` |
| 12 | Data Structures (linked lists, trees, graphs, heaps, tries) | `code/12` | `docs/12` |
| 13 | LeetCode Patterns (sliding window, two pointers, BFS/DFS, DP) | `code/13` | `docs/13` |
| 14 | System Design Basics (CAP, load balancing, sharding, caching) | `code/14` | `docs/14` |
| 15 | AI / ML Integration (LLM APIs, embeddings, RAG pipelines) | `code/15` | `docs/15` |
| 16 | Mock Interview Questions & Behaviorals | `code/16` | `docs/16` |

---

## How to Use

Every file in `code/` is a standalone runnable script. No build step required for quick exploration.

```bash
# Run a TypeScript file directly
npx ts-node code/01_js_fundamentals.ts

# Or with tsx (faster, no type-checking overhead)
npx tsx code/05_design_patterns.ts

# Or compile first, then run
npx tsc code/07_async_promises.ts --outDir dist && node dist/07_async_promises.js

# Run a low-level design problem
npx tsx lld/02_lru_cache.ts
```

Read the matching `docs/` file for theory, diagrams, and interview tips before running each code file.

---

## Requirements

| Tool | Minimum Version |
|------|-----------------|
| Node.js | 20+ (LTS recommended) |
| TypeScript | 5.0+ |
| npm / pnpm / yarn | any recent version |

Optional but helpful:

- `tsx` -- fast TypeScript execution without `tsconfig.json` overhead
- `vitest` or `jest` -- for the testing module (`code/11`)

```bash
# Quick setup
npm init -y
npm install -D typescript tsx @types/node
```

---

## 6-Week Study Plan

### Week 1 -- JavaScript Fundamentals & TypeScript

| Day | Focus | Files |
|-----|-------|-------|
| Mon | Types, coercion, equality, `typeof` gotchas | `code/01`, `docs/01` |
| Tue | Prototypes, `this`, `new`, prototype chain | `code/01`, `docs/01` |
| Wed | Closures, scope chain, hoisting, IIFE | `code/03`, `docs/03` |
| Thu | TypeScript generics, utility types, conditional types | `code/02`, `docs/02` |
| Fri | TypeScript mapped types, template literals, `infer` | `code/02`, `docs/02` |
| Sat | Review + practice: rewrite 5 JS snippets in strict TS | `code/01-03` |
| Sun | Rest or light review | -- |

### Week 2 -- OOP & Design Patterns

| Day | Focus | Files |
|-----|-------|-------|
| Mon | Classes, inheritance, abstract classes, mixins | `code/04`, `docs/04` |
| Tue | Interfaces vs types, access modifiers, decorators | `code/04`, `docs/04` |
| Wed | Strategy, Factory, Builder patterns | `code/05`, `docs/05` |
| Thu | Observer, Decorator, Singleton patterns | `code/05`, `docs/05` |
| Fri | SOLID principles with TypeScript examples | `code/06`, `docs/06` |
| Sat | LLD practice: Parking Lot + LRU Cache | `lld/01`, `lld/02` |
| Sun | LLD practice: Task Scheduler | `lld/03` |

### Week 3 -- Async, Concurrency & Web Frameworks

| Day | Focus | Files |
|-----|-------|-------|
| Mon | Promises deep dive, combinators, error propagation | `code/07`, `docs/07` |
| Tue | async/await, top-level await, cancellation patterns | `code/07`, `docs/07` |
| Wed | Event loop, microtasks vs macrotasks, `process.nextTick` | `code/08`, `docs/08` |
| Thu | Worker threads, cluster module, child_process | `code/08`, `docs/08` |
| Fri | Streams: readable, writable, transform, pipeline | `code/09`, `docs/09` |
| Sat | Express / Fastify / NestJS patterns | `code/10`, `docs/10` |
| Sun | LLD practice: Rate Limiter + Pub/Sub | `lld/04`, `lld/05` |

### Week 4 -- Data Structures & LeetCode Patterns

| Day | Focus | Files |
|-----|-------|-------|
| Mon | Arrays, hash maps, sets, stacks, queues in JS | `code/12`, `docs/12` |
| Tue | Linked lists, trees, BST operations | `code/12`, `docs/12` |
| Wed | Graphs, BFS, DFS, topological sort | `code/12`, `docs/12` |
| Thu | Sliding window, two pointers, fast & slow | `code/13`, `docs/13` |
| Fri | Binary search, merge intervals, top-K | `code/13`, `docs/13` |
| Sat | Dynamic programming patterns (knapsack, coin change, LCS) | `code/13`, `docs/13` |
| Sun | Timed LeetCode set: 4 problems in 90 min | `PRACTICE_90MIN.md` |

### Week 5 -- System Design & AI Integration

| Day | Focus | Files |
|-----|-------|-------|
| Mon | CAP theorem, consistency models, load balancing | `code/14`, `docs/14` |
| Tue | Caching strategies, CDN, database sharding | `code/14`, `docs/14` |
| Wed | HLD practice: URL Shortener + Chat App | `hld/01`, `hld/02` |
| Thu | HLD practice: Notification Service + Payment System | `hld/03`, `hld/08` |
| Fri | LLM APIs, embeddings, vector stores | `code/15`, `docs/15` |
| Sat | RAG pipelines, prompt engineering, AI agents | `code/15`, `docs/15` |
| Sun | HLD practice: Distributed Cache + Search Engine | `hld/05`, `hld/06` |

### Week 6 -- Testing, Mock Interviews & Final Review

| Day | Focus | Files |
|-----|-------|-------|
| Mon | Unit testing with Jest / Vitest, mocking strategies | `code/11`, `docs/11` |
| Tue | Integration testing, supertest, test doubles | `code/11`, `docs/11` |
| Wed | Mock interview: behavioral + system design | `code/16`, `docs/16` |
| Thu | Mock interview: live coding (2 medium LC + 1 LLD) | `code/13`, `lld/07-08` |
| Fri | Weak-spots review, redo hardest problems | all |
| Sat | Full mock: 45 min system design + 45 min coding | all |
| Sun | Rest. You are ready. | -- |

---

## Suggested Daily Routine

```
Morning  (60 min)  Read the docs/ file for the day. Take notes.
Midday   (45 min)  Run and modify the matching code/ file. Experiment.
Evening  (45 min)  Solve 1-2 LeetCode problems or 1 LLD/HLD exercise.
Before bed (15 min) Review flashcards / key concepts from the day.
```

---

## License

This project is for personal educational use. Feel free to fork, extend, and share.
