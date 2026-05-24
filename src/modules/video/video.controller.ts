import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "@/base/dto/pagination.dto";
import { VideoService } from "./video.service";

class VideoListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search query" })
  @IsOptional()
  @IsString()
  q?: string;
}

@ApiTags("videos")
@SkipThrottle()
@Controller("videos")
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @ApiOperation({ summary: "List videos with optional full-text search" })
  @Get()
  listVideos(@Query() dto: VideoListQueryDto) {
    return this.videoService.listVideos(dto.q, dto.page, dto.limit);
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

  @ApiOperation({ summary: "Get live videos — optional keyword filter" })
  @Get("live")
  searchLive(@Query() dto: VideoListQueryDto) {
    return this.videoService.searchLive(dto.q ?? "", dto.page, dto.limit);
  }

  @ApiOperation({ summary: "Get distinct AI-labeled categories" })
  @Get("categories")
  getCategories() {
    return this.videoService.getCategories();
  }

  @ApiOperation({ summary: "Get video detail — DB first, miss → crawler" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.videoService.findOne(id);
  }

  @ApiOperation({ summary: "Get related videos by same channel" })
  @Get(":id/related")
  getRelated(@Param("id") id: string, @Query("limit") limit = 10) {
    return this.videoService.getRelatedVideos(id, Number(limit));
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
