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
 * Server-side, per-user private draft for data-collection forms.
 *
 * Replaces the earlier localStorage-only draft implementation so a draft
 * saved on one device is visible when the same user logs in on another
 * device. A draft is only ever readable/writable by the owning user (scoped
 * by userId in every query) — it is never surfaced to other users, never
 * appears in real form responses/dashboards, and is deleted once the form is
 * actually submitted.
 */
@Entity('dc_form_drafts')
@Unique(['userId', 'schoolId', 'formKey'])
export class DcFormDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'form_key', type: 'varchar', length: 100 })
  formKey: string;

  @Column({ name: 'data', type: 'jsonb' })
  data: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
