# youtube-api

NestJS REST API — nhận data từ `youtube-crawler`, lưu PostgreSQL, phục vụ client qua HTTP.

---

## Kiến trúc

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

**DB-first pattern:** DB hit → miss/live → gọi crawler → lưu DB → trả về

---

## Modules

| Module | Mô tả |
|--------|-------|
| `PrismaModule` | Global — PostgreSQL qua Prisma ORM |
| `RedisModule` | Global — ioredis wrapper, get/set JSON với TTL |
| `CrawlerClientModule` | Global — HTTP client gọi youtube-crawler (real-time/live) |
| `QueueModule` | Global — BullMQ trên Redis, export `QueueService` |
| `AuthModule` | Đăng ký / đăng nhập / refresh / logout, session management |
| `IngestModule` | Nhận batch data từ crawler, lưu DB, push video_id vào queue |
| `VideoModule` | Public endpoints: list, search, trending, live, shorts, detail, comments |
| `CrawlWorkerModule` | BullMQ processor — tự crawl detail + comments sau ingest |

### Base infrastructure (`src/base/`)

| Thành phần | Mô tả |
|------------|-------|
| `AppLogger` | Structured JSON logger, redact sensitive fields, configurable level |
| `RequestContextMiddleware` | Inject `requestId` UUID vào mỗi request |
| `AllExceptionsFilter` | Chuẩn hóa mọi exception → `ApiError { code, message }` |
| `ResponseInterceptor` | Bọc mọi response → `ApiSuccess { data, meta }` |
| `BasePrismaRepository` | Abstract generic repository (CRUD, pagination, filter, sort) |

---

## API Endpoints

### Auth — `/auth`

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/auth/register` | Tạo tài khoản, trả access + refresh token |
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/refresh` | Rotate refresh token (reuse detection) |
| POST | `/auth/logout` | Revoke session hiện tại |
| POST | `/auth/logout-all` | Revoke tất cả session |

### Videos — `/videos`

| Method | Path | Query | Mô tả |
|--------|------|-------|-------|
| GET | `/videos` | `q`, `page`, `limit` | Danh sách — Elasticsearch khi có `q` |
| GET | `/videos/trending` | `category`, `page`, `limit` | Trending snapshot mới nhất |
| GET | `/videos/live` | `q`, `page`, `limit` | Live search real-time từ crawler (cache 30s) |
| GET | `/videos/shorts` | `page`, `limit` | Shorts feed — DB first, miss → crawler |
| GET | `/videos/:id` | — | DB first, miss/live → crawler (live cache 60s) |
| GET | `/videos/:id/comments` | `page`, `limit` | DB first, miss → crawl → lưu → paginate |

### Ingest — `/internal/ingest` *(header: `X-Service-Key`)*

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/internal/ingest/channel` | Lưu channel info |
| POST | `/internal/ingest/trending` | Lưu trending batch + push queue |
| POST | `/internal/ingest/search` | Lưu search results + push queue |
| POST | `/internal/ingest/detail` | Lưu detail 1 video |
| POST | `/internal/ingest/comments` | Lưu comments |

---

## BullMQ — Auto-crawl pipeline

Sau `ingestTrending` / `ingestSearch`, mỗi `video_id` được push vào queue `crawl-detail`.

`CrawlDetailProcessor` (concurrency=3):
1. `getVideoDetail()` → `ingestDetail()`
2. Nếu không phải live → `getComments()` → `ingestComments()`
3. Comment lỗi → log warn, không fail job. Retry 3 lần, backoff exponential 5s.

Job dùng `jobId = videoId` — dedup tự động khi video đã trong queue.

---

## Search

`GET /videos?q=keyword` dùng Elasticsearch (`multi_match` với `title^3`, `channelName`, `description`, fuzziness `AUTO`).

Không có `q` → Prisma `findMany` sắp xếp theo `crawledAt desc`.

---

## Database schema

Tables dùng snake_case (`@@map`). TypeScript code giữ camelCase qua `@map`.

```
users ──┬── auth_sessions
        ├── audit_logs
        └── login_attempts

channels ──── videos ──┬── trending_snapshots
                       ├── search_results
                       └── comments (self-relation replies)
```

---

## Environment variables

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true   # pgbouncer (runtime)
DIRECT_URL=postgresql://user:pass@host:5432/db                     # direct (migrations)

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
PEPPER=                     # HMAC pepper cho password hash

# Internal service auth
INTERNAL_SERVICE_KEY=       # guard cho /internal/ingest/*

# Crawler
CRAWLER_URL=http://localhost:8000
CRAWLER_API_KEY=

# Elasticsearch
ELASTIC_NODE=http://localhost:9200
ELASTIC_USERNAME=
ELASTIC_PASSWORD=
```

---

## Chạy local

```bash
npm install
npx prisma generate          # sau khi đổi schema
npx prisma migrate deploy    # apply migrations
npm run start:dev
```
