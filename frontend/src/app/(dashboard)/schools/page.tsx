'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Search,
  MapPin,
  Users,
  GraduationCap,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import type { School } from '@/types';

export default function SchoolsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: schoolsData, isLoading: loading } = useQuery({
    queryKey: ['schools', search, page, limit],
    queryFn: () =>
      api.get('/schools', { params: { search, page, limit } }).then((r) => r.data),
  });

  const schools: School[] = schoolsData?.data || schoolsData?.items || schoolsData || [];
  const total: number = schoolsData?.total || 0;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    district: '',
    division: '',
    upazila: '',
    principalName: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingSchool(null);
    setForm({
      name: '',
      code: '',
      address: '',
      district: '',
      division: '',
      upazila: '',
      principalName: '',
      phone: '',
      email: '',
    });
    setShowModal(true);
  };

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setForm({
      name: school.name || '',
      code: school.code || '',
      address: school.address || '',
      district: school.district || '',
      division: school.division || '',
      upazila: school.upazila || '',
      principalName: school.principalName || '',
      phone: school.phone || '',
      email: school.email || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingSchool) {
        await api.patch(`/schools/${editingSchool.id}`, form);
      } else {
        await api.post('/schools', form);
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this school?')) return;
    try {
      await api.delete(`/schools/${id}`);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    } catch {
      alert('Failed to delete school');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <Header
        title="Schools"
        subtitle="Manage school records"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Add School
          </Button>
        }
      />
      <div className="page-container">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : schools.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap
                size={40}
                className="mx-auto mb-3 text-gray-300"
              />
              <p className="text-gray-500">No schools found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {schools.map((school) => (
                <Card key={school.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {school.name}
                        </h3>
                        {school.code && (
                          <Badge variant="info" className="mt-1">
                            {school.code}
                          </Badge>
                        )}
                      </div>
                      <Badge variant={school.isActive ? 'success' : 'default'}>
                        {school.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {(school.district || school.division) && (
                      <div className="mb-3 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={12} />
                        <span>
                          {[school.upazila, school.district, school.division]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="mb-3 flex gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={12} />{' '}
                        {school.students?.length || 0} students
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap size={12} />{' '}
                        {school.teachers?.length || 0} teachers
                      </span>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/schools/${school.id}`)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(school)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(school.id)}
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingSchool ? 'Edit School' : 'Add School'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="School Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="School Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Division"
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
            />
            <Input
              label="District"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
            <Input
              label="Upazila"
              value={form.upazila}
              onChange={(e) => setForm({ ...form, upazila: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Principal Name"
              value={form.principalName}
              onChange={(e) =>
                setForm({ ...form, principalName: e.target.value })
              }
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingSchool ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
