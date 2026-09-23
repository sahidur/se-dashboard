import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { AcademicYear } from '../../fee-management/entities/academic-year.entity';

export enum StudentFeeStatus {
  DUE = 'due',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERPAID = 'overpaid',
  CANCELLED = 'cancelled',
}

// Snapshot of "what fee was actually assigned to this student for this month".
// Generated once from the standard fee structure + the student's discounts;
// later changes to the fee structure never rewrite these historical rows.
@Entity('edu_student_fees')
@Unique('uq_student_fee_month', ['studentId', 'academicYearId', 'month'])
@Index('ix_student_fee_school', ['schoolId', 'academicYearId', 'month'])
export class StudentFee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  // Class/section snapshot at generation time
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string;

  // 1 = January ... 12 = December
  @Column({ type: 'int' })
  month: number;

  // Breakdown by fee head: [{ feeHeadId, feeHeadName, base, discount, payable }]
  @Column({ type: 'jsonb', default: '[]' })
  breakdown: Array<{
    feeHeadId: string;
    feeHeadName: string;
    base: number;
    discount: number;
    payable: number;
  }>;

  @Column({ name: 'base_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  baseAmount: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ name: 'payable_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  payableAmount: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: string;

  @Column({ type: 'enum', enum: StudentFeeStatus, default: StudentFeeStatus.DUE })
  status: StudentFeeStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
