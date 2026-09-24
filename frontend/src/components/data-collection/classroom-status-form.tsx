'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, MapPin, BookOpen, School, AlertCircle,
  Monitor, Users, Columns3, ScanLine, Armchair, Wrench, Pencil, Trash2, RefreshCw,
  Package, Projector, Laptop, Cpu, DoorOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { ExportButtons } from '@/components/data-collection/export-buttons';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { isValidAcademicYear } from '@/lib/utils';
import { useAcademicYearOptions } from '@/hooks/use-academic-year-options';
import type { DcSchool } from '@/types';

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
  // Numeric fields kept as strings so inputs render blank instead of a
  // default "0"; they are converted to numbers at submit time.
  digitallyEquippedClassrooms: string;
  floorSittingClassrooms: string;
  classroomsWithWhiteboard: string;
  classroomsWithBlackboard: string;
  classroomNewFurniture: boolean | null;
  classroomRenovationRequired: boolean | null;
  classroomRenovationDetails: string;
  classroomEmergencyExit: boolean | null;
  infraTotalAssets: string;
  infraTotalProjectors: string;
  infraTotalLaptops: string;
  infraTotalPcs: string;
}

const defaultState: FormState = {
  academicYear: '',
  digitallyEquippedClassrooms: '',
  floorSittingClassrooms: '',
  classroomsWithWhiteboard: '',
  classroomsWithBlackboard: '',
  classroomNewFurniture: null,
  classroomRenovationRequired: null,
  classroomRenovationDetails: '',
  classroomEmergencyExit: null,
  infraTotalAssets: '',
  infraTotalProjectors: '',
  infraTotalLaptops: '',
  infraTotalPcs: '',
};

function mapRecord(d: Record<string, any>): FormState {
  return {
    academicYear: d.academicYear != null ? String(d.academicYear) : '',
    digitallyEquippedClassrooms: d.digitallyEquippedClassrooms ?? '',
    floorSittingClassrooms: d.floorSittingClassrooms ?? '',
    classroomsWithWhiteboard: d.classroomsWithWhiteboard ?? '',
    classroomsWithBlackboard: d.classroomsWithBlackboard ?? '',
    classroomNewFurniture: d.classroomNewFurniture ?? null,
    classroomRenovationRequired: d.classroomRenovationRequired ?? null,
    classroomRenovationDetails: d.classroomRenovationDetails ?? '',
    classroomEmergencyExit: d.classroomEmergencyExit ?? null,
    infraTotalAssets: d.infraTotalAssets ?? '',
    infraTotalProjectors: d.infraTotalProjectors ?? '',
    infraTotalLaptops: d.infraTotalLaptops ?? '',
    infraTotalPcs: d.infraTotalPcs ?? '',
  };
}

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface Props { schoolId: string }

