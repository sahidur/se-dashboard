import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeManagementService } from './fee-management.service';
import { FeeManagementController } from './fee-management.controller';
import { AcademicYear } from './entities/academic-year.entity';
import { FeeHead } from './entities/fee-head.entity';
import { FeeStructure } from './entities/fee-structure.entity';
import { StudentDiscount } from './entities/student-discount.entity';
import { Student } from '../students/entities/student.entity';
import { SchoolClass } from '../students/entities/school-class.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { UsersModule } from '../users/users.module';
import { SchoolScopeGuard } from '../students/school-scope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYear,
      FeeHead,
      FeeStructure,
      StudentDiscount,
      Student,
      SchoolClass,
      DcSchool,
    ]),
    UsersModule,
  ],
  controllers: [FeeManagementController],
  providers: [FeeManagementService, SchoolScopeGuard],
  exports: [FeeManagementService],
})
export class FeeManagementModule {}
