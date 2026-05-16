# youtube-api

NestJS REST API — receives data from `youtube-crawler`, stores it in PostgreSQL, and serves it to clients over HTTP.

---

## Architecture

```
Client
  ├── GET /videos, /videos/:id, ...       → VideoModule
  └── POST /auth/*                        → AuthModule

youtube-crawler
  └── POST /internal/ingest/*             → IngestModule
        └── push video_ids → BullMQ queue
                └── CrawlDetailProcessor
                      └── GET crawler /api/video/:id   (real-time)
```

**DB-first pattern:** DB hit → miss/live → call crawler → save to DB → return

---

## Modules

| Module | Description |
|--------|-------------|
| `PrismaModule` | Global — PostgreSQL via Prisma ORM |
| `RedisModule` | Global — ioredis wrapper, get/set JSON with TTL |
| `CrawlerClientModule` | Global — HTTP client for real-time calls to youtube-crawler |
| `QueueModule` | Global — BullMQ on Redis, exports `QueueService` |
| `AuthModule` | Register / login / refresh / logout, session management |
| `IngestModule` | Receives batch data from crawler, saves to DB, pushes to queue |
| `VideoModule` | Public endpoints: list, search, trending, live, shorts, detail, comments |
| `CrawlWorkerModule` | BullMQ processor — auto-crawls detail + comments after ingest |

### Base infrastructure (`src/base/`)

| Component | Description |
|-----------|-------------|
| `AppLogger` | Structured JSON logger, redacts sensitive fields, configurable level |
| `RequestContextMiddleware` | Injects a `requestId` UUID into every request |
| `AllExceptionsFilter` | Normalizes all exceptions → `ApiError { code, message }` |
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
| GET | `/videos` | `q`, `page`, `limit` | List videos — Elasticsearch when `q` is present |
| GET | `/videos/trending` | `category`, `page`, `limit` | Latest trending snapshot |
| GET | `/videos/live` | `q`, `page`, `limit` | Real-time live search from crawler (30s cache) |
| GET | `/videos/shorts` | `page`, `limit` | Shorts feed — DB first, miss → crawler |
| GET | `/videos/:id` | — | DB first, miss/live → crawler (live cache 60s) |
| GET | `/videos/:id/comments` | `page`, `limit` | DB first, miss → crawl → save → paginate |

### Ingest — `/internal/ingest` *(header: `X-Service-Key`)*

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/ingest/channel` | Save channel info |
| POST | `/internal/ingest/trending` | Save trending batch + push to queue |
| POST | `/internal/ingest/search` | Save search results + push to queue |
| POST | `/internal/ingest/detail` | Save single video detail |
| POST | `/internal/ingest/comments` | Save comments |

---

## BullMQ — Auto-crawl pipeline

After `ingestTrending` / `ingestSearch`, each `video_id` is pushed to the `crawl-detail` queue.

`CrawlDetailProcessor` (concurrency=3):
1. `getVideoDetail()` → `ingestDetail()`
2. If not live → `getComments()` → `ingestComments()`
3. Comment failure → log warn, job does not fail. Retry 3 times, exponential backoff 5s.

Jobs use `jobId = videoId` — automatic deduplication when a video is already in the queue.

---

## Search

`GET /videos?q=keyword` uses Elasticsearch (`multi_match` on `title^3`, `channelName`, `description`, fuzziness `AUTO`).

Without `q` → Prisma `findMany` ordered by `crawledAt desc`.

---

## Database schema

Tables use snake_case via `@@map`. TypeScript code stays camelCase via `@map`.

```
users ──┬── auth_sessions
        ├── audit_logs
        └── login_attempts

channels ──── videos ──┬── trending_snapshots
                       ├── search_results
                       └── comments (self-referencing replies)
```

---

## Environment variables

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true   # pgbouncer (runtime)
DIRECT_URL=postgresql://user:pass@host:5432/db                     # direct connection (migrations)

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
PEPPER=                      # HMAC pepper for password hashing

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
