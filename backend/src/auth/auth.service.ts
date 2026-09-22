import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { getAuditContext } from '../common/audit/audit-context';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
   * Rotation grace window: the refresh token is rotated on every use, but two
   * tabs (or devices) waking from the same idle period can both present the
   * same still-valid token an instant apart. The loser fails the bcrypt
   * compare against the newly stored hash and gets force-logged-out by the
   * frontend — historically THE cause of "randomly logged out after a few
   * minutes". Tokens retired by a very recent rotation stay refreshable for
   * REFRESH_GRACE_MS. Explicit revocation (logout / password change) clears
   * the window.
   */
  private static readonly REFRESH_GRACE_MS = 60_000;
  /** Retired tokens remembered per user (covers a burst of concurrent tabs). */
  private static readonly MAX_RETIRED_PER_USER = 5;
  /** Cap on tracked users so the map can't grow unboundedly under abuse. */
  private static readonly MAX_TRACKED_REFRESH_USERS = 10_000;

  /** userId → (sha256 of a just-retired refresh token → when it was rotated). */
  private retiredRefreshTokens = new Map<string, Map<string, number>>();

  private static sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private rememberRetiredRefreshToken(userId: string, refreshToken: string): void {
    let retired = this.retiredRefreshTokens.get(userId);
    if (!retired) {
      if (this.retiredRefreshTokens.size >= AuthService.MAX_TRACKED_REFRESH_USERS) {
        const now = Date.now();
        for (const [k, v] of this.retiredRefreshTokens) {
          if (now - Math.max(...v.values()) > AuthService.REFRESH_GRACE_MS) {
            this.retiredRefreshTokens.delete(k);
          }
        }
        if (this.retiredRefreshTokens.size >= AuthService.MAX_TRACKED_REFRESH_USERS) {
          const oldest = this.retiredRefreshTokens.keys().next().value;
          if (oldest !== undefined) this.retiredRefreshTokens.delete(oldest);
        }
      }
      retired = new Map();
      this.retiredRefreshTokens.set(userId, retired);
    }
    if (retired.size >= AuthService.MAX_RETIRED_PER_USER) {
      const oldestKey = [...retired.entries()].sort((a, b) => a[1] - b[1])[0][0];
      retired.delete(oldestKey);
    }
    retired.set(AuthService.sha256(refreshToken), Date.now());
  }

  private isRecentlyRetiredRefreshToken(userId: string, refreshToken: string): boolean {
    const retired = this.retiredRefreshTokens.get(userId);
    if (!retired) return false;
    const rotatedAt = retired.get(AuthService.sha256(refreshToken));
    return !!rotatedAt && Date.now() - rotatedAt <= AuthService.REFRESH_GRACE_MS;
  }

  private clearRetiredRefreshTokens(userId: string): void {
    this.retiredRefreshTokens.delete(userId);
  }

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
      throw new UnauthorizedException('Invalid credentials');
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
      // Pin the algorithm just like JwtStrategy does, so a token produced
      // with any other alg can never verify.
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
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
        // Grace window: a duplicate refresh sent an instant apart by another
        // tab/device must not force a logout (see retiredRefreshTokens).
        if (!this.isRecentlyRetiredRefreshToken(user.id, refreshToken)) {
          // The presented refresh token is well-formed but no longer the
          // stored one and not within the grace window — the classic reuse
          // signal of a stolen/rotated token. Log for auditing without ever
          // logging the token itself.
          this.logger.warn(
            `Refresh token reuse rejected for user ${user.id} — possible token theft or stale session`,
          );
          throw new UnauthorizedException('Invalid refresh token');
        }
      }

      const tokens = await this.generateTokens(user);
      this.rememberRetiredRefreshToken(user.id, refreshToken);
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    // Explicit logout must also close the rotation grace window, otherwise a
    // token retired moments earlier could still mint a fresh session.
    this.clearRetiredRefreshTokens(userId);
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

  /**
   * Step-up verification for sensitive account actions (passkey enrolment):
   * proves the session holder still knows the account password, so a stolen
   * access token alone cannot add a persistence credential.
   */
  async verifyUserPassword(userId: string, password: string): Promise<void> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Same message class as login to avoid confirming the account state.
      throw new UnauthorizedException('Password verification failed');
    }
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
    // Single source of truth for the new token version: updatePassword
    // persists it and the fresh token pair below signs it, so every access
    // token issued before this change is rejected by JwtStrategy.
    const changedAt = new Date();
    await this.usersService.updatePassword(userId, hashedPassword, changedAt);

    // Rotate the refresh token so any OTHER session (other devices/browsers
    // holding the old refresh token) is invalidated. The current device stays
    // logged in via the fresh pair returned below. The grace window is closed
    // too so the rotation genuinely kills every old token.
    this.clearRetiredRefreshTokens(userId);
    const tokens = await this.generateTokens({
      ...user,
      password: hashedPassword,
      passwordChangedAt: changedAt,
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
    // Minimal claim set — no email/roles (they are re-read from the DB per
    // request; baking PII into a base64-decodable token leaks it for free).
    // `pwv` (password-changed-at) is the token version checked by the JWT
    // strategy so credential changes instantly invalidate older tokens.
    const payload: JwtPayload = {
      sub: user.id,
      pwv: user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!jwtSecret || !refreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        // Short-lived access token; the frontend silently rotates it via
        // /auth/refresh, so a stolen one has a tiny window.
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        // Matches the refresh-cookie TTL default in auth/cookies.ts.
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
