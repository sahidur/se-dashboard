'use client';

import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ChevronDown, ChevronRight, Info, Loader2, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select, useSchools, useAcademicYears, formatBDT } from '@/components/fee/filters';
import { useAuthStore } from '@/store/auth-store';

/* ─── Types (mirror FinanceReportsService AOP interfaces) ─── */

interface AopClassFee {
  feeHeadId: string;
  feeHeadName: string;
  feeSchedule: string;
  amount: number;
  planned: number;
}

interface AopClassRow {
  classId: string;
  className: string;
  targetStudents: number;
  planned: number;
  fees: AopClassFee[];
}

interface AopSchoolRow {
  schoolId: string;
  schoolName: string;
  category: string;
  totalTargetStudents: number;
  planned: number;
  heads: { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }[];
  classes: AopClassRow[];
}

interface AopCategoryRow {
  category: string;
  totalTargetStudents: number;
  planned: number;
  heads: { feeHeadId: string; feeHeadName: string; feeSchedule: string; planned: number }[];
  schools: AopSchoolRow[];
}

interface PlannedRevenueReport {
  academicYear: { id: string; name: string } | null;
  categories: AopCategoryRow[];
}

interface AopTargetsResponse {
  classes: { classId: string; className: string; targetStudents: number }[];
}

/* ─── Constants ─── */

const CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

const CATEGORY_HEADERS: Record<string, string> = {
  brac_academy: 'bg-blue-100 text-blue-900',
  brac_primary: 'bg-amber-100 text-amber-900',
  brac_secondary: 'bg-orange-100 text-orange-900',
};

const scheduleBadge = (s: string) =>
  s === 'yearly'
    ? { label: '1× / year' }
    : s === 'half_yearly'
      ? { label: '2× / year' }
      : { label: 'monthly' };

