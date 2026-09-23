/**
 * Demo data seeder — creates three demo schools with classes, sections,
 * students, fee structures, monthly student fees, payments and receipts so
 * that Student Management, Fee Collection and Finance Reports all show
 * realistic data.
 *
 * Idempotent: every step checks for existing records before creating, so the
 * script can be re-run safely. Requires the base seed (roles + Super Admin)
 * to have run first (`npm run seed`).
 *
 * Run: npm run seed:demo
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull, In } from 'typeorm';
import { AppModule } from './app.module';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';
import { DataCollectionService } from './data-collection/data-collection.service';
import { StudentsService } from './students/students.service';
import { FeeManagementService } from './fee-management/fee-management.service';
import { FeeCollectionService } from './fee-collection/fee-collection.service';
import { DcSchool } from './data-collection/entities/dc-school.entity';
import { AcademicYear } from './fee-management/entities/academic-year.entity';
import { FeeHead } from './fee-management/entities/fee-head.entity';
import { Student, StudentGender } from './students/entities/student.entity';
import { SchoolSection } from './students/entities/section.entity';
import { StudentFee, StudentFeeStatus } from './fee-collection/entities/student-fee.entity';
import {
  CreateAcademicYearDto,
  CreateFeeHeadDto,
  SaveFeeStructureDto,
} from './fee-management/dto/fee-management.dto';
import {
  GenerateFeesDto,
  CollectPaymentDto,
} from './fee-collection/dto/fee-collection.dto';
import { PaymentMethod } from './fee-collection/entities/payment.entity';
import { DiscountType } from './fee-management/entities/student-discount.entity';

const ACADEMIC_YEAR = '2026';
const FEE_MONTHS = [1, 2, 3, 4, 5, 6]; // Jan–Jun 2026
const EXAM_FEE_MONTHS = [3, 6];

interface DemoSchoolConfig {
  name: string;
  code: string;
  schoolCategory: string;
  gradeCoverage: string;
  tuition: number;
  exam: number;
  phoneSuffix: string;
  classNames: { name: string; sequence: number }[];
}

/**
 * Existing schools (added by the user) — matched by `code`, so the seeder
 * reuses them instead of creating new ones. They only get created with these
 * exact codes/names if they are missing (e.g. fresh environment).
 */
const DEMO_SCHOOLS: DemoSchoolConfig[] = [
  {
    name: 'BRAC Academy-Cumilla',
    code: 'SCH-MUDCC9Y5',
    schoolCategory: 'brac_academy',
    gradeCoverage: 'Play World, Grade 1 - Grade 5',
    tuition: 800,
    exam: 200,
    phoneSuffix: '1',
    classNames: [
      { name: 'Play World', sequence: 0 },
      { name: 'Grade 1', sequence: 2 },
      { name: 'Grade 2', sequence: 3 },
      { name: 'Grade 3', sequence: 4 },
      { name: 'Grade 4', sequence: 5 },
      { name: 'Grade 5', sequence: 6 },
    ],
  },
  {
    name: 'BRAC Primary School, Manjai',
    code: 'SCH-MUDCE2YF',
    schoolCategory: 'brac_primary',
    gradeCoverage: 'Play & Learn, Grade 1 - Grade 4',
    tuition: 500,
    exam: 150,
    phoneSuffix: '2',
    classNames: [
      { name: 'Play & Learn', sequence: 1 },
      { name: 'Grade 1', sequence: 2 },
      { name: 'Grade 2', sequence: 3 },
      { name: 'Grade 3', sequence: 4 },
      { name: 'Grade 4', sequence: 5 },
    ],
  },
  {
    name: 'BRAC Secondary School, Joldhaka',
    code: 'SCH-MUDCF2KJ',
    schoolCategory: 'brac_secondary',
    gradeCoverage: 'Grade 6 - Grade 10',
    tuition: 1000,
    exam: 300,
    phoneSuffix: '3',
    classNames: [
      { name: 'Grade 6', sequence: 7 },
      { name: 'Grade 7', sequence: 8 },
      { name: 'Grade 8', sequence: 9 },
      { name: 'Grade 9', sequence: 10 },
      { name: 'Grade 10', sequence: 11 },
    ],
  },
];

