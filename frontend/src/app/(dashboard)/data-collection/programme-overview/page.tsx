'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  School, Users, GraduationCap,
  Filter, RefreshCw, BarChart3, Target, Sparkles,
  MapPin, CheckCircle2, XCircle, ChevronRight, ChevronDown, Check, Info,
  AlertTriangle, CalendarRange,
} from 'lucide-react';
import api from '@/lib/api';

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface CategoryTotals {
  totalSchools: number;
  totalTeachersMale: number;
  totalTeachersFemale: number;
  totalTeachers: number;
  totalStudentsBoys: number;
  totalStudentsGirls: number;
  totalStudents: number;
  totalPWD: number;
  totalEthnic: number;
  yearlyStudentTarget: number;
  budgetRevenueTarget: number;
  budgetRevenueAchievement: number;
  actualRevenueTarget: number;
  actualRevenueAchievement: number;
}

interface OverviewData {
  totals: CategoryTotals;
  categories: Record<string, CategoryTotals>;
  schools: SchoolRow[];
  /** Academic year the figures were aggregated for (null when no data exists yet). */
  academicYear: number | null;
  /** Every academic year that has submitted data, newest first. */
  availableYears: number[];
}

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  category: string;
  district?: string | null;
  division?: string | null;
  upazila?: string | null;
  establishedYear?: number | null;
  governmentApproval?: boolean | null;
  teachers: { male: number; female: number; total: number };
  students: { boys: number; girls: number; total: number; pwd: number; ethnic: number };
  yearlyStudentTarget: number;
  budgetRevenueTarget: number;
  budgetRevenueAchievement: number;
  actualRevenueTarget: number;
  actualRevenueAchievement: number;
}

/* â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const CATEGORY_OPTIONS = [
  { value: 'brac_academy', label: 'BRAC Academy', color: 'emerald' },
  { value: 'brac_primary', label: 'BRAC Primary', color: 'blue' },
  { value: 'brac_secondary', label: 'BRAC Secondary', color: 'purple' },
  { value: '', label: 'All Schools', color: 'indigo' },
];

const CHIP_STYLES: Record<string, { active: string; idle: string }> = {
  indigo: { active: 'bg-indigo-600 text-white shadow-md shadow-indigo-200', idle: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  blue: { active: 'bg-blue-600 text-white shadow-md shadow-blue-200', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  purple: { active: 'bg-purple-600 text-white shadow-md shadow-purple-200', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  emerald: { active: 'bg-emerald-600 text-white shadow-md shadow-emerald-200', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
};

/* Category tables config: order + header styling matching the three school types */
const CATEGORY_TABLES: { key: string; label: string; short: string; header: string; accent: string }[] = [
  { key: 'brac_primary', label: 'BRAC Primary', short: 'Primary', header: 'bg-amber-100 text-amber-900', accent: 'text-amber-700' },
  { key: 'brac_secondary', label: 'BRAC Secondary', short: 'Secondary', header: 'bg-orange-100 text-orange-900', accent: 'text-orange-700' },
  { key: 'brac_academy', label: 'BRAC Academy', short: 'Academy', header: 'bg-blue-100 text-blue-900', accent: 'text-blue-700' },
];

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
};

/* Placeholder SSC results — no SSC exam data is collected by any form yet (dc_students_performance only covers Play & Learn…G5). Replace once a real source exists. */
const DEMO_SSC = { passRate: 96.4, aPlusRate: 38.2 };

const fmtTaka = (n: number) => `৳${Math.round(n || 0).toLocaleString('en-IN')}`;

const signedTaka = (n: number) => `${n < 0 ? '-' : ''}${fmtTaka(Math.abs(n))}`;


/* BDT Taka currency icon (lucide has no Taka glyph) */
function TakaIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, fontWeight: 700 }}
      aria-hidden
    >
      ৳
    </span>
  );
}

