import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Audit log for fee-structure edits.
 * Visible only to Admin / Super Admin.
 */
@Entity('dc_fee_structure_log')
export class DcFeeStructureLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ length: 20 })
  month: string;

  @Column({ length: 30 })
  grade: string;

  /** Full previous row as JSON */
  @Column({ name: 'previous_data', type: 'jsonb' })
  previousData: Record<string, unknown>;

  /** Full new row as JSON */
  @Column({ name: 'new_data', type: 'jsonb' })
  newData: Record<string, unknown>;

  @Column({ name: 'edited_by_id', nullable: true })
  editedById: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'edited_by_id' })
  editedBy: User;

  @CreateDateColumn({ name: 'edited_at' })
  editedAt: Date;
}
