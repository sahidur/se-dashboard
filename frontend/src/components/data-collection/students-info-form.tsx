'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, Users, School,
  MapPin, BookOpen, ChevronDown, RefreshCw, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { useFormDraft } from '@/hooks/use-form-draft';
import { getGradeDisplayName } from '@/components/data-collection/student-performance-catalog';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcSchool, DcStudentsInfo } from '@/types';

/* ─── Constants ────────────────────────────────── */

const YEARS = buildYearOptions();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GRADES: { value: string; label: string }[] = [
  { value: 'play_learn', label: 'Play & Learn' },
  { value: 'nursery',    label: 'Nursery' },
  { value: 'g1',         label: 'Grade 1' },
  { value: 'g2',         label: 'Grade 2' },
  { value: 'g3',         label: 'Grade 3' },
  { value: 'g4',         label: 'Grade 4' },
  { value: 'g5',         label: 'Grade 5' },
  { value: 'g6',         label: 'Grade 6' },
  { value: 'g7',         label: 'Grade 7' },
  { value: 'g8',         label: 'Grade 8' },
  { value: 'g9',         label: 'Grade 9' },
  { value: 'g10',        label: 'Grade 10' },
];

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};
const SCHOOL_TYPE_LABELS: Record<string, string> = {
  plain_land: 'Plain Land',
  haor: 'Haor',
};

interface FormState {
  boys: number;
  girls: number;
  personsWithDisability: number;
  ethnic: number;
  attendanceRate: number;
  dropoutRate: number;
  replacedStudentsRate: number;
  retentionRate: number;
  remedialSupport: number;
}

const emptyForm: FormState = {
  boys: 0,
  girls: 0,
  personsWithDisability: 0,
  ethnic: 0,
  attendanceRate: 0,
  dropoutRate: 0,
  replacedStudentsRate: 0,
  retentionRate: 0,
  remedialSupport: 0,
};

