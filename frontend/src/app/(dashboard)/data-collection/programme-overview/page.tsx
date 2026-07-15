'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  School, Users, GraduationCap, TrendingUp, TrendingDown, DollarSign,
  Filter, RefreshCw, ArrowUpRight, ArrowDownRight,
  BarChart3, Target, Sparkles,
} from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────── */

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

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  category: string;
  district?: string;
  division?: string;
  teachers: { male: number; female: number; total: number };
  students: { boys: number; girls: number; total: number; pwd: number; ethnic: number };
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

/* ─── Constants ─────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'brac_primary', label: 'BRAC Primary' },
  { value: 'brac_secondary', label: 'BRAC Secondary' },
  { value: 'brac_academy', label: 'BRAC Academy' },
];

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
  Unknown: 'Uncategorized',
};

const CATEGORY_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const fmtTaka = (n: number) =>
  n >= 10_000_000 ? `৳${(n / 10_000_000).toFixed(2)} Cr` :
  n >= 100_000 ? `৳${(n / 100_000).toFixed(1)} L` :
  n >= 1_000 ? `৳${(n / 1_000).toFixed(1)}K` : `৳${n}`;

const pct = (a: number, b: number) => (b > 0 ? Math.min((a / b) * 100, 100).toFixed(1) : '0');

/* ─── Animated Counter ─────────────────────────────────── */

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
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
  return <span>{prefix}{display.toLocaleString()}</span>;
}

/* ─── KPI Card ─────────────────────────────────────────── */

