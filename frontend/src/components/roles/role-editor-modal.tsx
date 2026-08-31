'use client';

import { useMemo, useState, Fragment } from 'react';
import {
  X,
  Search,
  LayoutGrid,
  KeyRound,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ALL_DC_FORM_RESOURCES,
  groupDcFormResources,
} from '@/lib/data-collection-forms';

const MODULE_GROUPS: {
  label: string;
  accent: string;
  modules: { key: string; label: string; description?: string }[];
}[] = [
  {
    label: 'General',
    accent: 'bg-sky-50 text-sky-700',
    modules: [{ key: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Data Collection',
    accent: 'bg-violet-50 text-violet-700',
    modules: [
      {
        key: 'programme-overview',
        label: 'Programme Overview',
        description: 'Aggregated programme-wide stats page',
      },
      {
        key: 'school-information',
        label: 'School Information',
        description: 'Browse all schools + school profile view',
      },
      {
        key: 'data-collection',
        label: 'Data Collection (all forms)',
        description:
          'Wildcard switch covering every form. Tick specific forms below instead to grant access per form.',
      },
      {
        key: 'data-collection-edit',
        label: 'Edit Submitted Data',
        description:
          'Only the "Update" checkbox matters here. Without it, this role can still create new data-collection records but cannot modify one that has already been submitted.',
      },
    ],
  },
  {
    label: 'School Monitoring',
    accent: 'bg-emerald-50 text-emerald-700',
    modules: [
      {
        key: 'school-monitoring',
        label: 'School Monitoring',
        description:
          'Submit and view observation feedback for assigned schools (Combined / Quality / Operations checklists).',
      },
      {
        key: 'school-monitoring-edit',
        label: 'Edit / Delete Monitoring',
        description:
          'Only "Update" and "Delete" matter. Submissions are immutable to their author — this permission lets a role edit or delete any submitted monitoring feedback.',
      },
    ],
  },
  {
    label: 'Users & Roles',
    accent: 'bg-amber-50 text-amber-700',
    modules: [
      { key: 'users', label: 'Users' },
      { key: 'roles', label: 'Roles' },
      {
        key: 'user-designations',
        label: 'User Designations',
        description:
          'Designation labels assignable to users, managed under Admin Tools',
      },
    ],
  },
  {
    label: 'Surveys',
    accent: 'bg-pink-50 text-pink-700',
    modules: [
      { key: 'surveys', label: 'Surveys' },
      {
        key: 'assigned-surveys',
        label: 'Assigned Surveys',
        description:
          'Only "Read" is used — assigned surveys are visible or hidden',
      },
      {
        key: 'school-records',
        label: 'School Records',
        description:
          'Survey targeting/response records for schools (Read/Update only)',
      },
    ],
  },
  {
    label: 'Admin Tools',
    accent: 'bg-cyan-50 text-cyan-700',
    modules: [
      {
        key: 'admin-tools',
        label: 'Admin Tools (menu group)',
        description: 'Controls whether the Admin Tools menu group is shown at all',
      },
      {
        key: 'categories',
        label: 'Categories',
        description: 'Survey category tags, managed under Admin Tools',
      },
      { key: 'geo-locations', label: 'Geo Locations' },
      {
        key: 'activity-logs',
        label: 'Activity Logs',
        description: 'System-wide audit/activity log viewer',
      },
      {
        key: 'recycle-bin',
        label: 'Recycle Bin',
        description: 'Restore/delete purged records (Read/Update/Delete only)',
      },
    ],
  },
];

const ACTIONS = ['create', 'read', 'update', 'delete'] as const;

const ACTION_STYLES: Record<string, string> = {
  create: 'peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500 peer-checked:shadow-emerald-500/30',
  read: 'peer-checked:bg-sky-500 peer-checked:text-white peer-checked:border-sky-500 peer-checked:shadow-sky-500/30',
  update: 'peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 peer-checked:shadow-amber-500/30',
  delete: 'peer-checked:bg-rose-500 peer-checked:text-white peer-checked:border-rose-500 peer-checked:shadow-rose-500/30',
};

export interface PermissionEntry {
  module: string;
  action: string;
  resource?: string | null;
}

export interface RoleFormData {
  name: string;
  description: string;
  hierarchy: number;
  permissions: PermissionEntry[];
}

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  editingRole: { id: string; name: string } | null;
  formData: RoleFormData;
  onChange: (data: RoleFormData) => void;
  onSave: () => void;
  error?: string | null;
}

const DC_FORM_GROUPS = groupDcFormResources();

export function RoleEditorModal({
  isOpen,
  onClose,
  saving,
  editingRole,
  formData,
  onChange,
  onSave,
  error,
}: RoleEditorModalProps) {
  const [tab, setTab] = useState<'details' | 'permissions'>('details');
  const [search, setSearch] = useState('');
  const [dcFormsExpanded, setDcFormsExpanded] = useState(false);

  // State resets are handled by the parent remounting this component via a
  // `key` whenever the modal is opened.
  const permKey = (module: string, action: string, resource?: string | null) =>
    `${module}::${resource ?? ''}::${action}`;

  const hasPermission = (
    module: string,
    action: string,
    resource?: string | null,
  ) =>
    formData.permissions.some(
      (p) => permKey(p.module, p.action, p.resource) === permKey(module, action, resource),
    );

  const togglePermission = (
    module: string,
    action: string,
    resource?: string | null,
  ) => {
    const key = permKey(module, action, resource);
    onChange({
      ...formData,
      permissions: formData.permissions.some(
        (p) => permKey(p.module, p.action, p.resource) === key,
      )
        ? formData.permissions.filter(
            (p) => permKey(p.module, p.action, p.resource) !== key,
          )
        : [...formData.permissions, { module, action, resource: resource ?? null }],
    });
  };

  const hasAnyAction = (module: string, resource?: string | null) =>
    ACTIONS.some((a) => hasPermission(module, a, resource));

  const setAllActions = (
    module: string,
    resource: string | null,
    enable: boolean,
  ) => {
    const filtered = formData.permissions.filter(
      (p) =>
        !ACTIONS.some(
          (a) => permKey(p.module, p.action, p.resource) === permKey(module, a, resource),
        ),
    );
    onChange({
      ...formData,
      permissions: enable
        ? [
            ...filtered,
            ...ACTIONS.map((a) => ({ module, action: a, resource })),
          ]
        : filtered,
    });
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MODULE_GROUPS;
    return MODULE_GROUPS.map((g) => ({
      ...g,
      modules: g.modules.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.key.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q),
      ),
    })).filter((g) => g.modules.length > 0);
  }, [search]);

  const grantCount = formData.permissions.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative z-50 flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slideUp sm:rounded-3xl">
        {/* Header */}
        <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                  {editingRole ? `Edit “${editingRole.name}”` : 'Create New Role'}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {grantCount} permission grant{grantCount === 1 ? '' : 's'} selected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex w-fit rounded-xl bg-gray-100 p-1">
            {(
              [
                { key: 'details', label: 'Details', icon: LayoutGrid },
                { key: 'permissions', label: 'Permissions', icon: KeyRound },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200',
                  tab === key
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {error && (
            <div className="mb-4 animate-shake rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          {tab === 'details' ? (
            <div className="mx-auto max-w-2xl space-y-5 animate-fadeIn">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => onChange({ ...formData, name: e.target.value })}
                  placeholder="e.g. Regional Manager"
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Hierarchy{' '}
                  <span className="font-normal text-gray-400">
                    (lower = more authority)
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={formData.hierarchy}
                    onChange={(e) =>
                      onChange({
                        ...formData,
                        hierarchy: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-600"
                  />
                  <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700 ring-1 ring-brand-200">
                    {formData.hierarchy}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  <span>Most powerful</span>
                  <span>Least powerful</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    onChange({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  placeholder="What is this role responsible for?"
                  className="w-full resize-none rounded-xl border-2 border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Search */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search modules…"
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
              </div>

              {/* Module groups */}
              {filteredGroups.map((group) => (
                <section
                  key={group.label}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div
                    className={cn(
                      'flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5',
                      group.accent,
                    )}
                  >
                    <span className="text-sm font-bold">{group.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold ring-1 ring-gray-200">
                      {
                        formData.permissions.filter(
                          (p) =>
                            group.modules.some((m) => m.key === p.module) ||
                            (p.module === 'data-collection' && p.resource),
                        ).length
                      }{' '}
                      granted
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.modules.map((module) => (
                      <Fragment key={module.key}>
                        <div
                          className={cn(
                            'flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center',
                            hasAnyAction(module.key) && 'bg-brand-50/40',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {module.key === 'data-collection' ? (
                                <button
                                  type="button"
                                  onClick={() => setDcFormsExpanded((v) => !v)}
                                  className="flex items-center gap-1 text-left text-sm font-semibold text-gray-800 hover:text-brand-700"
                                >
                                  {dcFormsExpanded ? (
                                    <ChevronDown size={14} className="text-gray-400" />
                                  ) : (
                                    <ChevronRight size={14} className="text-gray-400" />
                                  )}
                                  {module.label}
                                </button>
                              ) : (
                                <span className="text-sm font-semibold text-gray-800">
                                  {module.label}
                                </span>
                              )}
                              {hasAnyAction(module.key) && (
                                <Check size={13} className="shrink-0 text-emerald-500" />
                              )}
                            </div>
                            {module.description && (
                              <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                                {module.description}
                              </p>
                            )}
                          </div>
                          {/* Action toggles */}
                          <div className="flex shrink-0 gap-1.5">
                            {ACTIONS.map((action) => (
                              <label key={action} className="cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={hasPermission(module.key, action)}
                                  onChange={() =>
                                    togglePermission(module.key, action)
                                  }
                                />
                                <span
                                  className={cn(
                                    'flex h-8 w-8 select-none items-center justify-center rounded-lg border-2 border-gray-200 bg-white text-[10px] font-bold uppercase text-gray-400 shadow-sm transition-all duration-200 hover:scale-105 hover:border-gray-300',
                                    ACTION_STYLES[action],
                                  )}
                                  title={`${action} — ${module.label}`}
                                >
                                  {action[0]}
                                </span>
                              </label>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setAllActions(
                                  module.key,
                                  null,
                                  !ACTIONS.every((a) =>
                                    hasPermission(module.key, a),
                                  ),
                                )
                              }
                              className="ml-1 h-8 rounded-lg bg-gray-100 px-2.5 text-[10px] font-bold uppercase text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                              title="Toggle all actions"
                            >
                              All
                            </button>
                          </div>
                        </div>

                        {/* Per-form DC resources */}
                        {module.key === 'data-collection' && dcFormsExpanded && (
                          <div className="bg-violet-50/30 px-4 py-3">
                            {Object.entries(DC_FORM_GROUPS).map(
                              ([groupName, forms]) => (
                                <div key={groupName} className="mb-3 last:mb-0">
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-violet-500">
                                      {groupName}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const allOn = forms.every((f) =>
                                          ACTIONS.every((a) =>
                                            hasPermission(
                                              'data-collection',
                                              a,
                                              f.resource,
                                            ),
                                          ),
                                        );
                                        forms.forEach((f) =>
                                          setAllActions(
                                            'data-collection',
                                            f.resource,
                                            !allOn,
                                          ),
                                        );
                                      }}
                                      className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-violet-500 ring-1 ring-violet-200 transition hover:bg-violet-100"
                                    >
                                      Toggle group
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {forms.map((form) => (
                                      <div
                                        key={form.resource}
                                        className={cn(
                                          'flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 transition-colors',
                                          hasAnyAction(
                                            'data-collection',
                                            form.resource,
                                          )
                                            ? 'border-violet-200'
                                            : 'border-gray-100',
                                        )}
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-semibold text-gray-700">
                                            {form.label}
                                          </p>
                                          {form.description && (
                                            <p className="hidden truncate text-[10px] text-gray-400 sm:block">
                                              {form.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                          {ACTIONS.map((action) => (
                                            <label key={action} className="cursor-pointer">
                                              <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={hasPermission(
                                                  'data-collection',
                                                  action,
                                                  form.resource,
                                                )}
                                                onChange={() =>
                                                  togglePermission(
                                                    'data-collection',
                                                    action,
                                                    form.resource,
                                                  )
                                                }
                                              />
                                              <span
                                                className={cn(
                                                  'flex h-6 w-6 select-none items-center justify-center rounded-md border border-gray-200 text-[9px] font-bold uppercase text-gray-400 transition-all hover:scale-110',
                                                  ACTION_STYLES[action],
                                                )}
                                                title={`${action} — ${form.label}`}
                                              >
                                                {action[0]}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </section>
              ))}

              {filteredGroups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                  No modules match “{search}”
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-4 sm:px-7">
          <p className="hidden text-xs text-gray-400 sm:block">
            {ALL_DC_FORM_RESOURCES.length}+ granular grants · changes are
            recorded in the audit trail
          </p>
          <div className="flex w-full gap-3 sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              className="flex-1 transition-transform hover:scale-[1.02] sm:flex-none"
            >
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
