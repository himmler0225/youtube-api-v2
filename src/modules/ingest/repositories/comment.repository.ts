import { Injectable } from "@nestjs/common";
import { Comment } from "@generated/prisma/client";
import { BasePrismaRepository } from "@/base/core/prisma/base-prisma.repository";
import { PrismaService } from "@/modules/prisma/prisma.service";

@Injectable()
export class CommentRepository extends BasePrismaRepository<Comment> {
  protected entityName = "Comment";

  constructor(private readonly prisma: PrismaService) {
    super(prisma.comment);
  }

  upsert(data: {
    id: string;
    videoId: string;
    parentId?: string | null;
    author: string;
    avatar?: string | null;
    content: string;
    likesCount?: number;
    repliesCount?: number;
    publishedTimeText?: string | null;
  }) {
    return this.prisma.comment.upsert({
      where: { id: data.id },
      create: data,
      update: {
        author: data.author,
        avatar: data.avatar,
        content: data.content,
        likesCount: data.likesCount ?? 0,
        repliesCount: data.repliesCount ?? 0,
        publishedTimeText: data.publishedTimeText,
      },
    });
  }
}
