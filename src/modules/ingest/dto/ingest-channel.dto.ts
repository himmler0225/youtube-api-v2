import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class IngestChannelDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsString()
  @IsNotEmpty()
  channelName!: string;

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
  subscriberCount?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
