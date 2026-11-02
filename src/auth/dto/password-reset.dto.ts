import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @Length(3, 200)
  email: string;
}

export class ConfirmPasswordResetDto {
  /** Token from the e-mail link: 32 random bytes in base64url. */
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Link inválido ou expirado. Peça um novo.' })
  token: string;

  /** Same minimum as the login. */
  @IsString()
  @Length(12, 200)
  password: string;
}
