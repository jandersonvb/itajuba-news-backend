import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { AdminArticlesController } from './admin-articles.controller';
import { Article } from './article.entity';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { SitemapController } from './sitemap.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Article]), AuthModule, CategoriesModule],
  controllers: [ArticlesController, AdminArticlesController, SitemapController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
