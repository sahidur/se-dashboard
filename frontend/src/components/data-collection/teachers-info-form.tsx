'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, Users, School, MapPin,
  BookOpen, Trash2, X, Plus, RefreshCw, TableProperties, ChevronDown, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { ExportButtons, exportPayloadFromColumns } from '@/components/data-collection/export-buttons';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool, DcTeacherIndividual } from '@/types';

/* ─── Constants ────────────────────────────────────────── */

const YEARS = buildYearOptions();
const DESIGNATIONS = ['Head Teacher', 'Assistant Teacher', 'Junior Teacher'];
const GENDERS = ['Male', 'Female'];
const QUALIFICATIONS = ['HSC', 'Hons', 'Masters'];

const SUBJECT_OPTIONS = ['Math', 'Science', 'Bangla', 'English', 'Others'];
const TRAINING_OPTIONS = ['Basic', 'Subject-based', 'Leadership', 'Others'];

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
  academicYear: string;
  name: string;
  designation: string;
  gender: string;
  educationalQualification: string;
  experienceYears: number;
  subjectExpertise: string[];
  subjectOther: string;
  trainingReceived: string[];
  trainingOther: string;
  assessmentScore: number | '';
}

const BLANK_FORM: FormState = {
  academicYear: '',
  name: '',
  designation: '',
  gender: '',
  educationalQualification: '',
  experienceYears: 0,
  subjectExpertise: [],
  subjectOther: '',
  trainingReceived: [],
  trainingOther: '',
  assessmentScore: '',
};

interface Props { schoolId: string }

/* ─── MultiSelect Component ─────────────────────────────── */
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
  label: string;
}

