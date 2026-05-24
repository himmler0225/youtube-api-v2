import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import Redis from "ioredis";
import { AppLogger } from "@/base/logger/app-logger.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("REDIS_URL");
    if (redisUrl) {
      const u = new URL(redisUrl);
      this.client = new Redis({
        host: u.hostname,
        port: parseInt(u.port) || 6379,
        password: u.password || undefined,
        tls: redisUrl.startsWith("rediss://") ? {} : undefined,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    } else {
      this.client = new Redis({
        host: this.config.get<string>("REDIS_HOST", "localhost"),
        port: this.config.get<number>("REDIS_PORT", 6379),
        password: this.config.get<string>("REDIS_PASSWORD") || undefined,
        db: this.config.get<number>("REDIS_DB", 0),
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    }

    this.client.on("connect", () => this.logger.info("Redis connected"));
    this.client.on("error", (err: Error) =>
      this.logger.error("Redis error", { error: err.message }),
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  // Sliding window rate limit — trả về số lần trong window (chỉ đọc, không ghi)
  async slidingWindowCount(key: string, windowMs: number): Promise<number> {
    const windowStart = Date.now() - windowMs;
    await this.client.zremrangebyscore(key, 0, windowStart);
    return this.client.zcard(key);
  }

  // Ghi 1 event vào sliding window (gọi khi login thất bại)
  async slidingWindowAdd(key: string, windowMs: number): Promise<void> {
    const now = Date.now();
    const member = `${now}-${randomBytes(4).toString("hex")}`;
    const ttl = Math.ceil(windowMs / 1000) + 1;
    await this.client.zadd(key, now, member);
    await this.client.expire(key, ttl);
  }

  async delByPattern(pattern: string): Promise<void> {
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    const pipeline = this.client.pipeline();

    stream.on("data", (keys: string[]) => {
      keys.forEach((key) => pipeline.del(key));
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", () => {
        pipeline
          .exec()
          .then(() => resolve())
          .catch(reject);
      });
      stream.on("error", reject);
    });
  }
}
