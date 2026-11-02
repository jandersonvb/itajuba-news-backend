import { Equals, IsEmail, IsString, Length } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsEmail()
  @Length(3, 200)
  email: string;

  @IsString()
  @Length(2, 120)
  interest: string;

  @IsString()
  @Length(10, 2000)
  message: string;

  /** Consent to store the data and reply to the request (LGPD). */
  @Equals(true)
  consent: boolean;
}
