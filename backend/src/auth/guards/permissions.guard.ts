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
      userPermissions.some(
        (perm) =>
          perm.module === required.module && perm.action === required.action,
      ),
    );
  }
}
