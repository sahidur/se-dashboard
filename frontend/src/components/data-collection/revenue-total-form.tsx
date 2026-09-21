'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, Banknote, School,
  MapPin, Users, RefreshCw, X, TrendingUp, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { ExportButtons } from '@/components/data-collection/export-buttons';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool, DcRevenueTotalRecord } from '@/types';

/* ─── Constants ─────────────────────────────────── */

const YEARS = buildYearOptions();

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

const FEE_ROWS: { key: string; label: string; hint?: string }[] = [
  { key: 'admissionFee',  label: 'Admission Fee' },
  { key: 'sessionFee',    label: 'Session Fee' },
  { key: 'assessmentFee', label: 'Assessment Fee' },
  { key: 'sportsFee',     label: 'Sports Fee' },
  { key: 'syllabusFee',   label: 'Syllabus Fee' },
  { key: 'testimonialFee',label: 'Testimonial Fee' },
  { key: 'othersFee',     label: 'Others Fee', hint: 'Badge, Tie, Diary, ID card, Shoulder' },
  { key: 'transportFee',  label: 'Transport Fee' },
];

type RevenueFormState = {
  totalStudentsTarget: string;
} & Record<string, string>;

// Amount fields are kept as strings so inputs render blank instead of a
// default "0"; they are converted to numbers at submit time.
function buildBlank(): RevenueFormState {
  const f: RevenueFormState = { totalStudentsTarget: '' };
  FEE_ROWS.forEach(({ key }) => {
    f[`${key}Target`] = '';
    f[`${key}Achievement`] = '';
  });
  return f;
}

function recordToForm(data: DcRevenueTotalRecord): RevenueFormState {
  const f = buildBlank();
  f.totalStudentsTarget = data.totalStudentsTarget != null ? String(data.totalStudentsTarget) : '';
  FEE_ROWS.forEach(({ key }) => {
    const rec = data as unknown as Record<string, unknown>;
    f[`${key}Target`] = rec[`${key}Target`] != null && rec[`${key}Target`] !== '' ? String(rec[`${key}Target`]) : '';
    f[`${key}Achievement`] = rec[`${key}Achievement`] != null && rec[`${key}Achievement`] !== '' ? String(rec[`${key}Achievement`]) : '';
  });
  return f;
}

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function calcPct(target: number, achievement: number): string {
  if (!target) return '—';
  return (Math.min((achievement / target) * 100, 9999.99)).toFixed(1) + '%';
}

function calcDuesPct(target: number, achievement: number): string {
  if (!target) return '—';
  return (((target - achievement) / target) * 100).toFixed(1) + '%';
}

interface Props { schoolId: string; mode: 'budget' | 'actual' }

/* ─── Component ─────────────────────────────────────────── */

