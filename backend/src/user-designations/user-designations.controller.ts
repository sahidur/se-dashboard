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
import { UserDesignationsService } from './user-designations.service';
import {
  CreateUserDesignationDto,
  UpdateUserDesignationDto,
} from './dto/user-designation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('User Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('user-designations')
export class UserDesignationsController {
  constructor(private readonly service: UserDesignationsService) {}

  @Post()
  @Permissions({ module: 'user-designations', action: 'create' })
  @ApiOperation({ summary: 'Create a user designation' })
  create(@Body() dto: CreateUserDesignationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user designations' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Return only active designations',
  })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll(activeOnly === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user designation by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'user-designations', action: 'update' })
  @ApiOperation({ summary: 'Update a user designation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDesignationDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions({ module: 'user-designations', action: 'delete' })
  @ApiOperation({ summary: 'Delete a user designation (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
