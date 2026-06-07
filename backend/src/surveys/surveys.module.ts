import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { Survey } from './entities/survey.entity';
import { SurveyField } from './entities/survey-field.entity';
import { SurveySection } from './entities/survey-section.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { SurveyAnswer } from './entities/survey-answer.entity';
import { SurveyAssignment } from './entities/survey-assignment.entity';
import { SurveyStatusLog } from './entities/survey-status-log.entity';
import { SchoolRecord } from './entities/school-record.entity';
import { SurveyCategory } from './entities/survey-category.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Survey,
      SurveyField,
      SurveySection,
      SurveyResponse,
      SurveyAnswer,
      SurveyAssignment,
      SurveyStatusLog,
      SchoolRecord,
      SurveyCategory,
    ]),
    UsersModule,
  ],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
