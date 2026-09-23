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
import { User } from '../../users/entities/user.entity';

// AOP (Annual Operating Plan) target student count per school + academic year
// + class. This is the PLANNED baseline: planned revenue = target students ×
// standard fee structure — with no discounts and no relation to the
// actually-enrolled student list of the school.
@Entity('edu_aop_targets')
@Unique('uq_aop_target', ['schoolId', 'academicYearId', 'classId'])
export class AopTarget {
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

  // Planned (budgeted) number of students for this class
  @Column({ name: 'target_students', type: 'int', default: 0 })
  targetStudents: number;

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