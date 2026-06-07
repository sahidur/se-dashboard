import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Survey } from './survey.entity';
import { SurveyField } from './survey-field.entity';

@Entity('survey_sections')
export class SurveySection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 0 })
  order: number;

  @ManyToOne(() => Survey, (survey) => survey.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey: Survey;

  @Column({ name: 'survey_id' })
  surveyId: string;

  @OneToMany(() => SurveyField, (field) => field.section, { cascade: true, eager: true })
  fields: SurveyField[];

  @CreateDateColumn()
  createdAt: Date;
}
