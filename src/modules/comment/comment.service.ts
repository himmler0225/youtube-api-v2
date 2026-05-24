import { Injectable } from "@nestjs/common";
import { AppException } from "@/base/errors/app.exception";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { AppLogger } from "@/base/logger/app-logger.service";

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async create(videoId: string, userId: string, content: string) {
    const [video, user] = await Promise.all([
      this.prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, username: true, avatar: true },
      }),
    ]);

    if (!video) throw AppException.notFound("Video not found");
    if (!user) throw AppException.notFound("User not found");

    const id = crypto.randomUUID();
    const author = user.displayName ?? user.username;

    const comment = await this.prisma.comment.create({
      data: {
        id,
        videoId,
        userId,
        author,
        avatar: user.avatar ?? null,
        content,
      },
    });

    this.logger.info("[Comment] Created", { commentId: id, videoId, userId });
    return { ...comment, authorUsername: user.username, liked: false };
  }

  async reply(commentId: string, userId: string, content: string) {
    const [parent, user] = await Promise.all([
      this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true, videoId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, username: true, avatar: true },
      }),
    ]);

    if (!parent) throw AppException.notFound("Comment not found");
    if (!user) throw AppException.notFound("User not found");

    const id = crypto.randomUUID();
    const author = user.displayName ?? user.username;

    const [reply] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          id,
          videoId: parent.videoId,
          parentId: commentId,
          userId,
          author,
          avatar: user.avatar ?? null,
          content,
        },
      }),
      this.prisma.comment.update({
        where: { id: commentId },
        data: { repliesCount: { increment: 1 } },
      }),
    ]);

    this.logger.info("[Comment] Reply created", {
      replyId: id,
      commentId,
      userId,
    });
    return { ...reply, authorUsername: user.username, liked: false };
  }

  async toggleLike(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!comment) throw AppException.notFound("Comment not found");

    const existing = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.commentLike.delete({
          where: { userId_commentId: { userId, commentId } },
        }),
        this.prisma.comment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.commentLike.create({ data: { userId, commentId } }),
      this.prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);
    return { liked: true };
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, parentId: true },
    });

    if (!comment) throw AppException.notFound("Comment not found");
    if (comment.userId !== userId)
      throw AppException.forbidden("Not your comment");

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      if (comment.parentId) {
        await tx.comment.update({
          where: { id: comment.parentId },
          data: { repliesCount: { decrement: 1 } },
        });
      }
    });

    return { deleted: true };
  }

  async getLikedCommentIds(userId: string, commentIds: string[]) {
    if (commentIds.length === 0) return new Set<string>();
    const likes = await this.prisma.commentLike.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true },
    });
    return new Set(likes.map((l) => l.commentId));
  }
}
