'use client';

import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileSpreadsheet, Search } from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────── */

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
  totals: Record<string, number>;
  categories: Record<string, unknown>;
  schools: SchoolRow[];
}

/* ─── Constants ─────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
  Unknown: 'Uncategorized',
};

const fmtTaka = (n: number) => `৳${Math.round(n || 0).toLocaleString('en-IN')}`;

const signedTaka = (n: number) => `${n < 0 ? '-' : ''}${fmtTaka(Math.abs(n))}`;

/** Billed to actually-enrolled students but not yet collected; over-collection reports as zero. */
const dues = (s: SchoolRow) => Math.max(s.actualRevenueTarget - s.actualRevenueAchievement, 0);

/** Budget variance against the planned target — negative means a shortfall. */
const deficit = (s: SchoolRow) => s.actualRevenueAchievement - s.budgetRevenueTarget;

const pctRaw = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

/* ─── Column definitions ──────────────────────────────── */

type Align = 'left' | 'right';

interface Column {
  key: string;
  label: string;
  align: Align;
  /** raw value used for export + sorting */
  value: (s: SchoolRow) => string | number;
  /** optional rich cell for display */
  cell?: (s: SchoolRow) => React.ReactNode;
  /** whether this numeric column should be summed in the footer */
  sum?: boolean;
  /** whether the summed footer value should be formatted as currency */
  money?: boolean;
}

interface MetricConfig {
  title: string;
  description: string;
  columns: Column[];
}

const schoolCol: Column = {
  key: 'school',
  label: 'School',
  align: 'left',
  value: (s) => `${s.name} (${s.code})`,
  cell: (s) => (
    <div>
      <p className="font-medium text-gray-800 leading-tight">{s.name}</p>
      <p className="font-mono text-xs text-gray-400">{s.code}</p>
    </div>
  ),
};

const categoryCol: Column = {
  key: 'category',
  label: 'Category',
  align: 'left',
  value: (s) => catLabel(s.category),
  cell: (s) => (
    <Badge variant="default" className="border-indigo-200 bg-indigo-50 text-indigo-700">
      {catLabel(s.category)}
    </Badge>
  ),
};

const achievementCell = (ach: number, target: number): React.ReactNode => {
  const p = pctRaw(ach, target);
  const color = p >= 80 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : 'text-red-500';
  return (
    <span>
      <span className={`font-semibold ${color}`}>{fmtTaka(ach)}</span>
      <span className="ml-1 text-gray-400">({p.toFixed(1)}%)</span>
    </span>
  );
};

