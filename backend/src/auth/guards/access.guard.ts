import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../../common/decorators/permissions.decorator';
import { UsersService } from '../../users/users.service';

/**
 * Unified access guard that checks BOTH @Roles() and @Permissions() decorators.
 *
 * Logic:
 * - If neither @Roles nor @Permissions is present → ALLOW (open to authenticated users)
 * - Super Admin always passes
 * - If @Roles matches the user's role names (from JWT) → ALLOW
 * - If @Permissions matches the user's permission matrix (from DB) → ALLOW
 * - If both decorators are present, EITHER one passing is sufficient
 * - If decorator(s) present but none match → DENY
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No restrictions → allow any authenticated user
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    // Super Admin bypass — handle both string and object role formats
    const isSuperAdmin = user.roles?.some((r: any) =>
      typeof r === 'string' ? r === 'Super Admin' : r.name === 'Super Admin',
    );
    if (isSuperAdmin) {
      return true;
    }

    // Check role names from JWT (fast, no DB query)
    if (requiredRoles) {
      const hasRole = requiredRoles.some((role) =>
        user.roles?.some((r: any) =>
          typeof r === 'string' ? r === role : r.name === role,
        ),
      );
      if (hasRole) return true;
    }

    // Check permission matrix from DB (slower, full user load)
    if (requiredPermissions) {
      try {
        const fullUser = await this.usersService.findOneById(user.id);
        if (fullUser) {
          const userPermissions = fullUser.roles.flatMap(
            (role) => role.permissions || [],
          );
          const hasPermission = requiredPermissions.every((required) =>
            userPermissions.some(
              (perm) =>
                perm.module === required.module &&
                perm.action === required.action,
            ),
          );
          if (hasPermission) return true;
        }
      } catch {
        // If DB query fails, fall through to deny
      }
    }

    return false;
  }
}
