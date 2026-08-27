'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, CalendarDays, School,
  MapPin, RefreshCw, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { useFormDraft } from '@/hooks/use-form-draft';
import api from '@/lib/api';
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool, DcRevenueMonthlyRecord } from '@/types';

/* ─── Constants ─────────────────────────────────── */

const YEARS = buildYearOptions();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

function calcPct(target: number, achievement: number): number {
  if (!target) return 0;
  return Math.min((achievement / target) * 100, 9999.99);
}

function calcDuesPct(target: number, achievement: number): string {
  if (!target) return '—';
  return (((target - achievement) / target) * 100).toFixed(1) + '%';
}

interface Props { schoolId: string; mode: 'budget' | 'actual' }

/* ─── Component ─────────────────────────────────────────── */

export function RevenueMonthlyForm({ schoolId, mode }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [month, setMonth] = useState('');
  const [tuitionFeeTarget, setTuitionFeeTarget] = useState<number>(0);
  const [tuitionFeeAchievement, setTuitionFeeAchievement] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [records, setRecords] = useState<DcRevenueMonthlyRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const draft = useFormDraft<{ academicYear: string; month: string; tuitionFeeTarget: number; tuitionFeeAchievement: number }>(`revenue-monthly-${mode}`, schoolId);
  const draftAppliedRef = useRef(false);
  const skipPrefillRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const endpoint = mode === 'budget' ? '/data-collection/revenue/budget/monthly' : '/data-collection/revenue/actual/monthly';
  const getEndpoint = `${endpoint}/school/${schoolId}`;
  const accentColor = mode === 'budget' ? 'orange' : 'yellow';
  const accentClasses = mode === 'budget'
    ? { bar: 'from-orange-400 to-amber-500', btn: 'bg-orange-500 hover:bg-orange-600', badgeBase: 'bg-orange-100 text-orange-700' }
    : { bar: 'from-yellow-400 to-yellow-500', btn: 'bg-yellow-500 hover:bg-yellow-600', badgeBase: 'bg-yellow-100 text-yellow-700' };

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

  /* Pre-fill form when academic year + month are selected and data exists */
  useEffect(() => {
    if (skipPrefillRef.current) { skipPrefillRef.current = false; return; }
    if (academicYear && month) {
      const existing = records.find(
        (r) => Number(r.academicYear) === Number(academicYear) && r.month === month,
      );
      if (existing) {
        setTuitionFeeTarget(Number(existing.tuitionFeeTarget) || 0);
        setTuitionFeeAchievement(Number(existing.tuitionFeeAchievement) || 0);
      } else {
        setTuitionFeeTarget(0);
        setTuitionFeeAchievement(0);
      }
    }
  }, [academicYear, month, records]);

  // Overlay the user's private draft (if any) once records have loaded.
  useEffect(() => {
    if (loadingRecords || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        skipPrefillRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setMonth(d.month);
        setTuitionFeeTarget(d.tuitionFeeTarget);
        setTuitionFeeAchievement(d.tuitionFeeAchievement);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRecords]);

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, month, tuitionFeeTarget, tuitionFeeAchievement });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setTuitionFeeTarget(0);
    setTuitionFeeAchievement(0);
  };

  // Changing the academic year re-scopes the month selection, so reset it.
  const handleYearChange = (y: string) => {
    setAcademicYear(y);
    setMonth('');
    setTuitionFeeTarget(0);
    setTuitionFeeAchievement(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!month) { setError('Please select a month.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(endpoint, {
        schoolId,
        academicYear: Number(academicYear),
        month,
        tuitionFeeTarget,
        tuitionFeeAchievement,
      });
      await draft.clearDraft();
      showToast('success', `Monthly tuition revenue saved for ${month}!`);
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

  const livePct = calcPct(tuitionFeeTarget, tuitionFeeAchievement);
  const livePctLabel = tuitionFeeTarget > 0 ? livePct.toFixed(1) + '%' : '—';
  const liveDeficit = tuitionFeeTarget - tuitionFeeAchievement;
  const pctColor = livePct >= 100 ? 'text-emerald-600' : livePct >= 70 ? 'text-amber-600' : tuitionFeeTarget > 0 ? 'text-red-500' : 'text-gray-400';

  const yearRecords = academicYear
    ? records.filter((r) => Number(r.academicYear) === Number(academicYear))
    : records;
  const submittedMonths = new Set(yearRecords.map((r) => r.month));
  const sortedRecords = [...records].sort(
    (a, b) => (Number(b.academicYear) - Number(a.academicYear)) || (MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
  );
  const totalTarget = records.reduce((s, r) => s + Number(r.tuitionFeeTarget), 0);
  const totalAchievement = records.reduce((s, r) => s + Number(r.tuitionFeeAchievement), 0);
  const totalPct = calcPct(totalTarget, totalAchievement);

  const revenueColumns: TableColumn<DcRevenueMonthlyRecord>[] = [
    { key: 'academicYear', header: 'Academic Year', sortable: true },
    { key: 'month', header: 'Month', render: (r) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${accentClasses.badgeBase}`}>{r.month}</span>
    )},
    { key: 'tuitionFeeTarget', header: `${mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target (BDT)`, className: 'text-right font-mono', render: (r) => <span className="text-sm">{formatAmount(Number(r.tuitionFeeTarget))}</span> },
    { key: 'tuitionFeeAchievement', header: 'Actual Collected Revenue (BDT)', className: 'text-right font-mono', render: (r) => <span className="text-sm">{formatAmount(Number(r.tuitionFeeAchievement))}</span> },
    { key: 'deficit', header: `${mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %'}`, className: 'text-right font-mono', render: (r) => {
      const deficit = Number(r.tuitionFeeTarget) - Number(r.tuitionFeeAchievement);
      return <span className={`text-sm ${deficit > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
        {mode === 'budget' ? formatAmount(deficit) : calcDuesPct(Number(r.tuitionFeeTarget), Number(r.tuitionFeeAchievement))}
      </span>;
    }},
    { key: 'pctCollection', header: '% Collection', className: 'text-center', render: (r) => {
      const pct = calcPct(Number(r.tuitionFeeTarget), Number(r.tuitionFeeAchievement));
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
              {mode === 'budget' ? 'Planned' : 'Actual'} Revenue Collection - Monthly (Tuition Fee)
            </CardTitle>
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

            {/* Value inputs */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">{mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target (Monthly) - BDT</Label>
                <Input
                  type="number"
                  min={0}
                  value={tuitionFeeTarget}
                  onChange={(e) => setTuitionFeeTarget(Number(e.target.value) || 0)}
                  placeholder="BDT"
                  disabled={!academicYear || !month}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">Actual Collected Revenue (Monthly) - BDT</Label>
                <Input
                  type="number"
                  min={0}
                  value={tuitionFeeAchievement}
                  onChange={(e) => setTuitionFeeAchievement(Number(e.target.value) || 0)}
                  placeholder="BDT"
                  disabled={!academicYear || !month}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">{mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %'}</Label>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-3">
                  <span className={`font-mono text-sm font-bold ${liveDeficit > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {mode === 'budget' ? formatAmount(liveDeficit) : calcDuesPct(tuitionFeeTarget, tuitionFeeAchievement)}
                  </span>
                  <span className="text-xs text-gray-400">(auto)</span>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">% of Revenue Collection</Label>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-3">
                  <span className={`text-xl font-extrabold ${pctColor}`}>{livePctLabel}</span>
                  <span className="text-xs text-gray-400">(auto-calculated)</span>
                </div>
                {tuitionFeeTarget > 0 && (
                  <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all ${livePct >= 100 ? 'bg-emerald-500' : livePct >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(livePct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
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
          headerExtra={
            <p className="text-xs text-gray-400">Click a row to load it into the form for editing.</p>
          }
        />
      )}
    </div>
  );
}