/* â”€â”€â”€ Animated Counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const steps = 30;
    const step = value / steps;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

/* â”€â”€â”€ KPI Card (clickable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* Two-colour horizontal gradients for the KPI cards (top row style: pink → purple,
   violet, blue, … orange → amber). Static class strings: Tailwind cannot resolve
   dynamically built colour names. */
const CARD_GRADIENTS: Record<string, string> = {
  indigo: 'from-pink-500 via-rose-500 to-purple-500',
  purple: 'from-violet-600 via-purple-500 to-indigo-500',
  blue: 'from-sky-400 via-blue-500 to-indigo-500',
  cyan: 'from-cyan-400 via-sky-500 to-blue-600',
  teal: 'from-teal-400 via-emerald-500 to-teal-600',
  orange: 'from-amber-400 via-orange-500 to-orange-600',
  green: 'from-lime-400 via-green-500 to-emerald-600',
  red: 'from-rose-500 via-red-500 to-pink-600',
};

function KpiCard({
  title, value, valueDisplay, icon: Icon, accent, href,
}: {
  title: string; value: number; valueDisplay?: string; icon: React.ElementType;
  accent: keyof typeof CARD_GRADIENTS; href?: string;
}) {
  return (
    <Link href={href ?? '#'} className="group block h-full">
      <Card
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-r shadow-lg shadow-gray-300/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${CARD_GRADIENTS[accent]}`}
      >
        <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold leading-snug tracking-wide text-white/90 sm:text-xs">
              {title}
            </p>
            <Icon
              size={22}
              className="shrink-0 text-white/80 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <p className="mt-2 break-words text-2xl font-extrabold leading-tight tabular-nums text-white drop-shadow-sm sm:text-3xl">
            {valueDisplay ?? <AnimatedNumber value={value} />}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

/* â”€â”€â”€ Category Summary Table (Title | Value) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MetricRow({ label, value, indent, strong, tone, onInfo }: {
  label: string; value: string; indent?: boolean; strong?: boolean;
  tone?: 'danger' | 'success'; onInfo?: () => void;
}) {
  const valueTone = tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : (strong ? 'text-gray-900' : 'text-gray-700');
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-2 transition-colors even:bg-gray-50/80 last:border-0 hover:bg-indigo-50/60">
      <span className={`text-xs sm:text-sm ${indent ? 'pl-3 text-gray-500' : 'text-gray-700'} ${strong ? 'font-semibold text-gray-800' : 'font-medium'}`}>
        {label}
        {onInfo && (
          <button
            type="button"
            onClick={onInfo}
            aria-label={`How "${label}" is calculated`}
            className="ml-1 inline-flex translate-y-[1px] rounded-full text-gray-300 transition-colors hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <Info size={13} />
          </button>
        )}
      </span>
      <span className={`shrink-0 text-xs sm:text-sm tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${valueTone}`}>
        {value}
      </span>
    </div>
  );
}

/* â”€â”€â”€ Metric calculation explainers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface Explainer {
  title: string;
  meaning: string;
  formula: string;
  steps: { label: string; value: string; op?: string }[];
  result: string;
  resultTone?: 'danger' | 'success';
  source: string;
  notes?: string[];
}

const FEE_TYPES = 'Admission, Session, Assessment, Sports, Syllabus, Testimonial, Transport and Others';

function ExplainerBody({ e }: { e: Explainer }) {
  const tone = e.resultTone === 'danger' ? 'text-red-600' : e.resultTone === 'success' ? 'text-emerald-600' : 'text-gray-900';
  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-600">{e.meaning}</p>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Formula</p>
        <p className="rounded-lg bg-indigo-50 px-3 py-2 font-mono text-xs text-indigo-800 sm:text-sm">{e.formula}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Applied to the currently displayed figures
        </p>
        <div className="overflow-hidden rounded-lg border border-gray-100">
          {e.steps.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 border-b border-gray-50 px-3 py-2 last:border-0">
              <span className="text-gray-600">
                {s.op && <span className="mr-1.5 font-mono font-bold text-gray-400">{s.op}</span>}
                {s.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-gray-800">{s.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2">
            <span className="font-semibold text-gray-700">Result</span>
            <span className={`shrink-0 font-bold tabular-nums ${tone}`}>{e.result}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Data source</p>
        <p className="text-xs text-gray-600 sm:text-sm">{e.source}</p>
      </div>

      {e.notes && e.notes.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2.5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Notes</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">
            {e.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CategorySummaryTable({ label, header, totals, showSsc }: { label: string; header: string; totals?: CategoryTotals; showSsc?: boolean }) {
  const [explainer, setExplainer] = useState<Explainer | null>(null);
  const t = totals ?? {
    totalSchools: 0, totalTeachersMale: 0, totalTeachersFemale: 0, totalTeachers: 0,
    totalStudentsBoys: 0, totalStudentsGirls: 0, totalStudents: 0, totalPWD: 0, totalEthnic: 0,
    yearlyStudentTarget: 0, budgetRevenueTarget: 0, budgetRevenueAchievement: 0,
    actualRevenueTarget: 0, actualRevenueAchievement: 0,
  };
  const n = (v: number) => v.toLocaleString();
  const rate = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : 'n/a');

  const collected = t.actualRevenueAchievement;
  /* Billed-but-uncollected against the actual enrolled students; over-collection is reported as zero dues. */
  const rawDues = t.actualRevenueTarget - collected;
  const outstandingDues = Math.max(rawDues, 0);
  /* Budget variance: how far the money actually collected sits from the planned (budgeted) target. */
  const revenueDeficit = collected - t.budgetRevenueTarget;
  /* The variance splits into an enrolment/target gap plus the uncollected dues. */
  const targetGap = t.actualRevenueTarget - t.budgetRevenueTarget;

  const EXPLAINERS: Record<string, Explainer> = {
    planned: {
      title: 'Planned Revenue Target',
      meaning: 'The revenue the schools budgeted for the year, based on the planned (budgeted) number of students — the baseline the programme is measured against.',
      formula: 'Σ of the 8 yearly budget fee targets, summed across every school in this category',
      steps: [
        { label: `Schools in "${label}"`, value: n(t.totalSchools) },
        { label: 'Planned student target', value: n(t.yearlyStudentTarget) },
        { label: 'Σ budgeted fee targets', value: fmtTaka(t.budgetRevenueTarget) },
      ],
      result: fmtTaka(t.budgetRevenueTarget),
      source: `"Revenue as per Budget — Yearly Total" form (dc_revenue_budget_total). Adds the target column of all 8 fee types (${FEE_TYPES}) for each school, then sums the schools in this category.`,
      notes: ['A school with no budget form submitted contributes ৳0, so it drags the category total down rather than being excluded.'],
    },
    actualTarget: {
      title: 'Actual Revenue Target',
      meaning: 'The revenue that is actually receivable this year — the same fee heads recalculated against the students really enrolled, i.e. the amount genuinely billed to students.',
      formula: 'Σ of the 8 yearly actual-student fee targets, summed across every school in this category',
      steps: [
        { label: 'Σ actual fee targets (receivable)', value: fmtTaka(t.actualRevenueTarget) },
        { label: 'Planned Revenue Target', value: fmtTaka(t.budgetRevenueTarget), op: 'vs' },
        { label: 'Gap vs plan', value: signedTaka(targetGap), op: '=' },
      ],
      result: fmtTaka(t.actualRevenueTarget),
      source: `"Revenue as per Actual Student — Yearly Total" form (dc_revenue_actual_total). Adds the target column of all 8 fee types (${FEE_TYPES}) for each school, then sums the schools in this category.`,
      notes: ['A gap against the plan here reflects enrolment (fewer/more students than budgeted), not a collection problem.'],
    },
    collected: {
      title: 'Revenue achievement as per the actual student',
      meaning: 'The money actually collected from students during the year — the cash side of the Actual Revenue Target.',
      formula: 'Σ of the 8 yearly actual-student fee achievements, summed across every school in this category',
      steps: [
        { label: 'Σ actual fee achievements (collected)', value: fmtTaka(collected) },
        { label: 'Actual Revenue Target (receivable)', value: fmtTaka(t.actualRevenueTarget), op: '÷' },
        { label: 'Collection rate', value: rate(collected, t.actualRevenueTarget), op: '=' },
      ],
      result: fmtTaka(collected),
      source: `"Revenue as per Actual Student — Yearly Total" form (dc_revenue_actual_total), achievement column of all 8 fee types (${FEE_TYPES}).`,
    },
    dues: {
      title: 'Outstanding dues',
      meaning: 'Fees that were billed to the students actually enrolled but have not been collected yet — the real receivable still sitting with students/guardians.',
      formula: 'Outstanding dues = Actual Revenue Target − Revenue achievement (floored at ৳0)',
      steps: [
        { label: 'Actual Revenue Target (receivable)', value: fmtTaka(t.actualRevenueTarget) },
        { label: 'Revenue achievement (collected)', value: fmtTaka(collected), op: '−' },
        { label: 'Uncollected', value: signedTaka(rawDues), op: '=' },
        { label: 'Collection rate', value: rate(collected, t.actualRevenueTarget) },
      ],
      result: fmtTaka(outstandingDues),
      resultTone: outstandingDues > 0 ? 'danger' : 'success',
      source: 'Both values come from the same "Revenue as per Actual Student — Yearly Total" form, so target and achievement always cover the same 8 fee heads and the same schools.',
      notes: [
        'Measured against the ACTUAL target, not the planned one — dues can only exist for money that was really billed.',
        rawDues < 0
          ? `Collection currently exceeds the receivable by ${fmtTaka(-rawDues)} (advance or arrear payments), so dues are shown as ৳0 instead of a negative figure.`
          : 'If collection ever exceeds the receivable (advance/arrear payments) the row shows ৳0 rather than a negative figure.',
      ],
    },
    deficit: {
      title: 'Revenue deficit',
      meaning: 'How far the money actually collected falls short of the yearly plan. It is a budget variance, shown with negative marking: a minus figure is a shortfall, a plus figure means the plan was beaten.',
      formula: 'Revenue deficit = Revenue achievement (collected) − Planned Revenue Target',
      steps: [
        { label: 'Revenue achievement (collected)', value: fmtTaka(collected) },
        { label: 'Planned Revenue Target', value: fmtTaka(t.budgetRevenueTarget), op: '−' },
        { label: 'Deficit / surplus', value: signedTaka(revenueDeficit), op: '=' },
        { label: 'Plan achieved', value: rate(collected, t.budgetRevenueTarget) },
        { label: 'of which — enrolment/target gap', value: signedTaka(targetGap) },
        { label: 'of which — uncollected dues', value: signedTaka(-rawDues) },
      ],
      result: signedTaka(revenueDeficit),
      resultTone: revenueDeficit < 0 ? 'danger' : 'success',
      source: 'Planned figure from the "Revenue as per Budget" yearly total; collected figure from the "Revenue as per Actual Student" yearly total.',
      notes: [
        'The deficit is the sum of the two "of which" lines: an enrolment/target gap (fewer or more students than budgeted) plus whatever was billed but not collected. That split tells you whether the shortfall is an admissions problem or a collection problem.',
        'Deliberately measured against the PLANNED target, so it stays comparable year-on-year even when enrolment moves.',
      ],
    },
    sscPass: {
      title: 'Pass rate in SSC exam',
      meaning: 'Share of BRAC Secondary students who appeared in the SSC exam and passed it.',
      formula: 'Pass rate = (Students passed ÷ Students appeared) × 100',
      steps: [
        { label: 'Students passed', value: 'not collected' },
        { label: 'Students appeared', value: 'not collected', op: '÷' },
        { label: 'Demo placeholder', value: `${DEMO_SSC.passRate.toFixed(1)}%`, op: '=' },
      ],
      result: `${DEMO_SSC.passRate.toFixed(1)}% (demo)`,
      source: 'No source yet. The closest form, "Students\' Performance" (dc_students_performance), only covers Play & Learn to Grade 5 with Half-yearly/Annual exams — it has no SSC exam record, and the Programme Overview endpoint does not read it at all.',
      notes: ['This is static demo data, identical for every filter. Wire it to a real SSC field once one is collected.'],
    },
    sscAPlus: {
      title: 'Percentage of students obtained A+ in SSC exam',
      meaning: 'Share of BRAC Secondary SSC candidates who achieved a GPA-5 / A+ grade.',
      formula: 'A+ rate = (Students with A+ ÷ Students appeared) × 100',
      steps: [
        { label: 'Students with A+', value: 'not collected' },
        { label: 'Students appeared', value: 'not collected', op: '÷' },
        { label: 'Demo placeholder', value: `${DEMO_SSC.aPlusRate.toFixed(1)}%`, op: '=' },
      ],
      result: `${DEMO_SSC.aPlusRate.toFixed(1)}% (demo)`,
      source: 'No source yet. dc_students_performance stores A+/A/A−/B/C/D/F counts, but only for Play & Learn to Grade 5 Half-yearly/Annual exams — never for SSC.',
      notes: ['This is static demo data, identical for every filter. Wire it to a real SSC field once one is collected.'],
    },
  };

  return (
    <Card className="h-full overflow-hidden border-gray-200 shadow-sm">
      <div className={`px-4 py-3 text-center text-sm font-bold ${header}`}>{label}</div>
      <div className="divide-y divide-gray-100">
        <MetricRow label="Total Number of Schools" value={n(t.totalSchools)} strong />
        <MetricRow label="Total Number of Teachers" value={n(t.totalTeachers)} strong />
        <MetricRow label="Male" value={n(t.totalTeachersMale)} indent />
        <MetricRow label="Female" value={n(t.totalTeachersFemale)} indent />
        <MetricRow label="Total Number of Students" value={n(t.totalStudents)} strong />
        <MetricRow label="Girls" value={n(t.totalStudentsGirls)} indent />
        <MetricRow label="Boys" value={n(t.totalStudentsBoys)} indent />
        <MetricRow label="PWD" value={n(t.totalPWD)} indent />
        <MetricRow label="Ethnic" value={n(t.totalEthnic)} indent />
        <MetricRow label="Yearly Student Target" value={n(t.yearlyStudentTarget)} strong />
        <MetricRow
          label="Planned Revenue Target"
          value={fmtTaka(t.budgetRevenueTarget)}
          onInfo={() => setExplainer(EXPLAINERS.planned)}
        />
        <MetricRow
          label="Actual Revenue Target"
          value={fmtTaka(t.actualRevenueTarget)}
          onInfo={() => setExplainer(EXPLAINERS.actualTarget)}
        />
        <MetricRow
          label="Revenue achievement as per the actual student"
          value={fmtTaka(collected)}
          onInfo={() => setExplainer(EXPLAINERS.collected)}
        />
        <MetricRow
          label="Outstanding dues"
          value={fmtTaka(outstandingDues)}
          tone={outstandingDues > 0 ? 'danger' : 'success'}
          onInfo={() => setExplainer(EXPLAINERS.dues)}
        />
        <MetricRow
          label="Revenue deficit"
          value={signedTaka(revenueDeficit)}
          tone={revenueDeficit < 0 ? 'danger' : 'success'}
          onInfo={() => setExplainer(EXPLAINERS.deficit)}
        />
        {showSsc && (
          <>
            <MetricRow
              label="Pass rate in SSC exam"
              value={`${DEMO_SSC.passRate.toFixed(1)}%`}
              onInfo={() => setExplainer(EXPLAINERS.sscPass)}
            />
            <MetricRow
              label="Percentage of students obtained A+ in SSC exam"
              value={`${DEMO_SSC.aPlusRate.toFixed(1)}%`}
              onInfo={() => setExplainer(EXPLAINERS.sscAPlus)}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={!!explainer}
        onClose={() => setExplainer(null)}
        title={explainer ? `${explainer.title} — ${label}` : ''}
        size="lg"
      >
        {explainer && <ExplainerBody e={explainer} />}
      </Modal>
    </Card>
  );
}

/* â”€â”€â”€ Schools List Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SchoolsListTable({ schools, onRowClick }: { schools: SchoolRow[]; onRowClick: (id: string) => void }) {
  const location = (s: SchoolRow) =>
    [s.upazila, s.district, s.division].filter(Boolean).join(', ') || '—';

  return (
    <Card className="overflow-hidden border-indigo-100 shadow-sm">
      <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-3 sm:px-5">
        <School size={16} className="text-indigo-600" />
        <h3 className="text-sm font-semibold text-indigo-900">Schools ({schools.length})</h3>
        <span className="ml-auto hidden text-xs text-indigo-500 sm:inline">Click a school to open its full profile</span>
      </div>

      {schools.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No schools found.</p>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-indigo-200 bg-indigo-100 text-left text-xs uppercase tracking-wide text-indigo-900">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 text-center font-semibold">Est. Year</th>
                  <th className="px-4 py-3 text-center font-semibold">Govt. Approval</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Students</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50">
                {schools.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onRowClick(s.id)}
                    className="group cursor-pointer bg-white transition even:bg-indigo-50/40 hover:bg-indigo-100/70"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 group-hover:text-indigo-700">{s.name}</p>
                      <p className="font-mono text-xs text-gray-400">{s.code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[s.category] ?? s.category}</td>
                    <td className="px-4 py-3 text-gray-600">{location(s)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.establishedYear ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {s.governmentApproval ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 size={14} /> Yes</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><XCircle size={14} /> No</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{s.students.total.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right">
                      <ChevronRight size={16} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="divide-y divide-indigo-50 sm:hidden">
            {schools.map((s) => (
              <button
                key={s.id}
                onClick={() => onRowClick(s.id)}
                className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition even:bg-indigo-50/40 active:bg-indigo-100/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{s.name}</p>
                  <p className="font-mono text-xs text-gray-400">{s.code}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>{CATEGORY_LABELS[s.category] ?? s.category}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={11} />{location(s)}</span>
                    {s.establishedYear ? <span>Est. {s.establishedYear}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      {s.governmentApproval
                        ? <><CheckCircle2 size={11} className="text-green-600" /> Approved</>
                        : <><XCircle size={11} className="text-gray-400" /> Not approved</>}
                    </span>
                    <span className="font-semibold text-gray-700">{s.students.total.toLocaleString()} students</span>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-gray-300" />
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* Searchable Academic-Year dropdown (30 years from 2020) */
const YEAR_OPTIONS: number[] = Array.from({ length: 30 }, (_, i) => 2020 + i);

function YearSelect({ value, onChange }: { value: string; onChange: (y: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () => YEAR_OPTIONS.filter((y) => String(y).includes(search.trim())),
    [search],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {value}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search year…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No year matches</p>
            ) : (
              filtered.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { onChange(String(y)); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-indigo-50 ${
                    String(y) === value ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  {y}
                  {String(y) === value && <Check size={14} className="text-indigo-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgrammeOverviewPage() {
  const [category, setCategory] = useState('');
  /** Defaults to the current academic year; every API call carries the year explicitly. */
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const router = useRouter();

  const { data, isFetching: loading, refetch } = useQuery({
    queryKey: ['programme-overview', category, year],
    queryFn: () =>
      api
        .get('/data-collection/programme-overview', {
          params: {
            academicYear: year, // always explicit — defaults to the current year
            ...(category ? { category } : {}),
          },
        })
        .then(({ data }) => data as OverviewData),
    placeholderData: keepPreviousData,
  });

  const t = data?.totals;
  const categories = data?.categories ?? {};

  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (year) query.set('academicYear', year);
  const q = query.toString() ? `?${query.toString()}` : '';
  const detailHref = (metric: string) => `/data-collection/programme-overview/${metric}${q}`;

  const outstandingDues = Math.max((t?.actualRevenueTarget ?? 0) - (t?.actualRevenueAchievement ?? 0), 0);

  if (loading && !data) {
    return (
      <>
        <Header title="Programme Overview" />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm text-gray-500">Loading programme data…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Programme Overview"
        subtitle={`Aggregated data across all schools • Academic year ${year}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => { void refetch(); }} className="gap-2">
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter size={16} />
                Filter by:
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => {
                  const style = CHIP_STYLES[opt.color];
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setCategory(opt.value)}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                        category === opt.value ? style.active : style.idle
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <CalendarRange size={15} className="text-gray-500" />
                  Academic year
                </div>
                <YearSelect value={year} onChange={setYear} />
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-gray-500 sm:text-sm">
          Click any card to see the school-by-school breakdown behind the number.
        </p>

        {/* KPI cards — enrolment (row 1) then revenue (row 2), one grid so every card lines up */}
        <div className={`grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <KpiCard
            title="Total Schools"
            value={t?.totalSchools ?? 0}
            icon={School}
            accent="indigo"
            href={detailHref('schools')}
          />
          <KpiCard
            title="Total Teachers"
            value={t?.totalTeachers ?? 0}
            icon={Users}
            accent="purple"
            href={detailHref('teachers')}
          />
          <KpiCard
            title="Total Students"
            value={t?.totalStudents ?? 0}
            icon={GraduationCap}
            accent="blue"
            href={detailHref('students')}
          />
          <KpiCard
            title="Yearly Student Target"
            value={t?.yearlyStudentTarget ?? 0}
            icon={Target}
            accent="cyan"
            href={detailHref('student-target')}
          />
          <KpiCard
            title="Planned Revenue Target"
            value={t?.budgetRevenueTarget ?? 0}
            valueDisplay={fmtTaka(t?.budgetRevenueTarget ?? 0)}
            icon={TakaIcon}
            accent="teal"
            href={detailHref('budget-target')}
          />
          <KpiCard
            title="Actual Revenue Target"
            value={t?.actualRevenueTarget ?? 0}
            valueDisplay={fmtTaka(t?.actualRevenueTarget ?? 0)}
            icon={BarChart3}
            accent="orange"
            href={detailHref('actual-target')}
          />
          <KpiCard
            title="Actual Revenue Achievement"
            value={t?.actualRevenueAchievement ?? 0}
            valueDisplay={fmtTaka(t?.actualRevenueAchievement ?? 0)}
            icon={Sparkles}
            accent="green"
            href={detailHref('actual-achievement')}
          />
          <KpiCard
            title="Outstanding Dues & Deficit"
            value={outstandingDues}
            valueDisplay={fmtTaka(outstandingDues)}
            icon={AlertTriangle}
            accent="red"
            href={detailHref('revenue-gap')}
          />
        </div>

        {/* Category summary tables */}
        <div className={`space-y-3 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-500" />
            <h2 className="text-base font-bold text-gray-800">Category Breakdown</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CATEGORY_TABLES
              .filter((c) => !category || c.key === category)
              .map((c) => (
                <CategorySummaryTable
                  key={c.key}
                  label={c.label}
                  header={c.header}
                  totals={categories[c.key]}
                  showSsc={c.key === 'brac_secondary'}
                />
              ))}
          </div>
        </div>

        {/* Schools list */}
        <div className={`transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <SchoolsListTable
            schools={data?.schools ?? []}
            onRowClick={(id) => router.push(`/data-collection/school-information?school=${id}&academicYear=${year}`)}
          />
        </div>
      </div>
    </>
  );
}
