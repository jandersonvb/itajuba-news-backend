import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@Query() query: ListArticlesQueryDto) {
    return this.articles.listPublished(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articles.findPublished(slug);
  }
}
