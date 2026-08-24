'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  School, Users, GraduationCap, MapPin, Phone, Mail,
  Building2, Award, TrendingUp, Wallet, Search, RefreshCw,
  CalendarDays, ShieldCheck, ShieldX, BookOpen, Filter, ChevronRight,
  ArrowLeft, Layers, X, BarChart3, Info, CalendarRange,
} from 'lucide-react';
import api from '@/lib/api';
import { CategoryMenu } from '@/components/data-collection/category-menu';
import { Modal } from '@/components/ui/modal';

/* ─── Types ─────────────────────────────────────────────── */

interface SchoolListItem {
  id: string;
  name: string;
  code: string;
  address?: string;
  district?: string;
  division?: string;
  upazila?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  establishedYear?: number;
  schoolType?: string;
  schoolCategory?: string;
  governmentApproval?: boolean;
  totalTeachers?: number;
  totalStudents?: number;
  gradeCoverage?: string;
}

interface InfraData {
  campusStatus?: string;
  buildingStatus?: string;
  roomHeadTeachers: number; roomTeachers: number; roomClassroom: number;
  roomPlayroom: number; roomLibrary: number; roomLab: number;
  roomStoreroom: number; roomKitchen: number; roomSickbay: number;
  roomOthers: number; roomTotal: number;
  washroomMale: number; washroomFemale: number;
  hasHandWashPoint: boolean; hasPlayground: boolean; hasSchoolGarden: boolean;
  infraRenovationRequired: boolean;
  digitallyEquippedClassrooms: number; floorSittingClassrooms: number;
  classroomsWithWhiteboard: number; classroomsWithBlackboard: number;
  classroomNewFurniture: boolean; classroomRenovationRequired: boolean;
}

interface StudentRow {
  id: string; grade: string; month: string;
  boys: number; girls: number; total: number;
  personsWithDisability: number; ethnic: number;
  attendanceRate?: number | string; dropoutRate?: number | string;
}

interface TeacherRow {
  id: string; name: string; designation?: string; gender?: string;
  educationalQualification?: string; experienceYears?: number; subjectExpertise?: string;
  trainingReceived?: string | null; assessmentScore?: number | string | null;
}

interface FeeRow {
  id: string; month: string; grade: string;
  admissionFee: number; tuitionFee: number; sessionFee: number;
  assessmentFee: number; sportsFee: number; othersFee: number; transportFee: number;
}

interface PedagAchievementRow {
  id: string; year: number;
  kgScholarship: number; primaryScholarship: number; jrScholarship: number;
  sscScholarship: number; othersScholarship: number;
}

interface AlumniRow {
  id: string; alumniName: string; graduationYear?: number;
  currentOccupation?: string; higherEducation?: string;
  institution?: string; contactPhone?: string;
}

interface SchoolProfile {
  school: SchoolListItem;
  infrastructure: InfraData | null;
  students: StudentRow[];
  studentTotals: { boys: number; girls: number; pwd: number; ethnic: number; total: number };
  teachers: TeacherRow[];
  teacherTotals: { male: number; female: number; total: number };
  feeStructures: FeeRow[];
  revenueBudgetTotal: Record<string, any> | null;
  revenueActualTotal: Record<string, any> | null;
  pedagogicalAchievements: PedagAchievementRow[];
  performance: Record<string, any> | null;
  teachersDevelopment?: Record<string, any>[];
  studentsPerformance?: Record<string, any>[];
  activityParticipation?: Record<string, any>[];
  eventParticipation?: Record<string, any>[];
  cocurricular?: Record<string, any>[];
  alumni: AlumniRow[];
  meta: {
    categoriesWithData: number;
    totalCategories: number;
    /** Academic year every category above was scoped to (null when no data exists). */
    academicYear: number | null;
    /** Every academic year this school has submitted data for, newest first. */
    availableYears: number[];
  };
}

/* ─── Constants / helpers ───────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
};

const TYPE_LABELS: Record<string, string> = {
  plain_land: 'Plain Land',
  haor: 'Haor',
};

const GRADE_LABELS: Record<string, string> = {
  play_learn: 'Play & Learn', nursery: 'Nursery',
  g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3', g4: 'Grade 4', g5: 'Grade 5',
  g6: 'Grade 6', g7: 'Grade 7', g8: 'Grade 8', g9: 'Grade 9', g10: 'Grade 10',
  Play: 'Play & Learn',
};
const gradeLabel = (g: string) => GRADE_LABELS[g] ?? g;

const GRADE_ORDER = ['play_learn', 'nursery', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10',
  'Play', 'Play & Learn', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const sortByGrade = <T extends { grade: string }>(rows: T[]) =>
  [...rows].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a.grade); const ib = GRADE_ORDER.indexOf(b.grade);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

const categoryLabel = (c?: string) => (c ? CATEGORY_LABELS[c] ?? c : '—');
const typeLabel = (t?: string) => (t ? TYPE_LABELS[t] ?? t : '—');

const fmtTaka = (n: number) =>
  n >= 10_000_000 ? `৳${(n / 10_000_000).toFixed(2)} Cr` :
  n >= 100_000 ? `৳${(n / 100_000).toFixed(1)} L` :
  n >= 1_000 ? `৳${(n / 1_000).toFixed(1)}K` : `৳${n}`;

const yn = (b?: boolean | null) => (b == null ? '—' : b ? 'Yes' : 'No');

/* ─── Grade colours (Overall Flag) ─────────────────────────
   Green = Grade A, Yellow = Grade B, Red = Grade C — per the
   programme's Rating & Scoring System (section 8). */
type GradeName = 'Green' | 'Yellow' | 'Red';
interface GradeStyle {
  panel: string; glow: string; text: string; ring: string; sub: string;
}
const GRADE_STYLES: Record<GradeName, GradeStyle> = {
  Green: {
    panel: 'bg-gradient-to-br from-green-100 via-emerald-50 to-green-100',
    glow: 'bg-green-300/40', text: 'text-green-600', ring: 'ring-green-200', sub: 'text-green-500',
  },
  Yellow: {
    panel: 'bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-100',
    glow: 'bg-yellow-300/40', text: 'text-yellow-600', ring: 'ring-yellow-200', sub: 'text-yellow-500',
  },
  Red: {
    panel: 'bg-gradient-to-br from-red-100 via-rose-50 to-red-100',
    glow: 'bg-red-300/40', text: 'text-red-600', ring: 'ring-red-200', sub: 'text-red-500',
  },
};

/* ─── Generic table (matches Programme Overview breakdown) ─ */

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: any, idx: number) => React.ReactNode;
}

