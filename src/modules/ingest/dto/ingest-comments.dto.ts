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
  comment_id: string;

  @IsString()
  author: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  content: string;

  @IsNumber()
  @IsOptional()
  likes?: number;

  @IsString()
  @IsOptional()
  published_time?: string;
}

export class CommentItem {
  @IsString()
  comment_id: string;

  @IsString()
  author: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  content: string;

  @IsNumber()
  @IsOptional()
  likes?: number;

  @IsNumber()
  @IsOptional()
  replies_count?: number;

  @IsString()
  @IsOptional()
  published_time?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CommentReplyItem)
  replies?: CommentReplyItem[];
}

export class IngestCommentsDto {
  @IsString()
  @IsNotEmpty()
  video_id: string;

  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentItem)
  comments: CommentItem[];
}
