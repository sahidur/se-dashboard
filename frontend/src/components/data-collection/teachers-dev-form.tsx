'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, BookOpen, School,
  MapPin, Users, RefreshCw, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { useFormDraft } from '@/hooks/use-form-draft';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcSchool, DcTeachersDevelopment } from '@/types';

/* ─── Constants ────────────────────────────────── */

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

interface FormState {
  onlineRefresher: number;
  offlineRefresher: number;
  developmentForum: number;
  basicTraining: number;
  subjectBasedTraining: number;
  leadershipTraining: number;
  others: number;
  teacherDropoutRate: number;
  headTeacherDropoutRate: number;
  headTeacherLeadershipGood: boolean;
}

const BLANK_FORM: FormState = {
  onlineRefresher: 0,
  offlineRefresher: 0,
  developmentForum: 0,
  basicTraining: 0,
  subjectBasedTraining: 0,
  leadershipTraining: 0,
  others: 0,
  teacherDropoutRate: 0,
  headTeacherDropoutRate: 0,
  headTeacherLeadershipGood: true,
};

const DEV_FIELDS: { key: keyof Omit<FormState, 'headTeacherLeadershipGood'>; label: string }[] = [
  { key: 'onlineRefresher',     label: 'Online Refresher' },
  { key: 'offlineRefresher',    label: 'Offline Refresher' },
  { key: 'developmentForum',    label: 'Development Forum' },
  { key: 'basicTraining',       label: 'Basic Training' },
  { key: 'subjectBasedTraining', label: 'Subject-Based Training' },
  { key: 'leadershipTraining',  label: 'Leadership Training' },
  { key: 'others',              label: 'Others' },
];

interface Props { schoolId: string }

