import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
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
