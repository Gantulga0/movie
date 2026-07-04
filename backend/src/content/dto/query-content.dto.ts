import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ContentStatus, ContentType } from '@prisma/client';

export class QueryContentDto {
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  /** Genre slug. */
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

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
