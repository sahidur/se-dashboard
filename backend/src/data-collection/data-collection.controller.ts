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
import { DataCollectionService } from './data-collection.service';
import {
  CreateDcSchoolDto,
  UpdateDcSchoolDto,
  UpsertBasicInfoDto,
  UpsertInfrastructureDto,
  UpsertStudentsInfoDto,
  UpsertTeachersInfoDto,
  CreateTeacherIndividualDto,
  UpsertTeachersDevelopmentDto,
  UpsertRevenueDto,
  UpsertFeeStructureDto,
  UpsertRevenueBudgetTotalDto,
  UpsertRevenueBudgetMonthlyDto,
  UpsertRevenueActualTotalDto,
  UpsertRevenueActualMonthlyDto,
  UpsertPerformanceDto,
  CreateAlumniDto,
  UpdateAlumniDto,
  UpsertPedagogicalAchievementDto,
  UpsertCocurricularDto,
  UpsertStudentsPerformanceDto,
  UpsertActivityParticipationDto,
  CreateEventParticipationDto,
  UpdateEventParticipationDto,
  UpsertFormDraftDto,
} from './dto';

@Controller('data-collection')
@UseGuards(JwtAuthGuard, AccessGuard)
export class DataCollectionController {
  constructor(private readonly service: DataCollectionService) {}

  // ===================== Schools =====================

  @Post('schools')
  @Permissions({ module: 'data-collection', action: 'create' })
  createSchool(@Body() dto: CreateDcSchoolDto, @CurrentUser('id') userId: string) {
    return this.service.createSchool(dto, userId);
  }

  @Get('schools')
  @Permissions(
    { module: 'data-collection', action: 'read' },
    { module: 'school-information', action: 'read' },
  )
  findAllSchools(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('search') search?: string,
  ) {
    return this.service.findAllSchools(userId, roles, search);
  }

  @Get('schools/:id')
  @Permissions({ module: 'data-collection', action: 'read' })
  findOneSchool(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.findOneSchool(id, userId, roles);
  }

