import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { StudentFee } from './student-fee.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  BANK = 'bank',
  MFS = 'mfs',
  CARD = 'card',
  OTHER = 'other',
}

export enum PaymentStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// Money actually received. Payments are never hard-deleted and their
// amount is never edited — corrections happen via cancel/refund.
@Entity('edu_payments')
@Index('ix_payment_student', ['studentId'])
@Index('ix_payment_school', ['schoolId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  // The specific month this payment is allocated to
  @ManyToOne(() => StudentFee, { nullable: false })
  @JoinColumn({ name: 'student_fee_id' })
  studentFee: StudentFee;

  @Column({ name: 'student_fee_id' })
  studentFeeId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  // How this payment is split across fee heads of the month:
  // [{ feeHeadId, feeHeadName, amount }]. Empty for legacy month-level payments.
  @Column({ type: 'jsonb', default: '[]' })
  allocations: Array<{
    feeHeadId: string;
    feeHeadName: string;
    amount: number;
  }>;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  // Optional reference for non-cash payments
  @Column({ name: 'transaction_ref', length: 150, nullable: true })
  transactionRef: string;

  @Column({ name: 'bank_name', length: 150, nullable: true })
  bankName: string;

  @Column({ name: 'payment_date', type: 'timestamptz', default: () => 'now()' })
  paymentDate: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'collected_by_id' })
  collectedBy: User;

  @Column({ name: 'collected_by_id' })
  collectedById: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.COMPLETED })
  status: PaymentStatus;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelled_by_id' })
  cancelledBy: User;

  @Column({ name: 'cancelled_by_id', nullable: true })
  cancelledById: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
