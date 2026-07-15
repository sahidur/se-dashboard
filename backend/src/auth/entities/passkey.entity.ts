import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A registered WebAuthn / FIDO2 passkey credential belonging to a user.
 *
 * Security note: we only ever persist the credential's PUBLIC key and metadata.
 * The private key and any biometric data (fingerprint, face, etc.) never leave
 * the user's device / authenticator and are never transmitted to or stored by
 * this server.
 */
@Entity('passkeys')
export class Passkey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Base64URL-encoded credential ID returned by the authenticator (unique). */
  @Index({ unique: true })
  @Column({ type: 'text' })
  credentialId: string;

  /** Base64URL-encoded COSE public key used to verify assertions. */
  @Column({ type: 'text' })
  publicKey: string;

  /**
   * Signature counter for clone-detection. Stored as bigint; converted to a
   * JS number via a transformer (counters never realistically exceed 2^53).
   */
  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  counter: number;

  /** Transport hints reported by the authenticator (usb, nfc, ble, internal, hybrid). */
  @Column({ type: 'simple-array', nullable: true })
  transports: string[] | null;

  /** 'singleDevice' | 'multiDevice' — whether the passkey is synced across devices. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  deviceType: string | null;

  /** Whether the credential is backed up (synced) to the provider's cloud. */
  @Column({ type: 'boolean', default: false })
  backedUp: boolean;

  /** Authenticator model identifier (AAGUID), when disclosed. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  aaguid: string | null;

  /** Friendly, user-editable label for this passkey (e.g. "MacBook Touch ID"). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
