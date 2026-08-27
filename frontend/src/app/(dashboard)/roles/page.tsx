'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Plus, Edit, Trash2, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { Role } from '@/types';
import {
  ALL_DC_FORM_RESOURCES,
  groupDcFormResources,
} from '@/lib/data-collection-forms';

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
      { key: 'data-collection', label: 'Data Collection (all forms)', description: 'Wildcard switch covering every form. Tick specific forms below instead to grant access per form.' },
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
      { key: 'user-designations', label: 'User Designations', description: 'Designation labels assignable to users, managed under Admin Tools' },
    ],
  },
  {
    label: 'Surveys',
    modules: [
      { key: 'surveys', label: 'Surveys' },
      { key: 'assigned-surveys', label: 'Assigned Surveys', description: 'Only "Read" is used — assigned surveys are visible or hidden' },
      { key: 'school-records', label: 'School Records', description: 'Survey targeting/response records for schools (Read/Update only)' },
    ],
  },
  {
    label: 'Admin Tools',
    modules: [
      { key: 'admin-tools', label: 'Admin Tools (menu group)', description: 'Controls whether the Admin Tools menu group is shown at all' },
      { key: 'categories', label: 'Categories', description: 'Survey category tags, managed under Admin Tools' },
      { key: 'geo-locations', label: 'Geo Locations' },
      { key: 'activity-logs', label: 'Activity Logs', description: 'System-wide audit/activity log viewer' },
      { key: 'recycle-bin', label: 'Recycle Bin', description: 'Restore/delete purged records (Read/Update/Delete only)' },
    ],
  },
];

const ACTIONS = ['create', 'read', 'update', 'delete'] as const;

interface PermissionEntry {
  module: string;
  action: string;
  resource?: string | null;
}

const DC_FORM_GROUPS = groupDcFormResources();


export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [dcFormsExpanded, setDcFormsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hierarchy: 0,
    permissions: [] as PermissionEntry[],
  });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Role[]>('/roles');
      setRoles(data);
    } catch {
      // Error handled by empty roles state
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
          resource: p.resource ?? null,
        })) || [],
    });
    setShowModal(true);
  };

  // Resource-scoped key so form-level grants don't collide with the wildcard
  // row of the same module.
  const permKey = (module: string, action: string, resource?: string | null) =>
    `${module}::${resource ?? ''}::${action}`;

  const togglePermission = (
    module: string,
    action: string,
    resource?: string | null,
  ) => {
    setFormData((prev) => {
      const key = permKey(module, action, resource);
      return {
        ...prev,
        permissions: prev.permissions.some(
          (p) => permKey(p.module, p.action, p.resource) === key,
        )
          ? prev.permissions.filter(
              (p) => permKey(p.module, p.action, p.resource) !== key,
            )
          : [...prev.permissions, { module, action, resource: resource ?? null }],
      };
    });
  };

  const hasPermission = (
    module: string,
    action: string,
    resource?: string | null,
  ) => {
    const key = permKey(module, action, resource);
    return formData.permissions.some(
      (p) => permKey(p.module, p.action, p.resource) === key,
    );
  };

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
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save role'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchRoles();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete role'));
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
                    {role.permissions?.slice(0, 6).map((perm) => {
                      const resource = perm.resource;
                      return (
                        <span
                          key={perm.id}
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                        >
                          {perm.module}
                          {resource ? `·${resource}` : ''}:{perm.action}
                        </span>
                      );
                    })}
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
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500 sm:px-4">
                      Module
                    </th>
                    {ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="w-10 px-2 py-2 text-center text-xs font-medium uppercase text-gray-500 sm:px-4"
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
                          className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:px-4"
                        >
                          {group.label}
                        </td>
                      </tr>
                      {group.modules.map((module) => (
                        <Fragment key={module.key}>
                          <tr>
                            <td className="px-2 py-2 text-sm font-medium text-gray-700 sm:px-4">
                              {module.key === 'data-collection' ? (
                                <button
                                  type="button"
                                  onClick={() => setDcFormsExpanded((v) => !v)}
                                  className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-brand-700"
                                >
                                  {dcFormsExpanded ? (
                                    <ChevronDown size={14} className="shrink-0 text-gray-400" />
                                  ) : (
                                    <ChevronRight size={14} className="shrink-0 text-gray-400" />
                                  )}
                                  {module.label}
                                </button>
                              ) : (
                                module.label
                              )}
                              {module.description && (
                                <p className="hidden text-xs font-normal text-gray-400 sm:block">
                                  {module.description}
                                </p>
                              )}
                            </td>
                            {ACTIONS.map((action) => (
                              <td key={action} className="px-2 py-2 text-center sm:px-4">
                                <input
                                  type="checkbox"
                                  checked={hasPermission(module.key, action)}
                                  onChange={() => togglePermission(module.key, action)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                              </td>
                            ))}
                          </tr>
                          {module.key === 'data-collection' && dcFormsExpanded && (
                            Object.entries(DC_FORM_GROUPS).map(([groupName, forms]) => (
                              <Fragment key={groupName}>
                                <tr className="bg-indigo-50/40">
                                  <td
                                    colSpan={ACTIONS.length + 1}
                                    className="px-6 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-400 sm:px-8"
                                  >
                                    {groupName}
                                  </td>
                                </tr>
                                {forms.map((form) => (
                                  <tr key={form.resource} className="bg-white">
                                    <td className="px-6 py-1.5 pl-10 text-xs font-medium text-gray-600 sm:px-8 sm:pl-12">
                                      {form.label}
                                      {form.description && (
                                        <p className="hidden text-[11px] font-normal text-gray-400 sm:block">
                                          {form.description}
                                        </p>
                                      )}
                                    </td>
                                    {ACTIONS.map((action) => (
                                      <td key={action} className="px-2 py-1.5 text-center sm:px-4">
                                        <input
                                          type="checkbox"
                                          checked={hasPermission('data-collection', action, form.resource)}
                                          onChange={() =>
                                            togglePermission('data-collection', action, form.resource)
                                          }
                                          className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </Fragment>
                            ))
                          )}
                        </Fragment>
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
