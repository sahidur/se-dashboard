import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Survey } from '../surveys/entities/survey.entity';
import { User } from '../users/entities/user.entity';
import { SurveyCategory } from '../surveys/entities/survey-category.entity';
import { SchoolRecord } from '../surveys/entities/school-record.entity';
import { School } from '../schools/entities/school.entity';
import { GeoLocation } from '../geo-locations/entities/geo-location.entity';

export type RecycleBinEntityType =
  | 'survey'
  | 'user'
  | 'category'
  | 'school-record'
  | 'school'
  | 'geo-location';

// Enum object used for runtime validation via ParseEnumPipe
export const RECYCLE_BIN_ENTITY_TYPES = {
  SURVEY: 'survey',
  USER: 'user',
  CATEGORY: 'category',
  SCHOOL_RECORD: 'school-record',
  SCHOOL: 'school',
  GEO_LOCATION: 'geo-location',
} as const;

@Injectable()
export class RecycleBinService {
  constructor(
    @InjectRepository(Survey)
    private surveysRepo: Repository<Survey>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(SurveyCategory)
    private categoriesRepo: Repository<SurveyCategory>,
    @InjectRepository(SchoolRecord)
    private schoolRecordsRepo: Repository<SchoolRecord>,
    @InjectRepository(School)
    private schoolsRepo: Repository<School>,
    @InjectRepository(GeoLocation)
    private geoLocationsRepo: Repository<GeoLocation>,
  ) {}

  async findAllDeleted() {
    const [surveys, users, categories, schoolRecords, schools, geoLocations] =
      await Promise.all([
        this.surveysRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'title', 'category', 'status', 'deletedAt', 'createdAt'],
        }),
        this.usersRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'firstName', 'lastName', 'email', 'deletedAt', 'createdAt'],
        }),
        this.categoriesRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
        }),
        this.schoolRecordsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'deletedAt', 'createdAt'],
        }),
        this.schoolsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'code', 'deletedAt', 'createdAt'],
        }),
        this.geoLocationsRepo.find({
          withDeleted: true,
          where: { deletedAt: Not(IsNull()) },
          select: ['id', 'name', 'type', 'deletedAt', 'createdAt'],
        }),
      ]);

    return {
      surveys: surveys.map((s) => ({
        ...s,
        entityType: 'survey' as const,
        displayName: s.title,
      })),
      users: users.map((u) => ({
        ...u,
        entityType: 'user' as const,
        displayName: `${u.firstName} ${u.lastName}`,
      })),
      categories: categories.map((c) => ({
        ...c,
        entityType: 'category' as const,
        displayName: c.name,
      })),
      schoolRecords: schoolRecords.map((sr) => ({
        ...sr,
        entityType: 'school-record' as const,
        displayName: sr.name,
      })),
      schools: schools.map((s) => ({
        ...s,
        entityType: 'school' as const,
        displayName: s.name,
      })),
      geoLocations: geoLocations.map((g) => ({
        ...g,
        entityType: 'geo-location' as const,
        displayName: g.name,
      })),
    };
  }

  async restore(entityType: RecycleBinEntityType, id: string, actorId?: string) {
    const repo = this.getRepository(entityType);
    const entity = await repo.findOne({
      withDeleted: true,
      where: { id } as any,
    });
    if (!entity || !(entity as any).deletedAt) {
      throw new NotFoundException('Deleted item not found');
    }
    // Restoring a soft-deleted account resurrects it — same takeover risk as
    // editing a live user, so the privilege-hierarchy rule applies.
    if (entityType === 'user') {
      await this.assertCanManageDeletedUser(id, actorId);
    }
    (entity as any).deletedAt = null;
    await repo.save(entity as any);
    return { message: `${entityType} restored successfully` };
  }

  async permanentDelete(entityType: RecycleBinEntityType, id: string, actorId?: string) {
    const repo = this.getRepository(entityType);
    const entity = await repo.findOne({
      withDeleted: true,
      where: { id } as any,
    });
    if (!entity || !(entity as any).deletedAt) {
      throw new NotFoundException(
        'Item not found in recycle bin. Only soft-deleted items can be permanently removed.',
      );
    }
    if (entityType === 'user') {
      await this.assertCanManageDeletedUser(id, actorId);
    }
    await repo.remove(entity as any);
    return { message: `${entityType} permanently deleted` };
  }

  /**
   * Restoring/hard-deleting soft-deleted users bypasses every live-user
   * hierarchy guard, so enforce the same rule here: a non-Super-Admin may
   * only manage deleted users whose strongest role is weaker than their own.
   */
  private async assertCanManageDeletedUser(
    targetUserId: string,
    actorId?: string,
  ): Promise<void> {
    if (!actorId) return; // internal/system callers (seeding, scripts)
    const [actor, target] = await Promise.all([
      this.usersRepo.findOne({
        where: { id: actorId },
        relations: ['roles'],
      }),
      this.usersRepo.findOne({
        withDeleted: true,
        where: { id: targetUserId },
        relations: ['roles'],
      }),
    ]);
    const isSuperAdmin = (actor?.roles || []).some(
      (r) => r.name === 'Super Admin',
    );
    if (!actor || isSuperAdmin) return;
    const bestOf = (roles?: any[] | null) =>
      Math.min(
        ...(roles || []).map((r) => r.hierarchy ?? Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY,
      );
    if (bestOf(target?.roles) < bestOf(actor.roles)) {
      throw new ForbiddenException(
        'You cannot restore or permanently delete users who have more privileges than you',
      );
    }
  }

  private getRepository(
    entityType: RecycleBinEntityType,
  ): Repository<any> {
    switch (entityType) {
      case 'survey':
        return this.surveysRepo;
      case 'user':
        return this.usersRepo;
      case 'category':
        return this.categoriesRepo;
      case 'school-record':
        return this.schoolRecordsRepo;
      case 'school':
        return this.schoolsRepo;
      case 'geo-location':
        return this.geoLocationsRepo;
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }
}