const SECTION_NAMES = ['A', 'B'];

/** Students enrolled per (class, section). */
const STUDENTS_PER_SECTION = 5;

// 12 students per school — two per (class, section) combination.
const STUDENT_NAMES = [
  { name: 'Ayesha Siddika', gender: 'female', guardian: 'Md. Rafiqul Islam' },
  { name: 'Tanvir Hasan', gender: 'male', guardian: 'Abdul Karim' },
  { name: 'Sumaiya Akter', gender: 'female', guardian: 'Nurul Amin' },
  { name: 'Rakibul Islam', gender: 'male', guardian: 'Shahin Alam' },
  { name: 'Nusrat Jahan', gender: 'female', guardian: 'Mizanur Rahman' },
  { name: 'Mehedi Hasan', gender: 'male', guardian: 'Jashim Uddin' },
  { name: 'Farhana Yasmin', gender: 'female', guardian: 'Kamrul Hasan' },
  { name: 'Sabbir Ahmed', gender: 'male', guardian: 'Anowar Hossain' },
  { name: 'Jannatul Ferdous', gender: 'female', guardian: 'Habibur Rahman' },
  { name: 'Imran Khan', gender: 'male', guardian: 'Saiful Islam' },
  { name: 'Sadia Islam', gender: 'female', guardian: 'Rezaul Karim' },
  { name: 'Ariful Haque', gender: 'male', guardian: 'Babul Akter' },
];

/** Deterministic student pool — same 12 base names, uniquified per entry. */
function studentAt(i: number) {
  const base = STUDENT_NAMES[i % STUDENT_NAMES.length];
  const gen = Math.floor(i / STUDENT_NAMES.length);
  return {
    ...base,
    name: gen === 0 ? base.name : `${base.name} ${gen + 1}`,
    guardian: gen === 0 ? base.guardian : `${base.guardian} ${gen + 1}`,
  };
}

