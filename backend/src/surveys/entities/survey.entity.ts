import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SurveyField } from './survey-field.entity';
import { SurveySection } from './survey-section.entity';
import { SurveyResponse } from './survey-response.entity';
import { SurveyAssignment } from './survey-assignment.entity';
import { SurveyStatusLog } from './survey-status-log.entity';

export enum SurveyStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

// Whether this survey requires linking to a school record
export enum LinkedEntityType {
  NONE = 'none',
  SCHOOL_RECORD = 'school_record',
}

@Entity('surveys')
export class Survey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100 })
  category: string;

  @Column({
    type: 'enum',
    enum: SurveyStatus,
    default: SurveyStatus.DRAFT,
  })
  status: SurveyStatus;

  // Once a survey has been published, it can never be deleted
  @Column({ name: 'was_published', default: false })
  wasPublished: boolean;

  @Column({ nullable: true })
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  // Whether this survey should be linked to a school record when filling
  @Column({
    type: 'enum',
    enum: LinkedEntityType,
    default: LinkedEntityType.NONE,
    name: 'linked_entity_type',
  })
  linkedEntityType: LinkedEntityType;

  // If this survey IS the initial survey that creates school records
  @Column({ name: 'creates_school_record', default: false })
  createsSchoolRecord: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @OneToMany(() => SurveyField, (field) => field.survey, {
    cascade: true,
    eager: true,
  })
  fields: SurveyField[];

  @OneToMany(() => SurveySection, (section) => section.survey, {
    cascade: true,
    eager: true,
  })
  sections: SurveySection[];

  @OneToMany(() => SurveyResponse, (response) => response.survey)
  responses: SurveyResponse[];

  @OneToMany(() => SurveyAssignment, (assignment) => assignment.survey, {
    cascade: true,
  })
  assignments: SurveyAssignment[];

  @OneToMany(() => SurveyStatusLog, (log) => log.survey)
  statusLogs: SurveyStatusLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
