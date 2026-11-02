import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, AdminPortal } from '../auth/admin.decorators';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Admin · Campaigns')
@AdminOnly()
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.campaigns.listAll(portalId);
  }

  @Post()
  create(@Body() dto: CreateCampaignDto, @AdminPortal() portalId: string) {
    return this.campaigns.create(dto, portalId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto, @AdminPortal() portalId: string) {
    return this.campaigns.update(id, dto, portalId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @AdminPortal() portalId: string) {
    return this.campaigns.remove(id, portalId);
  }
}
