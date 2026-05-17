# Crawler Client Module

Global HTTP client for synchronous (real-time) calls to `youtube-crawler`. Used when a video is missing from the DB, when live content must be refreshed, or when the BullMQ worker needs to fetch detail/comments.

## Configuration

| Env var | Description |
|---------|-------------|
| `CRAWLER_URL` | Base URL of the crawler service |
| `CRAWLER_API_KEY` | Sent as `X-API-Key` header on every request |

## API

```typescript
getVideoDetail(videoId: string): Promise<CrawlerVideoResult>
  // GET /api/video/:id
  // Returns CrawlerVideoDetail on success or CrawlerVideoError on failure

getComments(videoId: string, page?: number, limit?: number): Promise<CrawlerComment[]>
  // GET /api/video/:id/comments?page=&limit=

getShorts(limit?: number): Promise<CrawlerShort[]>
  // GET /api/videos/shorts?limit=

getLiveVideos(query: string, page?: number, limit?: number): Promise<CrawlerLiveVideo[]>
  // GET /api/videos/live?q=&page=&limit=
```

All methods throw `ServiceUnavailableException` (HTTP 503) on network error or non-2xx response.

## Types (`types/index.ts`)

```typescript
CrawlerVideoDetail   — { video_id, title, author, length_seconds: string, views: number, is_live_content }
CrawlerVideoError    — { error: true, reason, status }
CrawlerVideoResult   — CrawlerVideoDetail | CrawlerVideoError
CrawlerLiveVideo     — { video_id, title, thumbnail, channel_name, url, view_count, is_live }
CrawlerShort         — { video_id, title, thumbnails, view_count, channel_name, url, is_short }
CrawlerComment       — { comment_id, author, avatar?, content, published_time, likes, replies_count, replies[] }
CrawlerCommentReply  — { comment_id, author, avatar?, content, published_time, likes }
```

> Note: `CrawlerVideoDetail.length_seconds` is a **string**. Convert with `Number()` before storing in DB.

## Key Files

```
crawler-client.module.ts    — @Global module declaration
crawler-client.service.ts   — HTTP methods, shared _fetch() helper
types/index.ts              — all response type definitions
```

## Module Notes

- `@Global()` — `CrawlerClientService` is available app-wide without importing this module.
- Consumers: `VideoService` (real-time requests) and `CrawlDetailProcessor` (queue worker).
