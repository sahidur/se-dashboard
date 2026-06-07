import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  hierarchy: number; // Lower number = higher authority

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @OneToMany(() => Permission, (permission) => permission.role, {
    cascade: true,
    eager: true,
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
