import { Article } from '../articles/article.entity';
import { User } from '../auth/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Category } from '../categories/category.entity';
import { Lead } from '../leads/lead.entity';
import { Media } from '../media/media.entity';
import { Portal } from '../portal/portal.entity';
import { Sponsor } from '../sponsors/sponsor.entity';

/** Every entity of the app. Register new ones here and create a migration for them. */
export const entities = [Portal, User, Category, Article, Sponsor, Campaign, Lead, Media];
