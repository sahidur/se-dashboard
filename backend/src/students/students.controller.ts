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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import {
  CreateClassDto,
  UpdateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateStudentDto,
  UpdateStudentDto,
  PromoteStudentsDto,
  TransferStudentDto,
  ListStudentsQueryDto,
} from './dto/student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SchoolScopeGuard } from './school-scope.guard';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard, SchoolScopeGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  // ----- Classes -----

  @Post('classes')
  @Permissions({ module: 'student-management', action: 'create' })
  @ApiOperation({ summary: 'Create a class for a school' })
  createClass(@Body() dto: CreateClassDto) {
    return this.service.createClass(dto);
  }

  @Get('classes')
  @Permissions({ module: 'student-management', action: 'read' })
  @ApiOperation({ summary: 'List classes (with sections) for a school' })
  findClasses(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findClasses(schoolId, activeOnly === 'true');
  }

  @Patch('classes/:id')
  @Permissions({ module: 'student-management', action: 'update' })
  @ApiOperation({ summary: 'Update a class' })
  updateClass(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassDto) {
    return this.service.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @Permissions({ module: 'student-management', action: 'delete' })
  @ApiOperation({ summary: 'Delete a class (soft delete, blocked while in use)' })
  removeClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeClass(id);
  }

  // ----- Sections -----

  @Post('sections')
  @Permissions({ module: 'student-management', action: 'create' })
  @ApiOperation({ summary: 'Create a section under a class' })
  createSection(@Body() dto: CreateSectionDto) {
    return this.service.createSection(dto);
  }

  @Get('sections')
  @Permissions({ module: 'student-management', action: 'read' })
  @ApiOperation({ summary: 'List sections of a class' })
  findSections(
    @Query('classId', ParseUUIDPipe) classId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findSections(classId, activeOnly === 'true');
  }

  @Patch('sections/:id')
  @Permissions({ module: 'student-management', action: 'update' })
  @ApiOperation({ summary: 'Update a section' })
  updateSection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionDto) {
    return this.service.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @Permissions({ module: 'student-management', action: 'delete' })
  @ApiOperation({ summary: 'Delete a section (soft delete, blocked while in use)' })
  removeSection(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeSection(id);
  }

  // ----- Students -----

  @Post()
  @Permissions({ module: 'student-management', action: 'create' })
  @ApiOperation({ summary: 'Add a student (admission number auto-generated)' })
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createStudent(dto, userId);
  }

  @Get()
  @Permissions({ module: 'student-management', action: 'read' })
  @ApiOperation({ summary: 'Search / filter students' })
  list(@Query() query: ListStudentsQueryDto) {
    return this.service.listStudents(query);
  }

  @Get(':id')
  @Permissions({ module: 'student-management', action: 'read' })
  @ApiOperation({ summary: 'Student profile (basic + academic info)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findStudent(id);
  }

  @Patch(':id')
  @Permissions({ module: 'student-management', action: 'update' })
  @ApiOperation({ summary: 'Edit a student' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.service.updateStudent(id, dto);
  }

  @Delete(':id')
  @Permissions({ module: 'student-management', action: 'delete' })
  @ApiOperation({ summary: 'Soft-delete a student (financial history preserved)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeStudent(id);
  }

  @Post('promote')
  @Permissions({ module: 'student-management', action: 'update' })
  @ApiOperation({ summary: 'Promote students to a class/section/academic year' })
  promote(@Body() dto: PromoteStudentsDto) {
    return this.service.promote(dto);
  }

  @Post(':id/transfer')
  @Permissions({ module: 'student-management', action: 'update' })
  @ApiOperation({ summary: 'Transfer a student to another school' })
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferStudentDto,
  ) {
    return this.service.transfer(id, dto);
  }
}
