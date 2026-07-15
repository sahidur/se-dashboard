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
 * Students' academic performance per school / grade / exam.
 * One record per school + grade + exam combination; upsert on conflict.
 */
@Entity('dc_students_performance')
@Unique(['schoolId', 'grade', 'examName'])
export class DcStudentsPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** Play & Learn | Nursery | G1 … G5 */
  @Column({ length: 30 })
  grade: string;

  @Column({ name: 'number_of_students', type: 'int', default: 0 })
  numberOfStudents: number;

  /** Half-yearly | Annual */
  @Column({ name: 'exam_name', length: 30 })
  examName: string;

  /** % of enrolled students who appeared in the exam */
  @Column({ name: 'students_appeared_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  studentsAppearedPercent: number;

  // ── Grade-wise students number ───────────────────────────
  @Column({ name: 'grade_a_plus', type: 'int', default: 0 })
  gradeAPlus: number;

  @Column({ name: 'grade_a', type: 'int', default: 0 })
  gradeA: number;

  @Column({ name: 'grade_a_minus', type: 'int', default: 0 })
  gradeAMinus: number;

  @Column({ name: 'grade_b', type: 'int', default: 0 })
  gradeB: number;

  @Column({ name: 'grade_c', type: 'int', default: 0 })
  gradeC: number;

  @Column({ name: 'grade_d', type: 'int', default: 0 })
  gradeD: number;

  @Column({ name: 'grade_f', type: 'int', default: 0 })
  gradeF: number;

  // ── Progress indicators (Play & Learn only) ───────────────
  @Column({ name: 'progress_good', type: 'int', nullable: true })
  progressGood: number;

  @Column({ name: 'progress_satisfactory', type: 'int', nullable: true })
  progressSatisfactory: number;

  @Column({ name: 'progress_need_improve', type: 'int', nullable: true })
  progressNeedImprove: number;

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
}
