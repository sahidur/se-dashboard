/**
 * Demo data seeder — data-collection forms.
 *
 * Seeds every data-collection form for the three demo schools so the School
 * Information status tables, Programme Overview and dashboards all show
 * realistic data:
 *   Basic Info, Infrastructure, Students' Information (Jan–Jun), Teachers'
 *   Information + individual teachers, Teachers' Development (Jan–Jun),
 *   Fee Structures, Revenue Budget/Actual (total + monthly), Pedagogical
 *   Achievements, Students' Performance (Half-yearly + Annual), Activity
 *   Participation (corners/clubs/library/labs), Event Participation,
 *   Co-curricular, Alumni, School Performance summary.
 *
 * Idempotent: every section checks for existing records (school + academic
 * year) before creating, so the script can be re-run safely.
 *
 * Run: npm run seed:demo:dc   (after `npm run seed` created the Super Admin)
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { DataCollectionService } from './data-collection/data-collection.service';
import { DcSchool } from './data-collection/entities/dc-school.entity';
import { DcBasicInfo } from './data-collection/entities/dc-basic-info.entity';
import { DcInfrastructure } from './data-collection/entities/dc-infrastructure.entity';
import { DcStudentsInfo } from './data-collection/entities/dc-students-info.entity';
import { DcTeachersInfo } from './data-collection/entities/dc-teachers-info.entity';
import { DcTeacherIndividual } from './data-collection/entities/dc-teacher-individual.entity';
import { DcTeachersDevelopment } from './data-collection/entities/dc-teachers-development.entity';
import { DcFeeStructure } from './data-collection/entities/dc-fee-structure.entity';
import { DcRevenueBudgetTotal } from './data-collection/entities/dc-revenue-budget-total.entity';
import { DcRevenueActualTotal } from './data-collection/entities/dc-revenue-actual-total.entity';
import { DcRevenueBudgetMonthly } from './data-collection/entities/dc-revenue-budget-monthly.entity';
import { DcRevenueActualMonthly } from './data-collection/entities/dc-revenue-actual-monthly.entity';
import { DcRevenue } from './data-collection/entities/dc-revenue.entity';
import { DcPerformance } from './data-collection/entities/dc-performance.entity';
import { DcPedagogicalAchievement } from './data-collection/entities/dc-pedagogical-achievement.entity';
import { DcStudentsPerformance } from './data-collection/entities/dc-students-performance.entity';
import { DcActivityParticipation } from './data-collection/entities/dc-activity-participation.entity';
import { DcEventParticipation } from './data-collection/entities/dc-event-participation.entity';
import { DcCocurricular } from './data-collection/entities/dc-cocurricular.entity';
import { DcAlumni } from './data-collection/entities/dc-alumni.entity';

const YEAR = 2026;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June'];
const EXAM_MONTHS = ['March', 'June'];

const ROLES = ['Super Admin'];

interface DemoSchool {
  code: string;
  name: string;
  category: 'brac_academy' | 'brac_primary' | 'brac_secondary';
  /** dc grade slugs (dc_students_info) */
  gradeSlugs: string[];
  /** fee-structure labels (Grade N / Play & Learn) */
  gradeLabels: string[];
  /** students-performance / activity short labels (G1.. / Play & Learn) */
  gradeShorts: string[];
  tuition: number;
  /** share of billed fees actually collected (drives Revenue grades) */
  collectRate: number;
  /** share of students scoring A+ / A (drives the A & A+ indicator) */
  topPct: number;
  studentsPerGrade: { boys: number; girls: number }[];
  transport: boolean;
}

