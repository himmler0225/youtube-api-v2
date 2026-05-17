import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ShortVideoItem {
  @IsString()
  @IsNotEmpty()
  video_id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  channel_name?: string;

  @IsNumber()
  @IsOptional()
  view_count?: number;

  @IsInt()
  @IsOptional()
  duration?: number;

  @IsArray()
  @IsOptional()
  thumbnails?: Record<string, unknown>[];
}

export class IngestShortsDto {
  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShortVideoItem)
  videos: ShortVideoItem[];
}
