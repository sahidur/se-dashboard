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
 * One record per (school × month) for teachers' professional development data.
 * Up to 12 entries per school (one per month).
 */
@Entity('dc_teachers_development')
@Unique(['schoolId', 'academicYear', 'month'])
export class DcTeachersDevelopment {
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

  /** Full month name: January … December */
  @Column({ length: 20 })
  month: string;

  @Column({ name: 'online_refresher', type: 'int', default: 0 })
  onlineRefresher: number;

  @Column({ name: 'offline_refresher', type: 'int', default: 0 })
  offlineRefresher: number;

  @Column({ name: 'development_forum', type: 'int', default: 0 })
  developmentForum: number;

  @Column({ name: 'basic_training', type: 'int', default: 0 })
  basicTraining: number;

  @Column({ name: 'subject_based_training', type: 'int', default: 0 })
  subjectBasedTraining: number;

  @Column({ name: 'leadership_training', type: 'int', default: 0 })
  leadershipTraining: number;

  @Column({ name: 'others', type: 'int', default: 0 })
  others: number;

  /** % of teachers who left during the year (school-level, reported monthly). */
  @Column({ name: 'teacher_dropout_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  teacherDropoutRate: number | null;

  /** % of head teachers who left during the year. */
  @Column({ name: 'head_teacher_dropout_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  headTeacherDropoutRate: number | null;

  /** @deprecated Superseded by `headTeacherLeadership`; kept so historic records stay readable. */
  @Column({ name: 'head_teacher_leadership_good', type: 'boolean', nullable: true, default: null })
  headTeacherLeadershipGood: boolean | null;

  /** Head teacher leadership assessment: strong | moderate | weak. */
  @Column({ name: 'head_teacher_leadership', type: 'varchar', length: 20, nullable: true })
  headTeacherLeadership: string | null;

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
