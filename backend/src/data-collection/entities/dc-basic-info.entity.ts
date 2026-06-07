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

@Entity('dc_basic_information')
@Unique(['schoolId'])
export class DcBasicInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  @Column({ name: 'academic_year', length: 20, nullable: true })
  academicYear: string;

  @Column({ name: 'school_category', length: 30, nullable: true })
  schoolCategory: string; // boys, girls, co_education

  @Column({ name: 'medium_of_instruction', length: 30, nullable: true })
  mediumOfInstruction: string; // bangla, english, both

  @Column({ name: 'shift_system', length: 20, nullable: true })
  shiftSystem: string; // single, double

  @Column({ name: 'has_playground', type: 'boolean', default: false })
  hasPlayground: boolean;

  @Column({ name: 'has_library', type: 'boolean', default: false })
  hasLibrary: boolean;

  @Column({ name: 'has_computer_lab', type: 'boolean', default: false })
  hasComputerLab: boolean;

  @Column({ name: 'has_science_lab', type: 'boolean', default: false })
  hasScienceLab: boolean;

  @Column({ name: 'has_electricity', type: 'boolean', default: false })
  hasElectricity: boolean;

  @Column({ name: 'has_internet', type: 'boolean', default: false })
  hasInternet: boolean;

  @Column({ name: 'has_drinking_water', type: 'boolean', default: false })
  hasDrinkingWater: boolean;

  @Column({ name: 'has_sanitary_facilities', type: 'boolean', default: false })
  hasSanitaryFacilities: boolean;

  @Column({ name: 'total_classrooms', type: 'int', default: 0 })
  totalClassrooms: number;

  @Column({ name: 'operational_classrooms', type: 'int', default: 0 })
  operationalClassrooms: number;

  @Column({ name: 'additional_notes', type: 'text', nullable: true })
  additionalNotes: string;

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
