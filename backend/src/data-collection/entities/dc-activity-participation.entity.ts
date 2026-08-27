import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  DeleteDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Students' participation in Corner / Club / Library / Lab activities,
 * tracked per school / item / month / grade. One record per combination;
 * upsert on conflict.
 */
@Entity('dc_activity_participation')
@Unique(['schoolId', 'item', 'year', 'month', 'grade'])
export class DcActivityParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** Corner activity | one of the five clubs | Science/ICT/Agriculture lab | Use of library */
  @Column({ length: 30 })
  item: string;

  /** Calendar year the activity was conducted in, e.g. 2026 */
  @Column({ type: 'int', default: 0 })
  year: number;

  /** January … December */
  @Column({ length: 20 })
  month: string;

  /** Play & Learn | Nursery | G1 … G10 */
  @Column({ length: 20 })
  grade: string;

  /** Name of the activity / book(s) used */
  @Column({ name: 'activity_name', type: 'text', nullable: true })
  activityName: string;

  /** S3 (or local) URL of the uploaded photo evidence */
  @Column({ name: 'photo_url', length: 1000, nullable: true })
  photoUrl: string;

  /** Storage key/path for the uploaded photo, used for deletion */
  @Column({ name: 'photo_key', length: 1000, nullable: true })
  photoKey: string;

  @Column({ name: 'conducted_count', type: 'int', default: 0 })
  conductedCount: number;

  /** % of students who used/participated in this activity (used for grading). */
  @Column({ name: 'participation_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  participationRate: number | null;

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

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
