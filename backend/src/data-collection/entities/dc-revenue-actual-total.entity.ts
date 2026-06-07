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
 * Yearly revenue target + achievement per fee category — Actual Student view.
 * One record per school (upsert).
 */
@Entity('dc_revenue_actual_total')
@Unique(['schoolId'])
export class DcRevenueActualTotal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ name: 'total_students_target', type: 'int', default: 0 })
  totalStudentsTarget: number;

  // ── Admission Fee ──
  @Column({ name: 'admission_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFeeTarget: number;
  @Column({ name: 'admission_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFeeAchievement: number;

  // ── Session Fee ──
  @Column({ name: 'session_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sessionFeeTarget: number;
  @Column({ name: 'session_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sessionFeeAchievement: number;

  // ── Assessment Fee ──
  @Column({ name: 'assessment_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  assessmentFeeTarget: number;
  @Column({ name: 'assessment_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  assessmentFeeAchievement: number;

  // ── Sports Fee ──
  @Column({ name: 'sports_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sportsFeeTarget: number;
  @Column({ name: 'sports_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sportsFeeAchievement: number;

  // ── Syllabus Fee ──
  @Column({ name: 'syllabus_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  syllabusFeeTarget: number;
  @Column({ name: 'syllabus_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  syllabusFeeAchievement: number;

  // ── Testimonial Fee ──
  @Column({ name: 'testimonial_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  testimonialFeeTarget: number;
  @Column({ name: 'testimonial_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  testimonialFeeAchievement: number;

  // ── Others Fee (Badge, Tie, Diary, ID card, Shoulder) ──
  @Column({ name: 'others_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  othersFeeTarget: number;
  @Column({ name: 'others_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  othersFeeAchievement: number;

  // ── Transport Fee ──
  @Column({ name: 'transport_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  transportFeeTarget: number;
  @Column({ name: 'transport_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  transportFeeAchievement: number;

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
