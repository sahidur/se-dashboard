import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
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
    });

    if (createUserDto.roleIds?.length) {
      user.roles = await this.rolesRepository.findBy({ id: In(createUserDto.roleIds) });
    }

    return this.usersRepository.save(user);
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
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phone',
        'user.profilePicture',
        'user.isActive',
        'user.lastLoginAt',
        'user.createdAt',
        'role.id',
        'role.name',
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
      relations: ['roles', 'roles.permissions'],
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
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
      ...(updateUserDto.isActive !== undefined && {
        isActive: updateUserDto.isActive,
      }),
    });

    if (updateUserDto.roleIds) {
      user.roles = await this.rolesRepository.findBy({ id: In(updateUserDto.roleIds) });
    }

    return this.usersRepository.save(user);
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
    return { newPassword };
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.softRemove(user);
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
