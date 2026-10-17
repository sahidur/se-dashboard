import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WebAuthnService } from './webauthn.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  VerifyRegistrationDto,
  PasskeyLoginOptionsDto,
  VerifyAuthenticationDto,
  RenamePasskeyDto,
  DeletePasskeyDto,
} from './dto/passkey.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from './cookies';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly webAuthnService: WebAuthnService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  // Strict brute-force protection: 10 attempts per 60 s per IP
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  // Public registration disabled – users can only be created from the admin panel
  // @Public()
  // @Post('register')
  // @ApiOperation({ summary: 'User registration' })
  // async register(@Body() registerDto: RegisterDto) {
  //   return this.authService.register(registerDto);
  // }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  // Token refresh: allow enough for normal use but block flooding
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Session refreshed' };
  }

  // Public on purpose: the 15-minute access cookie is usually expired by the
  // time a user clicks "log out", and a guarded route would 401 BEFORE the
  // 7-day refresh session is revoked or its cookie cleared. Revocation is
  // keyed on the refresh cookie (path=/api/auth, so it is sent here); a
  // cross-site POST can't carry these SameSite=Lax cookies.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    clearAuthCookies(res);
    await this.authService.logoutWithRefreshToken(
      req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    );
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
    // The service rotates the refresh token (invalidating other devices);
    // keep this device's cookies in sync with the new pair.
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { message: result.message };
  }

  // ── Passkey (WebAuthn) enrolment — requires an authenticated user ──────
  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin passkey enrolment (generate options)' })
  async passkeyRegisterOptions(@CurrentUser('id') userId: string) {
    return this.webAuthnService.generateRegistration(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete passkey enrolment (verify + store)' })
  async passkeyRegisterVerify(
    @CurrentUser('id') userId: string,
    @Body() body: VerifyRegistrationDto,
  ) {
    // Step-up auth: the session alone is not enough to add a passkey —
    // require the account password so a hijacked access token cannot enrol
    // an attacker credential that would survive password changes.
    await this.authService.verifyUserPassword(userId, body.password);
    return this.webAuthnService.verifyRegistration(
      userId,
      body.response,
      body.name,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('passkey')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current user's passkeys" })
  async listPasskeys(@CurrentUser('id') userId: string) {
    return this.webAuthnService.listForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('passkey/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a passkey' })
  async renamePasskey(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenamePasskeyDto,
  ) {
    return this.webAuthnService.rename(userId, id, body.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('passkey/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a passkey' })
  async removePasskey(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeletePasskeyDto,
  ) {
    // Step-up auth: same rule as enrolment — a hijacked access token must not
    // be able to strip the account of its MFA factors.
    await this.authService.verifyUserPassword(userId, body.password);
    return this.webAuthnService.remove(userId, id);
  }

  // ── Passkey (WebAuthn) login — public ──────────────────────────────────
  @Public()
  @Post('passkey/login/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin passkey login (generate options)' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async passkeyLoginOptions(@Body() body: PasskeyLoginOptionsDto) {
    return this.webAuthnService.generateAuthentication(body.email);
  }

  @Public()
  @Post('passkey/login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete passkey login (verify + issue tokens)' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async passkeyLoginVerify(
    @Body() body: VerifyAuthenticationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.webAuthnService.verifyAuthentication(
      body.flowId,
      body.response,
    );
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }
}
