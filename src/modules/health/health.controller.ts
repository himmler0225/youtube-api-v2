import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @ApiOperation({ summary: "Check API, DB, and Redis health" })
  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    const status = {
      db: dbOk.status === "fulfilled" ? "ok" : "error",
      redis: redisOk.status === "fulfilled" ? "ok" : "error",
    };

    return {
      status: Object.values(status).every((s) => s === "ok")
        ? "ok"
        : "degraded",
      services: status,
      timestamp: new Date().toISOString(),
    };
  }
}
