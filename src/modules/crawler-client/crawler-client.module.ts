import { Global, Module } from '@nestjs/common';
import { CrawlerClientService } from './crawler-client.service';
import { AppLogger } from '../../base/logger/app-logger.service';

@Global()
@Module({
  providers: [CrawlerClientService, AppLogger],
  exports: [CrawlerClientService],
})
export class CrawlerClientModule {}
