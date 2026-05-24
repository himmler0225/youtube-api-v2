import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppLogger, RequestContextMiddleware } from "./base";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { RedisModule } from "./modules/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { IngestModule } from "./modules/ingest/ingest.module";
import { CrawlerClientModule } from "./modules/crawler-client/crawler-client.module";
import { VideoModule } from "./modules/video/video.module";
import { QueueModule } from "./modules/queue/queue.module";
import { CrawlWorkerModule } from "./modules/crawl-worker/crawl-worker.module";
import { HealthModule } from "./modules/health/health.module";
import { AlgoliaModule } from "./modules/algolia/algolia.module";
import { LiveModule } from "./modules/live/live.module";
import { AiLabelModule } from "./modules/ai-label/ai-label.module";
import { PublicUserModule } from "./modules/public-user/public-user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    RedisModule,
    AlgoliaModule,
    CrawlerClientModule,
    QueueModule,
    AuthModule,
    IngestModule,
    VideoModule,
    CrawlWorkerModule,
    HealthModule,
    LiveModule,
    AiLabelModule,
    PublicUserModule,
  ],
  providers: [AppLogger, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
