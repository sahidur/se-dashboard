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
import { Roles } from '../common/decorators/roles.decorator';
import { RecycleBinService, RecycleBinEntityType, RECYCLE_BIN_ENTITY_TYPES } from './recycle-bin.service';

@ApiTags('Recycle Bin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles('Super Admin')
@Controller('recycle-bin')
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  @Get()
  @ApiOperation({ summary: 'Get all soft-deleted items' })
  async findAll() {
    return this.recycleBinService.findAllDeleted();
  }

  @Patch(':entityType/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted item' })
  async restore(
    @Param('entityType', new ParseEnumPipe(RECYCLE_BIN_ENTITY_TYPES)) entityType: RecycleBinEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recycleBinService.restore(entityType, id);
  }

  @Delete(':entityType/:id')
  @ApiOperation({ summary: 'Permanently delete a soft-deleted item' })
  async permanentDelete(
    @Param('entityType', new ParseEnumPipe(RECYCLE_BIN_ENTITY_TYPES)) entityType: RecycleBinEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recycleBinService.permanentDelete(entityType, id);
  }
}
