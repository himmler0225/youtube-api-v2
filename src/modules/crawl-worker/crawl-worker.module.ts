/**
 * CrawlWorkerModule — chứa BullMQ processor để auto-crawl video detail.
 *
 * Import IngestModule để dùng IngestService lưu data sau khi crawl.
 * CrawlerClientService được inject tự động (CrawlerClientModule là @Global).
 * Queue connection được lấy từ QueueModule (cũng @Global).
 */
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CrawlDetailProcessor } from "./crawl-detail.processor";
import { IngestModule } from "@/modules/ingest/ingest.module";
import { CRAWL_DETAIL_QUEUE } from "@/modules/queue/queue.service";
import { AppLogger } from "@/base/logger/app-logger.service";

@Module({
  imports: [
    // Re-register queue name trong module này để processor bind đúng queue
    BullModule.registerQueue({ name: CRAWL_DETAIL_QUEUE }),
    IngestModule,
  ],
  providers: [CrawlDetailProcessor, AppLogger],
})
export class CrawlWorkerModule {}
