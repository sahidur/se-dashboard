'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
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
import { getGradeDisplayName } from '@/components/data-collection/student-performance-catalog';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const YEARS = buildYearOptions();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GRADES = ['Play & Learn', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

const ACTIVITY_FIELDS: { key: keyof ActivityFields; label: string }[] = [
  { key: 'song',         label: 'Song' },
  { key: 'dance',        label: 'Dance' },
  { key: 'recitation',   label: 'Recitation' },
  { key: 'acting',       label: 'Acting' },
  { key: 'debate',       label: 'Debate' },
  { key: 'quiz',         label: 'Quiz' },
  { key: 'wallMagazine', label: 'Wall Magazine' },
  { key: 'indoorGame',   label: 'Indoor Game' },
  { key: 'outdoorGame',  label: 'Outdoor Game' },
  { key: 'others',       label: 'Others' },
];

/* ─── Types ──────────────────────────────────────────────── */

interface ActivityFields {
  song: string;
  dance: string;
  recitation: string;
  acting: string;
  debate: string;
  quiz: string;
  wallMagazine: string;
  indoorGame: string;
  outdoorGame: string;
  others: string;
}

interface FormState extends ActivityFields {
  academicYear: string;
  month: string;
  grade: string;
}

interface CocurricularRecord {
  id: string;
  academicYear: number;
  month: string;
  grade: string;
  song: number;
  dance: number;
  recitation: number;
  acting: number;
  debate: number;
  quiz: number;
  wallMagazine: number;
  indoorGame: number;
  outdoorGame: number;
  others: number;
  createdAt: string;
}

const BLANK: FormState = {
  academicYear: '', month: '', grade: '',
  song: '', dance: '', recitation: '', acting: '', debate: '',
  quiz: '', wallMagazine: '', indoorGame: '', outdoorGame: '', others: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function CocurricularForm({ schoolId }: Props) {
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<CocurricularRecord[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<FormState>('cocurricular-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/cocurricular/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => showToast('error', 'Failed to load co-curricular records'));
  }, [schoolId, showToast]);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`)
      .then(({ data }) => setSchool(data))
      .catch(() => showToast('error', 'Failed to load school data'));
    loadRecords();
  }, [schoolId, loadRecords, showToast]);

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

  const monthDisabled = !form.academicYear;
  const inputsDisabled = !form.academicYear || !form.month;

  const resetForm = () => {
    setForm(BLANK);
    setEditingId(null);
    setError('');
  };

  const handleEdit = (rec: CocurricularRecord) => {
    setForm({
      academicYear: rec.academicYear ? String(rec.academicYear) : '',
      month: rec.month, grade: rec.grade,
      song: String(rec.song || ''), dance: String(rec.dance || ''),
      recitation: String(rec.recitation || ''), acting: String(rec.acting || ''),
      debate: String(rec.debate || ''), quiz: String(rec.quiz || ''),
      wallMagazine: String(rec.wallMagazine || ''), indoorGame: String(rec.indoorGame || ''),
      outdoorGame: String(rec.outdoorGame || ''), others: String(rec.others || ''),
    });
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this co-curricular record?')) return;
    try {
      await api.delete(`/data-collection/cocurricular/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch {
      showToast('error', 'Failed to delete record.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.academicYear) { setError('Please select an academic year.'); return; }
    if (!isValidAcademicYear(form.academicYear)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!form.month) { setError('Please select a month.'); return; }
    if (!form.grade) { setError('Please select a grade.'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        schoolId,
        academicYear: Number(form.academicYear),
        month: form.month,
        grade: form.grade,
      };
      for (const { key } of ACTIVITY_FIELDS) {
        payload[key] = form[key] !== '' ? Number(form[key]) : 0;
      }
      await api.post('/data-collection/cocurricular', payload);
      showToast('success', `Co-curricular data for ${form.academicYear} / ${form.month} / ${form.grade} saved.`);
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

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* School Info */}
      {school && (
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow">
                <Sparkles size={22} />
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

      {/* Entry Form */}
      {tab === 'entry' && (
      <div ref={formRef}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-purple-500" />
              {editingId ? 'Edit Co-curricular Record' : 'Add Co-curricular Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Select an academic year, month and grade, then enter students&apos; participation percentage (%) for each activity.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Academic Year + Month + Grade selectors */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Academic Year */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => { set('academicYear', e.target.value); set('month', ''); set('grade', ''); }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  >
                    <option value="">Select academic year…</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {/* Month */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Month <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.month}
                    onChange={(e) => { set('month', e.target.value); if (!e.target.value) set('grade', ''); }}
                    disabled={monthDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select month…</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Grade */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                    disabled={inputsDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select grade…</option>
                    {GRADES.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, school?.schoolCategory)}</option>)}
                  </select>
                </div>
              </div>

              {/* Activity Participation % */}
              <div>
                <p className="mb-3 text-sm font-medium text-gray-700">
                  Students&apos; Participation (%)
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {ACTIVITY_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <Label className="mb-1 block text-xs text-gray-500">{label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          disabled={inputsDisabled}
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          placeholder="0"
                          className="h-9 pr-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {inputsDisabled && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Please select an academic year and month to enable input fields.
                  </p>
                )}
              </div>

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
      </div>
      )}

      {/* Records Table — all records */}
      {tab === 'data' && (
        records.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-14 text-gray-400">
              <Sparkles size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No co-curricular records yet.</p>
              <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add the first record.</p>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={[
              { key: 'academicYear', header: 'Academic Year', className: 'font-medium text-gray-700' },
              { key: 'month', header: 'Month' },
              {
                key: 'grade',
                header: 'Grade',
                render: (rec) => (
                  <Badge variant="default" className="text-purple-700 border-purple-200 bg-purple-50 font-medium">
                    {getGradeDisplayName(rec.grade, school?.schoolCategory)}
                  </Badge>
                ),
              },
              ...ACTIVITY_FIELDS.map(({ key, label }) => ({
                key,
                header: label,
                className: 'text-right font-medium text-gray-700 whitespace-nowrap',
                render: (rec: CocurricularRecord) => Number(rec[key as keyof CocurricularRecord] ?? 0).toFixed(1) + '%',
              })),
            ]}
            data={records}
            searchable
            searchPlaceholder="Search records..."
            title="Co-curricular Records"
            emptyMessage="No co-curricular records yet."
            emptyIcon={<Sparkles size={40} className="mb-3 opacity-20" />}
            actions={(rec) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={!canEditSubmitted} onClick={() => handleEdit(rec)} title={canEditSubmitted ? undefined : 'You do not have permission to edit submitted data'} className="h-6 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(rec.id)} className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
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
