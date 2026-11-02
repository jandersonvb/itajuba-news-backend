import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentStaff, StaffOnly } from './admin.decorators';
import type { StaffSession } from './auth.constants';
import { AuthService } from './auth.service';
import { AcceptInviteDto, InviteTokenQuery } from './dto/invite.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @StaffOnly()
  me(@CurrentStaff() staff: StaffSession) {
    return this.auth.me(staff);
  }

  /** Always 204, whether or not the e-mail has an account. */
  @Post('forgot-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    await this.auth.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.resetPassword(dto);
  }

  /** First setup: `ready`, `invited` (with the masked e-mail of the invited admin) or `unconfigured`. */
  @Get('setup')
  setupStatus() {
    return this.auth.setupStatus();
  }

  /** Sends the first admin's invitation again. Always 204; it only goes to the configured ADMIN_EMAIL. */
  @Post('setup/resend')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendSetupInvite() {
    await this.auth.resendSetupInvite();
  }

  /** Name, e-mail and role of an invitation link, so the page can greet the person. */
  @Get('invite')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  inviteInfo(@Query() query: InviteTokenQuery) {
    return this.auth.inviteInfo(query.token);
  }

  /** Chooses the password of an invitation and returns the session, like the login. */
  @Post('accept-invite')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto);
  }
}
