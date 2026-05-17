import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PaginationQueryDto } from "@/base/dto/pagination.dto";
import { VideoService } from "./video.service";

@ApiTags("channels")
@SkipThrottle()
@Controller("channels")
export class ChannelController {
  constructor(private readonly videoService: VideoService) {}

  @ApiOperation({ summary: "Get channel info" })
  @Get(":id")
  getChannel(@Param("id") id: string) {
    return this.videoService.getChannel(id);
  }

  @ApiOperation({ summary: "Get videos by channel" })
  @Get(":id/videos")
  getChannelVideos(
    @Param("id") id: string,
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.videoService.getChannelVideos(
      id,
      pagination.page,
      pagination.limit,
    );
  }
}
