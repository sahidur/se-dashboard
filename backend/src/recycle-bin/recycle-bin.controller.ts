import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RecycleBinService, RecycleBinEntityType, RECYCLE_BIN_ENTITY_TYPES } from './recycle-bin.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Recycle Bin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('recycle-bin')
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  @Get()
  @Permissions({ module: 'recycle-bin', action: 'read' })
  @ApiOperation({ summary: 'Get all soft-deleted items you may manage' })
  async findAll(
    @CurrentUser('id') actorId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    // Actor context scopes the listing: admin-tier roles see every tenant,
    // everyone else only items of schools they manage / records they created.
    return this.recycleBinService.findAllDeleted(actorId, roles);
  }

  @Patch(':entityType/:id/restore')
  @Permissions({ module: 'recycle-bin', action: 'update' })
  @ApiOperation({ summary: 'Restore a soft-deleted item' })
  async restore(
    @Param('entityType', new ParseEnumPipe(RECYCLE_BIN_ENTITY_TYPES)) entityType: RecycleBinEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    // actorId + roles enable the per-entity tenant/privilege guards in the service.
    return this.recycleBinService.restore(entityType, id, actorId, roles);
  }

  @Delete(':entityType/:id')
  @Permissions({ module: 'recycle-bin', action: 'delete' })
  @ApiOperation({ summary: 'Permanently delete a soft-deleted item' })
  async permanentDelete(
    @Param('entityType', new ParseEnumPipe(RECYCLE_BIN_ENTITY_TYPES)) entityType: RecycleBinEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.recycleBinService.permanentDelete(entityType, id, actorId, roles);
  }
}
