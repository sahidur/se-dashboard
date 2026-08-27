import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecycleBinService } from './recycle-bin.service';
import { RecycleBinController } from './recycle-bin.controller';
import { Survey } from '../surveys/entities/survey.entity';
import { User } from '../users/entities/user.entity';
import { SurveyCategory } from '../surveys/entities/survey-category.entity';
import { SchoolRecord } from '../surveys/entities/school-record.entity';
import { School } from '../schools/entities/school.entity';
import { Student } from '../schools/entities/student.entity';
import { Teacher } from '../schools/entities/teacher.entity';
import { GeoLocation } from '../geo-locations/entities/geo-location.entity';
import { DcTeacherIndividual } from '../data-collection/entities/dc-teacher-individual.entity';
import { DcAlumni } from '../data-collection/entities/dc-alumni.entity';
import { DcPedagogicalAchievement } from '../data-collection/entities/dc-pedagogical-achievement.entity';
import { DcCocurricular } from '../data-collection/entities/dc-cocurricular.entity';
import { DcStudentsPerformance } from '../data-collection/entities/dc-students-performance.entity';
import { DcStudentPerformance } from '../data-collection/entities/dc-student-performance.entity';
import { DcActivityParticipation } from '../data-collection/entities/dc-activity-participation.entity';
import { DcEventParticipation } from '../data-collection/entities/dc-event-participation.entity';
import { DcFeeStructure } from '../data-collection/entities/dc-fee-structure.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Survey,
      User,
      SurveyCategory,
      SchoolRecord,
      School,
      Student,
      Teacher,
      GeoLocation,
      DcSchool,
      DcTeacherIndividual,
      DcAlumni,
      DcPedagogicalAchievement,
      DcCocurricular,
      DcStudentsPerformance,
      DcStudentPerformance,
      DcActivityParticipation,
      DcEventParticipation,
      DcFeeStructure,
    ]),
    UsersModule,
  ],
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
})
export class RecycleBinModule {}
