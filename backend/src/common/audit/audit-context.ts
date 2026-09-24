import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request store that carries the incoming Express request so the global
 * audit subscriber can attribute automatically-captured CRUD activity to the
 * authenticated user (and record their IP + browser) without every service
 * having to pass that context around manually.
 *
 * The request object is stored by reference. `req.user` is populated later by
 * the JWT passport strategy (during the guard phase, before the controller /
 * service runs its DB operations), so reading it lazily at log-time works.
 */
export const auditContextStorage = new AsyncLocalStorage<{ req: any }>();

export interface ResolvedAuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extracts the client IP.
 *
 * Express resolves req.ip using the same trust-proxy setting as the rate
 * limiter. Parsing X-Forwarded-For here independently would trust client-supplied
 * entries even when the configured proxy hop count does not trust them.
 */
function resolveIp(req: any): string | undefined {
  return req?.ip || req?.socket?.remoteAddress || undefined;
}

/** Resolves the current request's audit context, if any. */
export function getAuditContext(): ResolvedAuditContext {
  const store = auditContextStorage.getStore();
  const req = store?.req;
  if (!req) return {};
  return {
    userId: req.user?.id,
    ipAddress: resolveIp(req),
    userAgent: req.headers?.['user-agent'],
  };
}
