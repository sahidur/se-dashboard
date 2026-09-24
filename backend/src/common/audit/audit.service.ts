import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { UsersService } from '../../users/users.service';
import { getAuditContext } from './audit-context';
import { PRIVILEGED_AUDIT_MODULES } from './privileged-modules';
import { sanitizeAuditData } from './sanitize-audit-data';

// Kept as a re-export so existing importers of `PRIVILEGED_AUDIT_MODULES`
// from './audit.service' keep working; the definition lives in
// ./privileged-modules (shared with services that cannot depend on this one).
export { PRIVILEGED_AUDIT_MODULES };

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly usersService: UsersService,
  ) {}

  /** Whether the given acting user is a Super Admin. */
  async isSuperAdmin(actorId?: string): Promise<boolean> {
    if (!actorId) return false;
    try {
      const actor = await this.usersService.findOneById(actorId);
      return (actor?.roles || []).some((r) => r.name === 'Super Admin');
    } catch {
      return false;
    }
  }

  /** Hide privileged (role/permission) entries from non-Super-Admin viewers. */
  private applyPrivilegedFilter(
    qb: SelectQueryBuilder<AuditLog>,
    isSuperAdmin: boolean,
  ): SelectQueryBuilder<AuditLog> {
    if (!isSuperAdmin) {
      qb.andWhere('log.module NOT IN (:...privileged)', {
        privileged: PRIVILEGED_AUDIT_MODULES,
      });
    }
    return qb;
  }

  /**
   * Explicit audit write used by services that want to record a richer,
   * human-readable entry than the automatic entity subscriber provides
   * (e.g. role permission diffs). Acting user / IP / browser are resolved
   * from the per-request audit context.
   */
  async record(entry: {
    action: string;
    module: string;
    entityId?: string;
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
  }): Promise<void> {
    const ctx = getAuditContext();
    try {
      await this.auditLogRepository.insert({
        ...entry,
        oldData: sanitizeAuditData(entry.oldData),
        newData: sanitizeAuditData(entry.newData),
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Logging must never break the primary operation.
    }
  }

  /** Base query joining the acting user (password/refreshToken are @Exclude'd). */
  private baseQuery(): SelectQueryBuilder<AuditLog> {
    return this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');
  }

  private applyFilters(
    qb: SelectQueryBuilder<AuditLog>,
    dto: QueryAuditLogDto,
  ): SelectQueryBuilder<AuditLog> {
    if (dto.module) {
      qb.andWhere('log.module = :module', { module: dto.module });
    }
    if (dto.action) {
      qb.andWhere('log.action = :action', { action: dto.action });
    }
    if (dto.search) {
      qb.andWhere(
        '(log.module ILIKE :search OR log.action ILIKE :search OR log.entityId ILIKE :search OR log.ipAddress ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    }
    if (dto.startDate) {
      const start = new Date(dto.startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('log.createdAt >= :start', { start });
    }
    if (dto.endDate) {
      const end = new Date(dto.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :end', { end });
    }
    return qb;
  }

  private resolvePaging(dto: QueryAuditLogDto): { page: number; limit: number } {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = Math.min(dto.limit && dto.limit > 0 ? dto.limit : 25, 100);
    return { page, limit };
  }

  /** Admin-wide log feed with filtering + pagination. */
  async findAll(
    dto: QueryAuditLogDto,
    actorId?: string,
  ): Promise<PaginatedAuditLogs> {
    const { page, limit } = this.resolvePaging(dto);
    const qb = this.applyFilters(this.baseQuery(), dto);
    this.applyPrivilegedFilter(qb, await this.isSuperAdmin(actorId));
    if (dto.userId) {
      qb.andWhere('log.userId = :userId', { userId: dto.userId });
    }
    qb.orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * A single user's history: everything they did, plus changes made to their
   * own account by others. The privileged (Role/Permission) filter must also
   * apply here — otherwise an admin could read a Super Admin's privilege
   * audit trail via GET /audit-logs/user/:id, which the main feed hides.
   */
  async findForUser(
    userId: string,
    dto: QueryAuditLogDto,
    actorId?: string,
  ): Promise<PaginatedAuditLogs> {
    const { page, limit } = this.resolvePaging(dto);
    const qb = this.applyFilters(this.baseQuery(), dto).andWhere(
      '(log.userId = :userId OR (log.module = :userModule AND log.entityId = CAST(:userId AS varchar)))',
      { userId, userModule: 'User' },
    );
    this.applyPrivilegedFilter(qb, await this.isSuperAdmin(actorId));
    qb.orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Distinct list of categories present in the log (for the filter dropdown). */
  async getCategories(actorId?: string): Promise<string[]> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.module', 'module');
    this.applyPrivilegedFilter(qb, await this.isSuperAdmin(actorId));
    const rows = await qb.orderBy('log.module', 'ASC').getRawMany<{
      module: string;
    }>();
    return rows.map((r) => r.module).filter(Boolean);
  }

  /** Aggregated counts per action (optionally scoped to a single user). */
  async getStats(
    actorId?: string,
    userId?: string,
  ): Promise<{
    total: number;
    byAction: Record<string, number>;
  }> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action');
    this.applyPrivilegedFilter(qb, await this.isSuperAdmin(actorId));
    if (userId) {
      qb.andWhere(
        '(log.userId = :userId OR (log.module = :userModule AND log.entityId = CAST(:userId AS varchar)))',
        { userId, userModule: 'User' },
      );
    }
    const rows = await qb.getRawMany<{ action: string; count: string }>();
    const byAction: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      byAction[row.action] = count;
      total += count;
    }
    return { total, byAction };
  }
}
