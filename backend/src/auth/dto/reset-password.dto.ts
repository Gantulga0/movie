import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** Email address or phone number the reset code was sent to. */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