/* ─── Main Component ────────────────────────────────────── */
export function TeachersDevForm({ schoolId }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [month, setMonth] = useState('');
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allRecords, setAllRecords] = useState<DcTeachersDevelopment[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const draft = useFormDraft<{ academicYear: string; month: string; form: FormState }>('teachers-development', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  /* Fetch school meta */
  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`)
      .then(({ data }) => setSchool(data))
      .catch(() => router.push('/data-collection/schools'));
  }, [schoolId, router]);

  /* Fetch all records */
  const loadAllRecords = useCallback(async () => {
    setLoadingAll(true);
    try {
      const { data } = await api.get<DcTeachersDevelopment[]>(
        `/data-collection/teachers/development/school/${schoolId}`,
      );
      setAllRecords(data);
    } catch {
      setAllRecords([]);
    } finally {
      setLoadingAll(false);
    }
  }, [schoolId]);

  useEffect(() => { loadAllRecords(); }, [loadAllRecords]);

  /* Overlay the user's private draft (if any) once records have loaded. */
  useEffect(() => {
    if (loadingAll || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setMonth(d.month);
        setForm({ ...BLANK_FORM, ...d.form });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAll]);

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, month, form });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(BLANK_FORM);
  };

  /* When academic year / month changes, load existing entry for that period */
  const loadEntry = useCallback(async (y: string, m: string) => {
    if (!y || !m) return;
    setLoadingEntry(true);
    setError('');
    try {
      const { data } = await api.get<DcTeachersDevelopment[]>(
        `/data-collection/teachers/development/school/${schoolId}`,
      );
      const existing = data.find(
        (r) => Number(r.academicYear) === Number(y) && r.month === m,
      );
      if (existing) {
        setForm({
          onlineRefresher:     existing.onlineRefresher,
          offlineRefresher:    existing.offlineRefresher,
          developmentForum:    existing.developmentForum,
          basicTraining:       existing.basicTraining,
          subjectBasedTraining: existing.subjectBasedTraining,
          leadershipTraining:  existing.leadershipTraining,
          others:              existing.others,
          teacherDropoutRate:      Number(existing.teacherDropoutRate ?? 0),
          headTeacherDropoutRate:  Number(existing.headTeacherDropoutRate ?? 0),
          headTeacherLeadershipGood: existing.headTeacherLeadershipGood ?? true,
        });
        setIsEditing(true);
      } else {
        setForm(BLANK_FORM);
        setIsEditing(false);
      }
    } catch {
      setForm(BLANK_FORM);
      setIsEditing(false);
    } finally {
      setLoadingEntry(false);
    }
  }, [schoolId]);

  // Changing the academic year re-scopes the month selection, so reset it.
  const handleYearChange = (y: string) => {
    setAcademicYear(y);
    setMonth('');
    setForm(BLANK_FORM);
    setIsEditing(false);
    setTab('entry');
  };

  const handleMonthChange = (m: string) => {
    setMonth(m);
    setTab('entry');
    loadEntry(academicYear, m);
  };

  const handleRecordClick = (r: DcTeachersDevelopment) => {
    const y = r.academicYear != null ? String(r.academicYear) : '';
    setAcademicYear(y);
    setMonth(r.month);
    setTab('entry');
    loadEntry(y, r.month);
  };

  const setField = (k: keyof FormState, v: number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!month) { setError('Please select a month.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/data-collection/teachers/development', {
        schoolId,
        academicYear: Number(academicYear),
        month,
        ...form,
      });
      const successText = `${month} development data saved successfully!`;
      showToast('success', successText);
      setIsEditing(true);
      draft.clearDraft();
      await loadAllRecords();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const errText = anyErr?.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(errText);
      showToast('error', errText);
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  const yearRecords = academicYear
    ? allRecords.filter((r) => Number(r.academicYear) === Number(academicYear))
    : allRecords;
  const submittedMonths = yearRecords.map((r) => r.month);

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex min-w-[280px] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="flex-1 text-sm font-medium">{toast.msg}</p>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── School Info Card ── */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md">
              <BookOpen size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <School size={12} /> {school.code}
                </span>
                {school.district && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} /> {school.district}
                  </span>
                )}
                {school.schoolCategory && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users size={12} /> {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allRecords.length > 0 ? 'success' : 'default'} className="gap-1">
                {allRecords.length > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {new Set(submittedMonths).size}/12 Months{academicYear ? ` · ${academicYear}` : ''}
              </Badge>
            </div>
          </div>

          {/* Month progress dots */}
          {yearRecords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {MONTHS.map((m) => {
                const done = submittedMonths.includes(m);
                return (
                  <span
                    key={m}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <FormTabs active={tab} onChange={setTab} dataCount={allRecords.length} />

      {/* ── Entry Form ── */}
      {tab === 'entry' && (
      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">
              Teachers&apos; Development Data
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
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="">Choose an academic year...</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
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
                    onChange={(e) => handleMonthChange(e.target.value)}
                    disabled={!academicYear}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a month...</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m} {submittedMonths.includes(m) ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
              </div>
            </div>
            {academicYear && month && (
              <p className={`-mt-3 text-xs font-medium ${isEditing ? 'text-amber-600' : 'text-gray-400'}`}>
                {isEditing ? `Editing existing data for ${month} ${academicYear}` : `New entry for ${month} ${academicYear}`}
              </p>
            )}

            {loadingEntry ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <RefreshCw size={14} className="animate-spin" />
                Loading {month} data...
              </div>
            ) : (
              <>
                {/* Development Fields Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {DEV_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <Label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form[key]}
                        onChange={(e) => setField(key, Number(e.target.value) || 0)}
                        placeholder="0"
                        disabled={!academicYear || !month}
                      />
                    </div>
                  ))}
                </div>

                {/* Retention / Leadership metrics (feed the Status Breakdown grades) */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-700/80">
                    Retention &amp; Leadership
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-gray-600">Teacher Dropout Rate (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={form.teacherDropoutRate}
                        onChange={(e) => setField('teacherDropoutRate', Number(e.target.value) || 0)}
                        placeholder="0"
                        disabled={!academicYear || !month}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-gray-600">Head Teacher Dropout Rate (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={form.headTeacherDropoutRate}
                        onChange={(e) => setField('headTeacherDropoutRate', Number(e.target.value) || 0)}
                        placeholder="0"
                        disabled={!academicYear || !month}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-gray-600">Head Teacher Leadership</Label>
                      <select
                        value={form.headTeacherLeadershipGood ? 'yes' : 'no'}
                        onChange={(e) => setForm((prev) => ({ ...prev, headTeacherLeadershipGood: e.target.value === 'yes' }))}
                        disabled={!academicYear || !month}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                      >
                        <option value="yes">Good / Effective</option>
                        <option value="no">Needs Improvement</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
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
                  {!academicYear && (
                    <p className="mt-2 text-xs text-gray-400">Select an academic year to continue</p>
                  )}
                  {academicYear && !month && (
                    <p className="mt-2 text-xs text-gray-400">Select a month to enable saving</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </form>
      )}

      {/* ── All Responses Table ── */}
      {tab === 'data' && (
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-rose-600" />
            <h3 className="font-semibold text-gray-800">Submitted Development Records</h3>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{allRecords.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadAllRecords} disabled={loadingAll} className="gap-1.5 text-xs">
            <RefreshCw size={13} className={loadingAll ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {loadingAll ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
          </div>
        ) : allRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <BookOpen size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No development records yet. Select a month and submit data above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Academic Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Month</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Online Ref.</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Offline Ref.</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Dev. Forum</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Basic Train.</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Subject Train.</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Leadership</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Others</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Updated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allRecords.map((r, idx) => {
                  const total = r.onlineRefresher + r.offlineRefresher + r.developmentForum +
                    r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others;
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer transition-colors hover:brightness-95 ${
                        month === r.month && Number(academicYear) === Number(r.academicYear) ? 'ring-inset ring-2 ring-rose-300' :
                        idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30'
                      }`}
                      onClick={() => handleRecordClick(r)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{r.academicYear ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">{r.month}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.onlineRefresher}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.offlineRefresher}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.developmentForum}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.basicTraining}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.subjectBasedTraining}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.leadershipTraining}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.others}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-700 text-sm">{total}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {allRecords.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-rose-200 bg-rose-50/50">
                    <td className="px-4 py-3 text-xs font-bold text-rose-700">Totals</td>
                    <td />
                    {(['onlineRefresher','offlineRefresher','developmentForum','basicTraining','subjectBasedTraining','leadershipTraining','others'] as (keyof DcTeachersDevelopment)[]).map((k) => (
                      <td key={k} className="px-4 py-3 text-right font-bold text-gray-700">
                        {allRecords.reduce((s, r) => s + Number(r[k] ?? 0), 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {allRecords.reduce((s, r) => s + r.onlineRefresher + r.offlineRefresher + r.developmentForum + r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others, 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
            <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-400">
              Click any row to load that month&apos;s data into the form for editing.
            </p>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
