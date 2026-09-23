import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

export enum ReceiptStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

// A receipt is generated once per payment. Reprinting never creates a
// new payment; a cancelled receipt keeps its number but is void.
@Entity('edu_receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. RCPT-2026-000125 — unique
  @Column({ name: 'receipt_number', length: 50, unique: true })
  receiptNumber: string;

  @ManyToOne(() => Payment, { nullable: false })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id' })
  paymentId: string;

  @ManyToOne(() => Student, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'issued_by_id' })
  issuedBy: User;

  @Column({ name: 'issued_by_id' })
  issuedById: string;

  @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.ACTIVE })
  status: ReceiptStatus;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
