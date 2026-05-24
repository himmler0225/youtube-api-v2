import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CrawlDetailProcessor } from "./crawl-detail.processor";
import { IngestModule } from "@/modules/ingest/ingest.module";
import { CRAWL_DETAIL_QUEUE } from "@/modules/queue/queue.service";
import { AppLogger } from "@/base/logger/app-logger.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: CRAWL_DETAIL_QUEUE }),
    IngestModule,
  ],
  providers: [CrawlDetailProcessor, AppLogger],
})
export class CrawlWorkerModule {}
