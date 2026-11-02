import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffOnly } from '../auth/admin.decorators';
import type { StaffSession } from '../auth/auth.constants';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';

/** Every role; reporters are limited to their own drafts by ArticlesService. */
@ApiTags('Admin · Articles')
@StaffOnly()
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@CurrentStaff() staff: StaffSession) {
    return this.articles.listAll(staff);
  }

  @Post()
  create(@Body() dto: CreateArticleDto, @CurrentStaff() staff: StaffSession) {
    return this.articles.create(dto, staff);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto, @CurrentStaff() staff: StaffSession) {
    return this.articles.update(id, dto, staff);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffSession) {
    return this.articles.remove(id, staff);
  }
}
