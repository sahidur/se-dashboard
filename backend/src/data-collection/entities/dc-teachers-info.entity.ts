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

@Entity('dc_teachers_info')
@Unique(['schoolId'])
export class DcTeachersInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ name: 'total_teachers_male', type: 'int', default: 0 })
  totalTeachersMale: number;

  @Column({ name: 'total_teachers_female', type: 'int', default: 0 })
  totalTeachersFemale: number;

  @Column({ name: 'permanent_teachers', type: 'int', default: 0 })
  permanentTeachers: number;

  @Column({ name: 'contract_teachers', type: 'int', default: 0 })
  contractTeachers: number;

  @Column({ name: 'trained_teachers', type: 'int', default: 0 })
  trainedTeachers: number;

  @Column({ name: 'untrained_teachers', type: 'int', default: 0 })
  untrainedTeachers: number;

  @Column({ name: 'avg_experience_years', type: 'decimal', precision: 4, scale: 1, default: 0 })
  avgExperienceYears: number;

  @Column({ name: 'teacher_student_ratio', length: 20, nullable: true })
  teacherStudentRatio: string;

  @Column({ name: 'vacant_positions', type: 'int', default: 0 })
  vacantPositions: number;

  @Column({ name: 'teachers_with_bed', type: 'int', default: 0 })
  teachersWithBEd: number;

  @Column({ name: 'teachers_with_med', type: 'int', default: 0 })
  teachersWithMEd: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

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
