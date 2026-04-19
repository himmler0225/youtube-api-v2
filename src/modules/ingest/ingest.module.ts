import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { IngestGuard } from './ingest.guard';
import { ChannelRepository } from './repositories/channel.repository';
import { VideoRepository } from './repositories/video.repository';
import { CommentRepository } from './repositories/comment.repository';
import { AppLogger } from '../../base/logger/app-logger.service';

@Module({
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
export class IngestModule {}
