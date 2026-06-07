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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'users', action: 'create' })
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('Super Admin', 'Admin')
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
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Users can only update their own non-role fields
    delete updateUserDto.roleIds;
    delete updateUserDto.isActive;
    return this.usersService.update(userId, updateUserDto);
  }

  @Get(':id')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'users', action: 'read' })
  @ApiOperation({ summary: 'Get a user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneById(id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/reset-password')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Reset password for a user (Super Admin only)' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @Permissions({ module: 'users', action: 'delete' })
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/roles')
  @Roles('Super Admin', 'Admin')
  @Permissions({ module: 'users', action: 'update' })
  @ApiOperation({ summary: 'Assign roles to a user' })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.usersService.assignRoles(id, body.roleIds);
  }
}
