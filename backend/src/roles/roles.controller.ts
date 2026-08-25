import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions({ module: 'roles', action: 'create' })
  @ApiOperation({ summary: 'Create a new role' })
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    // actorId enables the privilege-hierarchy guard in the service.
    return this.rolesService.create(createRoleDto, actorId);
  }

  @Get()
  @Permissions({ module: 'roles', action: 'read' })
  @ApiOperation({ summary: 'Get all roles' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions({ module: 'roles', action: 'read' })
  @ApiOperation({ summary: 'Get a role by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'roles', action: 'update' })
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.rolesService.update(id, updateRoleDto, actorId);
  }

  @Delete(':id')
  @Permissions({ module: 'roles', action: 'delete' })
  @ApiOperation({ summary: 'Delete a role' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.rolesService.remove(id, actorId);
  }

  @Post('seed')
  @Permissions({ module: 'roles', action: 'create' })
  @ApiOperation({ summary: 'Seed default roles' })
  async seedRoles() {
    await this.rolesService.seedDefaultRoles();
    return { message: 'Default roles seeded successfully' };
  }
}
