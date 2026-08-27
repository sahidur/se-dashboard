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
  Tag,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { SurveyCategory } from '@/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<SurveyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({ open: false, id: '', name: '' });

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/surveys/categories/all');
      setCategories(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', sortOrder: 0, isActive: true });
    setShowModal(true);
  };

  const openEdit = (cat: SurveyCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Category name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/surveys/categories/${editingId}`, form);
      } else {
        await api.post('/surveys/categories', form);
      }
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/surveys/categories/${deleteModal.id}`);
      setDeleteModal({ open: false, id: '', name: '' });
      fetchCategories();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete category'));
    }
  };

  const toggleActive = async (cat: SurveyCategory) => {
    try {
      await api.patch(`/surveys/categories/${cat.id}`, {
        isActive: !cat.isActive,
      });
      fetchCategories();
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
        title="Survey Categories"
        subtitle="Manage categories used in surveys"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Add Category
          </Button>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-3xl">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Tag size={48} className="mb-3" />
              <p className="text-lg font-medium">No categories yet</p>
              <p className="text-sm">
                Create categories to organize your surveys.
              </p>
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <Plus size={14} className="mr-1" /> Create First Category
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <Card key={cat.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <GripVertical
                        size={16}
                        className="text-gray-300 cursor-grab"
                      />
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          cat.isActive
                            ? 'bg-brand-100 text-brand-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Tag size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            {cat.name}
                          </p>
                          <Badge
                            variant={cat.isActive ? 'success' : 'default'}
                            className="text-xs"
                          >
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Sort order: {cat.sortOrder}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(cat)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          cat.isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {cat.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEdit(cat)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteModal({
                            open: true,
                            id: cat.id,
                            name: cat.name,
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
        title={editingId ? 'Edit Category' : 'Create Category'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Education, Health"
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
          <Input
            label="Sort Order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(e) =>
              setForm({ ...form, sortOrder: Number(e.target.value) })
            }
          />
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
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete &quot;{deleteModal.name}&quot;?
              This cannot be undone. Surveys using this category will keep their
              current category text.
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
