import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Browser sessions authenticate the refresh call with the httpOnly `se360_rt`
// cookie (path /api/auth) and send NO body. API clients (Swagger, curl) may
// still put the token in the body. The property must therefore be optional —
// otherwise the global ValidationPipe 400s the cookie-only request before the
// controller's cookie fallback can run, which used to force a logout every
// time the 15-minute access token expired.
export class RefreshTokenDto {
  @ApiProperty({ required: false, description: 'Optional for cookie sessions — the httpOnly se360_rt cookie authenticates the refresh' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}