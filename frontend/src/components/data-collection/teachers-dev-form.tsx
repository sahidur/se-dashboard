'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, BookOpen, School,
  MapPin, Users, RefreshCw, X, ChevronDown, Pencil, Trash2,
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
import type { DcSchool, DcTeachersDevelopment, HeadTeacherLeadership } from '@/types';

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
  // Numeric fields kept as strings so inputs render blank instead of a
  // default "0"; they are converted to numbers at submit time.
  onlineRefresher: string;
  offlineRefresher: string;
  developmentForum: string;
  basicTraining: string;
  subjectBasedTraining: string;
  leadershipTraining: string;
  others: string;
  teacherDropoutRate: string;
  headTeacherDropoutRate: string;
  headTeacherLeadership: HeadTeacherLeadership;
}

const LEADERSHIP_OPTIONS: { value: HeadTeacherLeadership; label: string }[] = [
  { value: 'strong',   label: 'Strong' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'weak',     label: 'Weak' },
];

const BLANK_FORM: FormState = {
  onlineRefresher: '',
  offlineRefresher: '',
  developmentForum: '',
  basicTraining: '',
  subjectBasedTraining: '',
  leadershipTraining: '',
  others: '',
  teacherDropoutRate: '',
  headTeacherDropoutRate: '',
  headTeacherLeadership: 'strong',
};

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const DEV_FIELDS: { key: keyof Omit<FormState, 'headTeacherLeadership'>; label: string }[] = [
  { key: 'onlineRefresher',     label: 'Online Refresher' },
  { key: 'offlineRefresher',    label: 'Offline Refresher' },
  { key: 'developmentForum',    label: 'Development Forum' },
  { key: 'basicTraining',       label: 'Basic Training' },
  { key: 'subjectBasedTraining', label: 'Subject-Based Training' },
  { key: 'leadershipTraining',  label: 'Leadership Training' },
  { key: 'others',              label: 'Others' },
];

