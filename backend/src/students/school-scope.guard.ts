import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { UsersService } from '../users/users.service';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { Student } from './entities/student.entity';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSection } from './entities/section.entity';
import { StudentFee } from '../fee-collection/entities/student-fee.entity';
import { Payment } from '../fee-collection/entities/payment.entity';
import { StudentDiscount } from '../fee-management/entities/student-discount.entity';

@Injectable()
export class SchoolScopeGuard implements CanActivate {
  constructor(private readonly db: DataSource, private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const { id, studentId } = req.params;
    const { body = {}, query = {} } = req;
    const path: string = ('/' + req.route.path.replace(/^\/api\//, '')
      .replace(/^\/?(?:students|fee-collection|finance-reports)\/?/, '')).replace(/\/+/g, '/');
    const controller = context.getClass().name;
    const user = req.user;
    if (user.roles?.includes('Super Admin') || user.roles?.includes('Admin')) return true;

    const schoolIds = new Set<string>();
    const add = (schoolId?: string | null) => { if (schoolId) schoolIds.add(schoolId); };
    const lookup = async (entity: any, recordId: string, field = 'schoolId') => {
      const record = await this.db.getRepository(entity).findOne({ where: { id: recordId } });
      if (!record) throw new NotFoundException('Record not found or access denied');
      add(record[field]);
      return record;
    };
    const lookupSection = async (sectionId: string) => {
      const section = await this.db.getRepository(SchoolSection).findOne({ where: { id: sectionId } });
      if (!section) throw new NotFoundException('Record not found or access denied');
      await lookup(SchoolClass, section.classId);
    };

    add(body.schoolId);
    add(query.schoolId);
    add(body.targetSchoolId);
    if (body.classId) await lookup(SchoolClass, body.classId);
    if (query.classId) await lookup(SchoolClass, query.classId);
    if (body.targetClassId) await lookup(SchoolClass, body.targetClassId);
    if (body.sectionId) await lookupSection(body.sectionId);
    if (query.sectionId) await lookupSection(query.sectionId);
    if (body.targetSectionId) await lookupSection(body.targetSectionId);
    if (body.studentId) await lookup(Student, body.studentId);
    if (body.studentFeeId) await lookup(StudentFee, body.studentFeeId);
    if (studentId) await lookup(Student, studentId);

    if (controller === 'StudentsController') {
      if (id) {
        if (path.startsWith('/classes/')) await lookup(SchoolClass, id);
        else if (path.startsWith('/sections/')) await lookupSection(id);
        else await lookup(Student, id);
      }
      if (path === '/sections' && query.classId) await lookup(SchoolClass, query.classId);
      if (body.studentIds?.length) {
        const students = await this.db.getRepository(Student).find({ where: { id: In(body.studentIds) } });
        if (students.length !== new Set(body.studentIds).size) throw new NotFoundException('Students not found or access denied');
        students.forEach((s) => add(s.schoolId));
      }
    }
    if (controller === 'FeeManagementController' && id && path.startsWith('/student-discounts/')) {
      const discount = await this.db.getRepository(StudentDiscount).findOne({ where: { id } });
      if (!discount) throw new NotFoundException('Record not found or access denied');
      await lookup(Student, discount.studentId);
    }
    if (controller === 'FeeManagementController' && studentId) await lookup(Student, studentId);
    if (controller === 'FeeCollectionController') {
      if (id && path.startsWith('/payments/')) {
        const payment = await lookup(Payment, id);
        add(payment.schoolId);
      } else if (id) {
        await lookup(Student, id);
        const fees = await this.db.getRepository(StudentFee).find({ where: { studentId: id }, select: ['schoolId'] });
        fees.forEach((fee) => add(fee.schoolId));
      }
      if (query.studentId) await lookup(Student, query.studentId);
    }
    if (controller === 'FinanceReportsController' && studentId) {
      await lookup(Student, studentId);
      const fees = await this.db.getRepository(StudentFee).find({ where: { studentId }, select: ['schoolId'] });
      fees.forEach((fee) => add(fee.schoolId));
    }
    if (controller === 'FinanceReportsController' && path === '/planned-revenue') {
      throw new NotFoundException('Report not found or access denied');
    }

    // A missing scope on a list endpoint must not turn into an all-schools query.
    if (controller === 'FeeCollectionController' && path === '/payments' && !query.schoolId) {
      throw new NotFoundException('School not found or access denied');
    }
    if (!schoolIds.size && (
      (controller === 'StudentsController' && ['/', '/classes', '/sections'].includes(path)) ||
      (controller === 'FeeCollectionController' && path === '/payments')
    )) throw new NotFoundException('School not found or access denied');

    if (!schoolIds.size) return true; // global catalog (academic years, fee heads)
    const fullUser = await this.users.findOneById(user.id);
    if (!fullUser) throw new NotFoundException('School not found or access denied');
    const assigned = new Set(fullUser.schools?.map((school) => school.id) ?? []);
    for (const schoolId of schoolIds) {
      const school = await this.db.getRepository(DcSchool).findOne({ where: { id: schoolId } });
      if (!school || (school.createdById !== user.id && !assigned.has(schoolId))) {
        throw new NotFoundException('School not found or access denied');
      }
    }
    return true;
  }
}
