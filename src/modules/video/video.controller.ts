import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { VideoService } from "./video.service";

@ApiTags("videos")
@SkipThrottle()
@Controller("videos")
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @ApiOperation({ summary: "List videos with optional full-text search" })
  @ApiQuery({ name: "q", required: false, description: "Search query" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @Get()
  listVideos(
    @Query("q") query?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.videoService.listVideos(query, page, limit);
  }

  @ApiOperation({ summary: "Search live videos in real-time from crawler" })
  @ApiQuery({ name: "q", required: true, description: "Search keyword" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @Get("live")
  searchLive(
    @Query("q") query: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
  ) {
    return this.videoService.searchLive(query, page, limit);
  }

  @ApiOperation({ summary: "Get video detail — DB first, miss → crawler" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.videoService.findOne(id);
  }

  @ApiOperation({ summary: "Get video comments" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @Get(":id/comments")
  getComments(
    @Param("id") id: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
  ) {
    return this.videoService.getComments(id, page, limit);
  }
}
