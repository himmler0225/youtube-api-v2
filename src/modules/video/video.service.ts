/**
 * VideoService — pattern nhất quán cho tất cả endpoints:
 *   DB first → miss/live → crawl → lưu DB → trả về
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CrawlerClientService,
  CrawlerComment,
  CrawlerVideoDetail,
  CrawlerVideoResult,
} from '../crawler-client/crawler-client.service';
import { AppLogger } from '../../base/logger/app-logger.service';

const LIVE_VIDEO_TTL = 60; // giây
const LIVE_SEARCH_TTL = 30; // giây

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crawler: CrawlerClientService,
    private readonly logger: AppLogger,
  ) {}

  // ── Video detail ──────────────────────────────────────────────────────────

  async findOne(videoId: string) {
    const cached = await this.redis.get<object>(`video:live:${videoId}`);
    if (cached) return cached;

    const dbVideo = await this.prisma.video.findUnique({
      where: { id: videoId },
    });
    if (dbVideo && !dbVideo.isLiveContent) return dbVideo;

    this.logger.info('Fetching video from crawler', { videoId });
    const result = await this.crawler.getVideoDetail(videoId);
    return this._saveVideoDetail(videoId, result);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async getComments(videoId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const dbCount = await this.prisma.comment.count({
      where: { videoId, parentId: null },
    });

    // Có trong DB → trả về từ DB (phân trang)
    if (dbCount > 0) {
      const comments = await this.prisma.comment.findMany({
        where: { videoId, parentId: null },
        include: { replies: true },
        orderBy: { crawledAt: 'desc' },
        skip,
        take: limit,
      });
      return { videoId, total: dbCount, page, limit, comments };
    }

    // Chưa có → crawl → lưu DB → trả trang đầu
    this.logger.info('Fetching comments from crawler', { videoId });
    const crawled = await this.crawler.getComments(videoId, 1, 100);
    await this._saveComments(videoId, crawled);

    const comments = await this.prisma.comment.findMany({
      where: { videoId, parentId: null },
      include: { replies: true },
      orderBy: { crawledAt: 'desc' },
      skip,
      take: limit,
    });
    return { videoId, total: crawled.length, page, limit, comments };
  }

  // ── List / Search ─────────────────────────────────────────────────────────

  async listVideos(query?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Full-text search via tsvector when query is provided
    if (query) {
      type VideoRow = {
        id: string;
        title: string;
        channelId: string | null;
        channelName: string | null;
        viewsText: string | null;
        durationText: string | null;
        publishedTimeText: string | null;
        viewCount: bigint | null;
        durationSeconds: number | null;
        isLiveContent: boolean;
        descriptionSnippet: string | null;
        thumbnails: unknown;
        isAvailable: boolean;
        unavailableReason: string | null;
        detailCrawledAt: Date | null;
        crawledAt: Date;
        updatedAt: Date;
      };
      type CountRow = { count: bigint };

      const [videos, countRows] = await Promise.all([
        this.prisma.$queryRaw<VideoRow[]>`
          SELECT * FROM "Video"
          WHERE "isAvailable" = true
            AND tsv @@ plainto_tsquery('simple', ${query})
          ORDER BY ts_rank(tsv, plainto_tsquery('simple', ${query})) DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        this.prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*) AS count FROM "Video"
          WHERE "isAvailable" = true
            AND tsv @@ plainto_tsquery('simple', ${query})
        `,
      ]);

      return {
        total: Number(countRows[0]?.count ?? 0),
        page,
        limit,
        videos,
      };
    }

    // No query — regular paginated list ordered by crawl time
    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where: { isAvailable: true },
        skip: offset,
        take: limit,
        orderBy: { crawledAt: 'desc' },
      }),
      this.prisma.video.count({ where: { isAvailable: true } }),
    ]);

    return { total, page, limit, videos };
  }

  // ── Trending ──────────────────────────────────────────────────────────────

  async getTrending(page = 1, limit = 20, category?: string) {
    // Lấy thời điểm crawl mới nhất
    const latest = await this.prisma.trendingSnapshot.findFirst({
      where: category ? { category } : undefined,
      orderBy: { crawledAt: 'desc' },
      select: { crawledAt: true },
    });

    if (!latest) return { total: 0, page, limit, videos: [] };

    const where: Prisma.TrendingSnapshotWhereInput = {
      crawledAt: latest.crawledAt,
      ...(category && { category }),
    };

    const [snapshots, total] = await Promise.all([
      this.prisma.trendingSnapshot.findMany({
        where,
        include: { video: true },
        orderBy: { rank: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trendingSnapshot.count({ where }),
    ]);

    return {
      total,
      page,
      limit,
      crawledAt: latest.crawledAt,
      videos: snapshots.map((s) => ({ rank: s.rank, ...s.video })),
    };
  }

  // ── Live search ───────────────────────────────────────────────────────────

  async searchLive(query: string, page = 1, limit = 30) {
    const cacheKey = `live:search:${query}:${page}:${limit}`;
    const cached = await this.redis.get<object[]>(cacheKey);
    if (cached) return { videos: cached, fromCache: true };

    const videos = await this.crawler.getLiveVideos(query, page, limit);
    await this.redis.set(cacheKey, videos, LIVE_SEARCH_TTL);
    return { videos, fromCache: false };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _saveVideoDetail(videoId: string, result: CrawlerVideoResult) {
    if ('error' in result && result.error) {
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
      throw new NotFoundException({ videoId, reason: result.reason });
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
