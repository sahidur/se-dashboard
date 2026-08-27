'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { UserDesignation } from '@/types';

export default function UserDesignationsPage() {
  const [designations, setDesignations] = useState<UserDesignation[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({ open: false, id: '', name: '' });

  const fetchDesignations = async () => {
    try {
      const { data } = await api.get('/user-designations');
      setDesignations(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (designation: UserDesignation) => {
    setEditingId(designation.id);
    setForm({
      name: designation.name,
      description: designation.description || '',
      isActive: designation.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Designation name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/user-designations/${editingId}`, form);
      } else {
        await api.post('/user-designations', form);
      }
      setShowModal(false);
      fetchDesignations();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save designation'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/user-designations/${deleteModal.id}`);
      setDeleteModal({ open: false, id: '', name: '' });
      fetchDesignations();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete designation'));
    }
  };

  const toggleActive = async (designation: UserDesignation) => {
    try {
      await api.patch(`/user-designations/${designation.id}`, {
        isActive: !designation.isActive,
      });
      fetchDesignations();
    } catch {
      /* empty */
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="User Designations"
        subtitle="Manage designations available when creating or editing users"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Add Designation
          </Button>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-3xl">
          {designations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Briefcase size={48} className="mb-3" />
              <p className="text-lg font-medium">No designations yet</p>
              <p className="text-sm">
                Create designations to use in the user forms.
              </p>
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <Plus size={14} className="mr-1" /> Create First Designation
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {designations.map((designation) => (
                <Card key={designation.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          designation.isActive
                            ? 'bg-brand-100 text-brand-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            {designation.name}
                          </p>
                          <Badge
                            variant={designation.isActive ? 'success' : 'default'}
                            className="text-xs"
                          >
                            {designation.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {designation.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {designation.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(designation)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          designation.isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {designation.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEdit(designation)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteModal({
                            open: true,
                            id: designation.id,
                            name: designation.name,
                          })
                        }
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Designation' : 'Create Designation'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Field Officer"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              placeholder="Optional description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          {editingId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="accent-brand-500"
              />
              Active
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: '', name: '' })}
        title="Delete Designation"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete &quot;{deleteModal.name}&quot;?
              This cannot be undone. Users with this designation will keep
              their current designation text.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteModal({ open: false, id: '', name: '' })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
