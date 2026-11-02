import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { Campaign } from './campaign.entity';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign]), AuthModule, SponsorsModule],
  controllers: [CampaignsController, AdminCampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
