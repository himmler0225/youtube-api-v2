import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  CrawlerClientService,
  CrawlerVideoDetail,
} from "@/modules/crawler-client/crawler-client.service";
import { IngestService } from "@/modules/ingest/ingest.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import { CRAWL_DETAIL_QUEUE } from "@/modules/queue/queue.service";

@Processor(CRAWL_DETAIL_QUEUE, { concurrency: 3 })
export class CrawlDetailProcessor extends WorkerHost {
  constructor(
    private readonly crawler: CrawlerClientService,
    private readonly ingest: IngestService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    const { videoId } = job.data;
    this.logger.info("[CrawlWorker] Processing video detail", { videoId });

    const result = await this.crawler.getVideoDetail(videoId);

    if ("error" in result && result.error) {
      await this.ingest.ingestDetail({
        video_id: videoId,
        error: true,
        reason: result.reason,
      });
      this.logger.warn("[CrawlWorker] Video unavailable", {
        videoId,
        reason: result.reason,
      });
      return;
    }

    const d = result as CrawlerVideoDetail;
    await this.ingest.ingestDetail({
      video_id: videoId,
      title: d.title,
      author: d.author,
      // CrawlerVideoDetail has strings; DTO expects numbers
      views: d.views ? Number(d.views) : undefined,
      length_seconds: d.length_seconds ? Number(d.length_seconds) : undefined,
      is_live_content: d.is_live_content,
    });

    if (d.is_live_content) return; // live comment streams have no archival value

    try {
      const comments = await this.crawler.getComments(videoId, 1, 100);
      await this.ingest.ingestComments({
        video_id: videoId,
        comments: comments.map((c) => ({
          comment_id: c.comment_id,
          author: c.author,
          avatar: c.avatar,
          content: c.content,
          likes: c.likes,
          replies_count: c.replies_count,
          published_time: c.published_time,
          replies: (c.replies ?? []).map((r) => ({
            comment_id: r.comment_id,
            author: r.author,
            avatar: r.avatar,
            content: r.content,
            likes: r.likes,
            published_time: r.published_time,
          })),
        })),
      });
      this.logger.info("[CrawlWorker] Comments ingested", { videoId });
    } catch (error) {
      // Comment failure must not fail the job — detail is already saved.
      this.logger.warn("[CrawlWorker] Comment fetch failed, continuing", {
        videoId,
        error: String(error),
      });
    }
  }
}
