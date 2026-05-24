import { Injectable } from "@nestjs/common";
import { Channel } from "@generated/prisma/client";
import { BasePrismaRepository } from "@/base/core/prisma/base-prisma.repository";
import { PrismaService } from "@/modules/prisma/prisma.service";

function parseSubscriberCount(text?: string | null): bigint | null {
  if (!text) return null;
  const t = text
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/subscribers?/i, "")
    .trim();
  const num = parseFloat(t);
  if (isNaN(num)) return null;
  if (t.endsWith("b")) return BigInt(Math.round(num * 1_000_000_000));
  if (t.endsWith("m")) return BigInt(Math.round(num * 1_000_000));
  if (t.endsWith("k")) return BigInt(Math.round(num * 1_000));
  return BigInt(Math.round(num));
}

@Injectable()
export class ChannelRepository extends BasePrismaRepository<Channel> {
  protected entityName = "Channel";

  constructor(private readonly prisma: PrismaService) {
    super(prisma.channel);
  }

  upsert(data: {
    id: string;
    name: string;
    handle?: string | null;
    avatar?: string | null;
    banner?: string | null;
    subscriberCountText?: string | null;
    description?: string | null;
  }) {
    const subscriberCount = parseSubscriberCount(data.subscriberCountText);
    return this.prisma.channel.upsert({
      where: { id: data.id },
      create: { ...data, subscriberCount },
      update: {
        name: data.name,
        handle: data.handle,
        avatar: data.avatar,
        banner: data.banner,
        subscriberCount,
        subscriberCountText: data.subscriberCountText,
        description: data.description,
        updatedAt: new Date(),
      },
    });
  }
}
