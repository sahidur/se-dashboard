import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { GeoLocation, GeoLocationType } from './entities/geo-location.entity';
import { CreateGeoLocationDto, UpdateGeoLocationDto } from './dto/geo-location.dto';

@Injectable()
export class GeoLocationsService {
  constructor(
    @InjectRepository(GeoLocation)
    private geoRepo: Repository<GeoLocation>,
  ) {}

  async create(dto: CreateGeoLocationDto): Promise<GeoLocation> {
    const entity = this.geoRepo.create(dto);
    return this.geoRepo.save(entity);
  }

  async findAll(type?: GeoLocationType, parentId?: string): Promise<GeoLocation[]> {
    const where: any = {};
    if (type) where.type = type;
    if (parentId) {
      where.parentId = parentId;
    } else if (!type) {
      // Return top-level (divisions) by default
    }
    return this.geoRepo.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      relations: ['parent'],
      order: { name: 'ASC' },
    });
  }

  async findDivisions(): Promise<GeoLocation[]> {
    return this.geoRepo.find({
      where: { type: GeoLocationType.DIVISION, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findChildren(parentId: string): Promise<GeoLocation[]> {
    return this.geoRepo.find({
      where: { parentId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findTree(): Promise<GeoLocation[]> {
    const divisions = await this.geoRepo.find({
      where: { type: GeoLocationType.DIVISION, isActive: true },
      relations: ['children', 'children.children', 'children.children.children'],
      order: { name: 'ASC' },
    });
    return divisions;
  }

  async findOne(id: string): Promise<GeoLocation> {
    const entity = await this.geoRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!entity) throw new NotFoundException('Geo location not found');
    return entity;
  }

  async update(id: string, dto: UpdateGeoLocationDto): Promise<GeoLocation> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.geoRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.geoRepo.softRemove(entity);
  }
}
