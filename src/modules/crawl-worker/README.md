# Crawl Worker Module

BullMQ consumer that automatically crawls video detail and comments for every video that enters the system via search or trending ingest.

## Flow

```
QueueService.addCrawlDetail(videoId)          ← called by IngestService (search/trending)
  → BullMQ queue "crawl-detail"
    → CrawlDetailProcessor.process()          (concurrency = 3)
        1. CrawlerClientService.getVideoDetail(videoId)
           ├─ error? → ingestDetail({ error: true }) → mark isAvailable=false → done
           └─ ok?    → ingestDetail({ title, views, length_seconds, is_live_content })
        2. is_live_content = true → skip comments, done
        3. CrawlerClientService.getComments(videoId, page=1, limit=100)  [try/catch]
           └─ ingestComments({ video_id, comments[] })
              └─ comment failure does NOT fail the job
```

## Key Behaviors

- **Concurrency 3** — three videos processed in parallel, balancing speed against crawler rate limits.
- **Job dedup** — `jobId = videoId`; BullMQ drops duplicate enqueues while a job is pending or active.
- **Retry policy** — 3 attempts, exponential backoff starting at 5 s (set in `QueueService`).
- **Live videos** — detail is saved but comments are skipped (live chat is ephemeral).
- **Comment isolation** — comment fetch is wrapped in a separate `try/catch`; a comment crawl failure marks the job as complete, not failed. Detail is already persisted.

## Key Files

```
crawl-detail.processor.ts   — @Processor("crawl-detail"), WorkerHost subclass
crawl-worker.module.ts      — imports IngestModule + re-registers queue name
```

## Module Notes

- Imports `IngestModule` to access `IngestService`.
- `CrawlerClientService` is injected automatically (global `CrawlerClientModule`).
- `QueueModule` (global) provides the Redis connection; this module re-registers the queue name so the processor binds to the correct queue.
- Declares `AppLogger` in its own `providers[]`.
