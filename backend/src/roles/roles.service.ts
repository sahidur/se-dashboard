import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const existing = await this.rolesRepository.findOne({
      where: { name: createRoleDto.name },
    });
    if (existing) {
      throw new ConflictException('Role name already exists');
    }

    const role = this.rolesRepository.create({
      name: createRoleDto.name,
      description: createRoleDto.description,
      hierarchy: createRoleDto.hierarchy || 0,
    });

    const savedRole = await this.rolesRepository.save(role);

    if (createRoleDto.permissions?.length) {
      const permissions = createRoleDto.permissions.map((p) =>
        this.permissionsRepository.create({
          module: p.module,
          action: p.action,
          roleId: savedRole.id,
        }),
      );
      savedRole.permissions = await this.permissionsRepository.save(permissions);
    }

    return savedRole;
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({
      relations: ['permissions'],
      order: { hierarchy: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['permissions', 'users'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existing = await this.rolesRepository.findOne({
        where: { name: updateRoleDto.name },
      });
      if (existing) {
        throw new ConflictException('Role name already exists');
      }
    }

    Object.assign(role, {
      ...(updateRoleDto.name && { name: updateRoleDto.name }),
      ...(updateRoleDto.description !== undefined && {
        description: updateRoleDto.description,
      }),
      ...(updateRoleDto.hierarchy !== undefined && {
        hierarchy: updateRoleDto.hierarchy,
      }),
    });

    if (updateRoleDto.permissions) {
      // Remove existing permissions
      await this.permissionsRepository.delete({ roleId: id });

      // Create new permissions
      const permissions = updateRoleDto.permissions.map((p) =>
        this.permissionsRepository.create({
          module: p.module,
          action: p.action,
          roleId: id,
        }),
      );
      role.permissions = await this.permissionsRepository.save(permissions);
    }

    return this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    await this.rolesRepository.remove(role);
  }

  async seedDefaultRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Full access to all features',
        hierarchy: 0,
        permissions: [
          { module: 'dashboard', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'users', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'surveys', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'categories', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'school-records', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'geo-locations', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'admin-tools', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'assigned-surveys', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'data-collection', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'programme-overview', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'school-information', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'activity-logs', actions: ['create', 'read', 'update', 'delete'] },
        ],
      },
      {
        name: 'Admin',
        description: 'Manages users, roles, surveys, and categories',
        hierarchy: 1,
        permissions: [
          { module: 'dashboard', actions: ['read'] },
          { module: 'users', actions: ['create', 'read', 'update'] },
          { module: 'roles', actions: ['create', 'read', 'update'] },
          { module: 'surveys', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'categories', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'school-records', actions: ['read', 'update'] },
          { module: 'geo-locations', actions: ['create', 'read', 'update'] },
          { module: 'admin-tools', actions: ['create', 'read', 'update'] },
          { module: 'assigned-surveys', actions: ['read'] },
          { module: 'data-collection', actions: ['create', 'read', 'update', 'delete'] },
          { module: 'programme-overview', actions: ['read'] },
          { module: 'school-information', actions: ['read'] },
          { module: 'activity-logs', actions: ['read'] },
        ],
      },
      {
        name: 'Survey Creator',
        description: 'Can create and manage surveys',
        hierarchy: 2,
        permissions: [
          { module: 'surveys', actions: ['create', 'read', 'update'] },
          { module: 'categories', actions: ['read'] },
          { module: 'school-records', actions: ['read'] },
          { module: 'assigned-surveys', actions: ['read'] },
          { module: 'data-collection', actions: ['create', 'read', 'update'] },
          { module: 'programme-overview', actions: ['read'] },
        ],
      },
      {
        name: 'School Admin',
        description: 'Can view and manage school-related info',
        hierarchy: 3,
        permissions: [
          { module: 'dashboard', actions: ['read'] },
          { module: 'school-records', actions: ['create', 'read', 'update'] },
          { module: 'geo-locations', actions: ['read'] },
          { module: 'assigned-surveys', actions: ['read'] },
          { module: 'data-collection', actions: ['create', 'read', 'update'] },
          { module: 'school-information', actions: ['read'] },
        ],
      },
      {
        name: 'Teacher',
        description: 'Can respond to surveys assigned to them',
        hierarchy: 4,
        permissions: [
          { module: 'surveys', actions: ['read'] },
          { module: 'school-records', actions: ['read'] },
          { module: 'assigned-surveys', actions: ['read'] },
        ],
      },
      {
        name: 'Alumni',
        description: 'Can respond to surveys or view specific reports',
        hierarchy: 5,
        permissions: [
          { module: 'surveys', actions: ['read'] },
          { module: 'assigned-surveys', actions: ['read'] },
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      const existing = await this.rolesRepository.findOne({
        where: { name: roleData.name },
        relations: ['permissions'],
      });

      const ensurePermissions = async (roleId: string, current: Permission[]) => {
        const existingKeys = new Set(
          (current || []).map((p) => `${p.module}:${p.action}`),
        );
        const missing: Permission[] = [];

        for (const perm of roleData.permissions) {
          for (const action of perm.actions) {
            const key = `${perm.module}:${action}`;
            if (!existingKeys.has(key)) {
              missing.push(
                this.permissionsRepository.create({
                  module: perm.module,
                  action: action as any,
                  roleId,
                }),
              );
            }
          }
        }

        if (missing.length) {
          await this.permissionsRepository.save(missing);
        }
      };

      if (!existing) {
        const role = await this.rolesRepository.save(
          this.rolesRepository.create({
            name: roleData.name,
            description: roleData.description,
            hierarchy: roleData.hierarchy,
          }),
        );
        await ensurePermissions(role.id, []);
      } else {
        await ensurePermissions(existing.id, existing.permissions || []);
      }
    }
  }
}
