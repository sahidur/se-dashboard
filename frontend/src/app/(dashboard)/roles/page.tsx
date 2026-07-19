'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Plus, Edit, Trash2, Shield } from 'lucide-react';
import api from '@/lib/api';
import type { Role } from '@/types';

const MODULE_GROUPS: { label: string; modules: { key: string; label: string; description?: string }[] }[] = [
  {
    label: 'General',
    modules: [{ key: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Data Collection',
    modules: [
      { key: 'programme-overview', label: 'Programme Overview', description: 'Aggregated programme-wide stats page' },
      { key: 'school-information', label: 'School Information', description: 'Browse all schools + school profile view' },
      { key: 'data-collection', label: 'Data Collection (forms)', description: 'My Schools + all sub-forms: basic info, infrastructure, students, teachers, revenue, performance, alumni, activity/event participation, etc.' },
      { key: 'data-collection-edit', label: 'Edit Submitted Data', description: 'Only the "Update" checkbox matters here. Without it, this role can still create new data-collection records but cannot modify one that has already been submitted.' },
    ],
  },
  {
    label: 'School Monitoring',
    modules: [
      { key: 'school-monitoring', label: 'School Monitoring', description: 'Submit and view observation feedback for assigned schools (Combined / Quality / Operations checklists).' },
      { key: 'school-monitoring-edit', label: 'Edit / Delete Monitoring', description: 'Only "Update" and "Delete" matter. Submissions are immutable to their author — this permission lets a role edit or delete any submitted monitoring feedback.' },
    ],
  },
  {
    label: 'Users & Roles',
    modules: [
      { key: 'users', label: 'Users' },
      { key: 'roles', label: 'Roles' },
    ],
  },
  {
    label: 'Surveys',
    modules: [
      { key: 'surveys', label: 'Surveys' },
      { key: 'assigned-surveys', label: 'Assigned Surveys' },
      { key: 'school-records', label: 'School Records', description: 'Survey targeting/response records for schools' },
    ],
  },
  {
    label: 'Admin Tools',
    modules: [
      { key: 'admin-tools', label: 'Admin Tools (menu group)', description: 'Controls whether the Admin Tools menu group is shown at all' },
      { key: 'categories', label: 'Categories', description: 'Survey category tags, managed under Admin Tools' },
      { key: 'geo-locations', label: 'Geo Locations' },
      { key: 'activity-logs', label: 'Activity Logs', description: 'System-wide audit/activity log viewer' },
      { key: 'recycle-bin', label: 'Recycle Bin' },
    ],
  },
];

const MODULES = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));
const ACTIONS = ['create', 'read', 'update', 'delete'] as const;


export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hierarchy: 0,
    permissions: [] as { module: string; action: string }[],
  });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Role[]>('/roles');
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      hierarchy: 0,
      permissions: [],
    });
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      hierarchy: role.hierarchy,
      permissions:
        role.permissions?.map((p) => ({
          module: p.module,
          action: p.action,
        })) || [],
    });
    setShowModal(true);
  };

  const togglePermission = (module: string, action: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.some(
        (p) => p.module === module && p.action === action,
      );
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(
              (p) => !(p.module === module && p.action === action),
            )
          : [...prev.permissions, { module, action }],
      };
    });
  };

  const hasPermission = (module: string, action: string) =>
    formData.permissions.some(
      (p) => p.module === module && p.action === action,
    );

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, formData);
      } else {
        await api.post('/roles', formData);
      }
      setShowModal(false);
      fetchRoles();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchRoles();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete role');
    }
  };

  return (
    <>
      <Header
        title="Role Management"
        subtitle={`${roles.length} roles configured`}
        actions={
          <Button onClick={openCreateModal} size="sm">
            <Plus size={16} className="mr-1" /> Add Role
          </Button>
        }
      />
      <div className="page-container">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role, idx) => (
              <div
                key={role.id}
                className="group animate-fadeIn overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        <p className="text-xs text-gray-400">Level {role.hierarchy}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(role)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-600"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {role.description && (
                    <p className="mt-2 text-sm text-gray-500">
                      {role.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {role.permissions?.slice(0, 6).map((perm) => (
                      <span
                        key={perm.id}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {perm.module}:{perm.action}
                      </span>
                    ))}
                    {(role.permissions?.length || 0) > 6 && (
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                        +{(role.permissions?.length || 0) - 6} more
                      </span>
                    )}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-xs text-gray-400">
                        No permissions set
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? 'Edit Role' : 'Create Role'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <Input
              label="Hierarchy (lower = higher authority)"
              type="number"
              value={formData.hierarchy}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  hierarchy: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />

          {/* Permissions Matrix */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Permissions
            </label>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Module
                    </th>
                    {ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500"
                      >
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {MODULE_GROUPS.map((group) => (
                    <Fragment key={group.label}>
                      <tr className="bg-gray-50/70">
                        <td
                          colSpan={ACTIONS.length + 1}
                          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"
                        >
                          {group.label}
                        </td>
                      </tr>
                      {group.modules.map((module) => (
                        <tr key={module.key}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-700">
                            {module.label}
                            {module.description && (
                              <p className="text-xs font-normal text-gray-400">
                                {module.description}
                              </p>
                            )}
                          </td>
                          {ACTIONS.map((action) => (
                            <td key={action} className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={hasPermission(module.key, action)}
                                onChange={() => togglePermission(module.key, action)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>

              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingRole ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
