import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ChannelVideoItem {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
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

export class IngestChannelVideosDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsString()
  @IsOptional()
  channelName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChannelVideoItem)
  videos!: ChannelVideoItem[];
}
