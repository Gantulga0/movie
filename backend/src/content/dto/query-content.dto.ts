import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ContentStatus, ContentType, ReleaseStatus } from '@prisma/client';

/** Supported list orderings. 'watched'/'rated' rank by activity volume. */
export const CONTENT_SORTS = ['new', 'year', 'title', 'watched', 'rated'] as const;
export type ContentSort = (typeof CONTENT_SORTS)[number];

export class QueryContentDto {
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  /** Genre slug. */
  @IsOptional()
  @IsString()
  genre?: string;

  /** Country of origin (exact match on Content.country). */
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  /** Exact release year. Takes precedence over yearFrom/yearTo. */
  @IsOptional()
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1888)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1888)
  @Max(2100)
  yearTo?: number;

  @IsOptional()
  @IsEnum(ReleaseStatus)
  releaseStatus?: ReleaseStatus;

  @IsOptional()
  @IsIn(CONTENT_SORTS)
  sort?: ContentSort;

  /** Admin-only filter; ignored on public routes. */
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
