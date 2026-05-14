import { Module } from "@nestjs/common";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import { ElasticModule } from "@/modules/elastic/elastic.module";

@Module({
  imports: [ElasticModule],
  controllers: [VideoController],
  providers: [VideoService, AppLogger],
})
export class VideoModule {}
