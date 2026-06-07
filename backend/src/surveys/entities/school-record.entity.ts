import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

/**
 * A SchoolRecord represents an initial survey record created by a user for a specific school.
 * When a user does a "school initial survey", a SchoolRecord is created linking the user to the school.
 * Subsequent surveys (dropout rate, student status, etc.) reference this SchoolRecord
 * so all data for a school can be aggregated.
 */
@Entity('school_records')
export class SchoolRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @ManyToOne(() => School, { nullable: true, eager: true })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id', nullable: true })
  schoolId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  // The initial survey that created this record
  @Column({ name: 'source_survey_id', nullable: true })
  sourceSurveyId: string;

  // The response that created this record
  @Column({ name: 'source_response_id', nullable: true })
  sourceResponseId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // extra data from the initial survey

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
