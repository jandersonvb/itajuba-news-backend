import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, AdminPortal } from '../auth/admin.decorators';
import { LeadsService } from './leads.service';

@ApiTags('Admin · Leads')
@AdminOnly()
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.leads.listAll(portalId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @AdminPortal() portalId: string) {
    return this.leads.remove(id, portalId);
  }
}
