import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class TrendingVideoItem {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  rank?: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsNumber()
  @IsOptional()
  viewCount?: number;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  publishedTime?: string;

  @IsArray()
  @IsOptional()
  thumbnails?: Record<string, unknown>[];
}

export class IngestTrendingDto {
  @IsString()
  @IsOptional()
  category?: string;

  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrendingVideoItem)
  videos!: TrendingVideoItem[];
}
