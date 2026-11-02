import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';

/**
 * Not under /articles: `GET /articles/sitemap` would hide an article with the slug "sitemap".
 */
@ApiTags('Articles')
@Controller('sitemap')
export class SitemapController {
  constructor(private readonly articles: ArticlesService) {}

  /** Slug, title, publication and last update of every published article, for sitemap.xml and the news sitemap. */
  @Get()
  list() {
    return this.articles.sitemap();
  }
}
