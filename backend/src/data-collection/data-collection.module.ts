import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCollectionService } from './data-collection.service';
import { DataCollectionController } from './data-collection.controller';
import { DcSchool } from './entities/dc-school.entity';
import { DcBasicInfo } from './entities/dc-basic-info.entity';
import { DcInfrastructure } from './entities/dc-infrastructure.entity';
import { DcStudentsInfo } from './entities/dc-students-info.entity';
import { DcTeachersInfo } from './entities/dc-teachers-info.entity';
import { DcTeacherIndividual } from './entities/dc-teacher-individual.entity';
import { DcTeachersDevelopment } from './entities/dc-teachers-development.entity';
import { DcRevenue } from './entities/dc-revenue.entity';
import { DcFeeStructure } from './entities/dc-fee-structure.entity';
import { DcFeeStructureLog } from './entities/dc-fee-structure-log.entity';
import { DcRevenueBudgetTotal } from './entities/dc-revenue-budget-total.entity';
import { DcRevenueBudgetMonthly } from './entities/dc-revenue-budget-monthly.entity';
import { DcRevenueActualTotal } from './entities/dc-revenue-actual-total.entity';
import { DcRevenueActualMonthly } from './entities/dc-revenue-actual-monthly.entity';
import { DcPerformance } from './entities/dc-performance.entity';
import { DcAlumni } from './entities/dc-alumni.entity';
import { DcPedagogicalAchievement } from './entities/dc-pedagogical-achievement.entity';
import { DcCocurricular } from './entities/dc-cocurricular.entity';
import { DcStudentsPerformance } from './entities/dc-students-performance.entity';
import { DcActivityParticipation } from './entities/dc-activity-participation.entity';
import { DcEventParticipation } from './entities/dc-event-participation.entity';
import { DcFormDraft } from './entities/dc-form-draft.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DcSchool,
      DcBasicInfo,
      DcInfrastructure,
      DcStudentsInfo,
      DcTeachersInfo,
      DcTeacherIndividual,
      DcTeachersDevelopment,
      DcRevenue,
      DcFeeStructure,
      DcFeeStructureLog,
      DcRevenueBudgetTotal,
      DcRevenueBudgetMonthly,
      DcRevenueActualTotal,
      DcRevenueActualMonthly,
      DcPerformance,
      DcAlumni,
      DcPedagogicalAchievement,
      DcCocurricular,
      DcStudentsPerformance,
      DcActivityParticipation,
      DcEventParticipation,
      DcFormDraft,
    ]),
    UsersModule,
  ],
  controllers: [DataCollectionController],
  providers: [DataCollectionService],
  exports: [DataCollectionService],
})
export class DataCollectionModule {}
