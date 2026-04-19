import { Injectable } from '@nestjs/common';
import { Prisma, Video } from '../../../../generated/prisma/client';
import { BasePrismaRepository } from '../../../base/core/prisma/base-prisma.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VideoRepository extends BasePrismaRepository<Video> {
  protected entityName = 'Video';

  constructor(private readonly prisma: PrismaService) {
    super(prisma.video);
  }

  // Upsert từ trending/search — chỉ cập nhật text metrics
  upsertFromCrawl(data: {
    id: string;
    title: string;
    channelId?: string | null;
    channelName?: string | null;
    viewsText?: string | null;
    durationText?: string | null;
    publishedTimeText?: string | null;
    descriptionSnippet?: string | null;
    thumbnails?: Prisma.InputJsonValue;
    isLiveContent?: boolean;
  }) {
    return this.prisma.video.upsert({
      where: { id: data.id },
      create: {
        ...data,
        thumbnails: data.thumbnails ?? Prisma.JsonNull,
      },
      // Không ghi đè viewCount/durationSeconds (chính xác hơn, từ detail)
      update: {
        title: data.title,
        channelId: data.channelId,
        channelName: data.channelName,
        viewsText: data.viewsText,
        durationText: data.durationText,
        publishedTimeText: data.publishedTimeText,
        descriptionSnippet: data.descriptionSnippet,
        thumbnails: data.thumbnails ?? Prisma.JsonNull,
        updatedAt: new Date(),
      },
    });
  }

  // Upsert từ detail API — cập nhật metrics chính xác
  upsertFromDetail(data: {
    id: string;
    title: string;
    channelName?: string | null;
    viewCount?: bigint | null;
    durationSeconds?: number | null;
    isLiveContent?: boolean;
    isAvailable: boolean;
    unavailableReason?: string | null;
  }) {
    return this.prisma.video.upsert({
      where: { id: data.id },
      create: data,
      update: {
        title: data.title,
        channelName: data.channelName,
        viewCount: data.viewCount,
        durationSeconds: data.durationSeconds,
        isLiveContent: data.isLiveContent ?? false,
        isAvailable: data.isAvailable,
        unavailableReason: data.unavailableReason,
        detailCrawledAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
