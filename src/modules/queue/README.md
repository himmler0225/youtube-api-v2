# Queue Module

Global BullMQ module. Provides `QueueService` to any module in the app without requiring an explicit import.

## Responsibility

Owns the BullMQ connection (backed by Redis) and exposes a single method to enqueue video detail crawl jobs.

## Queue: `crawl-detail`

| Setting | Value |
|---------|-------|
| Queue name constant | `CRAWL_DETAIL_QUEUE = 'crawl-detail'` |
| Job dedup | `jobId = videoId` — BullMQ ignores duplicates while a job is pending/active |
| Attempts | 3 |
| Backoff | Exponential, initial delay 5 s |
| `removeOnComplete` | Keep last 200 completed jobs in Redis (for debugging) |
| `removeOnFail` | Keep last 50 failed jobs |

## API

```typescript
QueueService.addCrawlDetail(videoId: string): Promise<void>
```

Called by `IngestService` after `ingestSearch()` and `ingestTrending()`. The worker (`CrawlDetailProcessor`) consumes these jobs.

## Key Files

```
queue.module.ts         — @Global, BullMQ root + queue registration
queue.service.ts        — addCrawlDetail(); exports CRAWL_DETAIL_QUEUE constant
constants/index.ts      — CRAWL_DETAIL_QUEUE = 'crawl-detail'
```

## Module Notes

- `@Global()` — `QueueService` is available app-wide; no need to add `QueueModule` to other module imports.
- Redis connection is configured from `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` env vars (defaults: `localhost:6379/0`).
- This module only registers the queue. The processor lives in `CrawlWorkerModule`.
