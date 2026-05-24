import { Controller, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IngestGuard } from "@/modules/ingest/ingest.guard";
import { AiLabelService } from "./ai-label.service";

@ApiTags("ai-label")
@UseGuards(IngestGuard)
@Controller("internal/ai-label")
export class AiLabelController {
  constructor(private readonly service: AiLabelService) {}

  @ApiOperation({ summary: "Queue unlabeled videos for AI classification" })
  @ApiQuery({ name: "batch", required: false })
  @Post("backfill")
  backfill(@Query("batch") batch?: string) {
    return this.service.backfill(batch ? Math.min(Number(batch), 2000) : 500);
  }

  @ApiOperation({
    summary:
      "Classify unlabeled videos directly in one batch Groq call (no queue)",
  })
  @ApiQuery({
    name: "batch",
    required: false,
    description: "Videos per call, default 20, max 50",
  })
  @Post("backfill-direct")
  backfillDirect(@Query("batch") batch?: string) {
    return this.service.backfillDirect(
      batch ? Math.min(Number(batch), 50) : 20,
    );
  }
}
