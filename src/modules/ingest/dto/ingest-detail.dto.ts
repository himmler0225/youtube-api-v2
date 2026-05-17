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
}
