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

/** Extracts the client IP, honouring a reverse-proxy `X-Forwarded-For` header. */
function resolveIp(req: any): string | undefined {
  const xff = req?.headers?.['x-forwarded-for'];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0];
    if (first) return first.trim();
  }
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
