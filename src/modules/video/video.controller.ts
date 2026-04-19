import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * GET /videos
   * Danh sách video từ DB, hỗ trợ tìm kiếm theo title.
   */
  @Get()
  listVideos(
    @Query('q') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.videoService.listVideos(query, page, limit);
  }

  /**
   * GET /videos/live?q=keyword
   * Search live video real-time từ crawler, cache 30s.
   */
  @Get('live')
  searchLive(
    @Query('q') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
  ) {
    return this.videoService.searchLive(query, page, limit);
  }

  /**
   * GET /videos/:id
   * Chi tiết video — DB first, live/miss → crawler.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }

  /**
   * GET /videos/:id/comments?page=1&limit=30
   * Comments — DB first, miss → crawler → lưu DB.
   */
  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
  ) {
    return this.videoService.getComments(id, page, limit);
  }
}