function CategoryTable({
  title, icon: Icon, accent, count, columns, rows, footer, emptyText,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  count?: number;
  columns: Col[];
  rows: any[];
  footer?: React.ReactNode[] | null;
  emptyText: string;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <CardHeader className="px-5 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon size={15} className="text-gray-500" />
          {title}
          {count != null && <Badge variant="default" className="ml-1">{count}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-gray-100 bg-gray-50">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 first:pl-5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.id ?? idx} className="transition-colors hover:bg-indigo-50/30">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`py-3 px-3 first:pl-5 ${c.align === 'right' ? 'text-right text-gray-700' : 'text-left text-gray-700'}`}
                      >
                        {c.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {footer && (
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr className="font-semibold text-gray-800">
                    {footer.map((cell, i) => (
                      <td
                        key={i}
                        className={`py-3 px-3 first:pl-5 ${columns[i]?.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Status breakdown tables (aggregate submitted-form data) ─
   Grade scale (percentage indicators):
     A / Green  → 80 and above
     B / Yellow → 70 to 79
     C / Red    → less than 70
   Yes/No scale (Pedagogical Performance only): Yes → Green, No → Red.
   "Average Grade" = the average of a table's row percentages, re-graded on
   the same scale (Yes = 100, No = 0; unreported rows excluded).

   Each "auto" indicator is derived from the closest available submitted
   field (documented inline). "manual" indicators have no stored source yet,
   so they show "Not reported" and are excluded from grading.            */

type GradeLetter = 'A' | 'B' | 'C';
const pctToGrade = (p: number): GradeLetter => (p >= 80 ? 'A' : p >= 70 ? 'B' : 'C');

/* Section 8.3 — convert each indicator's letter grade to a grade point so
   percentage and Yes/No indicators can be averaged together, then map the
   group's average point back to a colour band:
     A / Green (or "Yes") = 3   •   B / Yellow = 2   •   C / Red (or "No") = 1
     ≥ 2.5 → A/Green   •   1.5–2.49 → B/Yellow   •   < 1.5 → C/Red            */
const GRADE_POINT: Record<GradeLetter, number> = { A: 3, B: 2, C: 1 };
const pointToGrade = (pt: number): GradeLetter => (pt >= 2.5 ? 'A' : pt >= 1.5 ? 'B' : 'C');
const LETTER_COLOR: Record<GradeLetter, GradeName> = { A: 'Green', B: 'Yellow', C: 'Red' };

/* Head Teacher Leadership is reported on its own qualitative scale. */
const LEADERSHIP_LABEL: Record<string, string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' };
const LEADERSHIP_GRADE: Record<string, GradeLetter> = { strong: 'A', moderate: 'B', weak: 'C' };

const GRADE_PILL: Record<GradeLetter, string> = {
  A: 'bg-green-100 text-green-700 ring-green-200',
  B: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  C: 'bg-red-100 text-red-700 ring-red-200',
};

function GradePill({ grade }: { grade: GradeLetter }) {
  return (
    <span className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${GRADE_PILL[grade]}`}>
      {grade}
    </span>
  );
}

function YesNoPill({ yes }: { yes: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${yes ? 'bg-green-100 text-green-700 ring-green-200' : 'bg-red-100 text-red-700 ring-red-200'}`}>
      {yes ? 'Green' : 'Red'}
    </span>
  );
}

interface StatusRow {
  indicator: string;
  status: string;
  kind: 'percent' | 'yesno' | 'grade' | 'info';
  pct?: number | null;   // percentage used for grading (percent rows)
  yes?: boolean;         // yes/no rows
  grade?: GradeLetter;   // rows graded directly on a qualitative scale (e.g. Strong/Moderate/Weak)
  note?: string;         // e.g. 'manual'
  excludeFromAvg?: boolean; // graded row that must NOT be counted in the average (avoids double-counting complementary indicators)
  gradeBasis?: string;   // shown when the grade is computed from the inverse of the displayed status (e.g. dropout graded on retention)
}

interface StatusTableDef {
  title: string;
  accent: string;        // title-bar colour classes
  graded: boolean;       // whether the scale applies to this table
  rows: StatusRow[];
}

/* Grade-point of a single indicator row (section 8.3 Step 2). */
function rowPoint(r: StatusRow): number | null {
  if (r.kind === 'percent' && r.pct != null) return GRADE_POINT[pctToGrade(r.pct)];
  if (r.kind === 'yesno' && r.yes != null) return r.yes ? GRADE_POINT.A : GRADE_POINT.C;
  if (r.kind === 'grade' && r.grade) return GRADE_POINT[r.grade];
  return null;
}

/* Group Average Grade point (section 8.3 Step 3) = the simple mean of the
   indicator grade-points in that group — NOT the mean of the raw percentages.
   Info rows and explicitly-excluded rows do not count. */
function groupAveragePoint(rows: StatusRow[]): number | null {
  const pts: number[] = [];
  for (const r of rows) {
    if (r.excludeFromAvg) continue;
    const p = rowPoint(r);
    if (p != null) pts.push(p);
  }
  return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
}

/* Section 8.4 — the four Status Groups that feed the Overall Score (equal 25%
   weight). Infrastructure & Head Teachers' status are informational only and
   are excluded from the overall, matching the rating document. */
const OVERALL_GROUP_TITLES = [
  "Students' Status",
  "Teachers' Status",
  'Revenue Collection Status',
  'Pedagogical Performance Status',
] as const;

interface OverallRating {
  groups: { title: string; point: number | null; grade: GradeLetter | null }[];
  overallPoint: number | null;
  overallGrade: GradeLetter | null;
}

function computeOverallRating(tables: StatusTableDef[]): OverallRating {
  const groups = OVERALL_GROUP_TITLES.map((title) => {
    const t = tables.find((x) => x.title === title);
    const point = t && t.graded ? groupAveragePoint(t.rows) : null;
    return { title, point, grade: point == null ? null : pointToGrade(point) };
  });
  const pts = groups.map((g) => g.point).filter((p): p is number => p != null);
  const overallPoint = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
  return { groups, overallPoint, overallGrade: overallPoint == null ? null : pointToGrade(overallPoint) };
}

function RowGrade({ row }: { row: StatusRow }) {
  if (row.kind === 'yesno') {
    return row.yes != null ? <YesNoPill yes={row.yes} /> : <span className="text-gray-300">—</span>;
  }
  if (row.kind === 'grade') {
    return row.grade ? <GradePill grade={row.grade} /> : <span className="text-gray-300">—</span>;
  }
  if (row.kind === 'percent' && row.pct != null) {
    return <GradePill grade={pctToGrade(row.pct)} />;
  }
  return <span className="text-gray-300">—</span>;
}

function ScaleLegend() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs text-gray-600">
        <span className="font-semibold text-gray-700">Grade scale</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400" /> A (Green) — 80 &amp; above</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-yellow-400" /> B (Yellow) — 70 to 79</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> C (Red) — less than 70</span>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400" /> Yes = Green</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> No = Red</span>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400" /> Strong = A</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-yellow-400" /> Moderate = B</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> Weak = C</span>
      </CardContent>
    </Card>
  );
}

function StatusTable({ title, accent, graded, rows }: StatusTableDef) {
  const avgPoint = graded ? groupAveragePoint(rows) : null;
  const [info, setInfo] = useState<{ indicator: string; data: IndicatorInfo } | null>(null);
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`px-4 py-2.5 text-center text-sm font-bold ${accent}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-orange-50">
            <tr>
              <th className="py-2 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-orange-900/70">Indicators</th>
              <th className="py-2 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-orange-900/70">Status</th>
              <th className="py-2 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-orange-900/70">Grade</th>
              <th className="py-2 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-orange-900/70">Average Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r, idx) => {
              const meta = INDICATOR_INFO[`${title}::${r.indicator}`];
              return (
              <tr key={r.indicator} className="transition-colors hover:bg-indigo-50/20">
                <td className="py-2.5 px-3 font-medium text-gray-700">
                  <span className="inline-flex items-center gap-1">
                    {r.indicator}
                    {meta && (
                      <button
                        type="button"
                        onClick={() => setInfo({ indicator: r.indicator, data: meta })}
                        className="shrink-0 text-gray-300 transition-colors hover:text-indigo-500"
                        title="How is this calculated?"
                        aria-label={`How is "${r.indicator}" calculated?`}
                      >
                        <Info size={13} />
                      </button>
                    )}
                  </span>
                  {r.note && (
                    <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {r.note}
                    </span>
                  )}
                  {r.excludeFromAvg && (
                    <span
                      className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400"
                      title="Complement of another indicator in this group — excluded from the average so it isn't counted twice"
                    >
                      not counted
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-gray-600">
                  {r.status}
                  {r.gradeBasis && (
                    <span className="block text-[10px] text-gray-400">graded on {r.gradeBasis}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center"><RowGrade row={r} /></td>
                {idx === 0 && (
                  <td rowSpan={rows.length} className="w-28 border-l border-gray-100 px-3 text-center align-middle">
                    {avgPoint != null ? (
                      <div className="flex flex-col items-center gap-1">
                        <GradePill grade={pointToGrade(avgPoint)} />
                        <span className="text-[11px] text-gray-400">{avgPoint.toFixed(2)} pts</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!info} onClose={() => setInfo(null)} title={info?.indicator} size="md">
        {info && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
              {title}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <BarChart3 size={13} /> How it&apos;s calculated
              </p>
              <p className="leading-relaxed text-gray-700">{info.data.how}</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <BookOpen size={13} /> Data source
              </p>
              <p className="leading-relaxed text-gray-700">{info.data.source}</p>
            </div>
            {info.data.scale && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Award size={13} /> Grading scale
                </p>
                <p className="leading-relaxed text-gray-700">{info.data.scale}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

/* ── Indicator explanations (shown in the info modal). Keyed by
   "<Table Title>::<Indicator>" so identically-named indicators across
   different tables can carry their own explanation.                    */
interface IndicatorInfo { how: string; source: string; scale?: string; }

const GRADE_SCALE_TEXT = 'Grade A (Green) ≥ 80%, B (Yellow) 70–79%, C (Red) below 70%.';
const YESNO_SCALE_TEXT = 'Yes = Green, No = Red.';

const INDICATOR_INFO: Record<string, IndicatorInfo> = {
  // ── Infrastructure & Classroom Status ──
  'Infrastructure & Classroom Status::Owned Campus': {
    how: 'Green when the school campus is marked as "Own"; Red when it is "Rented".',
    source: 'Infrastructure Status form → Campus Status',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Sufficient Classrooms': {
    how: 'Green when the school reports at least one classroom.',
    source: 'Infrastructure Status form → Rooms → Classroom count',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Separate Washrooms': {
    how: 'Green when the total number of washrooms (male + female) is greater than zero.',
    source: 'Infrastructure Status form → Washrooms (Male) + Washrooms (Female)',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Library Facility': {
    how: 'Green when the school reports at least one library room.',
    source: 'Infrastructure Status form → Rooms → Library',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Lab Facility': {
    how: 'Green when the school reports at least one lab room.',
    source: 'Infrastructure Status form → Rooms → Lab',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Hand Wash Point': {
    how: 'Green when a hand wash point is available at the school.',
    source: 'Infrastructure Status form → Hand Wash Point',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Playground': {
    how: 'Green when a playground is available.',
    source: 'Infrastructure Status form → Playground',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::Digitally Equipped Classrooms': {
    how: 'Green when at least one classroom is digitally equipped.',
    source: 'Classroom Status form → Digitally Equipped Classrooms',
    scale: YESNO_SCALE_TEXT,
  },
  'Infrastructure & Classroom Status::No Renovation Required': {
    how: 'Green when NEITHER the infrastructure nor the classroom is flagged as needing renovation (i.e. the school is in good shape).',
    source: 'Infrastructure Status form → Renovation Required + Classroom Status form → Renovation Required',
    scale: YESNO_SCALE_TEXT,
  },

  // ── Students' Status ──
  "Students' Status::Enrollment Target Met": {
    how: 'Current total enrolled students ÷ the yearly student target × 100, capped at 100%.',
    source: 'Students\u2019 Information form (enrolled boys + girls) + Revenue (Budget) form → Total Students Target',
    scale: GRADE_SCALE_TEXT,
  },
  "Students' Status::Yearly Dropout Rate": {
    how: 'The Status column shows the average student dropout rate across every monthly record. The grade is based on RETENTION (100 − dropout), so a lower dropout rate earns a higher grade.',
    source: 'Students\u2019 Information form → Dropout Rate (averaged over all months entered)',
    scale: GRADE_SCALE_TEXT,
  },
  "Students' Status::Yearly Retention Rate": {
    how: '100 − average dropout rate. Shown for reference only — it is excluded from the table\u2019s Average Grade to avoid double-counting with the Dropout row above.',
    source: 'Students\u2019 Information form → Dropout Rate',
    scale: GRADE_SCALE_TEXT,
  },
  "Students' Status::Monthly Attendance Rate": {
    how: 'Average of the attendance rate reported across all monthly student records.',
    source: 'Students\u2019 Information form → Attendance Rate',
    scale: GRADE_SCALE_TEXT,
  },

  // ── Teachers' Status ──
  "Teachers' Status::Yearly Dropout Rate": {
    how: 'Average teacher dropout rate across the monthly development records. Graded on retention (100 − dropout).',
    source: 'Teachers\u2019 Development form → Teacher Dropout Rate',
    scale: GRADE_SCALE_TEXT,
  },
  "Teachers' Status::Basic Training Coverage": {
    how: 'Percentage of individual teachers whose "Training Received" includes Basic training.',
    source: 'Teachers\u2019 Information form → each teacher → Training Received',
    scale: GRADE_SCALE_TEXT,
  },
  "Teachers' Status::Subject-based Training Coverage": {
    how: 'Percentage of teachers whose "Training Received" includes Subject-based training.',
    source: 'Teachers\u2019 Information form → each teacher → Training Received',
    scale: GRADE_SCALE_TEXT,
  },
  "Teachers' Status::A-Grade Teachers": {
    how: 'Percentage of teachers with an assessment score of 80 or above.',
    source: 'Teachers\u2019 Information form → each teacher → Assessment Score',
    scale: GRADE_SCALE_TEXT,
  },

  // ── Head Teachers' Status ──
  "Head Teachers' Status::Yearly Dropout Rate": {
    how: 'Average head-teacher dropout rate across the monthly records. Graded on retention (100 − dropout).',
    source: 'Teachers\u2019 Development form → Head Teacher Dropout Rate',
    scale: GRADE_SCALE_TEXT,
  },
  "Head Teachers' Status::Leadership Status of HT": {
    how: 'The most recently reported head-teacher leadership assessment, graded directly on its own scale.',
    source: 'Teachers\u2019 Development form → Head Teacher Leadership',
    scale: 'Strong = A (Green), Moderate = B (Yellow), Weak = C (Red).',
  },

  // ── Revenue Collection Status ──
  'Revenue Collection Status::Actual collected revenue %': {
    how: 'Revenue collected ÷ Actual Revenue Target × 100 (capped at 100%), summed across all 8 fee categories: Admission, Session, Assessment, Sports, Syllabus, Testimonial, Others and Transport. The Actual Revenue Target is the money actually billed to the enrolled students.',
    source: 'Revenue (Actual) form → Target & Achievement for each fee type',
    scale: GRADE_SCALE_TEXT,
  },
  'Revenue Collection Status::Outstanding dues %': {
    how: '(Actual Revenue Target − revenue collected, floored at ৳0) ÷ Actual Revenue Target × 100 — the share of billed money not yet received. Graded on the collected share (100 − dues %), so a lower dues figure scores better. It is the exact complement of the collected row, so it is shown for information and excluded from the group average to avoid double-counting.',
    source: 'Revenue (Actual) form → Target & Achievement for each fee type',
    scale: GRADE_SCALE_TEXT,
  },
  'Revenue Collection Status::Revenue deficit %': {
    how: '(revenue collected − Planned Revenue Target) ÷ Planned Revenue Target × 100, shown with negative marking when the school falls short of the budgeted plan and positive when it exceeds it. Graded on collected ÷ Planned Revenue Target × 100 (capped at 100%), so a smaller deficit scores better.',
    source: 'Revenue (Budget) form → Target for each fee type, and Revenue (Actual) form → Achievement for each fee type',
    scale: GRADE_SCALE_TEXT,
  },

  // ── Pedagogical Performance Status ──
  'Pedagogical Performance Status::% of Students use the Library': {
    how: 'Average of the "% of Students Participated" value reported on all Library activity records.',
    source: 'Activity Participation form → Item = Use of library → % of Students Participated',
    scale: GRADE_SCALE_TEXT,
  },
  'Pedagogical Performance Status::% of Students use Lab': {
    how: 'Average of the "% of Students Participated" value reported on all lab activity records (Science, ICT and Agriculture labs).',
    source: 'Activity Participation form → Item = any lab → % of Students Participated',
    scale: GRADE_SCALE_TEXT,
  },
  'Pedagogical Performance Status::Routine-wise Corner Participation': {
    how: 'Green when the school has at least one Corner activity record.',
    source: 'Activity Participation form → Item = Corner activity',
    scale: YESNO_SCALE_TEXT,
  },
  'Pedagogical Performance Status::Routine-wise Club Participation': {
    how: 'Green when the school has at least one club activity record (any of the five clubs).',
    source: 'Activity Participation form → Item = any club',
    scale: YESNO_SCALE_TEXT,
  },
  'Pedagogical Performance Status::Students Awarded in Scholarship': {
    how: 'Total scholarships in the latest reported year ÷ total students × 100 (capped at 100%).',
    source: 'Pedagogical Achievement form → Scholarships (KG + Primary + Junior + SSC + Others) ÷ Students\u2019 Information (total students)',
    scale: GRADE_SCALE_TEXT,
  },
  'Pedagogical Performance Status::Students Scoring A & A+ in SSC': {
    how: 'Sum of A+ and A graders ÷ total number of students × 100 (capped at 100%), using a single exam set (Annual where available) to avoid double-counting.',
    source: 'Students\u2019 Performance form → Annual exam → A+ / A counts and Number of Students',
    scale: GRADE_SCALE_TEXT,
  },
  'Pedagogical Performance Status::Event Participation': {
    how: 'Green when the school has at least one event participation record.',
    source: 'Event Participation form',
    scale: YESNO_SCALE_TEXT,
  },
};

function buildStatusTables(p: SchoolProfile): StatusTableDef[] {
  const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const avgOf = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const pctStr = (v: number | null) => (v == null ? 'Not reported' : `${v.toFixed(1)}%`);
  // Signed percentage (deficit/surplus) — keeps the negative marking visible.
  const signedPctStr = (v: number | null) =>
    (v == null ? 'Not reported' : `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(1)}%`);
  // Percentages that can legitimately exceed 100 (target-exceeded) are capped
  // to 100 for grading + averaging so a single over-achieving row can't push
  // the whole table average above 100.
  const cap100 = (v: number | null) => (v == null ? null : Math.min(100, Math.max(0, v)));

  const inf = p.infrastructure;
  const teachers = p.teachers || [];
  const students = p.students || [];
  const st = p.studentTotals;
  const rbt = p.revenueBudgetTotal;
  const rat = p.revenueActualTotal;
  const acts = p.activityParticipation || [];
  const dev = p.teachersDevelopment || [];
  const events = p.eventParticipation || [];
  const pedag = p.pedagogicalAchievements || [];
  const sp = p.studentsPerformance || [];

  /* ── Students (auto, from Students' Info snapshots) ── */
  const attendVals = students.filter((s) => s.attendanceRate != null).map((s) => num(s.attendanceRate));
  const dropoutVals = students.filter((s) => s.dropoutRate != null).map((s) => num(s.dropoutRate));
  const attend = avgOf(attendVals);
  const dropout = avgOf(dropoutVals);
  const retention = dropout == null ? null : 100 - dropout; // grade dropout on retention (lower dropout = better)
  const target = num(rbt?.totalStudentsTarget);
  const enrollPct = target > 0 ? cap100((st.total / target) * 100) : null;

  /* ── Teachers (auto, from individual teacher records) ── */
  const totalT = teachers.length;
  const hasTr = (t: TeacherRow, kw: string) => (t.trainingReceived || '').toLowerCase().includes(kw);
  const basicPct = totalT ? (teachers.filter((t) => hasTr(t, 'basic')).length / totalT) * 100 : null;
  const subjPct = totalT ? (teachers.filter((t) => hasTr(t, 'subject')).length / totalT) * 100 : null;
  const aGradePct = totalT ? (teachers.filter((t) => num(t.assessmentScore) >= 80).length / totalT) * 100 : null;

  /* ── Teacher / Head-Teacher retention (from Teachers' Development) ── */
  const tDropVals = dev.map((d) => d.teacherDropoutRate).filter((v) => v != null).map(num);
  const teacherDropout = tDropVals.length ? avgOf(tDropVals) : null;
  const teacherRetention = teacherDropout == null ? null : 100 - teacherDropout;
  const htDropVals = dev.map((d) => d.headTeacherDropoutRate).filter((v) => v != null).map(num);
  const htDropout = htDropVals.length ? avgOf(htDropVals) : null;
  const htRetention = htDropout == null ? null : 100 - htDropout;
  // Latest month's leadership assessment — the profile endpoint returns the
  // development records sorted oldest → newest. Records saved before the
  // Strong/Moderate/Weak scale only carry the legacy good/needs-improvement flag.
  const leadershipOf = (d: { headTeacherLeadership?: string | null; headTeacherLeadershipGood?: boolean | null }) =>
    d.headTeacherLeadership ?? (d.headTeacherLeadershipGood == null ? null : d.headTeacherLeadershipGood ? 'strong' : 'weak');
  const htLeadValues = dev.map(leadershipOf).filter((v): v is string => v != null);
  const htLeadership = htLeadValues.length ? htLeadValues[htLeadValues.length - 1] : null;
  const htLeadershipGrade = htLeadership ? LEADERSHIP_GRADE[htLeadership] ?? null : null;

  /* ── Revenue (auto, target vs achievement across all fee types) ──
     Mirrors the Programme Overview definitions:
       Planned Revenue Target = Σ Budget targets
       Actual Revenue Target  = Σ Actual (enrolled-student) targets
       Collected              = Σ Actual achievements
       Outstanding dues       = max(Actual target − Collected, 0)
       Revenue deficit        = Collected − Planned target (negative = short) */
  const FEES = ['admissionFee', 'sessionFee', 'assessmentFee', 'sportsFee',
    'syllabusFee', 'testimonialFee', 'othersFee', 'transportFee'];
  const sumFees = (r: Record<string, any> | null | undefined, suffix: 'Target' | 'Achievement') =>
    (r ? FEES.reduce((s, f) => s + num(r[`${f}${suffix}`]), 0) : 0);
  const plannedTarget = sumFees(rbt, 'Target');
  const actualTarget = sumFees(rat, 'Target');
  const collected = sumFees(rat, 'Achievement');
  const duesAmount = Math.max(actualTarget - collected, 0);
  const deficitAmount = collected - plannedTarget;
  const collectedPct = actualTarget > 0 ? cap100((collected / actualTarget) * 100) : null;
  const duesPct = actualTarget > 0 ? cap100((duesAmount / actualTarget) * 100) : null;
  const deficitPct = plannedTarget > 0 ? ((deficitAmount / plannedTarget) * 100) : null;
  // Both shortfall rows are graded on their positive counterpart (lower is
  // better), the same way the dropout rows are graded on retention.
  const duesGradePct = duesPct == null ? null : 100 - duesPct;
  const deficitGradePct = plannedTarget > 0 ? cap100((collected / plannedTarget) * 100) : null;

  /* ── Pedagogical performance ── */
  const has = (kw: string) => acts.filter((a) => (a.item || '').toLowerCase().includes(kw));
  const libActs = has('library');
  const labActs = has('lab');
  const cornerActs = has('corner');
  const clubActs = has('club');
  // % of students using the library/lab = average of the reported
  // participationRate across all library/lab activity records.
  const rateOf = (list: Record<string, any>[]) => {
    const vals = list.map((a) => a.participationRate).filter((v) => v != null).map(num);
    return vals.length ? avgOf(vals) : null;
  };
  const libPct = rateOf(libActs);
  const labPct = rateOf(labActs);
  const latestPedag = pedag[0];
  const scholarSum = latestPedag
    ? num(latestPedag.kgScholarship) + num(latestPedag.primaryScholarship) +
      num(latestPedag.jrScholarship) + num(latestPedag.sscScholarship) +
      num(latestPedag.othersScholarship)
    : 0;
  const scholarPct = latestPedag && st.total > 0 ? cap100((scholarSum / st.total) * 100) : null;
  // Use a single exam set to avoid double-counting students who appear in both
  // the Half-yearly AND Annual performance records. Prefer 'Annual'; fall back
  // to whatever single exam exists.
  const spExam = sp.some((r) => (r.examName || '') === 'Annual') ? 'Annual' : (sp[0]?.examName ?? null);
  const spScoped = spExam ? sp.filter((r) => (r.examName || '') === spExam) : [];
  const spTotal = spScoped.reduce((s, r) => s + num(r.numberOfStudents), 0);
  const spTop = spScoped.reduce((s, r) => s + num(r.gradeAPlus) + num(r.gradeA), 0);
  const sscTopPct = spTotal > 0 ? cap100((spTop / spTotal) * 100) : null;
  const hasEvents = events.length > 0;

  /* ── Infrastructure & Classroom (Yes/No facility presence) ── */
  const boolYes = (v: boolean | null | undefined): boolean | undefined =>
    v == null ? undefined : Boolean(v);
  const infraRows: StatusRow[] = inf ? [
    { indicator: 'Owned Campus', status: inf.campusStatus || '—', kind: 'yesno', yes: inf.campusStatus ? inf.campusStatus.toLowerCase() === 'own' : undefined },
    { indicator: 'Sufficient Classrooms', status: yn(num(inf.roomClassroom) > 0), kind: 'yesno', yes: num(inf.roomClassroom) > 0 },
    { indicator: 'Separate Washrooms', status: yn((num(inf.washroomMale) + num(inf.washroomFemale)) > 0), kind: 'yesno', yes: (num(inf.washroomMale) + num(inf.washroomFemale)) > 0 },
    { indicator: 'Library Facility', status: yn(num(inf.roomLibrary) > 0), kind: 'yesno', yes: num(inf.roomLibrary) > 0 },
    { indicator: 'Lab Facility', status: yn(num(inf.roomLab) > 0), kind: 'yesno', yes: num(inf.roomLab) > 0 },
    { indicator: 'Hand Wash Point', status: yn(inf.hasHandWashPoint), kind: 'yesno', yes: boolYes(inf.hasHandWashPoint) },
    { indicator: 'Playground', status: yn(inf.hasPlayground), kind: 'yesno', yes: boolYes(inf.hasPlayground) },
    { indicator: 'Digitally Equipped Classrooms', status: yn(num(inf.digitallyEquippedClassrooms) > 0), kind: 'yesno', yes: num(inf.digitallyEquippedClassrooms) > 0 },
    { indicator: 'No Renovation Required', status: yn(!(inf.infraRenovationRequired || inf.classroomRenovationRequired)), kind: 'yesno', yes: !(inf.infraRenovationRequired || inf.classroomRenovationRequired) },
  ] : [
    { indicator: 'Infrastructure data', status: 'Not reported', kind: 'info', note: 'no form submitted' },
  ];

  return [
    {
      title: 'Infrastructure & Classroom Status',
      accent: 'bg-sky-100 text-sky-900',
      graded: !!inf,
      rows: infraRows,
    },
    {
      title: "Students' Status",
      accent: 'bg-emerald-100 text-emerald-900',
      graded: true,
      rows: [
        { indicator: 'Enrollment Target Met', status: pctStr(enrollPct), kind: 'percent', pct: enrollPct },
        { indicator: 'Yearly Dropout Rate', status: pctStr(dropout), kind: 'percent', pct: retention, gradeBasis: `retention ${pctStr(retention)}` },
        { indicator: 'Yearly Retention Rate', status: pctStr(retention), kind: 'percent', pct: retention, excludeFromAvg: true },
        { indicator: 'Monthly Attendance Rate', status: pctStr(attend), kind: 'percent', pct: attend },
      ],
    },
    {
      title: "Teachers' Status",
      accent: 'bg-indigo-100 text-indigo-900',
      graded: true,
      rows: [
        { indicator: 'Yearly Dropout Rate', status: pctStr(teacherDropout), kind: 'percent', pct: teacherRetention, gradeBasis: `retention ${pctStr(teacherRetention)}` },
        { indicator: 'Basic Training Coverage', status: pctStr(basicPct), kind: 'percent', pct: basicPct },
        { indicator: 'Subject-based Training Coverage', status: pctStr(subjPct), kind: 'percent', pct: subjPct },
        { indicator: 'A-Grade Teachers', status: pctStr(aGradePct), kind: 'percent', pct: aGradePct },
      ],
    },
    {
      title: "Head Teachers' Status",
      accent: 'bg-violet-100 text-violet-900',
      graded: true,
      rows: [
        { indicator: 'Yearly Dropout Rate', status: pctStr(htDropout), kind: 'percent', pct: htRetention, gradeBasis: `retention ${pctStr(htRetention)}` },
        { indicator: 'Leadership Status of HT', status: htLeadership == null ? 'Not reported' : LEADERSHIP_LABEL[htLeadership] ?? htLeadership, kind: 'grade', grade: htLeadershipGrade ?? undefined },
      ],
    },
    {
      title: 'Revenue Collection Status',
      accent: 'bg-amber-100 text-amber-900',
      graded: true,
      rows: [
        { indicator: 'Actual collected revenue %', status: pctStr(collectedPct), kind: 'percent', pct: collectedPct },
        { indicator: 'Outstanding dues %', status: pctStr(duesPct), kind: 'percent', pct: duesGradePct, excludeFromAvg: true, gradeBasis: `collected ${pctStr(duesGradePct)}` },
        { indicator: 'Revenue deficit %', status: signedPctStr(deficitPct), kind: 'percent', pct: deficitGradePct, gradeBasis: `collected vs plan ${pctStr(deficitGradePct)}` },
      ],
    },
    {
      title: 'Pedagogical Performance Status',
      accent: 'bg-rose-100 text-rose-900',
      graded: true,
      rows: [
        { indicator: '% of Students use the Library', status: pctStr(libPct), kind: 'percent', pct: libPct },
        { indicator: '% of Students use Lab', status: pctStr(labPct), kind: 'percent', pct: labPct },
        { indicator: 'Routine-wise Corner Participation', status: yn(cornerActs.length > 0), kind: 'yesno', yes: cornerActs.length > 0 },
        { indicator: 'Routine-wise Club Participation', status: yn(clubActs.length > 0), kind: 'yesno', yes: clubActs.length > 0 },
        { indicator: 'Students Awarded in Scholarship', status: pctStr(scholarPct), kind: 'percent', pct: scholarPct },
        { indicator: 'Students Scoring A & A+ in SSC', status: pctStr(sscTopPct), kind: 'percent', pct: sscTopPct },
        { indicator: 'Event Participation', status: yn(hasEvents), kind: 'yesno', yes: hasEvents },
      ],
    },
  ];
}

function StatusTables({ profile }: { profile: SchoolProfile }) {
  const tables = useMemo(() => buildStatusTables(profile), [profile]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={17} className="text-indigo-500" />
        <h3 className="text-base font-bold text-gray-800">Status Breakdown</h3>
      </div>
      <ScaleLegend />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {tables.map((t) => (
          <StatusTable key={t.title} {...t} />
        ))}
      </div>
    </div>
  );
}

/* ─── Overall grade badge + rating-breakdown modal ──────── */

const GROUP_ACCENT: Record<string, string> = {
  "Students' Status": 'bg-emerald-100 text-emerald-900',
  "Teachers' Status": 'bg-indigo-100 text-indigo-900',
  'Revenue Collection Status': 'bg-amber-100 text-amber-900',
  'Pedagogical Performance Status': 'bg-rose-100 text-rose-900',
};

function GradeRatingCard({ profile }: { profile: SchoolProfile }) {
  const tables = useMemo(() => buildStatusTables(profile), [profile]);
  const rating = useMemo(() => computeOverallRating(tables), [tables]);
  const [open, setOpen] = useState(false);

  const letter = rating.overallGrade;
  const color: GradeName = letter ? LETTER_COLOR[letter] : 'Yellow';
  const s = GRADE_STYLES[color];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative flex h-full min-h-[180px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl ring-1 ${s.ring} ${s.panel} p-6 text-left transition hover:shadow-md hover:ring-2 focus:outline-none focus:ring-2`}
      >
        {/* animated faded shade */}
        <div className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full ${s.glow} blur-2xl animate-pulse`} />
        <div className={`pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full ${s.glow} blur-2xl animate-pulse [animation-delay:700ms]`} />
        <div className="relative flex flex-col items-center text-center">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${s.sub}`}>Overall Grade</span>
          {letter ? (
            <>
              <span className={`mt-1 text-5xl font-black tracking-tight ${s.text} drop-shadow-sm`}>{letter}</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>{color} Flag</span>
              <span className="mt-2 text-[11px] font-medium text-gray-500">
                Score {rating.overallPoint!.toFixed(2)} / 3.00
              </span>
            </>
          ) : (
            <>
              <span className={`mt-1 text-4xl font-black tracking-tight ${s.text}`}>—</span>
              <span className="mt-2 text-[11px] font-medium text-gray-500">Not enough data to rate</span>
            </>
          )}
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 opacity-90 group-hover:opacity-100">
            <BarChart3 size={12} /> View rating breakdown
          </span>
        </div>
      </button>

      <RatingModal isOpen={open} onClose={() => setOpen(false)} tables={tables} rating={rating} />
    </>
  );
}

function RatingModal({
  isOpen, onClose, tables, rating,
}: {
  isOpen: boolean; onClose: () => void; tables: StatusTableDef[]; rating: OverallRating;
}) {
  const overallColor: GradeName = rating.overallGrade ? LETTER_COLOR[rating.overallGrade] : 'Yellow';
  const scoredGroups = rating.groups.map((g) => g.point).filter((p): p is number => p != null);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rating & Scoring System" size="xl">
      <div className="space-y-5 text-sm">
        <p className="leading-relaxed text-gray-600">
          Each status group is scored by grading its indicators, converting every grade to a
          point (<strong>A = 3, B = 2, C = 1</strong>), and averaging those points. The group&apos;s
          Average Grade and the school&apos;s Overall Flag both use the point band below.
        </p>
        <p className="leading-relaxed text-gray-500">
          Shortfall indicators (dropout rate, outstanding dues, revenue deficit) are graded on their
          positive counterpart — retention, revenue collected and collection against the plan — so a
          smaller shortfall always scores better. Rows marked <em>not counted</em> are the exact
          complement of another indicator in the same group and are shown for information only, so
          the same fact is never counted twice.
        </p>

        {/* Scales */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Percentage scale</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400" /> A / Green — 80% &amp; above</p>
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-yellow-400" /> B / Yellow — 70% to 79%</p>
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> C / Red — below 70%</p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Grade-point band</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400" /> ≥ 2.50 → A / Green</p>
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-yellow-400" /> 1.50 – 2.49 → B / Yellow</p>
              <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /> &lt; 1.50 → C / Red</p>
              <p className="pt-0.5 text-[11px] text-gray-400">Yes = Green (3) · No = Red (1)</p>
              <p className="text-[11px] text-gray-400">Strong = A (3) · Moderate = B (2) · Weak = C (1)</p>
            </div>
          </div>
        </div>

        {/* Per-group breakdown */}
        <div className="space-y-3">
          {OVERALL_GROUP_TITLES.map((title) => {
            const table = tables.find((t) => t.title === title);
            const g = rating.groups.find((x) => x.title === title);
            if (!table) return null;
            const gradedRows = table.rows.filter((r) => rowPoint(r) != null);
            const countedPoints = gradedRows.filter((r) => !r.excludeFromAvg).map((r) => rowPoint(r)!);
            return (
              <div key={title} className="overflow-hidden rounded-lg border border-gray-100">
                <div className={`flex items-center justify-between px-3 py-2 text-sm font-bold ${GROUP_ACCENT[title] ?? 'bg-gray-100 text-gray-800'}`}>
                  <span>{title}</span>
                  <span className="flex items-center gap-2">
                    {g?.point != null && <span className="text-xs font-semibold opacity-70">{g.point.toFixed(2)} pts</span>}
                    {g?.grade ? <GradePill grade={g.grade} /> : <span className="text-gray-400">—</span>}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {gradedRows.map((r) => {
                      const pt = rowPoint(r)!;
                      const excluded = !!r.excludeFromAvg;
                      return (
                        <tr key={r.indicator} className={excluded ? 'bg-gray-50/60' : undefined}>
                          <td className="px-3 py-1.5 text-gray-600">
                            {r.indicator}
                            {excluded && (
                              <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                not counted
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-500">
                            {r.status}
                            {r.gradeBasis && (
                              <span className="block text-[10px] text-gray-400">graded on {r.gradeBasis}</span>
                            )}
                          </td>
                          <td className="w-16 px-3 py-1.5 text-center">
                            <GradePill grade={r.kind === 'yesno' ? (r.yes ? 'A' : 'C') : r.kind === 'grade' ? r.grade! : pctToGrade(r.pct!)} />
                          </td>
                          <td className="w-12 px-3 py-1.5 text-center font-semibold text-gray-500">
                            {excluded ? <span className="text-gray-300">—</span> : pt}
                          </td>
                        </tr>
                      );
                    })}
                    {gradedRows.length === 0 && (
                      <tr><td className="px-3 py-2 text-gray-400">No graded indicators reported yet.</td></tr>
                    )}
                  </tbody>
                  {countedPoints.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-100 bg-gray-50/80">
                        <td className="px-3 py-1.5 font-semibold text-gray-500" colSpan={3}>
                          Average Grade = ({countedPoints.join(' + ')}) ÷ {countedPoints.length}
                        </td>
                        <td className="px-3 py-1.5 text-center font-bold text-gray-700">
                          {g?.point != null ? g.point.toFixed(2) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })}
        </div>

        {/* Overall */}
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 ring-1 ${GRADE_STYLES[overallColor].ring} ${GRADE_STYLES[overallColor].panel}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Score</p>
            <p className="text-[11px] text-gray-500">Mean of the four status groups (equal 25% weight)</p>
            {scoredGroups.length > 0 && (
              <p className="mt-0.5 text-[11px] text-gray-500">
                ({scoredGroups.map((p) => p.toFixed(2)).join(' + ')}) ÷ {scoredGroups.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-black ${GRADE_STYLES[overallColor].text}`}>
              {rating.overallPoint != null ? rating.overallPoint.toFixed(2) : '—'}
            </span>
            {rating.overallGrade
              ? <GradePill grade={rating.overallGrade} />
              : <span className="text-gray-400">—</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Filter select ─────────────────────────────────────── */

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */

export default function SchoolInformationPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header title="School Information" subtitle="Browse schools and view their full profile" />
          <div className="flex items-center justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        </>
      }
    >
      <SchoolInformationContent />
    </Suspense>
  );
}

function SchoolInformationContent() {
  const [schools, setSchools] = useState<SchoolListItem[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  const [search, setSearch] = useState('');
  const [fCategory, setFCategory] = useState('all');
  const [fType, setFType] = useState('all');
  const [fDivision, setFDivision] = useState('all');
  const [fDistrict, setFDistrict] = useState('all');
  const [fUpazila, setFUpazila] = useState('all');
  const [fApproval, setFApproval] = useState('all');

  // Preselect from the ?school= query param (set by e.g. Programme Overview links).
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('school'));
  /** '' = follow the server default (the newest year that has data for this school). */
  const [year, setYear] = useState(() => searchParams.get('academicYear') ?? '');

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const {
    data: profile = null,
    isFetching: loadingProfile,
    refetch: reloadProfile,
  } = useQuery({
    queryKey: ['school-profile', selectedId, year],
    enabled: !!selectedId,
    queryFn: () =>
      api
        .get(`/data-collection/schools/${selectedId}/profile`, {
          params: year ? { academicYear: year } : {},
        })
        .then(({ data }) => data as SchoolProfile),
  });

  const selectSchool = (id: string | null) => {
    // Available years differ per school, so fall back to the server default.
    setYear('');
    setSelectedId(id);
  };

  useEffect(() => {
    api.get('/data-collection/schools')
      .then(({ data }) => setSchools(data?.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSchools(false));
  }, []);

  /* ── Filter option lists (derived from data) ── */
  const categoryOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.schoolCategory).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Categories' },
      ...[...set].map((v) => ({ value: v, label: categoryLabel(v) }))];
  }, [schools]);

  const typeOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.schoolType).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Types' },
      ...[...set].map((v) => ({ value: v, label: typeLabel(v) }))];
  }, [schools]);

  const divisionOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.division).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Divisions' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools]);

  const districtOptions = useMemo(() => {
    const set = new Set(
      schools
        .filter((s) => fDivision === 'all' || s.division === fDivision)
        .map((s) => s.district).filter(Boolean) as string[],
    );
    return [{ value: 'all', label: 'All Districts' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools, fDivision]);

  const upazilaOptions = useMemo(() => {
    const set = new Set(
      schools
        .filter((s) => (fDivision === 'all' || s.division === fDivision) && (fDistrict === 'all' || s.district === fDistrict))
        .map((s) => s.upazila).filter(Boolean) as string[],
    );
    return [{ value: 'all', label: 'All Thanas' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools, fDivision, fDistrict]);

  const filteredSchools = useMemo(() => schools.filter((s) => {
    if (search && !(`${s.name} ${s.code}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fCategory !== 'all' && s.schoolCategory !== fCategory) return false;
    if (fType !== 'all' && s.schoolType !== fType) return false;
    if (fDivision !== 'all' && s.division !== fDivision) return false;
    if (fDistrict !== 'all' && s.district !== fDistrict) return false;
    if (fUpazila !== 'all' && s.upazila !== fUpazila) return false;
    if (fApproval === 'yes' && s.governmentApproval !== true) return false;
    if (fApproval === 'no' && s.governmentApproval === true) return false;
    return true;
  }), [schools, search, fCategory, fType, fDivision, fDistrict, fUpazila, fApproval]);

  const anyFilter = fCategory !== 'all' || fType !== 'all' || fDivision !== 'all' ||
    fDistrict !== 'all' || fUpazila !== 'all' || fApproval !== 'all' || !!search;

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / PAGE_SIZE));
  const pagedSchools = useMemo(
    () => filteredSchools.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredSchools, page],
  );

  const clearFilters = () => {
    setPage(1);
    setSearch(''); setFCategory('all'); setFType('all');
    setFDivision('all'); setFDistrict('all'); setFUpazila('all'); setFApproval('all');
  };

  /* ── Detail view ── */
  if (selectedId) {
    const availableYears = profile?.meta?.availableYears ?? [];
    const activeYear = year || (profile?.meta?.academicYear != null ? String(profile.meta.academicYear) : '');
    return (
      <>
        <Header
          title="School Information"
          subtitle={activeYear ? `Detailed school profile • Academic year ${activeYear}` : 'Detailed school profile'}
        />
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline" size="sm"
              onClick={() => selectSchool(null)}
              className="gap-1.5"
            >
              <ArrowLeft size={14} /> Back to list
            </Button>

            {availableYears.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <CalendarRange size={15} className="text-gray-500" />
                Academic year
                <select
                  value={activeYear}
                  onChange={(e) => setYear(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {loadingProfile && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-gray-400">Loading school profile…</p>
              </div>
            </div>
          )}

          {profile && !loadingProfile && <ProfileDetail profile={profile} onReload={() => { void reloadProfile(); }} />}
        </div>
      </>
    );
  }

  /* ── List + filters view ── */
  return (
    <>
      <Header title="School Information" subtitle="Filter and select a school to view its full profile" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter size={15} className="text-gray-500" /> Filters
              </CardTitle>
              {anyFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-gray-400 hover:text-gray-700">
                  <X size={12} /> Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <FilterSelect label="School Category" value={fCategory} onChange={(v) => { setPage(1); setFCategory(v); }} options={categoryOptions} />
              <FilterSelect label="Type of School" value={fType} onChange={(v) => { setPage(1); setFType(v); }} options={typeOptions} />
              <FilterSelect label="Division" value={fDivision} onChange={(v) => { setPage(1); setFDivision(v); setFDistrict('all'); setFUpazila('all'); }} options={divisionOptions} />
              <FilterSelect label="District" value={fDistrict} onChange={(v) => { setPage(1); setFDistrict(v); setFUpazila('all'); }} options={districtOptions} />
              <FilterSelect label="Thana / Upazila" value={fUpazila} onChange={(v) => { setPage(1); setFUpazila(v); }} options={upazilaOptions} />
              <FilterSelect label="Govt. Approval" value={fApproval} onChange={(v) => { setPage(1); setFApproval(v); }} options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Approved' },
                { value: 'no', label: 'Not Approved' },
              ]} />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Search</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                    placeholder="Name or code…"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{filteredSchools.length}</span> school{filteredSchools.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {loadingSchools ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <BookOpen size={28} className="text-indigo-400" />
            </div>
            <p className="font-medium text-gray-500">No schools match your filters</p>
            {anyFilter && (
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">School</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                    <th className="hidden py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Type</th>
                    <th className="hidden py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Location</th>
                    <th className="hidden py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Teachers</th>
                    <th className="hidden py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Students</th>
                    <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Govt.</th>
                    <th className="py-2.5 pl-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedSchools.map((s, idx) => (
                    <tr
                      key={s.id}
                      onClick={() => selectSchool(s.id)}
                      className="cursor-pointer transition-colors even:bg-gray-50/40 hover:bg-indigo-50/40"
                    >
                      <td className="py-3 pl-5 pr-3 text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                            <School size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{s.name}</p>
                            <p className="font-mono text-xs text-gray-400">{s.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {s.schoolCategory ? (
                          <Badge className="border-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{categoryLabel(s.schoolCategory)}</Badge>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="hidden py-3 px-3 text-gray-600 sm:table-cell">{typeLabel(s.schoolType)}</td>
                      <td className="hidden py-3 px-3 text-gray-500 lg:table-cell">
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="shrink-0 text-gray-400" />
                          <span className="truncate">{[s.upazila, s.district, s.division].filter(Boolean).join(', ') || '—'}</span>
                        </span>
                      </td>
                      <td className="hidden py-3 px-3 text-right text-gray-600 md:table-cell">{s.totalTeachers ?? '—'}</td>
                      <td className="hidden py-3 px-3 text-right text-gray-600 md:table-cell">{s.totalStudents ?? '—'}</td>
                      <td className="py-3 px-3 text-center">
                        {s.governmentApproval === true ? (
                          <ShieldCheck size={15} className="mx-auto text-green-500" />
                        ) : s.governmentApproval === false ? (
                          <ShieldX size={15} className="mx-auto text-gray-300" />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                          View <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                <p className="text-xs text-gray-400">
                  Page <span className="font-medium text-gray-600">{page}</span> of {totalPages}
                </p>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

/* ─── Profile detail (header + grade + 6 tables) ────────── */

function ProfileDetail({ profile, onReload }: { profile: SchoolProfile; onReload: () => void }) {
  const { school } = profile;

  // Prefer LIVE totals computed from the actual itemized records (same source
  // as the Status Breakdown tables below) so the header never shows stale
  // numbers vs. what's really been entered via Teachers/Students Information.
  // Only fall back to the school's declared static count when nothing has
  // been itemized yet.
  const totalTeachers = profile.teachers.length > 0 ? profile.teacherTotals.total : (school.totalTeachers ?? 0);
  const totalStudents = profile.students.length > 0 ? profile.studentTotals.total : (school.totalStudents ?? 0);

  const headerFields = [
    { label: 'Type of School', value: typeLabel(school.schoolType), icon: Layers },
    { label: 'Establishment Year', value: school.establishedYear ?? '—', icon: CalendarDays },
    { label: 'Division', value: school.division ?? '—', icon: MapPin },
    { label: 'District', value: school.district ?? '—', icon: MapPin },
    { label: 'Thana', value: school.upazila ?? '—', icon: MapPin },
    { label: 'Govt. Approval', value: yn(school.governmentApproval), icon: school.governmentApproval ? ShieldCheck : ShieldX },
    { label: 'Total Teachers', value: totalTeachers, icon: GraduationCap },
    { label: 'Total Students', value: totalStudents, icon: Users },
    { label: 'Grade Coverage', value: school.gradeCoverage ?? '—', icon: BookOpen },
  ];

  /* ── Table column defs ── */
  const studentRows = sortByGrade(profile.students);
  const feeRows = sortByGrade(profile.feeStructures);

  const infraRows = profile.infrastructure ? [
    { id: 'campus', label: 'Campus Status', value: profile.infrastructure.campusStatus || '—' },
    { id: 'rht', label: 'Head Teacher Rooms', value: profile.infrastructure.roomHeadTeachers },
    { id: 'rt', label: 'Teacher Rooms', value: profile.infrastructure.roomTeachers },
    { id: 'rc', label: 'Classrooms', value: profile.infrastructure.roomClassroom },
    { id: 'rp', label: 'Playrooms', value: profile.infrastructure.roomPlayroom },
    { id: 'rl', label: 'Library Rooms', value: profile.infrastructure.roomLibrary },
    { id: 'rlab', label: 'Lab Rooms', value: profile.infrastructure.roomLab },
    { id: 'rs', label: 'Storerooms', value: profile.infrastructure.roomStoreroom },
    { id: 'rk', label: 'Kitchens', value: profile.infrastructure.roomKitchen },
    { id: 'rsb', label: 'Sickbays', value: profile.infrastructure.roomSickbay },
    { id: 'ro', label: 'Other Rooms', value: profile.infrastructure.roomOthers },
    { id: 'rtot', label: 'Total Rooms', value: profile.infrastructure.roomTotal },
    { id: 'wm', label: 'Washrooms (Male)', value: profile.infrastructure.washroomMale },
    { id: 'wf', label: 'Washrooms (Female)', value: profile.infrastructure.washroomFemale },
    { id: 'dec', label: 'Digitally Equipped Classrooms', value: profile.infrastructure.digitallyEquippedClassrooms },
    { id: 'fsc', label: 'Floor-sitting Classrooms', value: profile.infrastructure.floorSittingClassrooms },
    { id: 'cwb', label: 'Classrooms w/ Whiteboard', value: profile.infrastructure.classroomsWithWhiteboard },
    { id: 'cbb', label: 'Classrooms w/ Blackboard', value: profile.infrastructure.classroomsWithBlackboard },
    { id: 'hwp', label: 'Hand Wash Point', value: yn(profile.infrastructure.hasHandWashPoint) },
    { id: 'pg', label: 'Playground', value: yn(profile.infrastructure.hasPlayground) },
    { id: 'sg', label: 'School Garden', value: yn(profile.infrastructure.hasSchoolGarden) },
    { id: 'nf', label: 'New Furniture Needed', value: yn(profile.infrastructure.classroomNewFurniture) },
    { id: 'rr', label: 'Renovation Required', value: yn(profile.infrastructure.infraRenovationRequired || profile.infrastructure.classroomRenovationRequired) },
  ] : [];

  const st = profile.studentTotals;
  const tt = profile.teacherTotals;

  const pedagTotal = (r: PedagAchievementRow) =>
    (r.kgScholarship ?? 0) + (r.primaryScholarship ?? 0) + (r.jrScholarship ?? 0) +
    (r.sscScholarship ?? 0) + (r.othersScholarship ?? 0);

  return (
    <div className="space-y-5">
      {/* Header + Grade */}
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <School size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{school.name}</h2>
                    <p className="mt-0.5 font-mono text-sm text-gray-500">{school.code}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {school.schoolCategory && (
                      <Badge className="border-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">{categoryLabel(school.schoolCategory)}</Badge>
                    )}
                    {school.governmentApproval && (
                      <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100">Govt. Approved</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={onReload} className="gap-1 text-xs text-gray-400 hover:text-gray-700">
                      <RefreshCw size={12} /> Reload
                    </Button>
                  </div>
                </div>

                {/* contact line */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {school.address && (
                    <span className="flex items-center gap-1"><MapPin size={11} />{school.address}</span>
                  )}
                  {school.phone && <span className="flex items-center gap-1"><Phone size={11} />{school.phone}</span>}
                  {school.email && <span className="flex items-center gap-1"><Mail size={11} />{school.email}</span>}
                  {school.principalName && <span className="flex items-center gap-1"><Users size={11} />Principal: <strong>{school.principalName}</strong></span>}
                </div>
              </div>
            </div>

            {/* field grid */}
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              {headerFields.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      <Icon size={12} /> {f.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{f.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Grade */}
        <GradeRatingCard profile={profile} />
      </div>

      {/* Parent → child submitted-data navigation menu */}
      <CategoryMenu schoolId={school.id} schoolName={school.name} schoolCode={school.code} />

      {/* Aggregated status breakdown tables */}
      <StatusTables profile={profile} />

    </div>
  );
}
