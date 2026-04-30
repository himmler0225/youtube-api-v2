/**
 * Service xử lý việc lưu data crawl từ youtube-crawler vào DB.
 *
 * Tất cả operations đều dùng upsert — idempotent, gọi nhiều lần không bị lỗi.
 * Crawler gọi các method này qua IngestController sau mỗi lần crawl.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "@generated/prisma/client";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { ChannelRepository } from "./repositories/channel.repository";
import { VideoRepository } from "./repositories/video.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { QueueService } from "@/modules/queue/queue.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import {
  IngestSearchDto,
  IngestDetailDto,
  IngestCommentsDto,
  IngestChannelDto,
  IngestTrendingDto,
} from "./dto";

@Injectable()
export class IngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channelRepo: ChannelRepository,
    private readonly videoRepo: VideoRepository,
    private readonly commentRepo: CommentRepository,
    private readonly queue: QueueService,
    private readonly logger: AppLogger,
  ) {}

  // ==================== Channel ====================

  async ingestChannel(dto: IngestChannelDto) {
    const channel = await this.channelRepo.upsert({
      id: dto.channel_id,
      name: dto.channel_name,
      handle: dto.handle,
      avatar: dto.avatar,
      banner: dto.banner,
      subscriberCountText: dto.subscriber_count,
      description: dto.description,
    });

    this.logger.info("Channel ingested", { channelId: channel.id });
    return { channelId: channel.id };
  }

  // ==================== Search ====================

  async ingestSearch(dto: IngestSearchDto) {
    const crawledAt = new Date();
    let saved = 0;

    for (const [index, video] of dto.videos.entries()) {
      const videoId = video.video_id;
      if (!videoId) continue;

      // Upsert channel nếu có channel_id
      if (video.channel_id && video.channel) {
        await this.channelRepo.upsert({
          id: video.channel_id,
          name: video.channel,
        });
      }

      await this.videoRepo.upsertFromCrawl({
        id: videoId,
        title: video.title ?? videoId,
        channelId: video.channel_id || null,
        channelName: video.channel,
        viewsText: video.views,
        durationText: video.duration,
        publishedTimeText: video.published_time,
        descriptionSnippet: video.description_snippet,
        thumbnails: video.thumbnails as unknown as Prisma.InputJsonValue,
      });

      await this.prisma.searchResult.create({
        data: {
          videoId,
          query: dto.query,
          rank: index + 1,
          sort: dto.sort ?? "relevance",
          crawledAt,
        },
      });

      // Auto-crawl detail + comments in background
      await this.queue.addCrawlDetail(videoId);
      saved++;
    }

    this.logger.info("Search results ingested", {
      query: dto.query,
      count: saved,
    });
    return { saved };
  }

  // ==================== Video Detail ====================

  async ingestDetail(dto: IngestDetailDto) {
    const videoId = dto.video_id;

    if (dto.error) {
      await this.videoRepo.upsertFromDetail({
        id: videoId,
        title: dto.title ?? videoId,
        isAvailable: false,
        unavailableReason: dto.reason,
      });
      return { videoId, available: false };
    }

    await this.videoRepo.upsertFromDetail({
      id: videoId,
      title: dto.title ?? videoId,
      channelName: dto.author,
      viewCount: dto.views ? BigInt(dto.views) : null,
      durationSeconds: dto.length_seconds ? Number(dto.length_seconds) : null,
      isLiveContent: dto.is_live_content ?? false,
      isAvailable: true,
    });

    this.logger.info("Video detail ingested", { videoId });
    return { videoId, available: true };
  }

  // ==================== Trending ====================

  async ingestTrending(dto: IngestTrendingDto) {
    const crawledAt = new Date();
    let saved = 0;

    for (const [index, video] of dto.videos.entries()) {
      const videoId = video.video_id;
      if (!videoId) continue;

      if (video.channel_id && video.channel) {
        await this.channelRepo.upsert({
          id: video.channel_id,
          name: video.channel,
        });
      }

      await this.videoRepo.upsertFromCrawl({
        id: videoId,
        title: video.title ?? videoId,
        channelId: video.channel_id || null,
        channelName: video.channel,
        viewsText: video.views,
        durationText: video.duration,
        publishedTimeText: video.published_time,
        thumbnails: video.thumbnails as unknown as Prisma.InputJsonValue,
      });

      await this.prisma.trendingSnapshot.create({
        data: {
          videoId,
          rank: video.rank ?? index + 1,
          category: dto.category,
          crawledAt,
        },
      });

      await this.queue.addCrawlDetail(videoId);
      saved++;
    }

    this.logger.info("Trending ingested", {
      category: dto.category,
      count: saved,
    });
    return { saved };
  }

  // ==================== Comments ====================

  async ingestComments(dto: IngestCommentsDto) {
    let saved = 0;

    for (const comment of dto.comments) {
      const commentId = comment.comment_id;
      if (!commentId) continue;

      await this.commentRepo.upsert({
        id: commentId,
        videoId: dto.video_id,
        author: comment.author,
        avatar: comment.avatar,
        content: comment.content,
        likesCount: comment.likes,
        repliesCount: comment.replies_count,
        publishedTimeText: comment.published_time,
      });
      saved++;

      for (const reply of comment.replies ?? []) {
        const replyId = reply.comment_id;
        if (!replyId) continue;

        await this.commentRepo.upsert({
          id: replyId,
          videoId: dto.video_id,
          parentId: commentId,
          author: reply.author,
          avatar: reply.avatar,
          content: reply.content,
          likesCount: reply.likes,
          publishedTimeText: reply.published_time,
        });
        saved++;
      }
    }

    this.logger.info("Comments ingested", {
      videoId: dto.video_id,
      count: saved,
    });
    return { saved };
  }
}