export function RevenueTotalForm({ schoolId, mode }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [loadingYear, setLoadingYear] = useState(false);
  const [form, setForm] = useState<RevenueFormState>(buildBlank());
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [record, setRecord] = useState<DcRevenueTotalRecord | null>(null);
  const draft = useFormDraft<{ academicYear: string; form: RevenueFormState }>(`revenue-total-${mode}`, schoolId);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) =>
    s.hasPermission('data-collection', 'delete', mode === 'budget' ? 'revenue-budget-total' : 'revenue-actual-total'));
  const [editDenied, setEditDenied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // "Edit" on the View Data tab: the record shown is already loaded into the
  // form for the selected year, so switching back to the entry tab is the
  // edit action.
  const handleEditRecord = () => {
    if (!canEditSubmitted) { setEditDenied(true); return; }
    setEditDenied(false);
    setTab('entry');
  };

  const handleDeleteRecord = async () => {
    if (!canDeleteSubmitted) {
      showToast('error', 'You do not have permission to delete submitted data');
      return;
    }
    if (!record?.id) return;
    if (!window.confirm('Delete this yearly revenue record? It will be moved to the recycle bin.')) return;
    setDeleting(true);
    try {
      await api.delete(`${endpoint}/${record.id}`);
      showToast('success', 'Record deleted and moved to recycle bin');
      setRecord(null);
      setIsEditing(false);
      setForm(buildBlank());
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Failed to delete the record.'));
    } finally {
      setDeleting(false);
    }
  };

  const endpoint = mode === 'budget' ? '/data-collection/revenue/budget/total' : '/data-collection/revenue/actual/total';
  const getEndpoint = `${endpoint}/school/${schoolId}`;
  const accentColor = mode === 'budget' ? 'orange' : 'yellow';
  const accentClasses = mode === 'budget'
    ? { bar: 'from-orange-500 to-orange-600', btn: 'bg-orange-600 hover:bg-orange-700', badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-300' }
    : { bar: 'from-yellow-500 to-yellow-600', btn: 'bg-yellow-600 hover:bg-yellow-700', badge: 'bg-yellow-100 text-yellow-700', ring: 'ring-yellow-300' };

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

  const loadRecord = useCallback(async () => {
    try {
      const { data } = await api.get<DcRevenueTotalRecord>(getEndpoint);
      if (data) {
        setForm(recordToForm(data));
        setRecord(data);
        setIsEditing(true);
        if (data.academicYear != null) setAcademicYear(String(data.academicYear));
      }
    } catch {
      // No data yet — form stays blank
    }
    // Overlay the user's private draft on top of any saved data.
    try {
      const d = await draft.loadDraft();
      if (d?.form) {
        const normalized = buildBlank();
        Object.entries(d.form).forEach(([k, v]) => {
          if (v != null && v !== '') normalized[k] = String(v);
        });
        setForm(normalized);
        if (d.academicYear) setAcademicYear(d.academicYear);
      }
    } catch {
      // Draft load failure is non-critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEndpoint]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  // Changing the academic year reloads that year's record (or blanks the form).
  const handleYearChange = async (y: string) => {
    setAcademicYear(y);
    setError('');
    if (!y) return;
    setLoadingYear(true);
    try {
      const { data } = await api.get<DcRevenueTotalRecord>(`${getEndpoint}?academicYear=${y}`);
      if (data) {
        setForm(recordToForm(data));
        setRecord(data);
        setIsEditing(true);
      } else {
        setForm(buildBlank());
        setRecord(null);
        setIsEditing(false);
      }
    } catch {
      setForm(buildBlank());
      setRecord(null);
      setIsEditing(false);
    } finally {
      setLoadingYear(false);
    }
  };

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, form });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(buildBlank());
  };

  const setField = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    setSaving(true);
    setError('');
    try {
      const numericForm: Record<string, number> = {};
      Object.entries(form).forEach(([k, v]) => { numericForm[k] = toNum(v); });
      const { data } = await api.post<DcRevenueTotalRecord>(endpoint, {
        schoolId,
        academicYear: Number(academicYear),
        ...numericForm,
      });
      setRecord(data);
      setIsEditing(true);
      await draft.clearDraft();
      showToast('success', `Revenue ${mode === 'budget' ? 'budget' : 'actual'} data saved successfully!`);
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

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className={`h-12 w-12 animate-spin rounded-full border-4 border-${accentColor}-200 border-t-${accentColor}-600`} />
      </div>
    );
  }

  const totalTarget = FEE_ROWS.reduce((s, { key }) => s + (Number(form[`${key}Target`]) || 0), 0);
  const totalAchievement = FEE_ROWS.reduce((s, { key }) => s + (Number(form[`${key}Achievement`]) || 0), 0);

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
              <Banknote size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {school.code}</span>
                {school.district && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {school.district}</span>}
              </div>
            </div>
            <Badge variant={isEditing ? 'success' : 'default'} className="gap-1">
              {isEditing ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {isEditing ? 'Data Saved' : 'Not Submitted'}
            </Badge>
          </div>
          {isEditing && record && (
            <p className="mt-3 text-xs text-gray-400">
              Last updated: {formatDateTime(record.updatedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Form ── */}
      <FormTabs
        active={tab}
        onChange={setTab}
        dataLabel="View Data"
        dataCount={record ? 1 : 0}
      />

      {tab === 'entry' && (
      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">
              {mode === 'budget' ? 'Planned' : 'Actual'} Revenue Collection - Total (Yearly)
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">
              Enter yearly targets first. After year-end, fill in achievements — the system will auto-calculate % collection.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Academic Year + Total students */}
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <select
                  value={academicYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">Choose an academic year...</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {loadingYear && (
                  <p className="mt-1.5 text-xs text-gray-400">Loading {academicYear} data…</p>
                )}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">Total Students (Yearly Target)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.totalStudentsTarget}
                  onChange={(e) => setField('totalStudentsTarget', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Fee rows */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-48">Area of Revenue Collection</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target (Yearly) - BDT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actual Collected Revenue (Yearly) - BDT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-44">{mode === 'budget' ? 'Revenue Deficit (BDT)' : 'Outstanding Dues %'}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 w-28">% Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {FEE_ROWS.map(({ key, label, hint }, idx) => {
                    const target = Number(form[`${key}Target`]) || 0;
                    const achievement = Number(form[`${key}Achievement`]) || 0;
                    const deficit = target - achievement;
                    const pct = target > 0 ? (achievement / target) * 100 : 0;
                    const pctLabel = calcPct(target, achievement);
                    const pctColor = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : target > 0 ? 'text-red-500' : 'text-gray-400';
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
                            value={form[`${key}Target`]}
                            onChange={(e) => setField(`${key}Target`, e.target.value)}
                            placeholder="BDT"
                            className="max-w-[180px]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            value={form[`${key}Achievement`]}
                            onChange={(e) => setField(`${key}Achievement`, e.target.value)}
                            placeholder="BDT"
                            className="max-w-[180px]"
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
                            <p className={`text-sm font-bold ${pctColor}`}>{pctLabel}</p>
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
                      <span className={`text-sm font-bold ${
                        totalTarget > 0 && (totalAchievement / totalTarget) >= 1 ? 'text-emerald-600' :
                        totalTarget > 0 && (totalAchievement / totalTarget) >= 0.7 ? 'text-amber-600' :
                        totalTarget > 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {calcPct(totalTarget, totalAchievement)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              {isEditing && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <TrendingUp size={14} />
                  Overall {calcPct(totalTarget, totalAchievement)} achieved
                </div>
              )}
              <DraftActionBar
                hasDraft={draft.hasDraft}
                draftSavedAt={draft.draftSavedAt}
                submitting={saving}
                onSaveDraft={handleSaveDraft}
                onClearDraft={handleClearDraft}
                submitLabel="Submit Revenue Data"
              />
            </div>
          </CardContent>
        </Card>
      </form>
      )}

      {tab === 'data' && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold text-gray-800">
                {mode === 'budget' ? 'Planned' : 'Actual'} Revenue Collection - Total (Yearly) — Submitted Data
              </CardTitle>
              {record && (
                <div className="flex flex-wrap items-center gap-2">
                  <ExportButtons
                    payload={(() => {
                      const rec = record as unknown as Record<string, number>;
                      const rows = FEE_ROWS.map(({ key, label }) => {
                        const target = Number(rec[`${key}Target`]) || 0;
                        const achievement = Number(rec[`${key}Achievement`]) || 0;
                        return [
                          label,
                          target,
                          achievement,
                          mode === 'budget' ? formatAmount(target - achievement) : calcDuesPct(target, achievement),
                          calcPct(target, achievement),
                        ];
                      });
                      const totalTarget = FEE_ROWS.reduce((s, { key }) => s + (Number(rec[`${key}Target`]) || 0), 0);
                      const totalAchievement = FEE_ROWS.reduce((s, { key }) => s + (Number(rec[`${key}Achievement`]) || 0), 0);
                      rows.push([
                        'Total',
                        formatAmount(totalTarget),
                        formatAmount(totalAchievement),
                        mode === 'budget' ? formatAmount(totalTarget - totalAchievement) : calcDuesPct(totalTarget, totalAchievement),
                        calcPct(totalTarget, totalAchievement),
                      ]);
                      return {
                        filename: mode === 'budget' ? 'revenue-budget-total' : 'revenue-actual-total',
                        headers: [
                          'Area of Revenue Collection',
                          `${mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target - BDT`,
                          'Actual Collected Revenue - BDT',
                          mode === 'budget' ? 'Revenue Deficit - BDT' : 'Outstanding Dues %',
                          '% Collection',
                        ],
                        rows,
                      };
                    })()}
                  />
                  <Button variant="outline" size="sm" onClick={handleEditRecord} className="gap-1.5">
                    <Pencil size={14} /> Edit This Data
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={handleDeleteRecord}
                    disabled={deleting}
                    className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {deleting
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {editDenied && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} className="shrink-0" />
                You do not have permission to edit submitted data.
              </div>
            )}
            {!record ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <Banknote size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">No revenue data submitted yet.</p>
                <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add it.</p>
              </div>
            ) : (() => {
              const rec = record as unknown as Record<string, number>;
              const savedTotalTarget = FEE_ROWS.reduce((s, { key }) => s + (Number(rec[`${key}Target`]) || 0), 0);
              const savedTotalAchievement = FEE_ROWS.reduce((s, { key }) => s + (Number(rec[`${key}Achievement`]) || 0), 0);
              return (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Academic Year</p>
                      <p className="mt-0.5 text-lg font-bold text-gray-800">{record.academicYear ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Total Students (Yearly Target)</p>
                      <p className="mt-0.5 text-lg font-bold text-gray-800">{formatAmount(Number(record.totalStudentsTarget) || 0)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/70 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-48">Area of Revenue Collection</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{mode === 'budget' ? 'Planned' : 'Actual'} Revenue Target - BDT</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actual Collected Revenue - BDT</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{mode === 'budget' ? 'Revenue Deficit - BDT' : 'Outstanding Dues %'}</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 w-28">% Collection</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {FEE_ROWS.map(({ key, label, hint }, idx) => {
                          const target = Number(rec[`${key}Target`]) || 0;
                          const achievement = Number(rec[`${key}Achievement`]) || 0;
                          return (
                            <tr key={key} className={idx % 2 === 0 ? 'bg-white' : `bg-${accentColor}-50/20`}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800 text-sm">{label}</p>
                                {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-800">{formatAmount(target)}</td>
                              <td className="px-4 py-3 font-mono text-gray-800">{formatAmount(achievement)}</td>
                              <td className={`px-4 py-3 font-mono ${target - achievement > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{mode === 'budget' ? formatAmount(target - achievement) : calcDuesPct(target, achievement)}</td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{calcPct(target, achievement)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className={`border-t-2 border-${accentColor}-200 bg-${accentColor}-50/40 font-bold`}>
                          <td className="px-4 py-3 text-sm text-gray-700">Total</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(savedTotalTarget)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(savedTotalAchievement)}</td>
                          <td className={`px-4 py-3 text-sm font-mono ${savedTotalTarget - savedTotalAchievement > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {mode === 'budget' ? formatAmount(savedTotalTarget - savedTotalAchievement) : calcDuesPct(savedTotalTarget, savedTotalAchievement)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-gray-700">{calcPct(savedTotalTarget, savedTotalAchievement)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {record.updatedAt && (
                    <p className="text-xs text-gray-400">Last updated: {formatDateTime(record.updatedAt)}</p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
