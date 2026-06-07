import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
