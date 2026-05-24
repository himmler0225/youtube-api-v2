import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IngestService } from "./ingest.service";
import { IngestGuard } from "./ingest.guard";
import {
  IngestChannelDto,
  IngestSearchDto,
  IngestDetailDto,
  IngestCommentsDto,
  IngestTrendingDto,
  IngestShortsDto,
  IngestChannelVideosDto,
  IngestPlaylistsDto,
  IngestPlaylistItemsDto,
} from "./dto";

@SkipThrottle()
@Controller("internal/ingest")
@UseGuards(IngestGuard)
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post("channel")
  ingestChannel(@Body() dto: IngestChannelDto) {
    return this.ingestService.ingestChannel(dto);
  }

  @Post("search")
  ingestSearch(@Body() dto: IngestSearchDto) {
    return this.ingestService.ingestSearch(dto);
  }

  @Post("trending")
  ingestTrending(@Body() dto: IngestTrendingDto) {
    return this.ingestService.ingestTrending(dto);
  }

  @Post("detail")
  ingestDetail(@Body() dto: IngestDetailDto) {
    return this.ingestService.ingestDetail(dto);
  }

  @Post("shorts")
  ingestShorts(@Body() dto: IngestShortsDto) {
    return this.ingestService.ingestShorts(dto);
  }

  @Post("comments")
  ingestComments(@Body() dto: IngestCommentsDto) {
    return this.ingestService.ingestComments(dto);
  }

  @Post("channel-videos")
  ingestChannelVideos(@Body() dto: IngestChannelVideosDto) {
    return this.ingestService.ingestChannelVideos(dto);
  }

  @Post("playlists")
  ingestPlaylists(@Body() dto: IngestPlaylistsDto) {
    return this.ingestService.ingestPlaylists(dto);
  }

  @Post("playlist-items")
  ingestPlaylistItems(@Body() dto: IngestPlaylistItemsDto) {
    return this.ingestService.ingestPlaylistItems(dto);
  }
}
