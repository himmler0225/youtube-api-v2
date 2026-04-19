import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchVideoItem {
  @IsString()
  video_id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  channel_id?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  views?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  published_time?: string;

  @IsString()
  @IsOptional()
  description_snippet?: string;

  @IsArray()
  @IsOptional()
  thumbnails?: object[];
}

export class IngestSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchVideoItem)
  videos: SearchVideoItem[];
}
