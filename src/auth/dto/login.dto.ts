import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @Length(3, 200)
  email: string;

  @IsString()
  @Length(12, 200)
  password: string;
}
