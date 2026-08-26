import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SchoolMonitoringService } from './school-monitoring.service';
import {
  CreateMonitoringSubmissionDto,
  UpdateMonitoringSubmissionDto,
} from './dto';

@Controller('school-monitoring')
@UseGuards(JwtAuthGuard, AccessGuard)
export class SchoolMonitoringController {
  constructor(private readonly service: SchoolMonitoringService) {}

  @Post()
  @Permissions({ module: 'school-monitoring', action: 'create' })
  create(
    @Body() dto: CreateMonitoringSubmissionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.create(dto, userId, roles);
  }

  @Get()
  @Permissions({ module: 'school-monitoring', action: 'read' })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    // Without the pipe a non-uuid value reaches Postgres and 500s.
    @Query('schoolId', new ParseUUIDPipe({ optional: true })) schoolId?: string,
    @Query('formType') formType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(userId, roles, {
      schoolId,
      formType,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('school/:schoolId')
  @Permissions({ module: 'school-monitoring', action: 'read' })
  findForSchool(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('formType') formType?: string,
  ) {
    return this.service.findForSchool(schoolId, userId, roles, formType);
  }

  /**
   * Flattened per-indicator feedback history (who answered what/commented and
   * when), newest submission first. Powers the per-question timeline in the
   * one-question-at-a-time form. `codes` is a comma-separated indicator list.
   */
  @Get('school/:schoolId/question-feedback')
  @Permissions({ module: 'school-monitoring', action: 'read' })
  findQuestionFeedback(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('formType') formType?: string,
    @Query('codes') codes?: string,
  ) {
    const list = (codes ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && c.length <= 50)
      .slice(0, 150);
    return this.service.findQuestionFeedback(schoolId, userId, roles, {
      formType,
      codes: list.length ? list : undefined,
    });
  }

  @Get(':id')
  @Permissions({ module: 'school-monitoring', action: 'read' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.findOne(id, userId, roles);
  }

  @Patch(':id')
  @Permissions({ module: 'school-monitoring-edit', action: 'update' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonitoringSubmissionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.update(id, dto, userId, roles);
  }

  @Delete(':id')
  @Permissions({ module: 'school-monitoring-edit', action: 'delete' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.remove(id, userId, roles);
  }
}
