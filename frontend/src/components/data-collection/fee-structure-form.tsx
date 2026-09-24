'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, BookOpen, School,
  MapPin, Users, RefreshCw, X, History, ChevronDown, Pencil, Trash2, RotateCcw,
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
import { getGradeDisplayName } from '@/components/data-collection/student-performance-catalog';
import { ALL_FEE_KEYS, getFeeFieldsForCategory, SCHOOL_CATEGORY_LABELS } from '@/components/data-collection/school-category-fields';
import api, { getErrorMessage } from '@/lib/api';
import { isValidAcademicYear, gradeEquals } from '@/lib/utils';
import { useAcademicYearOptions } from '@/hooks/use-academic-year-options';
import { useAuthStore } from '@/store/auth-store';
import type { DcSchool, DcFeeStructure, DcFeeStructureLog } from '@/types';

/* ─── Constants ─────────────────────────────────── */


const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Full grade range: legacy records exist for Grade 6–10 even though this
// form is labeled "(Primary)" — extending the list keeps them visible/editable.
const GRADES = ['Play & Learn', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

interface FeeAmounts {
  // Fee fields kept as strings so inputs render blank instead of a
  // default "0"; they are converted to numbers at submit time.
  admissionFee: string;
  tuitionFee: string;
  sessionFee: string;
  assessmentFee: string;
  sportsFee: string;
  syllabusFee: string;
  admissionForm: string;
  testimonialFee: string;
  othersFee: string;
  transportFee: string;
  exerciseBookFee: string;
  labLibraryFee: string;
  projectClubFee: string;
  sscRegistrationFee: string;
  boatFee: string;
  terminalAssessment1Fee: string;
  terminalAssessment2Fee: string;
  formativeAssessmentFee: string;
  classroomLibraryFee: string;
  eventFee: string;
  playActivityFee: string;
}

const BLANK_AMOUNTS: FeeAmounts = {
  admissionFee: '', tuitionFee: '', sessionFee: '', assessmentFee: '',
  sportsFee: '', syllabusFee: '', admissionForm: '', testimonialFee: '',
  othersFee: '', transportFee: '', exerciseBookFee: '', labLibraryFee: '',
  projectClubFee: '', sscRegistrationFee: '', boatFee: '',
  terminalAssessment1Fee: '', terminalAssessment2Fee: '', formativeAssessmentFee: '',
  classroomLibraryFee: '', eventFee: '', playActivityFee: '',
};

const AMOUNT_KEYS = ALL_FEE_KEYS as (keyof FeeAmounts)[];

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  schoolId: string;
}

const gradeRank = (g: string) => {
  const idx = GRADES.findIndex((x) => gradeEquals(x, g));
  return idx === -1 ? GRADES.length : idx;
};

/* ─── Component ─────────────────────────────────────────── */

