import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const CRAWL_DETAIL_QUEUE = 'crawl-detail';

@Injectable()
export class QueueService {
  constructor(@InjectQueue(CRAWL_DETAIL_QUEUE) private readonly queue: Queue) {}

  /**
   * Enqueue a video to have its detail + comments crawled.
   * jobId = videoId → prevents duplicate jobs for the same video
   * while it's still pending/active.
   */
  async addCrawlDetail(videoId: string): Promise<void> {
    await this.queue.add(
      'crawl-detail',
      { videoId },
      {
        jobId: videoId,
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
  }
}
