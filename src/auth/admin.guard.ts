import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortalService } from '../portal/portal.service';
import { AdminTokenPayload, ROLES_KEY, StaffSession } from './auth.constants';
import { User, UserRole } from './user.entity';

/**
 * Accepts a valid JWT issued for the current portal to a user that is still active, whose password
 * was not reset since, and whose current role is one of the route's roles (403 otherwise).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly portal: PortalService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    let user: User | null;
    try {
      const payload = await this.jwt.verifyAsync<AdminTokenPayload>(token, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.portalId !== 'string' || typeof payload.ver !== 'number')
        throw new Error('invalid payload');
      if (payload.portalId !== (await this.portal.current()).id) throw new Error('other portal');
      user = await this.users.findOneBy({ id: payload.sub, portalId: payload.portalId, active: true });
      if (!user) throw new Error('inactive user');
      if (payload.ver !== user.sessionVersion) throw new Error('password changed');
    } catch {
      throw new UnauthorizedException();
    }
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(user.role))
      throw new ForbiddenException('Seu perfil não tem acesso a esta área');
    req.admin = { sub: user.id, portalId: user.portalId, role: user.role } satisfies StaffSession;
    return true;
  }
}
