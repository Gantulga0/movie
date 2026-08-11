import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateChapterDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  /** Plain text; paragraphs split on blank lines at render time. */
  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  body!: string;
}

export class UpdateChapterDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  body?: string;
}