const PAYMENT_METHODS: { method: PaymentMethod; bank?: string }[] = [
  { method: PaymentMethod.CASH },
  { method: PaymentMethod.MFS, bank: 'bKash' },
  { method: PaymentMethod.BANK, bank: 'Dutch-Bangla Bank' },
  { method: PaymentMethod.CASH },
  { method: PaymentMethod.MFS, bank: 'Nagad' },
  { method: PaymentMethod.BANK, bank: 'BRAC Bank' },
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function seedDemoData() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const usersService = app.get(UsersService);
    const rolesService = app.get(RolesService);
    const dataCollectionService = app.get(DataCollectionService);
    const studentsService = app.get(StudentsService);
    const feeManagementService = app.get(FeeManagementService);
    const feeCollectionService = app.get(FeeCollectionService);

    // ---------- 1. Ensure the Super Admin exists (base seed) ----------
    let admin = await usersService.findOneByEmail('admin@bep.org').catch(() => null);
    if (!admin) {
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (!password || /CHANGE_ME|change-in-production|placeholder/i.test(password)) {
        throw new Error(
          'Super Admin missing and SEED_ADMIN_PASSWORD invalid. Run `npm run seed` first.',
        );
      }
      await rolesService.seedDefaultRoles();
      await usersService.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@bep.org',
        password,
        phone: '+8801700000000',
      });
      admin = await usersService.findOneByEmail('admin@bep.org');
      const roles = await rolesService.findAll();
      const superAdminRole = roles.find((r) => r.name === 'Super Admin');
      if (admin && superAdminRole) {
        await usersService.assignRoles(admin.id, [superAdminRole.id]);
      }
    }
    if (!admin) throw new Error('Could not resolve the Super Admin user');
    const adminId = admin.id;
    console.log('✅ Using Super Admin (admin@bep.org)');

    // ---------- 2. Academic year ----------
    const yearRepo = dataSource.getRepository(AcademicYear);
    let academicYear = await yearRepo.findOne({ where: { name: ACADEMIC_YEAR } });
    if (!academicYear) {
      academicYear = await feeManagementService.createAcademicYear({
        name: ACADEMIC_YEAR,
        startDate: isoDate(2026, 1, 1),
        endDate: isoDate(2026, 12, 31),
        status: 'active' as CreateAcademicYearDto['status'],
      });
      console.log(`✅ Academic year ${ACADEMIC_YEAR} created (active)`);
    } else {
      console.log(`ℹ️  Academic year ${ACADEMIC_YEAR} already exists`);
    }
    const academicYearId = academicYear.id;

    // ---------- 3. Fee heads (per school category, copied from fee-structure-primary) ----------
    const feeHeadRepo = dataSource.getRepository(FeeHead);
    const FEE_HEAD_CATEGORIES = ['brac_academy', 'brac_primary', 'brac_secondary'];
    const NEW_HEADS: { name: string; description: string }[] = [
      { name: 'Monthly Tuition Fee', description: 'Monthly tuition charge' },
      { name: 'Development Fee', description: 'Monthly development charge' },
      { name: 'Tiffin Fee', description: 'Monthly tiffin charge' },
      { name: 'Transport Fee', description: 'Monthly transport charge' },
      { name: 'Admission Fee', description: 'Annual / session charge' },
      { name: 'Session Charge', description: 'Annual / session charge' },
      { name: 'Exam Fee', description: 'Annual / session examination charge' },
      { name: 'Annual Fund', description: 'Annual / session charge' },
      { name: 'Other Charges', description: 'Annual / session charge' },
    ];
    const feeHeadsByCategory: Record<string, Record<string, { id: string; name: string }>> = {};
    for (const category of FEE_HEAD_CATEGORIES) {
      feeHeadsByCategory[category] = {};
      for (const spec of NEW_HEADS) {
        let head = await feeHeadRepo.findOne({ where: { name: spec.name, category } });
        if (!head) {
          const dto: CreateFeeHeadDto = {
            name: spec.name,
            category,
            description: spec.description,
          };
          head = await feeManagementService.createFeeHead(dto);
          console.log(`✅ Fee head "${spec.name}" [${category}] created`);
        }
        feeHeadsByCategory[category][spec.name] = { id: head.id, name: head.name };
      }
    }

    // ---------- 4-7. Schools, classes, sections, students, discounts ----------
    const schoolRepo = dataSource.getRepository(DcSchool);
    const studentRepo = dataSource.getRepository(Student);
    const sectionRepo = dataSource.getRepository(SchoolSection);

    for (const cfg of DEMO_SCHOOLS) {
      let school = await schoolRepo.findOne({ where: { code: cfg.code } });
      if (!school) {
        school = await dataCollectionService.createSchool(
          {
            name: cfg.name,
            code: cfg.code,
            schoolCategory: cfg.schoolCategory,
            schoolType: 'plain_land',
            gradeCoverage: cfg.gradeCoverage,
            address: 'Demo Road, Demo Area',
            division: 'Dhaka',
            district: 'Gazipur',
            upazila: 'Sreepur',
            phone: `+88017100000${cfg.phoneSuffix}`,
            email: `${cfg.code.toLowerCase()}@demo.brac`,
            principalName: 'Demo Principal',
            establishedYear: 2010,
            governmentApproval: true,
            totalTeachers: 8,
            totalStudents: 60,
            isActive: true,
          },
          adminId,
        );
        console.log(`✅ School "${cfg.name}" (${cfg.schoolCategory}) created`);
      } else {
        console.log(`ℹ️  School "${cfg.name}" already exists`);
      }

      // Classes + sections
      const classIds: string[] = [];
      for (const c of cfg.classNames) {
        let schoolClass = (await studentsService.findClasses(school.id)).find(
          (cl) => cl.name === c.name,
        );
        if (!schoolClass) {
          schoolClass = await studentsService.createClass({
            name: c.name,
            schoolId: school.id,
            sequence: c.sequence,
          });
          console.log(`   ✅ Class "${c.name}" created`);
        }
        classIds.push(schoolClass.id);
        for (const secName of SECTION_NAMES) {
          const sections = await studentsService.findSections(schoolClass.id);
          if (!sections.find((s) => s.name === secName)) {
            await studentsService.createSection({
              name: secName,
              classId: schoolClass.id,
            });
            console.log(`   ✅ Section "${secName}" created for "${c.name}"`);
          }
        }
      }

      // Students: STUDENTS_PER_SECTION per (class, section)
      const existingStudents = await studentRepo.find({
        where: { schoolId: school.id, deletedAt: IsNull() },
      });
      if (existingStudents.length === 0) {
        const allSections = await sectionRepo.find({
          where: { classId: In(classIds) },
          order: { name: 'ASC' },
        });
        const sequenceByClassId = new Map(
          cfg.classNames.map((c, i) => [classIds[i], c.sequence]),
        );
        let nameIdx = 0;
        for (const section of allSections) {
          for (let k = 0; k < STUDENTS_PER_SECTION; k++) {
            const person = studentAt(nameIdx);
            const grade = sequenceByClassId.get(section.classId) ?? 5;
            await studentsService.createStudent(
              {
                name: person.name,
                schoolId: school.id,
                dateOfBirth: isoDate(2026 - (grade + 5), 1, 10 + k),
                gender: person.gender === 'female' ? StudentGender.FEMALE : StudentGender.MALE,
                guardianName: person.guardian,
                guardianPhone: `+88018100000${String(10 + nameIdx).padStart(2, '0')}`,
                address: 'Demo Area, Sreepur, Gazipur',
                academicYearId,
                classId: section.classId,
                sectionId: section.id,
                rollNumber: k + 1,
                admissionDate: isoDate(2026, 1, 1),
              },
              adminId,
            );
            nameIdx++;
          }
        }
        console.log(`   ✅ ${allSections.length * STUDENTS_PER_SECTION} students enrolled`);
      } else {
        console.log(
          `   ℹ️  ${existingStudents.length} students already exist, skipping enrollment`,
        );
      }

      // Sibling discount for the first two students
      const schoolStudents = await studentRepo.find({
        where: { schoolId: school.id, deletedAt: IsNull() },
        order: { createdAt: 'ASC' },
      });
      for (const student of schoolStudents.slice(0, 2)) {
        const existing = await dataSource.query(
          `SELECT 1 FROM bep.edu_student_discounts
           WHERE student_id = $1 AND academic_year_id = $2 AND is_active = true LIMIT 1`,
          [student.id, academicYearId],
        );
        if (existing.length === 0) {
          await feeManagementService.createStudentDiscount(
            {
              studentId: student.id,
              academicYearId,
              type: DiscountType.PERCENTAGE,
              value: 10,
              reason: 'Sibling discount (demo)',
            },
            adminId,
          );
          console.log(`   ✅ 10% sibling discount applied to ${student.name}`);
        }
      }
    }

    // ---------- 8. Fee structures (per school/class/month) ----------
    for (const cfg of DEMO_SCHOOLS) {
      const school = await schoolRepo.findOneOrFail({ where: { code: cfg.code } });
      const schoolClasses = await studentsService.findClasses(school.id);
      for (const schoolClass of schoolClasses) {
        for (const month of FEE_MONTHS) {
          const lines: SaveFeeStructureDto['lines'] = [
            { feeHeadId: feeHeadsByCategory[cfg.schoolCategory]['Monthly Tuition Fee'].id, amount: cfg.tuition },
          ];
          if (EXAM_FEE_MONTHS.includes(month)) {
            lines.push({ feeHeadId: feeHeadsByCategory[cfg.schoolCategory]['Exam Fee'].id, amount: cfg.exam });
          }
          await feeManagementService.saveFeeStructure(
            {
              schoolId: school.id,
              academicYearId,
              classId: schoolClass.id,
              month,
              lines,
            },
            adminId,
          );
        }
      }
      console.log(
        `✅ Fee structures saved for "${cfg.name}" (${cfg.tuition}/mo tuition, exam fee in months ${EXAM_FEE_MONTHS.join(', ')})`,
      );
    }

    // ---------- 9. Generate monthly student fees ----------
    for (const cfg of DEMO_SCHOOLS) {
      const school = await schoolRepo.findOneOrFail({ where: { code: cfg.code } });
      for (const month of FEE_MONTHS) {
        const dto: GenerateFeesDto = {
          schoolId: school.id,
          academicYearId,
          month,
        };
        const result = await feeCollectionService.generateFees(dto);
        console.log(
          `   🧾 "${cfg.name}" month ${month}: ${result.created} fee rows generated, ${result.skipped} skipped`,
        );
      }
    }

    // ---------- 9b. Cancel June payments left by earlier runs ----------
    // June is intentionally left fully unpaid so the Dues page/report has
    // clear examples. If this script (or an older version) created June
    // payments before, void them (receipts are cancelled too).
    const junePaymentRows = await dataSource.query(
      `SELECT p.id FROM bep.edu_payments p
       JOIN bep.edu_student_fees f ON f.id = p.student_fee_id
       WHERE p.status = 'completed' AND f.month = 6 AND p.transaction_ref LIKE 'DEMO-%'`,
    );
    for (const row of junePaymentRows) {
      await feeCollectionService.cancelPayment(
        row.id,
        'Demo reset: June kept unpaid to demo dues',
        adminId,
      );
    }
    if (junePaymentRows.length > 0) {
      console.log(`✅ Cancelled ${junePaymentRows.length} June demo payments to keep dues visible`);
    }

    // ---------- 10. Payments: realistic collection pattern ----------
    //   Jan–Apr: everyone pays in full
    //   May:     first half of students pay in full, the rest pay half
    //   Jun:     left unpaid (visible dues everywhere)
    const feeRepo = dataSource.getRepository(StudentFee);
    let paymentCount = 0;
    for (const cfg of DEMO_SCHOOLS) {
      const school = await schoolRepo.findOneOrFail({ where: { code: cfg.code } });
      for (const month of FEE_MONTHS) {
        const fees = await feeRepo.find({
          where: { schoolId: school.id, academicYearId, month },
          relations: ['student'],
          order: { createdAt: 'ASC' },
        });
        for (let i = 0; i < fees.length; i++) {
          const fee = fees[i];
          const payable = parseFloat(fee.payableAmount);
          const alreadyPaid = parseFloat(fee.paidAmount);
          const remaining = Math.round((payable - alreadyPaid) * 100) / 100;
          if (remaining <= 0) continue; // already settled

          const isJune = month === 6;
          if (isJune) continue; // June stays fully unpaid — demo dues
          const isMay = month === 5;
          const studentIndex = fees.indexOf(fee);
          const fullPayer = !isMay || studentIndex < fees.length / 2;
          const target = fullPayer ? payable : Math.round((payable / 2) * 100) / 100;
          const amount = Math.round((target - alreadyPaid) * 100) / 100;
          if (amount <= 0) continue;

          const method = PAYMENT_METHODS[(studentIndex + month) % PAYMENT_METHODS.length];
          const dto: CollectPaymentDto = {
            studentFeeId: fee.id,
            amount,
            paymentMethod: method.method,
            bankName: method.bank,
            transactionRef: `DEMO-${cfg.code}-${month}-${studentIndex}`,
            paymentDate: isoDate(2026, month, 5 + (studentIndex % 20)),
          };
          await feeCollectionService.collectPayment(dto, adminId);
          paymentCount++;
        }
      }
      console.log(`✅ Payments recorded for "${cfg.name}"`);
    }
    console.log(`✅ ${paymentCount} payments created in total`);

    // ---------- Summary ----------
    const paidCount = await feeRepo.count({ where: { academicYearId, status: StudentFeeStatus.PAID } });
    const partialCount = await feeRepo.count({ where: { academicYearId, status: StudentFeeStatus.PARTIAL } });
    const dueCount = await feeRepo.count({ where: { academicYearId, status: StudentFeeStatus.DUE } });
    console.log('\n📊 Demo fee status summary:');
    console.log(`   Paid:    ${paidCount}`);
    console.log(`   Partial: ${partialCount}`);
    console.log(`   Due:     ${dueCount}`);

  console.log('\n🎉 Demo data seeding completed!');
  console.log('   Login as admin@bep.org to explore:');
  console.log('   • BRAC Academy-Cumilla / BRAC Primary School, Manjai / BRAC Secondary School, Joldhaka');
  console.log('   • Student Management → classes, sections & students');
  console.log('   • Fee Collection → monthly collection & payment history');
  console.log('   • Finance Reports → collection, dues, class-wise, fee-head, ledger');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seedDemoData();