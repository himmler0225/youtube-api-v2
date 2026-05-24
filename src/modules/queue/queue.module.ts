/**
 * QueueModule — @Global, cung cấp BullMQ connection + QueueService cho toàn app.
 *
 * Dùng Redis connection đã có (REDIS_HOST / REDIS_PORT / REDIS_DB).
 * Module chỉ đăng ký queue, không chứa processor (processor ở CrawlWorkerModule).
 */
import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueueService, CRAWL_DETAIL_QUEUE } from "./queue.service";
import { LABEL_QUEUE } from "./constants";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL");
        if (redisUrl) {
          const u = new URL(redisUrl);
          return {
            connection: {
              host: u.hostname,
              port: parseInt(u.port) || 6379,
              password: u.password || undefined,
              tls: redisUrl.startsWith("rediss://") ? {} : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            },
          };
        }
        return {
          connection: {
            host: config.get<string>("REDIS_HOST", "localhost"),
            port: config.get<number>("REDIS_PORT", 6379),
            db: config.get<number>("REDIS_DB", 0),
            maxRetriesPerRequest: null,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: CRAWL_DETAIL_QUEUE }),
    BullModule.registerQueue({ name: LABEL_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
