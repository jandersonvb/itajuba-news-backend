import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { USER_ROLES, type UserRole } from '../../auth/user.entity';

const lowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name: string;

  @Transform(lowerTrim)
  @IsEmail()
  @Length(3, 200)
  email: string;

  @IsIn(USER_ROLES)
  role: UserRole;

  /**
   * Optional: without it the person is invited by e-mail and chooses their own (what the panel
   * does). Same minimum as the login.
   */
  @IsOptional()
  @IsString()
  @Length(12, 200)
  password?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}

export class ResetPasswordDto {
  @IsString()
  @Length(12, 200)
  password: string;
}
