import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ROLES_KEY, StaffSession } from './auth.constants';
import { AdminGuard } from './admin.guard';
import type { UserRole } from './user.entity';

/** Restricts a controller or route to logged-in staff with one of these roles (Bearer token). */
export const StaffOnly = (...roles: UserRole[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AdminGuard), ApiBearerAuth());

/** Restricts a controller or route to portal admins. */
export const AdminOnly = () => StaffOnly('admin');

/** Narrows the roles of one route inside a `@StaffOnly()` controller. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Portal id of the admin token validated by AdminGuard. */
export const AdminPortal = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => context.switchToHttp().getRequest().admin.portalId,
);

/** User id, portal and current role of the logged-in staff member. */
export const CurrentStaff = createParamDecorator(
  (_: unknown, context: ExecutionContext): StaffSession => context.switchToHttp().getRequest().admin,
);
