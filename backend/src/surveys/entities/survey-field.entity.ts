import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Survey } from './survey.entity';
import { SurveySection } from './survey-section.entity';

export enum FieldType {
  SHORT_TEXT = 'short_text',
  LONG_TEXT = 'long_text',
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  DROPDOWN = 'dropdown',
  NUMBER = 'number',
  SINGLE_SELECT_SEARCHABLE = 'single_select_searchable',
  MULTI_SELECT_SEARCHABLE = 'multi_select_searchable',
  TRUE_FALSE = 'true_false',
  LOCATION = 'location',
  FILE_UPLOAD = 'file_upload',
  DATE = 'date',
  EMAIL = 'email',
  PHONE = 'phone',
  ADDRESS = 'address',
}

@Entity('survey_fields')
export class SurveyField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  label: string;

  @Column({ length: 255, nullable: true, unique: true })
  fieldName: string; // Unique slug for analytics/dashboards (e.g., "school_dropout_count")

  @Column({
    type: 'enum',
    enum: FieldType,
  })
  fieldType: FieldType;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null; // For choice/dropdown fields

  @Column({ type: 'jsonb', nullable: true })
  validationRules: Record<string, any> | null; // min, max, pattern, etc.

  @Column({ nullable: true })
  placeholder: string;

  @Column({ nullable: true })
  helpText: string;

  @Column({ default: 0 })
  order: number;

  @Column({ nullable: true })
  allowedFileTypes: string; // e.g., "image/*,video/*,audio/*,.pdf"

  @Column({ nullable: true })
  maxFileSize: number; // In bytes

  @ManyToOne(() => Survey, (survey) => survey.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey: Survey;

  @Column({ name: 'survey_id' })
  surveyId: string;

  @ManyToOne(() => SurveySection, (section) => section.fields, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: SurveySection;

  @Column({ name: 'section_id', nullable: true })
  sectionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
