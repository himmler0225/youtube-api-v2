import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class IngestChannelDto {
  @IsString()
  @IsNotEmpty()
  channel_id: string;

  @IsString()
  @IsNotEmpty()
  channel_name: string;

  @IsString()
  @IsOptional()
  handle?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  banner?: string;

  @IsString()
  @IsOptional()
  subscriber_count?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
