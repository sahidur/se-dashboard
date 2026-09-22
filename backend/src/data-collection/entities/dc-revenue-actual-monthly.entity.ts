import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Monthly revenue target + achievement per fee type — Actual view.
 * One record per (school, month). Fee columns are filtered on the frontend
 * by the school's category; the union of all categories is stored here.
 */
@Entity('dc_revenue_actual_monthly')
@Unique(['schoolId', 'academicYear', 'month'])
export class DcRevenueActualMonthly {
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

  @Column({ name: 'tuition_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  tuitionFeeTarget: number;

  @Column({ name: 'tuition_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  tuitionFeeAchievement: number;

  /* Category-scoped monthly fee target/achievement pairs (BRAC Primary /
     Secondary / Academy). Only the pairs matching the school's category are
     shown per school; all are stored so the union covers every category. */

  @Column({ name: 'admission_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFeeTarget: number;

  @Column({ name: 'admission_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFeeAchievement: number;

  @Column({ name: 'session_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sessionFeeTarget: number;

  @Column({ name: 'session_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sessionFeeAchievement: number;

  @Column({ name: 'assessment_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  assessmentFeeTarget: number;

  @Column({ name: 'assessment_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  assessmentFeeAchievement: number;

  @Column({ name: 'sports_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sportsFeeTarget: number;

  @Column({ name: 'sports_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sportsFeeAchievement: number;

  @Column({ name: 'syllabus_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  syllabusFeeTarget: number;

  @Column({ name: 'syllabus_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  syllabusFeeAchievement: number;

  @Column({ name: 'admission_form_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFormTarget: number;

  @Column({ name: 'admission_form_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  admissionFormAchievement: number;

  @Column({ name: 'testimonial_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  testimonialFeeTarget: number;

  @Column({ name: 'testimonial_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  testimonialFeeAchievement: number;

  @Column({ name: 'others_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  othersFeeTarget: number;

  @Column({ name: 'others_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  othersFeeAchievement: number;

  @Column({ name: 'transport_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  transportFeeTarget: number;

  @Column({ name: 'transport_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  transportFeeAchievement: number;

  @Column({ name: 'exercise_book_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  exerciseBookFeeTarget: number;

  @Column({ name: 'exercise_book_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  exerciseBookFeeAchievement: number;

  @Column({ name: 'lab_library_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  labLibraryFeeTarget: number;

  @Column({ name: 'lab_library_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  labLibraryFeeAchievement: number;

  @Column({ name: 'project_club_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  projectClubFeeTarget: number;

  @Column({ name: 'project_club_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  projectClubFeeAchievement: number;

  @Column({ name: 'ssc_registration_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sscRegistrationFeeTarget: number;

  @Column({ name: 'ssc_registration_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  sscRegistrationFeeAchievement: number;

  @Column({ name: 'boat_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  boatFeeTarget: number;

  @Column({ name: 'boat_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  boatFeeAchievement: number;

  @Column({ name: 'terminal_assessment1_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  terminalAssessment1FeeTarget: number;

  @Column({ name: 'terminal_assessment1_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  terminalAssessment1FeeAchievement: number;

  @Column({ name: 'terminal_assessment2_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  terminalAssessment2FeeTarget: number;

  @Column({ name: 'terminal_assessment2_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  terminalAssessment2FeeAchievement: number;

  @Column({ name: 'formative_assessment_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  formativeAssessmentFeeTarget: number;

  @Column({ name: 'formative_assessment_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  formativeAssessmentFeeAchievement: number;

  @Column({ name: 'classroom_library_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  classroomLibraryFeeTarget: number;

  @Column({ name: 'classroom_library_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  classroomLibraryFeeAchievement: number;

  @Column({ name: 'event_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  eventFeeTarget: number;

  @Column({ name: 'event_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  eventFeeAchievement: number;

  @Column({ name: 'play_activity_fee_target', type: 'decimal', precision: 14, scale: 2, default: 0 })
  playActivityFeeTarget: number;

  @Column({ name: 'play_activity_fee_achievement', type: 'decimal', precision: 14, scale: 2, default: 0 })
  playActivityFeeAchievement: number;

  /** Stored for quick reporting; computed from target/achievement */
  @Column({ name: 'collection_pct', type: 'decimal', precision: 7, scale: 2, default: 0 })
  collectionPct: number;

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
