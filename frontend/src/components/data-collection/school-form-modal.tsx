'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { getErrorMessage } from '@/lib/api';
import type { DcSchool, GeoLocation } from '@/types';

const GRADE_COVERAGE_COMMON = Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`);

// BRAC Academy covers "Play World"; all other categories use "Play & Learn".
export const gradeCoverageOptions = (schoolCategory: string): string[] =>
  schoolCategory === 'brac_academy'
    ? ['Play World', ...GRADE_COVERAGE_COMMON]
    : ['Play & Learn', ...GRADE_COVERAGE_COMMON];

// Parse a stored comma-separated coverage string back into the multi-select
// values, keeping only entries valid for the school's category.
export function parseGradeCoverage(
  stored: string | null | undefined,
  schoolCategory: string,
): string[] {
  if (!stored) return [];
  const options = gradeCoverageOptions(schoolCategory);
  return stored
    .split(',')
    .map((g) => g.trim())
    .filter((g) => options.includes(g));
}

function normalizeName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function resolveGeoPath(
  areas: GeoLocation[],
  school: Pick<DcSchool, 'division' | 'district' | 'upazila'>,
): {
  areaId: string;
  divisionId: string;
  districtId: string;
  upazilaId: string;
} {
  const divisionName = normalizeName(school.division);
  const districtName = normalizeName(school.district);
  const upazilaName = normalizeName(school.upazila);

  if (!divisionName && !districtName && !upazilaName) {
    return { areaId: '', divisionId: '', districtId: '', upazilaId: '' };
  }

  for (const area of areas) {
    const divisions = area.children ?? [];
    for (const division of divisions) {
      if (divisionName && normalizeName(division.name) !== divisionName) continue;

      const districts = division.children ?? [];
      if (districtName) {
        for (const district of districts) {
          if (normalizeName(district.name) !== districtName) continue;

          const upazilas = district.children ?? [];
          if (upazilaName) {
            for (const upazila of upazilas) {
              if (normalizeName(upazila.name) !== upazilaName) {
                continue;
              }
              return {
                areaId: area.id,
                divisionId: division.id,
                districtId: district.id,
                upazilaId: upazila.id,
              };
            }
            continue;
          }

          return {
            areaId: area.id,
            divisionId: division.id,
            districtId: district.id,
            upazilaId: '',
          };
        }
        continue;
      }

      return {
        areaId: area.id,
        divisionId: division.id,
        districtId: '',
        upazilaId: '',
      };
    }
  }

  return { areaId: '', divisionId: '', districtId: '', upazilaId: '' };
}

const emptyForm = {
  name: '',
  schoolCategory: '',
  schoolType: '',
  establishedYear: '',
  areaId: '',
  divisionId: '',
  division: '',
  districtId: '',
  district: '',
  upazilaId: '',
  upazila: '',
  governmentApproval: '',
  totalTeachers: '',
  totalStudents: '',
  gradeCoverage: [] as string[],
};

const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

export function SchoolFormModal({
  isOpen,
  onClose,
  onSaved,
  school,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** School to edit, or null to create a new one */
  school: DcSchool | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [divisions, setDivisions] = useState<GeoLocation[]>([]);
  const [districts, setDistricts] = useState<GeoLocation[]>([]);
  const [upazilas, setUpazilas] = useState<GeoLocation[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: areas = [] } = useQuery<GeoLocation[]>({
    queryKey: ['geo-areas'],
    queryFn: () => api.get<GeoLocation[]>('/geo-locations/areas').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: geoTree = [] } = useQuery<GeoLocation[]>({
    queryKey: ['geo-locations-tree'],
    queryFn: () => api.get<GeoLocation[]>('/geo-locations/tree').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  // Reset the form whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (school) {
      const resolved = resolveGeoPath(geoTree, school);
      setForm({
        name: school.name,
        schoolCategory: school.schoolCategory || '',
        schoolType: school.schoolType || '',
        establishedYear: school.establishedYear != null ? String(school.establishedYear) : '',
        areaId: resolved.areaId,
        divisionId: resolved.divisionId,
        division: school.division || '',
        districtId: resolved.districtId,
        district: school.district || '',
        upazilaId: resolved.upazilaId,
        upazila: school.upazila || '',
        governmentApproval:
          school.governmentApproval == null ? '' : school.governmentApproval ? 'yes' : 'no',
        totalTeachers: school.totalTeachers != null ? String(school.totalTeachers) : '',
        totalStudents: school.totalStudents != null ? String(school.totalStudents) : '',
        gradeCoverage: parseGradeCoverage(school.gradeCoverage, school.schoolCategory || ''),
      });
    } else {
      setForm({ ...emptyForm });
    }
    setDivisions([]);
    setDistricts([]);
    setUpazilas([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, school?.id]);

  // Load divisions when area changes
  useEffect(() => {
    if (!isOpen || !form.areaId) {
      setDivisions([]);
      setDistricts([]);
      setUpazilas([]);
      return;
    }
    setGeoLoading(true);
    api
      .get<GeoLocation[]>(`/geo-locations?type=division&parentId=${form.areaId}`)
      .then(({ data }) => setDivisions(data))
      .catch(() => setDivisions([]))
      .finally(() => setGeoLoading(false));
  }, [form.areaId, isOpen]);

  // Load districts when division changes
  useEffect(() => {
    if (!isOpen || !form.divisionId) {
      setDistricts([]);
      setUpazilas([]);
      return;
    }
    setGeoLoading(true);
    api
      .get<GeoLocation[]>(`/geo-locations?type=district&parentId=${form.divisionId}`)
      .then(({ data }) => setDistricts(data))
      .catch(() => setDistricts([]))
      .finally(() => setGeoLoading(false));
  }, [form.divisionId, isOpen]);

  // Load upazilas when district changes
  useEffect(() => {
    if (!isOpen || !form.districtId) {
      setUpazilas([]);
      return;
    }
    setGeoLoading(true);
    api
      .get<GeoLocation[]>(`/geo-locations?type=thana&parentId=${form.districtId}`)
      .then(({ data }) => setUpazilas(data))
      .catch(() => setUpazilas([]))
      .finally(() => setGeoLoading(false));
  }, [form.districtId, isOpen]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        schoolCategory: form.schoolCategory || undefined,
        schoolType: form.schoolType || undefined,
        establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
        division: form.division || undefined,
        district: form.district || undefined,
        upazila: form.upazila || undefined,
        governmentApproval:
          form.governmentApproval === '' ? undefined : form.governmentApproval === 'yes',
        totalTeachers: form.totalTeachers ? Number(form.totalTeachers) : undefined,
        totalStudents: form.totalStudents ? Number(form.totalStudents) : undefined,
        gradeCoverage: form.gradeCoverage.length > 0 ? form.gradeCoverage.join(', ') : undefined,
      };
      if (school) {
        await api.patch(`/data-collection/schools/${school.id}`, payload);
      } else {
        await api.post('/data-collection/schools', payload);
      }
      queryClient.invalidateQueries({ queryKey: ['dc-schools'] });
      queryClient.invalidateQueries({ queryKey: ['dc-schools-minimal'] });
      onSaved();
      onClose();
    } catch (e) {
      alert(getErrorMessage(e, 'Error saving school'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={school ? 'Edit School' : 'Create School'}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label="Name of the School *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. BRAC Primary School Dhaka"
        />

        {/* Category / Type / Establishment Year */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>School Category</label>
            <select
              value={form.schoolCategory}
              onChange={(e) => {
                const category = e.target.value;
                setForm({
                  ...form,
                  schoolCategory: category,
                  // Pre-grade selection differs between categories, so
                  // drop any coverage value that is no longer offered.
                  gradeCoverage: form.gradeCoverage.filter((g) =>
                    gradeCoverageOptions(category).includes(g),
                  ),
                });
              }}
              className={selectClass}
            >
              <option value="">Select category...</option>
              <option value="brac_primary">BRAC Primary</option>
              <option value="brac_secondary">BRAC Secondary</option>
              <option value="brac_academy">BRAC Academy</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>School Type</label>
            <select
              value={form.schoolType}
              onChange={(e) => setForm({ ...form, schoolType: e.target.value })}
              className={selectClass}
            >
              <option value="">Select type...</option>
              <option value="plain_land">Plain Land</option>
              <option value="haor">Haor</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>School Establishment Year</label>
            <input
              type="number"
              value={form.establishedYear}
              onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
              placeholder="e.g. 2010"
              className={selectClass}
            />
          </div>
        </div>

        {/* Cascading Location */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass}>Area</label>
            <select
              value={form.areaId}
              onChange={(e) => {
                setForm({
                  ...form,
                  areaId: e.target.value,
                  divisionId: '',
                  division: '',
                  districtId: '',
                  district: '',
                  upazilaId: '',
                  upazila: '',
                });
              }}
              className={selectClass}
            >
              <option value="">Select area...</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Division</label>
            <select
              value={form.divisionId}
              onChange={(e) => {
                const selected = divisions.find((d) => d.id === e.target.value);
                setForm({
                  ...form,
                  divisionId: e.target.value,
                  division: selected?.name || '',
                  districtId: '',
                  district: '',
                  upazilaId: '',
                  upazila: '',
                });
              }}
              disabled={!form.areaId || geoLoading}
              className={selectClass}
            >
              <option value="">Select division...</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>District</label>
            <select
              value={form.districtId}
              onChange={(e) => {
                const selected = districts.find((d) => d.id === e.target.value);
                setForm({
                  ...form,
                  districtId: e.target.value,
                  district: selected?.name || '',
                  upazilaId: '',
                  upazila: '',
                });
              }}
              disabled={!form.divisionId || geoLoading}
              className={selectClass}
            >
              <option value="">Select district...</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Upazila</label>
            <select
              value={form.upazilaId}
              onChange={(e) => {
                const selected = upazilas.find((u) => u.id === e.target.value);
                setForm({ ...form, upazilaId: e.target.value, upazila: selected?.name || '' });
              }}
              disabled={!form.districtId || geoLoading}
              className={selectClass}
            >
              <option value="">Select upazila...</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Government Approval / Teachers / Students */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Government Approval Status</label>
            <select
              value={form.governmentApproval}
              onChange={(e) => setForm({ ...form, governmentApproval: e.target.value })}
              className={selectClass}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Total Number of Teachers</label>
            <input
              type="number"
              value={form.totalTeachers}
              onChange={(e) => setForm({ ...form, totalTeachers: e.target.value })}
              placeholder="0"
              className={selectClass}
            />
          </div>
          <div>
            <label className={labelClass}>Total Number of Students</label>
            <input
              type="number"
              value={form.totalStudents}
              onChange={(e) => setForm({ ...form, totalStudents: e.target.value })}
              placeholder="0"
              className={selectClass}
            />
          </div>
        </div>

        {/* Grade Coverage — multi-select */}
        <div>
          <label className={labelClass}>
            Grade Coverage
            <span className="ml-2 text-xs font-normal text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {gradeCoverageOptions(form.schoolCategory).map((g) => {
              const checked = form.gradeCoverage.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      gradeCoverage: prev.gradeCoverage.includes(g)
                        ? prev.gradeCoverage.filter((x) => x !== g)
                        : [...prev.gradeCoverage, g],
                    }));
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    checked
                      ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      checked ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                    }`}
                  >
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {school ? 'Update' : 'Create'} School
          </Button>
        </div>
      </div>
    </Modal>
  );
}
