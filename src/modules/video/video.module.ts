import { Module } from "@nestjs/common";
import { VideoController } from "./video.controller";
import { ChannelController } from "./channel.controller";
import { VideoService } from "./video.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import { AlgoliaModule } from "@/modules/algolia/algolia.module";

@Module({
  imports: [AlgoliaModule],
  controllers: [VideoController, ChannelController],
  providers: [VideoService, AppLogger],
  exports: [VideoService],
})
export class VideoModule {}
