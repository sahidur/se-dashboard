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
 * One record per (school × month × grade).
 * 12 grades × 12 months = up to 144 entries per school.
 */
@Entity('dc_students_info')
@Unique(['schoolId', 'academicYear', 'month', 'grade'])
export class DcStudentsInfo {
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

  /** e.g. 'January' … 'December' */
  @Column({ name: 'month', length: 20 })
  month: string;

  /** 'play_learn' | 'nursery' | 'g1' … 'g10' */
  @Column({ name: 'grade', length: 20 })
  grade: string;

  @Column({ name: 'boys', type: 'int', default: 0 })
  boys: number;

  @Column({ name: 'girls', type: 'int', default: 0 })
  girls: number;

  /** Stored sum of boys + girls */
  @Column({ name: 'total', type: 'int', default: 0 })
  total: number;

  @Column({ name: 'persons_with_disability', type: 'int', default: 0 })
  personsWithDisability: number;

  @Column({ name: 'ethnic', type: 'int', default: 0 })
  ethnic: number;

  @Column({ name: 'attendance_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  attendanceRate: number;

  @Column({ name: 'dropout_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  dropoutRate: number;

  @Column({ name: 'replaced_students_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  replacedStudentsRate: number;

  @Column({ name: 'retention_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  retentionRate: number;

  @Column({ name: 'remedial_support', type: 'int', default: 0 })
  remedialSupport: number;

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
