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
 * Co-curricular participation data per school / month / grade.
 * One record per combination; upsert on conflict.
 * All participation fields are % values (0–100).
 */
@Entity('dc_cocurricular')
@Unique(['schoolId', 'academicYear', 'month', 'grade'])
export class DcCocurricular {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** Academic year the record belongs to, e.g. 2026 */
  @Column({ name: 'academic_year', type: 'int', default: 0 })
  academicYear: number;

  /** January … December */
  @Column({ length: 20 })
  month: string;

  /** Play & Learn | Nursery | Grade 1 … Grade 10 */
  @Column({ length: 30 })
  grade: string;

  // ── Participation % fields ───────────────────────────────
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  song: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  dance: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  recitation: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  acting: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  debate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  quiz: number;

  @Column({ name: 'wall_magazine', type: 'decimal', precision: 5, scale: 2, default: 0 })
  wallMagazine: number;

  @Column({ name: 'indoor_game', type: 'decimal', precision: 5, scale: 2, default: 0 })
  indoorGame: number;

  @Column({ name: 'outdoor_game', type: 'decimal', precision: 5, scale: 2, default: 0 })
  outdoorGame: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  others: number;

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
