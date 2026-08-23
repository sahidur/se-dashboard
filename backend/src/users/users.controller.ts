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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions({ module: 'users', action: 'create' })
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser('id') actorId: string) {
    return this.usersService.create(createUserDto, actorId);
  }

  @Get()
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'searchName', required: false, type: String })
  @ApiQuery({ name: 'searchPhone', required: false, type: String })
  @ApiQuery({ name: 'searchEmail', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('searchName') searchName?: string,
    @Query('searchPhone') searchPhone?: string,
    @Query('searchEmail') searchEmail?: string,
  ) {
    return this.usersService.findAll(page || 1, limit || 20, search, searchName, searchPhone, searchEmail);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findOneById(userId);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update own profile' })
  async updateOwnProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    // UpdateProfileDto is an explicit allowlist — role, active-status and
    // school-access fields are not accepted here (see the DTO for why).
    return this.usersService.update(userId, updateProfileDto);
  }

  @Get('schools/available')
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: 'Get schools available to assign to a user (with search/geo filters)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'division', required: false, type: String })
  @ApiQuery({ name: 'district', required: false, type: String })
  @ApiQuery({ name: 'upazila', required: false, type: String })
  async getAvailableSchools(
    @Query('search') search?: string,
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
  ) {
    return this.usersService.findAvailableSchools({ search, division, district, upazila });
  }

  @Get(':id')
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: 'Get a user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneById(id);
  }

  @Patch(':id')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.update(id, updateUserDto, actorId);
  }

  @Post(':id/reset-password')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Reset password for a user' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  @Patch(':id/status')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.setStatus(id, body.isActive, actorId);
  }

  @Get(':id/activity')
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: "Get a user's recent activity log" })
  async getActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getActivity(id);
  }

  @Get(':id/schools')
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: 'Get schools a user has access to' })
  async getSchools(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getSchools(id);
  }

  @Post(':id/schools')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Grant a user access to additional schools' })
  async addSchools(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { schoolIds: string[] },
  ) {
    return this.usersService.addSchools(id, body.schoolIds || []);
  }

  @Delete(':id/schools/:schoolId')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: "Remove a school from a user's access list" })
  async removeSchool(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
  ) {
    return this.usersService.removeSchool(id, schoolId);
  }

  @Delete(':id')
  @Permissions({ module: 'users', action: 'delete' })
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/roles')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Assign roles to a user' })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.usersService.assignRoles(id, body.roleIds);
  }
}
