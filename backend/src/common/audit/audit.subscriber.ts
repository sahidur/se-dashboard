import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  EntityMetadata,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RecoverEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { getAuditContext } from './audit-context';
import { sanitizeAuditData } from './sanitize-audit-data';

/**
 * When a save() touches ONLY these columns the change is considered internal
 * bookkeeping (not user-meaningful) and is not logged, keeping the timeline
 * clean of login-token churn.
 */
const NOISE_ONLY_COLUMNS = [
  'refreshToken',
  'currentHashedRefreshToken',
  'lastLoginAt',
  'updatedAt',
];

/**
 * Global TypeORM subscriber that records every entity-based create / update /
 * soft-delete / delete / restore into the `audit_logs` table together with the
 * old & new values and the acting user's IP + browser (resolved from the
 * per-request AsyncLocalStorage context).
 *
 * Notes / limitations:
 * - Fires for entity operations: repository.save(), softRemove(), remove(),
 *   recover(). It does NOT fire for QueryBuilder `.update()` / `.delete()`
 *   (that is standard TypeORM behaviour), which conveniently means the
 *   token/last-login bookkeeping writes never generate noise.
 * - The audit write uses the same EntityManager as the triggering operation,
 *   so a rolled-back transaction also discards its audit rows (we never log
 *   operations that ultimately failed).
 */
@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(AuditSubscriber.name);

  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  private isAuditEntity(metadata?: EntityMetadata): boolean {
    return (
      metadata?.tableName === 'audit_logs' || metadata?.name === 'AuditLog'
    );
  }

  /**
   * Role/Permission entities are NOT auto-logged here. They are recorded
   * explicitly by RolesService with human-readable permission diffs instead
   * (the automatic snapshots would only contain permission ids). They remain
   * visible exclusively to Super Admins via the audit-log viewer.
   */
  private isPrivilegedEntity(metadata?: EntityMetadata): boolean {
    return (
      metadata?.name === 'Role' ||
      metadata?.name === 'Permission' ||
      metadata?.tableName === 'roles' ||
      metadata?.tableName === 'permissions'
    );
  }

  /** Produces a JSON-safe snapshot with sensitive fields masked at every depth. */
  private snapshot(data: any): Record<string, any> | undefined {
    return sanitizeAuditData(data);
  }

  private toEntityId(value: any): string | undefined {
    return value === null || value === undefined ? undefined : String(value);
  }

  private async write(
    manager: EntityManager,
    log: Partial<AuditLog>,
  ): Promise<void> {
    try {
      await manager.getRepository(AuditLog).insert(log);
    } catch (err) {
      // Logging must never break the primary operation.
      this.logger.warn(
        `Failed to write audit log for ${log.module}/${log.action}: ${
          (err as Error)?.message
        }`,
      );
    }
  }

  async afterInsert(event: InsertEvent<any>): Promise<void> {
    if (this.isAuditEntity(event.metadata) || this.isPrivilegedEntity(event.metadata)) return;
    const ctx = getAuditContext();
    await this.write(event.manager, {
      action: 'CREATE',
      module: event.metadata.name,
      entityId: this.toEntityId(event.entity?.id),
      newData: this.snapshot(event.entity),
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    if (this.isAuditEntity(event.metadata) || this.isPrivilegedEntity(event.metadata)) return;

    const before = event.databaseEntity;
    const after = event.entity;

    // Determine which columns actually changed (covers both loaded-entity
    // saves and partial saves).
    const changed = new Set<string>();
    for (const col of event.updatedColumns || []) changed.add(col.propertyName);
    if (after && typeof after === 'object') {
      for (const key of Object.keys(after)) changed.add(key);
    }
    changed.delete('id');
    const changedKeys = [...changed];

    // Skip pure bookkeeping writes (login token / last-login churn).
    if (
      changedKeys.length > 0 &&
      changedKeys.every((k) => NOISE_ONLY_COLUMNS.includes(k))
    ) {
      return;
    }

    // Soft-delete columns surface here as an UPDATE — relabel them.
    let action = 'UPDATE';
    if (changedKeys.includes('deletedAt')) {
      action = after?.deletedAt ? 'DELETE' : 'RESTORE';
    }

    const ctx = getAuditContext();
    await this.write(event.manager, {
      action,
      module: event.metadata.name,
      entityId: this.toEntityId(after?.id ?? before?.id),
      oldData: this.snapshot(before),
      newData: this.snapshot(after),
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async afterSoftRemove(event: SoftRemoveEvent<any>): Promise<void> {
    if (this.isAuditEntity(event.metadata) || this.isPrivilegedEntity(event.metadata)) return;
    const ctx = getAuditContext();
    const entity = event.entity || event.databaseEntity;
    await this.write(event.manager, {
      action: 'DELETE',
      module: event.metadata?.name || 'unknown',
      entityId: this.toEntityId(entity?.id ?? event.entityId),
      oldData: this.snapshot(entity),
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async afterRecover(event: RecoverEvent<any>): Promise<void> {
    if (this.isAuditEntity(event.metadata) || this.isPrivilegedEntity(event.metadata)) return;
    const ctx = getAuditContext();
    const entity = event.entity || event.databaseEntity;
    await this.write(event.manager, {
      action: 'RESTORE',
      module: event.metadata?.name || 'unknown',
      entityId: this.toEntityId(entity?.id ?? event.entityId),
      newData: this.snapshot(entity),
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async beforeRemove(event: RemoveEvent<any>): Promise<void> {
    if (this.isAuditEntity(event.metadata) || this.isPrivilegedEntity(event.metadata)) return;
    const ctx = getAuditContext();
    const entity = event.entity || event.databaseEntity;
    await this.write(event.manager, {
      action: 'DELETE',
      module: event.metadata?.name || 'unknown',
      entityId: this.toEntityId(entity?.id ?? event.entityId),
      oldData: this.snapshot(entity),
      userId: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }
}
