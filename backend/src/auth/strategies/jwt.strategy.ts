import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { ACCESS_TOKEN_COOKIE } from '../cookies';

/**
 * Minimal claim set. Deliberately NO email / role names: the token is re-read
 * from the DB on every request anyway, so baking PII into the (base64-decodable)
 * JWT only leaks data without buying anything. `pwv` is the token version —
 * the timestamp of the user's last password set/change.
 */
export interface JwtPayload {
  sub: string;
  pwv?: number;
}

/**
 * Accepts the access token from the Authorization Bearer header (Swagger,
 * non-browser clients) OR from the httpOnly `se360_at` cookie set at login
 * (browser sessions — see auth/cookies.ts).
 */
export function cookieExtractor(req?: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      // Defensively pin the algorithm so a token signed with any other alg
      // (e.g. "none" or an asymmetric confusion) can never verify.
      algorithms: ['HS256'],
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Re-check the DB on every request to catch deactivated accounts within
    // the token's remaining TTL, AND read live role names from the DB: role
    // claims baked into the JWT at login would otherwise keep a demoted or
    // exiled admin fully privileged until the access-token TTL expires.
    const user = await this.usersService.findActiveUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account is deactivated or not found');
    }

    // Token-version check: a token signed before the user's most recent
    // password set/change (self change or admin reset) is rejected even if
    // still cryptographically valid. Tokens without the `pwv` claim are
    // legacy and rejected too — the frontend transparently rotates them via
    // /auth/refresh on the first 401.
    const currentPwv = user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0;
    if (payload.pwv === undefined || payload.pwv < currentPwv) {
      throw new UnauthorizedException('Session expired due to a credential change. Please sign in again.');
    }

    return {
      id: user.id,
      email: user.email,
      roles: (user.roles || []).map((r) => r.name),
    };
  }
}