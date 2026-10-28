import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { StudentFee } from './student-fee.entity';

export enum FeeAdjustmentKind {
  // Money was collected for a month before the student's admission month.
  PRE_ADMISSION_PAYMENT = 'pre_admission_payment',
  // Money was collected for a head that no longer applies (e.g. an Admission
  // Fee paid by a student who is not new for that year).
  INAPPLICABLE_HEAD_PAYMENT = 'inapplicable_head_payment',
  // A partly paid month still lists a head that no longer applies and is unpaid.
  INAPPLICABLE_HEAD_DUE = 'inapplicable_head_due',
  // Money was collected for a month after the student's dropout month.
  POST_DROPOUT_PAYMENT = 'post_dropout_payment',
}

export enum FeeAdjustmentStatus {
  OPEN = 'open',
  REFUNDED = 'refunded',
  APPLIED_MANUALLY = 'applied_manually',
  WAIVED = 'waived',
  // The condition that raised it no longer applies (e.g. admission date fixed).
  DISMISSED = 'dismissed',
}

/**
 * Tracking record for money that needs a Finance decision after fee
 * reconciliation. It never changes payments, receipts or fee amounts - it only
 * records what needs review and how Finance resolved it (audited like any
 * other entity).
 */
@Entity('edu_fee_adjustments')
@Index('ix_fee_adjustment_school_status', ['schoolId', 'status'])
@Index('ix_fee_adjustment_fee', ['studentFeeId', 'kind'])
export class FeeAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => StudentFee, { nullable: false })
  @JoinColumn({ name: 'student_fee_id' })
  studentFee: StudentFee;

  @Column({ name: 'student_fee_id' })
  studentFeeId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'varchar', length: 40 })
  kind: FeeAdjustmentKind;

  // Money involved: collected amount (payment kinds) or outstanding amount
  // (inapplicable_head_due).
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: string;

  // Context for the reviewer, e.g. { reason, heads: [{ feeHeadName, paid, due }] }
  @Column({ type: 'jsonb', default: '{}' })
  details: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: FeeAdjustmentStatus.OPEN })
  status: FeeAdjustmentStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
