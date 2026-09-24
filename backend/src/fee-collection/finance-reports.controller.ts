import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinanceReportsService } from './finance-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SaveAopTargetsDto } from './dto/aop-target.dto';
import { SchoolScopeGuard } from '../students/school-scope.guard';

function reportMonth(month?: string): number | undefined {
  if (month === undefined) return undefined;
  if (!/^(?:[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Month must be between 1 and 12');
  return Number(month);
}

@ApiTags('Finance Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard, SchoolScopeGuard)
@Controller('finance-reports')
export class FinanceReportsController {
  constructor(private readonly service: FinanceReportsService) {}

  @Get('collection')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Collection report (totals with filters)' })
  collection(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('month') month?: string,
    @Query('classId', new ParseUUIDPipe({ optional: true })) classId?: string,
    @Query('sectionId', new ParseUUIDPipe({ optional: true })) sectionId?: string,
  ) {
    return this.service.collectionReport(
      schoolId,
      academicYearId,
      reportMonth(month),
      classId || undefined,
      sectionId || undefined,
    );
  }

  @Get('dues')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Student-wise due report (origin month preserved)' })
  dues(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('classId', new ParseUUIDPipe({ optional: true })) classId?: string,
    @Query('sectionId', new ParseUUIDPipe({ optional: true })) sectionId?: string,
  ) {
    return this.service.dueReport(schoolId, academicYearId, classId || undefined, sectionId || undefined);
  }

  @Get('class-wise')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Class-wise collection' })
  classWise(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('month') month?: string,
  ) {
    return this.service.groupedCollection(
      schoolId,
      academicYearId,
      reportMonth(month),
      'class',
    );
  }

  @Get('section-wise')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Section-wise collection' })
  sectionWise(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('month') month?: string,
  ) {
    return this.service.groupedCollection(
      schoolId,
      academicYearId,
      reportMonth(month),
      'section',
    );
  }

  @Get('fee-heads')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Fee head report (generated vs collected)' })
  feeHeads(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('month') month?: string,
  ) {
    return this.service.feeHeadReport(
      schoolId,
      academicYearId,
      reportMonth(month),
    );
  }

  @Get('revenue')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({
    summary: 'Planned vs Actual Revenue — auto-calculated per fee head, monthly and total',
  })
  revenue(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
  ) {
    return this.service.revenueReport(schoolId, academicYearId);
  }

  @Get('planned-revenue')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({
    summary:
      'Planned Revenue Target (AOP) — all three school categories: AOP target students × fee structure, no discounts, independent of enrolled students',
  })
  plannedRevenue(@Query('academicYearId', ParseUUIDPipe) academicYearId: string) {
    return this.service.plannedRevenueReport(academicYearId);
  }

  @Get('aop-targets')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Class-wise AOP target students of a school (for the entry form)' })
  aopTargets(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
  ) {
    return this.service.aopTargets(schoolId, academicYearId);
  }

  @Post('aop-targets')
  @Permissions({ module: 'finance-reports', action: 'create' })
  @ApiOperation({ summary: 'Save (upsert) AOP target student counts per class' })
  saveAopTargets(@Body() dto: SaveAopTargetsDto, @CurrentUser('id') userId: string) {
    return this.service.saveAopTargets(dto, userId);
  }

  @Get('students')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Student fee report (list with payable/paid/due)' })
  studentFees(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('classId', new ParseUUIDPipe({ optional: true })) classId?: string,
    @Query('sectionId', new ParseUUIDPipe({ optional: true })) sectionId?: string,
  ) {
    return this.service.studentFeeReport(schoolId, academicYearId, classId || undefined, sectionId || undefined);
  }

  @Get('students/:studentId/ledger')
  @Permissions({ module: 'finance-reports', action: 'read' })
  @ApiOperation({ summary: 'Complete fee ledger of a student' })
  ledger(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.studentLedger(studentId);
  }
}