const METRICS: Record<string, MetricConfig> = {
  schools: {
    title: 'Total Schools',
    description: 'Every school included in the programme and counted in the Total Schools figure.',
    columns: [
      schoolCol,
      categoryCol,
      { key: 'division', label: 'Division', align: 'left', value: (s) => s.division ?? '—' },
      { key: 'district', label: 'District', align: 'left', value: (s) => s.district ?? '—' },
    ],
  },
  teachers: {
    title: 'Total Teachers',
    description: 'Teacher counts per school that make up the total teachers figure.',
    columns: [
      schoolCol,
      categoryCol,
      { key: 'male', label: 'Male Teachers', align: 'right', value: (s) => s.teachers.male, sum: true },
      { key: 'female', label: 'Female Teachers', align: 'right', value: (s) => s.teachers.female, sum: true },
      { key: 'total', label: 'Total Teachers', align: 'right', value: (s) => s.teachers.total, sum: true },
    ],
  },
  students: {
    title: 'Total Students',
    description: 'Student enrolment per school (boys, girls, PWD and ethnic minority) behind the total students figure.',
    columns: [
      schoolCol,
      categoryCol,
      { key: 'boys', label: 'Boys', align: 'right', value: (s) => s.students.boys, sum: true },
      { key: 'girls', label: 'Girls', align: 'right', value: (s) => s.students.girls, sum: true },
      { key: 'pwd', label: 'PWD', align: 'right', value: (s) => s.students.pwd, sum: true },
      { key: 'ethnic', label: 'Ethnic', align: 'right', value: (s) => s.students.ethnic, sum: true },
      { key: 'total', label: 'Total Students', align: 'right', value: (s) => s.students.total, sum: true },
    ],
  },
  'student-target': {
    title: 'Yearly Student Target',
    description: 'Yearly student intake target per school versus current enrolment.',
    columns: [
      schoolCol,
      categoryCol,
      { key: 'current', label: 'Current Students', align: 'right', value: (s) => s.students.total, sum: true },
      { key: 'target', label: 'Yearly Target', align: 'right', value: (s) => s.yearlyStudentTarget, sum: true },
      {
        key: 'achieved', label: 'Achieved %', align: 'right',
        value: (s) => Number(pctRaw(s.students.total, s.yearlyStudentTarget).toFixed(1)),
        cell: (s) => {
          const p = pctRaw(s.students.total, s.yearlyStudentTarget);
          const color = p >= 80 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : 'text-red-500';
          return <span className={`font-semibold ${color}`}>{p.toFixed(1)}%</span>;
        },
      },
    ],
  },
  'budget-target': {
    title: 'Planned Revenue Target',
    description:
      'Planned revenue target per school — from the AOP plan (target students × fee structure, no discounts) when set; otherwise the reported budget form or the auto-calculated fee plan.',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'budgetTarget', label: 'Planned Target', align: 'right',
        value: (s) => s.budgetRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-700">{fmtTaka(s.budgetRevenueTarget)}</span>,
      },
    ],
  },
  'budget-achievement': {
    title: 'Budget Revenue Achievement',
    description: 'Budgeted revenue achieved per school versus its target.',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'budgetTarget', label: 'Budget Target', align: 'right',
        value: (s) => s.budgetRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.budgetRevenueTarget)}</span>,
      },
      {
        key: 'budgetAch', label: 'Achievement', align: 'right',
        value: (s) => s.budgetRevenueAchievement, sum: true, money: true,
        cell: (s) => achievementCell(s.budgetRevenueAchievement, s.budgetRevenueTarget),
      },
    ],
  },
  'actual-target': {
    title: 'Actual Revenue Target',
    description: 'Actual revenue target per school (sum of all fee heads) behind the total actual target.',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'actualTarget', label: 'Actual Target', align: 'right',
        value: (s) => s.actualRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-700">{fmtTaka(s.actualRevenueTarget)}</span>,
      },
    ],
  },
  'actual-achievement': {
    title: 'Actual Collected Revenue',
    description: 'Actual revenue achieved per school versus its target.',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'actualTarget', label: 'Actual Target', align: 'right',
        value: (s) => s.actualRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.actualRevenueTarget)}</span>,
      },
      {
        key: 'actualAch', label: 'Achievement', align: 'right',
        value: (s) => s.actualRevenueAchievement, sum: true, money: true,
        cell: (s) => achievementCell(s.actualRevenueAchievement, s.actualRevenueTarget),
      },
    ],
  },
  'outstanding-dues': {
    title: 'Total Outstanding Due',
    description:
      'Fees billed to the students actually enrolled but not yet collected — Actual Revenue Target − revenue collected, floored at ৳0 (over-collection reports as zero dues).',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'actualTarget', label: 'Actual Target', align: 'right',
        value: (s) => s.actualRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.actualRevenueTarget)}</span>,
      },
      {
        key: 'collected', label: 'Collected', align: 'right',
        value: (s) => s.actualRevenueAchievement, sum: true, money: true,
        cell: (s) => achievementCell(s.actualRevenueAchievement, s.actualRevenueTarget),
      },
      {
        key: 'dues', label: 'Outstanding Due', align: 'right',
        value: (s) => dues(s), sum: true, money: true,
        cell: (s) => (
          <span className={`font-semibold ${dues(s) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmtTaka(dues(s))}
          </span>
        ),
      },
    ],
  },
  'collection-rate': {
    title: '% of Collection',
    description:
      'Share of billed revenue actually collected per school — payments received ÷ fees generated (auto-calculated from the Fee Collection module).',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'actualTarget', label: 'Billed (Target)', align: 'right',
        value: (s) => s.actualRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.actualRevenueTarget)}</span>,
      },
      {
        key: 'collected', label: 'Collected', align: 'right',
        value: (s) => s.actualRevenueAchievement, sum: true, money: true,
        cell: (s) => achievementCell(s.actualRevenueAchievement, s.actualRevenueTarget),
      },
      {
        key: 'rate', label: '% of Collection', align: 'right',
        value: (s) => Number(pctRaw(s.actualRevenueAchievement, s.actualRevenueTarget).toFixed(1)),
        cell: (s) => {
          const p = pctRaw(s.actualRevenueAchievement, s.actualRevenueTarget);
          const color = p >= 80 ? 'text-green-600' : p >= 70 ? 'text-amber-600' : 'text-red-500';
          return (
            <span className={`font-semibold ${color}`}>
              {s.actualRevenueTarget > 0 ? `${p.toFixed(1)}%` : 'n/a'}
            </span>
          );
        },
      },
      {
        key: 'dues', label: 'Outstanding Due', align: 'right',
        value: (s) => dues(s), sum: true, money: true,
        cell: (s) => (
          <span className={`font-semibold ${dues(s) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmtTaka(dues(s))}
          </span>
        ),
      },
    ],
  },
  'revenue-gap': {
    title: 'Outstanding Dues & Revenue Deficit',
    description:
      'Outstanding dues = Actual Revenue Target − revenue collected (money billed to enrolled students but not yet received). Revenue deficit = revenue collected − Planned Revenue Target, shown with negative marking. The deficit is the enrolment/target gap plus the outstanding dues.',
    columns: [
      schoolCol,
      categoryCol,
      {
        key: 'plannedTarget', label: 'Planned Target', align: 'right',
        value: (s) => s.budgetRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.budgetRevenueTarget)}</span>,
      },
      {
        key: 'actualTarget', label: 'Actual Target', align: 'right',
        value: (s) => s.actualRevenueTarget, sum: true, money: true,
        cell: (s) => <span className="text-gray-600">{fmtTaka(s.actualRevenueTarget)}</span>,
      },
      {
        key: 'collected', label: 'Collected', align: 'right',
        value: (s) => s.actualRevenueAchievement, sum: true, money: true,
        cell: (s) => achievementCell(s.actualRevenueAchievement, s.actualRevenueTarget),
      },
      {
        key: 'dues', label: 'Outstanding Dues', align: 'right',
        value: (s) => dues(s), sum: true, money: true,
        cell: (s) => (
          <span className={`font-semibold ${dues(s) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmtTaka(dues(s))}
          </span>
        ),
      },
      {
        key: 'deficit', label: 'Revenue Deficit', align: 'right',
        value: (s) => deficit(s), sum: true, money: true,
        cell: (s) => (
          <span className={`font-semibold ${deficit(s) < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {signedTaka(deficit(s))}
          </span>
        ),
      },
    ],
  },
};

