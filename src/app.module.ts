import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CategoriesModule } from './categories/categories.module';
import { InternalKeyGuard } from './common/internal-key.guard';
import { ClientThrottlerGuard } from './common/throttler.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { MediaModule } from './media/media.module';
import { PortalModule } from './portal/portal.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    // 120 requests per minute per IP and route; login and leads lower it to 5.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PortalModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    ArticlesModule,
    SponsorsModule,
    CampaignsModule,
    LeadsModule,
    MediaModule,
    UsersModule,
  ],
  // In this order: requests without the internal key are refused before they count for the rate limit.
  providers: [
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
  ],
})
export class AppModule {}
