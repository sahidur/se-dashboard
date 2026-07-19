'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  School, Users, GraduationCap, TrendingUp,
  Filter, RefreshCw, ArrowUpRight, BarChart3, Target, Sparkles,
  User, Globe, MapPin, CheckCircle2, XCircle, ChevronRight,
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
  { value: '', label: 'All Schools', color: 'indigo' },
  { value: 'brac_primary', label: 'BRAC Primary', color: 'blue' },
  { value: 'brac_secondary', label: 'BRAC Secondary', color: 'purple' },
  { value: 'brac_academy', label: 'BRAC Academy', color: 'emerald' },
];

const CHIP_STYLES: Record<string, { active: string; idle: string }> = {
  indigo: { active: 'bg-indigo-600 text-white shadow-md shadow-indigo-200', idle: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  blue: { active: 'bg-blue-600 text-white shadow-md shadow-blue-200', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  purple: { active: 'bg-purple-600 text-white shadow-md shadow-purple-200', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  emerald: { active: 'bg-emerald-600 text-white shadow-md shadow-emerald-200', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
};

/* Category tables config: order + header styling matching the three school types */
const CATEGORY_TABLES: { key: string; label: string; header: string; accent: string }[] = [
  { key: 'brac_primary', label: 'BRAC Primary', header: 'bg-amber-100 text-amber-900', accent: 'text-amber-700' },
  { key: 'brac_secondary', label: 'BRAC Secondary', header: 'bg-orange-100 text-orange-900', accent: 'text-orange-700' },
  { key: 'brac_academy', label: 'BRAC Academy', header: 'bg-blue-100 text-blue-900', accent: 'text-blue-700' },
];

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
};

const fmtTaka = (n: number) => `৳${Math.round(n || 0).toLocaleString('en-IN')}`;

const pct = (a: number, b: number) => (b > 0 ? Math.min((a / b) * 100, 100).toFixed(1) : '0');

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

interface StatChip { label: string; value: string; icon: React.ElementType }

function KpiCard({
  title, value, valueDisplay, icon: Icon, gradient, badge, pctVal, href, stats,
}: {
  title: string; value: number; valueDisplay?: string; icon: React.ElementType;
  gradient: string; badge?: string; pctVal?: number; href: string; stats?: StatChip[];
}) {
  return (
    <Link href={href} className="block group h-full">
      <Card className={`relative flex h-full min-h-[196px] flex-col overflow-hidden border-0 shadow-md transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl ${gradient}`}>
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">{title}</p>
              <p className="mt-1 text-3xl font-extrabold text-white">
                {valueDisplay ?? <AnimatedNumber value={value} />}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Icon size={22} className="text-white" />
            </div>
          </div>

          {stats && stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1.5">
                  <s.icon size={15} className="text-white/90" />
                  <span className="text-[11px] font-medium text-white/80">{s.label}</span>
                  <span className="text-sm font-extrabold text-white">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {pctVal !== undefined && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-white/90">
                <span>Achievement</span>
                <span>{pctVal}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full bg-white transition-all duration-1000"
                  style={{ width: `${Math.min(Number(pctVal), 100)}%` }}
                />
              </div>
            </div>
          )}

          {badge && (
            <div className="mt-3">
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">{badge}</span>
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center gap-1 text-xs font-semibold text-white/90 opacity-80 transition-opacity group-hover:opacity-100">
            View details
            <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* â”€â”€â”€ Category Summary Table (Title | Value) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MetricRow({ label, value, indent, strong }: { label: string; value: string; indent?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-2 last:border-0">
      <span className={`text-xs sm:text-sm ${indent ? 'pl-3 text-gray-500' : 'text-gray-700'} ${strong ? 'font-semibold text-gray-800' : 'font-medium'}`}>
        {label}
      </span>
      <span className={`shrink-0 text-xs sm:text-sm tabular-nums ${strong ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

function CategorySummaryTable({ label, header, totals }: { label: string; header: string; totals?: CategoryTotals }) {
  const t = totals ?? {
    totalSchools: 0, totalTeachersMale: 0, totalTeachersFemale: 0, totalTeachers: 0,
    totalStudentsBoys: 0, totalStudentsGirls: 0, totalStudents: 0, totalPWD: 0, totalEthnic: 0,
    yearlyStudentTarget: 0, budgetRevenueTarget: 0, budgetRevenueAchievement: 0,
    actualRevenueTarget: 0, actualRevenueAchievement: 0,
  };
  const n = (v: number) => v.toLocaleString();
  return (
    <Card className="border-0 shadow-sm overflow-hidden h-full">
      <div className={`px-4 py-3 text-center text-sm font-bold ${header}`}>{label}</div>
      <div className="divide-y divide-gray-50">
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
        <MetricRow label="Revenue target as per the budget" value={fmtTaka(t.budgetRevenueTarget)} />
        <MetricRow label="Revenue achievement as per the budget" value={fmtTaka(t.budgetRevenueAchievement)} />
        <MetricRow label="Revenue target as per the actual student" value={fmtTaka(t.actualRevenueTarget)} />
        <MetricRow label="Revenue achievement as per the actual student" value={fmtTaka(t.actualRevenueAchievement)} />
      </div>
    </Card>
  );
}

/* â”€â”€â”€ Schools List Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SchoolsListTable({ schools, onRowClick }: { schools: SchoolRow[]; onRowClick: (id: string) => void }) {
  const location = (s: SchoolRow) =>
    [s.upazila, s.district, s.division].filter(Boolean).join(', ') || 'â€”';

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
        <School size={16} className="text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-700">Schools ({schools.length})</h3>
        <span className="ml-auto hidden text-xs text-gray-400 sm:inline">Click a school to open its full profile</span>
      </div>

      {schools.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No schools found.</p>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-500">Name</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500">Category</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500">Location</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Est. Year</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Govt. Approval</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Total Students</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schools.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onRowClick(s.id)}
                    className="group cursor-pointer transition hover:bg-indigo-50/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 group-hover:text-indigo-700">{s.name}</p>
                      <p className="font-mono text-xs text-gray-400">{s.code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[s.category] ?? s.category}</td>
                    <td className="px-4 py-3 text-gray-600">{location(s)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.establishedYear ?? 'â€”'}</td>
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
          <div className="divide-y divide-gray-50 sm:hidden">
            {schools.map((s) => (
              <button
                key={s.id}
                onClick={() => onRowClick(s.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-indigo-50"
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

export default function ProgrammeOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const router = useRouter();

  const load = useCallback(() => {
    setLoading(true);
    api.get('/data-collection/programme-overview', { params: category ? { category } : {} })
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const categories = data?.categories ?? {};
  const q = category ? `?category=${category}` : '';
  const detailHref = (metric: string) => `/data-collection/programme-overview/${metric}${q}`;

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
        subtitle="Aggregated data across all schools"
        actions={
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter size={16} />
                Filter by:
              </div>
              <div className="flex flex-wrap gap-2.5">
                {CATEGORY_OPTIONS.map((opt) => {
                  const style = CHIP_STYLES[opt.color];
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setCategory(opt.value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        category === opt.value ? style.active : style.idle
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto text-sm font-medium text-gray-500">
                {t?.totalSchools ?? 0} school{(t?.totalSchools ?? 0) !== 1 ? 's' : ''} shown
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-gray-500">
          Click any card to see the school-by-school breakdown behind the number.
        </p>

        {/* KPI Row 1 — Schools, Teachers, Students, Target */}
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <KpiCard
            title="Total Schools"
            value={t?.totalSchools ?? 0}
            icon={School}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
            badge={`${Object.keys(categories).length} School ${Object.keys(categories).length === 1 ? 'Category' : 'Categories'}`}
            href={detailHref('schools')}
          />
          <KpiCard
            title="Total Teachers"
            value={t?.totalTeachers ?? 0}
            icon={Users}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
            href={detailHref('teachers')}
            stats={[
              { label: 'Male', value: (t?.totalTeachersMale ?? 0).toLocaleString(), icon: User },
              { label: 'Female', value: (t?.totalTeachersFemale ?? 0).toLocaleString(), icon: User },
            ]}
          />
          <KpiCard
            title="Total Students"
            value={t?.totalStudents ?? 0}
            icon={GraduationCap}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            href={detailHref('students')}
            stats={[
              { label: 'Boys', value: (t?.totalStudentsBoys ?? 0).toLocaleString(), icon: User },
              { label: 'Girls', value: (t?.totalStudentsGirls ?? 0).toLocaleString(), icon: User },
              { label: 'PWD', value: (t?.totalPWD ?? 0).toLocaleString(), icon: User },
              { label: 'Ethnic', value: (t?.totalEthnic ?? 0).toLocaleString(), icon: Globe },
            ]}
          />
          <KpiCard
            title="Yearly Student Target"
            value={t?.yearlyStudentTarget ?? 0}
            icon={Target}
            gradient="bg-gradient-to-br from-cyan-500 to-cyan-700"
            pctVal={Number(pct(t?.totalStudents ?? 0, t?.yearlyStudentTarget ?? 0))}
            href={detailHref('student-target')}
          />
        </div>

        {/* KPI Row 2 — Revenue */}
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <KpiCard
            title="Budget Revenue Target"
            value={t?.budgetRevenueTarget ?? 0}
            valueDisplay={fmtTaka(t?.budgetRevenueTarget ?? 0)}
            icon={TakaIcon}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            href={detailHref('budget-target')}
          />
          <KpiCard
            title="Budget Revenue Achievement"
            value={t?.budgetRevenueAchievement ?? 0}
            valueDisplay={fmtTaka(t?.budgetRevenueAchievement ?? 0)}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-teal-500 to-teal-700"
            pctVal={Number(pct(t?.budgetRevenueAchievement ?? 0, t?.budgetRevenueTarget ?? 0))}
            href={detailHref('budget-achievement')}
          />
          <KpiCard
            title="Actual Revenue Target"
            value={t?.actualRevenueTarget ?? 0}
            valueDisplay={fmtTaka(t?.actualRevenueTarget ?? 0)}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-orange-500 to-orange-700"
            href={detailHref('actual-target')}
          />
          <KpiCard
            title="Actual Revenue Achievement"
            value={t?.actualRevenueAchievement ?? 0}
            valueDisplay={fmtTaka(t?.actualRevenueAchievement ?? 0)}
            icon={Sparkles}
            gradient="bg-gradient-to-br from-rose-500 to-rose-700"
            pctVal={Number(pct(t?.actualRevenueAchievement ?? 0, t?.actualRevenueTarget ?? 0))}
            href={detailHref('actual-achievement')}
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
                />
              ))}
          </div>
        </div>

        {/* Schools list */}
        <div className={`transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
          <SchoolsListTable
            schools={data?.schools ?? []}
            onRowClick={(id) => router.push(`/data-collection/school-information?school=${id}`)}
          />
        </div>
      </div>
    </>
  );
}
