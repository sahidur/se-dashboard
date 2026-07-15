'use client';

import { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { DcSchool, DcStudentsPerformance } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const GRADES = ['Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5'];
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

interface ProgressFields {
  progressGood: string;
  progressSatisfactory: string;
  progressNeedImprove: string;
}

interface FormState extends GradeWiseFields, ProgressFields {
  grade: string;
  numberOfStudents: string;
  examName: string;
  studentsAppearedPercent: string;
}

const BLANK: FormState = {
  grade: '', numberOfStudents: '', examName: '', studentsAppearedPercent: '',
  gradeAPlus: '', gradeA: '', gradeAMinus: '', gradeB: '', gradeC: '', gradeD: '', gradeF: '',
  progressGood: '', progressSatisfactory: '', progressNeedImprove: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function StudentsPerformanceForm({ schoolId }: Props) {
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcStudentsPerformance[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const isPlayLearn = form.grade === 'Play & Learn';
  const gradeSumPreview = GRADE_FIELDS.reduce((sum, { key }) => sum + (form[key] !== '' ? Number(form[key]) : 0), 0);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId]);

  const loadRecords = () => {
    api.get(`/data-collection/students-performance/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  };

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputsDisabled = !form.grade || !form.examName;

  const resetForm = () => {
    setForm(BLANK);
    setEditingId(null);
    setError('');
  };

  const handleEdit = (rec: DcStudentsPerformance) => {
    setForm({
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
    });
    setEditingId(rec.id);
    setError('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this students\u2019 performance record?')) return;
    try {
      await api.delete(`/data-collection/students-performance/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch {
      showToast('error', 'Failed to delete record.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.grade) { setError('Please select a grade.'); return; }
    if (!form.examName) { setError('Please select an exam name.'); return; }

    const gradeSum = GRADE_FIELDS.reduce((sum, { key }) => sum + (form[key] !== '' ? Number(form[key]) : 0), 0);
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
        grade: form.grade,
        examName: form.examName,
        numberOfStudents: totalStudents,
        studentsAppearedPercent: form.studentsAppearedPercent !== '' ? Number(form.studentsAppearedPercent) : undefined,
      };
      for (const { key } of GRADE_FIELDS) {
        payload[key] = form[key] !== '' ? Number(form[key]) : 0;
      }
      if (isPlayLearn) {
        for (const { key } of PROGRESS_FIELDS) {
          payload[key] = form[key] !== '' ? Number(form[key]) : 0;
        }
      }
      await api.post('/data-collection/students-performance', payload);
      showToast('success', `Performance data for ${form.grade} / ${form.examName} saved.`);
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

  const groupedByGrade = GRADES.map((g) => ({
    grade: g,
    rows: records.filter((r) => r.grade === g),
  })).filter((g) => g.rows.length > 0);

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

      <div ref={formRef}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-teal-500" />
              {editingId ? 'Edit Performance Record' : 'Add Performance Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Select a grade and exam, then enter student counts and grade-wise results.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
                  >
                    <option value="">Select grade…</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Number of Students
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={!form.grade}
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
                    disabled={!form.grade}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select exam…</option>
                    {EXAM_NAMES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Students Appeared in the Exam (%)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={!form.grade || !form.examName}
                    value={form.studentsAppearedPercent}
                    onChange={(e) => set('studentsAppearedPercent', e.target.value)}
                    placeholder="0"
                    className="disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Grade-wise (Exam) Students Number
                </p>
                <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {GRADE_FIELDS.map(({ key, label }) => (
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
                    <AlertCircle size={12} /> Please select a grade and exam name to enable input fields.
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
                    Progress Indicators <span className="text-xs font-normal text-gray-400">(Play &amp; Learn only)</span>
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
                <Button type="submit" disabled={saving || inputsDisabled} className="gap-2">
                  <Save size={15} />
                  {saving ? 'Saving…' : editingId ? 'Update Record' : 'Save Record'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {groupedByGrade.map(({ grade, rows }) => (
        <Card key={grade} className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              {grade}
              <Badge variant="default">{rows.length} exam{rows.length > 1 ? 's' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Exam</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Students</th>
                    {GRADE_FIELDS.map(({ label }) => (
                      <th key={label} className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">{label}</th>
                    ))}
                    <th className="py-2 text-right text-gray-500 uppercase tracking-wider font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3">
                        <Badge variant="default" className="text-teal-700 border-teal-200 bg-teal-50 font-medium">
                          {rec.examName}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-700 font-medium">{rec.numberOfStudents}</td>
                      {GRADE_FIELDS.map(({ key }) => (
                        <td key={key} className="py-2.5 pr-3 text-right text-gray-700 font-medium">
                          {rec[key as keyof DcStudentsPerformance] ?? 0}
                        </td>
                      ))}
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(rec)} className="h-6 px-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(rec.id)} className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
