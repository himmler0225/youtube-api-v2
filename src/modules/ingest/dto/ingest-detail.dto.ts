import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class IngestDetailDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsBoolean()
  @IsOptional()
  error?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsNumber()
  @IsOptional()
  views?: number;

  @IsNumber()
  @IsOptional()
  lengthSeconds?: number;

  @IsBoolean()
  @IsOptional()
  isLiveContent?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsArray()
  @IsOptional()
  thumbnails?: Record<string, unknown>[];
}
