import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Campaign } from '../campaigns/campaign.entity';
import { AdminSponsorsController } from './admin-sponsors.controller';
import { SponsorsController } from './sponsors.controller';
import { Sponsor } from './sponsor.entity';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sponsor, Campaign]), AuthModule],
  controllers: [SponsorsController, AdminSponsorsController],
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
