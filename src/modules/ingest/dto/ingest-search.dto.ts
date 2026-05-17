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

export class SearchVideoItem {
  @IsString()
  videoId!: string;

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

  @IsString()
  @IsOptional()
  descriptionSnippet?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsOptional()
  thumbnails?: Record<string, unknown>[];
}

export class IngestSearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsString()
  @IsOptional()
  sort?: string;

  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchVideoItem)
  videos!: SearchVideoItem[];
}
