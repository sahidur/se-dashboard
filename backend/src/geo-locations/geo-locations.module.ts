import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoLocationsService } from './geo-locations.service';
import { GeoLocationsController } from './geo-locations.controller';
import { GeoLocation } from './entities/geo-location.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([GeoLocation]), UsersModule],
  controllers: [GeoLocationsController],
  providers: [GeoLocationsService],
  exports: [GeoLocationsService],
})
export class GeoLocationsModule {}
