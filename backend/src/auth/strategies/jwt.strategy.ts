import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { ACCESS_TOKEN_COOKIE } from '../cookies';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

/**
 * Accepts the access token from the Authorization Bearer header (Swagger,
 * non-browser clients) OR from the httpOnly `bep_at` cookie set at login
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
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Re-check the DB on every request to catch deactivated accounts
    // within the token's remaining TTL. With a 15-min expiry the DB hit
    // is acceptable and only fetches the minimal fields needed.
    const user = await this.usersService.findActiveUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account is deactivated or not found');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
