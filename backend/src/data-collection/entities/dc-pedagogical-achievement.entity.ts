import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  DeleteDateColumn,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Scholarship/achievement data per school per year.
 * One record per school + year combination; upsert on conflict.
 */
@Entity('dc_pedagogical_achievement')
@Unique(['schoolId', 'year'])
export class DcPedagogicalAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DcSchool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: DcSchool;

  @Column({ name: 'school_id' })
  schoolId: string;

  /** Academic year e.g. 2024 */
  @Column({ type: 'int' })
  year: number;

  // ── KG Scholarship ──────────────────────────────────────
  @Column({ name: 'kg_participated', type: 'int', default: 0 })
  kgParticipated: number;

  @Column({ name: 'kg_scholarship', type: 'int', default: 0 })
  kgScholarship: number;

  /** Retained for historical records; no longer collected by the form. */
  @Column({ name: 'kg_unique_approach', type: 'text', nullable: true })
  kgUniqueApproach: string;

  // ── Primary Scholarship ─────────────────────────────────
  @Column({ name: 'primary_participated', type: 'int', default: 0 })
  primaryParticipated: number;

  @Column({ name: 'primary_scholarship', type: 'int', default: 0 })
  primaryScholarship: number;

  @Column({ name: 'primary_unique_approach', type: 'text', nullable: true })
  primaryUniqueApproach: string;

  // ── Junior Scholarship ──────────────────────────────────
  @Column({ name: 'jr_participated', type: 'int', default: 0 })
  jrParticipated: number;

  @Column({ name: 'jr_scholarship', type: 'int', default: 0 })
  jrScholarship: number;

  @Column({ name: 'jr_unique_approach', type: 'text', nullable: true })
  jrUniqueApproach: string;

  // ── SSC ─────────────────────────────────────────────────
  @Column({ name: 'ssc_participated', type: 'int', default: 0 })
  sscParticipated: number;

  @Column({ name: 'ssc_scholarship', type: 'int', default: 0 })
  sscScholarship: number;

  @Column({ name: 'ssc_unique_approach', type: 'text', nullable: true })
  sscUniqueApproach: string;

  // ── Others ──────────────────────────────────────────────
  @Column({ name: 'others_participated', type: 'int', default: 0 })
  othersParticipated: number;

  @Column({ name: 'others_scholarship', type: 'int', default: 0 })
  othersScholarship: number;

  @Column({ name: 'others_unique_approach', type: 'text', nullable: true })
  othersUniqueApproach: string;

  // ── Sir Fazle Hasan Abed Talent Grants ──────────────────
  @Column({ name: 'talent_grant_participated', type: 'int', default: 0 })
  talentGrantParticipated: number;

  @Column({ name: 'talent_grant_awarded', type: 'int', default: 0 })
  talentGrantAwarded: number;

  // ── Audit ────────────────────────────────────────────────
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
