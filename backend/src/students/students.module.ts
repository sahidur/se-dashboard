import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student } from './entities/student.entity';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSection } from './entities/section.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { AcademicYear } from '../fee-management/entities/academic-year.entity';
import { UsersModule } from '../users/users.module';
import { SchoolScopeGuard } from './school-scope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, SchoolClass, SchoolSection, DcSchool, AcademicYear]),
    UsersModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService, SchoolScopeGuard],
  exports: [StudentsService],
})
export class StudentsModule {}
