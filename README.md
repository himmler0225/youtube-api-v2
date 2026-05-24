# youtube-api

NestJS 11 REST API — persists crawled YouTube data, serves clients, and orchestrates an async crawl pipeline via BullMQ.

---

## Architecture

```
                          ┌─────────────────────────────────┐
                          │         youtube-crawler          │
                          │  (APScheduler batch + on-demand) │
                          └──────────────┬──────────────────┘
                                         │ POST /internal/ingest/*
                                         ▼
┌─────────┐  GET /videos/*   ┌──────────────────────────────────────────┐
│ Clients │ ───────────────► │              youtube-api                  │
└─────────┘                  │                                          │
                             │  IngestModule ──► BullMQ "crawl-detail"  │
                             │       │                    │              │
                             │       ▼                    ▼              │
                             │  PostgreSQL      CrawlDetailProcessor     │
                             │                  (concurrency=3)          │
                             │                       │                   │
                             │                       ▼                   │
                             │            GET /api/video/:id ──► crawler │
                             └──────────────────────────────────────────┘
```

Two HTTP directions:
- **crawler → api** — batch ingest (scheduled jobs POST data here)
- **api → crawler** — real-time detail fetch (on cache miss or live content)

---

## Design Patterns

### 1. Global vs Scoped Modules

Four infrastructure modules are declared `@Global()` and injected anywhere without repeated imports:

| Module | Exports |
|--------|---------|
| `PrismaModule` | `PrismaService` |
| `RedisModule` | `RedisService` |
| `CrawlerClientModule` | `CrawlerClientService` |
| `QueueModule` | `QueueService` |

All feature modules (`VideoModule`, `AuthModule`, etc.) are scoped — they declare only what they own.

### 2. Repository Pattern

`BasePrismaRepository<T>` provides generic CRUD, pagination, and upsert. Feature repositories extend it and add domain-specific queries. All writes use `upsert` for idempotency — the same payload can be ingested multiple times without duplicates or errors.

```
BasePrismaRepository<T>
  ├── VideoRepository
  ├── ChannelRepository
  ├── CommentRepository
  └── UserRepository
```

### 3. DB-First with Crawler Fallback

Every public read in `VideoService` follows the same resolution order:

```
1. Redis cache hit?  ──► return cached
2. DB hit (non-live)? ──► return DB record
3. Cache miss / live ──► call crawler ──► save ──► return
```

Live content (`isLiveContent = true`) always bypasses the DB and hits the crawler with a 60-second Redis TTL to prevent thundering-herd on popular streams.

### 4. Queue / Worker Decoupling

`IngestModule` and `CrawlWorkerModule` are intentionally separate:

- **IngestModule** — receives data, writes to DB, pushes `videoId` to `crawl-detail` queue. Knows nothing about the worker.
- **CrawlWorkerModule** — processes the queue (concurrency=3, exponential backoff). Imports `IngestService` for the final write.

`jobId = videoId` provides automatic deduplication — the same video cannot be enqueued twice while pending or active.

### 5. Guard → Interceptor → Filter Pipeline

Every request passes through a consistent NestJS pipeline:

```
Request
  │
  ├─ ThrottlerGuard      (global, rate limiting)
  ├─ JwtAuthGuard        (per-route, JWT validation + tokenVersion check)
  ├─ IngestGuard         (internal routes, X-Service-Key header)
  │
  ├─ [Controller Handler]
  │
  ├─ ResponseInterceptor (wraps response → { success, data, meta })
  └─ AllExceptionsFilter (normalises all errors → { success, code, message })
```

### 6. AppException + Error Code System

`AppException` extends `HttpException` with a typed `ErrorCode` enum. Every error surface — validation, auth, not found, rate limit — maps to a stable string code that the client can switch on:

```typescript
throw AppException.conflict("Username already taken");
// → HTTP 409 { code: "CONFLICT", message: "..." }
```

`AllExceptionsFilter` catches everything (including unexpected 500s) and enforces the same shape.

### 7. JWT Refresh Token Rotation

- Access token: 15-min JWT, payload includes `jti` (unique ID) and `v` (token version).
- Refresh token: 64-char random hex, stored as HMAC-SHA256 hash in `auth_sessions`.
- **Reuse detection**: tokens are grouped by `refreshTokenFamily`. If a consumed token is presented again, the entire family is revoked immediately — a strong signal of token theft.
- **JTI blacklist**: on logout, the access token's `jti` is written to Redis until its natural expiry, invalidating it even before the 15-min window closes.

### 8. Structured Logging

