import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { hasInternalKey } from './internal-key.guard';

/**
 * Requests from the Next.js server all share one IP. When they carry the
 * shared INTERNAL_API_KEY, the limit applies to the visitor IP forwarded in
 * `x-client-ip`; trusted server-side reads without a visitor IP (cached SSR
 * fetches) are not limited. Requests without a valid key keep the socket IP.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  private clientIp(req: Record<string, any>) {
    const ip = req.headers?.['x-client-ip'];
    return typeof ip === 'string' && ip.length > 0 && ip.length <= 64 ? ip : null;
  }

  protected async shouldSkip(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    return hasInternalKey(req) && !this.clientIp(req);
  }

  protected async getTracker(req: Record<string, any>) {
    return (hasInternalKey(req) && this.clientIp(req)) || req.ip;
  }
}
