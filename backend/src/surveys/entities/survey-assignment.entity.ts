import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Survey } from './survey.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { School } from '../../schools/entities/school.entity';

@Entity('survey_assignments')
export class SurveyAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Survey, (survey) => survey.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'survey_id' })
  survey: Survey;

  @Column({ name: 'survey_id' })
  surveyId: string;

  // Assign to a specific user
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  // Assign to a role (all users with that role)
  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'role_id', nullable: true })
  roleId: string;

  // Assign to a school
  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'school_id', nullable: true })
  schoolId: string;

  // For "role except specific users" assignment type
  @Column({ type: 'jsonb', nullable: true })
  excludeUserIds: string[];

  @CreateDateColumn()
  createdAt: Date;
}
