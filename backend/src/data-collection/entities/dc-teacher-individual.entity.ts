import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One record per individual teacher in a school.
 * Unlimited entries per school (no unique constraint).
 */
@Entity('dc_teacher_individual')
export class DcTeacherIndividual {
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

  @Column({ length: 200 })
  name: string;

  /** Head Teacher | Assistant Teacher | Junior Teacher */
  @Column({ length: 60 })
  designation: string;

  /** Male | Female */
  @Column({ length: 10 })
  gender: string;

  /** HSC | Hons | Masters */
  @Column({ name: 'educational_qualification', length: 50 })
  educationalQualification: string;

  @Column({ name: 'experience_years', type: 'decimal', precision: 4, scale: 1, default: 0 })
  experienceYears: number;

  /**
   * Comma-separated subject expertise values.
   * Possible: Math, Science, Bangla, English, Others, <custom>
   */
  @Column({ name: 'subject_expertise', type: 'text', nullable: true })
  subjectExpertise: string;

  /**
   * Comma-separated training received values.
   * Possible: Basic, Subject-based, Leadership, Others, <custom>
   */
  @Column({ name: 'training_received', type: 'text', nullable: true })
  trainingReceived: string;

  /** Score 0–100 */
  @Column({ name: 'assessment_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  assessmentScore: number;

  /** Date the teacher joined the school */
  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joiningDate: string | null;

  /** Bangladeshi mobile number, e.g. 01712345678 / +8801712345678 */
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Last working day, if the teacher has left */
  @Column({ name: 'last_working_day', type: 'date', nullable: true })
  lastWorkingDay: string | null;

  /** termination | resignation — set only when the teacher has left */
  @Column({ name: 'separation_type', type: 'varchar', length: 20, nullable: true })
  separationType: string | null;

  /** Required when separationType is set */
  @Column({ name: 'separation_reason', type: 'varchar', length: 500, nullable: true })
  separationReason: string | null;

  /** Long free-text note, required when separationType is set */
  @Column({ name: 'separation_note', type: 'text', nullable: true })
  separationNote: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
