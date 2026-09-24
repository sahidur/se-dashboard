'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  GraduationCap, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
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
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { isValidAcademicYear, gradeSortIndex } from '@/lib/utils';
import { useAcademicYearOptions } from '@/hooks/use-academic-year-options';
import type { DcSchool, DcStudentsPerformance } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

// Full grade range: secondary schools report results up to Grade 10.
const GRADES = ['Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];
const EXAM_NAMES = ['Half-yearly', 'Annual'];

const GRADE_FIELDS: { key: keyof GradeWiseFields; label: string }[] = [
  { key: 'gradeAPlus',  label: 'A+' },
  { key: 'gradeA',      label: 'A' },
  { key: 'gradeAMinus', label: 'A-' },
  { key: 'gradeB',      label: 'B' },
  { key: 'gradeC',      label: 'C' },
  { key: 'gradeD',      label: 'D' },
  { key: 'gradeF',      label: 'F' },
];

// BRAC Academy scale — replaces the A+…F grade fields for those schools.
const ACAD_GRADE_FIELDS: { key: keyof AcademyGradeFields; label: string }[] = [
  { key: 'academyExcellent',       label: 'Excellent' },
  { key: 'academyGood',            label: 'Good' },
  { key: 'academySatisfactory',    label: 'Satisfactory' },
  { key: 'academyImprovementNeeded', label: 'Improvement Needed' },
];

const PROGRESS_FIELDS: { key: keyof ProgressFields; label: string }[] = [
  { key: 'progressGood',         label: 'Good' },
  { key: 'progressSatisfactory', label: 'Satisfactory' },
  { key: 'progressNeedImprove',  label: 'Need to Improve' },
];

/* ─── Types ──────────────────────────────────────────────── */

interface GradeWiseFields {
  gradeAPlus: string;
  gradeA: string;
  gradeAMinus: string;
  gradeB: string;
  gradeC: string;
  gradeD: string;
  gradeF: string;
}

interface AcademyGradeFields {
  academyExcellent: string;
  academyGood: string;
  academySatisfactory: string;
  academyImprovementNeeded: string;
}

interface ProgressFields {
  progressGood: string;
  progressSatisfactory: string;
  progressNeedImprove: string;
}

interface FormState extends GradeWiseFields, AcademyGradeFields, ProgressFields {
  academicYear: string;
  grade: string;
  numberOfStudents: string;
  examName: string;
  studentsAppearedPercent: string;
}

const BLANK: FormState = {
  academicYear: '', grade: '', numberOfStudents: '', examName: '', studentsAppearedPercent: '',
  gradeAPlus: '', gradeA: '', gradeAMinus: '', gradeB: '', gradeC: '', gradeD: '', gradeF: '',
  academyExcellent: '', academyGood: '', academySatisfactory: '', academyImprovementNeeded: '',
  progressGood: '', progressSatisfactory: '', progressNeedImprove: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function StudentsPerformanceForm({ schoolId }: Props) {
  const YEARS = useAcademicYearOptions();
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'students-performance'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcStudentsPerformance[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<FormState>('students-performance-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const isPlayLearn = form.grade === 'Play & Learn';
  const isAcademy = school?.schoolCategory === 'brac_academy';
  // The grade scale used depends on the school category: BRAC Academy uses
  // Excellent/Good/Satisfactory/Improvement Needed; all others use A+…F.
  const activeGradeFields = isAcademy ? ACAD_GRADE_FIELDS : GRADE_FIELDS;
  const gradeSumPreview = activeGradeFields.reduce((sum, { key }) => sum + (form[key] !== '' ? Number(form[key]) : 0), 0);

  // Memoized so its identity is stable across renders (prevents repeated effects).
  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/students-performance/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId, loadRecords]);

  // Overlay the user's private draft (an in-progress unsubmitted new entry).
  useEffect(() => {
    if (draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        setForm(d);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveDraft = async () => {
    await draft.saveDraft(form);
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(BLANK);
  };

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputsDisabled = !form.academicYear || !form.grade || !form.examName;

  const resetForm = () => {
    setForm(BLANK);
    setEditingId(null);
    setError('');
  };

  const handleEdit = (rec: DcStudentsPerformance) => {
    setForm({
      academicYear: rec.academicYear ? String(rec.academicYear) : '',
      grade: rec.grade,
      numberOfStudents: String(rec.numberOfStudents ?? ''),
      examName: rec.examName,
      studentsAppearedPercent: rec.studentsAppearedPercent != null ? String(rec.studentsAppearedPercent) : '',
      gradeAPlus: String(rec.gradeAPlus ?? ''), gradeA: String(rec.gradeA ?? ''),
      gradeAMinus: String(rec.gradeAMinus ?? ''), gradeB: String(rec.gradeB ?? ''),
      gradeC: String(rec.gradeC ?? ''), gradeD: String(rec.gradeD ?? ''), gradeF: String(rec.gradeF ?? ''),
      progressGood: rec.progressGood != null ? String(rec.progressGood) : '',
      progressSatisfactory: rec.progressSatisfactory != null ? String(rec.progressSatisfactory) : '',
      progressNeedImprove: rec.progressNeedImprove != null ? String(rec.progressNeedImprove) : '',
      academyExcellent: rec.academyExcellent != null ? String(rec.academyExcellent) : '',
      academyGood: rec.academyGood != null ? String(rec.academyGood) : '',
      academySatisfactory: rec.academySatisfactory != null ? String(rec.academySatisfactory) : '',
      academyImprovementNeeded: rec.academyImprovementNeeded != null ? String(rec.academyImprovementNeeded) : '',
    });
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this students\u2019 performance record?')) return;
    try {
      await api.delete(`/data-collection/students-performance/${id}`);
      showToast('success', 'Record deleted and moved to recycle bin.');
      loadRecords();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to delete record.'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(form.academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!form.grade) { setError('Please select a grade.'); return; }
    if (!form.examName) { setError('Please select an exam name.'); return; }

    const gradeSum = activeGradeFields.reduce((sum, { key }) => sum + (form[key] !== '' ? Number(form[key]) : 0), 0);
    const totalStudents = form.numberOfStudents !== '' ? Number(form.numberOfStudents) : 0;
    if (totalStudents > 0 && gradeSum !== totalStudents) {
      setError(
        `Number of Students (${totalStudents}) does not match the sum of grade-wise results (${gradeSum}). Please correct the values.`,
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        schoolId,
        academicYear: Number(form.academicYear),
        grade: form.grade,
        examName: form.examName,
        numberOfStudents: totalStudents,
        studentsAppearedPercent: form.studentsAppearedPercent !== '' ? Number(form.studentsAppearedPercent) : undefined,
      };
      for (const { key } of GRADE_FIELDS) {
        payload[key] = form[key] !== '' ? Number(form[key]) : 0;
      }
      for (const { key } of ACAD_GRADE_FIELDS) {
        payload[key] = form[key] !== '' ? Number(form[key]) : 0;
      }
      if (isPlayLearn) {
        for (const { key } of PROGRESS_FIELDS) {
          payload[key] = form[key] !== '' ? Number(form[key]) : 0;
        }
      }
      await api.post('/data-collection/students-performance', payload);
      showToast('success', `Performance data for ${form.academicYear} / ${form.grade} / ${form.examName} saved.`);
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

  const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
    brac_academy: 'BRAC Academy', brac_primary: 'BRAC Primary', brac_secondary: 'BRAC Secondary',
  };

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => {
      const yDiff = b.academicYear - a.academicYear;
      if (yDiff !== 0) return yDiff;
      // gradeSortIndex keeps "G10" after "G9" (localeCompare puts G10 first)
      const ai = gradeSortIndex(a.grade);
      const bi = gradeSortIndex(b.grade);
      if (!Number.isNaN(ai) && !Number.isNaN(bi) && ai !== bi) return ai - bi;
      return a.examName.localeCompare(b.examName);
    }),
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow">
                <GraduationCap size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{school.name}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><School size={12} />{school.code}</span>
                  {school.address && <span className="flex items-center gap-1"><MapPin size={12} />{school.address}</span>}
                  {school.schoolCategory && (
                    <Badge variant="default" className="text-xs">
                      {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                    </Badge>
                  )}
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
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-teal-500" />
              {editingId ? 'Edit Performance Record' : 'Add Performance Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Select an academic year, grade and exam, then enter student counts and grade-wise results.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => { set('academicYear', e.target.value); set('grade', ''); set('examName', ''); }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
                  >
                    <option value="">Select academic year…</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                    disabled={!form.academicYear}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select grade…</option>
                    {GRADES.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, school?.schoolCategory)}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Number of Students
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={!form.academicYear || !form.grade}
                    value={form.numberOfStudents}
                    onChange={(e) => set('numberOfStudents', e.target.value)}
                    placeholder="0"
                    className="disabled:opacity-50"
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Exam Name <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.examName}
                    onChange={(e) => set('examName', e.target.value)}
                    disabled={!form.academicYear || !form.grade}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select exam…</option>
                    {EXAM_NAMES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Students Appeared in the Exam (Number)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={inputsDisabled}
                    value={form.studentsAppearedPercent}
                    onChange={(e) => set('studentsAppearedPercent', e.target.value)}
                    placeholder="0"
                    className="disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-gray-700">
                  {isAcademy ? 'Performance-wise Students Number' : 'Grade-wise (Exam) Students Number'}
                </p>
                <div className={`grid gap-3 ${isAcademy ? 'sm:grid-cols-4' : 'sm:grid-cols-4 lg:grid-cols-7'}`}>
                  {activeGradeFields.map(({ key, label }) => (
                    <div key={key}>
                      <Label className="mb-1 block text-xs text-gray-500">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        disabled={inputsDisabled}
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  ))}
                </div>
                {inputsDisabled && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Please select an academic year, grade and exam name to enable input fields.
                  </p>
                )}
                {!inputsDisabled && form.numberOfStudents !== '' && (
                  <p className={`mt-2 text-xs flex items-center gap-1 ${gradeSumPreview === Number(form.numberOfStudents) ? 'text-gray-500' : 'text-red-600'}`}>
                    {gradeSumPreview !== Number(form.numberOfStudents) && <AlertCircle size={12} />}
                    Grade-wise total: {gradeSumPreview} / Number of Students: {Number(form.numberOfStudents)}
                    {gradeSumPreview !== Number(form.numberOfStudents) && ' — these must match.'}
                  </p>
                )}
              </div>

              {isPlayLearn && (
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Progress Indicators <span className="text-xs font-normal text-gray-400">({getGradeDisplayName('Play & Learn', school?.schoolCategory)} only)</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PROGRESS_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <Label className="mb-1 block text-xs text-gray-500">{label}</Label>
                        <Input
                          type="number"
                          min={0}
                          disabled={inputsDisabled}
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                {editingId ? (
                  <>
                    <Button type="submit" disabled={saving || inputsDisabled} className="gap-2">
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
                      disabled={inputsDisabled}
                    />
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>

      {tab === 'data' && (
        records.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-14 text-gray-400">
              <GraduationCap size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No performance records yet.</p>
              <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add the first record.</p>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={[
              { key: 'academicYear', header: 'Academic Year', className: 'font-medium text-gray-700' },
              {
                key: 'grade',
                header: 'Grade',
                render: (rec) => getGradeDisplayName(rec.grade, school?.schoolCategory),
              },
              {
                key: 'examName',
                header: 'Exam',
                render: (rec) => (
                  <Badge variant="default" className="text-teal-700 border-teal-200 bg-teal-50 font-medium">
                    {rec.examName}
                  </Badge>
                ),
              },
              { key: 'numberOfStudents', header: 'Students', className: 'text-right font-medium text-gray-700' },
              ...activeGradeFields.map(({ key, label }) => ({
                key,
                header: label,
                className: 'text-right font-medium text-gray-700',
                render: (rec: DcStudentsPerformance) => rec[key as keyof DcStudentsPerformance] ?? 0,
              })),
            ]}
            data={sortedRecords}
            searchable
            searchPlaceholder="Search records..."
            title="Submitted Records"
            headerExtra={
              <ExportButtons
                payload={{
                  filename: 'students-academic-performance',
                  headers: ['Academic Year', 'Grade', 'Exam', 'Students', ...activeGradeFields.map((f) => f.label)],
                  rows: sortedRecords.map((rec) => [
                    rec.academicYear,
                    getGradeDisplayName(rec.grade, school?.schoolCategory),
                    rec.examName,
                    rec.numberOfStudents,
                    ...activeGradeFields.map((f) => rec[f.key as keyof DcStudentsPerformance] ?? 0),
                  ]),
                }}
              />
            }
            emptyMessage="No performance records yet."
            emptyIcon={<GraduationCap size={40} className="mb-3 opacity-20" />}
            actions={(rec) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!canEditSubmitted) { showToast('error', 'You do not have permission to edit submitted data'); return; }
                    handleEdit(rec);
                  }}
                  className="h-6 px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!canDeleteSubmitted) { showToast('error', 'You do not have permission to delete submitted data'); return; }
                    handleDelete(rec.id);
                  }}
                  className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            )}
          />
        )
      )}
    </div>
  );
}
