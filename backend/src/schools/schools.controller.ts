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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @Roles('Super Admin', 'Admin', 'School Admin')
  @Permissions({ module: 'schools', action: 'create' })
  @ApiOperation({ summary: 'Create a new school' })
  async create(@Body() createSchoolDto: CreateSchoolDto) {
    return this.schoolsService.create(createSchoolDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'division', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('district') district?: string,
    @Query('division') division?: string,
  ) {
    return this.schoolsService.findAll(page || 1, limit || 20, {
      search,
      district,
      division,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a school by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get school statistics' })
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.getSchoolStats(id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Admin', 'School Admin')
  @Permissions({ module: 'schools', action: 'update' })
  @ApiOperation({ summary: 'Update a school' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ) {
    return this.schoolsService.update(id, updateSchoolDto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @Permissions({ module: 'schools', action: 'delete' })
  @ApiOperation({ summary: 'Delete a school' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.remove(id);
  }

  @Get(':id/students')
  @Permissions({ module: 'schools', action: 'read' })
  @ApiOperation({ summary: 'Get students of a school' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.schoolsService.getStudents(id, page || 1, limit || 20);
  }

  @Get(':id/teachers')
  @Permissions({ module: 'schools', action: 'read' })
  @ApiOperation({ summary: 'Get teachers of a school' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getTeachers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.schoolsService.getTeachers(id, page || 1, limit || 20);
  }
}
