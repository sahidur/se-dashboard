import { Repository, In, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/entities/role.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { AuditLog } from '../common/entities/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(DcSchool)
    private schoolsRepository: Repository<DcSchool>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  // ===================== Privilege-hierarchy helpers =====================
  // Role.hierarchy: lower number = more powerful ('Super Admin' = 0). These
  // guards stop holders of `users:update` / `users:create` from escalating to
  // (or tampering with) privileges at or above their own level.

  /**
   * The acting user's power: Super Admin flag + best (lowest) hierarchy.
   * Returns null when there is no actor context (CLI seeding and other
   * internal/system callers) — guards treat that as trusted system access,
   * while every HTTP controller passes the real authenticated actor.
   */
  private async actorPower(
    actorId?: string,
  ): Promise<{ isSuperAdmin: boolean; best: number } | null> {
    if (!actorId) return null;
    const actor = await this.usersRepository.findOne({
      where: { id: actorId },
      relations: ['roles'],
    });
    if (!actor) return null;
    return this.userPower(actor);
  }

  private userPower(user: Pick<User, 'roles'>): {
    isSuperAdmin: boolean;
    best: number;
  } {
    const isSuperAdmin = (user.roles || []).some((r) => r.name === 'Super Admin');
    const best = Math.min(
      ...(user.roles || []).map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY,
    );
    return { isSuperAdmin, best };
  }

  private targetBestHierarchy(roles?: Role[] | null): number {
    if (!roles?.length) return Number.POSITIVE_INFINITY;
    return Math.min(
      ...roles.map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
    );
  }

  /**
   * A non-Super-Admin actor may not manage (edit/deactivate/reset/delete)
   * users whose strongest role is more powerful than the actor's own.
   */
  private assertCanManageTarget(
    actor: { isSuperAdmin: boolean; best: number } | null,
    targetRoles?: Role[] | null,
  ): void {
    if (!actor || actor.isSuperAdmin) return;
    const targetBest = this.targetBestHierarchy(targetRoles);
    if (targetBest < actor.best) {
      throw new ForbiddenException(
        'You cannot manage users who have more privileges than you',
      );
    }
  }

  /**
   * A non-Super-Admin actor may not grant roles that are more powerful than
   * the actor's own strongest role.
   */
  private assertCanAssignRoles(
    actor: { isSuperAdmin: boolean; best: number } | null,
    rolesToAssign: Role[],
  ): void {
    if (!actor || actor.isSuperAdmin || !rolesToAssign.length) return;
    const assignedBest = this.targetBestHierarchy(rolesToAssign);
    if (assignedBest < actor.best) {
      throw new ForbiddenException(
        'You cannot assign roles with more privileges than your own',
      );
    }
  }

  async logActivity(params: {
    action: string;
    module: string;
    entityId?: string;
    userId?: string;
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const log = this.auditLogRepository.create(params);
    await this.auditLogRepository.save(log);
  }

  async create(createUserDto: CreateUserDto, actorId?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const user = this.usersRepository.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      // Always hash. Previously a value starting with '$2' was stored verbatim
      // as an "already hashed" shortcut, which silently persisted any password
      // beginning with those characters in plaintext.
      password: await bcrypt.hash(createUserDto.password, 12),
      phone: createUserDto.phone,
      pin: createUserDto.pin,
      designation: createUserDto.designation,
      base: createUserDto.base,
      geoLocationId: createUserDto.geoLocationId,
      profilePicture: createUserDto.profilePicture,
    });

    if (createUserDto.roleIds?.length) {
      const roles = await this.rolesRepository.findBy({ id: In(createUserDto.roleIds) });
      // Prevent non-Super-Admins from creating users more powerful than themselves.
      this.assertCanAssignRoles(await this.actorPower(actorId), roles);
      user.roles = roles;
    }

    if (createUserDto.schoolIds?.length) {
      user.schools = await this.schoolsRepository.findBy({ id: In(createUserDto.schoolIds) });
    }

    const saved = await this.usersRepository.save(user);
    // Activity is recorded automatically by the global audit subscriber.
    return saved;
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    searchName?: string,
    searchPhone?: string,
    searchEmail?: string,
  ) {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.geoLocation', 'geoLocation')
      .leftJoinAndSelect('geoLocation.parent', 'geoLocationParent')
      .leftJoinAndSelect('geoLocationParent.parent', 'geoLocationGrandparent')
      .leftJoinAndSelect('geoLocationGrandparent.parent', 'geoLocationGreatGrandparent')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phone',
        'user.profilePicture',
        // NOTE: user.pin is deliberately NOT selected here — personal
        // identifiers are not part of admin listing output.
        'user.designation',
        'user.base',
        'user.isActive',
        'user.lastLoginAt',
        'user.createdAt',
        'role.id',
        'role.name',
        'geoLocation.id',
        'geoLocation.name',
        'geoLocation.type',
        'geoLocationParent.id',
        'geoLocationParent.name',
        'geoLocationParent.type',
        'geoLocationGrandparent.id',
        'geoLocationGrandparent.name',
        'geoLocationGrandparent.type',
        'geoLocationGreatGrandparent.id',
        'geoLocationGreatGrandparent.name',
        'geoLocationGreatGrandparent.type',
      ]);

    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (search) {
      conditions.push(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
      );
      params.search = `%${search}%`;
    }
    if (searchName) {
      conditions.push(
        '(user.firstName ILIKE :searchName OR user.lastName ILIKE :searchName)',
      );
      params.searchName = `%${searchName}%`;
    }
    if (searchPhone) {
      conditions.push('user.phone ILIKE :searchPhone');
      params.searchPhone = `%${searchPhone}%`;
    }
    if (searchEmail) {
      conditions.push('user.email ILIKE :searchEmail');
      params.searchEmail = `%${searchEmail}%`;
    }

    if (conditions.length > 0) {
      query.where(conditions.join(' AND '), params);
    }

    query.orderBy('user.createdAt', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: [
        'roles',
        'roles.permissions',
        'geoLocation',
        'geoLocation.parent',
        'geoLocation.parent.parent',
        'geoLocation.parent.parent.parent',
        'schools',
      ],
    });
  }

  /**
   * GET /users/:id — detail view with PIN minimisation: the personal PIN is
   * only returned to the user themself or to a Super Admin. Other viewers
   * holding users:read (e.g. plain Admins) get the record without it.
   */
  async findOneForViewer(id: string, viewerId: string): Promise<User | null> {
    const user = await this.findOneById(id);
    if (!user) return null;
    if (user.id === viewerId) return user;
    const viewer = await this.usersRepository.findOne({
      where: { id: viewerId },
      relations: ['roles'],
    });
    const isSuperAdmin = viewer?.roles?.some((r) => r.name === 'Super Admin');
    if (!isSuperAdmin) {
      const { pin, ...withoutPin } = user;
      void pin;
      return withoutPin as User;
    }
    return user;
  }

  /**
   * Lightweight lookup used by JwtStrategy on every request.
   * Only fetches id and isActive to minimise the query cost.
   * Returns null if the user does not exist or is deactivated.
   */
  async findActiveUserById(id: string): Promise<Pick<User, 'id' | 'isActive'> | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'isActive'],
    });
    if (!user || !user.isActive) return null;
    return user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, actorId?: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Privilege guard: non-Super-Admins cannot edit more powerful users, nor
    // grant them stronger roles.
    const actor = await this.actorPower(actorId);
    this.assertCanManageTarget(actor, user.roles);
    let newRoles: Role[] | undefined;
    if (updateUserDto.roleIds) {
      newRoles = await this.rolesRepository.findBy({ id: In(updateUserDto.roleIds) });
      this.assertCanAssignRoles(actor, newRoles);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    Object.assign(user, {
      ...(updateUserDto.firstName && { firstName: updateUserDto.firstName }),
      ...(updateUserDto.lastName && { lastName: updateUserDto.lastName }),
      ...(updateUserDto.email && { email: updateUserDto.email }),
      ...(updateUserDto.phone !== undefined && { phone: updateUserDto.phone }),
      ...(updateUserDto.pin !== undefined && { pin: updateUserDto.pin }),
      ...(updateUserDto.designation !== undefined && {
        designation: updateUserDto.designation,
      }),
      ...(updateUserDto.base !== undefined && { base: updateUserDto.base }),
      ...(updateUserDto.geoLocationId !== undefined && {
        geoLocationId: updateUserDto.geoLocationId,
      }),
      ...(updateUserDto.profilePicture !== undefined && {
        profilePicture: updateUserDto.profilePicture,
      }),
      ...(updateUserDto.isActive !== undefined && {
        isActive: updateUserDto.isActive,
      }),
    });

    if (updateUserDto.roleIds) {
      user.roles = newRoles!;
    }

    if (updateUserDto.schoolIds) {
      user.schools = await this.schoolsRepository.findBy({ id: In(updateUserDto.schoolIds) });
    }

    const saved = await this.usersRepository.save(user);
    // Update activity is recorded automatically by the global audit subscriber.
    return saved;
  }

  async setStatus(id: string, isActive: boolean, actorId?: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Non-Super-Admins cannot deactivate/activate more powerful users.
    this.assertCanManageTarget(await this.actorPower(actorId), user.roles);
    user.isActive = isActive;
    const saved = await this.usersRepository.save(user);
    // Status change is recorded automatically by the global audit subscriber.
    return saved;
  }

  async getSchools(userId: string): Promise<DcSchool[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['schools'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.schools || [];
  }

  /**
   * Schools available to assign to a user, sourced from the real Data
   * Collection school registry (dc_schools), with optional search + geo
   * (division/district/upazila) filters used by the assign-schools UI.
   */
  async findAvailableSchools(filters: {
    search?: string;
    division?: string;
    district?: string;
    upazila?: string;
  }): Promise<DcSchool[]> {
    const query = this.schoolsRepository.createQueryBuilder('school');

    if (filters.search?.trim()) {
      query.andWhere(
        '(school.name ILIKE :search OR school.code ILIKE :search)',
        { search: `%${filters.search.trim()}%` },
      );
    }
    if (filters.division?.trim()) {
      query.andWhere('school.division ILIKE :division', {
        division: `%${filters.division.trim()}%`,
      });
    }
    if (filters.district?.trim()) {
      query.andWhere('school.district ILIKE :district', {
        district: `%${filters.district.trim()}%`,
      });
    }
    if (filters.upazila?.trim()) {
      query.andWhere('school.upazila ILIKE :upazila', {
        upazila: `%${filters.upazila.trim()}%`,
      });
    }

    query.orderBy('school.name', 'ASC');
    return query.getMany();
  }

  async addSchools(userId: string, schoolIds: string[]): Promise<DcSchool[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['schools'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const newSchools = await this.schoolsRepository.findBy({ id: In(schoolIds) });
    const existingIds = new Set((user.schools || []).map((s) => s.id));
    const merged = [...(user.schools || [])];
    for (const school of newSchools) {
      if (!existingIds.has(school.id)) {
        merged.push(school);
        existingIds.add(school.id);
      }
    }
    user.schools = merged;
    await this.usersRepository.save(user);
    return user.schools;
  }

  async removeSchool(userId: string, schoolId: string): Promise<DcSchool[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['schools'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.schools = (user.schools || []).filter((s) => s.id !== schoolId);
    await this.usersRepository.save(user);
    return user.schools;
  }

  async getActivity(userId: string, limit = 50): Promise<AuditLog[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId })
      .orWhere('(log.module = :module AND log.entityId = CAST(:userId AS varchar))', {
        module: 'users',
        userId,
      })
      .orderBy('log.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async resetPassword(id: string, actorId?: string): Promise<{ newPassword: string }> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Privilege escalation guard: resetting a more powerful user's password
    // would hand their account to the caller.
    this.assertCanManageTarget(await this.actorPower(actorId), user.roles);
    // Use cryptographically secure random bytes
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const specials = '@#$!';
    const allChars = chars + upper + specials;
    const randomValues = randomBytes(12);
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += allChars[randomValues[i] % allChars.length];
    }
    // Ensure at least one uppercase and one special
    const upIdx = randomBytes(1)[0] % 12;
    const spIdx = randomBytes(1)[0] % 12;
    const pwArr = newPassword.split('');
    pwArr[upIdx] = upper[randomBytes(1)[0] % upper.length];
    pwArr[spIdx] = specials[randomBytes(1)[0] % specials.length];
    newPassword = pwArr.join('');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // Also revoke the refresh token: any session obtained before the reset
    // must not survive it.
    await this.usersRepository.update(id, {
      password: hashedPassword,
      refreshToken: null as any,
    });
    await this.logActivity({
      action: 'RESET_PASSWORD',
      module: 'users',
      entityId: id,
      userId: id,
    });
    return { newPassword };
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Non-Super-Admins cannot delete more powerful users.
    this.assertCanManageTarget(await this.actorPower(actorId), user.roles);
    await this.usersRepository.softRemove(user);
    // Deletion is recorded automatically by the global audit subscriber.
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    const hashedToken = refreshToken
      ? await bcrypt.hash(refreshToken, 12)
      : null;
    await this.usersRepository.update(userId, { refreshToken: hashedToken as any });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { lastLoginAt: new Date() });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, { password: hashedPassword });
  }

  async updateProfilePicture(
    userId: string,
    profilePicture: string,
  ): Promise<void> {
    await this.usersRepository.update(userId, { profilePicture });
  }

  async assignRoles(userId: string, roleIds: string[], actorId?: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const roles = await this.rolesRepository.findBy({ id: In(roleIds) });
    // Privilege escalation guard: non-Super-Admins cannot grant roles stronger
    // than their own, nor change the roles of more powerful users.
    const actor = await this.actorPower(actorId);
    this.assertCanManageTarget(actor, user.roles);
    this.assertCanAssignRoles(actor, roles);
    user.roles = roles;
    return this.usersRepository.save(user);
  }
}
