import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { INVALID_INVITE } from '../auth.constants';

/** Token of the "criar minha senha" link: 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export class InviteTokenQuery {
  @Matches(TOKEN, { message: INVALID_INVITE })
  token: string;
}

export class AcceptInviteDto {
  @Matches(TOKEN, { message: INVALID_INVITE })
  token: string;

  /** Same minimum as the login. */
  @IsString()
  @Length(12, 200)
  password: string;

  /** The person may correct the name the admin typed in the invitation. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name?: string;
}