type FieldErrors = Partial<Record<'academicYear' | 'month' | 'grade', string>>;

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function StudentsInfoForm({ schoolId }: Props) {
  const router = useRouter();

  const [school, setSchool]           = useState<DcSchool | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);

  const [academicYear, setAcademicYear] = useState('');
  const [month, setMonth]             = useState('');
  const [grade, setGrade]             = useState('');
  const [form, setForm]               = useState<FormState>(emptyForm);
  const [isEditing, setIsEditing]     = useState(false);  // true when existing record loaded

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError]             = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft = useFormDraft<{ academicYear: string; month: string; grade: string; form: FormState }>('students-info-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const [allRecords, setAllRecords] = useState<DcStudentsInfo[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  /* ── Load school info on mount ── */
  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}/dashboard`)
      .then(({ data }) => setSchool(data.school))
      .catch(() => router.push('/data-collection/schools'))
      .finally(() => setLoading(false));
  }, [schoolId, router]);

  const loadAllRecords = useCallback(() => {
    setLoadingAll(true);
    api.get<DcStudentsInfo[]>(`/data-collection/students/school/${schoolId}`)
      .then(({ data }) => setAllRecords(data))
      .catch(() => {
        showToast('error', 'Failed to load student records');
        setAllRecords([]);
      })
      .finally(() => setLoadingAll(false));
  }, [schoolId, showToast]);

  useEffect(() => { loadAllRecords(); }, [loadAllRecords]);

  /* Overlay the user's private draft (if any) once initial load has finished. */
  useEffect(() => {
    if (loading || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setMonth(d.month);
        setGrade(d.grade);
        setForm(d.form);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, month, grade, form });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(emptyForm);
  };

  /* ── Load entry when academic year + month + grade all selected ── */
  const loadEntry = useCallback(async (y: string, m: string, g: string) => {
    if (!y || !m || !g) return;
    setLoadingEntry(true);
    setError('');
    // Do NOT clear successMsg here — let it persist after save
    try {
      const all = await api.get<DcStudentsInfo[]>(
        `/data-collection/students/school/${schoolId}`,
      );
      const match = all.data.find(
        (r) => Number(r.academicYear) === Number(y) && r.month === m && r.grade === g,
      );
      if (match) {
        setForm({
          boys: match.boys,
          girls: match.girls,
          personsWithDisability: match.personsWithDisability,
          ethnic: match.ethnic,
          attendanceRate: Number(match.attendanceRate),
          dropoutRate: Number(match.dropoutRate),
          replacedStudentsRate: Number(match.replacedStudentsRate ?? 0),
          retentionRate: Number(match.retentionRate ?? 0),
          remedialSupport: match.remedialSupport,
        });
        setIsEditing(true);
      } else {
        setForm(emptyForm);
        setIsEditing(false);
      }
    } catch {
      setForm(emptyForm);
      setIsEditing(false);
    } finally {
      setLoadingEntry(false);
    }
  }, [schoolId]);

  const handleYearChange = (y: string) => {
    setAcademicYear(y);
    setFieldErrors((p) => { const n = { ...p }; delete n.academicYear; return n; });
    setSuccessMsg('');
    // Dependent selections are year-scoped — reset them.
    setMonth('');
    setGrade('');
    setForm(emptyForm);
    setIsEditing(false);
  };

  const handleMonthChange = (m: string) => {
    setMonth(m);
    setFieldErrors((p) => { const n = { ...p }; delete n.month; return n; });
    setSuccessMsg('');
    if (grade) loadEntry(academicYear, m, grade);
  };

  const handleGradeChange = (g: string) => {
    setGrade(g);
    setFieldErrors((p) => { const n = { ...p }; delete n.grade; return n; });
    setSuccessMsg('');
    if (month) loadEntry(academicYear, month, g);
  };

  const total = form.boys + form.girls;

  const setNum = (key: keyof FormState, val: string) => {
    const parsed = parseFloat(val);
    setForm((p) => ({ ...p, [key]: isNaN(parsed) ? 0 : parsed }));
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!month) errs.month = 'Please select a month';
    if (!grade) errs.grade = 'Please select a grade';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please select a month and grade before saving.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) {
      setFieldErrors((p) => ({ ...p, academicYear: 'Please select an academic year' }));
      setError('Please select an academic year.');
      return;
    }
    if (!validate()) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/data-collection/students', {
        schoolId,
        academicYear: Number(academicYear),
        month,
        grade,
        boys: form.boys,
        girls: form.girls,
        total,
        personsWithDisability: form.personsWithDisability,
        ethnic: form.ethnic,
        attendanceRate: form.attendanceRate,
        dropoutRate: form.dropoutRate,
        replacedStudentsRate: form.replacedStudentsRate,
        retentionRate: form.retentionRate,
        remedialSupport: form.remedialSupport,
      });
      const gradeName = getGradeDisplayName(GRADES.find((g) => g.value === grade)?.label ?? grade, school?.schoolCategory);
      const successText = `${month} — ${gradeName} saved successfully!`;
      setSuccessMsg(successText);
      showToast('success', successText);
      setIsEditing(true);
      await draft.clearDraft();
      await loadAllRecords();
      // Auto-advance grade so user can quickly do next grade
      const idx = GRADES.findIndex((g) => g.value === grade);      
      if (idx !== -1 && idx < GRADES.length - 1) {
        const nextGrade = GRADES[idx + 1].value;
        setGrade(nextGrade);
        loadEntry(academicYear, month, nextGrade);
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const errText = anyErr?.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(errText);
      showToast('error', errText);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Derived ─── */
  const fieldsDisabled = !academicYear || !month || !grade || loadingEntry;
  const gradeLabel = getGradeDisplayName(GRADES.find((g) => g.value === grade)?.label ?? '', school?.schoolCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast notification (fixed top-right) ── */}
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

      {/* ── School Info Header ── */}
      {school && (
        <div className="overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow">
              <School size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 leading-tight">{school.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {school.code && (
                  <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600 shadow-sm">
                    {school.code}
                  </span>
                )}
                {school.schoolCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    <BookOpen size={10} />
                    {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                  </span>
                )}
                {school.schoolType && (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                    {SCHOOL_TYPE_LABELS[school.schoolType] ?? school.schoolType}
                  </span>
                )}
                {[school.upazila, school.district, school.division].some(Boolean) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    <MapPin size={10} />
                    {[school.upazila, school.district, school.division].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FormTabs active={tab} onChange={setTab} dataCount={allRecords.length} />

      {tab === 'entry' && (
      <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Success banner ── */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 size={16} className="shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Section 1: Month & Grade selectors ── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">1</span>
            <Users size={17} className="text-violet-600" />
            Select Period &amp; Grade <span className="text-red-500 font-normal text-sm ml-1">*required</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Academic Year */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                Academic Year <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  value={academicYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className={`w-full appearance-none rounded-xl border-2 bg-white px-4 py-2.5 pr-9 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-300 ${
                    fieldErrors.academicYear ? 'border-red-300' : academicYear ? 'border-violet-400 text-violet-800' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">-- Select Academic Year --</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {fieldErrors.academicYear && <p className="mt-1 text-xs text-red-600">{fieldErrors.academicYear}</p>}
            </div>

            {/* Month */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                Month <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  disabled={!academicYear}
                  className={`w-full appearance-none rounded-xl border-2 bg-white px-4 py-2.5 pr-9 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                    fieldErrors.month ? 'border-red-300' : month ? 'border-violet-400 text-violet-800' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">-- Select Month --</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {fieldErrors.month && <p className="mt-1 text-xs text-red-600">{fieldErrors.month}</p>}
            </div>

            {/* Grade */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                Grade <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  value={grade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  disabled={!academicYear || !month}
                  className={`w-full appearance-none rounded-xl border-2 bg-white px-4 py-2.5 pr-9 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                    fieldErrors.grade ? 'border-red-300' : grade ? 'border-violet-400 text-violet-800' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">-- Select Grade --</option>
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>{getGradeDisplayName(g.label, school?.schoolCategory)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {fieldErrors.grade && <p className="mt-1 text-xs text-red-600">{fieldErrors.grade}</p>}
            </div>
          </div>

          {/* Loading indicator for entry lookup */}
          {loadingEntry && (
            <div className="mt-3 flex items-center gap-2 text-xs text-violet-600">
              <RefreshCw size={13} className="animate-spin" />
              Loading existing data…
            </div>
          )}

          {/* Edit badge */}
          {!loadingEntry && isEditing && academicYear && month && grade && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700">
              <RefreshCw size={13} />
              Existing record found — submitting will update it.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Enrollment ── */}
      <Card className={`overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md ${fieldsDisabled ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">2</span>
            <Users size={17} className="text-blue-600" />
            Enrollment
            {month && grade && (
              <span className="ml-auto text-xs font-normal text-gray-400">{month} — {gradeLabel}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField label="Boys" value={form.boys} disabled={fieldsDisabled}
              onChange={(v) => setNum('boys', v)} color="blue" />
            <NumberField label="Girls" value={form.girls} disabled={fieldsDisabled}
              onChange={(v) => setNum('girls', v)} color="pink" />
            {/* Total - auto-calculated */}
            <div className="group">
              <Label className="mb-1.5 block text-xs font-medium text-gray-500">Total</Label>
              <div className="flex h-10 items-center justify-center rounded-xl border-2 border-emerald-200 bg-emerald-50 text-lg font-extrabold text-emerald-700 select-none">
                {total}
              </div>
              <p className="mt-1 text-center text-[10px] text-gray-400">auto</p>
            </div>
            <NumberField label="Person with Disability" value={form.personsWithDisability} disabled={fieldsDisabled}
              onChange={(v) => setNum('personsWithDisability', v)} color="orange" />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Demographics & Performance ── */}
      <Card className={`overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md ${fieldsDisabled ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-xs font-bold text-teal-700">3</span>
            <Users size={17} className="text-teal-600" />
            Demographics &amp; Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <NumberField label="Ethnic" value={form.ethnic} disabled={fieldsDisabled}
              onChange={(v) => setNum('ethnic', v)} color="purple" />
            <PercentField label="Attendance Rate" value={form.attendanceRate} disabled={fieldsDisabled}
              onChange={(v) => setNum('attendanceRate', v)} />
            <PercentField label="Dropout Rate" value={form.dropoutRate} disabled={fieldsDisabled}
              onChange={(v) => setNum('dropoutRate', v)} />
            <PercentField label="Replaced Students' Rate" value={form.replacedStudentsRate} disabled={fieldsDisabled}
              onChange={(v) => setNum('replacedStudentsRate', v)} />
            <PercentField label="Retention Rate" value={form.retentionRate} disabled={fieldsDisabled}
              onChange={(v) => setNum('retentionRate', v)} />
            <NumberField label="Remedial Support" value={form.remedialSupport} disabled={fieldsDisabled}
              onChange={(v) => setNum('remedialSupport', v)} color="slate" />
          </div>
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
        <DraftActionBar
          hasDraft={draft.hasDraft}
          draftSavedAt={draft.draftSavedAt}
          submitting={saving}
          onSaveDraft={handleSaveDraft}
          onClearDraft={handleClearDraft}
          submitLabel={isEditing ? 'Update Entry' : 'Save Entry'}
          submittingLabel="Saving..."
          disabled={fieldsDisabled}
        />
      </div>
    </form>
    )}

    {tab === 'data' && (
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-violet-600" />
            <h3 className="font-semibold text-gray-800">All Students Info Records</h3>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{allRecords.length}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={loadAllRecords} disabled={loadingAll} className="gap-1.5 text-xs">
            <RefreshCw size={13} className={loadingAll ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {loadingAll ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          </div>
        ) : allRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Users size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No student info records yet.</p>
            <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add the first record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Academic Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Grade</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Boys</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Girls</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">PwD</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Ethnic</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Attendance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Dropout</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Replaced</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Retention</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">Remedial</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Submitted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allRecords.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.academicYear ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.month}</td>
                    <td className="px-4 py-3 text-gray-700">{getGradeDisplayName(GRADES.find((g) => g.value === r.grade)?.label ?? r.grade, school?.schoolCategory)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.boys}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.girls}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.total}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.personsWithDisability}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.ethnic}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{Number(r.attendanceRate).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{Number(r.dropoutRate).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{Number(r.replacedStudentsRate ?? 0).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{Number(r.retentionRate ?? 0).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.remedialSupport}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function NumberField({
  label, value, onChange, disabled, color = 'gray',
}: {
  label: string; value: number; onChange: (v: string) => void; disabled?: boolean; color?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'focus:ring-blue-300',
    pink:   'focus:ring-pink-300',
    orange: 'focus:ring-orange-300',
    purple: 'focus:ring-purple-300',
    slate:  'focus:ring-slate-300',
    gray:   'focus:ring-gray-300',
  };
  return (
    <div className="group">
      <Label className="mb-1.5 block text-xs font-medium text-gray-500 transition-colors group-focus-within:text-gray-700 leading-tight">
        {label}
      </Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`text-center font-bold text-gray-800 transition-all focus:ring-2 ${colors[color] ?? colors.gray}`}
      />
    </div>
  );
}

function PercentField({
  label, value, onChange, disabled,
}: {
  label: string; value: number; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="group">
      <Label className="mb-1.5 block text-xs font-medium text-gray-500 transition-colors group-focus-within:text-teal-600 leading-tight">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pr-8 text-center font-bold text-gray-800 transition-all focus:ring-2 focus:ring-teal-300"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-teal-500">%</span>
      </div>
    </div>
  );
}