export default function PlannedRevenuePage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission('finance-reports', 'create'));

  const [academicYearId, setAcademicYearId] = useState('');
  const [formSchoolId, setFormSchoolId] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState('');

  // Derived defaults
  const activeYearId = (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

  const { data, isFetching: loading, error: queryError } = useQuery({
    queryKey: ['planned-revenue', activeYearId],
    queryFn: () =>
      api
        .get(`/finance-reports/planned-revenue?academicYearId=${activeYearId}`)
        .then(({ data: d }) => d as PlannedRevenueReport),
    enabled: !!activeYearId,
    placeholderData: keepPreviousData,
  });
  const error = queryError ? getErrorMessage(queryError, 'Failed to load planned revenue report') : '';

  const { data: formTargets } = useQuery({
    queryKey: ['aop-targets', formSchoolId, activeYearId],
    queryFn: () =>
      api
        .get(`/finance-reports/aop-targets?schoolId=${formSchoolId}&academicYearId=${activeYearId}`)
        .then(({ data: d }) => d as AopTargetsResponse),
    enabled: !!formSchoolId && !!activeYearId,
  });

  // Seed/reset the form inputs whenever the school, year or loaded targets
// change — render-time state adjustment (no effect needed).
  const seedKey = `${formSchoolId}|${activeYearId}|${formTargets ? 'loaded' : 'pending'}`;
  const [prevSeed, setPrevSeed] = useState('');
  if (prevSeed !== seedKey) {
    setPrevSeed(seedKey);
    setTargets(
      Object.fromEntries((formTargets?.classes ?? []).map((c) => [c.classId, String(c.targetStudents)])),
    );
  }

  const saveTargets = useMutation({
    mutationFn: () =>
      api.post('/finance-reports/aop-targets', {
        schoolId: formSchoolId,
        academicYearId: activeYearId,
        lines: (formTargets?.classes ?? []).map((c) => ({
          classId: c.classId,
          targetStudents: Number(targets[c.classId] ?? 0) || 0,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planned-revenue'] });
      setSaved('AOP target students saved');
      setTimeout(() => setSaved(''), 2500);
    },
  });

  const toggleSchool = (schoolId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });

  const saveError = saveTargets.error ? getErrorMessage(saveTargets.error, 'Failed to save AOP targets') : '';

  return (
    <>
      <Header
        title="Planned Revenue Target"
        subtitle="The plan — AOP target students × fee structure per school category. No discounts, no relation to the students actually enrolled."
      />
      <div className="page-container space-y-4">
        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Academic Year"
                value={activeYearId}
                onChange={setAcademicYearId}
                placeholder="Select year"
                options={years.map((y) => ({ value: y.id, label: y.name }))}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Planned collectable = AOP target students × fee structure (all fee heads, schedule-aware). The Actual
              Revenue Target (live students with discounts) and Actual Collected live in{' '}
              <span className="font-medium text-gray-500">Actual Target vs Actual Collected</span>.
            </p>
          </CardContent>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {/* AOP Target Students entry */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Target size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Add AOP Target Students</h3>
                <p className="text-xs text-gray-400">
                  Planned student counts per class — pure plan input, multiplied by the fee structure below
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="School"
                value={formSchoolId}
                onChange={setFormSchoolId}
                placeholder="Select school"
                options={schools.map((s) => ({
                  value: s.id,
                  label: s.schoolCategory ? `${s.name} (${CATEGORY_LABELS[s.schoolCategory] ?? s.schoolCategory})` : s.name,
                }))}
              />
            </div>

            {formSchoolId && (
              <div className="mt-4">
                {formTargets && formTargets.classes.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    This school has no classes yet — add classes before setting AOP targets.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(formTargets?.classes ?? []).map((c) => (
                      <div key={c.classId} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">{c.className}</span>
                        <input
                          type="number"
                          min={0}
                          value={targets[c.classId] ?? '0'}
                          onChange={(e) => setTargets((prev) => ({ ...prev, [c.classId]: e.target.value }))}
                          disabled={!canEdit}
                          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right text-xs tabular-nums focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  {canEdit && (
                    <Button size="sm" onClick={() => saveTargets.mutate()} disabled={saveTargets.isPending || !formSchoolId}>
                      {saveTargets.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save AOP Targets
                    </Button>
                  )}
                  {saved && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 size={14} /> {saved}
                    </span>
                  )}
                  {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400">
                    <Info size={12} /> Collectable = target students × fee, without any discount
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {loading && !data ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : !data || data.categories.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Target size={40} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400">No schools found</p>
            </CardContent>
          </Card>
        ) : (
          data.categories.map((cat) => (
            <Card key={cat.category}>
              <CardContent className="p-0">
                <div className={`border-b px-4 py-3 ${CATEGORY_HEADERS[cat.category] ?? 'bg-gray-100 text-gray-900'}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-sm font-bold">{CATEGORY_LABELS[cat.category] ?? cat.category}</h3>
                    <span className="text-xs opacity-70">
                      {cat.schools.length} schools · {cat.totalTargetStudents.toLocaleString()} AOP students · Planned{' '}
                      ৳{formatBDT(cat.planned)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-70">
                    Planned collectable per school = Σ (AOP target students per class × class fee structure) — no discounts
                  </p>
                </div>

                {cat.heads.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">
                    No fee structures defined for this year yet — set up fee structures first.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="modern-table text-xs">
                      <thead>
                        <tr className="border-b text-xs uppercase">
                          <th className="sticky left-0 z-10 bg-indigo-200 px-4 py-2 text-left font-bold text-indigo-900">School</th>
                          <th className="px-3 py-2 text-right font-bold text-gray-700">AOP Students</th>
                          {cat.heads.map((h) => (
                            <th key={h.feeHeadId} className="border-l border-white/60 bg-blue-100 px-3 py-2 text-right font-bold text-blue-900">
                              {h.feeHeadName}
                            </th>
                          ))}
                          <th className="border-l border-white/60 bg-gray-800 px-3 py-2 text-right font-bold text-white">Total Planned</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {cat.schools.map((school) => {
                          const isOpen = expanded.has(school.schoolId);
                          const hasDetail = school.classes.some((c) => c.fees.length > 0);
                          return (
                            <Fragment key={school.schoolId}>
                              <tr className="hover:bg-gray-50">
                                <td className="sticky left-0 z-10 bg-white px-4 py-2 text-xs font-medium text-gray-800">
                                  {school.schoolName}
                                </td>
                                <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-gray-700">
                                  {school.totalTargetStudents.toLocaleString()}
                                </td>
                                {cat.heads.map((h) => {
                                  const cell = school.heads.find((x) => x.feeHeadId === h.feeHeadId);
                                  return (
                                    <td key={h.feeHeadId} className="border-l border-gray-100 bg-blue-50/50 px-3 py-2 text-right text-xs tabular-nums text-blue-900">
                                      {cell && cell.planned > 0 ? formatBDT(cell.planned) : '—'}
                                    </td>
                                  );
                                })}
                                <td className="border-l bg-blue-100 px-3 py-2 text-right text-xs font-bold text-blue-900">
                                  {formatBDT(school.planned)}
                                </td>
                                <td className="px-1 py-2 text-center">
                                  {hasDetail && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSchool(school.schoolId)}
                                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600"
                                    >
                                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                  )}
                                </td>
                              </tr>

                              {isOpen && (
                                <tr>
                                  <td colSpan={cat.heads.length + 4} className="bg-indigo-50/40 px-4 py-3">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                      Fee structure per class (per planned student) and planned collectable
                                    </p>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b bg-gray-50 text-[10px] uppercase text-gray-500">
                                            <th className="px-3 py-2 text-left font-semibold">Class</th>
                                            <th className="px-3 py-2 text-right font-semibold">AOP Students</th>
                                            {cat.heads.map((h) => (
                                              <th key={h.feeHeadId} className="px-3 py-2 text-right font-semibold">
                                                {h.feeHeadName}
                                                {h.feeSchedule !== 'monthly' && (
                                                  <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-semibold text-gray-500">
                                                    {scheduleBadge(h.feeSchedule).label}
                                                  </span>
                                                )}
                                              </th>
                                            ))}
                                            <th className="px-3 py-2 text-right font-semibold">Fee / student</th>
                                            <th className="px-3 py-2 text-right font-semibold">Planned</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {school.classes.map((cls) => {
                                            return (
                                              <tr key={cls.classId} className="hover:bg-white">
                                                <td className="px-3 py-2 font-medium text-gray-700">{cls.className}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{cls.targetStudents.toLocaleString()}</td>
                                                {cat.heads.map((h) => {
                                                  const f = cls.fees.find((x) => x.feeHeadId === h.feeHeadId);
                                                  return (
                                                    <td key={h.feeHeadId} className="px-3 py-2 text-right tabular-nums text-gray-700">
                                                      {f ? formatBDT(f.amount) : '—'}
                                                    </td>
                                                  );
                                                })}
                                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-800">
                                                  {formatBDT(cls.fees.reduce((s, f) => s + f.amount, 0))}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-900">
                                                  {formatBDT(cls.planned)}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                                            <td className="px-3 py-2 text-gray-700">Total</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{school.totalTargetStudents.toLocaleString()}</td>
                                            {cat.heads.map((h) => {
                                              const cell = school.heads.find((x) => x.feeHeadId === h.feeHeadId);
                                              return (
                                                <td key={h.feeHeadId} className="px-3 py-2 text-right tabular-nums text-blue-900">
                                                  {cell && cell.planned > 0 ? formatBDT(cell.planned) : '—'}
                                                </td>
                                              );
                                            })}
                                            <td className="px-3 py-2" />
                                            <td className="px-3 py-2 text-right tabular-nums font-bold text-blue-900">{formatBDT(school.planned)}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-800 font-semibold text-white">
                          <td className="sticky left-0 z-10 bg-gray-800 px-4 py-2 text-xs font-bold uppercase">Category Total</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{cat.totalTargetStudents.toLocaleString()}</td>
                          {cat.heads.map((h) => (
                            <td key={h.feeHeadId} className="border-l border-white/20 px-3 py-2 text-right text-xs tabular-nums">
                              {h.planned > 0 ? formatBDT(h.planned) : '—'}
                            </td>
                          ))}
                          <td className="border-l border-white/20 px-3 py-2 text-right text-xs font-bold">{formatBDT(cat.planned)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}