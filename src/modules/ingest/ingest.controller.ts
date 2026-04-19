import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { IngestGuard } from './ingest.guard';
import {
  IngestChannelDto,
  IngestSearchDto,
  IngestDetailDto,
  IngestCommentsDto,
} from './dto';

@Controller('internal/ingest')
@UseGuards(IngestGuard)
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('channel')
  ingestChannel(@Body() dto: IngestChannelDto) {
    return this.ingestService.ingestChannel(dto);
  }

  @Post('search')
  ingestSearch(@Body() dto: IngestSearchDto) {
    return this.ingestService.ingestSearch(dto);
  }

  @Post('detail')
  ingestDetail(@Body() dto: IngestDetailDto) {
    return this.ingestService.ingestDetail(dto);
  }

  @Post('comments')
  ingestComments(@Body() dto: IngestCommentsDto) {
    return this.ingestService.ingestComments(dto);
  }
}
