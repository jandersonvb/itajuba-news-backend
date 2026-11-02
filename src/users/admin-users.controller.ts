import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, AdminPortal, CurrentStaff } from '../auth/admin.decorators';
import type { StaffSession } from '../auth/auth.constants';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Admin · Users')
@AdminOnly()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.users.listAll(portalId);
  }

  /** Without `password`, the person is invited by e-mail; `inviteSent` tells whether it left. */
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentStaff() staff: StaffSession) {
    return this.users.create(dto, staff.portalId, staff.sub);
  }

  /** "Reenviar convite" for someone who has not chosen a password yet; the old link stops working. */
  @Post(':id/invite')
  @HttpCode(200)
  resendInvite(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffSession) {
    return this.users.resendInvite(id, staff.portalId, staff.sub);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentStaff() staff: StaffSession) {
    return this.users.update(id, dto, staff.portalId, staff.sub);
  }

  @Patch(':id/password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @AdminPortal() portalId: string,
  ) {
    return this.users.resetPassword(id, dto.password, portalId);
  }
}
