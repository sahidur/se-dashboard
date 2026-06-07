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
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { SubmitSurveyResponseDto } from './dto/submit-response.dto';
import { CreateSurveyAssignmentDto } from './dto/create-survey.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SurveyStatus } from './entities/survey.entity';

@ApiTags('Surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Post()
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'create' })
  @ApiOperation({ summary: 'Create a new survey' })
  async create(
    @Body() createSurveyDto: CreateSurveyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.surveysService.create(createSurveyDto, userId);
  }

  @Get()
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'read' })
  @ApiOperation({ summary: 'Get all surveys with pagination and filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SurveyStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('status') status?: SurveyStatus,
    @Query('search') search?: string,
  ) {
    return this.surveysService.findAll(
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '20', 10) || 20,
      { category, status, search },
    );
  }

  // =========== Categories ===========
  @Get('categories')
  @ApiOperation({ summary: 'Get active survey categories' })
  async getCategories() {
    return this.surveysService.getCategories();
  }

  @Get('categories/all')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'categories', action: 'read' })
  @ApiOperation({ summary: 'Get all survey categories (including inactive)' })
  async getAllCategories() {
    return this.surveysService.getAllCategories();
  }

  @Post('categories')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'categories', action: 'create' })
  @ApiOperation({ summary: 'Create a new survey category' })
  async createCategory(
    @Body() body: { name: string; description?: string; sortOrder?: number },
  ) {
    return this.surveysService.createCategory(body);
  }

  @Patch('categories/:categoryId')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'categories', action: 'update' })
  @ApiOperation({ summary: 'Update a survey category' })
  async updateCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.surveysService.updateCategory(categoryId, body);
  }

  @Delete('categories/:categoryId')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'categories', action: 'delete' })
  @ApiOperation({ summary: 'Delete a survey category' })
  async deleteCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    await this.surveysService.deleteCategory(categoryId);
    return { message: 'Category deleted' };
  }

  // =========== Assigned Surveys ===========
  @Get('assigned')
  @ApiOperation({ summary: 'Get surveys assigned to current user' })
  async getAssignedSurveys(@CurrentUser() user: any) {
    const roleIds = user.roles?.map((r: any) => r.id) || [];
    return this.surveysService.findAssignedSurveys(user.id, roleIds);
  }

  // =========== School Records ===========
  @Get('school-records/my')
  @ApiOperation({ summary: 'Get school records created by current user' })
  async getMySchoolRecords(@CurrentUser('id') userId: string) {
    return this.surveysService.getSchoolRecords(userId);
  }

  @Get('school-records')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'school-records', action: 'read' })
  @ApiOperation({ summary: 'Get all school records' })
  async getAllSchoolRecords() {
    return this.surveysService.getAllSchoolRecords();
  }

  @Get('school-records/:recordId')
  @ApiOperation({ summary: 'Get a school record' })
  async getSchoolRecord(
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.surveysService.getSchoolRecord(recordId);
  }

  @Get('school-records/:recordId/responses')
  @ApiOperation({ summary: 'Get all responses linked to a school record' })
  async getSchoolRecordResponses(
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.surveysService.getSchoolRecordResponses(recordId);
  }

  @Patch('school-records/:recordId/transfer')
  @Roles('Super Admin')
  @Permissions({ module: 'school-records', action: 'update' })
  @ApiOperation({ summary: 'Transfer school record ownership to another user' })
  async transferSchoolRecordOwnership(
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body('newOwnerId', ParseUUIDPipe) newOwnerId: string,
  ) {
    return this.surveysService.transferSchoolRecordOwnership(
      recordId,
      newOwnerId,
    );
  }

  // =========== Survey Detail ===========
  @Get(':id')
  @ApiOperation({ summary: 'Get a survey by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.findOne(id);
  }

  @Get(':id/stats')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'read' })
  @ApiOperation({ summary: 'Get survey statistics' })
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.getSurveyStats(id);
  }

  @Get(':id/status-logs')
  @ApiOperation({ summary: 'Get status change history for a survey' })
  async getStatusLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.getStatusLogs(id);
  }

  @Get(':id/draft')
  @ApiOperation({ summary: 'Get current user draft response for a survey' })
  async getDraftResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    const draft = await this.surveysService.getUserDraftResponse(id, userId);
    return draft || { draft: null };
  }

  @Patch(':id')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'update' })
  @ApiOperation({ summary: 'Update a survey' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSurveyDto: UpdateSurveyDto,
  ) {
    return this.surveysService.update(id, updateSurveyDto);
  }

  @Patch(':id/status')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'update' })
  @ApiOperation({ summary: 'Update survey status with validation + logging' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: SurveyStatus,
    @CurrentUser('id') userId: string,
  ) {
    return this.surveysService.updateStatus(id, status, userId);
  }

  @Post(':id/copy')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'create' })
  @ApiOperation({ summary: 'Duplicate a survey as draft' })
  async copySurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.surveysService.copySurvey(id, userId);
  }

  // =========== Assignment Management ===========
  @Get(':id/assignments')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'read' })
  @ApiOperation({ summary: 'Get all assignments for a survey' })
  async getAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.getAssignments(id);
  }

  @Post(':id/assignments')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'update' })
  @ApiOperation({ summary: 'Add assignment(s) to a survey' })
  async addAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSurveyAssignmentDto,
  ) {
    return this.surveysService.addAssignment(id, dto);
  }

  @Post(':id/assignments/bulk')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'update' })
  @ApiOperation({ summary: 'Add multiple assignments to a survey at once' })
  async addBulkAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assignments: CreateSurveyAssignmentDto[] },
  ) {
    return this.surveysService.addBulkAssignments(id, body.assignments);
  }

  @Delete('assignments/:assignmentId')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'update' })
  @ApiOperation({ summary: 'Remove an assignment' })
  async removeAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    await this.surveysService.removeAssignment(assignmentId);
    return { message: 'Assignment removed' };
  }

  @Delete(':id')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'surveys', action: 'delete' })
  @ApiOperation({ summary: 'Delete a survey (never if was published)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveysService.remove(id);
  }

  // =========== Survey Responses ===========
  @Post('responses')
  @ApiOperation({ summary: 'Submit or save draft survey response' })
  async submitResponse(
    @Body() submitDto: SubmitSurveyResponseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.surveysService.submitResponse(submitDto, userId);
  }

  @Get(':id/responses')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'read' })
  @ApiOperation({ summary: 'Get responses for a survey' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getResponses(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.surveysService.getResponses(
      id,
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '20', 10) || 20,
      { startDate, endDate },
    );
  }

  @Get(':id/responses/export')
  @Roles('Super Admin', 'Admin', 'Survey Creator')
  @Permissions({ module: 'surveys', action: 'read' })
  @ApiOperation({ summary: 'Export survey responses as CSV' })
  async exportResponses(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.surveysService.exportResponsesCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="survey-responses-${id}.csv"`,
    );
    res.send(csv);
  }

  @Get('responses/:responseId')
  @ApiOperation({ summary: 'Get a specific survey response' })
  async getResponse(
    @Param('responseId', ParseUUIDPipe) responseId: string,
  ) {
    return this.surveysService.getResponse(responseId);
  }
}
