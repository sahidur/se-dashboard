'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import {
  School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
  CalendarRange, ChevronDown, ChevronRight, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import {
  EVALUATION_PERIODS,
  getSection,
  getStudentPerformanceForm,
  getStudentPerformanceRows,
  type StudentPerformanceFormKey,
} from '@/components/data-collection/student-performance-catalog';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcSchool, DcStudentPerformance } from '@/types';

const YEARS = buildYearOptions();

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

/** Scale label -> percentage, as typed (kept as strings so inputs can be blank). */
type RowValues = Record<string, Record<string, string>>;

interface DraftShape {
  academicYear: string;
  grade: string;
  evaluationPeriod: string;
  numberOfStudents: string;
  appearedPercent: string;
  values: RowValues;
}

interface Props {
  schoolId: string;
  formKey: StudentPerformanceFormKey;
}

export function StudentPerformanceForm({ schoolId, formKey }: Props) {
  const def = getStudentPerformanceForm(formKey)!;
  const section = getSection(def.sectionKey)!;
  const rowDefs = useMemo(() => getStudentPerformanceRows(formKey), [formKey]);

  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));

  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcStudentPerformance[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [grade, setGrade] = useState(def.grades.length === 1 ? def.grades[0] : '');
  const [evaluationPeriod, setEvaluationPeriod] = useState('');
  const [numberOfStudents, setNumberOfStudents] = useState('');
  const [appearedPercent, setAppearedPercent] = useState('');
  const [values, setValues] = useState<RowValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const [expanded, setExpanded] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<DraftShape>(`student-performance-${formKey}`, schoolId);
  const draftAppliedRef = useRef(false);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/student-performance/school/${schoolId}`, { params: { formKey } })
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  }, [schoolId, formKey]);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId, loadRecords]);

  // Overlay the user's private draft (an in-progress, unsubmitted entry).
  useEffect(() => {
    if (draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d && !draftAppliedRef.current) {
        draftAppliedRef.current = true;
        setAcademicYear(d.academicYear ?? '');
        setGrade(d.grade ?? (def.grades.length === 1 ? def.grades[0] : ''));
        setEvaluationPeriod(d.evaluationPeriod ?? '');
        setNumberOfStudents(d.numberOfStudents ?? '');
        setAppearedPercent(d.appearedPercent ?? '');
        setValues(d.values ?? {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const currentDraft = (): DraftShape => ({
    academicYear, grade, evaluationPeriod, numberOfStudents, appearedPercent, values,
  });

  const resetForm = () => {
    setAcademicYear('');
    setGrade(def.grades.length === 1 ? def.grades[0] : '');
    setEvaluationPeriod('');
    setNumberOfStudents('');
    setAppearedPercent('');
    setValues({});
    setEditingId(null);
    setError('');
  };

  const handleSaveDraft = async () => { await draft.saveDraft(currentDraft()); };
  const handleClearDraft = async () => { await draft.clearDraft(); resetForm(); };

  const setCell = (code: string, scale: string, val: string) =>
    setValues((prev) => ({ ...prev, [code]: { ...(prev[code] ?? {}), [scale]: val } }));

  const cell = (code: string, scale: string) => values[code]?.[scale] ?? '';

  const rowTotal = (code: string) =>
    def.scale.reduce((sum, s) => sum + (Number(cell(code, s.label)) || 0), 0);

  /** Academic year gates the grade select, which in turn gates everything else. */
  const gradeDisabled = !academicYear;
  const periodDisabled = !academicYear || !grade;
  const gridDisabled = !academicYear || !grade || !evaluationPeriod;

  const filledRows = rowDefs.filter((r) => def.scale.some((s) => cell(r.code, s.label) !== '')).length;

  const handleEdit = (rec: DcStudentPerformance) => {
    const next: RowValues = {};
    for (const row of rec.rows ?? []) {
      next[row.code] = Object.fromEntries(
        Object.entries(row.values ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]),
      );
    }
    setAcademicYear(String(rec.academicYear ?? ''));
    setGrade(rec.grade);
    setEvaluationPeriod(rec.evaluationPeriod);
    setNumberOfStudents(String(rec.numberOfStudents ?? ''));
    setAppearedPercent(rec.appearedPercent != null ? String(rec.appearedPercent) : '');
    setValues(next);
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student performance record?')) return;
    try {
      await api.delete(`/data-collection/student-performance/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      showToast('error', Array.isArray(msg) ? msg[0] : (msg || 'Failed to delete record.'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!academicYear) { setError('Please select an academic year first.'); return; }
    if (!grade) { setError('Please select a grade.'); return; }
    if (!evaluationPeriod) { setError(`Please select a ${def.periodLabel.toLowerCase()}.`); return; }
    if (filledRows === 0) { setError(`Please enter performance figures for at least one ${def.rowHeader.toLowerCase().replace(/s$/, '')}.`); return; }

    setSaving(true);
    try {
      await api.post('/data-collection/student-performance', {
        schoolId,
        academicYear: Number(academicYear),
        formKey,
        grade,
        evaluationPeriod,
        numberOfStudents: numberOfStudents !== '' ? Number(numberOfStudents) : 0,
        appearedPercent: appearedPercent !== '' ? Number(appearedPercent) : undefined,
        rows: rowDefs.map((r) => ({
          code: r.code,
          label: r.label,
          ...(r.domain ? { domain: r.domain } : {}),
          values: Object.fromEntries(
            def.scale.map((s) => [s.label, cell(r.code, s.label) !== '' ? Number(cell(r.code, s.label)) : 0]),
          ),
        })),
      });
      showToast('success', `${academicYear} • ${grade} • ${evaluationPeriod} saved.`);
      await draft.clearDraft();
      resetForm();
      loadRecords();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      showToast('error', Array.isArray(msg) ? msg[0] : (msg || 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) =>
      (b.academicYear - a.academicYear)
      || a.grade.localeCompare(b.grade)
      || a.evaluationPeriod.localeCompare(b.evaluationPeriod)),
    [records],
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {school && (
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${section.color} text-white shadow`}>
                <def.icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-gray-900">{school.name}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><School size={12} />{school.code}</span>
                  {school.address && <span className="flex items-center gap-1"><MapPin size={12} />{school.address}</span>}
                  {school.schoolCategory && (
                    <Badge variant="default" className="text-xs">
                      {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                    </Badge>
                  )}
                  <Badge variant="default" className={`text-xs ${section.bg} ${section.text}`}>
                    {section.short} &bull; Form {def.formNo}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <FormTabs active={tab} onChange={setTab} dataCount={records.length} />

      <div ref={formRef}>
        {tab === 'entry' && (
          <Card className="overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-5 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
                <PlusCircle size={18} className={section.text} />
                {editingId ? 'Edit' : 'Add'} — {def.label}
              </CardTitle>
              <p className="mt-0.5 text-sm text-gray-500">{def.description}</p>
            </CardHeader>
            <CardContent className="px-4 pb-6 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── Header fields ── */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Academic Year <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <CalendarRange size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={academicYear}
                        onChange={(e) => {
                          setAcademicYear(e.target.value);
                          if (def.grades.length > 1) setGrade('');
                          setEvaluationPeriod('');
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      >
                        <option value="">Select academic year…</option>
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Grade <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={grade}
                      onChange={(e) => { setGrade(e.target.value); setEvaluationPeriod(''); }}
                      disabled={gradeDisabled}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {def.grades.length === 1
                        ? <option value={def.grades[0]}>{def.grades[0]}</option>
                        : <option value="">Select grade…</option>}
                      {def.grades.length > 1 && def.grades.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {gradeDisabled && (
                      <p className="mt-1 text-[11px] text-amber-600">Select an academic year first.</p>
                    )}
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                      {def.periodLabel} <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={evaluationPeriod}
                      onChange={(e) => setEvaluationPeriod(e.target.value)}
                      disabled={periodDisabled}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select period…</option>
                      {EVALUATION_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-gray-700">Number of Students</Label>
                    <Input
                      type="number"
                      min={0}
                      disabled={gridDisabled}
                      value={numberOfStudents}
                      onChange={(e) => setNumberOfStudents(e.target.value)}
                      placeholder="0"
                      className="disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-sm font-medium text-gray-700">{def.appearedLabel}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      disabled={gridDisabled}
                      value={appearedPercent}
                      onChange={(e) => setAppearedPercent(e.target.value)}
                      placeholder="0"
                      className="disabled:opacity-50"
                    />
                  </div>
                </div>

                {gridDisabled && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    Select an academic year, grade and {def.periodLabel.toLowerCase()} to unlock the
                    performance grid below.
                  </div>
                )}

                {/* ── Performance matrix ── */}
                <div className={gridDisabled ? 'pointer-events-none opacity-40' : ''}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <ListChecks size={15} className={section.text} />
                      Student Performance (%) by {def.rowHeader}
                    </p>
                    <span className="text-xs text-gray-400">{filledRows} of {rowDefs.length} filled</span>
                  </div>

                  {/* Desktop / tablet: matrix table */}
                  <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="w-10 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                          {def.grouped && (
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Domain</th>
                          )}
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{def.rowHeader}</th>
                          {def.scale.map((s) => (
                            <th key={s.label} className={`px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider ${s.tone}`}>
                              {s.label}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rowDefs.map((r, i) => {
                          const total = rowTotal(r.code);
                          const showDomain = def.grouped && (i === 0 || rowDefs[i - 1].domain !== r.domain);
                          const span = def.grouped
                            ? rowDefs.filter((x) => x.domain === r.domain).length
                            : 1;
                          return (
                            <tr key={r.code} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 align-top text-xs text-gray-400">{i + 1}</td>
                              {def.grouped && showDomain && (
                                <td rowSpan={span} className="border-r border-gray-100 bg-gray-50/50 px-3 py-2 align-top text-xs font-medium text-gray-600">
                                  {r.domain}
                                </td>
                              )}
                              <td className="px-3 py-2 align-top text-sm text-gray-700">{r.label}</td>
                              {def.scale.map((s) => (
                                <td key={s.label} className="px-2 py-2 align-top">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    value={cell(r.code, s.label)}
                                    onChange={(e) => setCell(r.code, s.label, e.target.value)}
                                    placeholder="0"
                                    aria-label={`${r.label} — ${s.label}`}
                                    className="h-9 w-full min-w-[64px] text-center text-sm"
                                  />
                                </td>
                              ))}
                              <td className={`px-3 py-2 text-right align-middle text-xs font-semibold tabular-nums ${
                                total === 0 ? 'text-gray-300' : Math.round(total) === 100 ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {total ? `${Math.round(total * 100) / 100}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: stacked cards */}
                  <div className="space-y-3 md:hidden">
                    {rowDefs.map((r, i) => {
                      const total = rowTotal(r.code);
                      return (
                        <div key={r.code} className="rounded-xl border border-gray-200 p-3">
                          {r.domain && (
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{r.domain}</p>
                          )}
                          <p className="mb-2.5 text-sm font-medium text-gray-700">
                            <span className="mr-1 text-gray-400">{i + 1}.</span>{r.label}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {def.scale.map((s) => (
                              <div key={s.label}>
                                <Label className={`mb-1 block rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${s.tone}`}>
                                  {s.label}
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.01}
                                  value={cell(r.code, s.label)}
                                  onChange={(e) => setCell(r.code, s.label, e.target.value)}
                                  placeholder="0"
                                  aria-label={`${r.label} — ${s.label}`}
                                  className="h-9 text-center text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <p className={`mt-2 text-right text-[11px] font-semibold tabular-nums ${
                            total === 0 ? 'text-gray-300' : Math.round(total) === 100 ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            Total: {total ? `${Math.round(total * 100) / 100}%` : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-[11px] text-gray-400">
                    Values are percentages of students; each row is expected to add up to 100%.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {editingId ? (
                    <>
                      <Button type="submit" disabled={saving || gridDisabled} className="gap-2">
                        <Save size={15} />
                        {saving ? 'Saving…' : 'Update Record'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                    </>
                  ) : (
                    <div className="w-full">
                      <DraftActionBar
                        hasDraft={draft.hasDraft}
                        draftSavedAt={draft.draftSavedAt}
                        submitting={saving}
                        onSaveDraft={handleSaveDraft}
                        onClearDraft={handleClearDraft}
                        submitLabel="Save Record"
                        submittingLabel="Saving…"
                        disabled={gridDisabled}
                      />
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Submitted data ── */}
      {tab === 'data' && (
        sortedRecords.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-14 text-gray-400">
              <def.icon size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No records submitted for this form yet.</p>
              <p className="mt-1 text-xs opacity-70">Use the Fill Form tab to add the first record.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-6">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Submitted Records <Badge variant="default">{sortedRecords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-4 sm:px-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-8 py-2 pl-4" />
                      <th className="py-2 pr-3 text-left font-semibold uppercase tracking-wider text-gray-500">Year</th>
                      <th className="py-2 pr-3 text-left font-semibold uppercase tracking-wider text-gray-500">Grade</th>
                      <th className="py-2 pr-3 text-left font-semibold uppercase tracking-wider text-gray-500">{def.periodLabel}</th>
                      <th className="py-2 pr-3 text-right font-semibold uppercase tracking-wider text-gray-500">Students</th>
                      <th className="py-2 pr-3 text-right font-semibold uppercase tracking-wider text-gray-500">Appeared %</th>
                      <th className="py-2 pr-4 text-right font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedRecords.map((rec) => (
                      <Fragment key={rec.id}>
                        <tr className="transition-colors hover:bg-gray-50">
                          <td className="py-2.5 pl-4">
                            <button
                              type="button"
                              onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                              aria-label={expanded === rec.id ? 'Collapse details' : 'Expand details'}
                              className="text-gray-400 hover:text-gray-700"
                            >
                              {expanded === rec.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-gray-700">{rec.academicYear || '—'}</td>
                          <td className="py-2.5 pr-3 text-gray-700">{rec.grade}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="default" className={`font-medium ${section.bg} ${section.text}`}>
                              {rec.evaluationPeriod}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium text-gray-700">{rec.numberOfStudents}</td>
                          <td className="py-2.5 pr-3 text-right font-medium text-gray-700">
                            {rec.appearedPercent != null ? `${Number(rec.appearedPercent)}%` : '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!canEditSubmitted}
                                onClick={() => handleEdit(rec)}
                                title={canEditSubmitted ? undefined : 'You do not have permission to edit submitted data'}
                                className="h-6 px-2 text-brand-600 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(rec.id)}
                                className="h-6 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded === rec.id && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50/60 px-4 py-3">
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full min-w-[560px] text-xs">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-gray-500">{def.rowHeader}</th>
                                      {def.scale.map((s) => (
                                        <th key={s.label} className={`px-3 py-2 text-center font-semibold uppercase tracking-wider ${s.tone}`}>
                                          {s.label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {(rec.rows ?? []).map((row) => (
                                      <tr key={row.code}>
                                        <td className="px-3 py-1.5 text-gray-700">
                                          {row.domain && <span className="mr-1 text-gray-400">{row.domain} —</span>}
                                          {row.label}
                                        </td>
                                        {def.scale.map((s) => (
                                          <td key={s.label} className="px-3 py-1.5 text-center tabular-nums text-gray-700">
                                            {row.values?.[s.label] ?? 0}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
