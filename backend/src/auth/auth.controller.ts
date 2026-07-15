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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WebAuthnService } from './webauthn.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  VerifyRegistrationDto,
  PasskeyLoginOptionsDto,
  VerifyAuthenticationDto,
  RenamePasskeyDto,
} from './dto/passkey.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a passkey' })
  async removePasskey(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
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
  async passkeyLoginVerify(@Body() body: VerifyAuthenticationDto) {
    return this.webAuthnService.verifyAuthentication(body.flowId, body.response);
  }
}