`AppLogger` wraps NestJS's `LoggerService`:
- **Dev**: coloured, human-readable with aligned columns
- **Prod**: newline-delimited JSON (compatible with log aggregators)
- Sensitive fields (`password`, `token`, `Authorization`) are redacted before serialisation via `redact()`
- Every request gets a `requestId` (UUID v4) injected by `RequestContextMiddleware` and threaded through all log entries.

---

## Modules

| Module | Scope | Responsibility |
|--------|-------|----------------|
| `PrismaModule` | Global | PostgreSQL client via Prisma ORM |
| `RedisModule` | Global | ioredis, typed JSON get/set with TTL |
| `CrawlerClientModule` | Global | HTTP client → real-time calls to crawler |
| `QueueModule` | Global | BullMQ setup, exports `QueueService` |
| `AuthModule` | — | Register, login, refresh, logout, session management |
| `IngestModule` | — | Receives batch data, writes to DB, enqueues detail jobs |
| `VideoModule` | — | Public video endpoints (list, search, trending, live, shorts, detail, comments) |
| `CrawlWorkerModule` | — | BullMQ processor — crawls detail + comments post-ingest |
| `CommentModule` | — | User-created comments, replies, likes |
| `PublicUserModule` | — | Public user profiles and comment history |
| `AiLabelModule` | — | Groq-based video classification (category + quality score) |
| `AlgoliaModule` | — | Algolia search client, synced on ingest |
| `LiveModule` | — | WebSocket gateway for live view-count updates |

---

## API Reference

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account, returns access + refresh token |
| POST | `/auth/login` | — | Authenticate, returns tokens |
| POST | `/auth/refresh` | — | Rotate refresh token (reuse detection) |
| GET | `/auth/me` | JWT | Current user profile |
| GET | `/auth/sessions` | JWT | List active sessions |
| POST | `/auth/logout` | JWT | Revoke session, blacklist JTI |
| POST | `/auth/logout-all` | JWT | Revoke all sessions |
| POST | `/auth/change-password` | JWT | Change password, revoke all sessions |

### Videos — `/videos`

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/videos` | `q`, `page`, `limit` | List — Algolia when `q` present, Prisma otherwise |
| GET | `/videos/trending` | `category`, `page`, `limit` | Latest trending snapshot |
| GET | `/videos/live` | `q`, `page`, `limit` | Real-time live search (30 s cache) |
| GET | `/videos/shorts` | `page`, `limit` | Shorts feed; miss → crawler |
| GET | `/videos/:id` | — | DB first; live always re-fetched (60 s cache) |
| GET | `/videos/:id/comments` | `page`, `limit` | DB first; 0 results → crawl → save |

### Comments — `/comments`, `/videos/:id/comments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/videos/:videoId/comments` | JWT | Post a comment |
| POST | `/comments/:commentId/replies` | JWT | Reply to a comment |
| POST | `/comments/:commentId/like` | JWT | Toggle like |
| DELETE | `/comments/:commentId` | JWT | Delete own comment |

### Internal Ingest — `/internal/ingest` *(X-Service-Key required)*

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/ingest/channel` | Upsert channel |
| POST | `/internal/ingest/trending` | Upsert videos + snapshot + enqueue detail |
| POST | `/internal/ingest/search` | Upsert videos + search result + enqueue detail |
| POST | `/internal/ingest/detail` | Update video with full metrics |
| POST | `/internal/ingest/shorts` | Upsert shorts |
| POST | `/internal/ingest/comments` | Upsert comments + replies |

---

## Database Schema

```
users ──┬── auth_sessions
        ├── audit_logs
        ├── login_attempts
        ├── comments (user-created)
        ├── comment_likes
        ├── video_likes
        ├── watch_history
        └── subscriptions

channels ──── videos ──┬── trending_snapshots
                       ├── search_results
                       ├── video_labels      (AI category + quality)
                       └── comments ──── comment_likes
                                    └── (self-ref replies)

shorts  (decoupled — no channel FK)
```

Tables use `snake_case` via `@@map`. TypeScript stays `camelCase` via `@map`.

`videos` has a `tsv tsvector` column with a GIN index and an update trigger for full-text search fallback when Algolia is unavailable.

---

## Environment Variables

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

JWT_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d
TOKEN_PEPPER=

INTERNAL_SERVICE_KEY=

CRAWLER_URL=http://localhost:8000
CRAWLER_API_KEY=

ALGOLIA_APP_ID=
ALGOLIA_API_KEY=

GROQ_API_KEY=
```

---

## Development

```bash
npm install
npx prisma generate       # after schema changes
npx prisma migrate deploy # apply migrations
npx tsc --noEmit          # type check
npm test                  # unit tests (jest)
npm run start:dev         # watch mode
```
