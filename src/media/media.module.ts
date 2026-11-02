import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/article.entity';
import { AuthModule } from '../auth/auth.module';
import { Campaign } from '../campaigns/campaign.entity';
import { Sponsor } from '../sponsors/sponsor.entity';
import { AdminMediaController } from './admin-media.controller';
import { MediaController } from './media.controller';
import { Media } from './media.entity';
import { MediaService } from './media.service';
import { MediaStorage } from './media.storage';

@Module({
  imports: [TypeOrmModule.forFeature([Media, Article, Sponsor, Campaign]), AuthModule],
  controllers: [MediaController, AdminMediaController],
  providers: [MediaService, MediaStorage],
})
export class MediaModule {}
