import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../auth/guards/access.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(
    { module: 'admin-tools', action: 'read' },
    { module: 'activity-logs', action: 'read' },
  )
  @ApiOperation({ summary: 'System-wide activity log (admin)' })
  findAll(
    @Query() query: QueryAuditLogDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.auditService.findAll(query, actorId);
  }

  @Get('me')
  @ApiOperation({ summary: "Current user's own activity history" })
  findMine(
    @CurrentUser('id') userId: string,
    @Query() query: QueryAuditLogDto,
  ) {
    // actorId = self so a Super Admin still sees their own privileged entries.
    return this.auditService.findForUser(userId, query, userId);
  }

  @Get('me/stats')
  @ApiOperation({ summary: "Current user's activity stats" })
  myStats(@CurrentUser('id') userId: string) {
    return this.auditService.getStats(userId, userId);
  }

  @Get('categories')
  @Permissions(
    { module: 'admin-tools', action: 'read' },
    { module: 'activity-logs', action: 'read' },
  )
  @ApiOperation({ summary: 'Distinct activity categories (admin)' })
  categories(@CurrentUser('id') actorId: string) {
    return this.auditService.getCategories(actorId);
  }

  @Get('stats')
  @Permissions(
    { module: 'admin-tools', action: 'read' },
    { module: 'activity-logs', action: 'read' },
  )
  @ApiOperation({ summary: 'System-wide activity stats (admin)' })
  stats(@CurrentUser('id') actorId: string) {
    return this.auditService.getStats(actorId);
  }

  @Get('user/:id')
  @Permissions(
    { module: 'admin-tools', action: 'read' },
    { module: 'activity-logs', action: 'read' },
  )
  @ApiOperation({ summary: "A specific user's activity history (admin)" })
  findForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryAuditLogDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.auditService.findForUser(id, query, actorId);
  }
}
