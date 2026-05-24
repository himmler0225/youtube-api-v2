import { Injectable } from "@nestjs/common";
import { AppException } from "@/base/errors/app.exception";
import { PrismaService } from "@/modules/prisma/prisma.service";

@Injectable()
export class PublicUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { displayName: username }] },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        createdAt: true,
      },
    });
    if (!user) throw AppException.notFound(`User @${username} not found`);

    const author = user.displayName ?? user.username;
    const [commentCount, likes] = await Promise.all([
      this.prisma.comment.count({ where: { author, parentId: null } }),
      this.prisma.comment.aggregate({
        where: { author },
        _sum: { likesCount: true },
      }),
    ]);

    return {
      ...user,
      stats: {
        commentCount,
        totalLikes: likes._sum.likesCount ?? 0,
      },
    };
  }

  async getComments(username: string, page = 1, limit = 20) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { displayName: username }] },
      select: { displayName: true, username: true },
    });
    if (!user) throw AppException.notFound(`User @${username} not found`);

    const author = user.displayName ?? user.username;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { author, parentId: null },
        include: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnails: true,
              channelName: true,
            },
          },
        },
        orderBy: { crawledAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where: { author, parentId: null } }),
    ]);

    return { total, page, limit, comments };
  }
}
