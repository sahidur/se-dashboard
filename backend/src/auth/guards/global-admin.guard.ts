import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Coarse second factor for endpoints that affect every tenant:
 *  - system-wide activity-log reads (a leaked/over-granted `activity-logs:read`
 *    permission on a custom role must not expose every tenant's PII snapshots)
 *  - mutations of the global fee catalog (academic years / fee heads are
 *    single global rows — a school-level user flipping the active year or
 *    renaming a fee head would affect every tenant's billing)
 *
 * The fine-grained `@Permissions` check still runs in AccessGuard; this guard
 * additionally requires an admin-tier role. Role names are read live from the
 * DB on every request by JwtStrategy, so demotions take effect immediately.
 */
@Injectable()
export class GlobalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const roles: string[] = req.user?.roles ?? [];
    if (roles.includes('Super Admin') || roles.includes('Admin')) {
      return true;
    }
    throw new ForbiddenException(
      'Only Super Admin or Admin roles can perform this action',
    );
  }
}
