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
import { DcSchool } from '../../data-collection/entities/dc-school.entity';
import { SchoolClass } from '../../students/entities/school-class.entity';
import { AcademicYear } from './academic-year.entity';
import { FeeHead } from './fee-head.entity';
import { User } from '../../users/entities/user.entity';

// Standard fee: Academic Year + School + Class + Month + Fee Head.
// Sections never have their own fee — every section of the class inherits this.
@Entity('edu_fee_structures')
@Unique('uq_fee_structure', [
  'schoolId',
  'academicYearId',
  'classId',
  'month',
  'feeHeadId',
])
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { nullable: false })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => AcademicYear, { nullable: false })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'academic_year_id' })
  academicYearId: string;

  @ManyToOne(() => SchoolClass, { nullable: false })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @Column({ name: 'class_id' })
  classId: string;

  // 1 = January ... 12 = December
  @Column({ type: 'int' })
  month: number;

  @ManyToOne(() => FeeHead, { nullable: false })
  @JoinColumn({ name: 'fee_head_id' })
  feeHead: FeeHead;

  @Column({ name: 'fee_head_id' })
  feeHeadId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: string;

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
