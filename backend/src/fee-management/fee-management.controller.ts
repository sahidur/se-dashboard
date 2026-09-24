import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeeManagementService } from './fee-management.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  CreateFeeHeadDto,
  UpdateFeeHeadDto,
  SaveFeeStructureDto,
  CreateStudentDiscountDto,
  UpdateStudentDiscountDto,
} from './dto/fee-management.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SchoolScopeGuard } from '../students/school-scope.guard';

@ApiTags('Fee Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard, SchoolScopeGuard)
@Controller()
export class FeeManagementController {
  constructor(private readonly service: FeeManagementService) {}

  // ----- Academic Years -----

  @Post('academic-years')
  @Permissions({ module: 'fee-management', action: 'create' })
  @ApiOperation({ summary: 'Create an academic year' })
  createYear(@Body() dto: CreateAcademicYearDto) {
    return this.service.createAcademicYear(dto);
  }

  @Get('academic-years')
  @Permissions({ module: 'fee-management', action: 'read' })
  @ApiOperation({ summary: 'List academic years' })
  findYears(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAcademicYears(activeOnly === 'true');
  }

  @Get('academic-years/active')
  @Permissions({ module: 'fee-management', action: 'read' })
  @ApiOperation({ summary: 'Get the current active academic year' })
  findActiveYear() {
    return this.service.findActiveAcademicYear();
  }

  @Patch('academic-years/:id')
  @Permissions({ module: 'fee-management', action: 'update' })
  @ApiOperation({ summary: 'Update an academic year' })
  updateYear(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.service.updateAcademicYear(id, dto);
  }

  @Delete('academic-years/:id')
  @Permissions({ module: 'fee-management', action: 'delete' })
  @ApiOperation({ summary: 'Delete an academic year (soft delete, blocked while in use)' })
  removeYear(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeAcademicYear(id);
  }

  // ----- Fee Heads -----

  @Post('fee-heads')
  @Permissions({ module: 'fee-management', action: 'create' })
  @ApiOperation({ summary: 'Create a fee head' })
  createHead(@Body() dto: CreateFeeHeadDto) {
    return this.service.createFeeHead(dto);
  }

  @Get('fee-heads')
  @Permissions({ module: 'fee-management', action: 'read' })
  @ApiOperation({ summary: 'List fee heads' })
  findHeads(@Query('activeOnly') activeOnly?: string) {
    return this.service.findFeeHeads(activeOnly === 'true');
  }

  @Patch('fee-heads/:id')
  @Permissions({ module: 'fee-management', action: 'update' })
  @ApiOperation({ summary: 'Update a fee head' })
  updateHead(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeeHeadDto) {
    return this.service.updateFeeHead(id, dto);
  }

  @Delete('fee-heads/:id')
  @Permissions({ module: 'fee-management', action: 'delete' })
  @ApiOperation({ summary: 'Delete a fee head (soft delete, blocked while in use)' })
  removeHead(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeFeeHead(id);
  }

  // ----- Fee Structure -----

  @Post('fee-structures')
  @Permissions({ module: 'fee-management', action: 'create' })
  @ApiOperation({ summary: 'Save the standard fee grid for a class + month' })
  saveStructure(
    @Body() dto: SaveFeeStructureDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveFeeStructure(dto, userId);
  }

  @Get('fee-structures')
  @Permissions({ module: 'fee-management', action: 'read' })
  @ApiOperation({ summary: 'Get fee structures for a class (optionally by months)' })
  findStructure(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('classId', ParseUUIDPipe) classId: string,
    @Query('months') months?: string,
  ) {
    const monthList = months?.split(',').map((m) => {
      if (!/^(?:[1-9]|1[0-2])$/.test(m)) throw new BadRequestException('Invalid month');
      return Number(m);
    });
    return this.service.findFeeStructure(schoolId, academicYearId, classId, monthList);
  }

  // ----- Student Discounts -----

  @Post('student-discounts')
  @Permissions({ module: 'fee-management', action: 'create' })
  @ApiOperation({ summary: 'Assign a discount to a student' })
  createDiscount(
    @Body() dto: CreateStudentDiscountDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createStudentDiscount(dto, userId);
  }

  @Get('student-discounts/student/:studentId')
  @Permissions({ module: 'fee-management', action: 'read' })
  @ApiOperation({ summary: 'List discounts of a student' })
  findDiscounts(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.findStudentDiscounts(studentId);
  }

  @Patch('student-discounts/:id')
  @Permissions({ module: 'fee-management', action: 'update' })
  @ApiOperation({ summary: 'Update (override) a student discount' })
  updateDiscount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDiscountDto) {
    return this.service.updateStudentDiscount(id, dto);
  }

  @Delete('student-discounts/:id')
  @Permissions({ module: 'fee-management', action: 'delete' })
  @ApiOperation({ summary: 'Remove a student discount (soft delete)' })
  removeDiscount(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeStudentDiscount(id);
  }
}
