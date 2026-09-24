import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeCollectionService } from './fee-collection.service';
import { FeeCollectionController } from './fee-collection.controller';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceReportsController } from './finance-reports.controller';
import { StudentFee } from './entities/student-fee.entity';
import { Payment } from './entities/payment.entity';
import { Receipt } from './entities/receipt.entity';
import { Student } from '../students/entities/student.entity';
import { SchoolClass } from '../students/entities/school-class.entity';
import { SchoolSection } from '../students/entities/section.entity';
import { FeeStructure } from '../fee-management/entities/fee-structure.entity';
import { StudentDiscount } from '../fee-management/entities/student-discount.entity';
import { FeeHead } from '../fee-management/entities/fee-head.entity';
import { AopTarget } from '../fee-management/entities/aop-target.entity';
import { AcademicYear } from '../fee-management/entities/academic-year.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { UsersModule } from '../users/users.module';
import { SchoolScopeGuard } from '../students/school-scope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentFee,
      Payment,
      Receipt,
      Student,
      SchoolClass,
      SchoolSection,
      FeeStructure,
      StudentDiscount,
      FeeHead,
      AcademicYear,
      AopTarget,
      DcSchool,
    ]),
    UsersModule,
  ],
  controllers: [FeeCollectionController, FinanceReportsController],
  providers: [FeeCollectionService, FinanceReportsService, SchoolScopeGuard],
  exports: [FinanceReportsService],
})
export class FeeCollectionModule {}
