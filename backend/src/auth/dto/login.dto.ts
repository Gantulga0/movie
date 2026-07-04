import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Email or phone number
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
