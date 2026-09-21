import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';
import { DcSchool } from './dc-school.entity';
import { User } from '../../users/entities/user.entity';

@Entity('dc_infrastructure')
@Unique(['schoolId', 'academicYear'])
export class DcInfrastructure {
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

  // ── Infrastructure Status ──────────────────────────────────

  @Column({ name: 'campus_status', length: 20, nullable: true })
  campusStatus: string; // 'Rented' | 'Own'

  @Column({ name: 'building_status', type: 'text', nullable: true })
  buildingStatus: string; // JSON-encoded array of selected building types

  // Room counts
  @Column({ name: 'room_head_teachers', type: 'int', default: 0 })
  roomHeadTeachers: number;

  @Column({ name: 'room_teachers', type: 'int', default: 0 })
  roomTeachers: number;

  @Column({ name: 'room_classroom', type: 'int', default: 0 })
  roomClassroom: number;

  @Column({ name: 'room_playroom', type: 'int', default: 0 })
  roomPlayroom: number;

  @Column({ name: 'room_library', type: 'int', default: 0 })
  roomLibrary: number;

  @Column({ name: 'room_lab', type: 'int', default: 0 })
  roomLab: number;

  @Column({ name: 'room_storeroom', type: 'int', default: 0 })
  roomStoreroom: number;

  @Column({ name: 'room_kitchen', type: 'int', default: 0 })
  roomKitchen: number;

  @Column({ name: 'room_sickbay', type: 'int', default: 0 })
  roomSickbay: number;

  @Column({ name: 'room_others', type: 'int', default: 0 })
  roomOthers: number;

  @Column({ name: 'room_total', type: 'int', default: 0 })
  roomTotal: number;

  // Washrooms
  @Column({ name: 'washroom_male', type: 'int', default: 0 })
  washroomMale: number;

  @Column({ name: 'washroom_female', type: 'int', default: 0 })
  washroomFemale: number;

  // Facility booleans
  @Column({ name: 'has_hand_wash_point', type: 'boolean', nullable: true, default: null })
  hasHandWashPoint: boolean | null;

  @Column({ name: 'has_playground', type: 'boolean', nullable: true, default: null })
  hasPlayground: boolean | null;

  @Column({ name: 'has_school_garden', type: 'boolean', nullable: true, default: null })
  hasSchoolGarden: boolean | null;

  @Column({ name: 'infra_renovation_required', type: 'boolean', nullable: true, default: null })
  infraRenovationRequired: boolean | null;

  // ── Classroom Status ───────────────────────────────────────

  @Column({ name: 'digitally_equipped_classrooms', type: 'int', default: 0 })
  digitallyEquippedClassrooms: number;

  @Column({ name: 'floor_sitting_classrooms', type: 'int', default: 0 })
  floorSittingClassrooms: number;

  @Column({ name: 'classrooms_with_whiteboard', type: 'int', default: 0 })
  classroomsWithWhiteboard: number;

  @Column({ name: 'classrooms_with_blackboard', type: 'int', default: 0 })
  classroomsWithBlackboard: number;

  @Column({ name: 'classroom_new_furniture', type: 'boolean', nullable: true, default: null })
  classroomNewFurniture: boolean | null;

  @Column({ name: 'classroom_renovation_required', type: 'boolean', nullable: true, default: null })
  classroomRenovationRequired: boolean | null;

  /** Details of the renovation needed; mandatory when classroomRenovationRequired is true */
  @Column({ name: 'classroom_renovation_details', type: 'text', nullable: true })
  classroomRenovationDetails: string;

  @Column({ name: 'classroom_emergency_exit', type: 'boolean', nullable: true, default: null })
  classroomEmergencyExit: boolean | null;

  // ── Infrastructure Assets ──────────────────────────────────

  @Column({ name: 'infra_total_assets', type: 'int', default: 0 })
  infraTotalAssets: number;

  @Column({ name: 'infra_total_projectors', type: 'int', default: 0 })
  infraTotalProjectors: number;

  @Column({ name: 'infra_total_laptops', type: 'int', default: 0 })
  infraTotalLaptops: number;

  @Column({ name: 'infra_total_pcs', type: 'int', default: 0 })
  infraTotalPcs: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
