/**
 * QueueModule — @Global, cung cấp BullMQ connection + QueueService cho toàn app.
 *
 * Dùng Redis connection đã có (REDIS_HOST / REDIS_PORT / REDIS_DB).
 * Module chỉ đăng ký queue, không chứa processor (processor ở CrawlWorkerModule).
 */
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService, CRAWL_DETAIL_QUEUE } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          db: config.get<number>('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: CRAWL_DETAIL_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
