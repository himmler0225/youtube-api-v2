# Ingest Module

Receives batch crawl data from `youtube-crawler` and persists it to PostgreSQL. All writes use `upsert` — re-ingesting the same data is idempotent.

## Flow

```
youtube-crawler (scheduled jobs)
  → POST /internal/ingest/{type}   (X-Service-Key header required)
    → IngestService.ingest*()
      → upsert Channel / Video / Short / Comment
      → (search & trending only) QueueService.addCrawlDetail(videoId)
        → CrawlDetailProcessor picks up async
```

## Endpoints

All routes are under `POST /internal/ingest/` and protected by `IngestGuard` (checks `X-Service-Key` header against `INTERNAL_SERVICE_KEY` env var). Throttling is skipped for all ingest routes.

| Route | DTO | What it does |
|-------|-----|--------------|
| `POST /internal/ingest/channel` | `IngestChannelDto` | Upsert channel metadata |
| `POST /internal/ingest/search` | `IngestSearchDto` | Upsert videos + `SearchResult` rows; queue detail crawl |
| `POST /internal/ingest/trending` | `IngestTrendingDto` | Upsert videos + `TrendingSnapshot` rows; queue detail crawl |
| `POST /internal/ingest/detail` | `IngestDetailDto` | Update accurate view count, duration, live flag (called by worker) |
| `POST /internal/ingest/shorts` | `IngestShortsDto` | Upsert to `shorts` table — no queue push |
| `POST /internal/ingest/comments` | `IngestCommentsDto` | Upsert top-level comments + replies |

## Key Behaviors

- **`ingestSearch` / `ingestTrending`**: after saving, call `queue.addCrawlDetail(videoId)` — the BullMQ worker then crawls exact view count, duration, and comments asynchronously.
- **`ingestDetail`**: called by `CrawlDetailProcessor`, not directly by crawler scheduled jobs. Handles the `error: true` case (deleted/private video) by setting `isAvailable = false`.
- **`ingestShorts`**: writes to the separate `shorts` table (no `channel_id`, `duration` is integer seconds). No queue push.
- **`ingestComments`**: handles two-level nesting — top-level comments and their replies (`parentId`).

## Key Files

```
ingest.controller.ts          — route definitions, IngestGuard applied
ingest.service.ts             — all ingest* methods
ingest.guard.ts               — validates X-Service-Key header
repositories/
  channel.repository.ts       — upsert channels
  video.repository.ts         — upsertFromCrawl (text metrics) + upsertFromDetail (exact metrics)
  comment.repository.ts       — upsert comments + replies
dto/                          — one DTO per endpoint
```

## Module Notes

- Declares `AppLogger` in its own `providers[]`.
- Exports `IngestService` — consumed by `CrawlWorkerModule`.
- Injects `QueueService` from the global `QueueModule` (no explicit import needed).
