import { Module } from "@nestjs/common";
import { LiveGateway } from "./live.gateway";
import { CrawlerGateway } from "./crawler.gateway";
import { AppLogger } from "@/base/logger/app-logger.service";

@Module({
  providers: [LiveGateway, CrawlerGateway, AppLogger],
})
export class LiveModule {}
