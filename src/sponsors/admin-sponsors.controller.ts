import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, AdminPortal } from '../auth/admin.decorators';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsor.dto';
import { SponsorsService } from './sponsors.service';

@ApiTags('Admin · Sponsors')
@AdminOnly()
@Controller('admin/sponsors')
export class AdminSponsorsController {
  constructor(private readonly sponsors: SponsorsService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.sponsors.listAll(portalId);
  }

  @Post()
  create(@Body() dto: CreateSponsorDto, @AdminPortal() portalId: string) {
    return this.sponsors.create(dto, portalId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSponsorDto, @AdminPortal() portalId: string) {
    return this.sponsors.update(id, dto, portalId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @AdminPortal() portalId: string) {
    return this.sponsors.remove(id, portalId);
  }
}
