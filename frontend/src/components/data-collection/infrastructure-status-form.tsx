'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, MapPin, BookOpen, School, AlertCircle,
  DoorOpen, Bath, Leaf, Wrench, Building2, Pencil, Trash2, RefreshCw,
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
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool } from '@/types';

const ROOM_TYPES = [
  { key: 'roomHeadTeachers', label: "Head Teacher's" },
  { key: 'roomTeachers', label: "Teachers'" },
  { key: 'roomClassroom', label: 'Class Room' },
  { key: 'roomPlayroom', label: 'Play Room' },
  { key: 'roomLibrary', label: 'Library' },
  { key: 'roomLab', label: 'Lab' },
  { key: 'roomStoreroom', label: 'Store Room' },
  { key: 'roomKitchen', label: 'Kitchen' },
  { key: 'roomSickbay', label: 'Sickbay' },
  { key: 'roomOthers', label: 'Others' },
] as const;

type RoomKey = (typeof ROOM_TYPES)[number]['key'];

const BUILDING_OPTIONS = [
  'One-storied tin shed building',
  'One-storied building',
  'Multi-storied building',
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

const YEARS = buildYearOptions();

interface FormState {
  academicYear: string;
  campusStatus: string;
  buildingStatus: string[];
  // Numeric fields kept as strings so inputs render blank instead of a
  // default "0"; they are converted to numbers at submit time.
  roomHeadTeachers: string;
  roomTeachers: string;
  roomClassroom: string;
  roomPlayroom: string;
  roomLibrary: string;
  roomLab: string;
  roomStoreroom: string;
  roomKitchen: string;
  roomSickbay: string;
  roomOthers: string;
  washroomMale: string;
  washroomFemale: string;
  hasHandWashPoint: boolean | null;
  hasPlayground: boolean | null;
  hasSchoolGarden: boolean | null;
  infraRenovationRequired: boolean | null;
}

const defaultState: FormState = {
  academicYear: '',
  campusStatus: '',
  buildingStatus: [],
  roomHeadTeachers: '',
  roomTeachers: '',
  roomClassroom: '',
  roomPlayroom: '',
  roomLibrary: '',
  roomLab: '',
  roomStoreroom: '',
  roomKitchen: '',
  roomSickbay: '',
  roomOthers: '',
  washroomMale: '',
  washroomFemale: '',
  hasHandWashPoint: null,
  hasPlayground: null,
  hasSchoolGarden: null,
  infraRenovationRequired: null,
};

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface Props { schoolId: string }

function mapRecord(d: Record<string, any>): FormState {
  let buildingStatus: string[] = [];
  if (d.buildingStatus) {
    try {
      buildingStatus = JSON.parse(d.buildingStatus);
    } catch {
      buildingStatus = [];
    }
  }
  return {
    academicYear: d.academicYear != null ? String(d.academicYear) : '',
    campusStatus: d.campusStatus || '',
    buildingStatus,
    roomHeadTeachers: d.roomHeadTeachers ?? '',
    roomTeachers: d.roomTeachers ?? '',
    roomClassroom: d.roomClassroom ?? '',
    roomPlayroom: d.roomPlayroom ?? '',
    roomLibrary: d.roomLibrary ?? '',
    roomLab: d.roomLab ?? '',
    roomStoreroom: d.roomStoreroom ?? '',
    roomKitchen: d.roomKitchen ?? '',
    roomSickbay: d.roomSickbay ?? '',
    roomOthers: d.roomOthers ?? '',
    washroomMale: d.washroomMale ?? '',
    washroomFemale: d.washroomFemale ?? '',
    hasHandWashPoint: d.hasHandWashPoint ?? null,
    hasPlayground: d.hasPlayground ?? null,
    hasSchoolGarden: d.hasSchoolGarden ?? null,
    infraRenovationRequired: d.infraRenovationRequired ?? null,
  };
}

type FieldErrors = Partial<Record<
  'academicYear' | 'campusStatus' | 'buildingStatus' | 'hasHandWashPoint' | 'hasPlayground' | 'hasSchoolGarden' | 'infraRenovationRequired',
  string
>>;

export function InfrastructureStatusForm({ schoolId }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<FormState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loadingYear, setLoadingYear] = useState(false);
  const draft = useFormDraft<FormState>('infrastructure', schoolId);
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

  // "Delete" removes the entire yearly record. The infrastructure entity also
  // stores the Classroom Status form's data for the same year, so both are
  // cleared — the confirm message makes that explicit.
  const handleDeleteRecord = async () => {
    if (!canDeleteSubmitted) {
      setNotice({ type: 'error', msg: 'You do not have permission to delete submitted data.' });
      return;
    }
    if (!savedRecordId) return;
    if (!window.confirm(
      'Delete this year\'s Infrastructure & Classroom record? This also clears the Classroom Status form for the same year. The record will be moved to the recycle bin.',
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
        filename: 'infrastructure-status',
        headers: ['Field', 'Value'],
        rows: [
          ['Academic Year', savedRecord.academicYear || ''],
          ['Campus Status', savedRecord.campusStatus || ''],
          ['Building Status', savedRecord.buildingStatus.join(', ') || ''],
          ...ROOM_TYPES.map(({ key, label }) => [label, String(savedRecord[key as RoomKey] ?? 0)]),
          ['Total Rooms', String(ROOM_TYPES.reduce((sum, rt) => sum + (Number(savedRecord[rt.key as RoomKey]) || 0), 0))],
          ['Washrooms (Male)', String(savedRecord.washroomMale)],
          ['Washrooms (Female)', String(savedRecord.washroomFemale)],
          ['Hand Wash Point', savedRecord.hasHandWashPoint ? 'Yes' : 'No'],
          ['Play Ground', savedRecord.hasPlayground ? 'Yes' : 'No'],
          ['School Garden', savedRecord.hasSchoolGarden ? 'Yes' : 'No'],
          ['Renovation Required', savedRecord.infraRenovationRequired ? 'Yes' : 'No'],
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

  const totalRooms = ROOM_TYPES.reduce(
    (sum, rt) => sum + (Number(form[rt.key as RoomKey]) || 0),
    0,
  );

  const toggleBuilding = (opt: string) => {
    setForm((prev) => ({
      ...prev,
      buildingStatus: prev.buildingStatus.includes(opt)
        ? prev.buildingStatus.filter((b) => b !== opt)
        : [...prev.buildingStatus, opt],
    }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.buildingStatus; return n; });
  };

  const setNum = (key: RoomKey | 'washroomMale' | 'washroomFemale', val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setBool = (
    key: 'hasHandWashPoint' | 'hasPlayground' | 'hasSchoolGarden' | 'infraRenovationRequired',
    val: boolean,
  ) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.campusStatus) errs.campusStatus = 'Please select campus status';
    if (form.buildingStatus.length === 0) errs.buildingStatus = 'Please select at least one building type';
    if (form.hasHandWashPoint === null) errs.hasHandWashPoint = 'Required';
    if (form.hasPlayground === null) errs.hasPlayground = 'Required';
    if (form.hasSchoolGarden === null) errs.hasSchoolGarden = 'Required';
    if (form.infraRenovationRequired === null) errs.infraRenovationRequired = 'Required';
    return errs;
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
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const { data: saved } = await api.post('/data-collection/infrastructure', {
        schoolId,
        academicYear: Number(form.academicYear),
        campusStatus: form.campusStatus || undefined,
        buildingStatus: form.buildingStatus.length > 0
          ? JSON.stringify(form.buildingStatus)
          : undefined,
        roomHeadTeachers: toNum(form.roomHeadTeachers),
        roomTeachers: toNum(form.roomTeachers),
        roomClassroom: toNum(form.roomClassroom),
        roomPlayroom: toNum(form.roomPlayroom),
        roomLibrary: toNum(form.roomLibrary),
        roomLab: toNum(form.roomLab),
        roomStoreroom: toNum(form.roomStoreroom),
        roomKitchen: toNum(form.roomKitchen),
        roomSickbay: toNum(form.roomSickbay),
        roomOthers: toNum(form.roomOthers),
        roomTotal: totalRooms,
        washroomMale: toNum(form.washroomMale),
        washroomFemale: toNum(form.washroomFemale),
        hasHandWashPoint: form.hasHandWashPoint ?? false,
        hasPlayground: form.hasPlayground ?? false,
        hasSchoolGarden: form.hasSchoolGarden ?? false,
        infraRenovationRequired: form.infraRenovationRequired ?? false,
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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 size={52} className="text-emerald-600" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Infrastructure Status Saved!</h2>
          <p className="mt-1 text-gray-500 max-w-sm">The infrastructure data has been successfully recorded.</p>
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
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
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
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Academic Year ───────────────────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardContent className="px-5 py-5">
          <div className="max-w-xs">
            <Label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year <span className="text-red-500">*</span>
            </Label>
            <select
              value={form.academicYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 ${
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
              <p className="mt-1.5 text-xs text-emerald-600">Loading {form.academicYear} data…</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 1: Campus & Building Status ─── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700">1</span>
            <Building2 size={17} className="text-emerald-600" />
            Campus & Building Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-5">

          {/* Campus Status */}
          <div>
            <Label className="mb-2.5 block text-sm font-medium text-gray-700">
              School Campus Status <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-3">
              {['Rented', 'Own'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, campusStatus: opt }));
                    setFieldErrors((prev) => { const n = { ...prev }; delete n.campusStatus; return n; });
                  }}
                  className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-all duration-200 ${
                    form.campusStatus === opt
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-[1.02]'
                      : fieldErrors.campusStatus
                      ? 'border-red-300 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/40'
                      : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  {opt} Campus
                </button>
              ))}
            </div>
            {fieldErrors.campusStatus && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.campusStatus}</p>
            )}
          </div>

          {/* Building Status multi-select */}
          <div>
            <Label className="mb-2.5 block text-sm font-medium text-gray-700">
              School Building Status <span className="text-red-500">*</span>{' '}
              <span className="text-xs font-normal text-gray-400">(select all that apply)</span>
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {BUILDING_OPTIONS.map((opt) => {
                const checked = form.buildingStatus.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleBuilding(opt)}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      checked
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : fieldErrors.buildingStatus
                        ? 'border-red-300 text-gray-600 hover:border-emerald-300 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-150 ${
                        checked ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}
                    >
                      {checked && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {fieldErrors.buildingStatus && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.buildingStatus}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Number of Rooms ──────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">2</span>
            <DoorOpen size={17} className="text-blue-600" />
            Number of Rooms
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ROOM_TYPES.map(({ key, label }) => (
              <div key={key} className="group">
                <Label className="mb-1.5 block text-xs font-medium text-gray-500 transition-colors group-focus-within:text-blue-600">
                  {label}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form[key as RoomKey]}
                  onChange={(e) => setNum(key as RoomKey, e.target.value)}
                  placeholder="0"
                  className="text-center font-bold text-gray-800 transition-all focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>

          {/* Total Row */}
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-white/90">
              <DoorOpen size={18} />
              <span className="text-sm font-semibold">Total Rooms</span>
              <span className="text-xs text-white/60">(auto-calculated)</span>
            </div>
            <span className="text-3xl font-extrabold text-white">{totalRooms}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Washrooms ─────────────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-xs font-bold text-cyan-700">3</span>
            <Bath size={17} className="text-cyan-600" />
            No. of Washrooms
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
            <div className="group">
              <Label className="mb-1.5 block text-sm font-medium text-gray-600 group-focus-within:text-cyan-600 transition-colors">
                🚹 Male
              </Label>
              <Input
                type="number"
                min={0}
                value={form.washroomMale}
                onChange={(e) => setNum('washroomMale', e.target.value)}
                placeholder="0"
                className="text-center text-lg font-bold transition-all focus:ring-2 focus:ring-cyan-300"
              />
            </div>
            <div className="group">
              <Label className="mb-1.5 block text-sm font-medium text-gray-600 group-focus-within:text-cyan-600 transition-colors">
                🚺 Female
              </Label>
              <Input
                type="number"
                min={0}
                value={form.washroomFemale}
                onChange={(e) => setNum('washroomFemale', e.target.value)}
                placeholder="0"
                className="text-center text-lg font-bold transition-all focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Facilities Yes/No ─────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">4</span>
            <Leaf size={17} className="text-violet-600" />
            Facilities <span className="text-red-500 font-normal text-sm ml-1">*all required</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { key: 'hasHandWashPoint', label: '💧 Hand Wash Point' },
                { key: 'hasPlayground', label: '⚽ Play Ground' },
                { key: 'hasSchoolGarden', label: '🌱 School Garden' },
                { key: 'infraRenovationRequired', label: '🔧 Renovation Required' },
              ] as const
            ).map(({ key, label }) => (
              <YesNoToggle
                key={key}
                label={label}
                value={form[key]}
                onChange={(v) => setBool(key, v)}
                hasError={!!fieldErrors[key]}
              />
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
          submitLabel="Submit Infrastructure"
        />
      </div>
      </form>
      )}

      {tab === 'data' && (
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold text-gray-800">Submitted Infrastructure Data</CardTitle>
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
                <Building2 size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">No infrastructure data submitted yet.</p>
                <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add it.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SummaryItem label="Academic Year" value={savedRecord.academicYear || '—'} />
                  <SummaryItem label="Campus Status" value={savedRecord.campusStatus || '—'} />
                  <SummaryItem label="Building Status" value={savedRecord.buildingStatus.join(', ') || '—'} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rooms</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {ROOM_TYPES.map(({ key, label }) => (
                      <SummaryItem key={key} label={label} value={String(savedRecord[key as RoomKey] ?? 0)} />
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SummaryItem label="Washroom (Male)" value={String(savedRecord.washroomMale)} />
                  <SummaryItem label="Washroom (Female)" value={String(savedRecord.washroomFemale)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryItem label="Hand Wash Point" value={savedRecord.hasHandWashPoint ? 'Yes' : 'No'} />
                  <SummaryItem label="Play Ground" value={savedRecord.hasPlayground ? 'Yes' : 'No'} />
                  <SummaryItem label="School Garden" value={savedRecord.hasSchoolGarden ? 'Yes' : 'No'} />
                  <SummaryItem label="Renovation Required" value={savedRecord.infraRenovationRequired ? 'Yes' : 'No'} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Read-only summary item ─────────────────────────────── */
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
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  hasError?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-gray-50 ${
      hasError ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
    }`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
