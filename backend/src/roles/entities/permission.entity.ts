import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

export enum ActionType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  module: string; // e.g., 'dashboard', 'users', 'roles', 'surveys', 'schools'

  /**
   * Optional sub-resource within the module (e.g. a data-collection form key
   * like 'alumni' or 'revenue/budget/total'). NULL acts as a wildcard and
   * covers every resource in the module.
   */
  @Column({ length: 100, nullable: true })
  resource: string | null;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  action: ActionType;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'role_id' })
  roleId: string;

  @CreateDateColumn()
  createdAt: Date;
}
