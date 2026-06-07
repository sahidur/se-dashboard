'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, MapPin, BookOpen, School, AlertCircle,
  Monitor, Users, Columns3, ScanLine, Armchair, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
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
  digitallyEquippedClassrooms: number;
  floorSittingClassrooms: number;
  classroomsWithWhiteboard: number;
  classroomsWithBlackboard: number;
  classroomNewFurniture: boolean | null;
  classroomRenovationRequired: boolean | null;
}

const defaultState: FormState = {
  digitallyEquippedClassrooms: 0,
  floorSittingClassrooms: 0,
  classroomsWithWhiteboard: 0,
  classroomsWithBlackboard: 0,
  classroomNewFurniture: null,
  classroomRenovationRequired: null,
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

type ClassroomFieldErrors = Partial<Record<'classroomNewFurniture' | 'classroomRenovationRequired', string>>;

export function ClassroomStatusForm({ schoolId }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<FormState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ClassroomFieldErrors>({});

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
            digitallyEquippedClassrooms: d.digitallyEquippedClassrooms ?? 0,
            floorSittingClassrooms: d.floorSittingClassrooms ?? 0,
            classroomsWithWhiteboard: d.classroomsWithWhiteboard ?? 0,
            classroomsWithBlackboard: d.classroomsWithBlackboard ?? 0,
            classroomNewFurniture: d.classroomNewFurniture ?? null,
            classroomRenovationRequired: d.classroomRenovationRequired ?? null,
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

  const setNum = (key: CountKey, val: string) =>
    setForm((prev) => ({ ...prev, [key]: parseInt(val, 10) || 0 }));

  const setBool = (
    key: 'classroomNewFurniture' | 'classroomRenovationRequired',
    val: boolean,
  ) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required boolean fields
    const errs: ClassroomFieldErrors = {};
    if (form.classroomNewFurniture === null) errs.classroomNewFurniture = 'Required';
    if (form.classroomRenovationRequired === null) errs.classroomRenovationRequired = 'Required';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please answer all required fields before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      await api.post('/data-collection/infrastructure', {
        schoolId,
        digitallyEquippedClassrooms: form.digitallyEquippedClassrooms,
        floorSittingClassrooms: form.floorSittingClassrooms,
        classroomsWithWhiteboard: form.classroomsWithWhiteboard,
        classroomsWithBlackboard: form.classroomsWithBlackboard,
        classroomNewFurniture: form.classroomNewFurniture ?? false,
        classroomRenovationRequired: form.classroomRenovationRequired ?? false,
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
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">

      {/* ── School Info ─────────────────────────── */}
      {school && (
        <div className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Section 1: Classroom Counts ─────────── */}
      <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
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
        <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
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
          className="min-w-[160px] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-sm"
        >
          {saving ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-1.5" />
              Save Classroom Status
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
