import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { VideoQuality } from '@prisma/client';

/** Attach an uploaded video file (already in R2) to a movie or an episode. */
export class CreateVideoAssetDto {
  @IsOptional()
  @IsString()
  episodeId?: string;

  @IsEnum(VideoQuality)
  quality!: VideoQuality;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  r2Key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

export class CreateSubtitleDto {
  @IsOptional()
  @IsString()
  episodeId?: string;

  @IsString()
  @MaxLength(10)
  language!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  r2Key?: string;
}
