'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, School as SchoolIcon, Check } from 'lucide-react';
import api from '@/lib/api';
import type { GeoLocation, School } from '@/types';

function collectByType(nodes: GeoLocation[], type: GeoLocation['type']): GeoLocation[] {
  const result: GeoLocation[] = [];
  const walk = (list: GeoLocation[]) => {
    for (const n of list) {
      if (n.type === type) result.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

interface AssignSchoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  existingSchoolIds: string[];
  onSaved: () => void;
}

export function AssignSchoolsModal({
  isOpen,
  onClose,
  userId,
  existingSchoolIds,
  onSaved,
}: AssignSchoolsModalProps) {
  const [divisionId, setDivisionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: tree = [] } = useQuery<GeoLocation[]>({
    queryKey: ['geo-locations-tree'],
    queryFn: () => api.get<GeoLocation[]>('/geo-locations/tree').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  const divisions = useMemo(() => collectByType(tree, 'division'), [tree]);
  const districts = useMemo(() => {
    const divNode = divisions.find((d) => d.id === divisionId);
    return divNode?.children || [];
  }, [divisions, divisionId]);
  const upazilas = useMemo(() => {
    const distNode = districts.find((d: GeoLocation) => d.id === districtId);
    return distNode?.children || [];
  }, [districts, districtId]);

  const selectedDivision = useMemo(
    () => divisions.find((d) => d.id === divisionId),
    [divisions, divisionId],
  );
  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === districtId),
    [districts, districtId],
  );
  const selectedUpazila = useMemo(
    () => upazilas.find((d) => d.id === upazilaId),
    [upazilas, upazilaId],
  );

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: [
      'schools-for-assign',
      selectedDivision?.name || '',
      selectedDistrict?.name || '',
      selectedUpazila?.name || '',
      search,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDivision?.name) params.set('division', selectedDivision.name);
      if (selectedDistrict?.name) params.set('district', selectedDistrict.name);
      if (selectedUpazila?.name) params.set('upazila', selectedUpazila.name);
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get(`/users/schools/available?${params}`);
      return { data: data as School[] };
    },
    enabled: isOpen,
  });

  const schools: School[] = schoolsData?.data || [];
  const availableSchools = schools.filter((s) => !existingSchoolIds.includes(s.id));

  const toggleSchool = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleClose = () => {
    setSelectedIds([]);
    setDivisionId('');
    setDistrictId('');
    setUpazilaId('');
    setSearch('');
    onClose();
  };

  const handleSave = async () => {
    if (!selectedIds.length) return;
    try {
      setSaving(true);
      await api.post(`/users/${userId}/schools`, { schoolIds: selectedIds });
      onSaved();
      handleClose();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign schools');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Schools" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Division"
            placeholder="All Divisions"
            value={divisionId}
            onChange={(e) => {
              setDivisionId(e.target.value);
              setDistrictId('');
              setUpazilaId('');
            }}
            options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            label="District"
            placeholder="All Districts"
            value={districtId}
            disabled={!divisionId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setUpazilaId('');
            }}
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            label="Thana/Upazilla"
            placeholder="All Upazillas"
            value={upazilaId}
            disabled={!districtId}
            onChange={(e) => setUpazilaId(e.target.value)}
            options={upazilas.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school by name or code..."
            className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : availableSchools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <SchoolIcon size={28} className="mb-2 opacity-50" />
              <p className="text-sm">No matching schools found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {availableSchools.map((school) => {
                const checked = selectedIds.includes(school.id);
                return (
                  <li key={school.id}>
                    <button
                      type="button"
                      onClick={() => toggleSchool(school.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'
                        }`}
                      >
                        {checked && <Check size={12} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-800">{school.name}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {school.code} · {[school.upazila, school.district, school.division].filter(Boolean).join(', ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-xs text-gray-500">{selectedIds.length} selected</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!selectedIds.length}>
              Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