export function FeeStructureForm({ schoolId }: Props) {
  const YEARS = useAcademicYearOptions();
  const router = useRouter();
  const { hasPermission } = useAuthStore();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([...MONTHS]);
  const [grade, setGrade] = useState('');
  const [amounts, setAmounts] = useState<FeeAmounts>(BLANK_AMOUNTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [allRecords, setAllRecords] = useState<DcFeeStructure[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [logs, setLogs] = useState<DcFeeStructureLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const draft = useFormDraft<{ academicYear: string; selectedMonths: string[]; grade: string; amounts: FeeAmounts }>('fee-structure', schoolId);
  const draftAppliedRef = useRef(false);
  const skipAmountsRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const [dataYear, setDataYear] = useState('');
  const [dataGrade, setDataGrade] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = hasPermission('data-collection', 'update');
  const canEdit = hasPermission('data-collection-edit', 'update');
  const canDelete = hasPermission('data-collection', 'delete', 'fee-structure');

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
      const { data } = await api.get<DcFeeStructure[]>(`/data-collection/fee-structure/school/${schoolId}`);
      setAllRecords(data);
    } catch {
      showToast('error', 'Failed to load fee structure records');
      setAllRecords([]);
    } finally { setLoadingRecords(false); }
  }, [schoolId, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get<DcFeeStructureLog[]>(`/data-collection/fee-structure/logs/school/${schoolId}`);
      setLogs(data);
    } catch {
      showToast('error', 'Failed to load fee structure logs');
      setLogs([]);
    } finally { setLoadingLogs(false); }
  };

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const selectAllMonths = () => setSelectedMonths([...MONTHS]);
  const clearAllMonths = () => setSelectedMonths([]);

  /* Load existing fee data when a single month + grade is selected */
  useEffect(() => {
    if (skipAmountsRef.current) { skipAmountsRef.current = false; return; }
    if (academicYear && selectedMonths.length === 1 && grade) {
      const existing = allRecords.find(
        (r) => Number(r.academicYear) === Number(academicYear) && r.month === selectedMonths[0] && gradeEquals(r.grade, grade),
      );
      if (existing) {
        setAmounts(
          AMOUNT_KEYS.reduce((acc, k) => {
            acc[k] = existing[k] != null ? String(existing[k]) : '';
            return acc;
          }, {} as FeeAmounts),
        );
      } else {
        setAmounts(BLANK_AMOUNTS);
      }
    } else {
      setAmounts(BLANK_AMOUNTS);
    }
  }, [academicYear, selectedMonths, grade, allRecords]);

  /* Overlay the user's private draft (if any) once records have loaded. */
  useEffect(() => {
    if (loadingRecords || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        skipAmountsRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setSelectedMonths(d.selectedMonths);
        setGrade(d.grade);
        setAmounts(d.amounts);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRecords]);

  const feeFields = getFeeFieldsForCategory(school?.schoolCategory);

  const handleSaveDraft = async () => {
    await draft.saveDraft({ academicYear, selectedMonths, grade, amounts });
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setAmounts(BLANK_AMOUNTS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (selectedMonths.length === 0) { setError('Please select at least one month.'); return; }
    if (!grade) { setError('Please select a grade.'); return; }
    setSaving(true);
    setError('');
    try {
      await Promise.all(
        selectedMonths.map((month) =>
          api.post('/data-collection/fee-structure', {
            schoolId,
            academicYear: Number(academicYear),
            month,
            grade,
            ...Object.fromEntries(feeFields.map((f) => [f.key, toNum(amounts[f.key])])),
          }),
        ),
      );
      showToast('success', `Fee data saved for ${selectedMonths.length} month(s) — ${grade}`);
      draft.clearDraft();
      await loadRecords();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('en-BD').format(Number(n) || 0);

  const loadRecordIntoForm = useCallback((r: DcFeeStructure) => {
    setAcademicYear(String(r.academicYear ?? ''));
    setSelectedMonths([r.month]);
    setGrade(r.grade);
    setTab('entry');
  }, []);

  const handleEditRecord = useCallback((r: DcFeeStructure) => {
    if (!canEdit) { showToast('error', 'You do not have permission to edit submitted data'); return; }
    loadRecordIntoForm(r);
    showToast('success', 'Loaded for editing');
  }, [canEdit, loadRecordIntoForm, showToast]);

  const handleDeleteRecord = async (r: DcFeeStructure) => {
    if (!canDelete) { showToast('error', 'You do not have permission to delete submitted data'); return; }
    if (!window.confirm('Delete this fee structure record? It will be moved to the recycle bin.')) return;
    setDeletingId(r.id);
    try {
      await api.delete(`/data-collection/fee-structure/${r.id}`);
      showToast('success', 'Record deleted and moved to recycle bin');
      await loadRecords();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Failed to delete fee structure record'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  const yearRecords = academicYear
    ? allRecords.filter((r) => Number(r.academicYear) === Number(academicYear))
    : allRecords;
  const monthsDone = yearRecords.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.grade]) acc[r.grade] = [];
    if (!acc[r.grade].includes(r.month)) acc[r.grade].push(r.month);
    return acc;
  }, {});

  const dataRecords = allRecords.filter((r) => {
    if (dataYear && String(r.academicYear) !== dataYear) return false;
    if (dataGrade && !gradeEquals(r.grade, dataGrade)) return false;
    return true;
  });
  const sortedDataRecords = [...dataRecords].sort(
    (a, b) =>
      (Number(b.academicYear) - Number(a.academicYear)) ||
      (gradeRank(a.grade) - gradeRank(b.grade)) ||
      (MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
  );

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
      </div>
    );
  }

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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-md">
              <BookOpen size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {school.code}</span>
                {school.district && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {school.district}</span>}
                {school.schoolCategory && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users size={12} /> {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                  </span>
                )}
              </div>
            </div>
            <Badge variant={allRecords.length > 0 ? 'success' : 'default'} className="gap-1">
              {allRecords.length > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {allRecords.length} Records
            </Badge>
          </div>
          {/* Grade progress chips */}
          {Object.keys(monthsDone).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
               {GRADES.map((g) => {
                const cnt = monthsDone[g]?.length ?? 0;
                return cnt > 0 ? (
                  <span key={g} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {getGradeDisplayName(g, school?.schoolCategory)} <span className="font-bold">{cnt}/12</span>
                  </span>
                ) : null;
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
            <CardTitle className="text-base font-semibold text-gray-800">Fee Structure Entry</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Academic Year */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                Academic Year <span className="text-red-500">*</span>
              </Label>
              <div className="relative max-w-xs">
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">Choose an academic year...</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
              </div>
            </div>

            {/* Month multi-select */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-600">
                  Select Months <span className="text-red-500">*</span>
                  <span className="ml-2 text-gray-400 font-normal">({selectedMonths.length} selected)</span>
                </Label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllMonths} className="text-xs text-amber-600 hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={clearAllMonths} className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {MONTHS.map((m) => {
                  const selected = selectedMonths.includes(m);
                  const hasData = grade ? yearRecords.some((r) => r.month === m && gradeEquals(r.grade, grade)) : yearRecords.some((r) => r.month === m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`relative rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                        selected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {m.slice(0, 3)}
                      {hasData && (
                        <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${selected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Green dot = data already saved for that month. Selecting multiple months saves the same fee amounts for all.
              </p>
            </div>

            {/* Grade selector */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                Select Grade <span className="text-red-500">*</span>
              </Label>
              <div className="relative max-w-xs">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">Choose a grade...</option>
                  {GRADES.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, school?.schoolCategory)}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
              </div>
              {academicYear && selectedMonths.length === 1 && grade && yearRecords.some((r) => r.month === selectedMonths[0] && gradeEquals(r.grade, grade)) && (
                <p className="mt-1.5 text-xs font-medium text-amber-600">
                  Editing existing data for {selectedMonths[0]} {academicYear} — {getGradeDisplayName(grade, school?.schoolCategory)}
                </p>
              )}
            </div>

            {/* Fee amounts */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {feeFields.map(({ key, label, hint }) => (
                <div key={key}>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                    {label}
                    {hint && <span className="block text-[10px] text-gray-400 font-normal">{hint}</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      value={amounts[key]}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="BDT"
                      disabled={!academicYear || !grade || selectedMonths.length === 0}
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-gray-400">BDT</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Total: BDT {formatAmount(Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0))}
              </p>
              <DraftActionBar
                hasDraft={draft.hasDraft}
                draftSavedAt={draft.draftSavedAt}
                submitting={saving}
                onSaveDraft={handleSaveDraft}
                onClearDraft={handleClearDraft}
                submitLabel={selectedMonths.length > 1 ? `Submit (${selectedMonths.length} Months)` : `Submit ${selectedMonths[0] || 'Data'}`}
                disabled={!academicYear || selectedMonths.length === 0 || !grade}
              />
            </div>
          </CardContent>
        </Card>
      </form>
      )}

      {tab === 'data' && (
      <>
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">Academic Year</Label>
              <div className="relative w-44">
                <select
                  value={dataYear}
                  onChange={(e) => setDataYear(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">All Years</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">Grade</Label>
              <div className="relative w-48">
                <select
                  value={dataGrade}
                  onChange={(e) => setDataGrade(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">All Grades</option>
                  {GRADES.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, school?.schoolCategory)}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
              </div>
            </div>
            <p className="pb-2.5 text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{sortedDataRecords.length}</span> of {allRecords.length} records
            </p>
            <div className="ml-auto pb-1">
              <Button
                variant="outline" size="sm"
                onClick={() => { setDataYear(''); setDataGrade(''); }}
                className="gap-1.5 text-xs"
              >
                <RotateCcw size={13} /> Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── All Records Table ── */}
      <DataTable<DcFeeStructure & { _total?: number }>
        columns={[
          { key: 'academicYear', header: 'Academic Year', className: 'whitespace-nowrap' },
          {
            key: 'month',
            header: 'Month',
            render: (r) => (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">{r.month}</span>
            ),
          },
          ...feeFields.map((f) => ({
            key: f.key,
            header: f.label,
            className: 'whitespace-nowrap text-right font-mono text-xs',
            render: (r: DcFeeStructure) => formatAmount(Number(r[f.key] ?? 0)),
          })),
          {
            key: '_total',
            header: 'Total',
            className: 'text-right font-bold text-emerald-700 text-xs',
            render: (r) => {
              const total = feeFields.reduce((s, f) => s + Number(r[f.key] ?? 0), 0);
              return formatAmount(total);
            },
          },
          {
            key: 'updatedAt',
            header: 'Updated At',
            className: 'whitespace-nowrap text-gray-400',
            render: (r) => formatDateTime(r.updatedAt),
          },
        ]}
        data={sortedDataRecords.map((r) => ({
          ...r,
          _total: feeFields.reduce((s, f) => s + Number(r[f.key] ?? 0), 0),
        }))}
        loading={loadingRecords}
        emptyMessage={(dataYear || dataGrade) ? 'No records match the selected filters.' : 'No records yet.'}
        emptyIcon={<BookOpen size={32} className="mb-2 opacity-30" />}
        searchable
        searchPlaceholder="Search records..."
        title="Submitted Records"
        titleIcon={<BookOpen size={18} className="text-amber-600" />}
        badge={<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{dataRecords.length}</span>}
        headerExtra={
          <ExportButtons
            payload={{
              filename: 'fee-structure',
              headers: ['Academic Year', 'Month', 'Grade', ...feeFields.map((f) => f.label), 'Total', 'Updated At'],
              rows: sortedDataRecords.map((r) => [
                r.academicYear,
                r.month,
                getGradeDisplayName(r.grade, school?.schoolCategory),
                ...feeFields.map((f) => Number(r[f.key as keyof DcFeeStructure] ?? 0)),
                feeFields.reduce((s, f) => s + Number(r[f.key as keyof DcFeeStructure] ?? 0), 0),
                r.updatedAt ? formatDateTime(r.updatedAt) : '',
              ]),
            }}
          />
        }
        onRefresh={loadRecords}
        refreshing={loadingRecords}
        actions={(r) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button" variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); handleEditRecord(r); }}
              className="h-7 w-7 p-0 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
              title="Edit"
            >
              <Pencil size={13} />
            </Button>
            <Button
              type="button" variant="ghost" size="sm"
              disabled={deletingId === r.id}
              onClick={(e) => { e.stopPropagation(); handleDeleteRecord(r); }}
              className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              title="Delete"
            >
              {deletingId === r.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </Button>
          </div>
        )}
        onRowClick={(r) => loadRecordIntoForm(r)}
        rowClassName={(r) =>
          Number(academicYear) === Number(r.academicYear) && selectedMonths.length === 1 && selectedMonths[0] === r.month && gradeEquals(grade, r.grade)
            ? 'ring-inset ring-2 ring-amber-300'
            : ''
        }
        footer={<p className="px-1 py-1 text-xs text-gray-400">Click a row to load it into the form for editing.</p>}
      />

      {/* ── Edit Log (Admin only) ── */}
      {isAdmin && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-500" />
              <h3 className="font-semibold text-gray-700">Edit History</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{logs.length}</span>
              <span className="text-xs text-gray-400">(Admin only)</span>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => { if (!showLogs) loadLogs(); setShowLogs((p) => !p); }}
              disabled={loadingLogs}
              className="gap-1.5 text-xs"
            >
              {loadingLogs ? <RefreshCw size={13} className="animate-spin" /> : <History size={13} />}
              {showLogs ? 'Hide' : 'Show'} Log
            </Button>
          </div>
          {showLogs && (
            loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <History size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No edits recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <div key={log.id} className="px-5 py-4 hover:bg-gray-50/50">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{log.month}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{getGradeDisplayName(log.grade, school?.schoolCategory)}</span>
                      <span className="text-xs text-gray-500">
                        by <strong>{(log.editedBy as any)?.firstName ?? ''} {(log.editedBy as any)?.lastName ?? ''}</strong>
                      </span>
                      <span className="text-xs text-gray-400">{formatDateTime(log.editedAt)}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <p className="mb-2 text-xs font-semibold text-red-600">Previous Values</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {feeFields.map((f) => (
                            <div key={f.key} className="flex justify-between text-xs">
                              <span className="text-gray-500">{f.label}</span>
                              <span className="font-mono text-red-700">{formatAmount(Number((log.previousData as any)[f.key] ?? 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                        <p className="mb-2 text-xs font-semibold text-emerald-600">New Values</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {feeFields.map((f) => (
                            <div key={f.key} className="flex justify-between text-xs">
                              <span className="text-gray-500">{f.label}</span>
                              <span className="font-mono text-emerald-700">{formatAmount(Number((log.newData as any)[f.key] ?? 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </Card>
      )}
      </>
      )}
    </div>
  );
}
