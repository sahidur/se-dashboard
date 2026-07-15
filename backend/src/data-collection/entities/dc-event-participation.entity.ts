import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * School's participation in different events (multi-entry, like Alumni).
 * Each row is one event participation record.
 */
@Entity('dc_event_participation')
export class DcEventParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ name: 'event_name', length: 100 })
  eventName: string;

  /** Upazila | Zila | National */
  @Column({ name: 'award_level', length: 30 })
  awardLevel: string;

  @Column({ name: 'male_awarded', type: 'int', default: 0 })
  maleAwarded: number;

  @Column({ name: 'female_awarded', type: 'int', default: 0 })
  femaleAwarded: number;

  @Column({ name: 'others_awarded', type: 'int', default: 0 })
  othersAwarded: number;

  @Column({ name: 'total_awarded', type: 'int', default: 0 })
  totalAwarded: number;

  // ── Audit ────────────────────────────────────────────────
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
