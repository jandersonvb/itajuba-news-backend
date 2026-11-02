import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminPortal, StaffOnly } from '../auth/admin.decorators';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('Admin · Categories')
@StaffOnly('admin', 'editor')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.categories.listAll(portalId);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto, @AdminPortal() portalId: string) {
    return this.categories.create(dto, portalId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto, @AdminPortal() portalId: string) {
    return this.categories.update(id, dto, portalId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @AdminPortal() portalId: string) {
    return this.categories.remove(id, portalId);
  }
}
