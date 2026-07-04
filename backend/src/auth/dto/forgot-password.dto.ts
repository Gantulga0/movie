import { IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  /** Email address or phone number of the account. */
  @IsString()
  @MinLength(3)
  identifier!: string;
}
