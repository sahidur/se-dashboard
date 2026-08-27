import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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

  // ===================== Brute-force / enumeration defences =====================

  /** Consecutive failed passwords allowed per account before a temporary lockout. */
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  /** How long an account stays locked after hitting the failure threshold. */
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;
  /** Cap on tracked identities so attackers can't grow the map unboundedly. */
  private static readonly MAX_TRACKED_IDENTITIES = 10_000;

  /** Keyed by normalised email: { consecutiveFailures, lockedUntil }. */
  private failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  /**
   * Lazily-created dummy bcrypt hash. When the login email doesn't exist we
   * still run a full cost-12 compare against this hash so both paths take
   * ~the same wall time — otherwise the fast "unknown user" path leaks which
   * emails have accounts (timing-based account enumeration).
   */
  private dummyHash: string | null = null;

  private async timingSafeDummyCompare(password: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
    }
    await bcrypt.compare(password, this.dummyHash);
  }

  private normalizeEmailKey(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * During an active lockout every attempt is rejected uniformly ("Invalid
   * credentials") so the lockout itself cannot be used as an account-
   * existence oracle. Legitimate users locked out by an attacker must wait
   * out the window or ask an admin to reset their password.
   */
  private async enforceLockout(key: string, password: string): Promise<void> {
    const entry = this.failedLogins.get(key);
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      await this.timingSafeDummyCompare(password);
      throw new UnauthorizedException('Invalid credentials');
    }
    // Lockout expired: reset the counter so a fresh attack starts from zero.
    if (entry?.lockedUntil && entry.lockedUntil <= Date.now()) {
      this.failedLogins.delete(key);
    }
  }

  private recordFailedLogin(key: string): void {
    // Bound memory usage under identity-spraying attacks.
    if (
      !this.failedLogins.has(key) &&
      this.failedLogins.size >= AuthService.MAX_TRACKED_IDENTITIES
    ) {
      const now = Date.now();
      for (const [k, v] of this.failedLogins) {
        if (v.lockedUntil <= now && v.lockedUntil !== 0) {
          this.failedLogins.delete(k);
          if (this.failedLogins.size < AuthService.MAX_TRACKED_IDENTITIES) break;
        }
      }
      if (this.failedLogins.size >= AuthService.MAX_TRACKED_IDENTITIES) {
        const oldest = this.failedLogins.keys().next().value;
        if (oldest !== undefined) this.failedLogins.delete(oldest);
      }
    }

    const entry = this.failedLogins.get(key) ?? { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
      entry.count = 0;
      entry.lockedUntil = 0;
    }
    entry.count += 1;
    if (entry.count >= AuthService.MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + AuthService.LOCKOUT_MS;
    }
    this.failedLogins.set(key, entry);
  }

  private clearFailedLogins(key: string): void {
    this.failedLogins.delete(key);
  }

  async login(loginDto: LoginDto) {
    const key = this.normalizeEmailKey(loginDto.email);

    await this.enforceLockout(key, loginDto.password);

    const user = await this.usersService.findOneByEmail(loginDto.email);
    if (!user) {
      // Unknown email: burn the same bcrypt time as a real compare so
      // response latency doesn't disclose whether the account exists.
      await this.timingSafeDummyCompare(loginDto.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      this.recordFailedLogin(key);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedLogins(key);

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

      // Deactivated or deleted accounts must not be able to mint new access
      // tokens, even with a still-valid refresh token.
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
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

    // Rotate the refresh token so any OTHER session (other devices/browsers
    // holding the old refresh token) is invalidated. The current device stays
    // logged in via the fresh pair returned below.
    const tokens = await this.generateTokens({
      ...user,
      password: hashedPassword,
    });
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    const ctx = getAuditContext();
    await this.usersService.logActivity({
      action: 'CHANGE_PASSWORD',
      module: 'auth',
      entityId: userId,
      userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return {
      message: 'Password changed successfully',
      ...tokens,
    };
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