function MultiSelect({ options, selected, onChange, otherValue, onOtherChange, label }: MultiSelectProps) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };
  const hasOthers = selected.includes('Others');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              selected.includes(opt)
                ? 'border-pink-400 bg-pink-100 text-pink-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-pink-300 hover:text-pink-600'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {hasOthers && (
        <Input
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={`Specify other ${label.toLowerCase()}...`}
          className="mt-1 h-8 text-sm"
        />
      )}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export function TeachersInfoForm({ schoolId }: Props) {
  const router = useRouter();
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'teachers-individual'));
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [records, setRecords] = useState<DcTeacherIndividual[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const draft = useFormDraft<FormState>('teachers-info-entry', schoolId);
  const draftAppliedRef = useRef(false);

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

  /* Fetch existing records */
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const { data } = await api.get<DcTeacherIndividual[]>(
        `/data-collection/teachers/individual/school/${schoolId}`,
      );
      setRecords(data);
    } catch {
      showToast('error', 'Failed to load teacher records');
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [schoolId, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

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
    setForm(BLANK_FORM);
    setFieldErrors({});
    setError('');
  };

  /* Helpers */
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setFieldErrors((prev) => ({ ...prev, [k]: '' }));
  };

  /* Validate */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.academicYear) errs.academicYear = 'Please select an academic year.';
    if (form.academicYear && !isValidAcademicYear(form.academicYear)) errs.academicYear = 'Invalid year (1970-2100).';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.designation) errs.designation = 'Designation is required';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.educationalQualification) errs.educationalQualification = 'Qualification is required';
    if (form.assessmentScore !== '' && (Number(form.assessmentScore) < 0 || Number(form.assessmentScore) > 100)) {
      errs.assessmentScore = 'Score must be between 0 and 100';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* Build comma-separated values including custom Others */
  const buildList = (selected: string[], otherText: string) => {
    const parts = selected.filter((s) => s !== 'Others');
    if (selected.includes('Others') && otherText.trim()) parts.push(otherText.trim());
    else if (selected.includes('Others')) parts.push('Others');
    return parts.join(',');
  };

  /* Parse a stored comma-separated list back into chips + "Others" text. */
  const parseList = (raw: string | undefined, known: string[]): { selected: string[]; other: string } => {
    const items = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const knownSet = new Set(known.filter((k) => k !== 'Others'));
    const selected: string[] = [];
    const customs: string[] = [];
    items.forEach((i) => (knownSet.has(i) ? selected.push(i) : customs.push(i)));
    if (items.includes('Others') || customs.length > 0) selected.push('Others');
    return { selected, other: customs.join(', ') };
  };

  /* Load an existing record into the form for editing */
  const handleEdit = (r: DcTeacherIndividual) => {
    if (!canEditSubmitted) {
      showToast('error', 'You do not have permission to edit submitted data');
      return;
    }
    const subjects = parseList(r.subjectExpertise, SUBJECT_OPTIONS);
    const trainings = parseList(r.trainingReceived, TRAINING_OPTIONS);
    setForm({
      academicYear: r.academicYear != null ? String(r.academicYear) : '',
      name: r.name,
      designation: r.designation,
      gender: r.gender,
      educationalQualification: r.educationalQualification,
      experienceYears: Number(r.experienceYears ?? 0),
      subjectExpertise: subjects.selected,
      subjectOther: subjects.other,
      trainingReceived: trainings.selected,
      trainingOther: trainings.other,
      assessmentScore: r.assessmentScore != null ? Number(r.assessmentScore) : '',
    });
    setEditingId(r.id);
    setEditingName(r.name);
    setError('');
    setFieldErrors({});
    setTab('entry');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setForm(BLANK_FORM);
    setFieldErrors({});
    setError('');
  };

  /* Submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        academicYear: Number(form.academicYear),
        name: form.name.trim(),
        designation: form.designation,
        gender: form.gender,
        educationalQualification: form.educationalQualification,
        experienceYears: Number(form.experienceYears) || 0,
        subjectExpertise: buildList(form.subjectExpertise, form.subjectOther) || undefined,
        trainingReceived: buildList(form.trainingReceived, form.trainingOther) || undefined,
        assessmentScore: form.assessmentScore !== '' ? Number(form.assessmentScore) : undefined,
      };
      if (editingId) {
        await api.patch(`/data-collection/teachers/individual/${editingId}`, payload);
      } else {
        await api.post('/data-collection/teachers/individual', { schoolId, ...payload });
      }
      showToast('success', editingId
        ? `${form.name.trim()} updated successfully!`
        : `${form.name.trim()} added successfully!`);
      setEditingId(null);
      setEditingName('');
      setForm(BLANK_FORM);
      await draft.clearDraft();
      await loadRecords();
      setTab('data');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const errText = anyErr?.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(errText);
      showToast('error', errText);
    } finally {
      setSaving(false);
    }
  };

  /* Delete */
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the list?`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/data-collection/teachers/individual/${id}`);
      showToast('success', `${name} removed and moved to recycle bin.`);
      await loadRecords();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to remove teacher record.'));
    } finally {
      setDeletingId(null);
    }
  };

  /* Format comma-separated for display */
  const fmtList = (raw?: string) =>
    raw ? raw.split(',').map((s) => s.trim()).filter(Boolean).join(' • ') : '—';

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  const teacherInfoColumns: TableColumn<DcTeacherIndividual>[] = [
    { key: 'academicYear', header: 'Academic Year', sortable: true },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-semibold text-gray-900 whitespace-nowrap">{r.name}</span> },
    { key: 'designation', header: 'Designation', render: (r) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        r.designation === 'Head Teacher' ? 'bg-purple-100 text-purple-700'
        : r.designation === 'Assistant Teacher' ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-700'
      }`}>{r.designation}</span>
    )},
    { key: 'gender', header: 'Gender', render: (r) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        r.gender === 'Male' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'
      }`}>{r.gender}</span>
    )},
    { key: 'educationalQualification', header: 'Qualification' },
    { key: 'experienceYears', header: 'Exp. (Yrs)', className: 'text-right font-mono', render: (r) => <span className="font-semibold">{Number(r.experienceYears).toFixed(1)}</span> },
    { key: 'subjectExpertise', header: 'Subjects', render: (r) => <span className="text-xs max-w-[160px] block">{fmtList(r.subjectExpertise)}</span> },
    { key: 'trainingReceived', header: 'Training', render: (r) => <span className="text-xs max-w-[160px] block">{fmtList(r.trainingReceived)}</span> },
    { key: 'assessmentScore', header: 'Score', className: 'text-right', render: (r) => (
      r.assessmentScore != null ? (
        <span className={`font-semibold text-sm ${
          Number(r.assessmentScore) >= 80 ? 'text-emerald-600' :
          Number(r.assessmentScore) >= 60 ? 'text-amber-600' : 'text-red-600'
        }`}>{Number(r.assessmentScore).toFixed(0)}</span>
      ) : <span>—</span>
    )},
    { key: 'createdAt', header: 'Added At', render: (r) => <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
  ];

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-pink-700 text-white shadow-md">
              <Users size={26} />
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
                    <BookOpen size={12} /> {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={records.length > 0 ? 'success' : 'default'} className="gap-1">
                {records.length > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {records.length} Teacher{records.length !== 1 ? 's' : ''} Added
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <FormTabs active={tab} onChange={setTab} dataCount={records.length} />

      {/* ── Entry Form ── */}
      {tab === 'entry' && (
      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                {editingId ? <Pencil size={17} className="text-pink-600" /> : <Plus size={17} className="text-pink-600" />}
                {editingId ? `Edit Teacher Record — ${editingName}` : 'Add Teacher Record'}
              </CardTitle>
              {editingId && (
                <Button variant="outline" size="sm" onClick={handleCancelEdit} className="gap-1.5">
                  <X size={14} /> Cancel Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Row 1: Academic Year, Name & Designation */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    value={form.academicYear}
                    onChange={(e) => setField('academicYear', e.target.value)}
                    className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 ${fieldErrors.academicYear ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">Select academic year...</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
                {fieldErrors.academicYear && <p className="mt-1 text-xs text-red-500">{fieldErrors.academicYear}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Name of Teacher <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Full name"
                  className={fieldErrors.name ? 'border-red-400' : ''}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Designation <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    value={form.designation}
                    onChange={(e) => setField('designation', e.target.value)}
                    className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 ${fieldErrors.designation ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">Select designation...</option>
                    {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
                {fieldErrors.designation && <p className="mt-1 text-xs text-red-500">{fieldErrors.designation}</p>}
              </div>
            </div>

            {/* Row 2: Gender & Educational Qualification */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-2 block text-xs font-medium text-gray-600">
                  Gender <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-3">
                  {GENDERS.map((g) => (
                    <label key={g} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={form.gender === g}
                        onChange={() => setField('gender', g)}
                        className="accent-pink-600"
                      />
                      <span className="text-sm text-gray-700">{g}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.gender && <p className="mt-1 text-xs text-red-500">{fieldErrors.gender}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Educational Qualification <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    value={form.educationalQualification}
                    onChange={(e) => setField('educationalQualification', e.target.value)}
                    className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 ${fieldErrors.educationalQualification ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">Select qualification...</option>
                    {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                </div>
                {fieldErrors.educationalQualification && <p className="mt-1 text-xs text-red-500">{fieldErrors.educationalQualification}</p>}
              </div>
            </div>

            {/* Row 3: Experience & Assessment Score */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Work Experience in BRAC School (Years)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.experienceYears}
                  onChange={(e) => setField('experienceYears', Number(e.target.value))}
                  placeholder="e.g. 3.5"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Score in Teachers&apos; Assessment (0–100)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.assessmentScore}
                  onChange={(e) => setField('assessmentScore', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 85"
                  className={fieldErrors.assessmentScore ? 'border-red-400' : ''}
                />
                {fieldErrors.assessmentScore && <p className="mt-1 text-xs text-red-500">{fieldErrors.assessmentScore}</p>}
              </div>
            </div>

            {/* Subject Expertise */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-gray-600">Subject Expertise</Label>
              <MultiSelect
                label="Subject"
                options={SUBJECT_OPTIONS}
                selected={form.subjectExpertise}
                onChange={(v) => setField('subjectExpertise', v)}
                otherValue={form.subjectOther}
                onOtherChange={(v) => setField('subjectOther', v)}
              />
            </div>

            {/* Training Received */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-gray-600">Training Received</Label>
              <MultiSelect
                label="Training"
                options={TRAINING_OPTIONS}
                selected={form.trainingReceived}
                onChange={(v) => setField('trainingReceived', v)}
                otherValue={form.trainingOther}
                onOtherChange={(v) => setField('trainingOther', v)}
              />
            </div>

            {/* Actions */}
            <div className="pt-2">
              <DraftActionBar
                hasDraft={draft.hasDraft}
                draftSavedAt={draft.draftSavedAt}
                submitting={saving}
                onSaveDraft={handleSaveDraft}
                onClearDraft={handleClearDraft}
                submitLabel={editingId ? 'Update Teacher' : 'Add Teacher'}
                submittingLabel="Saving..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
      )}

      {tab === 'data' && (
      <DataTable<DcTeacherIndividual>
        columns={teacherInfoColumns}
        data={records}
        loading={loadingRecords}
        searchable
        searchPlaceholder="Search by name, subject..."
        title="All Teacher Records"
        titleIcon={<TableProperties size={18} />}
        badge={<span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">{records.length}</span>}
        emptyMessage="No teacher records yet. Add the first one above."
        emptyIcon={<Users size={40} className="mb-3 opacity-30" />}
        headerExtra={
          <ExportButtons
            payload={exportPayloadFromColumns(teacherInfoColumns, records, 'teachers-information', {
              experienceYears: (v) => Number(v ?? 0).toFixed(1),
              assessmentScore: (v) => (v == null ? '' : Number(v).toFixed(0)),
              createdAt: (v) =>
                v ? new Date(String(v)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
            })}
          />
        }
        onRefresh={loadRecords}
        refreshing={loadingRecords}
        actions={(r) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => handleEdit(r)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-pink-50 hover:text-pink-600 transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canDeleteSubmitted) { showToast('error', 'You do not have permission to delete submitted data'); return; }
                handleDelete(r.id, r.name);
              }}
              disabled={deletingId === r.id}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {deletingId === r.id
                ? <RefreshCw size={14} className="animate-spin" />
                : <Trash2 size={14} />}
            </button>
          </div>
        )}
      />
      )}
    </div>
  );
}
