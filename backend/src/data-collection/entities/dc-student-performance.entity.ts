import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  DeleteDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/** One indicator/subject line of a Student Performance form. */
export interface StudentPerformanceRow {
  /** Stable row identifier within the form definition (e.g. "1", "bangla"). */
  code: string;
  /** Indicator/subject text, denormalised so stored data stays self-describing. */
  label: string;
  /** Optional domain grouping (BPS Form 1). */
  domain?: string;
  /** Scale label -> number of students, e.g. { Excellent: 10, Good: 15 }. */
  values: Record<string, number>;
}

/**
 * Student Performance (BA / BPS / BSS) — Pedagogical Performance section.
 *
 * Six sub-forms share this table; `formKey` identifies which one. The indicator
 * or subject lines differ per form, so they are stored as a self-describing
 * jsonb array instead of fixed columns.
 */
@Entity('dc_student_performance')
@Unique(['schoolId', 'academicYear', 'formKey', 'grade', 'evaluationPeriod'])
export class DcStudentPerformance {
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

  /** ba-1 | ba-2 | ba-3 | bps-1 | bps-2 | bss-1 */
  @Column({ name: 'form_key', length: 20 })
  formKey: string;

  /** Play & Learn | Nursery | G1 … G10 | SSC */
  @Column({ length: 40 })
  grade: string;

  /** Half-yearly | Annual */
  @Column({ name: 'evaluation_period', length: 30 })
  evaluationPeriod: string;

  @Column({ name: 'number_of_students', type: 'int', default: 0 })
  numberOfStudents: number;

  /** Percentage of students who appeared in the evaluation/exam (0–100, two decimals). */
  @Column({
    name: 'appeared_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    // Postgres hands NUMERIC columns back as strings — convert to JS numbers.
    transformer: {
      to: (v) => (v === undefined || v === null ? null : v),
      from: (v) => (v === undefined || v === null ? null : parseFloat(v)),
    },
  })
  appearedPercent: number;

  @Column({ type: 'jsonb' })
  rows: StudentPerformanceRow[];

  // ── Audit ────────────────────────────────────────────────
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
