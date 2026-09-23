import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { FeeHead } from './fee-head.entity';
import { AcademicYear } from './academic-year.entity';
import { User } from '../../users/entities/user.entity';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

// Student-specific discount.
// - feeHeadId set  -> applies to that fee head only
// - feeHeadId null -> applies to the total eligible fee
// - isRecurring    -> applies every month; otherwise only within the
//                     effective month range of the academic year
@Entity('edu_student_discounts')
export class StudentDiscount {
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

  // null = discount applies to the total eligible fee
  @ManyToOne(() => FeeHead, { nullable: true })
  @JoinColumn({ name: 'fee_head_id' })
  feeHead: FeeHead;

  @Column({ name: 'fee_head_id', nullable: true })
  feeHeadId: string;

  @Column({ type: 'enum', enum: DiscountType })
  type: DiscountType;

  // percentage (0-100) or fixed amount — stored as decimal
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: string;

  @Column({ name: 'is_recurring', type: 'boolean', default: true })
  isRecurring: boolean;

  // effective month range (1-12) when not recurring
  @Column({ name: 'effective_from_month', type: 'int', nullable: true })
  effectiveFromMonth: number;

  @Column({ name: 'effective_to_month', type: 'int', nullable: true })
  effectiveToMonth: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

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
