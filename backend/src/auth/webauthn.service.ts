import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID, randomBytes } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { Passkey } from './entities/passkey.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

interface StoredChallenge {
  challenge: string;
  userId?: string;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);

  /** Relying Party identifier (effective domain, e.g. `localhost`). */
  private readonly rpID: string;
  /** Human-readable Relying Party name shown in the OS/browser prompt. */
  private readonly rpName: string;
  /** Expected origin(s) of the frontend that initiates WebAuthn ceremonies. */
  private readonly origins: string[];

  /**
   * Short-lived challenge store. Challenges must survive between the
   * "generate options" and "verify" requests but are single-use and expire
   * quickly, so an in-memory map with TTL is appropriate for this deployment.
   */
  private readonly challenges = new Map<string, StoredChallenge>();

  constructor(
    @InjectRepository(Passkey)
    private readonly passkeyRepository: Repository<Passkey>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.rpID = this.configService.get<string>('WEBAUTHN_RP_ID', 'localhost');
    this.rpName = this.configService.get<string>(
      'WEBAUTHN_RP_NAME',
      'SE360',
    );
    // Never fall back to http://localhost:3000 in production: a permissive
    // WebAuthn RP origin would let a localhost page perform ceremonies against
    // the real deployment. NOTE: the strictness lives in
    // assertWebAuthnOriginConfig() at ceremony time, not here — utility boots
    // (schema-sync, seed) force APP_ENV=production but must not require the
    // production origin config to exist.
    const isProduction = process.env.APP_ENV === 'production';
    const originEnv =
      this.configService.get<string>('WEBAUTHN_ORIGIN') ||
      this.configService.get<string>('CORS_ORIGIN') ||
      '';
    if (!originEnv && !isProduction) {
      this.logger.warn(
        'WEBAUTHN_ORIGIN/CORS_ORIGIN not set — defaulting WebAuthn origins to http://localhost:3000 (development only)',
      );
    }
    this.origins = (originEnv || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim());
  }

  /**
   * Ceremony-time guard: passkey enrolment/login must never run against an
   * insecure or unconfigured RP origin. Redeploy/deploy scripts validate the
   * same rule at deploy time; this catches a misconfigured live box.
   */
  private assertWebAuthnOriginConfig(): void {
    const isProduction = process.env.APP_ENV === 'production';
    if (!this.origins.length || !this.origins[0]) {
      throw new Error(
        'WEBAUTHN_ORIGIN (or CORS_ORIGIN) must be set for WebAuthn ceremonies',
      );
    }
    if (isProduction && this.origins.some((o) => o.startsWith('http://'))) {
      throw new Error(
        `WebAuthn origins must be https:// in production: ${this.origins.join(', ')}`,
      );
    }
  }

  // ── Challenge helpers ────────────────────────────────────────────────
  private setChallenge(key: string, challenge: string, userId?: string) {
    this.challenges.set(key, {
      challenge,
      userId,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
  }

  private takeChallenge(key: string): StoredChallenge | undefined {
    const entry = this.challenges.get(key);
    this.challenges.delete(key); // single-use
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) return undefined;
    return entry;
  }

  // ── Registration (enrolling a new passkey; requires an authenticated user) ─
  async generateRegistration(userId: string) {
    this.assertWebAuthnOriginConfig();
    const user = await this.usersService.findOneById(userId);
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.passkeyRepository.find({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      // We never need attestation certs; 'none' maximises privacy.
      attestationType: 'none',
      // Prevent registering the same authenticator twice.
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: (p.transports as AuthenticatorTransportFuture[]) ?? undefined,
      })),
      authenticatorSelection: {
        // Prefer syncable, discoverable passkeys but allow security keys too.
        residentKey: 'preferred',
        // Passkeys replace the password here, so the ceremony must prove the
        // *user* (biometric/PIN), not merely possession of an unlocked device.
        userVerification: 'required',
      },
      // ES256 (-7) and RS256 (-257) cover virtually all authenticators.
      supportedAlgorithmIDs: [-7, -257],
    });

    this.setChallenge(`reg:${userId}`, options.challenge, userId);
    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    friendlyName?: string,
  ) {
    const stored = this.takeChallenge(`reg:${userId}`);
    if (!stored) {
      throw new BadRequestException(
        'Registration challenge expired or missing. Please try again.',
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: stored.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        requireUserVerification: true,
      });
    } catch (err) {
      this.logger.warn(`Passkey registration verification failed: ${err}`);
      throw new BadRequestException('Passkey registration could not be verified');
    }

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      throw new BadRequestException('Passkey registration failed verification');
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
      registrationInfo;

    // Guard against re-registering an already-known credential.
    const duplicate = await this.passkeyRepository.findOne({
      where: { credentialId: credential.id },
    });
    if (duplicate) {
      throw new BadRequestException('This passkey is already registered');
    }

    const passkey = this.passkeyRepository.create({
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports:
        (credential.transports as string[]) ??
        response.response.transports ??
        null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      aaguid: aaguid ?? null,
      name: friendlyName?.trim() || this.defaultPasskeyName(credentialDeviceType),
      userId,
    });

    // save() triggers the global audit subscriber → logs a CREATE on `Passkey`.
    await this.passkeyRepository.save(passkey);

    return this.serialize(passkey);
  }

  // ── Authentication (login with a passkey; public) ────────────────────
  async generateAuthentication(email?: string) {
    this.assertWebAuthnOriginConfig();
    let allowCredentials:
      | { id: string; transports?: AuthenticatorTransportFuture[] }[]
      | undefined;

    if (email) {
      const user = await this.usersService.findOneByEmail(email);
      let realPasskeys: Passkey[] = [];
      if (user) {
        realPasskeys = await this.passkeyRepository.find({
          where: { userId: user.id },
        });
      }
      // Anti-enumeration: for unknown emails (or accounts without passkeys),
      // return plausible decoy credential IDs instead of omitting the field.
      // The response shape is identical, so an attacker cannot tell from
      // this public endpoint whether the email has passkeys. Assertions
      // against decoy IDs fail verification ("Unrecognised passkey").
      allowCredentials = realPasskeys.length
        ? realPasskeys.map((p) => ({
            id: p.credentialId,
            transports:
              (p.transports as AuthenticatorTransportFuture[]) ?? undefined,
          }))
        : [
            { id: isoBase64URL.fromBuffer(randomBytes(32)) },
            { id: isoBase64URL.fromBuffer(randomBytes(32)) },
          ];
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
      // Omit allowCredentials entirely for a usernameless / discoverable flow.
      allowCredentials: allowCredentials?.length ? allowCredentials : undefined,
    });

    const flowId = randomUUID();
    this.setChallenge(`auth:${flowId}`, options.challenge);
    return { flowId, options };
  }

  async verifyAuthentication(
    flowId: string,
    response: AuthenticationResponseJSON,
  ) {
    const stored = this.takeChallenge(`auth:${flowId}`);
    if (!stored) {
      throw new BadRequestException(
        'Login challenge expired or missing. Please try again.',
      );
    }

    const passkey = await this.passkeyRepository.findOne({
      where: { credentialId: response.id },
    });
    if (!passkey) {
      throw new UnauthorizedException('Unrecognised passkey');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: stored.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports:
            (passkey.transports as AuthenticatorTransportFuture[]) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Passkey authentication verification failed: ${err}`);
      throw new UnauthorizedException('Passkey login could not be verified');
    }

    const { verified, authenticationInfo } = verification;
    if (!verified) {
      throw new UnauthorizedException('Passkey login failed verification');
    }

    const user = await this.usersService.findOneById(passkey.userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    // Update the signature counter + last-used timestamp via `update()` so the
    // audit subscriber does not record this bookkeeping as a change.
    await this.passkeyRepository.update(passkey.id, {
      counter: authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    });

    return this.authService.issueSession(user, 'passkey');
  }

  // ── Management ────────────────────────────────────────────────────────
  async listForUser(userId: string) {
    const passkeys = await this.passkeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return passkeys.map((p) => this.serialize(p));
  }

  async rename(userId: string, id: string, name: string) {
    const passkey = await this.passkeyRepository.findOne({ where: { id, userId } });
    if (!passkey) throw new NotFoundException('Passkey not found');
    passkey.name = name.trim().slice(0, 100) || passkey.name;
    await this.passkeyRepository.save(passkey);
    return this.serialize(passkey);
  }

  async remove(userId: string, id: string) {
    const passkey = await this.passkeyRepository.findOne({ where: { id, userId } });
    if (!passkey) throw new NotFoundException('Passkey not found');
    // remove() triggers the global audit subscriber → logs a DELETE on `Passkey`
    // (with the old snapshot), so no manual audit entry is needed here.
    await this.passkeyRepository.remove(passkey);
    return { message: 'Passkey removed' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private defaultPasskeyName(deviceType: string): string {
    return deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey';
  }

  private serialize(p: Passkey) {
    return {
      id: p.id,
      name: p.name,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      transports: p.transports,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    };
  }
}
