import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum FeeSchedule {
  YEARLY = 'yearly',
  HALF_YEARLY = 'half_yearly',
  MONTHLY = 'monthly',
}

@Entity('edu_fee_heads')
export class FeeHead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. Tuition Fee, Activity Fee, Library Fee
  // Unique per category (enforced in the service); the legacy DB-level unique
  // constraint on name alone was dropped when category scoping was introduced.
  @Column({ length: 150 })
  name: string;

  // Owning school category: brac_academy | brac_primary | brac_secondary.
  // NULL = uncategorized (legacy heads).
  @Column({ length: 50, nullable: true })
  category: string;

  // How often this head is charged: yearly | half_yearly | monthly.
  @Column({
    name: 'fee_schedule',
    length: 20,
    default: FeeSchedule.MONTHLY,
  })
  feeSchedule: FeeSchedule;

  // When true, students may pay this head line in installments.
  @Column({ name: 'installment_allowed', type: 'boolean', default: false })
  installmentAllowed: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