/* ─── Export helpers ────────────────────────────── */

function triggerDownload(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSV formula-injection defence: spreadsheet apps execute cells starting
// with = + - @ or tab/CR as formulas (=WEBSERVICE(...) can exfiltrate data).
// Prefix them so they are treated as text; genuine negative numbers pass.
const sanitizeCsvCell = (v: string): string => {
  if (/^[-=+@\t\r]/.test(v) && !/^-\d+(\.\d+)?$/.test(v)) return `'${v}`;
  return v;
};
const escapeCsv = (v: string | number) => {
  const safe = sanitizeCsvCell(String(v));
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const escapeHtml = (v: string | number) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─── Page ────────────────────────────────────────────── */

export default function ProgrammeMetricDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const metric = String(params?.metric ?? '');
  const category = searchParams.get('category') ?? '';
  const academicYear = searchParams.get('academicYear') ?? '';
  const config = METRICS[metric];

  const [search, setSearch] = useState('');

  const { data: schools = [], isFetching: loading } = useQuery({
    queryKey: ['programme-overview-schools', category, academicYear],
    queryFn: () =>
      api
        .get('/data-collection/programme-overview', {
          params: {
            ...(category ? { category } : {}),
            ...(academicYear ? { academicYear } : {}),
          },
        })
        .then(({ data }: { data: OverviewData }) => data.schools ?? []),
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    if (!search) return schools;
    const q = search.toLowerCase();
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        catLabel(s.category).toLowerCase().includes(q),
    );
  }, [schools, search]);

  const footerSums = useMemo(() => {
    if (!config) return {};
    const sums: Record<string, number> = {};
    for (const col of config.columns) {
      if (col.sum) {
        sums[col.key] = filtered.reduce((acc, s) => acc + Number(col.value(s) || 0), 0);
      }
    }
    return sums;
  }, [config, filtered]);

  if (!config) {
    return (
      <>
        <Header title="Programme Overview" />
        <div className="p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-gray-500">Unknown metric “{metric}”.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/data-collection/programme-overview')}>
                Back to Programme Overview
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const fileBase = `programme-${metric}${category ? `-${category}` : ''}${academicYear ? `-${academicYear}` : ''}`;
  const headers = ['#', ...config.columns.map((c) => c.label)];

  const backQuery = new URLSearchParams();
  if (category) backQuery.set('category', category);
  if (academicYear) backQuery.set('academicYear', academicYear);
  const backHref = `/data-collection/programme-overview${backQuery.toString() ? `?${backQuery.toString()}` : ''}`;

  const exportCsv = () => {
    const lines = [headers.map(escapeCsv).join(',')];
    filtered.forEach((s, i) => {
      lines.push([i + 1, ...config.columns.map((c) => escapeCsv(c.value(s)))].join(','));
    });
    triggerDownload('\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8;', `${fileBase}.csv`);
  };

  const exportExcel = () => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const body = filtered
      .map((s, i) => {
        const cells = [i + 1, ...config.columns.map((c) => c.value(s))]
          .map((v) => `<td>${escapeHtml(v)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    const html =
      `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>` +
      `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    triggerDownload(html, 'application/vnd.ms-excel;charset=utf-8;', `${fileBase}.xls`);
  };

  return (
    <>
      <Header
        title={config.title}
        subtitle={[
          category ? catLabel(category) : null,
          academicYear ? `Academic year ${academicYear}` : null,
          'school-level breakdown',
        ].filter(Boolean).join(' • ')}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push(backHref)} className="gap-2">
            <ArrowLeft size={14} />
            Back
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <p className="text-sm text-gray-500">{config.description}</p>

        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Schools
                <Badge variant="default" className="ml-2">{filtered.length}</Badge>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search school, code or category…"
                    className="w-full rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:w-72"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length} className="gap-1.5">
                  <Download size={14} /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length} className="gap-1.5">
                  <FileSpreadsheet size={14} /> Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-gray-100 bg-gray-50">
                    <tr>
                      <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                      {config.columns.map((c) => (
                        <th
                          key={c.key}
                          className={`py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((s, idx) => (
                      <tr key={s.id} className="transition-colors hover:bg-indigo-50/30">
                        <td className="py-3 pl-5 pr-3 text-gray-400">{idx + 1}</td>
                        {config.columns.map((c) => (
                          <td
                            key={c.key}
                            className={`py-3 pr-3 ${c.align === 'right' ? 'text-right text-gray-700' : 'text-left text-gray-700'}`}
                          >
                            {c.cell ? c.cell(s) : c.value(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={config.columns.length + 1} className="py-12 text-center text-gray-400">
                          No schools found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filtered.length > 0 && Object.keys(footerSums).length > 0 && (
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr className="font-semibold text-gray-800">
                        <td className="py-3 pl-5 pr-3">Total</td>
                        {config.columns.map((c) => (
                          <td key={c.key} className={`py-3 pr-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                            {c.sum
                              ? c.money
                                ? signedTaka(footerSums[c.key])
                                : footerSums[c.key].toLocaleString()
                              : ''}
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
      </div>
    </>
  );
}
