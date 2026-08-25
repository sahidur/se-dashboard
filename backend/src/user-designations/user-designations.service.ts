import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserDesignation } from './entities/user-designation.entity';
import {
  CreateUserDesignationDto,
  UpdateUserDesignationDto,
} from './dto/user-designation.dto';

@Injectable()
export class UserDesignationsService {
  constructor(
    @InjectRepository(UserDesignation)
    private readonly repo: Repository<UserDesignation>,
  ) {}

  async create(dto: CreateUserDesignationDto): Promise<UserDesignation> {
    const existing = await this.repo.findOne({
      where: { name: dto.name },
      withDeleted: true,
    });
    if (existing) {
      if (existing.deletedAt) {
        // Revive a previously soft-deleted designation with the same name.
        existing.deletedAt = null;
        existing.description = dto.description ?? existing.description;
        existing.isActive = dto.isActive ?? true;
        return this.repo.save(existing);
      }
      // Restore an inactive duplicate instead of creating a second row.
      return this.repo.save({ ...existing, ...dto });
    }
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  findAll(activeOnly = false): Promise<UserDesignation[]> {
    return this.repo.find({
      where: activeOnly ? { isActive: true, deletedAt: IsNull() } : undefined,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<UserDesignation> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('User designation not found');
    return entity;
  }

  async update(
    id: string,
    dto: UpdateUserDesignationDto,
  ): Promise<UserDesignation> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.softRemove(entity);
  }
}
