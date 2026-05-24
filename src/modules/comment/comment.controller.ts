import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import type { JwtUser } from "@/modules/auth/strategies/jwt.strategy";
import { CommentService } from "./comment.service";
import { CreateCommentDto, CreateReplyDto } from "./dto/comment.dto";

interface AuthRequest extends Request {
  user: JwtUser;
}

@ApiTags("comments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @ApiOperation({ summary: "Post a comment on a video" })
  @Post("videos/:videoId/comments")
  createComment(
    @Param("videoId") videoId: string,
    @Body() dto: CreateCommentDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.create(videoId, req.user.userId, dto.content);
  }

  @ApiOperation({ summary: "Reply to a comment" })
  @Post("comments/:commentId/replies")
  createReply(
    @Param("commentId") commentId: string,
    @Body() dto: CreateReplyDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.reply(commentId, req.user.userId, dto.content);
  }

  @ApiOperation({ summary: "Toggle like on a comment" })
  @Post("comments/:commentId/like")
  toggleLike(
    @Param("commentId") commentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.service.toggleLike(commentId, req.user.userId);
  }

  @ApiOperation({ summary: "Delete own comment" })
  @Delete("comments/:commentId")
  remove(@Param("commentId") commentId: string, @Request() req: AuthRequest) {
    return this.service.remove(commentId, req.user.userId);
  }
}
