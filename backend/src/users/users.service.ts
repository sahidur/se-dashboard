import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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
      password: createUserDto.password.startsWith('$2')
        ? createUserDto.password
        : await bcrypt.hash(createUserDto.password, 12),
      phone: createUserDto.phone,
      pin: createUserDto.pin,
      designation: createUserDto.designation,
      base: createUserDto.base,
      geoLocationId: createUserDto.geoLocationId,
      profilePicture: createUserDto.profilePicture,
    });

    if (createUserDto.roleIds?.length) {
      user.roles = await this.rolesRepository.findBy({ id: In(createUserDto.roleIds) });
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
        'user.pin',
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
      user.roles = await this.rolesRepository.findBy({ id: In(updateUserDto.roleIds) });
    }

    if (updateUserDto.schoolIds) {
      user.schools = await this.schoolsRepository.findBy({ id: In(updateUserDto.schoolIds) });
    }

    const saved = await this.usersRepository.save(user);
    // Update activity is recorded automatically by the global audit subscriber.
    return saved;
  }

  async setStatus(id: string, isActive: boolean, actorId?: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
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

  async resetPassword(id: string): Promise<{ newPassword: string }> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
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
    await this.usersRepository.update(id, { password: hashedPassword });
    await this.logActivity({
      action: 'RESET_PASSWORD',
      module: 'users',
      entityId: id,
      userId: id,
    });
    return { newPassword };
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
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

  async assignRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.roles = await this.rolesRepository.findBy({ id: In(roleIds) });
    return this.usersRepository.save(user);
  }
}