function KpiCard({
  title, value, sub, icon: Icon, gradient, badge, pctVal,
}: {
  title: string; value: number; sub?: string; icon: React.ElementType;
  gradient: string; badge?: string; pctVal?: number;
}) {
  return (
    <Card className={`relative overflow-hidden border-0 shadow-md ${gradient}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-white/80 uppercase tracking-wider">{title}</p>
            <p className="mt-1 text-3xl font-bold text-white">
              <AnimatedNumber value={value} />
            </p>
            {sub && <p className="mt-0.5 text-xs text-white/70">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Icon size={20} className="text-white" />
          </div>
        </div>
        {pctVal !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1">
              <span>Achievement</span>
              <span>{pctVal}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20">
              <div
                className="h-1.5 rounded-full bg-white transition-all duration-1000"
                style={{ width: `${Math.min(Number(pctVal), 100)}%` }}
              />
            </div>
          </div>
        )}
        {badge && (
          <div className="mt-2">
            <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">{badge}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Custom tooltip ───────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-700">{typeof p.value === 'number' && p.value > 1000 ? fmtTaka(p.value) : p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

export default function ProgrammeOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/data-collection/programme-overview', { params: category ? { category } : {} })
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const schools = data?.schools ?? [];
  const categories = data?.categories ?? {};

  /* Chart data */
  const categoryChartData = Object.entries(categories).map(([cat, vals], idx) => ({
    name: CATEGORY_LABELS[cat] ?? cat,
    schools: vals.totalSchools,
    students: vals.totalStudents,
    teachers: vals.totalTeachers,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  const teacherGenderData = t ? [
    { name: 'Male', value: t.totalTeachersMale, fill: '#6366f1' },
    { name: 'Female', value: t.totalTeachersFemale, fill: '#ec4899' },
  ] : [];

  const studentBreakdownData = t ? [
    { name: 'Boys', value: t.totalStudentsBoys, fill: '#3b82f6' },
    { name: 'Girls', value: t.totalStudentsGirls, fill: '#f472b6' },
    { name: 'PWD', value: t.totalPWD, fill: '#f59e0b' },
    { name: 'Ethnic', value: t.totalEthnic, fill: '#10b981' },
  ] : [];

  const revenueBarData = Object.entries(categories).map(([cat, vals]) => ({
    name: CATEGORY_LABELS[cat] ?? cat,
    'Budget Target': vals.budgetRevenueTarget,
    'Budget Achievement': vals.budgetRevenueAchievement,
    'Actual Target': vals.actualRevenueTarget,
    'Actual Achievement': vals.actualRevenueAchievement,
  }));

  const schoolsBarData = schools.slice(0, 15).map((s) => ({
    name: s.code,
    fullName: s.name,
    students: s.students.total,
    teachers: s.teachers.total,
  }));

  const filteredSchools = schools.filter(
    (s) =>
      !schoolSearch ||
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(schoolSearch.toLowerCase()),
  );

  if (loading) {
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
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Filter size={14} />
                Filter by:
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCategory(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      category === opt.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-xs text-gray-400">
                {t?.totalSchools ?? 0} school{(t?.totalSchools ?? 0) !== 1 ? 's' : ''} shown
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Row 1 — Schools & Teachers */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Schools"
            value={t?.totalSchools ?? 0}
            icon={School}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
            badge={`${Object.keys(categories).length} categories`}
          />
          <KpiCard
            title="Total Teachers"
            value={t?.totalTeachers ?? 0}
            sub={`${t?.totalTeachersMale ?? 0} Male · ${t?.totalTeachersFemale ?? 0} Female`}
            icon={Users}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          />
          <KpiCard
            title="Total Students"
            value={t?.totalStudents ?? 0}
            sub={`${t?.totalStudentsBoys ?? 0} Boys · ${t?.totalStudentsGirls ?? 0} Girls`}
            icon={GraduationCap}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          />
          <KpiCard
            title="Yearly Student Target"
            value={t?.yearlyStudentTarget ?? 0}
            sub={`${pct(t?.totalStudents ?? 0, t?.yearlyStudentTarget ?? 0)}% achieved`}
            icon={Target}
            gradient="bg-gradient-to-br from-cyan-500 to-cyan-700"
            pctVal={Number(pct(t?.totalStudents ?? 0, t?.yearlyStudentTarget ?? 0))}
          />
        </div>

        {/* KPI Row 2 — Revenue */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Budget Revenue Target"
            value={t?.budgetRevenueTarget ?? 0}
            sub={fmtTaka(t?.budgetRevenueTarget ?? 0)}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          />
          <KpiCard
            title="Budget Revenue Achievement"
            value={t?.budgetRevenueAchievement ?? 0}
            sub={`${pct(t?.budgetRevenueAchievement ?? 0, t?.budgetRevenueTarget ?? 0)}% of target`}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-teal-500 to-teal-700"
            pctVal={Number(pct(t?.budgetRevenueAchievement ?? 0, t?.budgetRevenueTarget ?? 0))}
          />
          <KpiCard
            title="Actual Revenue Target"
            value={t?.actualRevenueTarget ?? 0}
            sub={fmtTaka(t?.actualRevenueTarget ?? 0)}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          />
          <KpiCard
            title="Actual Revenue Achievement"
            value={t?.actualRevenueAchievement ?? 0}
            sub={`${pct(t?.actualRevenueAchievement ?? 0, t?.actualRevenueTarget ?? 0)}% of target`}
            icon={Sparkles}
            gradient="bg-gradient-to-br from-rose-500 to-rose-700"
            pctVal={Number(pct(t?.actualRevenueAchievement ?? 0, t?.actualRevenueTarget ?? 0))}
          />
        </div>

        {/* PWD + Ethnic highlight row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Users size={22} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Students with Disability (PWD)</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  <AnimatedNumber value={t?.totalPWD ?? 0} />
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pct(t?.totalPWD ?? 0, t?.totalStudents ?? 0)}% of total students
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                <Sparkles size={22} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Ethnic Minority Students</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  <AnimatedNumber value={t?.totalEthnic ?? 0} />
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pct(t?.totalEthnic ?? 0, t?.totalStudents ?? 0)}% of total students
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Category distribution — schools */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Schools by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryChartData} dataKey="schools" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {categoryChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {categoryChartData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-gray-600">
                    <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    {entry.name}: <strong>{entry.schools}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Teacher gender */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Teacher Gender Distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={teacherGenderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                    {teacherGenderData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4">
                {teacherGenderData.map((d) => (
                  <div key={d.name} className="text-center">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <div className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                      {d.name}
                    </div>
                    <p className="font-bold text-gray-800">{d.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Student breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Student Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart cx="50%" cy="50%" innerRadius={20} outerRadius={90} data={studentBreakdownData}>
                  <RadialBar dataKey="value" background>
                    {studentBreakdownData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </RadialBar>
                  <Tooltip content={<ChartTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {studentBreakdownData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="text-gray-500">{d.name}:</span>
                    <span className="font-semibold text-gray-700">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 — Category comparison bars */}
        {categoryChartData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Students & Teachers by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="students" name="Students" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="teachers" name="Teachers" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Revenue chart */}
        {revenueBarData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Revenue — Target vs Achievement by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtTaka(v).replace('৳', '')} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Budget Target" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Budget Achievement" fill="#34d399" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual Target" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual Achievement" fill="#fbbf24" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top schools by student count */}
        {schoolsBarData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Schools — Students & Teachers (top 15)</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={schoolsBarData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={(props) => {
                    const p = props as any;
                    if (!p.active || !p.payload?.length) return null;
                    const row = schoolsBarData.find((s) => s.name === p.label);
                    return (
                      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-xs">
                        <p className="mb-1 font-semibold text-gray-700">{row?.fullName ?? p.label}</p>
                        {p.payload.map((pl: any) => (
                          <div key={pl.name} className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: pl.color }} />
                            <span className="text-gray-500">{pl.name}:</span>
                            <span className="font-semibold">{pl.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="students" name="Students" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="teachers" name="Teachers" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* School Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">
                All Schools
                <Badge variant="default" className="ml-2">{filteredSchools.length}</Badge>
              </CardTitle>
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search school name or code…"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:w-64"
              />
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-y border-gray-100 bg-gray-50">
                  <tr>
                    <th className="py-2.5 pl-5 pr-3 text-left font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="py-2.5 pr-3 text-left font-semibold text-gray-500 uppercase tracking-wider">School</th>
                    <th className="py-2.5 pr-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Male T.</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Female T.</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Boys</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Girls</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">PWD</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Ethnic</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Student Target</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Budget Target</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Budget Ach.</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Actual Target</th>
                    <th className="py-2.5 pr-3 text-right font-semibold text-gray-500 uppercase tracking-wider">Actual Ach.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSchools.map((school, idx) => {
                    const budgetPct = Number(pct(school.budgetRevenueAchievement, school.budgetRevenueTarget));
                    const actualPct = Number(pct(school.actualRevenueAchievement, school.actualRevenueTarget));
                    return (
                      <tr key={school.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 pl-5 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-3 pr-3">
                          <div>
                            <p className="font-medium text-gray-800 leading-tight">{school.name}</p>
                            <p className="text-gray-400 font-mono">{school.code}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant="default" className="text-indigo-700 border-indigo-200 bg-indigo-50">
                            {CATEGORY_LABELS[school.category] ?? school.category}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.teachers.male}</td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.teachers.female}</td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.students.boys}</td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.students.girls}</td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.students.pwd}</td>
                        <td className="py-3 pr-3 text-right text-gray-700">{school.students.ethnic}</td>
                        <td className="py-3 pr-3 text-right font-medium text-gray-700">{school.yearlyStudentTarget.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right text-gray-600">{fmtTaka(school.budgetRevenueTarget)}</td>
                        <td className="py-3 pr-3 text-right">
                          <span className={`font-medium ${budgetPct >= 80 ? 'text-green-600' : budgetPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                            {fmtTaka(school.budgetRevenueAchievement)}
                          </span>
                          <span className="ml-1 text-gray-400">({budgetPct}%)</span>
                        </td>
                        <td className="py-3 pr-3 text-right text-gray-600">{fmtTaka(school.actualRevenueTarget)}</td>
                        <td className="py-3 pr-3 text-right">
                          <span className={`font-medium ${actualPct >= 80 ? 'text-green-600' : actualPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                            {fmtTaka(school.actualRevenueAchievement)}
                          </span>
                          <span className="ml-1 text-gray-400">({actualPct}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-gray-400">
                        No schools found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
