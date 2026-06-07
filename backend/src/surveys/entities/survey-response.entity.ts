import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Survey } from './survey.entity';
import { User } from '../../users/entities/user.entity';
import { SurveyAnswer } from './survey-answer.entity';
import { SchoolRecord } from './school-record.entity';

@Entity('survey_responses')
export class SurveyResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Survey, (survey) => survey.responses)
  @JoinColumn({ name: 'survey_id' })
  survey: Survey;

  @Column({ name: 'survey_id' })
  surveyId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'respondent_id' })
  respondent: User;

  @Column({ name: 'respondent_id' })
  respondentId: string;

  // Link to the school record this response is about
  @ManyToOne(() => SchoolRecord, { nullable: true, eager: true })
  @JoinColumn({ name: 'school_record_id' })
  schoolRecord: SchoolRecord;

  @Column({ name: 'school_record_id', nullable: true })
  schoolRecordId: string;

  @Column({ default: false })
  isComplete: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // location, device info, etc.

  @OneToMany(() => SurveyAnswer, (answer) => answer.response, {
    cascade: true,
    eager: true,
  })
  answers: SurveyAnswer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
