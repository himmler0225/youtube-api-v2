import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PaginationQueryDto } from "@/base/dto/pagination.dto";
import { VideoService } from "./video.service";

@ApiTags("videos")
@SkipThrottle()
@Controller("videos")
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @ApiOperation({ summary: "List videos with optional full-text search" })
  @ApiQuery({ name: "q", required: false, description: "Search query" })
  @Get()
  listVideos(
    @Query("q") query?: string,
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.videoService.listVideos(
      query,
      pagination.page,
      pagination.limit,
    );
  }

  @ApiOperation({
    summary: "Get YouTube Shorts feed — DB first, miss → crawler",
  })
  @Get("shorts")
  getShorts(
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.videoService.getShorts(pagination.page, pagination.limit);
  }

  @ApiOperation({ summary: "Search live videos in real-time from crawler" })
  @ApiQuery({ name: "q", required: true, description: "Search keyword" })
  @Get("live")
  searchLive(
    @Query("q") query: string,
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.videoService.searchLive(
      query,
      pagination.page,
      pagination.limit,
    );
  }

  @ApiOperation({ summary: "Get video detail — DB first, miss → crawler" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.videoService.findOne(id);
  }

  @ApiOperation({ summary: "Get video comments" })
  @Get(":id/comments")
  getComments(
    @Param("id") id: string,
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.videoService.getComments(id, pagination.page, pagination.limit);
  }
}