const COUNT_FIELDS = [
  {
    key: 'digitallyEquippedClassrooms' as const,
    label: 'No. of Digitally Equipped Classrooms',
    icon: Monitor,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
  },
  {
    key: 'floorSittingClassrooms' as const,
    label: 'Number of Floor Sitting Classrooms',
    icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    key: 'classroomsWithWhiteboard' as const,
    label: 'Number of Classrooms with Whiteboard',
    icon: ScanLine,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'classroomsWithBlackboard' as const,
    label: 'Number of Classrooms with Blackboard',
    icon: Columns3,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
] as const;

type CountKey = (typeof COUNT_FIELDS)[number]['key'];

const INFRA_FIELDS = [
  {
    key: 'infraTotalAssets' as const,
    label: 'Total Number of Asset',
    icon: Package,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  {
    key: 'infraTotalProjectors' as const,
    label: 'Total Number of Projector',
    icon: Projector,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  {
    key: 'infraTotalLaptops' as const,
    label: 'Total Number of Laptop',
    icon: Laptop,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  {
    key: 'infraTotalPcs' as const,
    label: 'Total Number of PC',
    icon: Cpu,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
  },
] as const;

type InfraKey = (typeof INFRA_FIELDS)[number]['key'];

type ClassroomFieldErrors = Partial<
  Record<'academicYear' | 'classroomNewFurniture' | 'classroomRenovationRequired' | 'classroomRenovationDetails' | 'classroomEmergencyExit', string>
>;

export function ClassroomStatusForm({ schoolId }: Props) {
  const YEARS = useAcademicYearOptions();
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<FormState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ClassroomFieldErrors>({});
  const [loadingYear, setLoadingYear] = useState(false);
  const draft = useFormDraft<FormState>('classroom-status', schoolId);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');
  const [savedRecord, setSavedRecord] = useState<FormState | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'infrastructure'));
  const [editDenied, setEditDenied] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // "Edit" on the View Data tab: the existing record is already loaded into
  // the form, so switching back to the entry tab is the edit action.
  const handleEditRecord = () => {
    if (!canEditSubmitted) { setEditDenied(true); return; }
    setEditDenied(false);
    setTab('entry');
  };

  // "Delete" removes the entire yearly record. The shared entity also stores
  // the Infrastructure Status form's data for the same year, so both are
  // cleared — the confirm message makes that explicit.
  const handleDeleteRecord = async () => {
    if (!canDeleteSubmitted) {
      setNotice({ type: 'error', msg: 'You do not have permission to delete submitted data.' });
      return;
    }
    if (!savedRecordId) return;
    if (!window.confirm(
      'Delete this year\'s Infrastructure & Classroom record? This also clears the Infrastructure Status form for the same year. The record will be moved to the recycle bin.',
    )) return;
    setDeleting(true);
    setNotice(null);
    try {
      await api.delete(`/data-collection/infrastructure/${savedRecordId}`);
      setSavedRecord(null);
      setSavedRecordId(null);
      setNotice({ type: 'success', msg: 'Record deleted and moved to recycle bin.' });
    } catch (err: unknown) {
      setNotice({ type: 'error', msg: getErrorMessage(err, 'Failed to delete the record.') });
    } finally {
      setDeleting(false);
    }
  };

  // View Data tab export: one Field/Value row per data point of the record.
  const exportPayload = savedRecord
    ? {
        filename: 'classroom-status',
        headers: ['Field', 'Value'],
        rows: [
          ['Academic Year', savedRecord.academicYear || ''],
          ...COUNT_FIELDS.map(({ key, label }) => [label, String(savedRecord[key as keyof FormState] ?? 0)]),
          ['Classroom with New Designed Furniture', savedRecord.classroomNewFurniture ? 'Yes' : 'No'],
          ['Renovation Required', savedRecord.classroomRenovationRequired ? 'Yes' : 'No'],
          ['Renovation Details', savedRecord.classroomRenovationRequired ? (savedRecord.classroomRenovationDetails || '') : ''],
          ['Emergency Exit', savedRecord.classroomEmergencyExit ? 'Yes' : 'No'],
          ...INFRA_FIELDS.map(({ key, label }) => [label, String(savedRecord[key as keyof FormState] ?? 0)]),
        ] as (string | number | null | undefined)[][],
      }
    : null;

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, infraRes] = await Promise.all([
          api.get(`/data-collection/schools/${schoolId}/dashboard`),
          api.get(`/data-collection/infrastructure/school/${schoolId}`).catch(() => ({ data: null })),
        ]);
        setSchool(dashRes.data.school);
        const d = infraRes.data;
        if (d) {
          const loaded = mapRecord(d);
          setForm(loaded);
          setSavedRecord(loaded);
          setSavedRecordId(d.id);
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Unknown error';
        setError(`Failed to load school data: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schoolId]);

  // Overlay the user's private draft (if any) once initial data has loaded.
  useEffect(() => {
    if (loading) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) setForm(d);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSaveDraft = async () => {
    await draft.saveDraft(form);
    setError('');
    setFieldErrors({});
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(defaultState);
    setError('');
    setFieldErrors({});
  };

  // Changing the academic year reloads that year's record (or blanks the form).
  const handleYearChange = async (y: string) => {
    setForm((prev) => ({ ...prev, academicYear: y }));
    setError('');
    setFieldErrors((prev) => { const n = { ...prev }; delete n.academicYear; return n; });
    if (!y) { setSavedRecord(null); setSavedRecordId(null); return; }
    setLoadingYear(true);
    try {
      const { data } = await api.get(`/data-collection/infrastructure/school/${schoolId}?academicYear=${y}`);
      if (data) {
        const loaded = { ...mapRecord(data), academicYear: y };
        setForm(loaded);
        setSavedRecord(loaded);
        setSavedRecordId(data.id);
      } else {
        setForm({ ...defaultState, academicYear: y });
        setSavedRecord(null);
        setSavedRecordId(null);
      }
    } catch {
      setForm({ ...defaultState, academicYear: y });
      setSavedRecord(null);
      setSavedRecordId(null);
    } finally {
      setLoadingYear(false);
    }
  };

  const setNum = (key: CountKey | InfraKey, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setBool = (
    key: 'classroomNewFurniture' | 'classroomRenovationRequired' | 'classroomEmergencyExit',
    val: boolean,
  ) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const setDetails = (val: string) => {
    setForm((prev) => ({ ...prev, classroomRenovationDetails: val }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.classroomRenovationDetails; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.academicYear) {
      setFieldErrors({ academicYear: 'Required' });
      setError('Please select an academic year.');
      return;
    }
    if (!isValidAcademicYear(form.academicYear)) {
      setFieldErrors({ academicYear: 'Invalid year' });
      setError('Please select a valid academic year (1970-2100).');
      return;
    }
    // Validate required boolean fields
    const errs: ClassroomFieldErrors = {};
    if (form.classroomNewFurniture === null) errs.classroomNewFurniture = 'Required';
    if (form.classroomRenovationRequired === null) errs.classroomRenovationRequired = 'Required';
    if (form.classroomRenovationRequired === true && !form.classroomRenovationDetails.trim()) {
      errs.classroomRenovationDetails = 'Renovation details are required when renovation is required';
    }
    if (form.classroomEmergencyExit === null) errs.classroomEmergencyExit = 'Required';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please answer all required fields before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const { data: saved } = await api.post('/data-collection/infrastructure', {
        schoolId,
        academicYear: Number(form.academicYear),
        digitallyEquippedClassrooms: toNum(form.digitallyEquippedClassrooms),
        floorSittingClassrooms: toNum(form.floorSittingClassrooms),
        classroomsWithWhiteboard: toNum(form.classroomsWithWhiteboard),
        classroomsWithBlackboard: toNum(form.classroomsWithBlackboard),
        classroomNewFurniture: form.classroomNewFurniture ?? false,
        classroomRenovationRequired: form.classroomRenovationRequired ?? false,
        classroomRenovationDetails: form.classroomRenovationRequired
          ? form.classroomRenovationDetails.trim()
          : undefined,
        classroomEmergencyExit: form.classroomEmergencyExit ?? false,
        infraTotalAssets: toNum(form.infraTotalAssets),
        infraTotalProjectors: toNum(form.infraTotalProjectors),
        infraTotalLaptops: toNum(form.infraTotalLaptops),
        infraTotalPcs: toNum(form.infraTotalPcs),
      });
      await draft.clearDraft();
      setSavedRecord(form);
      setSavedRecordId(saved?.id ?? null);
      setSaved(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-100 animate-ping opacity-30" />
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-100">
            <CheckCircle2 size={52} className="text-cyan-600" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Classroom Status Saved!</h2>
          <p className="mt-1 text-gray-500 max-w-sm">The classroom data has been successfully recorded.</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => setSaved(false)}>Edit Again</Button>
          <Button onClick={() => router.back()}>Back to Forms</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* ── School Info ─────────────────────────── */}
      {school && (
        <div className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white shadow-sm">
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-700">
                    <BookOpen size={10} />
                    {SCHOOL_CATEGORY_LABELS[school.schoolCategory] || school.schoolCategory}
                  </span>
                )}
                {school.schoolType && (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                    {SCHOOL_TYPE_LABELS[school.schoolType] || school.schoolType}
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

      <FormTabs
        active={tab}
        onChange={setTab}
        dataLabel="View Data"
        dataCount={savedRecord ? 1 : 0}
      />

      {tab === 'entry' && (
      <form onSubmit={handleSubmit} className="space-y-5">

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      {/* ── Academic Year ─────────────────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardContent className="px-5 py-5">
          <div className="max-w-xs">
            <Label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year <span className="text-red-500">*</span>
            </Label>
            <select
              value={form.academicYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 ${
                fieldErrors.academicYear ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select academic year…</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {fieldErrors.academicYear && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.academicYear}</p>
            )}
            {loadingYear && (
              <p className="mt-1.5 text-xs text-cyan-600">Loading {form.academicYear} data…</p>
            )}
          </div>
        </CardContent>
      </Card>
      {/* ── Section 1: Classroom Counts ─────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-xs font-bold text-cyan-700">1</span>
            <Columns3 size={17} className="text-cyan-600" />
            Classroom Count
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {COUNT_FIELDS.map(({ key, label, icon: Icon, color, bg, border }) => (
              <div
                key={key}
                className={`group flex items-center gap-4 rounded-2xl border ${border} ${bg} p-4 transition-all duration-200 hover:shadow-sm`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${color}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <Label className={`mb-1.5 block text-xs font-medium ${color} leading-tight`}>
                    {label}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => setNum(key, e.target.value)}
                    placeholder="0"
                    className="h-10 text-center text-xl font-bold text-gray-800 bg-white transition-all focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Yes/No Features ──────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">2</span>
            <Armchair size={17} className="text-violet-600" />
            Classroom Features <span className="text-red-500 font-normal text-sm ml-1">*all required</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <YesNoToggle
              label={<><Armchair size={15} className="shrink-0" /> Classroom with New Designed Furniture</>}
              value={form.classroomNewFurniture}
              onChange={(v) => setBool('classroomNewFurniture', v)}
              hasError={!!fieldErrors.classroomNewFurniture}
            />
            <YesNoToggle
              label={<><Wrench size={15} className="shrink-0" /> Renovation Required</>}
              value={form.classroomRenovationRequired}
              onChange={(v) => setBool('classroomRenovationRequired', v)}
              hasError={!!fieldErrors.classroomRenovationRequired}
            />
            <YesNoToggle
              label={<><DoorOpen size={15} className="shrink-0" /> Emergency Exit</>}
              value={form.classroomEmergencyExit}
              onChange={(v) => setBool('classroomEmergencyExit', v)}
              hasError={!!fieldErrors.classroomEmergencyExit}
            />
          </div>
          {form.classroomRenovationRequired === true && (
            <div className="mt-3">
              <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                Renovation Details <span className="text-red-500">*</span>
              </Label>
              <textarea
                value={form.classroomRenovationDetails}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe the required renovation…"
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 ${
                  fieldErrors.classroomRenovationDetails ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {fieldErrors.classroomRenovationDetails && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.classroomRenovationDetails}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Infrastructure Status ────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-xs font-bold text-teal-700">3</span>
            <Package size={17} className="text-teal-600" />
            Infrastructure Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {INFRA_FIELDS.map(({ key, label, icon: Icon, color, bg, border }) => (
              <div
                key={key}
                className={`group flex items-center gap-4 rounded-2xl border ${border} ${bg} p-4 transition-all duration-200 hover:shadow-sm`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${color}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <Label className={`mb-1.5 block text-xs font-medium ${color} leading-tight`}>
                    {label}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => setNum(key, e.target.value)}
                    placeholder="0"
                    className="h-10 text-center text-xl font-bold text-gray-800 bg-white transition-all focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="pt-2">
        <DraftActionBar
          hasDraft={draft.hasDraft}
          draftSavedAt={draft.draftSavedAt}
          submitting={saving}
          onSaveDraft={handleSaveDraft}
          onClearDraft={handleClearDraft}
          submitLabel="Submit Classroom Status"
        />
      </div>
      </form>
      )}

      {tab === 'data' && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold text-gray-800">Submitted Classroom Data</CardTitle>
              {savedRecord && (
                <div className="flex flex-wrap items-center gap-2">
                  {exportPayload && <ExportButtons payload={exportPayload} />}
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
            {(editDenied || notice) && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1 ${
                editDenied || notice?.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                <AlertCircle size={16} className="shrink-0" />
                {editDenied ? 'You do not have permission to edit submitted data.' : notice?.msg}
              </div>
            )}
            {!savedRecord ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <Columns3 size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">No classroom data submitted yet.</p>
                <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add it.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryItem label="Academic Year" value={savedRecord.academicYear || '—'} />
                  {COUNT_FIELDS.map(({ key, label }) => (
                    <SummaryItem key={key} label={label} value={String(savedRecord[key])} />
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SummaryItem label="New Designed Furniture" value={savedRecord.classroomNewFurniture ? 'Yes' : 'No'} />
                  <SummaryItem label="Renovation Required" value={savedRecord.classroomRenovationRequired ? 'Yes' : 'No'} />
                  <SummaryItem label="Emergency Exit" value={savedRecord.classroomEmergencyExit ? 'Yes' : 'No'} />
                  <SummaryItem
                    label="Renovation Details"
                    value={savedRecord.classroomRenovationRequired ? (savedRecord.classroomRenovationDetails || '—') : '—'}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Infrastructure Status</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {INFRA_FIELDS.map(({ key, label }) => (
                      <SummaryItem key={key} label={label} value={String(savedRecord[key])} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Read-only summary item ───────────────────── */
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

/* ── Reusable Yes/No Toggle ─────────────────────────────── */
function YesNoToggle({
  label,
  value,
  onChange,
  hasError,
}: {
  label: React.ReactNode;
  value: boolean | null;
  onChange: (v: boolean) => void;
  hasError?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-gray-50 ${
      hasError ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
    }`}>
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">{label}</span>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
            value === true
              ? 'bg-emerald-500 text-white'
              : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
          }`}
        >
          Yes
        </button>
        <div className="w-px bg-gray-200" />
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
            value === false
              ? 'bg-red-500 text-white'
              : 'text-gray-500 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}
