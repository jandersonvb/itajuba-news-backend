import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';
import { HTTP_URL, IsImageUrl } from '../../common/validation';
import { CAMPAIGN_SLOTS, type CampaignSlot } from '../campaign.entity';

export class CreateCampaignDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsUUID()
  sponsorId: string;

  @IsIn(CAMPAIGN_SLOTS)
  slot: CampaignSlot;

  @IsImageUrl()
  imageUrl: string;

  @IsUrl(HTTP_URL)
  targetUrl: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
