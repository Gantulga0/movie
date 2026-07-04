import { IsString, Length, MinLength } from 'class-validator';

export class VerifyOtpDto {
  /** Email address or phone number the code was sent to. */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
