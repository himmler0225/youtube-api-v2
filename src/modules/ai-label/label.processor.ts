import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { AppLogger } from "@/base/logger/app-logger.service";
import { AiLabelService } from "./ai-label.service";
import { LABEL_QUEUE } from "./ai-label.constants";

@Processor(LABEL_QUEUE, { concurrency: 1 })
export class LabelProcessor extends WorkerHost {
  constructor(
    private readonly ai: AiLabelService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    const { videoId } = job.data;

    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { title: true, descriptionSnippet: true },
    });

    if (!video) {
      this.logger.warn("[LabelWorker] Video not found", { videoId });
      return;
    }

    const result = await this.ai.classify(
      videoId,
      video.title,
      video.descriptionSnippet ?? undefined,
    );

    if (!result) return;

    await this.prisma.videoLabel.upsert({
      where: { videoId },
      create: {
        videoId,
        category: result.category,
        quality: result.quality,
      },
      update: {
        category: result.category,
        quality: result.quality,
        labeledAt: new Date(),
      },
    });

    this.logger.info("[LabelWorker] Labeled", {
      videoId,
      category: result.category,
      quality: result.quality,
    });
  }
}
