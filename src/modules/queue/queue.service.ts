import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CRAWL_DETAIL_QUEUE, LABEL_QUEUE } from "./constants";

export { CRAWL_DETAIL_QUEUE, LABEL_QUEUE } from "./constants";

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(CRAWL_DETAIL_QUEUE) private readonly crawlQueue: Queue,
    @InjectQueue(LABEL_QUEUE) private readonly labelQueue: Queue,
  ) {}

  async addCrawlDetail(videoId: string): Promise<void> {
    await this.crawlQueue.add(
      "crawl-detail",
      { videoId },
      {
        jobId: videoId,
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  }

  async addLabel(videoId: string): Promise<void> {
    await this.labelQueue.add(
      "label",
      { videoId },
      {
        jobId: videoId,
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
        delay: 5_000, // space out calls to stay under Gemini 15 RPM limit
      },
    );
  }
}
