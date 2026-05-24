import { Module } from "@nestjs/common";
import { CommentController } from "./comment.controller";
import { CommentService } from "./comment.service";
import { AppLogger } from "@/base/logger/app-logger.service";

@Module({
  controllers: [CommentController],
  providers: [CommentService, AppLogger],
  exports: [CommentService],
})
export class CommentModule {}
