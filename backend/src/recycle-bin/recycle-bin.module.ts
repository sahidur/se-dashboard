import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecycleBinService } from './recycle-bin.service';
import { RecycleBinController } from './recycle-bin.controller';
import { Survey } from '../surveys/entities/survey.entity';
import { User } from '../users/entities/user.entity';
import { SurveyCategory } from '../surveys/entities/survey-category.entity';
import { SchoolRecord } from '../surveys/entities/school-record.entity';
import { School } from '../schools/entities/school.entity';
import { GeoLocation } from '../geo-locations/entities/geo-location.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Survey,
      User,
      SurveyCategory,
      SchoolRecord,
      School,
      GeoLocation,
    ]),
    UsersModule,
  ],
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
})
export class RecycleBinModule {}
