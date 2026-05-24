import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { AppLogger } from "@/base/logger/app-logger.service";
import { PrismaService } from "@/modules/prisma/prisma.service";
import {
  AI_CATEGORIES,
  VideoCategory,
  LABEL_QUEUE,
  GROQ_API_URL,
  GROQ_MODEL,
  GROQ_SYSTEM_PROMPT,
  GROQ_BATCH_SYSTEM_PROMPT,
} from "./ai-label.constants";

export interface ClassifyResult {
  category: VideoCategory;
  quality: number;
}

interface GroqChoice {
  message: { content: string };
}
interface GroqResponse {
  choices: GroqChoice[];
}

@Injectable()
export class AiLabelService {
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly prisma: PrismaService,
    @InjectQueue(LABEL_QUEUE) private readonly labelQueue: Queue,
  ) {
    this.apiKey = this.config.get<string>("GROQ_API_KEY") ?? "";
  }

  async classify(
    videoId: string,
    title: string,
    description?: string,
  ): Promise<ClassifyResult | null> {
    if (!this.apiKey) {
      this.logger.warn("[AiLabel] GROQ_API_KEY not set, skipping", { videoId });
      return null;
    }

    const userMsg = `Title: ${title}\nDescription: ${description?.slice(0, 500) ?? ""}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: GROQ_SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            temperature: 0.1,
            max_tokens: 60,
          }),
        });

        if (res.status === 429) {
          const delay = 30_000 * attempt;
          this.logger.warn("[AiLabel] Rate limited, retrying", {
            videoId,
            attempt,
            delayMs: delay,
          });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!res.ok) {
          this.logger.warn("[AiLabel] API error", {
            videoId,
            status: res.status,
          });
          return null;
        }

        const body = (await res.json()) as GroqResponse;
        const text = body.choices[0]?.message.content.trim() ?? "";
        const parsed = JSON.parse(text) as Partial<ClassifyResult>;

        const category = AI_CATEGORIES.includes(
          parsed.category as VideoCategory,
        )
          ? (parsed.category as VideoCategory)
          : "Other";

        const quality =
          typeof parsed.quality === "number" &&
          parsed.quality >= 0 &&
          parsed.quality <= 3
            ? Math.round(parsed.quality)
            : 2;

        return { category, quality };
      } catch (err) {
        this.logger.warn("[AiLabel] classify failed", {
          videoId,
          error: String(err),
        });
        return null;
      }
    }

    return null;
  }

  async backfill(batchSize = 500): Promise<{ queued: number; total: number }> {
    const unlabeled = await this.prisma.video.findMany({
      where: {
        isAvailable: true,
        detailCrawledAt: { not: null },
        label: null,
      },
      select: { id: true },
      take: batchSize,
      orderBy: { detailCrawledAt: "desc" },
    });

    const total = await this.prisma.video.count({
      where: {
        isAvailable: true,
        detailCrawledAt: { not: null },
        label: null,
      },
    });

    for (const { id } of unlabeled) {
      await this.labelQueue.add(
        "label",
        { videoId: id },
        {
          jobId: id,
          removeOnComplete: 200,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          delay: 3_000,
        },
      );
    }

    this.logger.info("[AiLabel] Backfill queued", {
      queued: unlabeled.length,
      remaining: total - unlabeled.length,
    });

    return { queued: unlabeled.length, total };
  }

  async backfillDirect(
    batchSize = 20,
  ): Promise<{ labeled: number; total: number; skipped: number }> {
    const videos = await this.prisma.video.findMany({
      where: { isAvailable: true, detailCrawledAt: { not: null }, label: null },
      select: { id: true, title: true, descriptionSnippet: true },
      take: batchSize,
      orderBy: { detailCrawledAt: "desc" },
    });

    const remaining = await this.prisma.video.count({
      where: { isAvailable: true, detailCrawledAt: { not: null }, label: null },
    });

    if (videos.length === 0) return { labeled: 0, total: 0, skipped: 0 };

    const userMsg = videos
      .map(
        (v, i) =>
          `${i + 1}. id="${v.id}" title="${v.title}" desc="${(v.descriptionSnippet ?? "").slice(0, 200)}"`,
      )
      .join("\n");

    let results: { id: string; category: string; quality: number }[] = [];

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: GROQ_BATCH_SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
          temperature: 0.1,
          max_tokens: videos.length * 40,
        }),
      });

      if (!res.ok) {
        this.logger.warn("[AiLabel] Batch API error", { status: res.status });
        return { labeled: 0, total: remaining, skipped: videos.length };
      }

      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = body.choices[0]?.message.content.trim() ?? "[]";
      results = JSON.parse(text) as typeof results;
    } catch (err) {
      this.logger.warn("[AiLabel] Batch classify failed", {
        error: String(err),
      });
      return { labeled: 0, total: remaining, skipped: videos.length };
    }

    let labeled = 0;
    let skipped = 0;

    for (const item of results) {
      const category = AI_CATEGORIES.includes(item.category as VideoCategory)
        ? (item.category as VideoCategory)
        : "Other";
      const quality =
        typeof item.quality === "number" &&
        item.quality >= 0 &&
        item.quality <= 3
          ? Math.round(item.quality)
          : 2;

      try {
        await this.prisma.videoLabel.upsert({
          where: { videoId: item.id },
          create: { videoId: item.id, category, quality },
          update: { category, quality, labeledAt: new Date() },
        });
        labeled++;
      } catch {
        skipped++;
      }
    }

    this.logger.info("[AiLabel] Batch labeled", {
      labeled,
      skipped,
      remaining: remaining - labeled,
    });
    return { labeled, total: remaining, skipped };
  }
}
