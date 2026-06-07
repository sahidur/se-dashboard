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
import { User } from '../../users/entities/user.entity';

@Entity('dc_schools')
export class DcSchool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  district: string;

  @Column({ length: 100, nullable: true })
  division: string;

  @Column({ length: 100, nullable: true })
  upazila: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'principal_name', length: 200, nullable: true })
  principalName: string;

  @Column({ name: 'established_year', type: 'int', nullable: true })
  establishedYear: number;

  @Column({ name: 'school_type', length: 50, nullable: true })
  schoolType: string;

  @Column({ name: 'school_category', length: 100, nullable: true })
  schoolCategory: string;

  @Column({ name: 'government_approval', type: 'boolean', nullable: true })
  governmentApproval: boolean;

  @Column({ name: 'total_teachers', type: 'int', nullable: true })
  totalTeachers: number;

  @Column({ name: 'total_students', type: 'int', nullable: true })
  totalStudents: number;

  @Column({ name: 'grade_coverage', length: 200, nullable: true })
  gradeCoverage: string;

  @ManyToOne(() => User, { eager: true })
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
