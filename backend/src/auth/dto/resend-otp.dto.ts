import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class ResendOtpDto {
  /** Email address or phone number. */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
