import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertHistoryDto {
  @IsString()
  contentId!: string;

  @IsOptional()
  @IsString()
  episodeId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsInt()
  @Min(0)
  progressSec!: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class UpsertRatingDto {
  @IsString()
  contentId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  review?: string;
}
