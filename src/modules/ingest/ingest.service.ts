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
      thumbnails: (dto.thumbnails ?? null) as Prisma.InputJsonValue | null,
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

      const video = await this.prisma.video.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title,
          durationText,
          publishedTimeText,
          thumbnails: thumbnail ? [{ url: thumbnail }] : [],
        },
        update: {},
        select: { detailCrawledAt: true },
      });

      if (!video.detailCrawledAt) {
        await this.queue.addCrawlDetail(videoId);
      }

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

  async repairPlaylistVideos() {
    const orphaned = await this.prisma.$queryRaw<{ video_id: string }[]>`
      SELECT DISTINCT pi.video_id
      FROM playlist_items pi
      LEFT JOIN videos v ON v.id = pi.video_id
      WHERE v.id IS NULL
    `;

    const incomplete = await this.prisma.video.findMany({
      where: {
        playlistItems: { some: {} },
        detailCrawledAt: null,
      },
      select: { id: true },
    });

    const orphanIds = orphaned.map((r) => r.video_id);
    const incompleteIds = incomplete.map((v) => v.id);
    const allIds = [...new Set([...orphanIds, ...incompleteIds])];

    for (const videoId of orphanIds) {
      await this.prisma.video.upsert({
        where: { id: videoId },
        create: { id: videoId, title: videoId },
        update: {},
      });
    }

    for (const videoId of allIds) {
      await this.queue.addCrawlDetail(videoId);
    }

    this.logger.info("Playlist video repair queued", {
      orphaned: orphanIds.length,
      incomplete: incompleteIds.length,
      queued: allIds.length,
    });
    return {
      orphaned: orphanIds.length,
      incomplete: incompleteIds.length,
      queued: allIds.length,
    };
  }

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

  sync(): { status: string } {
    setImmediate(() => void this._runSync());
    return { status: "started" };
  }

  private async _runSync() {
    this.logger.info("[Sync] Starting post-collection sync");

    const repair = await this.repairPlaylistVideos();
    this.logger.info("[Sync] Repair done", repair);

    const MAX_WAIT_MS = 30 * 60_000;
    const POLL_INTERVAL_MS = 15_000;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      const counts = await this.queue.getCrawlQueueCounts();
      const pending =
        (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      this.logger.info("[Sync] Queue status", counts);
      if (pending === 0) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    const result = await this.cleanup();
    this.logger.info("[Sync] Cleanup done", result);
    this.logger.info("[Sync] Sync complete");
  }

  async cleanup() {
    const junkVideos = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT v.id
      FROM videos v
      WHERE v.channel_id IS NULL
        AND v.channel_name IS NULL
        AND v.detail_crawled_at IS NULL
    `;
    const junkIds = junkVideos.map((r) => r.id);

    let videosDeleted = 0;
    if (junkIds.length > 0) {
      await this.prisma.playlistItem.deleteMany({
        where: { videoId: { in: junkIds } },
      });
      const result = await this.prisma.video.deleteMany({
        where: { id: { in: junkIds } },
      });
      videosDeleted = result.count;

      for (const id of junkIds) {
        void this.algolia.deleteObject(ALGOLIA_VIDEO_INDEX, id);
      }
    }

    const orphanChannels = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id
      FROM channels c
      WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.channel_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM playlists p WHERE p.channel_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM shorts s WHERE s.channel_id = c.id)
    `;
    const orphanChannelIds = orphanChannels.map((r) => r.id);

    let channelsDeleted = 0;
    if (orphanChannelIds.length > 0) {
      const result = await this.prisma.channel.deleteMany({
        where: { id: { in: orphanChannelIds } },
      });
      channelsDeleted = result.count;
    }

    this.logger.info("Cleanup complete", { videosDeleted, channelsDeleted });
    return { videosDeleted, channelsDeleted };
  }
}
