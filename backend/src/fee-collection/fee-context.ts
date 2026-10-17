import { EntityManager, In } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { AcademicYear } from '../fee-management/entities/academic-year.entity';
import {
  StudentFeeContext,
  resolveStudentFeeContext,
} from '../fee-management/fee-calculation';

export function feeContextKey(studentId: string, academicYearId: string): string {
  return `${studentId}:${academicYearId}`;
}

/**
 * Loads the admission context (first billable month, new/existing) for every
 * distinct (student, academic year) pair. Pairs whose student or year cannot
 * be found are left out, which callers treat as "no admission rules".
 */
export async function loadFeeContexts(
  manager: EntityManager,
  pairs: { studentId: string; academicYearId: string }[],
): Promise<Map<string, StudentFeeContext>> {
  const result = new Map<string, StudentFeeContext>();
  if (pairs.length === 0) return result;

  const studentIds = [...new Set(pairs.map((p) => p.studentId))];
  const yearIds = [...new Set(pairs.map((p) => p.academicYearId))];

  const [students, years] = await Promise.all([
    manager.find(Student, {
      where: { id: In(studentIds) },
      select: ['id', 'admissionDate', 'studentType', 'studentTypeAcademicYearId'],
      withDeleted: true,
    }),
    manager.find(AcademicYear, { where: { id: In(yearIds) }, withDeleted: true }),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const yearById = new Map(years.map((y) => [y.id, y]));

  for (const { studentId, academicYearId } of pairs) {
    const key = feeContextKey(studentId, academicYearId);
    if (result.has(key)) continue;
    const student = studentById.get(studentId);
    const year = yearById.get(academicYearId);
    if (!student || !year) continue;
    result.set(key, resolveStudentFeeContext(student, year));
  }
  return result;
}
