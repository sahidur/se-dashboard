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

@Entity('dc_performance')
@Unique(['schoolId', 'academicYear'])
export class DcPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** Academic year the record belongs to, e.g. 2026 */
  @Column({ name: 'academic_year', type: 'int', default: 0 })
  academicYear: number;

  @Column({ name: 'avg_pass_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgPassRate: number;

  @Column({ name: 'avg_gpa', type: 'decimal', precision: 3, scale: 2, default: 0 })
  avgGpa: number;

  @Column({ name: 'board_exam_pass_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  boardExamPassRate: number;

  @Column({ name: 'board_exam_avg_gpa', type: 'decimal', precision: 3, scale: 2, default: 0 })
  boardExamAvgGpa: number;

  @Column({ name: 'extracurricular_activities', type: 'text', nullable: true })
  extracurricularActivities: string;

  @Column({ name: 'sports_achievements', type: 'text', nullable: true })
  sportsAchievements: string;

  @Column({ name: 'cultural_activities', type: 'text', nullable: true })
  culturalActivities: string;

  @Column({ name: 'science_fair_participation', type: 'int', default: 0 })
  scienceFairParticipation: number;

  @Column({ name: 'debate_competitions', type: 'int', default: 0 })
  debateCompetitions: number;

  @Column({ name: 'total_awards', type: 'int', default: 0 })
  totalAwards: number;

  @Column({ name: 'teaching_methodology', type: 'text', nullable: true })
  teachingMethodology: string;

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
