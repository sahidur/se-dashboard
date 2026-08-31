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
   UpdateTeacherIndividualDto,
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
  UpsertStudentPerformanceDto,
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
  @Permissions({ module: 'data-collection', action: 'create', resource: 'basic-info' })
  upsertBasicInfo(
    @Body() dto: UpsertBasicInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertBasicInfo(dto, userId, roles);
  }

  @Get('basic-info/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'basic-info' })
  getBasicInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getBasicInfo(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  // ===================== Infrastructure =====================

  @Post('infrastructure')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'infrastructure' })
  upsertInfrastructure(
    @Body() dto: UpsertInfrastructureDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertInfrastructure(dto, userId, roles);
  }

  @Get('infrastructure/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'infrastructure' })
  getInfrastructure(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getInfrastructure(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  // The infrastructure row also holds the Classroom Status form's data for
  // the same academic year — deleting it clears both.
  @Delete('infrastructure/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'infrastructure' })
  deleteInfrastructure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteInfrastructure(id, userId, roles);
  }

  // ===================== Students Info =====================

  @Post('students')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'students' })
  upsertStudentsInfo(
    @Body() dto: UpsertStudentsInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertStudentsInfo(dto, userId, roles);
  }

  @Get('students/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'students' })
  getStudentsInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getStudentsInfo(schoolId, userId, roles);
  }

  @Delete('students/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'students' })
  deleteStudentsInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteStudentsInfo(id, userId, roles);
  }

  // ===================== Teachers Info (legacy aggregate) =====================

  @Post('teachers')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'teachers' })
  upsertTeachersInfo(
    @Body() dto: UpsertTeachersInfoDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertTeachersInfo(dto, userId, roles);
  }

  @Get('teachers/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'teachers' })
  getTeachersInfo(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getTeachersInfo(schoolId, userId, roles);
  }

  // ===================== Teacher Individual (multi-entry) =====================

  @Post('teachers/individual')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'teachers-individual' })
  createTeacherIndividual(
    @Body() dto: CreateTeacherIndividualDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.createTeacherIndividual(dto, userId, roles);
  }

  @Get('teachers/individual/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'teachers-individual' })
  getTeacherIndividuals(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getTeacherIndividuals(schoolId, userId, roles);
  }

  @Patch('teachers/individual/:id')
  @Permissions({ module: 'data-collection', action: 'update', resource: 'teachers-individual' })
  updateTeacherIndividual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherIndividualDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateTeacherIndividual(id, dto, userId, roles);
  }

  @Delete('teachers/individual/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'teachers-individual' })
  deleteTeacherIndividual(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteTeacherIndividual(id, userId, roles);
  }

  // ===================== Teachers Development (per month) =====================

  @Post('teachers/development')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'teachers-development' })
  upsertTeachersDevelopment(
    @Body() dto: UpsertTeachersDevelopmentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertTeachersDevelopment(dto, userId, roles);
  }

  @Get('teachers/development/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'teachers-development' })
  getTeachersDevelopment(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getTeachersDevelopment(schoolId, userId, roles);
  }

  @Delete('teachers/development/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'teachers-development' })
  deleteTeachersDevelopment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteTeachersDevelopment(id, userId, roles);
  }

  // ===================== Revenue =====================

  @Post('revenue')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'revenue' })
  upsertRevenue(
    @Body() dto: UpsertRevenueDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenue(dto, userId, roles);
  }

  @Get('revenue/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'revenue' })
  getRevenue(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getRevenue(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  // ===================== Performance =====================

  @Post('performance')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'performance' })
  upsertPerformance(
    @Body() dto: UpsertPerformanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertPerformance(dto, userId, roles);
  }

  @Get('performance/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'performance' })
  getPerformance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getPerformance(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  // ===================== Alumni =====================

  @Post('alumni')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'alumni' })
  createAlumni(
    @Body() dto: CreateAlumniDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.createAlumni(dto, userId, roles);
  }

  @Get('alumni/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'alumni' })
  getAlumniBySchool(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getAlumniBySchool(schoolId, userId, roles);
  }

  @Patch('alumni/:id')
  @Permissions({ module: 'data-collection', action: 'update', resource: 'alumni' })
  updateAlumni(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlumniDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateAlumni(id, dto, userId, roles);
  }

  @Delete('alumni/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'alumni' })
  deleteAlumni(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteAlumni(id, userId, roles);
  }

  // ===================== Fee Structure =====================

  @Post('fee-structure')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'fee-structure' })
  upsertFeeStructure(
    @Body() dto: UpsertFeeStructureDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertFeeStructure(dto, userId, roles);
  }

  @Get('fee-structure/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'fee-structure' })
  getFeeStructures(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getFeeStructures(schoolId, userId, roles);
  }

  @Get('fee-structure/logs/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'fee-structure' })
  getFeeStructureLogs(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getFeeStructureLogs(schoolId, userId, roles);
  }

  @Delete('fee-structure/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'fee-structure' })
  deleteFeeStructure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteFeeStructure(id, userId, roles);
  }

  // ===================== Revenue Budget Total =====================

  @Post('revenue/budget/total')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'revenue-budget-total' })
  upsertRevenueBudgetTotal(
    @Body() dto: UpsertRevenueBudgetTotalDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueBudgetTotal(dto, userId, roles);
  }

  @Get('revenue/budget/total/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'revenue-budget-total' })
  getRevenueBudgetTotal(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getRevenueBudgetTotal(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  @Delete('revenue/budget/total/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'revenue-budget-total' })
  deleteRevenueBudgetTotal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteRevenueBudgetTotal(id, userId, roles);
  }

  // ===================== Revenue Budget Monthly =====================

  @Post('revenue/budget/monthly')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'revenue-budget-monthly' })
  upsertRevenueBudgetMonthly(
    @Body() dto: UpsertRevenueBudgetMonthlyDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueBudgetMonthly(dto, userId, roles);
  }

  @Get('revenue/budget/monthly/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'revenue-budget-monthly' })
  getRevenueBudgetMonthly(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueBudgetMonthly(schoolId, userId, roles);
  }

  @Delete('revenue/budget/monthly/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'revenue-budget-monthly' })
  deleteRevenueBudgetMonthly(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteRevenueBudgetMonthly(id, userId, roles);
  }

  // ===================== Revenue Actual Total =====================

  @Post('revenue/actual/total')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'revenue-actual-total' })
  upsertRevenueActualTotal(
    @Body() dto: UpsertRevenueActualTotalDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueActualTotal(dto, userId, roles);
  }

  @Get('revenue/actual/total/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'revenue-actual-total' })
  getRevenueActualTotal(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getRevenueActualTotal(schoolId, userId, roles, academicYear ? Number(academicYear) : undefined);
  }

  @Delete('revenue/actual/total/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'revenue-actual-total' })
  deleteRevenueActualTotal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteRevenueActualTotal(id, userId, roles);
  }

  // ===================== Revenue Actual Monthly =====================

  @Post('revenue/actual/monthly')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'revenue-actual-monthly' })
  upsertRevenueActualMonthly(
    @Body() dto: UpsertRevenueActualMonthlyDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertRevenueActualMonthly(dto, userId, roles);
  }

  @Get('revenue/actual/monthly/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'revenue-actual-monthly' })
  getRevenueActualMonthly(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getRevenueActualMonthly(schoolId, userId, roles);
  }

  @Delete('revenue/actual/monthly/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'revenue-actual-monthly' })
  deleteRevenueActualMonthly(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteRevenueActualMonthly(id, userId, roles);
  }

  // ===================== Pedagogical Achievements =====================

  @Post('pedagogical-achievements')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'pedagogical-achievements' })
  upsertPedagogicalAchievement(
    @Body() dto: UpsertPedagogicalAchievementDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertPedagogicalAchievement(dto, userId, roles);
  }

  @Get('pedagogical-achievements/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'pedagogical-achievements' })
  getPedagogicalAchievements(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getPedagogicalAchievements(schoolId, userId, roles);
  }

  @Delete('pedagogical-achievements/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'pedagogical-achievements' })
  deletePedagogicalAchievement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deletePedagogicalAchievement(id, userId, roles);
  }

  // ===================== Co-curricular =====================

  @Post('cocurricular')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'cocurricular' })
  upsertCocurricular(
    @Body() dto: UpsertCocurricularDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertCocurricular(dto, userId, roles);
  }

  @Get('cocurricular/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'cocurricular' })
  getCocurricular(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getCocurricular(schoolId, userId, roles);
  }

  @Delete('cocurricular/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'cocurricular' })
  deleteCocurricular(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteCocurricular(id, userId, roles);
  }

  // ===================== Students' Performance =====================

  @Post('students-performance')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'students-performance' })
  upsertStudentsPerformance(
    @Body() dto: UpsertStudentsPerformanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertStudentsPerformance(dto, userId, roles);
  }

  @Get('students-performance/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'students-performance' })
  getStudentsPerformance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getStudentsPerformance(schoolId, userId, roles);
  }

  @Delete('students-performance/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'students-performance' })
  deleteStudentsPerformance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteStudentsPerformance(id, userId, roles);
  }

  // ===================== Student Performance (BA / BPS / BSS) =====================

  @Post('student-performance')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'student-performance' })
  upsertStudentPerformance(
    @Body() dto: UpsertStudentPerformanceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertStudentPerformance(dto, userId, roles);
  }

  @Get('student-performance/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'student-performance' })
  getStudentPerformance(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query('formKey') formKey?: string,
  ) {
    return this.service.getStudentPerformance(schoolId, userId, roles, formKey);
  }

  /** Flattened variant used by the generic School Information form-data viewer. */
  @Get('student-performance/:formKey/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'student-performance' })
  getStudentPerformanceFlat(
    @Param('formKey') formKey: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getStudentPerformanceFlat(schoolId, userId, roles, formKey);
  }

  @Delete('student-performance/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'student-performance' })
  deleteStudentPerformance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteStudentPerformance(id, userId, roles);
  }

  // ===================== Activity Participation (Corner/Club/Library/Lab) =====================

  @Post('activity-participation')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'activity-participation' })
  upsertActivityParticipation(
    @Body() dto: UpsertActivityParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.upsertActivityParticipation(dto, userId, roles);
  }

  @Get('activity-participation/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'activity-participation' })
  getActivityParticipation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getActivityParticipation(schoolId, userId, roles);
  }

  @Delete('activity-participation/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'activity-participation' })
  deleteActivityParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.deleteActivityParticipation(id, userId, roles);
  }

  // ===================== Event Participation =====================

  @Post('event-participation')
  @Permissions({ module: 'data-collection', action: 'create', resource: 'event-participation' })
  createEventParticipation(
    @Body() dto: CreateEventParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.createEventParticipation(dto, userId, roles);
  }

  @Get('event-participation/school/:schoolId')
  @Permissions({ module: 'data-collection', action: 'read', resource: 'event-participation' })
  getEventParticipation(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getEventParticipation(schoolId, userId, roles);
  }

  @Patch('event-participation/:id')
  @Permissions({ module: 'data-collection', action: 'update', resource: 'event-participation' })
  updateEventParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventParticipationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.updateEventParticipation(id, dto, userId, roles);
  }

  @Delete('event-participation/:id')
  @Permissions({ module: 'data-collection', action: 'delete', resource: 'event-participation' })
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
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getProgrammeOverview(
      userId,
      roles,
      category,
      academicYear ? Number(academicYear) : undefined,
    );
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
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getSchoolProfile(
      id,
      userId,
      roles,
      academicYear ? Number(academicYear) : undefined,
    );
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
