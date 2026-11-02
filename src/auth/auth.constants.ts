import type { UserRole } from './user.entity';

/**
 * Lifetime of the admin JWT; the frontend session cookie uses the same value. A working day, so a
 * long article is not lost to an expired session on save. Deactivating the user or changing the
 * password still ends the session at once (AdminGuard checks `sessionVersion` on every request).
 */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

/** How long the link in the "forgot password" e-mail works. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** How long the "criar minha senha" link of an invitation works. */
export const INVITE_TTL_DAYS = 7;

/** Message of an invitation link that is unknown, used, replaced or expired (the frontend matches it). */
export const INVALID_INVITE = 'Convite inválido ou expirado. Peça um novo a um administrador.';

/** Claims signed into the JWT. The role is not trusted from here; the guard reads it from the database. */
export type AdminTokenPayload = { sub: string; portalId: string; ver: number };

/** Set by AdminGuard on the request: the token claims plus the user's current role. */
export type StaffSession = { sub: string; portalId: string; role: UserRole };

export const ROLES_KEY = 'staffRoles';
