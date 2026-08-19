import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** The RESET verify.mn session that proved phone ownership (must be VERIFIED). */
  @IsString()
  @MinLength(1)
  sessionId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
