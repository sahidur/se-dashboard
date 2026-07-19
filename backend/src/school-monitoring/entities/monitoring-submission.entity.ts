import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { DcSchool } from '../../data-collection/entities/dc-school.entity';
import { User } from '../../users/entities/user.entity';

/** One rated indicator answer inside a monitoring submission. */
export interface MonitoringAnswer {
  /** Indicator code, e.g. "1.2" */
  code: string;
  /** Section number the indicator belongs to, e.g. "1" */
  section: string;
  /** yes = Yes/Satisfied, no = No/Not Satisfied, na = Not Applicable */
  result: 'yes' | 'no' | 'na' | '';
  /** Optional free-text observation comment. */
  comment?: string;
}

/** An uploaded file/photo attached to a monitoring submission. */
export interface MonitoringAttachment {
  url: string;
  key: string;
  name: string;
  /** MIME type, e.g. image/png, application/pdf */
  type?: string;
}

/**
 * A single filled-in school-monitoring observation (a "feedback" entry).
 *
 * Multiple users can submit their own observations for the same school + form
 * category over time — each one is a separate immutable row. The history for a
 * school+category is every row ordered newest-first. The author cannot edit
 * their own submission; only users granted the `school-monitoring-edit`
 * permission (or Admins) may edit/delete any submission.
 */
@Entity('school_monitoring_submissions')
@Index(['schoolId', 'formType'])
export class MonitoringSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** combined | quality | operations */
  @Column({ name: 'form_type', length: 30 })
  formType: string;

  @Column({ name: 'observer_name', type: 'varchar', length: 200, nullable: true })
  observerName: string | null;

  /** Teacher observed (Quality & Operations forms) */
  @Column({ name: 'teacher_name', type: 'varchar', length: 200, nullable: true })
  teacherName: string | null;

  @Column({ name: 'observation_date', type: 'date', nullable: true })
  observationDate: string | null;

  /** Class/grade(s) being observed (Quality & Operations forms), comma-separated */
  @Column({ name: 'class_name', type: 'varchar', length: 255, nullable: true })
  className: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  answers: MonitoringAnswer[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: MonitoringAttachment[];

  /** Optional overall remark / summary the observer leaves. */
  @Column({ name: 'general_remarks', type: 'text', nullable: true })
  generalRemarks: string | null;

  // ── Audit ────────────────────────────────────────────────
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy: User;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
