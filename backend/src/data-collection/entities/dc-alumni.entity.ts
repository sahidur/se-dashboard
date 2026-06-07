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

@Entity('dc_alumni')
export class DcAlumni {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ name: 'alumni_name', length: 200 })
  alumniName: string;

  @Column({ name: 'graduation_year', type: 'int', nullable: true })
  graduationYear: number;

  @Column({ name: 'present_address', type: 'text', nullable: true })
  presentAddress: string;

  @Column({ name: 'current_occupation', length: 200, nullable: true })
  currentOccupation: string;

  @Column({ name: 'higher_education', length: 300, nullable: true })
  higherEducation: string;

  @Column({ length: 200, nullable: true })
  institution: string;

  @Column({ name: 'contact_phone', length: 20, nullable: true })
  contactPhone: string;

  @Column({ name: 'contact_email', length: 100, nullable: true })
  contactEmail: string;

  @Column({ type: 'text', nullable: true })
  achievements: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

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
