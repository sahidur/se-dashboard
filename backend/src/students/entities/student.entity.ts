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
import { DcSchool } from '../../data-collection/entities/dc-school.entity';
import { SchoolClass } from './school-class.entity';
import { SchoolSection } from './section.entity';
import { AcademicYear } from '../../fee-management/entities/academic-year.entity';
import { User } from '../../users/entities/user.entity';

export enum StudentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRANSFERRED = 'transferred',
  WITHDRAWN = 'withdrawn',
  GRADUATED = 'graduated',
  DROPOUT = 'dropout',
}

export enum StudentGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

@Entity('edu_students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Auto-generated, unique across the system (e.g. BRAC01-2026-0001)
  @Column({ name: 'admission_number', length: 60, unique: true })
  admissionNumber: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: StudentGender, nullable: true })
  gender: StudentGender;

  @Column({ name: 'guardian_name', length: 200, nullable: true })
  guardianName: string;

  @Column({ name: 'guardian_phone', length: 30, nullable: true })
  guardianPhone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  // ---------- Extended profile / demographics ----------
  @Column({ name: 'reference_number', length: 60, nullable: true })
  referenceNumber: string;

  @Column({ name: 'birth_certificate_id', length: 60, nullable: true })
  birthCertificateId: string;

  @Column({ length: 50, nullable: true })
  religion: string;

  @Column({ name: 'language_spoken', length: 50, nullable: true })
  languageSpoken: string;

  @Column({ name: 'is_pwd', type: 'boolean', nullable: true })
  isPwd: boolean;

  @Column({ name: 'mother_name', length: 200, nullable: true })
  motherName: string;

  @Column({ name: 'mother_dob', type: 'date', nullable: true })
  motherDob: Date;

  @Column({ name: 'mother_nid', length: 30, nullable: true })
  motherNid: string;

  @Column({ name: 'mother_education', length: 100, nullable: true })
  motherEducation: string;

  @Column({ name: 'mother_occupation', length: 100, nullable: true })
  motherOccupation: string;

  @Column({ name: 'mother_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  motherIncome: string;

  @Column({ name: 'father_name', length: 200, nullable: true })
  fatherName: string;

  @Column({ name: 'father_dob', type: 'date', nullable: true })
  fatherDob: Date;

  @Column({ name: 'father_nid', length: 30, nullable: true })
  fatherNid: string;

  @Column({ name: 'father_education', length: 100, nullable: true })
  fatherEducation: string;

  @Column({ name: 'father_occupation', length: 100, nullable: true })
  fatherOccupation: string;

  @Column({ name: 'father_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fatherIncome: string;

  @Column({ name: 'parents_income', type: 'decimal', precision: 12, scale: 2, nullable: true })
  parentsIncome: string;

  @Column({ name: 'involve_with_brac_service', type: 'boolean', nullable: true })
  involveWithBracService: boolean;

  @Column({ name: 'is_orphan', type: 'boolean', nullable: true })
  isOrphan: boolean;

  @Column({ name: 'attended_brac_other_service', type: 'boolean', nullable: true })
  attendedBracOtherService: boolean;

  @Column({ name: 'participate_with_other_ngo', type: 'boolean', nullable: true })
  participateWithOtherNgo: boolean;

  @Column({ name: 'waiver_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  waiverPercent: string;

  @Column({ name: 'bkash_number', length: 20, nullable: true })
  bkashNumber: string;

  @ManyToOne(() => DcSchool, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => AcademicYear, { nullable: true })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id', nullable: true })
  academicYearId: string;

  @ManyToOne(() => SchoolClass, { nullable: true })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @Column({ name: 'class_id', nullable: true })
  classId: string;

  @ManyToOne(() => SchoolSection, { nullable: true })
  @JoinColumn({ name: 'section_id' })
  section: SchoolSection;

  @Column({ name: 'section_id', nullable: true })
  sectionId: string;

  @Column({ name: 'roll_number', type: 'int', nullable: true })
  rollNumber: number;

  @Column({ name: 'admission_date', type: 'date', nullable: true })
  admissionDate: Date;

  @Column({ type: 'enum', enum: StudentStatus, default: StudentStatus.ACTIVE })
  status: StudentStatus;

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
