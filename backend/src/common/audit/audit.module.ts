import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditSubscriber } from './audit.subscriber';
import { AuditContextMiddleware } from './audit-context.middleware';
import { UsersModule } from '../../users/users.module';

/**
 * System-wide activity-logging module.
 *
 * - Registers the global {@link AuditSubscriber} that automatically records
 *   every entity create/update/delete/restore with old & new data.
 * - Applies {@link AuditContextMiddleware} to every route so those records can
 *   be attributed to the acting user + their IP / browser.
 * - Exposes the {@link AuditController} log-viewer endpoints.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), UsersModule],
  controllers: [AuditController],
  providers: [AuditService, AuditSubscriber],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }
}
