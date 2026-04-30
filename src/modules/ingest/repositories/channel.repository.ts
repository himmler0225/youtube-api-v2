import { Injectable } from "@nestjs/common";
import { Channel } from "@generated/prisma/client";
import { BasePrismaRepository } from "@/base/core/prisma/base-prisma.repository";
import { PrismaService } from "@/modules/prisma/prisma.service";

@Injectable()
export class ChannelRepository extends BasePrismaRepository<Channel> {
  protected entityName = "Channel";

  constructor(private readonly prisma: PrismaService) {
    super(prisma.channel);
  }

  // Upsert — tạo mới nếu chưa có, cập nhật nếu đã có
  upsert(data: {
    id: string;
    name: string;
    handle?: string | null;
    avatar?: string | null;
    banner?: string | null;
    subscriberCountText?: string | null;
    description?: string | null;
  }) {
    return this.prisma.channel.upsert({
      where: { id: data.id },
      create: data,
      update: {
        name: data.name,
        handle: data.handle,
        avatar: data.avatar,
        banner: data.banner,
        subscriberCountText: data.subscriberCountText,
        description: data.description,
        updatedAt: new Date(),
      },
    });
  }
}
