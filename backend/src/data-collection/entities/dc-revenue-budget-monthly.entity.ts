import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Monthly tuition fee target + achievement — Budget view.
 * One record per (school, month).
 */
@Entity('dc_revenue_budget_monthly')
@Unique(['schoolId', 'academicYear', 'month'])
export class DcRevenueBudgetMonthly {
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

  @Column({ name: 'tuition_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  tuitionFeeTarget: number;

  @Column({ name: 'tuition_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  tuitionFeeAchievement: number;

  /** Stored for quick reporting; computed from target/achievement */
  @Column({ name: 'collection_pct', type: 'decimal', precision: 7, scale: 2, default: 0 })
  collectionPct: number;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;
  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'updated_by_id', nullable: true })
  updatedById: string;
  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
