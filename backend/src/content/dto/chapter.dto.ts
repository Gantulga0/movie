import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  /** Plain text; paragraphs split on blank lines at render time.
   *  Optional for media-only chapters — the service enforces body OR media. */
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  body?: string;

  /** Per-chapter video (e.g. audio-story chapters are uploaded as video).
   *  Empty strings mean "no media" — the service maps them to null. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaR2Key?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(video\/.*)?$/)
  mediaMimeType?: string;
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

  /** Empty string allowed — converts a text chapter to media-only. */
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  body?: string;

  /** Empty string clears the media file (service maps "" → null). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaR2Key?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(video\/.*)?$/)
  mediaMimeType?: string;
}
