import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isProduction } from '../config';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** True when the request carries the INTERNAL_API_KEY shared with the Next.js server. */
export function hasInternalKey(req: { headers?: Record<string, unknown> }) {
  const expected = process.env.INTERNAL_API_KEY;
  const key = req.headers?.['x-internal-key'];
  return !!expected && typeof key === 'string' && timingSafeEqual(digest(key), digest(expected));
}

const DIRECT_ACCESS_KEY = 'directAccess';

/**
 * Route that answers without INTERNAL_API_KEY in production: the host's health check, and the
 * images the frontend proxies with a rewrite (which cannot add the key).
 */
export const DirectAccess = () => SetMetadata(DIRECT_ACCESS_KEY, true);

/**
 * In production the API only answers the Next.js server, which sends INTERNAL_API_KEY on every
 * call. The API may then have a public address (needed when the frontend runs on Vercel) without
 * anyone bypassing the portal, its origin checks or the per-visitor rate limit.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (!isProduction()) return true;
    const direct = this.reflector.getAllAndOverride<boolean>(DIRECT_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (direct || hasInternalKey(context.switchToHttp().getRequest())) return true;
    throw new ForbiddenException('Esta API só atende o portal (INTERNAL_API_KEY ausente ou diferente).');
  }
}
