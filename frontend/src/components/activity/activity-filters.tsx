'use client';

import { Filter, RotateCcw, Search, X } from 'lucide-react';
import { categoryLabel } from './activity-timeline';

export type TimelinePreset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

export interface ActivityFilterState {
  search: string;
  action: string;
  module: string;
  timeline: TimelinePreset;
  startDate: string;
  endDate: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterState = {
  search: '',
  action: '',
  module: '',
  timeline: 'all',
  startDate: '',
  endDate: '',
};

export const ACTIVITY_ACTION_OPTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'ACTIVATE',
  'DEACTIVATE',
  'RESET_PASSWORD',
  'CHANGE_PASSWORD',
];

const TIMELINE_OPTIONS: { value: TimelinePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resolve the effective startDate/endDate (ISO) for a given filter state's timeline preset. */
export function resolveDateRange(filters: ActivityFilterState): { startDate?: string; endDate?: string } {
  const now = new Date();
  const today = toISODate(now);
  switch (filters.timeline) {
    case 'today':
      return { startDate: today, endDate: today };
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { startDate: toISODate(d), endDate: today };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { startDate: toISODate(d), endDate: today };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toISODate(d), endDate: today };
    }
    case 'custom':
      return { startDate: filters.startDate || undefined, endDate: filters.endDate || undefined };
    default:
      return {};
  }
}

interface ActivityFilterBarProps {
  filters: ActivityFilterState;
  onChange: (patch: Partial<ActivityFilterState>) => void;
  onReset: () => void;
  categories?: string[];
  showSearch?: boolean;
  showModule?: boolean;
}

export function ActivityFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  showSearch = true,
  showModule = false,
}: ActivityFilterBarProps) {
  const hasActiveFilters =
    !!filters.search || !!filters.action || !!filters.module || filters.timeline !== 'all';

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <Filter size={13} /> Filters
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100"
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>

      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search action, category, IP or reference…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
          showModule ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        {showModule && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Category</label>
            <select
              value={filters.module}
              onChange={(e) => onChange({ module: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Action</label>
          <select
            value={filters.action}
            onChange={(e) => onChange({ action: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All actions</option>
            {ACTIVITY_ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Timeline</label>
          <select
            value={filters.timeline}
            onChange={(e) => onChange({ timeline: e.target.value as TimelinePreset })}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {TIMELINE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {filters.timeline === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">From</label>
              <input
                type="date"
                value={filters.startDate}
                max={filters.endDate || undefined}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">To</label>
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
