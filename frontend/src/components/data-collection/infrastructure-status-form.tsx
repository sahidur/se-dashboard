'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, MapPin, BookOpen, School, AlertCircle,
  DoorOpen, Bath, Leaf, Wrench, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
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

interface FormState {
  campusStatus: string;
  buildingStatus: string[];
  roomHeadTeachers: number;
  roomTeachers: number;
  roomClassroom: number;
  roomPlayroom: number;
  roomLibrary: number;
  roomLab: number;
  roomStoreroom: number;
  roomKitchen: number;
  roomSickbay: number;
  roomOthers: number;
  washroomMale: number;
  washroomFemale: number;
  hasHandWashPoint: boolean | null;
  hasPlayground: boolean | null;
  hasSchoolGarden: boolean | null;
  infraRenovationRequired: boolean | null;
}

const defaultState: FormState = {
  campusStatus: '',
  buildingStatus: [],
  roomHeadTeachers: 0,
  roomTeachers: 0,
  roomClassroom: 0,
  roomPlayroom: 0,
  roomLibrary: 0,
  roomLab: 0,
  roomStoreroom: 0,
  roomKitchen: 0,
  roomSickbay: 0,
  roomOthers: 0,
  washroomMale: 0,
  washroomFemale: 0,
  hasHandWashPoint: null,
  hasPlayground: null,
  hasSchoolGarden: null,
  infraRenovationRequired: null,
};

interface Props { schoolId: string }

type FieldErrors = Partial<Record<
  'campusStatus' | 'buildingStatus' | 'hasHandWashPoint' | 'hasPlayground' | 'hasSchoolGarden' | 'infraRenovationRequired',
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
          setForm({
            campusStatus: d.campusStatus || '',
            buildingStatus: d.buildingStatus ? JSON.parse(d.buildingStatus) : [],
            roomHeadTeachers: d.roomHeadTeachers ?? 0,
            roomTeachers: d.roomTeachers ?? 0,
            roomClassroom: d.roomClassroom ?? 0,
            roomPlayroom: d.roomPlayroom ?? 0,
            roomLibrary: d.roomLibrary ?? 0,
            roomLab: d.roomLab ?? 0,
            roomStoreroom: d.roomStoreroom ?? 0,
            roomKitchen: d.roomKitchen ?? 0,
            roomSickbay: d.roomSickbay ?? 0,
            roomOthers: d.roomOthers ?? 0,
            washroomMale: d.washroomMale ?? 0,
            washroomFemale: d.washroomFemale ?? 0,
            hasHandWashPoint: d.hasHandWashPoint ?? null,
            hasPlayground: d.hasPlayground ?? null,
            hasSchoolGarden: d.hasSchoolGarden ?? null,
            infraRenovationRequired: d.infraRenovationRequired ?? null,
          });
        }
      } catch {
        router.push('/data-collection/schools');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schoolId, router]);

  const totalRooms = ROOM_TYPES.reduce(
    (sum, rt) => sum + (form[rt.key as RoomKey] || 0),
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
    setForm((prev) => ({ ...prev, [key]: parseInt(val, 10) || 0 }));

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
      await api.post('/data-collection/infrastructure', {
        schoolId,
        campusStatus: form.campusStatus || undefined,
        buildingStatus: form.buildingStatus.length > 0
          ? JSON.stringify(form.buildingStatus)
          : undefined,
        roomHeadTeachers: form.roomHeadTeachers,
        roomTeachers: form.roomTeachers,
        roomClassroom: form.roomClassroom,
        roomPlayroom: form.roomPlayroom,
        roomLibrary: form.roomLibrary,
        roomLab: form.roomLab,
        roomStoreroom: form.roomStoreroom,
        roomKitchen: form.roomKitchen,
        roomSickbay: form.roomSickbay,
        roomOthers: form.roomOthers,
        roomTotal: totalRooms,
        washroomMale: form.washroomMale,
        washroomFemale: form.washroomFemale,
        hasHandWashPoint: form.hasHandWashPoint ?? false,
        hasPlayground: form.hasPlayground ?? false,
        hasSchoolGarden: form.hasSchoolGarden ?? false,
        infraRenovationRequired: form.infraRenovationRequired ?? false,
      });
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
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">

      {/* ── School Info ─────────────────────────── */}
      {school && (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Section 1: Campus & Building Status ─── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
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
        <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
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
        <div className="h-1 bg-gradient-to-r from-cyan-400 to-blue-400" />
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
                className="text-center text-lg font-bold transition-all focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Facilities Yes/No ─────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
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
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="min-w-[160px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm"
        >
          {saving ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-1.5" />
              Save Infrastructure
            </>
          )}
        </Button>
      </div>
    </form>
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
