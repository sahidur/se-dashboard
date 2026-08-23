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

@Entity('dc_revenue')
@Unique(['schoolId', 'academicYear'])
export class DcRevenue {
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

  @Column({ name: 'monthly_tuition_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyTuitionFee: number;

  @Column({ name: 'admission_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  admissionFee: number;

  @Column({ name: 'exam_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  examFee: number;

  @Column({ name: 'total_annual_revenue', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAnnualRevenue: number;

  @Column({ name: 'government_grant', type: 'decimal', precision: 14, scale: 2, default: 0 })
  governmentGrant: number;

  @Column({ name: 'donations_received', type: 'decimal', precision: 14, scale: 2, default: 0 })
  donationsReceived: number;

  @Column({ name: 'other_income', type: 'decimal', precision: 14, scale: 2, default: 0 })
  otherIncome: number;

  @Column({ name: 'total_expenditure', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalExpenditure: number;

  @Column({ name: 'salary_expenditure', type: 'decimal', precision: 14, scale: 2, default: 0 })
  salaryExpenditure: number;

  @Column({ name: 'maintenance_expenditure', type: 'decimal', precision: 14, scale: 2, default: 0 })
  maintenanceExpenditure: number;

  @Column({ name: 'pending_fee_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  pendingFeeAmount: number;

  @Column({ name: 'fee_collection_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  feeCollectionRate: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
