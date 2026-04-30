import { Module } from "@nestjs/common";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { AppLogger } from "@/base/logger/app-logger.service";

@Module({
  controllers: [VideoController],
  providers: [VideoService, AppLogger],
})
export class VideoModule {}