  @Get('schools/:id/dashboard')
  @Permissions({ module: 'data-collection', action: 'read' })
  getDashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getDashboard(id, userId, roles);
  }

  @Patch('schools/:id')
  @Permissions({ module: 'data-collection', action: 'update' })
  updateSchool(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDcSchoolDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateSchool(id, dto, userId, roles);
  }

  @Delete('schools/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteSchool(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteSchool(id, userId, roles);
  }

  // ===================== Basic Information =====================

  @Post('basic-info')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertBasicInfo(
    @Body() dto: UpsertBasicInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertBasicInfo(dto, userId, roles);
  }

  @Get('basic-info/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getBasicInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getBasicInfo(schoolId, userId, roles);
  }

  // ===================== Infrastructure =====================

  @Post('infrastructure')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertInfrastructure(
    @Body() dto: UpsertInfrastructureDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertInfrastructure(dto, userId, roles);
  }

  @Get('infrastructure/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getInfrastructure(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getInfrastructure(schoolId, userId, roles);
  }

  // ===================== Students Info =====================

  @Post('students')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertStudentsInfo(
    @Body() dto: UpsertStudentsInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertStudentsInfo(dto, userId, roles);
  }

  @Get('students/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getStudentsInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getStudentsInfo(schoolId, userId, roles);
  }

  // ===================== Teachers Info (legacy aggregate) =====================

  @Post('teachers')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertTeachersInfo(
    @Body() dto: UpsertTeachersInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertTeachersInfo(dto, userId, roles);
  }

  @Get('teachers/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getTeachersInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getTeachersInfo(schoolId, userId, roles);
  }

  // ===================== Teacher Individual (multi-entry) =====================

  @Post('teachers/individual')
  @Permissions({ module: 'data-collection', action: 'create' })
  createTeacherIndividual(@Body() dto: CreateTeacherIndividualDto, @CurrentUser('id') userId: string) {
    return this.service.createTeacherIndividual(dto, userId);
  }

  @Get('teachers/individual/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getTeacherIndividuals(@Param('schoolId', ParseUUIDPipe) schoolId: string, @CurrentUser('id') userId: string) {
    return this.service.getTeacherIndividuals(schoolId, userId);
  }

  @Delete('teachers/individual/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteTeacherIndividual(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.deleteTeacherIndividual(id, userId);
  }

  // ===================== Teachers Development (per month) =====================

  @Post('teachers/development')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertTeachersDevelopment(
    @Body() dto: UpsertTeachersDevelopmentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertTeachersDevelopment(dto, userId, roles);
  }

  @Get('teachers/development/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getTeachersDevelopment(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getTeachersDevelopment(schoolId, userId, roles);
  }

  // ===================== Revenue =====================

  @Post('revenue')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertRevenue(
    @Body() dto: UpsertRevenueDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenue(dto, userId, roles);
  }

  @Get('revenue/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getRevenue(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenue(schoolId, userId, roles);
  }

  // ===================== Performance =====================

  @Post('performance')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertPerformance(
    @Body() dto: UpsertPerformanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertPerformance(dto, userId, roles);
  }

  @Get('performance/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getPerformance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getPerformance(schoolId, userId, roles);
  }

  // ===================== Alumni =====================

  @Post('alumni')
  @Permissions({ module: 'data-collection', action: 'create' })
  createAlumni(@Body() dto: CreateAlumniDto, @CurrentUser('id') userId: string) {
    return this.service.createAlumni(dto, userId);
  }

  @Get('alumni/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getAlumniBySchool(@Param('schoolId', ParseUUIDPipe) schoolId: string, @CurrentUser('id') userId: string) {
    return this.service.getAlumniBySchool(schoolId, userId);
  }

  @Patch('alumni/:id')
  @Permissions({ module: 'data-collection', action: 'update' })
  updateAlumni(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlumniDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateAlumni(id, dto, userId, roles);
  }

  @Delete('alumni/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteAlumni(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.deleteAlumni(id, userId);
  }

  // ===================== Fee Structure =====================

  @Post('fee-structure')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertFeeStructure(
    @Body() dto: UpsertFeeStructureDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertFeeStructure(dto, userId, roles);
  }

  @Get('fee-structure/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getFeeStructures(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getFeeStructures(schoolId, userId, roles);
  }

  @Get('fee-structure/logs/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getFeeStructureLogs(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getFeeStructureLogs(schoolId, userId, roles);
  }

  // ===================== Revenue Budget Total =====================

  @Post('revenue/budget/total')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertRevenueBudgetTotal(
    @Body() dto: UpsertRevenueBudgetTotalDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueBudgetTotal(dto, userId, roles);
  }

  @Get('revenue/budget/total/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getRevenueBudgetTotal(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueBudgetTotal(schoolId, userId, roles);
  }

  // ===================== Revenue Budget Monthly =====================

  @Post('revenue/budget/monthly')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertRevenueBudgetMonthly(
    @Body() dto: UpsertRevenueBudgetMonthlyDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueBudgetMonthly(dto, userId, roles);
  }

  @Get('revenue/budget/monthly/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getRevenueBudgetMonthly(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueBudgetMonthly(schoolId, userId, roles);
  }

  // ===================== Revenue Actual Total =====================

  @Post('revenue/actual/total')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertRevenueActualTotal(
    @Body() dto: UpsertRevenueActualTotalDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueActualTotal(dto, userId, roles);
  }

  @Get('revenue/actual/total/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getRevenueActualTotal(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueActualTotal(schoolId, userId, roles);
  }

  // ===================== Revenue Actual Monthly =====================

  @Post('revenue/actual/monthly')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertRevenueActualMonthly(
    @Body() dto: UpsertRevenueActualMonthlyDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueActualMonthly(dto, userId, roles);
  }

  @Get('revenue/actual/monthly/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getRevenueActualMonthly(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueActualMonthly(schoolId, userId, roles);
  }

  // ===================== Pedagogical Achievements =====================

  @Post('pedagogical-achievements')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertPedagogicalAchievement(
    @Body() dto: UpsertPedagogicalAchievementDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertPedagogicalAchievement(dto, userId, roles);
  }

  @Get('pedagogical-achievements/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getPedagogicalAchievements(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getPedagogicalAchievements(schoolId, userId, roles);
  }

  @Delete('pedagogical-achievements/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deletePedagogicalAchievement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deletePedagogicalAchievement(id, userId, roles);
  }

  // ===================== Co-curricular =====================

  @Post('cocurricular')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertCocurricular(
    @Body() dto: UpsertCocurricularDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertCocurricular(dto, userId, roles);
  }

  @Get('cocurricular/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getCocurricular(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getCocurricular(schoolId, userId, roles);
  }

  @Delete('cocurricular/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteCocurricular(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteCocurricular(id, userId, roles);
  }

  // ===================== Students' Performance =====================

  @Post('students-performance')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertStudentsPerformance(
    @Body() dto: UpsertStudentsPerformanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertStudentsPerformance(dto, userId, roles);
  }

  @Get('students-performance/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getStudentsPerformance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getStudentsPerformance(schoolId, userId, roles);
  }

  @Delete('students-performance/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteStudentsPerformance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteStudentsPerformance(id, userId, roles);
  }

  // ===================== Activity Participation (Corner/Club/Library/Lab) =====================

  @Post('activity-participation')
  @Permissions({ module: 'data-collection', action: 'create' })
  upsertActivityParticipation(
    @Body() dto: UpsertActivityParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertActivityParticipation(dto, userId, roles);
  }

  @Get('activity-participation/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getActivityParticipation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getActivityParticipation(schoolId, userId, roles);
  }

  @Delete('activity-participation/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteActivityParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteActivityParticipation(id, userId, roles);
  }

  // ===================== Event Participation =====================

  @Post('event-participation')
  @Permissions({ module: 'data-collection', action: 'create' })
  createEventParticipation(
    @Body() dto: CreateEventParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.createEventParticipation(dto, userId, roles);
  }

  @Get('event-participation/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read' })
  getEventParticipation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getEventParticipation(schoolId, userId, roles);
  }

  @Patch('event-participation/:id')
  @Permissions({ module: 'data-collection', action: 'update' })
  updateEventParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateEventParticipation(id, dto, userId, roles);
  }

  @Delete('event-participation/:id')
  @Permissions({ module: 'data-collection', action: 'delete' })
  deleteEventParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteEventParticipation(id, userId, roles);
  }

  // ===================== Programme Overview =====================

  @Get('programme-overview')
  @Permissions(
    { module: 'data-collection', action: 'read' },
    { module: 'programme-overview', action: 'read' },
  )
  getProgrammeOverview(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('category') category?: string,
  ) {
    return this.service.getProgrammeOverview(userId, roles, category);
  }

  // ===================== School Profile Overview =====================

  @Get('schools/:id/profile')
  @Permissions(
    { module: 'data-collection', action: 'read' },
    { module: 'school-information', action: 'read' },
  )
  getSchoolProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getSchoolProfile(id, userId, roles);
  }

  // ===================== Form Drafts (server-side, per-user) =====================
  // No @Permissions decorator: open to any authenticated user for THEIR OWN
  // drafts (same pattern as /users/me) — the service scopes every query by
  // userId and still validates school access.

  @Get('drafts')
  getFormDraft(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('formKey') formKey: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getFormDraft(schoolId, formKey, userId, roles);
  }

  @Post('drafts')
  saveFormDraft(
    @Body() dto: UpsertFormDraftDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.saveFormDraft(dto, userId, roles);
  }

  @Delete('drafts')
  clearFormDraft(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('formKey') formKey: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.clearFormDraft(schoolId, formKey, userId, roles);
  }
}
