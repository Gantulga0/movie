import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContentStatus, ContentType, ReleaseStatus } from '@prisma/client';

export class CreateContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  /** Original (foreign) title shown next to the localized one. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalTitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ContentType)
  type!: ContentType;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsEnum(ReleaseStatus)
  releaseStatus?: ReleaseStatus;

  @IsOptional()
  @IsInt()
  @Min(1888)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ageRating?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  director?: string;

  // ---- Rental settings (admin-managed; backend is the source of truth) ----

  @IsOptional()
  @IsBoolean()
  isRentable?: boolean;

  /** One-time rental price in MNT. */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  rentalPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  rentalDurationHours?: number;

  @IsOptional()
  @IsBoolean()
  subscriptionIncluded?: boolean;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  backdropUrl?: string;

  @IsOptional()
  @IsString()
  trailerUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  cast?: string[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  /** Genre names; unknown ones are created on the fly. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  genres?: string[];
}
