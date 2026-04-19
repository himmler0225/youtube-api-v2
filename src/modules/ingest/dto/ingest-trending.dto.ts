import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrendingVideoItem {
  @IsString()
  video_id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  channel_name?: string;

  @IsString()
  @IsOptional()
  views?: string;

  @IsString()
  @IsOptional()
  published_time?: string;

  @IsOptional()
  thumbnail?: object;
}

export class IngestTrendingDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrendingVideoItem)
  videos: TrendingVideoItem[];
}
