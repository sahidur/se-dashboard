'use client';

import { Fragment, useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt, TrendingUp, AlertTriangle, Target, Wallet } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  formatBDT,
  monthName,
} from '@/components/fee/filters';

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface RevenueHeadCell {
  planned: number;
  collected: number;
  due: number;
}

interface RevenueHeadRow {
  feeHeadId: string;
  feeHeadName: string;
  months: Record<number, RevenueHeadCell>;
  total: { planned: number; collected: number; due: number; collectionPct: number | null };
}

interface RevenueReport {
  heads: RevenueHeadRow[];
  months: { month: number; planned: number; collected: number; due: number; collectionPct: number | null }[];
  totals: {
    planned: number;
    collected: number;
    due: number;
    collectionPct: number | null;
    deficit: number;
  };
}

function KpiCard({
  title, value, icon: Icon, tone, sub,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  tone: string;
  sub?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>
            <Icon size={15} />
          </span>
        </div>
        <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-2xl">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const pctClass = (p: number | null | undefined) =>
  p == null ? 'text-gray-400' : p >= 80 ? 'text-emerald-600' : p >= 70 ? 'text-amber-600' : 'text-red-600';

const pctText = (p: number | null | undefined) => (p == null ? '—' : `${p.toFixed(1)}%`);

/* Month group header colours — one distinct pastel per month so month columns
   are instantly recognisable when scanning the wide matrix. */
const MONTH_HEADER: string[] = [
  'bg-indigo-200 text-indigo-900',
  'bg-sky-200 text-sky-900',
  'bg-teal-200 text-teal-900',
  'bg-emerald-200 text-emerald-900',
  'bg-lime-200 text-lime-900',
  'bg-amber-200 text-amber-900',
  'bg-orange-200 text-orange-900',
  'bg-rose-200 text-rose-900',
  'bg-fuchsia-200 text-fuchsia-900',
  'bg-violet-200 text-violet-900',
  'bg-cyan-200 text-cyan-900',
  'bg-blue-200 text-blue-900',
];
const monthHeader = (m: number) => MONTH_HEADER[(m - 1) % MONTH_HEADER.length];

/* Target vs Collected column tints — consistent across header, body and totals. */
const TARGET_TH = 'bg-blue-100 text-blue-900';
const COLLECTED_TH = 'bg-emerald-100 text-emerald-900';
const TARGET_TD = 'bg-blue-50/60 text-blue-900';
const COLLECTED_TD = 'bg-emerald-50/60 text-emerald-900';

export default function RevenueReportPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  // Month multi-select — the tables/KPIs only cover the selected months. Empty = all.
  const [selectedMonths, setSelectedMonths] = useState<number[]>(ALL_MONTHS);

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

  const { data, isFetching: loading, error: queryError } = useQuery({
    queryKey: ['revenue-report', activeSchoolId, activeYearId],
    queryFn: () =>
      api
        .get(`/finance-reports/revenue?schoolId=${activeSchoolId}&academicYearId=${activeYearId}`)
        .then(({ data: d }) => d as RevenueReport),
    enabled: !!activeSchoolId && !!activeYearId,
    placeholderData: keepPreviousData,
  });
  const error = queryError ? getErrorMessage(queryError, 'Failed to load revenue report') : '';

  const months = selectedMonths.length ? [...selectedMonths].sort((a, b) => a - b) : ALL_MONTHS;

  // Everything recomputed dynamically over the selected months
  const view = useMemo(() => {
    const rows = data?.heads ?? [];
    const heads = rows.map((h) => {
      let planned = 0;
      let collected = 0;
      for (const m of months) {
        planned += h.months[m]?.planned ?? 0;
        collected += h.months[m]?.collected ?? 0;
      }
      planned = Math.round(planned * 100) / 100;
      collected = Math.round(collected * 100) / 100;
      return {
        ...h,
        filteredTotal: {
          planned,
          collected,
          due: Math.max(Math.round((planned - collected) * 100) / 100, 0),
          collectionPct: planned > 0 ? Math.round(Math.min(100, (collected / planned) * 100) * 100) / 100 : null,
        },
      };
    });
    const planned = Math.round(heads.reduce((s, h) => s + h.filteredTotal.planned, 0) * 100) / 100;
    const collected = Math.round(heads.reduce((s, h) => s + h.filteredTotal.collected, 0) * 100) / 100;
    const due = Math.max(Math.round((planned - collected) * 100) / 100, 0);
    const totals = {
      planned,
      collected,
      due,
      collectionPct: planned > 0 ? Math.round(Math.min(100, (collected / planned) * 100) * 100) / 100 : null,
      deficit: Math.round((collected - planned) * 100) / 100,
    };
    const plannedSum: Record<number, number> = {};
    const collectedSum: Record<number, number> = {};
    for (const m of months) {
      plannedSum[m] = heads.reduce((s, h) => s + (h.months[m]?.planned ?? 0), 0);
      collectedSum[m] = heads.reduce((s, h) => s + (h.months[m]?.collected ?? 0), 0);
    }
    return { heads, totals, plannedSum, collectedSum };
  }, [data, months]);

  const t = view.totals;
  const allSelected = selectedMonths.length === ALL_MONTHS.length;

  const toggleMonth = (m: number) =>
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );

  return (
    <>
      <Header
        title="Actual Target vs Actual Collected"
        subtitle="Auto-calculated from the fee collection module — actual target = fees generated, actual collected = payments received"
      />
      <div className="page-container space-y-4">
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
              <Select label="Academic Year" value={activeYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            </div>
            {/* Month multi-select — tables and KPI cards show only the selected months */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">
                  Filter Months <span className="ml-1 font-normal text-gray-400">({allSelected ? 'all selected' : `${months.length} selected`})</span>
                </p>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-amber-600 hover:underline" onClick={() => setSelectedMonths(ALL_MONTHS)}>All Months</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" className="text-gray-400 hover:underline" onClick={() => setSelectedMonths([])}>Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_MONTHS.map((m) => {
                  const selected = selectedMonths.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {monthName(m).slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                The tables and totals show only the selected months — clear all to show every month again.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {/* KPI cards — recomputed over the selected months */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Actual Revenue Target</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-600"><Target size={15} /></span>
              </div>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">BDT {formatBDT(t.planned)}</p>
              <p className="mt-0.5 text-xs text-gray-400">Total fees generated {allSelected ? 'for the year' : 'for selected months'}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Actual Revenue Collected</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Wallet size={15} /></span>
              </div>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">BDT {formatBDT(t.collected)}</p>
              <p className="mt-0.5 text-xs text-gray-400">Payments received</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">% of Collection</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><TrendingUp size={15} /></span>
              </div>
              <p className={`mt-1.5 text-lg font-bold tabular-nums sm:text-xl ${pctClass(t.collectionPct)}`}>
                {t.collectionPct == null ? 'n/a' : `${t.collectionPct.toFixed(1)}%`}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">Collected ÷ actual target</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Outstanding Dues</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><AlertTriangle size={15} /></span>
              </div>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-red-600 sm:text-xl">BDT {formatBDT(t.due)}</p>
              <p className="mt-0.5 text-xs text-gray-400">Actual target − collected</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Revenue Deficit</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><Receipt size={15} /></span>
              </div>
              <p className={`mt-1.5 text-lg font-bold tabular-nums sm:text-xl ${t.deficit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {t.deficit < 0 ? '-' : ''}BDT {formatBDT(Math.abs(t.deficit))}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{t.deficit < 0 ? 'Short of the target' : 'Target met'}</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : !data || view.heads.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Receipt size={40} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400">No fee data — generate monthly fees for this school first</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Per fee head — monthly actual target vs actual collected matrix */}
            <Card>
              <CardContent className="p-0">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-800">Per Fee Head — Actual target vs Actual Collected (Monthly)</h3>
                  <p className="text-xs text-gray-400">
                    Actual target = fees generated on student fee records · Actual collected = payments received (per-head allocations)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="modern-table text-xs">
                    <thead>
                      <tr className="border-b text-xs uppercase">
                        <th rowSpan={2} className="sticky left-0 z-10 bg-indigo-200 px-4 py-2 text-left font-bold text-indigo-900">Fee Head</th>
                        {months.map((m) => (
                          <th key={m} colSpan={2} className={`border-l border-white/60 px-3 py-2 text-center font-bold ${monthHeader(m)}`}>
                            {monthName(m).slice(0, 3)}
                          </th>
                        ))}
                        <th colSpan={3} className="border-l border-white/60 bg-gray-800 px-3 py-2 text-center font-bold text-white">Total</th>
                      </tr>
                      <tr className="border-b text-[10px] uppercase">
                        {months.map((m) => (
                          <Fragment key={m}>
                            <th className={`border-l border-white/60 px-2 py-1.5 text-right font-bold ${TARGET_TH}`}>Target</th>
                            <th className={`px-2 py-1.5 text-right font-bold ${COLLECTED_TH}`}>Collected</th>
                          </Fragment>
                        ))}
                        <th className="border-l border-white/60 bg-blue-200 px-2 py-1.5 text-right font-bold text-blue-900">Target</th>
                        <th className="bg-emerald-200 px-2 py-1.5 text-right font-bold text-emerald-900">Collected</th>
                        <th className="bg-gray-200 px-2 py-1.5 text-right font-bold text-gray-800">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {view.heads.map((h) => {
                        const pct = h.filteredTotal.collectionPct;
                        return (
                          <tr key={h.feeHeadId} className="hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-white px-4 py-2 text-xs font-medium text-gray-800">
                              {h.feeHeadName}
                            </td>
                            {months.map((m) => {
                              const c = h.months[m];
                              return (
                                <Fragment key={m}>
                                  <td className={`border-l border-gray-100 px-2 py-2 text-right text-xs tabular-nums ${TARGET_TD} ${c ? '' : 'opacity-60'}`}>
                                    {c ? formatBDT(c.planned) : '-'}
                                  </td>
                                  <td className={`px-2 py-2 text-right text-xs ${COLLECTED_TD} ${c && c.collected > 0 ? 'font-medium' : 'opacity-40'}`}>
                                    {c && c.collected > 0 ? formatBDT(c.collected) : '—'}
                                  </td>
                                </Fragment>
                              );
                            })}
                            <td className="border-l bg-blue-100 px-2 py-2 text-right text-xs font-semibold text-blue-900">{formatBDT(h.filteredTotal.planned)}</td>
                            <td className="bg-emerald-100 px-2 py-2 text-right text-xs font-semibold text-emerald-900">{formatBDT(h.filteredTotal.collected)}</td>
                            <td className={`bg-gray-100 px-2 py-2 text-right text-xs font-bold ${pctClass(pct)}`}>
                              {pct == null ? '—' : `${pct.toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="sticky left-0 z-10 bg-gray-800 px-4 py-2 text-xs font-bold uppercase text-white">Total</td>
                        {months.map((m) => (
                          <Fragment key={m}>
                            <td className="border-l border-gray-200 bg-blue-100 px-2 py-2 text-right text-xs text-blue-900">{formatBDT(view.plannedSum[m])}</td>
                            <td className="bg-emerald-100 px-2 py-2 text-right text-xs text-emerald-900">{formatBDT(view.collectedSum[m])}</td>
                          </Fragment>
                        ))}
                        <td className="border-l bg-blue-200 px-2 py-2 text-right text-xs font-bold text-blue-900">{formatBDT(t.planned)}</td>
                        <td className="bg-emerald-200 px-2 py-2 text-right text-xs font-bold text-emerald-900">{formatBDT(t.collected)}</td>
                        <td className="bg-gray-200 px-2 py-2 text-right text-xs font-bold text-gray-900">
                          {t.collectionPct == null ? '—' : `${t.collectionPct.toFixed(1)}%`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}