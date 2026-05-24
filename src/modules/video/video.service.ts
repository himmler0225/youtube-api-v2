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
import {
  AlgoliaService,
  ALGOLIA_VIDEO_INDEX,
} from "@/modules/algolia/algolia.service";

const LIVE_VIDEO_TTL = 60;
const LIVE_SEARCH_TTL = 30;

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crawler: CrawlerClientService,
    private readonly logger: AppLogger,
    private readonly algolia: AlgoliaService,
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

    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { isLiveContent: true },
    });
    if (video?.isLiveContent)
      return { videoId, total: 0, page, limit, comments: [] };

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
      return {
        videoId,
        total: dbCount,
        page,
        limit,
        comments: await this._enrichComments(comments),
      };
    }

    const crawlKey = `comments:crawled:${videoId}`;
    const alreadyTried = await this.redis.get<boolean>(crawlKey);
    if (alreadyTried) {
      return { videoId, total: 0, page, limit, comments: [] };
    }

    this.logger.info("Fetching comments from crawler", { videoId });
    try {
      const crawled = await this.crawler.getComments(videoId, 1, 100);
      await this._saveComments(videoId, crawled);
      await this.redis.set(crawlKey, true, 600);
    } catch (err) {
      this.logger.warn("Failed to fetch comments from crawler", {
        videoId,
        err: err instanceof Error ? err.message : String(err),
      });
      await this.redis.set(crawlKey, true, 600);
      return { videoId, total: 0, page, limit, comments: [] };
    }

    const comments = await this.prisma.comment.findMany({
      where: { videoId, parentId: null },
      include: { replies: true },
      orderBy: { crawledAt: "desc" },
      skip,
      take: limit,
    });
    return {
      videoId,
      total: comments.length,
      page,
      limit,
      comments: await this._enrichComments(comments),
    };
  }

  async listVideos(query?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    if (query) {
      try {
        const { hits, total } = await this.algolia.search(
          ALGOLIA_VIDEO_INDEX,
          query,
          { hitsPerPage: limit, page: page - 1 },
        );

        if (hits.length > 0) {
          return { total, page, limit, videos: hits };
        }
      } catch {
        this.logger.warn(
          "Algolia search failed — falling back to Postgres FTS",
          { query },
        );
      }

      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM videos
        WHERE tsv @@ plainto_tsquery('simple', ${query})
          AND is_available = true
        ORDER BY ts_rank(tsv, plainto_tsquery('simple', ${query})) DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const ids = rows.map((r) => r.id);
      const videos = await this.prisma.video.findMany({
        where: { id: { in: ids } },
      });
      return { total: ids.length, page, limit, videos };
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
      return {
        total: dbCount,
        page,
        limit,
        shorts: shorts.map((s) => ({
          ...s,
          url: `https://www.youtube.com/shorts/${s.id}`,
        })),
      };
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
          url: s.url,
          channelName: s.channel_name || null,
          viewCount: s.view_count ? BigInt(s.view_count) : null,
          thumbnails: s.thumbnails ?? [],
        },
        update: {
          title: s.title || videoId,
          url: s.url,
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
    return {
      total: crawled.length,
      page,
      limit,
      shorts: shorts.map((s) => ({
        ...s,
        url: `https://www.youtube.com/shorts/${s.id}`,
      })),
    };
  }

  async searchLive(query = "", page = 1, limit = 30) {
    const cacheKey = `live:search:${query}:${page}:${limit}`;
    const cached = await this.redis.get<object[]>(cacheKey);
    if (cached) return { videos: cached, fromCache: true };

    const videos = await this.crawler.getLiveVideos(query, page, limit);
    await this.redis.set(cacheKey, videos, LIVE_SEARCH_TTL);
    return { videos, fromCache: false };
  }

  async getRelatedVideos(videoId: string, limit = 10) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: {
        channelId: true,
        title: true,
        label: { select: { category: true } },
      },
    });

    const channelId = video?.channelId ?? null;
    const category = video?.label?.category ?? null;
    const title = video?.title ?? "";
    const results: { id: string }[] = [];

    const slotChannel = Math.ceil(limit * 0.4);
    const slotCategory = Math.ceil(limit * 0.4);

    const exclude = () => [videoId, ...results.map((v) => v.id)];

    if (channelId) {
      const rows = await this.prisma.video.findMany({
        where: { isAvailable: true, id: { not: videoId }, channelId },
        select: { id: true },
        take: slotChannel,
        orderBy: { crawledAt: "desc" },
      });
      results.push(...rows);
    }

    if (category && results.length < limit) {
      const rows = await this.prisma.video.findMany({
        where: {
          isAvailable: true,
          id: { notIn: exclude() },
          label: { category },
        },
        select: { id: true },
        take: slotCategory,
        orderBy: { crawledAt: "desc" },
      });
      results.push(...rows);
    }

    if (title && results.length < limit) {
      type Row = { id: string };
      const rows = await this.prisma.$queryRaw<Row[]>`
        SELECT v.id
        FROM videos v
        WHERE v.is_available = true
          AND v.id != ${videoId}
          AND v.id != ALL(${exclude()})
          AND v.tsv @@ plainto_tsquery('simple', ${title})
        ORDER BY ts_rank(v.tsv, plainto_tsquery('simple', ${title})) DESC
        LIMIT ${limit - results.length}
      `;
      results.push(...rows);
    }

    if (results.length < limit) {
      const rows = await this.prisma.video.findMany({
        where: { isAvailable: true, id: { notIn: exclude() } },
        select: { id: true },
        take: limit - results.length,
        orderBy: { crawledAt: "desc" },
      });
      results.push(...rows);
    }

    const ids = results.map((r) => r.id);
    const videos = await this.prisma.video.findMany({
      where: { id: { in: ids } },
    });

    const map = new Map(videos.map((v) => [v.id, v]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  async getChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw AppException.notFound(`Channel ${channelId} not found`);
    const videoCount = await this.prisma.video.count({
      where: { channelId, isAvailable: true },
    });
    return { ...channel, videoCount };
  }

  async getChannelVideos(channelId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where: { channelId, isAvailable: true },
        skip: offset,
        take: limit,
        orderBy: { crawledAt: "desc" },
      }),
      this.prisma.video.count({ where: { channelId, isAvailable: true } }),
    ]);
    return { total, page, limit, videos };
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

  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ category: string }>>`
      SELECT DISTINCT category FROM video_labels ORDER BY category
    `;
    return rows.map((r) => r.category);
  }

  private async _enrichComments(
    comments: { author: string; replies?: { author: string }[] }[],
  ) {
    const authors = new Set<string>();
    for (const c of comments) {
      authors.add(c.author);
      for (const r of c.replies ?? []) authors.add(r.author);
    }

    const users = await this.prisma.user.findMany({
      where: { displayName: { in: [...authors] } },
      select: { username: true, displayName: true },
    });

    const map = new Map(users.map((u) => [u.displayName, u.username]));

    return comments.map((c) => ({
      ...c,
      authorUsername: map.get(c.author) ?? null,
      replies: (c.replies ?? []).map((r) => ({
        ...r,
        authorUsername: map.get(r.author) ?? null,
      })),
    }));
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