const DEMO_SCHOOLS: DemoSchool[] = [
  {
    code: 'SCH-MUDCC9Y5',
    name: 'BRAC Academy-Cumilla',
    category: 'brac_academy',
    gradeSlugs: ['play_learn', 'g1', 'g2', 'g3', 'g4', 'g5'],
    gradeLabels: ['Play & Learn', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
    gradeShorts: ['Play & Learn', 'G1', 'G2', 'G3', 'G4', 'G5'],
    tuition: 800,
    collectRate: 0.93,
    topPct: 0.86,
    studentsPerGrade: [
      { boys: 16, girls: 15 },
      { boys: 20, girls: 22 },
      { boys: 19, girls: 21 },
      { boys: 22, girls: 20 },
      { boys: 18, girls: 23 },
      { boys: 21, girls: 19 },
    ],
    transport: true,
  },
  {
    code: 'SCH-MUDCE2YF',
    name: 'BRAC Primary School, Manjai',
    category: 'brac_primary',
    gradeSlugs: ['play_learn', 'g1', 'g2', 'g3', 'g4'],
    gradeLabels: ['Play & Learn', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'],
    gradeShorts: ['Play & Learn', 'G1', 'G2', 'G3', 'G4'],
    tuition: 500,
    collectRate: 0.84,
    topPct: 0.74,
    studentsPerGrade: [
      { boys: 17, girls: 16 },
      { boys: 24, girls: 22 },
      { boys: 21, girls: 25 },
      { boys: 23, girls: 20 },
      { boys: 19, girls: 21 },
    ],
    transport: false,
  },
  {
    code: 'SCH-MUDCF2KJ',
    name: 'BRAC Secondary School, Joldhaka',
    category: 'brac_secondary',
    gradeSlugs: ['g6', 'g7', 'g8', 'g9', 'g10'],
    gradeLabels: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
    gradeShorts: ['G6', 'G7', 'G8', 'G9', 'G10'],
    tuition: 1000,
    collectRate: 0.76,
    topPct: 0.63,
    studentsPerGrade: [
      { boys: 26, girls: 24 },
      { boys: 28, girls: 25 },
      { boys: 24, girls: 27 },
      { boys: 30, girls: 26 },
      { boys: 27, girls: 24 },
    ],
    transport: true,
  },
];

const TEACHERS = [
  { name: 'Md. Anisur Rahman', designation: 'Head Teacher', gender: 'Male', qualification: 'Masters', experience: 14, subjects: 'Bangla, English', training: 'Basic, Leadership', score: 88 },
  { name: 'Shahanaz Begum', designation: 'Assistant Teacher', gender: 'Female', qualification: 'Hons', experience: 9, subjects: 'Math, Science', training: 'Basic, Subject-based', score: 84 },
  { name: 'Rashedul Karim', designation: 'Assistant Teacher', gender: 'Male', qualification: 'Hons', experience: 6, subjects: 'English', training: 'Subject-based', score: 71 },
  { name: 'Fatema Khatun', designation: 'Assistant Teacher', gender: 'Female', qualification: 'HSC', experience: 4, subjects: 'Bangla', training: 'Basic', score: 64 },
  { name: 'Tania Akter', designation: 'Junior Teacher', gender: 'Female', qualification: 'Hons', experience: 3, subjects: 'Science, Others', training: '', score: 57 },
  { name: 'Jahangir Alam', designation: 'Assistant Teacher', gender: 'Male', qualification: 'Masters', experience: 12, subjects: 'Math', training: 'Basic, Subject-based', score: 90 },
];

/** Deterministic per-school pseudo-random in [min, max]. */
function prand(salt: string, min: number, max: number): number {
  let h = 2166136261;
  const s = `${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return min + (Math.abs(h) % (max - min + 1));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

async function seedDemoDc() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const usersService = app.get(UsersService);
    const dc = app.get(DataCollectionService);

    const admin = await usersService.findOneByEmail('admin@bep.org');
    if (!admin) throw new Error('Super Admin (admin@bep.org) missing. Run `npm run seed` first.');
    const adminId = admin.id;

    const schoolRepo = dataSource.getRepository(DcSchool);

    for (const cfg of DEMO_SCHOOLS) {
      const school = await schoolRepo.findOne({ where: { code: cfg.code } });
      if (!school) {
        console.log(`⚠️  School ${cfg.code} (${cfg.name}) not found — skipped. Run seed:demo first or create it.`);
        continue;
      }
      const sid = school.id;
      const totalStudents = cfg.studentsPerGrade.reduce((s, g) => s + g.boys + g.girls, 0);
      const schoolsIdx = DEMO_SCHOOLS.indexOf(cfg);
      const scoreShift = [4, 0, -6][schoolsIdx] ?? 0;
      const rnd = (salt: string, min: number, max: number) => prand(`${cfg.code}:${salt}`, min, max);
      console.log(`\n🏫 ${cfg.name} (${cfg.code}) — ${totalStudents} students across ${cfg.gradeSlugs.length} grades`);

      // ── 1. Basic Information ──
      const basicRepo = dataSource.getRepository(DcBasicInfo);
      if ((await basicRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        await dc.upsertBasicInfo(
          {
            schoolId: sid,
            academicYear: YEAR,
            schoolCategory: cfg.category,
            mediumOfInstruction: 'Bangla',
            shiftSystem: 'Morning',
            hasPlayground: true,
            hasLibrary: true,
            hasComputerLab: cfg.category !== 'brac_primary',
            hasScienceLab: cfg.category !== 'brac_primary',
            hasElectricity: true,
            hasInternet: true,
            hasDrinkingWater: true,
            hasSanitaryFacilities: true,
            totalClassrooms: cfg.gradeSlugs.length + 4,
            operationalClassrooms: cfg.gradeSlugs.length + 3,
            additionalNotes: 'Demo data — seeded automatically.',
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Basic Information');
      } else console.log('   ℹ️  Basic Information exists');

      // ── 2. Infrastructure ──
      const infraRepo = dataSource.getRepository(DcInfrastructure);
      if ((await infraRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const roomTotal =
          1 + 3 + cfg.gradeSlugs.length + 1 + 1 + 1 + 1 + 1 + 1; // HT, teachers, classrooms, play, library, lab, store, kitchen, others
        await dc.upsertInfrastructure(
          {
            schoolId: sid,
            academicYear: YEAR,
            campusStatus: 'own',
            buildingStatus: JSON.stringify(['Main building']),
            roomHeadTeachers: 1,
            roomTeachers: 3,
            roomClassroom: cfg.gradeSlugs.length,
            roomPlayroom: 1,
            roomLibrary: 1,
            roomLab: cfg.category === 'brac_primary' ? 0 : 1,
            roomStoreroom: 1,
            roomKitchen: 1,
            roomSickbay: 0,
            roomOthers: 1,
            roomTotal,
            washroomMale: 2,
            washroomFemale: 2,
            hasHandWashPoint: true,
            hasPlayground: true,
            hasSchoolGarden: cfg.category !== 'brac_secondary',
            infraRenovationRequired: false,
            digitallyEquippedClassrooms: cfg.category === 'brac_academy' ? 4 : 2,
            floorSittingClassrooms: cfg.category === 'brac_primary' ? 2 : 0,
            classroomsWithWhiteboard: cfg.gradeSlugs.length,
            classroomsWithBlackboard: cfg.gradeSlugs.length,
            classroomNewFurniture: false,
            classroomRenovationRequired: false,
            classroomEmergencyExit: true,
            infraTotalAssets: rnd('assets', 15, 30),
            infraTotalProjectors: 2,
            infraTotalLaptops: 3,
            infraTotalPcs: cfg.category === 'brac_primary' ? 2 : 6,
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Infrastructure');
      } else console.log('   ℹ️  Infrastructure exists');

      // ── 3. Students' Information (monthly snapshots) ──
      const studentsRepo = dataSource.getRepository(DcStudentsInfo);
      if ((await studentsRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (let gi = 0; gi < cfg.gradeSlugs.length; gi++) {
          const g = cfg.studentsPerGrade[gi];
          for (let mi = 0; mi < MONTHS.length; mi++) {
            const growth = Math.floor(mi / 3);
            const dropout = round1(rnd(`drop:${gi}:${mi}`, 0, 25) / 10);
            await dc.upsertStudentsInfo(
              {
                schoolId: sid,
                academicYear: YEAR,
                month: MONTHS[mi],
                grade: cfg.gradeSlugs[gi],
                boys: g.boys + growth,
                girls: g.girls + growth,
                total: g.boys + g.girls + growth * 2,
                personsWithDisability: rnd(`pwd:${gi}`, 0, 2),
                ethnic: rnd(`eth:${gi}`, 0, 3),
                attendanceRate: rnd(`att:${gi}:${mi}`, 880, 975) / 10,
                dropoutRate: dropout,
                replacedStudentsRate: rnd(`rep:${gi}:${mi}`, 0, 12) / 10,
                retentionRate: round1(100 - dropout),
                remedialSupport: rnd(`rem:${gi}`, 0, 6),
              },
              adminId,
              ROLES,
            );
          }
        }
        console.log(`   ✅ Students' Information (${cfg.gradeSlugs.length} grades × ${MONTHS.length} months)`);
      } else console.log('   ℹ️  Students Information exists');

      // ── 4. Teachers' Information (aggregate) ──
      const tInfoRepo = dataSource.getRepository(DcTeachersInfo);
      if ((await tInfoRepo.count({ where: { schoolId: sid } })) === 0) {
        const males = TEACHERS.filter((t) => t.gender === 'Male').length;
        await dc.upsertTeachersInfo(
          {
            schoolId: sid,
            totalTeachersMale: males,
            totalTeachersFemale: TEACHERS.length - males,
            permanentTeachers: 4,
            contractTeachers: 2,
            trainedTeachers: TEACHERS.filter((t) => t.training.includes('Basic')).length,
            untrainedTeachers: TEACHERS.filter((t) => !t.training.includes('Basic')).length,
            avgExperienceYears: round1(TEACHERS.reduce((s, t) => s + t.experience, 0) / TEACHERS.length),
            teacherStudentRatio: `1:${Math.round(totalStudents / TEACHERS.length)}`,
            vacantPositions: 0,
            teachersWithBEd: 3,
            teachersWithMEd: 2,
            remarks: 'Demo data — seeded automatically.',
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Teachers Information');
      } else console.log('   ℹ️  Teachers Information exists');

      // ── 5. Individual teachers ──
      const tIndRepo = dataSource.getRepository(DcTeacherIndividual);
      if ((await tIndRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (let i = 0; i < TEACHERS.length; i++) {
          const t = TEACHERS[i];
          await dc.createTeacherIndividual(
            {
              schoolId: sid,
              academicYear: YEAR,
              name: t.name,
              designation: t.designation,
              gender: t.gender,
              educationalQualification: t.qualification,
              experienceYears: t.experience,
              subjectExpertise: t.subjects,
              trainingReceived: t.training || undefined,
              assessmentScore: Math.max(30, Math.min(99, t.score + scoreShift)),
              joiningDate: `20${10 + (i % 10)}-01-15`,
              phone: `+88017${String(10000000 + schoolsIdx * 1000000 + i * 11111).slice(0, 8)}`,
            },
            adminId,
            ROLES,
          );
        }
        console.log(`   ✅ ${TEACHERS.length} individual teachers`);
      } else console.log('   ℹ️  Individual teachers exist');

      // ── 6. Teachers' Development (monthly) ──
      const tDevRepo = dataSource.getRepository(DcTeachersDevelopment);
      if ((await tDevRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (let mi = 0; mi < MONTHS.length; mi++) {
          const tDrop = mi % 2 === 0 ? round1(rnd(`tdrop:${mi}`, 0, 15) / 10) : null;
          await dc.upsertTeachersDevelopment(
            {
              schoolId: sid,
              academicYear: YEAR,
              month: MONTHS[mi],
              onlineRefresher: rnd(`onl:${mi}`, 1, 3),
              offlineRefresher: rnd(`off:${mi}`, 1, 4),
              developmentForum: rnd(`frm:${mi}`, 0, 2),
              basicTraining: mi === 1 || mi === 4 ? 2 : 0,
              subjectBasedTraining: mi === 2 ? 1 : 0,
              leadershipTraining: mi === 0 ? 1 : 0,
              teacherDropoutRate: tDrop ?? undefined,
              headTeacherDropoutRate: mi === 3 ? 0 : undefined,
              headTeacherLeadership: mi % 3 === 2 ? 'moderate' : 'strong',
            },
            adminId,
            ROLES,
          );
        }
        console.log(`   ✅ Teachers Development (${MONTHS.length} months)`);
      } else console.log('   ℹ️  Teachers Development exists');

      // ── 7. Fee Structures (per grade × month) ──
      const dcFeeRepo = dataSource.getRepository(DcFeeStructure);
      if ((await dcFeeRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (const grade of cfg.gradeLabels) {
          for (const month of MONTHS) {
            await dc.upsertFeeStructure(
              {
                schoolId: sid,
                academicYear: YEAR,
                month,
                grade,
                tuitionFee: cfg.tuition,
                sportsFee: 30,
                othersFee: 40,
                admissionFee: month === 'January' ? 500 : undefined,
                sessionFee: month === 'January' ? 300 : undefined,
                syllabusFee: month === 'January' ? 150 : undefined,
                assessmentFee: EXAM_MONTHS.includes(month) ? 100 : undefined,
                transportFee: cfg.transport ? 200 : undefined,
              },
              adminId,
              ROLES,
            );
          }
        }
        console.log(`   ✅ Fee Structures (${cfg.gradeLabels.length} grades × ${MONTHS.length} months)`);
      } else console.log('   ℹ️  Fee Structures exist');

      // ── 8. Revenue Budget / Actual (totals) ──
      const rbTotalRepo = dataSource.getRepository(DcRevenueBudgetTotal);
      const raTotalRepo = dataSource.getRepository(DcRevenueActualTotal);
      if ((await rbTotalRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const perHead: Record<string, number> = {
          admission: 500, session: 300, assessment: 200, sports: 180,
          syllabus: 150, testimonial: 100, others: 240,
          transport: cfg.transport ? 1200 : 0,
        };
        const fee = (k: string, rate = cfg.collectRate) => ({
          target: totalStudents * perHead[k],
          achievement: Math.round(totalStudents * perHead[k] * rate),
        });
        const admission = fee('admission');
        const session = fee('session');
        const assessment = fee('assessment');
        const sports = fee('sports');
        const syllabus = fee('syllabus');
        const testimonial = fee('testimonial');
        const others = fee('others');
        const transport = fee('transport');
        await dc.upsertRevenueBudgetTotal(
          {
            schoolId: sid, academicYear: YEAR, totalStudentsTarget: totalStudents,
            admissionFeeTarget: admission.target, admissionFeeAchievement: admission.achievement,
            sessionFeeTarget: session.target, sessionFeeAchievement: session.achievement,
            assessmentFeeTarget: assessment.target, assessmentFeeAchievement: assessment.achievement,
            sportsFeeTarget: sports.target, sportsFeeAchievement: sports.achievement,
            syllabusFeeTarget: syllabus.target, syllabusFeeAchievement: syllabus.achievement,
            testimonialFeeTarget: testimonial.target, testimonialFeeAchievement: testimonial.achievement,
            othersFeeTarget: others.target, othersFeeAchievement: others.achievement,
            transportFeeTarget: transport.target, transportFeeAchievement: transport.achievement,
          },
          adminId,
          ROLES,
        );
        // Actual targets mirror the billed amounts; achievements show the shortfall.
        await dc.upsertRevenueActualTotal(
          {
            schoolId: sid, academicYear: YEAR, totalStudentsTarget: totalStudents,
            admissionFeeTarget: admission.target, admissionFeeAchievement: admission.achievement,
            sessionFeeTarget: session.target, sessionFeeAchievement: session.achievement,
            assessmentFeeTarget: assessment.target, assessmentFeeAchievement: assessment.achievement,
            sportsFeeTarget: sports.target, sportsFeeAchievement: sports.achievement,
            syllabusFeeTarget: syllabus.target, syllabusFeeAchievement: syllabus.achievement,
            testimonialFeeTarget: testimonial.target, testimonialFeeAchievement: testimonial.achievement,
            othersFeeTarget: others.target, othersFeeAchievement: others.achievement,
            transportFeeTarget: transport.target, transportFeeAchievement: transport.achievement,
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Revenue Budget/Actual (totals)');
      } else console.log('   ℹ️  Revenue totals exist');

      // ── 9. Revenue Budget / Actual (monthly) ──
      const rbMonthRepo = dataSource.getRepository(DcRevenueBudgetMonthly);
      const raMonthRepo = dataSource.getRepository(DcRevenueActualMonthly);
      if ((await rbMonthRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (let mi = 0; mi < MONTHS.length; mi++) {
          const month = MONTHS[mi];
          const rate = [1.0, 0.96, 0.9, 0.88, 0.8, 0.6][mi];
          const tuitionT = totalStudents * cfg.tuition;
          const tuitionA = Math.round(tuitionT * rate);
          const othersT = totalStudents * 40;
          const othersA = Math.round(othersT * rate);
          const transportT = cfg.transport ? totalStudents * 200 : 0;
          const transportA = Math.round(transportT * rate);
          const jan = month === 'January';
          const exam = EXAM_MONTHS.includes(month);
          const admissionT = jan ? totalStudents * 500 : 0;
          const sessionT = jan ? totalStudents * 300 : 0;
          const assessT = exam ? totalStudents * 100 : 0;
          const base = {
            tuitionFeeTarget: tuitionT, tuitionFeeAchievement: tuitionA,
            admissionFeeTarget: admissionT, admissionFeeAchievement: Math.round(admissionT * rate),
            sessionFeeTarget: sessionT, sessionFeeAchievement: Math.round(sessionT * rate),
            assessmentFeeTarget: assessT, assessmentFeeAchievement: Math.round(assessT * rate),
            sportsFeeTarget: totalStudents * 30, sportsFeeAchievement: Math.round(totalStudents * 30 * rate),
            othersFeeTarget: othersT, othersFeeAchievement: othersA,
            transportFeeTarget: transportT, transportFeeAchievement: transportA,
          };
          await dc.upsertRevenueBudgetMonthly({ schoolId: sid, academicYear: YEAR, month, ...base }, adminId, ROLES);
          await dc.upsertRevenueActualMonthly({ schoolId: sid, academicYear: YEAR, month, ...base }, adminId, ROLES);
        }
        console.log(`   ✅ Revenue Budget/Actual (monthly × ${MONTHS.length})`);
      } else console.log('   ℹ️  Revenue monthly exists');

      // ── 10. Revenue (annual summary) ──
      const revRepo = dataSource.getRepository(DcRevenue);
      if ((await revRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const annual = totalStudents * cfg.tuition * 12 * cfg.collectRate;
        await dc.upsertRevenue(
          {
            schoolId: sid,
            academicYear: YEAR,
            monthlyTuitionFee: cfg.tuition,
            admissionFee: 500,
            examFee: 200,
            totalAnnualRevenue: Math.round(annual),
            governmentGrant: rnd('grant', 0, 50000),
            donationsReceived: rnd('don', 5000, 40000),
            otherIncome: rnd('oin', 2000, 20000),
            totalExpenditure: Math.round(annual * 0.82),
            salaryExpenditure: Math.round(annual * 0.6),
            maintenanceExpenditure: Math.round(annual * 0.1),
            pendingFeeAmount: Math.round(totalStudents * cfg.tuition * 2 * (1 - cfg.collectRate)),
            feeCollectionRate: round1(cfg.collectRate * 100),
            remarks: 'Demo data — seeded automatically.',
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Revenue (annual summary)');
      } else console.log('   ℹ️  Revenue summary exists');

      // ── 11. Pedagogical Achievements ──
      const pedRepo = dataSource.getRepository(DcPedagogicalAchievement);
      if ((await pedRepo.count({ where: { schoolId: sid, year: YEAR } })) === 0) {
        const isAcademy = cfg.category === 'brac_academy';
        const isSecondary = cfg.category === 'brac_secondary';
        await dc.upsertPedagogicalAchievement(
          {
            schoolId: sid,
            year: YEAR,
            kgParticipated: isAcademy ? 20 : 8,
            kgScholarship: isAcademy ? 3 : 1,
            primaryParticipated: 30,
            primaryScholarship: isAcademy ? 5 : 4,
            jrParticipated: isSecondary ? 28 : 15,
            jrScholarship: isSecondary ? 4 : 2,
            sscParticipated: isSecondary ? 30 : 0,
            sscScholarship: isSecondary ? 5 : 0,
            othersParticipated: 10,
            othersScholarship: 2,
            talentGrantParticipated: isAcademy ? 12 : 6,
            talentGrantAwarded: isAcademy ? 3 : 1,
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Pedagogical Achievements');
      } else console.log('   ℹ️  Pedagogical Achievements exist');

      // ── 12. Students' Performance (Half-yearly + Annual per grade) ──
      const spRepo = dataSource.getRepository(DcStudentsPerformance);
      if ((await spRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        for (let gi = 0; gi < cfg.gradeShorts.length; gi++) {
          const n = cfg.studentsPerGrade[gi].boys + cfg.studentsPerGrade[gi].girls;
          for (const examName of ['Half-yearly', 'Annual']) {
            const examBoost = examName === 'Annual' ? 0.04 : 0;
            const top = Math.min(0.95, cfg.topPct + examBoost);
            const aPlus = Math.round(n * top * 0.35);
            const a = Math.round(n * top * 0.45);
            const aMinus = Math.round(n * 0.13);
            const b = Math.round(n * 0.05);
            const c = Math.round(n * 0.02);
            const d = n - (aPlus + a + aMinus + b + c) > 0 ? n - (aPlus + a + aMinus + b + c) : 0;
            await dc.upsertStudentsPerformance(
              {
                schoolId: sid,
                academicYear: YEAR,
                grade: cfg.gradeShorts[gi],
                examName,
                numberOfStudents: n,
                studentsAppearedPercent: rnd(`app:${gi}`, 92, 100),
                gradeAPlus: aPlus,
                gradeA: a,
                gradeAMinus: aMinus,
                gradeB: b,
                gradeC: c,
                gradeD: d,
                gradeF: 0,
              },
              adminId,
              ROLES,
            );
          }
        }
        console.log(`   ✅ Students' Performance (${cfg.gradeShorts.length} grades × 2 exams)`);
      } else console.log('   ℹ️  Students Performance exists');

      // ── 13. Activity Participation (corners / clubs / library / labs) ──
      const actRepo = dataSource.getRepository(DcActivityParticipation);
      if ((await actRepo.count({ where: { schoolId: sid, year: YEAR } })) === 0) {
        const items: { item: string; rate: [number, number] }[] = [
          { item: 'Use of library', rate: [60, 90] },
          { item: 'Creativity Corner', rate: [65, 92] },
          { item: 'Critical thinking Corner', rate: [55, 85] },
          { item: 'Physical Activity Corner', rate: [70, 95] },
          { item: 'Language & Literacy club', rate: [45, 70] },
          { item: 'Science & Technology club', rate: [40, 65] },
          { item: 'Creative club', rate: [45, 75] },
        ];
        if (cfg.category !== 'brac_primary') {
          items.push({ item: 'Science lab', rate: [50, 80] });
          items.push({ item: 'ICT lab', rate: [45, 75] });
        }
        if (cfg.category === 'brac_secondary') {
          items.push({ item: 'Computer lab', rate: [50, 78] });
        }
        const actMonths = ['January', 'March', 'May'];
        let count = 0;
        for (const { item, rate } of items) {
          for (let mi = 0; mi < actMonths.length; mi++) {
            for (let gi = 0; gi < cfg.gradeShorts.length; gi++) {
              await dc.upsertActivityParticipation(
                {
                  schoolId: sid,
                  item,
                  year: YEAR,
                  month: actMonths[mi],
                  grade: cfg.gradeShorts[gi],
                  activityName: `${item} — ${MONTHS[mi].slice(0, 3)}`,
                  conductedCount: rnd(`cc:${item}:${gi}:${mi}`, 2, 10),
                  participationRate: rnd(`pr:${item}:${gi}:${mi}`, rate[0] * 10, rate[1] * 10) / 10,
                },
                adminId,
                ROLES,
              );
              count++;
            }
          }
        }
        console.log(`   ✅ Activity Participation (${count} records)`);
      } else console.log('   ℹ️  Activity Participation exists');

      // ── 14. Event Participation ──
      const evRepo = dataSource.getRepository(DcEventParticipation);
      if ((await evRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const events: [string, string, number, number][] = [
          ['Annual Sports Day', 'School', 4, 5],
          ['Inter-school Debate Competition', 'Upazila', 2, 3],
          ['Science Fair', 'Zila', 1, 2],
          ['National Math Olympiad', 'National', 0, 1],
        ];
        for (const [eventName, awardLevel, m, f] of events) {
          await dc.createEventParticipation(
            { schoolId: sid, academicYear: YEAR, eventName, awardLevel, maleAwarded: m, femaleAwarded: f },
            adminId,
            ROLES,
          );
        }
        console.log(`   ✅ Event Participation (${events.length} events)`);
      } else console.log('   ℹ️  Event Participation exists');

      // ── 15. Co-curricular ──
      const ccRepo = dataSource.getRepository(DcCocurricular);
      if ((await ccRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const ccMonths = ['January', 'March', 'June'];
        let count = 0;
        for (let gi = 0; gi < cfg.gradeLabels.length; gi++) {
          for (const month of ccMonths) {
            await dc.upsertCocurricular(
              {
                schoolId: sid,
                academicYear: YEAR,
                month,
                grade: cfg.gradeLabels[gi],
                song: rnd(`s:${gi}`, 50, 90),
                dance: rnd(`d:${gi}`, 40, 80),
                recitation: rnd(`r:${gi}`, 55, 95),
                acting: rnd(`a:${gi}`, 30, 70),
                debate: rnd(`db:${gi}`, 25, 60),
                quiz: rnd(`q:${gi}`, 35, 75),
                wallMagazine: rnd(`wm:${gi}`, 30, 60),
                indoorGame: rnd(`ig:${gi}`, 60, 95),
                outdoorGame: rnd(`og:${gi}`, 65, 95),
                others: rnd(`o:${gi}`, 10, 30),
              },
              adminId,
              ROLES,
            );
            count++;
          }
        }
        console.log(`   ✅ Co-curricular (${count} records)`);
      } else console.log('   ℹ️  Co-curricular exists');

      // ── 16. Performance (school summary) ──
      const perfRepo = dataSource.getRepository(DcPerformance);
      if ((await perfRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        await dc.upsertPerformance(
          {
            schoolId: sid,
            academicYear: YEAR,
            avgPassRate: rnd('pass', 90, 99),
            avgGpa: round1(rnd('gpa', 320, 440) / 100),
            boardExamPassRate: cfg.category === 'brac_secondary' ? rnd('bpass', 82, 96) : undefined,
            boardExamAvgGpa: cfg.category === 'brac_secondary' ? round1(rnd('bgpa', 340, 450) / 100) : undefined,
            extracurricularActivities: 'Debate, science fair, annual sports',
            sportsAchievements: 'Upazila champions — football (demo)',
            culturalActivities: 'Annual cultural evening (demo)',
            scienceFairParticipation: rnd('sf', 5, 20),
            debateCompetitions: rnd('deb', 2, 8),
            totalAwards: rnd('aw', 8, 25),
            teachingMethodology: 'Activity-based learning with formative assessment',
            remarks: 'Demo data — seeded automatically.',
          },
          adminId,
          ROLES,
        );
        console.log('   ✅ Performance summary');
      } else console.log('   ℹ️  Performance summary exists');

      // ── 17. Alumni ──
      const alumRepo = dataSource.getRepository(DcAlumni);
      if ((await alumRepo.count({ where: { schoolId: sid, academicYear: YEAR } })) === 0) {
        const alumni: [string, number, string, string, string][] = [
          ['Ruhul Amin', 2015, 'Garments Merchandiser', 'Diploma', 'BGMEA Institute'],
          ['Sabina Yeasmin', 2017, 'Nurse', 'BSc Nursing', 'Cumilla Medical College'],
          ['Habibur Rahman', 2019, 'University Student', 'HSC', 'Dhaka University'],
        ];
        for (const [alumniName, graduationYear, occupation, higherEducation, institution] of alumni) {
          await dc.createAlumni(
            {
              schoolId: sid,
              academicYear: YEAR,
              alumniName,
              graduationYear,
              currentOccupation: occupation,
              higherEducation,
              institution,
              contactPhone: `+88018${String(20000000 + schoolsIdx * 100000 + graduationYear).slice(0, 8)}`,
              achievements: 'Demo record',
            },
            adminId,
            ROLES,
          );
        }
        console.log('   ✅ Alumni (3)');
      } else console.log('   ℹ️  Alumni exist');
    }

    console.log('\n🎉 Data-collection demo seeding completed!');
    console.log('   Check: School Information → status tables, Programme Overview, dashboards.');
  } catch (error) {
    console.error('❌ Error seeding data-collection demo data:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seedDemoDc();
