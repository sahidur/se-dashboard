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

/**
 * Fee structure per school / month / grade.
 * One record per combination; upsert on conflict.
 */
@Entity('dc_fee_structure')
@Unique(['schoolId', 'academicYear', 'month', 'grade'])
export class DcFeeStructure {
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

  /** January … December */
  @Column({ length: 20 })
  month: string;

  /** Play & Learn | Nursery | Grade 1 | Grade 2 | Grade 3 | Grade 4 | Grade 5 */
  @Column({ length: 30 })
  grade: string;

  @Column({ name: 'admission_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  admissionFee: number;

  @Column({ name: 'tuition_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  tuitionFee: number;

  @Column({ name: 'session_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sessionFee: number;

  @Column({ name: 'assessment_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  assessmentFee: number;

  @Column({ name: 'sports_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sportsFee: number;

  @Column({ name: 'syllabus_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  syllabusFee: number;

  @Column({ name: 'admission_form', type: 'decimal', precision: 12, scale: 2, default: 0 })
  admissionForm: number;

  @Column({ name: 'testimonial_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  testimonialFee: number;

  /** Others: Badge, Tie, Diary, ID card, Shoulder */
  @Column({ name: 'others_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  othersFee: number;

  @Column({ name: 'transport_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  transportFee: number;

  /** BRAC Primary: exercise/book list charge */
  @Column({ name: 'exercise_book_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  exerciseBookFee: number;

  /** BRAC Secondary: laboratory / library charge */
  @Column({ name: 'lab_library_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  labLibraryFee: number;

  /** BRAC Secondary: project / club activity charge */
  @Column({ name: 'project_club_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  projectClubFee: number;

  /** BRAC Secondary: SSC board registration charge */
  @Column({ name: 'ssc_registration_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sscRegistrationFee: number;

  /** BRAC Secondary: boat fare charge */
  @Column({ name: 'boat_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  boatFee: number;

  /** BRAC Academy: terminal assessment 1 */
  @Column({ name: 'terminal_assessment_1_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  terminalAssessment1Fee: number;

  /** BRAC Academy: terminal assessment 2 */
  @Column({ name: 'terminal_assessment_2_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  terminalAssessment2Fee: number;

  /** BRAC Academy: formative assessment */
  @Column({ name: 'formative_assessment_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  formativeAssessmentFee: number;

  /** BRAC Academy: classroom library */
  @Column({ name: 'classroom_library_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  classroomLibraryFee: number;

  /** BRAC Academy: school event */
  @Column({ name: 'event_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  eventFee: number;

  /** BRAC Academy: play based activity materials */
  @Column({ name: 'play_activity_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  playActivityFee: number;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'updated_by_id', nullable: true })
  updatedById: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
