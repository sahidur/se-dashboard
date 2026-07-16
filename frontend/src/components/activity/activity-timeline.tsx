'use client';

import { useState } from 'react';
import {
  Activity,
  ChevronDown,
  Clock,
  Globe,
  KeyRound,
  LogIn,
  LogOut,
  Monitor,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import { cn, formatDayLabel, formatRelativeTime, formatTime, parseUserAgent, resolveAssetUrl } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

// ── Action + category presentation config ────────────────────────────────
interface ActionStyle {
  label: string;
  icon: React.ElementType;
  dot: string; // timeline dot bg
  badge: string; // badge bg + text
  ring: string; // subtle left accent
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  LOGIN: {
    label: 'Signed in',
    icon: LogIn,
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    ring: 'from-emerald-500/60',
  },
  LOGOUT: {
    label: 'Signed out',
    icon: LogOut,
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    ring: 'from-slate-400/60',
  },
  CREATE: {
    label: 'Created',
    icon: Plus,
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    ring: 'from-blue-500/60',
  },
  UPDATE: {
    label: 'Updated',
    icon: Pencil,
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    ring: 'from-amber-500/60',
  },
  DELETE: {
    label: 'Deleted',
    icon: Trash2,
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    ring: 'from-rose-500/60',
  },
  RESTORE: {
    label: 'Restored',
    icon: RotateCcw,
    dot: 'bg-teal-500',
    badge: 'bg-teal-50 text-teal-700 ring-teal-600/20',
    ring: 'from-teal-500/60',
  },
  ACTIVATE: {
    label: 'Activated',
    icon: Shield,
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 ring-green-600/20',
    ring: 'from-green-500/60',
  },
  DEACTIVATE: {
    label: 'Deactivated',
    icon: Shield,
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    ring: 'from-rose-500/60',
  },
  RESET_PASSWORD: {
    label: 'Reset password',
    icon: KeyRound,
    dot: 'bg-purple-500',
    badge: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    ring: 'from-purple-500/60',
  },
  CHANGE_PASSWORD: {
    label: 'Changed password',
    icon: KeyRound,
    dot: 'bg-purple-500',
    badge: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    ring: 'from-purple-500/60',
  },
};

function actionStyle(action: string): ActionStyle {
  return (
    ACTION_STYLES[action] || {
      label: action.replace(/_/g, ' '),
      icon: Activity,
      dot: 'bg-brand-500',
      badge: 'bg-brand-50 text-brand-700 ring-brand-600/20',
      ring: 'from-brand-500/60',
    }
  );
}

/** Turn an entity/module name into a friendly category label. */
export function categoryLabel(module: string): string {
  const map: Record<string, string> = {
    auth: 'Authentication',
    User: 'Users',
    Role: 'Roles',
    Permission: 'Permissions',
    School: 'Schools',
    Survey: 'Surveys',
    SurveyCategory: 'Survey Categories',
    SurveyField: 'Survey Fields',
    SurveyResponse: 'Survey Responses',
    GeoLocation: 'Geo Locations',
    AuditLog: 'Activity Logs',
    Passkey: 'Passkeys',
  };
  if (map[module]) return map[module];
  // Prettify PascalCase / dc_ style names.
  return module
    .replace(/^Dc/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── Diff helpers ──────────────────────────────────────────────────────────
const HIDDEN_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'deletedAt',
  'refreshToken',
  'currentHashedRefreshToken',
]);

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return new Date(value).toLocaleString();
  if (typeof value === 'object') {
    if ('id' in value && Object.keys(value).length === 1) return String(value.id);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const str = String(value);
  return str.length > 120 ? `${str.slice(0, 120)}…` : str;
}

interface Change {
  field: string;
  before?: any;
  after?: any;
}

function computeChanges(log: AuditLogEntry): Change[] {
  const oldData = log.oldData || {};
  const newData = log.newData || {};
  const keys = new Set<string>([...Object.keys(oldData), ...Object.keys(newData)]);
  const changes: Change[] = [];
  keys.forEach((field) => {
    if (HIDDEN_FIELDS.has(field)) return;
    const before = (oldData as any)[field];
    const after = (newData as any)[field];
    const bothPresent = log.oldData && log.newData;
    if (bothPresent && JSON.stringify(before) === JSON.stringify(after)) return;
    changes.push({ field, before, after });
  });
  return changes;
}

function prettyField(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Id$/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── Single timeline entry ───────────────────────────────────────────────
function TimelineItem({ log, showActor }: { log: AuditLogEntry; showActor?: boolean }) {
  const [open, setOpen] = useState(false);
  const style = actionStyle(log.action);
  const Icon = style.icon;
  const ua = parseUserAgent(log.userAgent);
  const changes = computeChanges(log);
  const hasDetails = changes.length > 0 || !!log.ipAddress || !!log.userAgent;
  const DeviceIcon = ua.device === 'Mobile' ? Smartphone : ua.device === 'Tablet' ? Tablet : Monitor;

  return (
    <li className="relative pl-10 sm:pl-12">
      {/* Dot */}
      <span
        className={cn(
          'absolute left-2 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-sm ring-4 ring-white sm:left-2.5',
          style.dot,
        )}
      >
        <Icon size={13} />
      </span>

      <div
        className={cn(
          'overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md',
        )}
      >
        {/* subtle top accent */}
        <div className={cn('h-0.5 w-full bg-gradient-to-r to-transparent', style.ring)} />
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                style.badge,
              )}
            >
              {style.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {categoryLabel(log.module)}
            </span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400" title={new Date(log.createdAt).toLocaleString()}>
              <Clock size={11} />
              {formatRelativeTime(log.createdAt)} · {formatTime(log.createdAt)}
            </span>
          </div>

          {/* Actor + entity line */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
            {showActor && (
              <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                {log.user?.profilePicture ? (
                  <img
                    src={resolveAssetUrl(log.user.profilePicture)}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                    {log.user
                      ? `${log.user.firstName?.[0] ?? ''}${log.user.lastName?.[0] ?? ''}`
                      : '—'}
                  </span>
                )}
                {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System / Unknown'}
              </span>
            )}
            {log.entityId && (
              <span className="text-xs text-gray-400">
                ref: <span className="font-mono">{log.entityId.slice(0, 8)}</span>
              </span>
            )}
          </div>

          {/* Meta chips: IP + browser */}
          {(log.ipAddress || log.userAgent) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {log.ipAddress && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5">
                  <Globe size={11} /> {log.ipAddress}
                </span>
              )}
              {log.userAgent && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-1.5 py-0.5">
                  <DeviceIcon size={11} /> {ua.browser} · {ua.os}
                </span>
              )}
            </div>
          )}

          {/* Expandable data diff */}
          {changes.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
              >
                <ChevronDown
                  size={13}
                  className={cn('transition-transform', open && 'rotate-180')}
                />
                {open ? 'Hide' : 'View'} {changes.length} change{changes.length === 1 ? '' : 's'}
              </button>

              {open && (
                <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Field</th>
                        <th className="px-2.5 py-1.5 font-semibold">Before</th>
                        <th className="px-2.5 py-1.5 font-semibold">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {changes.map((c) => (
                        <tr key={c.field} className="align-top">
                          <td className="px-2.5 py-1.5 font-medium text-gray-700">
                            {prettyField(c.field)}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className="break-all rounded bg-rose-50 px-1 py-0.5 text-rose-700">
                              {formatValue(c.before)}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <span className="break-all rounded bg-emerald-50 px-1 py-0.5 text-emerald-700">
                              {formatValue(c.after)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {!hasDetails && null}
        </div>
      </div>
    </li>
  );
}

// ── Grouped timeline ───────────────────────────────────────────────────
interface ActivityTimelineProps {
  logs: AuditLogEntry[];
  loading?: boolean;
  showActor?: boolean;
  emptyLabel?: string;
}

export function ActivityTimeline({
  logs,
  loading,
  showActor,
  emptyLabel = 'No activity recorded yet',
}: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-14 text-gray-400">
        <Activity size={30} className="mb-2 opacity-50" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  // Group by calendar day.
  const groups: { key: string; label: string; items: AuditLogEntry[] }[] = [];
  for (const log of logs) {
    const label = formatDayLabel(log.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(log);
    else groups.push({ key: `${label}-${log.id}`, label, items: [log] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-gradient-to-r from-white via-white to-transparent py-1">
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              {group.label}
            </span>
            <span className="text-[11px] text-gray-400">
              {group.items.length} event{group.items.length === 1 ? '' : 's'}
            </span>
            <span className="h-px flex-1 bg-gray-100" />
          </div>
          <ul className="relative space-y-3">
            {/* vertical line */}
            <span className="absolute left-[19px] top-1 h-full w-px bg-gray-200 sm:left-[23px]" />
            {group.items.map((log) => (
              <TimelineItem key={log.id} log={log} showActor={showActor} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
