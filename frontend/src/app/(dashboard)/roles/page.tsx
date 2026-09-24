'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Edit3,
  Trash2,
  Shield,
  ShieldAlert,
  Layers,
  KeyRound,
  Crown,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { RoleEditorModal, type RoleFormData } from '@/components/roles/role-editor-modal';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

// ── Card glow (soft ambient ring around each card) ──────────────────────
const CARD_GLOW =
  'shadow-[0_0_28px_-6px_rgba(209,0,116,0.18)] hover:shadow-[0_0_36px_-4px_rgba(209,0,116,0.3)]';

const ACTION_CHIP: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  read: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  update: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  delete: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

const EMPTY_FORM: RoleFormData = {
  name: '',
  description: '',
  hierarchy: 0,
  permissions: [],
};

export default function RolesPage() {
  const canCreate = useAuthStore((s) => s.hasPermission('roles', 'create'));
  const canUpdate = useAuthStore((s) => s.hasPermission('roles', 'update'));
  const canDelete = useAuthStore((s) => s.hasPermission('roles', 'delete'));

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<RoleFormData>(EMPTY_FORM);

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
    setFormError(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setFormError(null);
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

  const handleSave = async () => {
    if (editingRole ? !canUpdate : !canCreate) return;
    try {
      setSaving(true);
      setFormError(null);
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, formData);
      } else {
        await api.post('/roles', formData);
      }
      setShowModal(false);
      fetchRoles();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save role'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDelete || !canDelete) return;
    try {
      setDeleting(true);
      await api.delete(`/roles/${showDelete.id}`);
      setShowDelete(null);
      fetchRoles();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to delete role'));
      setShowDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleCard = (id: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Stats ────────────────────────────────────────────────────────────
  const totalGrants = roles.reduce((n, r) => n + (r.permissions?.length || 0), 0);
  const modulesCovered = new Set(
    roles.flatMap((r) => (r.permissions || []).map((p) => p.module)),
  ).size;
  const topRole = roles.find((r) => r.hierarchy === Math.min(...roles.map((x) => x.hierarchy)));

  const stats = [
    { label: 'Total Roles', value: roles.length, icon: Layers },
    { label: 'Permission Grants', value: totalGrants, icon: KeyRound },
    { label: 'Modules Covered', value: modulesCovered, icon: Shield },
    { label: 'Top Authority', value: topRole?.name || '—', icon: Crown, isText: true },
  ];

  return (
    <>
      <Header
        title="Role Management"
        subtitle={`${roles.length} roles · ${totalGrants} permission grants configured`}
        actions={
          canCreate ? <Button onClick={openCreateModal} size="sm">
            <Plus size={16} className="mr-1" /> Add Role
          </Button> : undefined
        }
      />
      <div className="page-container space-y-6">
        {/* Summary cards — neutral with a soft glow all around */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-300 animate-fadeIn hover:-translate-y-0.5',
                CARD_GLOW,
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <s.icon size={18} className="mb-2 text-gray-400 transition-colors group-hover:text-brand-500" />
              <p
                className={cn(
                  'font-bold leading-tight text-gray-900',
                  s.isText ? 'truncate text-sm' : 'text-3xl',
                )}
                title={s.isText ? String(s.value) : undefined}
              >
                {s.value}
              </p>
              <p className="mt-1 text-[11px] font-medium text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Role cards */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-20 text-gray-400 animate-fadeIn">
            <Shield size={40} className="mb-3 opacity-40" />
            <p className="font-medium">No roles configured yet</p>
            {canCreate && <Button onClick={openCreateModal} size="sm" className="mt-4">
              <Plus size={14} className="mr-1" /> Create your first role
            </Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role, idx) => {
              const perms = role.permissions || [];
              const expanded = expandedCards.has(role.id);
              const visiblePerms = expanded ? perms : perms.slice(0, 8);
              return (
                <div
                  key={role.id}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 animate-fadeIn hover:-translate-y-0.5',
                    CARD_GLOW,
                  )}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition-colors duration-300 group-hover:bg-brand-50 group-hover:text-brand-600">
                          <Shield size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-gray-900">{role.name}</h3>
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Level {role.hierarchy}
                          </span>
                        </div>
                      </div>
                      {(canUpdate || canDelete) && <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        {canUpdate && (
                        <button
                          onClick={() => openEditModal(role)}
                          title="Edit role"
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Edit3 size={15} />
                        </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => {
                            setFormError(null);
                            setShowDelete(role);
                          }}
                          title="Delete role"
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                        )}
                      </div>}
                    </div>

                    {role.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500">
                        {role.description}
                      </p>
                    )}

                    {/* permission chips */}
                    <div className="mt-4 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {perms.length} permission grant{perms.length === 1 ? '' : 's'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {visiblePerms.map((perm) => (
                          <span
                            key={perm.id}
                            title={`${perm.module}${perm.resource ? `:${perm.resource}` : ''} — ${perm.action}`}
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset transition-transform hover:scale-105',
                              ACTION_CHIP[perm.action] ||
                                'bg-gray-50 text-gray-600 ring-gray-500/20',
                            )}
                          >
                            {perm.module}
                            {perm.resource ? `·${perm.resource}` : ''}
                            <span className="ml-1 opacity-60">{perm.action[0].toUpperCase()}</span>
                          </span>
                        ))}
                        {perms.length === 0 && (
                          <span className="text-xs italic text-gray-400">
                            No permissions set
                          </span>
                        )}
                      </div>
                      {perms.length > 8 && (
                        <button
                          onClick={() => toggleCard(role.id)}
                          className="text-[11px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
                        >
                          {expanded ? 'Show less' : `+${perms.length - 8} more…`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit — remounted on each open so internal state resets */}
      <RoleEditorModal
        key={`editor-${showModal}-${editingRole?.id ?? 'new'}`}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        saving={saving}
        editingRole={editingRole ? { id: editingRole.id, name: editingRole.name } : null}
        formData={formData}
        onChange={setFormData}
        onSave={handleSave}
        error={formError}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Delete Role"
        className="max-w-md"
      >
        {showDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  You are about to permanently delete{' '}
                  <span className="font-bold text-gray-900">“{showDelete.name}”</span>{' '}
                  and its{' '}
                  <span className="font-bold text-rose-600">
                    {showDelete.permissions?.length || 0}
                  </span>{' '}
                  permission grant{(showDelete.permissions?.length || 0) === 1 ? '' : 's'}.
                  Users assigned to this role will lose the associated access.
                </p>
                <p className="mt-2 text-xs font-medium text-gray-400">
                  This action will be recorded in the audit trail.
                </p>
              </div>
            </div>
            {formError && (
              <div className="animate-shake rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                loading={deleting}
              >
                <Trash2 size={14} className="mr-1" /> Delete Role
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
