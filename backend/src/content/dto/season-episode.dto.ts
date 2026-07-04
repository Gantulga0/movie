import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSeasonDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class CreateEpisodeDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
