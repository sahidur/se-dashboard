import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { GeoLocation } from '../../geo-locations/entities/geo-location.entity';
import { DcSchool } from '../../data-collection/entities/dc-school.entity';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  @Exclude()
  password: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ type: 'int', nullable: true })
  pin: number | null;

  @Column({ nullable: true, type: 'varchar', length: 150 })
  designation: string | null;

  @Column({ nullable: true, type: 'varchar', length: 150 })
  base: string | null;

  @ManyToOne(() => GeoLocation, { nullable: true, eager: true })
  @JoinColumn({ name: 'geo_location_id' })
  geoLocation: GeoLocation | null;

  @Column({ name: 'geo_location_id', nullable: true, type: 'uuid' })
  geoLocationId: string | null;

  // Points at the real Data Collection school registry (dc_schools) rather
  // than the legacy/unused `schools` module table, since that's where every
  // school actually gets created via the "School Information" feature.
  @ManyToMany(() => DcSchool)
  @JoinTable({
    name: 'user_schools',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'school_id', referencedColumnName: 'id' },
  })
  schools: DcSchool[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true, type: 'text' })
  @Exclude()
  refreshToken: string | null;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  get name(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
