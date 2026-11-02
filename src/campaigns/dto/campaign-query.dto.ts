import { IsIn, IsOptional } from 'class-validator';
import { CAMPAIGN_SLOTS, type CampaignSlot } from '../campaign.entity';

export class CampaignQueryDto {
  @IsOptional()
  @IsIn(CAMPAIGN_SLOTS)
  slot: CampaignSlot = 'leaderboard';
}
