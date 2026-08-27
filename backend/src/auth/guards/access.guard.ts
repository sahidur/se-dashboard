import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../../common/decorators/permissions.decorator';
import { UsersService } from '../../users/users.service';

/**
 * Unified access guard that checks @Roles() and @Permissions() decorators.
 *
 * Logic:
 * - If neither @Roles nor @Permissions is present -> ALLOW (open to authenticated users)
 * - Super Admin always passes
 * - If only @Roles exists -> user must match one required role
 * - If only @Permissions exists -> user must satisfy AT LEAST ONE required permission (OR).
 *   Passing multiple permission objects to a single @Permissions(...) call lets a route be
 *   reachable via any one of several granular modules (e.g. the broad 'data-collection' module
 *   OR the narrower 'programme-overview' module), without requiring every module at once.
 * - If BOTH decorators exist -> user must pass EITHER check (role match OR granted permission).
 *   @Roles here acts as a hardcoded fallback allowlist (e.g. built-in Admin roles), while
 *   @Permissions is what lets custom roles configured in Role Management gain access purely
 *   via granted module permissions, without also needing one of the hardcoded role names.
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
    let roleCheckPassed = false;
    if (requiredRoles) {
      roleCheckPassed = requiredRoles.some((role) =>
        user.roles?.some((r: any) =>
          typeof r === 'string' ? r === role : r.name === role,
        ),
      );
    }

    // Check permission matrix from DB (slower, full user load)
    let permissionCheckPassed = false;
    if (requiredPermissions) {
      try {
        const fullUser = await this.usersService.findOneById(user.id);
        if (fullUser) {
          const userPermissions = fullUser.roles.flatMap(
            (role) => role.permissions || [],
          );
          // OR semantics: passing granted with ANY one of the required permissions.
          permissionCheckPassed = requiredPermissions.some((required) =>
            userPermissions.some((perm) => {
              if (
                perm.module !== required.module ||
                perm.action !== required.action
              ) {
                return false;
              }
              // Requirement without a specific resource (e.g. umbrella
              // "list" endpoints) is satisfied by ANY grant on module+action,
              // wildcard or form-scoped.
              if (!required.resource) {
                return true;
              }
              // Requirement for a specific resource (e.g. a data-collection
              // form key) needs an exact grant or a wildcard (resource-less)
              // grant — a form-scoped grant must NOT satisfy other forms.
              return !perm.resource || perm.resource === required.resource;
            }),
          );
        }
      } catch (err) {
        console.error('[AccessGuard] Failed to load user permissions:', err);
        permissionCheckPassed = false;
      }
    }

    if (requiredRoles && requiredPermissions) {
      return roleCheckPassed || permissionCheckPassed;
    }

    if (requiredRoles) {
      return roleCheckPassed;
    }

    if (requiredPermissions) {
      return permissionCheckPassed;
    }

    return false;
  }
}
