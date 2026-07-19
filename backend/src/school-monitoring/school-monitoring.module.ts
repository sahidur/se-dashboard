import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolMonitoringService } from './school-monitoring.service';
import { SchoolMonitoringController } from './school-monitoring.controller';
import { MonitoringSubmission } from './entities/monitoring-submission.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitoringSubmission, DcSchool]),
    UsersModule,
  ],
  controllers: [SchoolMonitoringController],
  providers: [SchoolMonitoringService],
  exports: [SchoolMonitoringService],
})
export class SchoolMonitoringModule {}
