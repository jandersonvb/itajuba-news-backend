import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, Length } from 'class-validator';
import { HTTP_URL, IsImageUrl } from '../../common/validation';

export class CreateSponsorDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsImageUrl()
  logoUrl?: string;

  @IsUrl(HTTP_URL)
  websiteUrl: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSponsorDto extends PartialType(CreateSponsorDto) {}
