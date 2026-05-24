import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { IngestGuard } from "./ingest.guard";
import { ChannelRepository } from "./repositories/channel.repository";
import { VideoRepository } from "./repositories/video.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { AppLogger } from "@/base/logger/app-logger.service";
import { AlgoliaModule } from "@/modules/algolia/algolia.module";
import { SnakeToCamelMiddleware } from "@/base/middleware/snake-to-camel.middleware";

@Module({
  imports: [AlgoliaModule],
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestGuard,
    ChannelRepository,
    VideoRepository,
    CommentRepository,
    AppLogger,
  ],
  exports: [IngestService],
})
export class IngestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SnakeToCamelMiddleware)
      .forRoutes({ path: "internal/ingest/*path", method: RequestMethod.POST });
  }
}
