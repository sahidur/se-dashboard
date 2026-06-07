import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('survey_status_logs')
export class SurveyStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Survey', 'statusLogs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey: any;

  @Column({ name: 'survey_id' })
  surveyId: string;

  @Column({ type: 'varchar', name: 'from_status' })
  fromStatus: string;

  @Column({ type: 'varchar', name: 'to_status' })
  toStatus: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @Column({ name: 'changed_by' })
  changedById: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
