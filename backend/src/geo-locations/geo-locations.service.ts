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

  async findAreas(): Promise<GeoLocation[]> {
    return this.geoRepo.find({
      where: { type: GeoLocationType.AREA, isActive: true },
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
    // Root nodes are whichever locations have no parent (top of whatever
    // hierarchy is configured on the frontend, e.g. Area > Division >
    // District > Thana/Upazilla). Using parentId IS NULL instead of a
    // hardcoded type keeps this correct even if the hierarchy is reordered.
    const roots = await this.geoRepo.find({
      where: { parentId: IsNull() },
      relations: [
        'children',
        'children.children',
        'children.children.children',
        'children.children.children.children',
      ],
      order: { name: 'ASC' },
    });
    return roots;
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
    // Soft-remove the entity AND all of its descendants (recursively).
    // Without this, children were left "active" in the DB with a parentId
    // pointing at a soft-deleted (invisible) parent -- orphaned data that
    // could still surface in child-lookups/dropdowns elsewhere in the app.
    const toRemove = await this.collectWithDescendants(entity);
    await this.geoRepo.softRemove(toRemove);
  }

  private async collectWithDescendants(root: GeoLocation): Promise<GeoLocation[]> {
    const all: GeoLocation[] = [root];
    let frontier: GeoLocation[] = [root];
    while (frontier.length > 0) {
      const children = await this.geoRepo.find({
        where: frontier.map((f) => ({ parentId: f.id })),
      });
      if (children.length === 0) break;
      all.push(...children);
      frontier = children;
    }
    return all;
  }
}
