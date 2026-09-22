'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, CalendarDays, School,
  MapPin, RefreshCw, X, ChevronDown, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { ExportButtons } from '@/components/data-collection/export-buttons';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import { getFeeFieldsForCategory, SCHOOL_CATEGORY_LABELS } from '@/components/data-collection/school-category-fields';
import type { DcSchool, DcRevenueMonthlyRecord } from '@/types';

/* ─── Constants ─────────────────────────────────── */

const YEARS = buildYearOptions();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function calcPct(target: number, achievement: number): number {
  if (!target) return 0;
  return Math.min((achievement / target) * 100, 9999.99);
}

function calcDuesPct(target: number, achievement: number): string {
  if (!target) return '—';
  return (((target - achievement) / target) * 100).toFixed(1) + '%';
}

interface Props { schoolId: string; mode: 'budget' | 'actual' }

// Amount fields are kept as strings so inputs render blank instead of a
// default "0"; they are converted to numbers at submit time.
const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ─── Component ─────────────────────────────────────────── */

export function RevenueMonthlyForm({ schoolId, mode }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [month, setMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [records, setRecords] = useState<DcRevenueMonthlyRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  // Fee target/achievement values keyed by `${feeKey}Target` / `${feeKey}Achievement`;
  // kept as strings so inputs render blank instead of a default "0".
  const [form, setForm] = useState<Record<string, string>>({});
  const draft = useFormDraft<{ academicYear: string; month: string; form: Record<string, string> }>(`revenue-monthly-${mode}`, schoolId);
  const draftAppliedRef = useRef(false);
  const skipPrefillRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) =>
    s.hasPermission('data-collection', 'delete', mode === 'budget' ? 'revenue-budget-monthly' : 'revenue-actual-monthly'));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const endpoint = mode === 'budget' ? '/data-collection/revenue/budget/monthly' : '/data-collection/revenue/actual/monthly';
  const getEndpoint = `${endpoint}/school/${schoolId}`;
  const accentColor = mode === 'budget' ? 'orange' : 'yellow';
  const accentClasses = mode === 'budget'
    ? { bar: 'from-orange-400 to-amber-500', btn: 'bg-orange-500 hover:bg-orange-600', badgeBase: 'bg-orange-100 text-orange-700' }
    : { bar: 'from-yellow-400 to-yellow-500', btn: 'bg-yellow-500 hover:bg-yellow-600', badgeBase: 'bg-yellow-100 text-yellow-700' };

  // Fee fields resolved from the school's category (same logic as Fee
  // Structure); unknown/missing category falls back to all fee fields.
  const feeRows = useMemo(() => getFeeFieldsForCategory(school?.schoolCategory), [school?.schoolCategory]);
  const feeKeys = useMemo(() => feeRows.map((f) => f.key), [feeRows]);

  const blankForm = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {};
    feeKeys.forEach((k) => {
      f[`${k}Target`] = '';
      f[`${k}Achievement`] = '';
    });
    return f;
  }, [feeKeys]);

  const setField = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`)
      .then(({ data }) => setSchool(data))
      .catch(() => router.push('/data-collection/schools'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const { data } = await api.get<DcRevenueMonthlyRecord[]>(getEndpoint);
      setRecords(data);
    } catch {
      showToast('error', 'Failed to load revenue records');
      setRecords([]);
    } finally { setLoadingRecords(false); }
  }, [getEndpoint, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleDeleteRecord = async (r: DcRevenueMonthlyRecord) => {
    if (!canDeleteSubmitted) {
      showToast('error', 'You do not have permission to delete submitted data');
      return;
    }
    if (!window.confirm(`Delete the ${r.month} ${r.academicYear} record? It will be moved to the recycle bin.`)) return;
    setDeletingId(r.id);
    try {
      await api.delete(`${endpoint}/${r.id}`);
      showToast('success', 'Record deleted and moved to recycle bin');
      await loadRecords();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Failed to delete the record.'));
    } finally {
      setDeletingId(null);
    }
  };

  /* Pre-fill form when academic year + month are selected and data exists */
  useEffect(() => {
    if (skipPrefillRef.current) { skipPrefillRef.current = false; return; }
    if (academicYear && month) {
      const existing = records.find(
        (r) => Number(r.academicYear) === Number(academicYear) && r.month === month,
      );
      const rec = existing as unknown as Record<string, unknown> | undefined;
      const next: Record<string, string> = {};
      feeKeys.forEach((k) => {
        const t = rec?.[`${k}Target`];
        const a = rec?.[`${k}Achievement`];
        next[`${k}Target`] = t != null && t !== '' ? String(t) : '';
        next[`${k}Achievement`] = a != null && a !== '' ? String(a) : '';
      });
      setForm(next);
    }
  }, [academicYear, month, records, feeKeys]);

  // Overlay the user's private draft (if any) once records have loaded.
  useEffect(() => {
    if (loadingRecords || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        skipPrefillRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setMonth(d.month ?? '');
        const normalized: Record<string, string> = {};
        feeKeys.forEach((k) => {
          const t = d.form?.[`${k}Target`];
          const a = d.form?.[`${k}Achievement`];
          normalized[`${k}Target`] = t != null && t !== '' ? String(t) : '';
          normalized[`${k}Achievement`] = a != null && a !== '' ? String(a) : '';
        });
        setForm(normalized);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRecords, feeKeys]);

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, month, form });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(blankForm());
  };

  // Changing the academic year re-scopes the month selection, so reset it.
  const handleYearChange = (y: string) => {
    setAcademicYear(y);
    setMonth('');
    setForm(blankForm());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!month) { setError('Please select a month.'); return; }
    setSaving(true);
    setError('');
    try {
      const numericForm: Record<string, number> = {};
      Object.entries(form).forEach(([k, v]) => { numericForm[k] = toNum(v); });
      await api.post(endpoint, {
        schoolId,
        academicYear: Number(academicYear),
        month,
        ...numericForm,
      });
      await draft.clearDraft();
      showToast('success', `Monthly revenue saved for ${month}!`);
      await loadRecords();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? 'Failed to save.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (n: number) => new Intl.NumberFormat('en-BD').format(Number(n) || 0);
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  // Totals across the category's fee fields.
  const totalTarget = feeKeys.reduce((s, k) => s + (Number(form[`${k}Target`]) || 0), 0);
  const totalAchievement = feeKeys.reduce((s, k) => s + (Number(form[`${k}Achievement`]) || 0), 0);
  const livePct = calcPct(totalTarget, totalAchievement);
  const livePctLabel = totalTarget > 0 ? livePct.toFixed(1) + '%' : '—';
  const liveDeficit = totalTarget - totalAchievement;
  const pctColor = livePct >= 100 ? 'text-emerald-600' : livePct >= 70 ? 'text-amber-600' : totalTarget > 0 ? 'text-red-500' : 'text-gray-400';

  const recordTotals = useCallback((r: DcRevenueMonthlyRecord) => {
    const rec = r as unknown as Record<string, unknown>;
    let t = 0;
    let a = 0;
    feeKeys.forEach((k) => {
      t += Number(rec[`${k}Target`]) || 0;
      a += Number(rec[`${k}Achievement`]) || 0;
    });
    return { target: t, achievement: a };
  }, [feeKeys]);

  const yearRecords = academicYear
    ? records.filter((r) => Number(r.academicYear) === Number(academicYear))
    : records;
  const submittedMonths = new Set(yearRecords.map((r) => r.month));
  const sortedRecords = [...records].sort(
    (a, b) => (Number(b.academicYear) - Number(a.academicYear)) || (MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
  );

  const revenueColumns: TableColumn<DcRevenueMonthlyRecord>[] = [
    { key: 'academicYear', header: 'Academic Year', sortable: true },
    { key: 'month', header: 'Month', render: (r) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${accentClasses.badgeBase}`}>{r.month}</span>
    )},
    { key: 'totalTarget', header: `${mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target (BDT)`, className: 'text-right font-mono', render: (r) => <span className="text-sm">{formatAmount(recordTotals(r).target)}</span> },
    { key: 'totalAchievement', header: 'Actual Collected Revenue (BDT)', className: 'text-right font-mono', render: (r) => <span className="text-sm">{formatAmount(recordTotals(r).achievement)}</span> },
    { key: 'deficit', header: `${mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %'}`, className: 'text-right font-mono', render: (r) => {
      const { target, achievement } = recordTotals(r);
      const deficit = target - achievement;
      return <span className={`text-sm ${deficit > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
        {mode === 'budget' ? formatAmount(deficit) : calcDuesPct(target, achievement)}
      </span>;
    }},
    { key: 'pctCollection', header: '% Collection', className: 'text-center', render: (r) => {
      const { target, achievement } = recordTotals(r);
      const pct = calcPct(target, achievement);
      const pctColor = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500';
      const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-400';
      return (
        <div className="space-y-0.5">
          <span className={`text-sm font-bold ${pctColor}`}>{pct.toFixed(1)}%</span>
          <div className="mx-auto h-1.5 w-20 rounded-full bg-gray-100">
            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      );
    }},
    { key: 'updatedAt', header: 'Updated', render: (r) => <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.updatedAt)}</span> },
  ];

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex min-w-[280px] max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="flex-1 text-sm font-medium">{toast.msg}</p>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* ── School Info ── */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accentClasses.bar} text-white shadow-md`}>
              <CalendarDays size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {school.code}</span>
                {school.schoolCategory && <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}</span>}
                {school.district && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {school.district}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={records.length > 0 ? 'success' : 'default'} className="gap-1">
                {records.length > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {submittedMonths.size}/12 Months{academicYear ? ` · ${academicYear}` : ''}
              </Badge>
            </div>
          </div>
          {/* Month pills */}
          {yearRecords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {MONTHS.map((m) => (
                submittedMonths.has(m) ? (
                  <span key={m} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${accentClasses.badgeBase} border-current/20`}>
                    <CheckCircle2 size={10} /> {m.slice(0, 3)}
                  </span>
                ) : null
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormTabs active={tab} onChange={setTab} dataCount={records.length} />

      {/* ── Entry Form ── */}
      {tab === 'entry' && (
      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">
              {mode === 'budget' ? 'Planned' : 'Actual'} Revenue Collection - Monthly
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">
              Enter monthly targets per fee area. The system will auto-calculate deficit and % collection.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Academic Year + Month selectors */}
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    value={academicYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <option value="">Choose an academic year...</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Select Month <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    disabled={!academicYear}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a month...</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m} {submittedMonths.has(m) ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Fee rows */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-48">Area of Revenue Collection</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target (Monthly) - BDT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actual Collected Revenue (Monthly) - BDT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-44">{mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %'}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 w-28">% Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {feeRows.map(({ key, label, hint }, idx) => {
                    const target = Number(form[`${key}Target`]) || 0;
                    const achievement = Number(form[`${key}Achievement`]) || 0;
                    const deficit = target - achievement;
                    const pct = target > 0 ? (achievement / target) * 100 : 0;
                    const pctLabel = target > 0 ? (Math.min((achievement / target) * 100, 9999.99)).toFixed(1) + '%' : '—';
                    const rowPctColor = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : target > 0 ? 'text-red-500' : 'text-gray-400';
                    return (
                      <tr key={key} className={idx % 2 === 0 ? 'bg-white' : `bg-${accentColor}-50/20`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-sm">{label}</p>
                          {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            value={form[`${key}Target`] ?? ''}
                            onChange={(e) => setField(`${key}Target`, e.target.value)}
                            placeholder="BDT"
                            className="max-w-[180px]"
                            disabled={!academicYear || !month}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            value={form[`${key}Achievement`] ?? ''}
                            onChange={(e) => setField(`${key}Achievement`, e.target.value)}
                            placeholder="BDT"
                            className="max-w-[180px]"
                            disabled={!academicYear || !month}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex h-10 max-w-[180px] items-center rounded-lg border border-gray-100 bg-gray-50/70 px-3">
                            <span className={`font-mono text-sm font-semibold ${deficit > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {mode === 'budget' ? formatAmount(deficit) : calcDuesPct(target, achievement)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="space-y-1">
                            <p className={`text-sm font-bold ${rowPctColor}`}>{pctLabel}</p>
                            {target > 0 && (
                              <div className="h-1.5 w-full rounded-full bg-gray-100">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 border-${accentColor}-200 bg-${accentColor}-50/40 font-bold`}>
                    <td className="px-4 py-3 text-sm text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(totalTarget)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(totalAchievement)}</td>
                    <td className={`px-4 py-3 text-sm font-mono ${totalTarget - totalAchievement > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {mode === 'budget' ? formatAmount(totalTarget - totalAchievement) : calcDuesPct(totalTarget, totalAchievement)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${pctColor}`}>{livePctLabel}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pt-2">
              <DraftActionBar
                hasDraft={draft.hasDraft}
                draftSavedAt={draft.draftSavedAt}
                submitting={saving}
                onSaveDraft={handleSaveDraft}
                onClearDraft={handleClearDraft}
                submitLabel={month ? `Submit ${month}` : 'Submit Data'}
                disabled={!academicYear || !month}
              />
            </div>
          </CardContent>
        </Card>
      </form>
      )}

      {tab === 'data' && (
        <DataTable<DcRevenueMonthlyRecord>
          columns={revenueColumns}
          data={sortedRecords}
          loading={loadingRecords}
          searchable
          searchPlaceholder="Search by month, year..."
          title="Submitted Months"
          titleIcon={<CalendarDays size={18} />}
          badge={<span className={`rounded-full px-2 py-0.5 text-xs font-bold ${accentClasses.badgeBase}`}>{records.length}</span>}
          emptyMessage="No monthly revenue records yet."
          emptyIcon={<CalendarDays size={40} className="mb-3 opacity-20" />}
          onRefresh={loadRecords}
          refreshing={loadingRecords}
          onRowClick={(r) => { setAcademicYear(String(r.academicYear ?? '')); setMonth(r.month); setTab('entry'); }}
          rowClassName={(r) =>
            month === r.month && Number(academicYear) === Number(r.academicYear) ? 'ring-inset ring-2 ring-orange-300' : ''
          }
          actions={(r) => (
            <div className="flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canEditSubmitted) { showToast('error', 'You do not have permission to edit submitted data'); return; }
                  setAcademicYear(String(r.academicYear ?? ''));
                  setMonth(r.month);
                  setTab('entry');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-orange-500 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteRecord(r); }}
                disabled={deletingId === r.id}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-red-400 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {deletingId === r.id
                  ? <RefreshCw size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
              </button>
            </div>
          )}
        headerExtra={
          <ExportButtons
            payload={{
              filename: mode === 'budget' ? 'revenue-budget-monthly' : 'revenue-actual-monthly',
              headers: [
                'Academic Year', 'Month',
                ...feeRows.flatMap(({ label }) => [`${label} - Target (BDT)`, `${label} - Collected (BDT)`]),
                'Total Target (BDT)', 'Total Collected (BDT)',
                mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %',
                '% Collection', 'Updated',
              ],
              rows: sortedRecords.map((r) => {
                const rec = r as unknown as Record<string, unknown>;
                const { target, achievement } = recordTotals(r);
                return [
                  r.academicYear,
                  r.month,
                  ...feeRows.map(({ key }) => [
                    Number(rec[`${key}Target`]) || 0,
                    Number(rec[`${key}Achievement`]) || 0,
                  ]).flat(),
                  target,
                  achievement,
                  mode === 'budget' ? target - achievement : calcDuesPct(target, achievement),
                  `${calcPct(target, achievement).toFixed(1)}%`,
                  r.updatedAt ? formatDateTime(r.updatedAt) : '',
                ];
              }),
            }}
          />
        }
        />
      )}
    </div>
  );
}