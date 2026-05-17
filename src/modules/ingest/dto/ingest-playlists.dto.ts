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

export class PlaylistItemDto {
  @IsString()
  @IsNotEmpty()
  playlistId!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsInt()
  @IsOptional()
  videoCount?: number;
}

export class IngestPlaylistsDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlaylistItemDto)
  playlists!: PlaylistItemDto[];
}
