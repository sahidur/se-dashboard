'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Search,
  School,
  Edit,
  Trash2,
  Eye,
  Building2,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcSchool, GeoLocation } from '@/types';

const PAGE_SIZE = 10;

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
  gradeCoverage: '',
};

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
              if (normalizeName(upazila.name) !== upazilaName) continue;
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

export default function DcSchoolsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<DcSchool | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; school?: DcSchool }>({ open: false });

  const [form, setForm] = useState({ ...emptyForm });

  // Geo-location cascading
  const [divisions, setDivisions] = useState<GeoLocation[]>([]);
  const [districts, setDistricts] = useState<GeoLocation[]>([]);
  const [upazilas, setUpazilas] = useState<GeoLocation[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const { data: schools = [], isLoading: loading, refetch: fetchSchools } = useQuery<DcSchool[]>({
    queryKey: ['dc-schools'],
    queryFn: () => api.get('/data-collection/schools').then((r) => r.data),
  });

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

  // Load divisions when area changes
  useEffect(() => {
    if (!form.areaId) {
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
  }, [form.areaId]);

  // Load districts when division changes
  useEffect(() => {
    if (!form.divisionId) {
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
  }, [form.divisionId]);

  // Load upazilas when district changes
  useEffect(() => {
    if (!form.districtId) {
      setUpazilas([]);
      return;
    }
    setGeoLoading(true);
    api
      .get<GeoLocation[]>(`/geo-locations?type=thana&parentId=${form.districtId}`)
      .then(({ data }) => setUpazilas(data))
      .catch(() => setUpazilas([]))
      .finally(() => setGeoLoading(false));
  }, [form.districtId]);

  // Filtered + paginated
  const filtered = useMemo(() => {
    let result = schools;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [schools, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditSchool(null);
    setDivisions([]);
    setDistricts([]);
    setUpazilas([]);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (s: DcSchool) => {
    setEditSchool(s);
    const resolved = resolveGeoPath(geoTree, s);

    setForm({
      name: s.name,
      schoolCategory: s.schoolCategory || '',
      schoolType: s.schoolType || '',
      establishedYear: s.establishedYear != null ? String(s.establishedYear) : '',
      areaId: resolved.areaId,
      divisionId: resolved.divisionId,
      division: s.division || '',
      districtId: resolved.districtId,
      district: s.district || '',
      upazilaId: resolved.upazilaId,
      upazila: s.upazila || '',
      governmentApproval: s.governmentApproval == null ? '' : s.governmentApproval ? 'yes' : 'no',
      totalTeachers: s.totalTeachers != null ? String(s.totalTeachers) : '',
      totalStudents: s.totalStudents != null ? String(s.totalStudents) : '',
      gradeCoverage: s.gradeCoverage || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
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
        gradeCoverage: form.gradeCoverage || undefined,
      };
      if (editSchool) {
        await api.patch(`/data-collection/schools/${editSchool.id}`, payload);
      } else {
        await api.post('/data-collection/schools', payload);
      }
      queryClient.invalidateQueries({ queryKey: ['dc-schools'] });
      setModalOpen(false);
      resetForm();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error saving school');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.school) return;
    try {
      await api.delete(`/data-collection/schools/${deleteModal.school.id}`);
      queryClient.invalidateQueries({ queryKey: ['dc-schools'] });
      setDeleteModal({ open: false });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error deleting');
    }
  };

  const hasFilters = search;

  const selectClass =
    'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

  return (
    <>
      <Header
        title="My Schools"
        subtitle="Create and manage schools for data collection"
        actions={
          <Button onClick={openCreate} className="shrink-0">
            <Plus size={16} className="mr-1.5" />
            Create School
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Filters */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); }}
                className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Filter size={12} className="mr-1 inline" />
                Clear
              </button>
            )}
          </div>
          {hasFilters && (
            <p className="mt-2 text-xs text-gray-400">
              Showing {filtered.length} of {schools.length} school{schools.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
            <Building2 size={48} className="mb-3 text-gray-300" />
            <p className="mb-1 font-medium text-gray-500">No schools yet</p>
            <p className="mb-4 text-sm text-gray-400">Create one to start collecting data!</p>
            <Button onClick={openCreate}>
              <Plus size={16} className="mr-1.5" />
              Create School
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">School</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Location</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Created By</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center">
                        <Search size={20} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-500">No matching schools found</p>
                      </td>
                    </tr>
                  ) : (
                    paged.map((s, idx) => (
                      <tr
                        key={s.id}
                        className="border-b border-gray-50 transition-colors hover:bg-brand-50/30 even:bg-gray-50/30 cursor-pointer"
                        onClick={() => router.push(`/data-collection/schools/${s.id}`)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                              <School size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{s.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                          {[s.upazila, s.district, s.division].filter(Boolean).join(', ') || '-'}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          {s.createdBy ? (
                            <div>
                              <p className="text-sm text-gray-700">{s.createdBy.firstName} {s.createdBy.lastName}</p>
                              <p className="text-xs text-gray-400">{s.createdBy.email}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => router.push(`/data-collection/schools/${s.id}`)}
                              className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50 transition-colors"
                              title="View Data"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => openEdit(s)}
                              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ open: true, school: s })}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      typeof p === 'string' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`h-7 min-w-[28px] rounded-lg text-xs font-medium transition-colors ${
                            page === p ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editSchool ? 'Edit School' : 'Create School'}
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
                onChange={(e) => setForm({ ...form, schoolCategory: e.target.value })}
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

          {/* Grade Coverage */}
          <Input
            label="Grade Coverage"
            value={form.gradeCoverage}
            onChange={(e) => setForm({ ...form, gradeCoverage: e.target.value })}
            placeholder="e.g. Class 1 - Class 10"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editSchool ? 'Update' : 'Create'} School
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false })} title="Delete School">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{deleteModal.school?.name}</strong>? All associated data will be removed.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteModal({ open: false })}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
