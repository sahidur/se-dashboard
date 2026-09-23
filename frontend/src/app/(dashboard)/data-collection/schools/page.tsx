'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
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
import api, { getErrorMessage } from '@/lib/api';
import type { DcSchool } from '@/types';
import { SchoolFormModal } from '@/components/data-collection/school-form-modal';

const PAGE_SIZE = 10;

export default function MySchoolsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<DcSchool | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; school: DcSchool | null }>({
    open: false,
    school: null,
  });

  const { data: schools = [], isLoading } = useQuery<DcSchool[]>({
    queryKey: ['dc-schools'],
    queryFn: () => api.get('/data-collection/schools').then((r) => r.data),
  });

  // Reset to first page when the search changes (render-time adjustment)
  const [lastSearch, setLastSearch] = useState(search);
  if (lastSearch !== search) {
    setLastSearch(search);
    setPage(1);
  }


  const filtered = useMemo(() => {
    if (!search.trim()) return schools;
    const q = search.toLowerCase();
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code ?? '').toLowerCase().includes(q) ||
        (s.schoolCategory ?? '').toLowerCase().includes(q),
    );
  }, [schools, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const handleDelete = async () => {
    if (!deleteModal.school) return;
    try {
      await api.delete(`/data-collection/schools/${deleteModal.school.id}`);
      queryClient.invalidateQueries({ queryKey: ['dc-schools'] });
      queryClient.invalidateQueries({ queryKey: ['dc-schools-minimal'] });
      setDeleteModal({ open: false, school: null });
    } catch (e) {
      alert(getErrorMessage(e, 'Error deleting'));
    }
  };

  const hasFilters = search;

  return (
    <>
      <Header
        title="My Schools"
        subtitle="Assigned schools for data collection — new schools are created under School Setup"
      />

      <div className="p-4 sm:p-6">
        {/* Filters */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name / code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => setSearch('')}
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
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
            <Building2 size={48} className="mb-3 text-gray-300" />
            <p className="mb-1 font-medium text-gray-500">No schools assigned</p>
            <p className="text-sm text-gray-400">
              Schools are created under <strong>School Setup → Create School</strong>.
            </p>
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
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center">
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
                              <p className="text-xs text-gray-400">{s.code || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                          {[s.upazila, s.district, s.division].filter(Boolean).join(', ') || '-'}
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
                              onClick={() => {
                                setEditSchool(s);
                                setModalOpen(true);
                              }}
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
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
                <p className="order-last w-full text-xs text-gray-500 sm:order-first sm:w-auto">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
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
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <SchoolFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditSchool(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['dc-schools'] })}
        school={editSchool}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, school: null })}
        title="Delete School"
      >
        <p className="mb-4 text-sm text-gray-600">
          Are you sure you want to delete <strong>{deleteModal.school?.name}</strong>? All associated data
          will be removed.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteModal({ open: false, school: null })}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
