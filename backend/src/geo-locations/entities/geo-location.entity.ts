import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

// Hierarchy: Area (root) > Division > District > Thana/Upazilla.
export enum GeoLocationType {
  AREA = 'area',
  DIVISION = 'division',
  DISTRICT = 'district',
  THANA = 'thana',
}

@Entity('geo_locations')
export class GeoLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: GeoLocationType,
  })
  type: GeoLocationType;

  @ManyToOne(() => GeoLocation, (loc) => loc.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: GeoLocation;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @OneToMany(() => GeoLocation, (loc) => loc.parent)
  children: GeoLocation[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
