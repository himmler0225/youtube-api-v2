import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AiLabelService } from "./ai-label.service";
import { LabelProcessor } from "./label.processor";
import { AppLogger } from "@/base/logger/app-logger.service";
import { LABEL_QUEUE } from "./ai-label.constants";

@Module({
  imports: [BullModule.registerQueue({ name: LABEL_QUEUE })],
  providers: [AiLabelService, LabelProcessor, AppLogger],
  exports: [AiLabelService],
})
export class AiLabelModule {}
