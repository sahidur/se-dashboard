import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { getAuditContext } from '../common/audit/audit-context';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOneByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.issueSession(user, 'password');
  }

  /**
   * Issues a JWT session for an already-authenticated user (used by both the
   * password login flow and the passkey login flow), updating the refresh
   * token + last-login timestamp and writing a LOGIN audit entry.
   */
  async issueSession(user: any, method: 'password' | 'passkey') {
    const tokens = await this.generateTokens(user);
    const fullUser = (await this.usersService.findOneById(user.id)) || user;

    // Update last login and refresh token
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);
    await this.usersService.updateLastLogin(user.id);
    const loginCtx = getAuditContext();
    await this.usersService.logActivity({
      action: 'LOGIN',
      module: 'auth',
      entityId: fullUser.id,
      userId: fullUser.id,
      ipAddress: loginCtx.ipAddress,
      userAgent: loginCtx.userAgent,
      newData: { email: fullUser.email, method },
    });

    return {
      user: {
        id: fullUser.id,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        email: fullUser.email,
        phone: fullUser.phone,
        profilePicture: fullUser.profilePicture,
        isActive: fullUser.isActive,
        lastLoginAt: fullUser.lastLoginAt,
        pin: fullUser.pin,
        designation: fullUser.designation,
        base: fullUser.base,
        geoLocationId: fullUser.geoLocationId,
        geoLocation: fullUser.geoLocation,
        schools: fullUser.schools,
        createdAt: fullUser.createdAt,
        updatedAt: fullUser.updatedAt,
        roles: (fullUser.roles || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          hierarchy: r.hierarchy,
          isActive: r.isActive,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          permissions: (r.permissions || []).map((p: any) => ({
            id: p.id,
            module: p.module,
            action: p.action,
          })),
        })),
      },
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto) {
    const existing = await this.usersService.findOneByEmail(registerDto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findOneById(payload.sub);
      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
      if (!isTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    const ctx = getAuditContext();
    await this.usersService.logActivity({
      action: 'LOGOUT',
      module: 'auth',
      entityId: userId,
      userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.usersService.updatePassword(userId, hashedPassword);
    const ctx = getAuditContext();
    await this.usersService.logActivity({
      action: 'CHANGE_PASSWORD',
      module: 'auth',
      entityId: userId,
      userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { message: 'Password changed successfully' };
  }

  private async generateTokens(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles?.map((r: any) => r.name) || [],
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!jwtSecret || !refreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
