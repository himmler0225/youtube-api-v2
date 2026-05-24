import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppLogger } from "@/base/logger/app-logger.service";
import { AiLabelService } from "./ai-label.service";
import { AiLabelController } from "./ai-label.controller";
import { LabelProcessor } from "./label.processor";
import { LABEL_QUEUE } from "./ai-label.constants";

@Module({
  imports: [BullModule.registerQueue({ name: LABEL_QUEUE })],
  controllers: [AiLabelController],
  providers: [AiLabelService, LabelProcessor, AppLogger],
  exports: [AiLabelService],
})
export class AiLabelModule {}
