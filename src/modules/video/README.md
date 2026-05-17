# Video Module

Public-facing API for videos, shorts, and live content. Follows a DB-first pattern: check the database, fall back to a real-time crawler call only on a miss or for live content.

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/videos` | List videos; Elasticsearch search when `q` is provided |
| `GET` | `/videos/shorts` | YouTube Shorts feed; DB first, crawler fallback if < 10 records |
| `GET` | `/videos/live` | Real-time live video search; 30 s Redis cache |
| `GET` | `/videos/:id` | Video detail; DB first, crawler if missing or is live (1 min Redis cache) |
| `GET` | `/videos/:id/comments` | Paginated comments; DB first, crawl on zero count |

## DB-First Pattern (per endpoint)

**`GET /videos?q=`**
- With `q`: Elasticsearch `multi_match` on `title^3`, `channelName`, `description`, `fuzziness: AUTO`.
- Without `q`: Prisma `findMany` ordered by `crawledAt desc`, only `isAvailable = true`.

**`GET /videos/shorts`**
- DB count `< 10` → call `CrawlerClientService.getShorts(50)` → upsert → return from DB.

**`GET /videos/live`**
- Always calls crawler. Result cached in Redis for 30 s (`live:search:{query}:{page}:{limit}`).

**`GET /videos/:id`**
- DB hit + `isLiveContent = false` → return DB record directly.
- DB miss or `isLiveContent = true` → call crawler → upsert → return. Live results cached 60 s (`video:live:{id}`).

**`GET /videos/:id/comments`**
- DB top-level comment count `> 0` → paginate from DB with replies.
- Count `= 0` → crawl 100 comments → save → return paginated slice.

## Key Files

```
video.controller.ts   — route definitions (Swagger annotated)
video.service.ts      — all business logic and DB-first orchestration
video.module.ts       — imports ElasticModule; declares AppLogger
types/video.type.ts   — internal type helpers
```

## Dependencies

- `PrismaService` — DB reads/writes
- `RedisService` — caching for live content
- `CrawlerClientService` — real-time crawler calls (global)
- `ElasticService` — Elasticsearch client for `q`-based search

## Cache TTLs

| Key pattern | TTL |
|-------------|-----|
| `video:live:{id}` | 60 s |
| `live:search:{query}:{page}:{limit}` | 30 s |
