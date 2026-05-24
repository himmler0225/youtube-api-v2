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

export class PlaylistVideoItemDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  position!: number;

  @IsString()
  @IsOptional()
  durationText?: string;

  @IsString()
  @IsOptional()
  publishedTimeText?: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;
}

export class IngestPlaylistItemsDto {
  @IsString()
  @IsNotEmpty()
  playlistId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlaylistVideoItemDto)
  videos!: PlaylistVideoItemDto[];
}
