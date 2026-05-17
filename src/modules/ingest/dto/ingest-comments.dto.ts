import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CommentReplyItem {
  @IsString()
  commentId!: string;

  @IsString()
  author!: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  content!: string;

  @IsNumber()
  @IsOptional()
  likes?: number;

  @IsString()
  @IsOptional()
  publishedTime?: string;
}

export class CommentItem {
  @IsString()
  commentId!: string;

  @IsString()
  author!: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  content!: string;

  @IsNumber()
  @IsOptional()
  likes?: number;

  @IsNumber()
  @IsOptional()
  repliesCount?: number;

  @IsString()
  @IsOptional()
  publishedTime?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CommentReplyItem)
  replies?: CommentReplyItem[];
}

export class IngestCommentsDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentItem)
  comments!: CommentItem[];
}
