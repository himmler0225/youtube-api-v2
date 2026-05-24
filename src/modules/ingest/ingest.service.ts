import { Injectable } from "@nestjs/common";
import { Prisma } from "@generated/prisma/client";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { ChannelRepository } from "./repositories/channel.repository";
import { VideoRepository } from "./repositories/video.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { QueueService } from "@/modules/queue/queue.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import {
  AlgoliaService,
  ALGOLIA_VIDEO_INDEX,
} from "@/modules/algolia/algolia.service";
import {
  IngestSearchDto,
  IngestDetailDto,
  IngestCommentsDto,
  IngestChannelDto,
  IngestTrendingDto,
  IngestShortsDto,
  IngestChannelVideosDto,
  IngestPlaylistsDto,
  IngestPlaylistItemsDto,
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
    private readonly algolia: AlgoliaService,
  ) {}

  // ── Channel ──────────────────────────────────────────────────────────────

  async ingestChannel(dto: IngestChannelDto) {
    const channel = await this.channelRepo.upsert({
      id: dto.channelId,
      name: dto.channelName,
      handle: dto.handle,
      avatar: dto.avatar,
      banner: dto.banner,
      subscriberCountText: dto.subscriberCount,
      description: dto.description,
    });

    this.logger.info("Channel ingested", { channelId: channel.id });
    return { channelId: channel.id };
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async ingestSearch(dto: IngestSearchDto) {
    const crawledAt = new Date();
    let saved = 0;

    for (const [index, video] of dto.videos.entries()) {
      const videoId = video.videoId;
      if (!videoId) continue;

      if (video.channelId && video.channel) {
        await this.channelRepo.upsert({
          id: video.channelId,
          name: video.channel,
        });
      }

      const upserted = await this.videoRepo.upsertFromCrawl({
        id: videoId,
        title: video.title ?? videoId,
        channelId: video.channelId || null,
        channelName: video.channel,
        viewCount: video.viewCount ? BigInt(video.viewCount) : null,
        durationText: video.duration,
        publishedTimeText: video.publishedTime,
        descriptionSnippet: video.descriptionSnippet,
        thumbnails: video.thumbnails as unknown as Prisma.InputJsonValue,
      });

      void this.algolia.indexData(ALGOLIA_VIDEO_INDEX, {
        id: upserted.id,
        title: upserted.title,
        channelId: upserted.channelId,
        channelName: upserted.channelName,
        description: upserted.descriptionSnippet,
        viewCount: upserted.viewCount ? Number(upserted.viewCount) : null,
        isAvailable: upserted.isAvailable,
        crawledAt: upserted.crawledAt,
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

      await this.queue.addCrawlDetail(videoId);
      saved++;
    }

    this.logger.info("Search results ingested", {
      query: dto.query,
      count: saved,
    });
    return { saved };
  }

  // ── Video Detail ──────────────────────────────────────────────────────────
  // Called by CrawlDetailProcessor, not directly by crawler batch jobs.
  // detail has two shapes: { error, reason } or { title, views, duration... }

  async ingestDetail(dto: IngestDetailDto) {
    const videoId = dto.videoId;

    if (dto.error) {
      await this.videoRepo.upsertFromDetail({
        id: videoId,
        title: dto.title ?? videoId,
        isAvailable: false,
        unavailableReason: dto.reason,
      });
      return { videoId, available: false };
    }

    const dtoTitle = dto.title;
    const dtoDescription = dto.description;
    const dtoChannelId = dto.channelId || null;
    const dtoAuthor = dto.author || null;
    const viewCount = dto.views ? BigInt(dto.views) : null;

    if (dtoChannelId && dtoAuthor) {
      await this.channelRepo.upsert({ id: dtoChannelId, name: dtoAuthor });
    }

    const detail = await this.videoRepo.upsertFromDetail({
      id: videoId,
      title: dtoTitle ?? videoId,
      channelId: dtoChannelId,
      channelName: dtoAuthor,
      viewCount,
      viewsText:
        viewCount != null
          ? `${Number(viewCount).toLocaleString("en-US")} views`
          : null,
      durationSeconds: dto.lengthSeconds ? Number(dto.lengthSeconds) : null,
      isLiveContent: dto.isLiveContent ?? false,
      isAvailable: true,
      descriptionSnippet: dtoDescription ?? null,
    });

    void this.algolia.indexData(ALGOLIA_VIDEO_INDEX, {
      id: detail.id,
      title: detail.title,
      channelId: detail.channelId,
      channelName: detail.channelName,
      description: detail.descriptionSnippet,
      viewCount: detail.viewCount ? Number(detail.viewCount) : null,
      isAvailable: detail.isAvailable,
      crawledAt: detail.crawledAt,
    });

    this.logger.info("Video detail ingested", { videoId });
    return { videoId, available: true };
  }

  // ── Trending ──────────────────────────────────────────────────────────────

  async ingestTrending(dto: IngestTrendingDto) {
    const crawledAt = new Date();
    let saved = 0;

    for (const [index, video] of dto.videos.entries()) {
      const videoId = video.videoId;
      if (!videoId) continue;

      if (video.channelId && video.channel) {
        await this.channelRepo.upsert({
          id: video.channelId,
          name: video.channel,
        });
      }

      const upsertedTrending = await this.videoRepo.upsertFromCrawl({
        id: videoId,
        title: video.title ?? videoId,
        channelId: video.channelId || null,
        channelName: video.channel,
        viewCount: video.viewCount ? BigInt(video.viewCount) : null,
        durationText: video.duration,
        publishedTimeText: video.publishedTime,
        thumbnails: video.thumbnails as unknown as Prisma.InputJsonValue,
      });

      void this.algolia.indexData(ALGOLIA_VIDEO_INDEX, {
        id: upsertedTrending.id,
        title: upsertedTrending.title,
        channelId: upsertedTrending.channelId,
        channelName: upsertedTrending.channelName,
        description: upsertedTrending.descriptionSnippet,
        viewCount: upsertedTrending.viewCount
          ? Number(upsertedTrending.viewCount)
          : null,
        isAvailable: upsertedTrending.isAvailable,
        crawledAt: upsertedTrending.crawledAt,
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

  // ── Shorts ───────────────────────────────────────────────────────────────
  // Writes to `shorts` table, not `videos` — no queue push needed.

  async ingestShorts(dto: IngestShortsDto) {
    let saved = 0;

    for (const video of dto.videos) {
      const videoId = video.videoId;
      if (!videoId) continue;

      const viewCount = video.viewCount ? BigInt(video.viewCount) : null;
      const durationSeconds = video.duration ? Number(video.duration) : null;
      const thumbnails =
        (video.thumbnails as Prisma.InputJsonValue) ?? Prisma.JsonNull;

      await this.prisma.short.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title: video.title || videoId,
          url: video.url ?? "",
          channelId: video.channelId ?? null,
          channelName: video.channelName ?? null,
          viewCount,
          durationSeconds,
          thumbnails,
        },
        update: {
          title: video.title || videoId,
          url: video.url ?? "",
          channelId: video.channelId ?? null,
          channelName: video.channelName ?? null,
          viewCount,
          durationSeconds,
          thumbnails,
          updatedAt: new Date(),
        },
      });

      saved++;
    }

    this.logger.info("Shorts ingested", { count: saved });
    return { saved };
  }

  // ── Channel Videos ───────────────────────────────────────────────────────
  // Saves channel videos to `videos` table and queues detail crawl per video.

  async ingestChannelVideos(dto: IngestChannelVideosDto) {
    let saved = 0;

    for (const video of dto.videos) {
      const videoId = video.videoId;
      if (!videoId) continue;

      const upserted = await this.videoRepo.upsertFromCrawl({
        id: videoId,
        title: video.title ?? videoId,
        channelId: dto.channelId,
        channelName: dto.channelName ?? null,
        viewCount: video.viewCount ? BigInt(video.viewCount) : null,
        durationText: video.duration ?? null,
        publishedTimeText: video.publishedTime ?? null,
        thumbnails:
          (video.thumbnails as unknown as Prisma.InputJsonValue) ??
          Prisma.JsonNull,
      });

      void this.algolia.indexData(ALGOLIA_VIDEO_INDEX, {
        id: upserted.id,
        title: upserted.title,
        channelId: upserted.channelId,
        channelName: upserted.channelName,
        description: upserted.descriptionSnippet,
        viewCount: upserted.viewCount ? Number(upserted.viewCount) : null,
        isAvailable: upserted.isAvailable,
        crawledAt: upserted.crawledAt,
      });

      await this.queue.addCrawlDetail(videoId);
      saved++;
    }

    this.logger.info("Channel videos ingested", {
      channelId: dto.channelId,
      count: saved,
    });
    return { saved };
  }

  // ── Playlists ─────────────────────────────────────────────────────────────
  // Saves playlist metadata to `playlists` table (no items — list-level only).

  async ingestPlaylists(dto: IngestPlaylistsDto) {
    let saved = 0;

    for (const p of dto.playlists) {
      const playlistId = p.playlistId;
      if (!playlistId) continue;

      const thumbnails = p.thumbnail ? [{ url: p.thumbnail }] : [];

      await this.prisma.playlist.upsert({
        where: { id: playlistId },
        create: {
          id: playlistId,
          channelId: dto.channelId,
          title: p.title || playlistId,
          videoCount: p.videoCount ?? null,
          thumbnails,
        },
        update: {
          title: p.title || playlistId,
          videoCount: p.videoCount ?? null,
          thumbnails,
          updatedAt: new Date(),
        },
      });

      saved++;
    }

    this.logger.info("Playlists ingested", {
      channelId: dto.channelId,
      count: saved,
    });
    return { saved };
  }

  // ── Playlist Items ────────────────────────────────────────────────────────

  async ingestPlaylistItems(dto: IngestPlaylistItemsDto) {
    const playlistId = dto.playlistId;
    const videos = dto.videos;

    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true },
    });
    if (!playlist) {
      this.logger.warn("ingestPlaylistItems: playlist not in DB, skipping", {
        playlistId,
      });
      return { saved: 0 };
    }

    let saved = 0;
    for (const v of videos) {
      const videoId = v.videoId;
      const title = v.title || videoId;
      const durationText = v.durationText;
      const publishedTimeText = v.publishedTimeText;
      const thumbnail = v.thumbnail;
      const position = v.position;

      await this.prisma.video.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title,
          durationText,
          publishedTimeText,
          thumbnails: thumbnail ? [{ url: thumbnail }] : [],
        },
        update: {},
      });

      await this.prisma.playlistItem.upsert({
        where: {
          playlistId_videoId: { playlistId, videoId },
        },
        create: { playlistId, videoId, position },
        update: { position },
      });
      saved++;
    }

    this.logger.info("Playlist items ingested", { playlistId, count: saved });
    return { saved };
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async ingestComments(dto: IngestCommentsDto) {
    const videoExists = await this.prisma.video.findUnique({
      where: { id: dto.videoId },
      select: { id: true },
    });
    if (!videoExists) {
      this.logger.warn("ingestComments: video not in DB, skipping", {
        videoId: dto.videoId,
      });
      return { saved: 0 };
    }

    let saved = 0;

    for (const comment of dto.comments) {
      const commentId = comment.commentId;
      if (!commentId) continue;

      await this.commentRepo.upsert({
        id: commentId,
        videoId: dto.videoId,
        author: comment.author,
        avatar: comment.avatar,
        content: comment.content,
        likesCount: comment.likes,
        repliesCount: comment.repliesCount,
        publishedTimeText: comment.publishedTime,
      });
      saved++;

      for (const reply of comment.replies ?? []) {
        const replyId = reply.commentId;
        if (!replyId) continue;

        await this.commentRepo.upsert({
          id: replyId,
          videoId: dto.videoId,
          parentId: commentId,
          author: reply.author,
          avatar: reply.avatar,
          content: reply.content,
          likesCount: reply.likes,
          publishedTimeText: reply.publishedTime,
        });
        saved++;
      }
    }

    this.logger.info("Comments ingested", {
      videoId: dto.videoId,
      count: saved,
    });
    return { saved };
  }
}
