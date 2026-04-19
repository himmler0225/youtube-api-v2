import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppLogger, RequestContextMiddleware } from './base';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { CrawlerClientModule } from './modules/crawler-client/crawler-client.module';
import { VideoModule } from './modules/video/video.module';
import { QueueModule } from './modules/queue/queue.module';
import { CrawlWorkerModule } from './modules/crawl-worker/crawl-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    CrawlerClientModule,
    QueueModule,
    AuthModule,
    IngestModule,
    VideoModule,
    CrawlWorkerModule,
  ],
  providers: [AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
