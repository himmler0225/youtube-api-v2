import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class IngestDetailDto {
  @IsString()
  @IsNotEmpty()
  video_id: string;

  // Nếu error=true → video không khả dụng
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
  length_seconds?: number;

  @IsBoolean()
  @IsOptional()
  is_live_content?: boolean;
}
