import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../../common/decorators/permissions.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions) {
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

    // Fetch user with full role and permission data
    const fullUser = await this.usersService.findOneById(user.id);
    if (!fullUser) {
      return false;
    }

    const userPermissions = fullUser.roles.flatMap(
      (role) => role.permissions || [],
    );

    return requiredPermissions.every((required) =>
      userPermissions.some((perm) => {
        if (perm.module !== required.module || perm.action !== required.action) {
          return false;
        }
        // Requirement without a specific resource (e.g. umbrella "list" or
        // navigation endpoints) is satisfied by ANY grant on module+action,
        // wildcard or form-scoped — per-form restriction applies at the
        // form endpoints themselves.
        if (!required.resource) {
          return true;
        }
        // Requirement for a specific resource needs an exact match or a
        // wildcard (resource-less) grant.
        return !perm.resource || perm.resource === required.resource;
      }),
    );
  }
}
