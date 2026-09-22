import { Repository, In, ILike, Brackets } from 'typeorm';
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
import { PRIVILEGED_AUDIT_MODULES } from '../common/audit/privileged-modules';

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
  ): Promise<{
    isSuperAdmin: boolean;
    best: number;
    /** Granted permission keys: `${module}:${action}:${resource ?? ''}`
     * (empty resource segment = wildcard/umbrella grant). */
    permissionKeys: Set<string>;
  } | null> {
    if (!actorId) return null;
    const actor = await this.usersRepository.findOne({
      where: { id: actorId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!actor) return null;
    return this.userPower(actor);
  }

  private userPower(user: Pick<User, 'roles'>): {
    isSuperAdmin: boolean;
    best: number;
    permissionKeys: Set<string>;
  } {
    const isSuperAdmin = (user.roles || []).some((r) => r.name === 'Super Admin');
    const best = Math.min(
      ...(user.roles || []).map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY,
    );
    const permissionKeys = new Set(
      (user.roles || []).flatMap((r) =>
        ((r as any).permissions || []).map(
          (p: { module: string; action: string; resource?: string | null }) =>
            `${p.module}:${p.action}:${p.resource ?? ''}`,
        ),
      ),
    );
    return { isSuperAdmin, best, permissionKeys };
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
    actor: Awaited<ReturnType<UsersService['actorPower']>>,
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

  /**
   * "You cannot give what you don't have": every role being assigned must
   * carry only permissions the actor holds themself — exact resource grant or
   * an umbrella (resource-less) grant on the same module+action. Blocks
   * same-hierarchy escalation where an Admin assigns a peer-level role that
   * carries permissions beyond their own (e.g. after minting such a role or
   * having one injected into a lower-tier role).
   */
  private assertRolesWithinActorGrants(
    actor: Awaited<ReturnType<UsersService['actorPower']>>,
    rolesToAssign: Role[],
  ): void {
    if (!actor || actor.isSuperAdmin || !rolesToAssign.length) return;
    const perms = rolesToAssign.flatMap(
      (r) =>
        ((r as any).permissions || []) as Array<{
          module: string;
          action: string;
          resource?: string | null;
        }>,
    );
    if (!perms.length) return;
    const holds = (p: { module: string; action: string; resource?: string | null }) =>
      actor.permissionKeys.has(`${p.module}:${p.action}:${p.resource ?? ''}`) ||
      actor.permissionKeys.has(`${p.module}:${p.action}:`);
    if (!perms.every(holds)) {
      throw new ForbiddenException(
        'You cannot assign roles carrying permissions you do not hold yourself',
      );
    }
  }

  /** Roles must be loaded with `relations: ['permissions']` before calling. */
  private async findRolesWithPermissions(ids: string[]): Promise<Role[]> {
    if (!ids?.length) return [];
    return this.rolesRepository.find({
      where: { id: In(ids) },
      relations: ['permissions'],
    });
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
      // Fresh accounts start with a current token version.
      passwordChangedAt: new Date(),
      phone: createUserDto.phone,
      pin: createUserDto.pin,
      designation: createUserDto.designation,
      base: createUserDto.base,
      geoLocationId: createUserDto.geoLocationId,
      profilePicture: createUserDto.profilePicture,
    });

    if (createUserDto.roleIds?.length) {
      const roles = await this.findRolesWithPermissions(createUserDto.roleIds);
      // Prevent non-Super-Admins from creating users more powerful than
      // themselves, or granting permissions beyond their own.
      const actor = await this.actorPower(actorId);
      this.assertCanAssignRoles(actor, roles);
      this.assertRolesWithinActorGrants(actor, roles);
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
   * Serialize a User for a viewer who MAY see the PIN (the account owner or a
   * Super Admin). Returns a plain object because ClassSerializerInterceptor
   * only strips @Exclude() fields from class instances — so an explicit
   * field ALLOWLIST is used instead of a blacklist destructure: any sensitive
   * column added to the User entity later cannot silently leak through here.
   */
  private toSelfView(user: User): Record<string, any> {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
      pin: user.pin ?? null,
      designation: user.designation,
      base: user.base,
      geoLocationId: user.geoLocationId,
      geoLocation: user.geoLocation,
      schools: user.schools,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * GET /users/:id — detail view with PIN minimisation: the personal PIN is
   * only returned to the user themself or to a Super Admin. Other viewers
   * holding users:read (e.g. plain Admins) get the record without it.
   */
  async findOneForViewer(id: string, viewerId: string): Promise<Record<string, any> | null> {
    const user = await this.findOneById(id);
    if (!user) return null;
    if (user.id === viewerId) return this.toSelfView(user);
    const viewer = await this.usersRepository.findOne({
      where: { id: viewerId },
      relations: ['roles'],
    });
    const isSuperAdmin = viewer?.roles?.some((r) => r.name === 'Super Admin');
    if (!isSuperAdmin) {
      // The entity itself is safe: pin (like password/refreshToken) is
      // @Exclude()'d in the entity definition.
      return user as any;
    }
    return this.toSelfView(user);
  }

  /**
   * GET /users/me — the current user's own profile, including their own PIN
   * (only the owner may see it) but never the password/refresh hashes.
   */
  async findOneForSelf(id: string): Promise<Record<string, any> | null> {
    const user = await this.findOneById(id);
    if (!user) return null;
    return this.toSelfView(user);
  }

  /**
   * Lightweight lookup used by JwtStrategy on every request.
   * Fetches id, active flag, email, passwordChangedAt (token version) and
   * role names only (roles are re-read live so demotions take effect
   * immediately instead of at next token refresh).
   * Returns null if the user does not exist or is deactivated.
   */
  async findActiveUserById(
    id: string,
  ): Promise<(Pick<User, 'id' | 'isActive' | 'email' | 'passwordChangedAt'> & { roles: Role[] }) | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'isActive', 'email', 'passwordChangedAt'],
      relations: ['roles'],
    });
    if (!user || !user.isActive) return null;
    return user as (Pick<User, 'id' | 'isActive' | 'email' | 'passwordChangedAt'> & { roles: Role[] }) | null;
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
      newRoles = await this.findRolesWithPermissions(updateUserDto.roleIds);
      this.assertCanAssignRoles(actor, newRoles);
      this.assertRolesWithinActorGrants(actor, newRoles);
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

  async addSchools(userId: string, schoolIds: string[], actorId?: string): Promise<DcSchool[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['schools', 'roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // School access widens data-collection/monitoring visibility, so treat it
    // like any other target-user mutation: hierarchy guard applies.
    this.assertCanManageTarget(await this.actorPower(actorId), user.roles);
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

  async removeSchool(userId: string, schoolId: string, actorId?: string): Promise<DcSchool[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['schools', 'roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageTarget(await this.actorPower(actorId), user.roles);
    user.schools = (user.schools || []).filter((s) => s.id !== schoolId);
    await this.usersRepository.save(user);
    return user.schools;
  }

  async getActivity(userId: string, actorId?: string, limit = 50): Promise<AuditLog[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Same privileged-module filter as AuditService: a plain admin with
    // users:read must not see how the platform's roles/permissions were
    // configured via another user's (e.g. a Super Admin's) activity trail.
    const power = await this.actorPower(actorId);
    const isSuperAdmin = power?.isSuperAdmin ?? false;
    const qb = this.auditLogRepository.createQueryBuilder('log');
    // Brackets keep (A OR B) AND C precedence — without them TypeORM emits
    // "A OR B AND C", which would let the Role/Permission entries through.
    qb.where(
      new Brackets((w) => {
        w.where('log.userId = :userId', { userId }).orWhere(
          '(log.module = :module AND log.entityId = CAST(:userId AS varchar))',
          { module: 'users', userId },
        );
      }),
    );
    if (!isSuperAdmin) {
      qb.andWhere('log.module NOT IN (:...privileged)', {
        privileged: PRIVILEGED_AUDIT_MODULES,
      });
    }
    qb.orderBy('log.createdAt', 'DESC').take(limit);
    return qb.getMany();
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
    const changedAt = new Date();
    // Also revoke the refresh token: any session obtained before the reset
    // must not survive it. passwordChangedAt additionally invalidates every
    // outstanding ACCESS token (checked per request by JwtStrategy).
    await this.usersRepository.update(id, {
      password: hashedPassword,
      passwordChangedAt: changedAt,
      refreshToken: null as any,
    });
    await this.logActivity({
      action: 'RESET_PASSWORD',
      module: 'users',
      entityId: id,
      // userId is the affected account; record who performed the reset so
      // the log doesn't misattribute the action to the victim.
      userId: id,
      newData: actorId ? { resetByActorId: actorId } : undefined,
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

  async updatePassword(
    userId: string,
    hashedPassword: string,
    changedAt: Date = new Date(),
  ): Promise<void> {
    // passwordChangedAt acts as the token version: JwtStrategy compares the
    // `pwv` claim in every access token against this timestamp, killing
    // tokens issued before the change.
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      passwordChangedAt: changedAt,
    });
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
    const roles = await this.findRolesWithPermissions(roleIds);
    // Privilege escalation guard: non-Super-Admins cannot grant roles stronger
    // than their own, roles carrying permissions they don't hold themselves,
    // nor change the roles of more powerful users.
    const actor = await this.actorPower(actorId);
    this.assertCanManageTarget(actor, user.roles);
    this.assertCanAssignRoles(actor, roles);
    this.assertRolesWithinActorGrants(actor, roles);
    user.roles = roles;
    return this.usersRepository.save(user);
  }
}
