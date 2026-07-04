import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  // Phone number is the account identifier. Accepts local and international
  // formats, e.g. 99112233 or +97699112233.
  @IsString()
  @Matches(/^\+?[0-9]{6,15}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  /** Optional extra contact; not required to sign up. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
