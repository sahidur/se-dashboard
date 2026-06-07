import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SurveyResponse } from './survey-response.entity';
import { SurveyField } from './survey-field.entity';

@Entity('survey_answers')
export class SurveyAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SurveyResponse, (response) => response.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'response_id' })
  response: SurveyResponse;

  @Column({ name: 'response_id' })
  responseId: string;

  @ManyToOne(() => SurveyField)
  @JoinColumn({ name: 'field_id' })
  field: SurveyField;

  @Column({ name: 'field_id' })
  fieldId: string;

  @Column({ type: 'text', nullable: true })
  textValue: string;

  @Column({ type: 'float', nullable: true })
  numberValue: number;

  @Column({ type: 'boolean', nullable: true })
  booleanValue: boolean;

  @Column({ type: 'jsonb', nullable: true })
  jsonValue: any; // For multi-select, location {lat, lng}, file URLs, etc.

  @Column({ nullable: true })
  fileUrl: string; // For file upload answers

  @CreateDateColumn()
  createdAt: Date;
}
