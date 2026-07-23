import { IsString, Matches } from 'class-validator';

export class StartVerificationDto {
  // Same shape the auth flow accepts: optional +, 6-16 digits. verify.mn itself
  // requires 8-16 bare digits; the service normalizes and re-validates.
  @IsString()
  @Matches(/^\+?[0-9]{6,16}$/, { message: 'Утасны дугаар буруу байна' })
  phone!: string;
}
