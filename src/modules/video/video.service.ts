/**
 * VideoService — pattern nhất quán cho tất cả endpoints:
 *   DB first → miss/live → crawl → lưu DB → trả về
 */
import { Injectable } from "@nestjs/common";
import { AppException } from "@/base/errors/app.exception";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";
import {
  CrawlerClientService,
  CrawlerComment,
  CrawlerVideoDetail,
  CrawlerVideoResult,
} from "@/modules/crawler-client/crawler-client.service";
import type { CrawlerShort } from "@/modules/crawler-client/types";
import { AppLogger } from "@/base/logger/app-logger.service";
import { ElasticService } from "../elastic/elastic.service";

const LIVE_VIDEO_TTL = 60; // seconds
const LIVE_SEARCH_TTL = 30; // seconds

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crawler: CrawlerClientService,
    private readonly logger: AppLogger,
    private readonly elastic: ElasticService,
  ) {}

  async findOne(videoId: string) {
    const cached = await this.redis.get<object>(`video:live:${videoId}`);
    if (cached) return cached;

    const dbVideo = await this.prisma.video.findUnique({
      where: { id: videoId },
    });
    if (dbVideo && !dbVideo.isLiveContent) return dbVideo;

    this.logger.info("Fetching video from crawler", { videoId });
    const result = await this.crawler.getVideoDetail(videoId);
    return this._saveVideoDetail(videoId, result);
  }

  async getComments(videoId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const dbCount = await this.prisma.comment.count({
      where: { videoId, parentId: null },
    });

    if (dbCount > 0) {
      const comments = await this.prisma.comment.findMany({
        where: { videoId, parentId: null },
        include: { replies: true },
        orderBy: { crawledAt: "desc" },
        skip,
        take: limit,
      });
      return { videoId, total: dbCount, page, limit, comments };
    }

    this.logger.info("Fetching comments from crawler", { videoId });
    const crawled = await this.crawler.getComments(videoId, 1, 100);
    await this._saveComments(videoId, crawled);

    const comments = await this.prisma.comment.findMany({
      where: { videoId, parentId: null },
      include: { replies: true },
      orderBy: { crawledAt: "desc" },
      skip,
      take: limit,
    });
    return { videoId, total: crawled.length, page, limit, comments };
  }

  async listVideos(query?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    if (query) {
      const es = this.elastic.getClient();
      const res = await es.search({
        index: "videos",
        from: offset,
        size: limit,
        query: {
          multi_match: {
            query,
            fields: ["title^3", "channelName", "description"],
            fuzziness: "AUTO",
          },
        },
      });

      const hits = res.hits.hits;
      const total =
        typeof res.hits.total === "number"
          ? res.hits.total
          : (res.hits.total?.value ?? 0);

      return {
        total,
        page,
        limit,
        videos: hits.map((h) => h._source),
      };
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where: { isAvailable: true },
        skip: offset,
        take: limit,
        orderBy: { crawledAt: "desc" },
      }),
      this.prisma.video.count({ where: { isAvailable: true } }),
    ]);

    return { total, page, limit, videos };
  }

  async getShorts(page = 1, limit = 30) {
    const offset = (page - 1) * limit;

    const dbCount = await this.prisma.short.count({
      where: { isAvailable: true },
    });

    if (dbCount >= 10) {
      const shorts = await this.prisma.short.findMany({
        where: { isAvailable: true },
        skip: offset,
        take: limit,
        orderBy: { crawledAt: "desc" },
      });
      return { total: dbCount, page, limit, shorts };
    }

    this.logger.info("Fetching shorts from crawler");
    const crawled: CrawlerShort[] = await this.crawler.getShorts(50);

    for (const s of crawled) {
      if (!s.video_id) continue;
      const videoId = s.video_id;
      await this.prisma.short.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title: s.title || videoId,
          channelName: s.channel_name || null,
          viewCount: s.view_count ? BigInt(s.view_count) : null,
          thumbnails: s.thumbnails ?? [],
        },
        update: {
          title: s.title || videoId,
          channelName: s.channel_name || null,
          viewCount: s.view_count ? BigInt(s.view_count) : null,
          thumbnails: s.thumbnails ?? [],
        },
      });
    }

    const shorts = await this.prisma.short.findMany({
      where: { isAvailable: true },
      skip: offset,
      take: limit,
      orderBy: { crawledAt: "desc" },
    });
    return { total: crawled.length, page, limit, shorts };
  }

  async searchLive(query: string, page = 1, limit = 30) {
    const cacheKey = `live:search:${query}:${page}:${limit}`;
    const cached = await this.redis.get<object[]>(cacheKey);
    if (cached) return { videos: cached, fromCache: true };

    const videos = await this.crawler.getLiveVideos(query, page, limit);
    await this.redis.set(cacheKey, videos, LIVE_SEARCH_TTL);
    return { videos, fromCache: false };
  }

  private async _saveVideoDetail(videoId: string, result: CrawlerVideoResult) {
    if ("error" in result && result.error) {
      await this.prisma.video.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title: videoId,
          isAvailable: false,
          unavailableReason: result.reason,
        },
        update: { isAvailable: false, unavailableReason: result.reason },
      });
      throw AppException.notFound(
        `Video ${videoId} not found: ${result.reason}`,
      );
    }

    const d = result as CrawlerVideoDetail;
    const viewCount = d.views ? BigInt(d.views) : null;
    const durationSeconds = d.length_seconds ? Number(d.length_seconds) : null;
    const isLive = d.is_live_content ?? false;

    const video = await this.prisma.video.upsert({
      where: { id: videoId },
      create: {
        id: videoId,
        title: d.title,
        channelName: d.author,
        viewCount,
        durationSeconds,
        isLiveContent: isLive,
        isAvailable: true,
        detailCrawledAt: new Date(),
      },
      update: {
        title: d.title,
        channelName: d.author,
        viewCount,
        durationSeconds,
        isLiveContent: isLive,
        isAvailable: true,
        detailCrawledAt: new Date(),
      },
    });

    if (isLive) {
      await this.redis.set(`video:live:${videoId}`, video, LIVE_VIDEO_TTL);
    }

    return video;
  }

  private async _saveComments(videoId: string, comments: CrawlerComment[]) {
    for (const c of comments) {
      if (!c.comment_id) continue;
      await this.prisma.comment.upsert({
        where: { id: c.comment_id },
        create: {
          id: c.comment_id,
          videoId,
          author: c.author,
          avatar: c.avatar,
          content: c.content,
          likesCount: c.likes ?? 0,
          repliesCount: c.replies_count ?? 0,
          publishedTimeText: c.published_time,
        },
        update: {
          author: c.author,
          content: c.content,
          likesCount: c.likes ?? 0,
          repliesCount: c.replies_count ?? 0,
        },
      });

      for (const r of c.replies ?? []) {
        if (!r.comment_id) continue;
        await this.prisma.comment.upsert({
          where: { id: r.comment_id },
          create: {
            id: r.comment_id,
            videoId,
            parentId: c.comment_id,
            author: r.author,
            avatar: r.avatar,
            content: r.content,
            likesCount: r.likes ?? 0,
            publishedTimeText: r.published_time,
          },
          update: {
            author: r.author,
            content: r.content,
            likesCount: r.likes ?? 0,
          },
        });
      }
    }
  }
}