/** Records saved before the 3-level scale only carry the old Good/Needs-Improvement boolean. */
function resolveLeadership(r: DcTeachersDevelopment): HeadTeacherLeadership {
  if (r.headTeacherLeadership) return r.headTeacherLeadership;
  if (r.headTeacherLeadershipGood === false) return 'weak';
  return 'strong';
}

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
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'teachers-development'));
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      showToast('error', 'Failed to load teacher development records');
      setAllRecords([]);
    } finally {
      setLoadingAll(false);
    }
  }, [schoolId, showToast]);

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
          onlineRefresher:     existing.onlineRefresher != null ? String(existing.onlineRefresher) : '',
          offlineRefresher:    existing.offlineRefresher != null ? String(existing.offlineRefresher) : '',
          developmentForum:    existing.developmentForum != null ? String(existing.developmentForum) : '',
          basicTraining:       existing.basicTraining != null ? String(existing.basicTraining) : '',
          subjectBasedTraining: existing.subjectBasedTraining != null ? String(existing.subjectBasedTraining) : '',
          leadershipTraining:  existing.leadershipTraining != null ? String(existing.leadershipTraining) : '',
          others:              existing.others != null ? String(existing.others) : '',
          teacherDropoutRate:      existing.teacherDropoutRate != null ? String(existing.teacherDropoutRate) : '',
          headTeacherDropoutRate:  existing.headTeacherDropoutRate != null ? String(existing.headTeacherDropoutRate) : '',
          headTeacherLeadership:   resolveLeadership(existing),
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

  const handleEditRecord = (r: DcTeachersDevelopment) => {
    if (!canEditSubmitted) {
      showToast('error', 'You do not have permission to edit submitted data');
      return;
    }
    handleRecordClick(r);
  };

  const handleDeleteRecord = async (r: DcTeachersDevelopment) => {
    if (!canDeleteSubmitted) {
      showToast('error', 'You do not have permission to delete submitted data');
      return;
    }
    if (!window.confirm(`Delete the ${r.month} ${r.academicYear} development record? It will be moved to the recycle bin.`)) return;
    setDeletingId(r.id);
    try {
      await api.delete(`/data-collection/teachers/development/${r.id}`);
      showToast('success', 'Record deleted and moved to recycle bin');
      await loadAllRecords();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Failed to delete the record.'));
    } finally {
      setDeletingId(null);
    }
  };

  const setField = (k: keyof Omit<FormState, 'headTeacherLeadership'>, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!month) { setError('Please select a month.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/data-collection/teachers/development', {
        schoolId,
        academicYear: Number(academicYear),
        month,
        onlineRefresher: toNum(form.onlineRefresher),
        offlineRefresher: toNum(form.offlineRefresher),
        developmentForum: toNum(form.developmentForum),
        basicTraining: toNum(form.basicTraining),
        subjectBasedTraining: toNum(form.subjectBasedTraining),
        leadershipTraining: toNum(form.leadershipTraining),
        others: toNum(form.others),
        teacherDropoutRate: toNum(form.teacherDropoutRate),
        headTeacherDropoutRate: toNum(form.headTeacherDropoutRate),
        headTeacherLeadership: form.headTeacherLeadership,
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

  const teacherDevColumns: TableColumn<DcTeachersDevelopment>[] = [
    { key: 'academicYear', header: 'Academic Year', sortable: true },
    { key: 'month', header: 'Month', render: (r) => (
      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">{r.month}</span>
    )},
    { key: 'onlineRefresher', header: 'Online Ref.', className: 'text-right font-mono' },
    { key: 'offlineRefresher', header: 'Offline Ref.', className: 'text-right font-mono' },
    { key: 'developmentForum', header: 'Dev. Forum', className: 'text-right font-mono' },
    { key: 'basicTraining', header: 'Basic Train.', className: 'text-right font-mono' },
    { key: 'subjectBasedTraining', header: 'Subject Train.', className: 'text-right font-mono' },
    { key: 'leadershipTraining', header: 'Leadership', className: 'text-right font-mono' },
    { key: 'others', header: 'Others', className: 'text-right font-mono' },
    { key: 'total', header: 'Total', className: 'text-right', render: (r) => {
      const total = r.onlineRefresher + r.offlineRefresher + r.developmentForum +
        r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others;
      return <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-700 text-sm">{total}</span>;
    }},
    { key: 'updatedAt', header: 'Updated At', render: (r) => <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.updatedAt)}</span> },
  ];

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
        <div className={`fixed right-4 top-4 z-50 flex min-w-[280px] max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
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
                        onChange={(e) => setField(key, e.target.value)}
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
                        onChange={(e) => setField('teacherDropoutRate', e.target.value)}
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
                        onChange={(e) => setField('headTeacherDropoutRate', e.target.value)}
                        placeholder="0"
                        disabled={!academicYear || !month}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-gray-600">Head Teacher Leadership</Label>
                      <select
                        value={form.headTeacherLeadership}
                        onChange={(e) => setForm((prev) => ({ ...prev, headTeacherLeadership: e.target.value as HeadTeacherLeadership }))}
                        disabled={!academicYear || !month}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                      >
                        {LEADERSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
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

      {tab === 'data' && (
      <DataTable<DcTeachersDevelopment>
        columns={teacherDevColumns}
        data={allRecords}
        loading={loadingAll}
        searchable
        searchPlaceholder="Search by month, year..."
        title="Submitted Development Records"
        titleIcon={<BookOpen size={18} />}
        badge={<span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{allRecords.length}</span>}
        emptyMessage="No development records yet. Select a month and submit data above."
        emptyIcon={<BookOpen size={40} className="mb-3 opacity-30" />}
        onRefresh={loadAllRecords}
        refreshing={loadingAll}
        onRowClick={(r) => handleRecordClick(r)}
        actions={(r) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => handleEditRecord(r)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50 transition-colors"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRecord(r)}
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
        rowClassName={(r) =>
          month === r.month && Number(academicYear) === Number(r.academicYear) ? 'ring-inset ring-2 ring-rose-300' : ''
        }
        footer={allRecords.length > 1 ? (
          <div className="flex items-center px-4 py-3">
            <span className="text-xs font-bold text-rose-700">Totals</span>
          </div>
        ) : undefined}
        headerExtra={
          <ExportButtons
            payload={{
              filename: 'teachers-development',
              headers: ['Academic Year', 'Month', 'Online Ref.', 'Offline Ref.', 'Dev. Forum', 'Basic Train.', 'Subject Train.', 'Leadership', 'Others', 'Total', 'Updated At'],
              rows: allRecords.map((r) => [
                r.academicYear,
                r.month,
                r.onlineRefresher,
                r.offlineRefresher,
                r.developmentForum,
                r.basicTraining,
                r.subjectBasedTraining,
                r.leadershipTraining,
                r.others,
                r.onlineRefresher + r.offlineRefresher + r.developmentForum
                  + r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others,
                r.updatedAt ? formatDateTime(r.updatedAt) : '',
              ]),
            }}
          />
        }
      />
      )}
    </div>
  );
}
