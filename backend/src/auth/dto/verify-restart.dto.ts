import { IsString, MinLength } from 'class-validator';

/** Ask for a fresh verify.mn session (MO-SMS "resend"). */
export class VerifyRestartDto {
  @IsString()
  @MinLength(1)
  sessionId!: string;
}
