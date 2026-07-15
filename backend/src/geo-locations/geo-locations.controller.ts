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
import { GeoLocationsService } from './geo-locations.service';
import { CreateGeoLocationDto, UpdateGeoLocationDto } from './dto/geo-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { GeoLocationType } from './entities/geo-location.entity';

@ApiTags('Geo Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('geo-locations')
export class GeoLocationsController {
  constructor(private readonly geoService: GeoLocationsService) {}

  @Post()
  @Permissions({ module: 'geo-locations', action: 'create' })
  @ApiOperation({ summary: 'Create a geo location' })
  create(@Body() dto: CreateGeoLocationDto) {
    return this.geoService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all geo locations with optional filters' })
  @ApiQuery({ name: 'type', required: false, enum: GeoLocationType })
  @ApiQuery({ name: 'parentId', required: false })
  findAll(
    @Query('type') type?: GeoLocationType,
    @Query('parentId') parentId?: string,
  ) {
    return this.geoService.findAll(type, parentId);
  }

  @Get('divisions')
  @ApiOperation({ summary: 'Get all divisions' })
  findDivisions() {
    return this.geoService.findDivisions();
  }

  @Get('areas')
  @ApiOperation({ summary: 'Get all areas' })
  findAreas() {
    return this.geoService.findAreas();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get full geo location tree' })
  findTree() {
    return this.geoService.findTree();
  }

  @Get(':id/children')
  @ApiOperation({ summary: 'Get children of a geo location' })
  findChildren(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoService.findChildren(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a geo location by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'geo-locations', action: 'update' })
  @ApiOperation({ summary: 'Update a geo location' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeoLocationDto,
  ) {
    return this.geoService.update(id, dto);
  }

  @Delete(':id')
  @Permissions({ module: 'geo-locations', action: 'delete' })
  @ApiOperation({ summary: 'Delete a geo location' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoService.remove(id);
  }
}
