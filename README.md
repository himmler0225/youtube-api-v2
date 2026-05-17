# youtube-api

NestJS 11 REST API — receives crawled data from `youtube-crawler`, stores it in PostgreSQL, and serves it to clients over HTTP.

---

## Architecture

```
Client
  ├── GET /videos, /videos/:id, ...       → VideoModule
  └── POST /auth/*                        → AuthModule

youtube-crawler (scheduled batch)
  └── POST /internal/ingest/*             → IngestModule
        └── push video_id → BullMQ queue "crawl-detail"
              └── CrawlDetailProcessor (concurrency=3)
                    ├── GET /api/video/:id        → crawler (real-time)
                    └── GET /api/video/:id/comments
```

**DB-first pattern (VideoModule):** check DB → miss or live → call crawler → save → return.

---

## Modules

| Module | Scope | Description |
|--------|-------|-------------|
| `PrismaModule` | Global | PostgreSQL via Prisma ORM |
| `RedisModule` | Global | ioredis wrapper, JSON get/set with TTL |
| `CrawlerClientModule` | Global | HTTP client for real-time calls to youtube-crawler |
| `QueueModule` | Global | BullMQ on Redis, exports `QueueService` |
| `AuthModule` | — | Register, login, refresh, logout, session management |
| `IngestModule` | — | Receives batch data from crawler, saves to DB, pushes to queue |
| `VideoModule` | — | Public endpoints: list, search, trending, live, shorts, detail, comments |
| `CrawlWorkerModule` | — | BullMQ processor — auto-crawls detail + comments after ingest |
| `ElasticModule` | — | Elasticsearch client, used by VideoModule for full-text search |

See `README.md` inside each module directory for flow details.

### Base infrastructure (`src/base/`)

| Component | Description |
|-----------|-------------|
| `AppLogger` | Structured JSON logger, redacts sensitive fields, configurable level |
| `RequestContextMiddleware` | Injects `requestId` UUID into every request |
| `AllExceptionsFilter` | Normalises all exceptions → `ApiError { code, message }` |
| `ResponseInterceptor` | Wraps all responses → `ApiSuccess { data, meta }` |
| `BasePrismaRepository` | Abstract generic repository (CRUD, pagination, filter, sort) |

---

## API Endpoints

### Auth — `/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account, returns access + refresh token |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Rotate refresh token (reuse detection) |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/logout-all` | Revoke all sessions |

### Videos — `/videos`

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/videos` | `q`, `page`, `limit` | List videos — Elasticsearch when `q` present, Prisma otherwise |
| GET | `/videos/trending` | `category`, `page`, `limit` | Latest trending snapshot from DB |
| GET | `/videos/live` | `q`, `page`, `limit` | Real-time live search via crawler (30s cache) |
| GET | `/videos/shorts` | `page`, `limit` | Shorts feed from `shorts` table; miss → crawler |
| GET | `/videos/:id` | — | DB first; live content always re-fetched (60s cache) |
| GET | `/videos/:id/comments` | `page`, `limit` | DB first; 0 comments → crawl → save → paginate |

### Ingest — `/internal/ingest` *(header: `X-Service-Key`)*

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/ingest/channel` | Upsert channel |
| POST | `/internal/ingest/trending` | Upsert videos + TrendingSnapshot + queue detail |
| POST | `/internal/ingest/search` | Upsert videos + SearchResult + queue detail |
| POST | `/internal/ingest/detail` | Update video with accurate metrics from detail page |
| POST | `/internal/ingest/shorts` | Upsert into `shorts` table (no queue) |
| POST | `/internal/ingest/comments` | Upsert comments + replies |

---

## BullMQ pipeline

After `ingestTrending` / `ingestSearch`, each `video_id` is pushed to the `crawl-detail` queue.

`CrawlDetailProcessor` (concurrency=3, attempts=3, exponential backoff 5s):
1. `getVideoDetail()` → `ingestDetail()`
2. Skip comments if live content
3. `getComments()` → `ingestComments()` (failure isolated — does not fail the job)

`jobId = videoId` — BullMQ deduplicates: same video won't be queued twice while pending/active.

---

## Search

`GET /videos?q=keyword` → Elasticsearch `multi_match` on `title^3`, `channelName`, `description`, fuzziness `AUTO`.

No `q` → Prisma `findMany` ordered by `crawledAt desc`.

---

## Database schema

Tables use snake_case via `@@map`. TypeScript stays camelCase via `@map`.

```
users ──┬── auth_sessions
        ├── audit_logs
        └── login_attempts

channels ──── videos ──┬── trending_snapshots
                       ├── search_results
                       └── comments (self-referencing replies)

shorts  (separate from videos — no channel FK, duration stored as integer seconds)
```

---

## Environment variables

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

# Security
PEPPER=

# Internal service auth
INTERNAL_SERVICE_KEY=        # guards /internal/ingest/*

# Crawler
CRAWLER_URL=http://localhost:8000
CRAWLER_API_KEY=

# Elasticsearch
ELASTIC_NODE=http://localhost:9200
ELASTIC_USERNAME=
ELASTIC_PASSWORD=
```

---

## Running locally

```bash
npm install
npx prisma generate          # after schema changes
npx prisma migrate deploy    # apply migrations
npm run start:dev
```
