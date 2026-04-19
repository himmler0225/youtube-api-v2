import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppLogger } from '../../base/logger/app-logger.service';

@Global()
@Module({
  providers: [RedisService, AppLogger],
  exports: [RedisService],
})
export class RedisModule {}
