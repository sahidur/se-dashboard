'use client';

import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityTimeline, categoryLabel } from '@/components/activity/activity-timeline';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import type { AuditLogStats, PaginatedAuditLogs } from '@/types';

const ACTION_OPTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'PERMISSIONS_UPDATE',
  'DELETE',
  'RESTORE',
  'RESET_PASSWORD',
  'CHANGE_PASSWORD',
];

interface Filters {
  module: string;
  action: string;
  search: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: Filters = {
  module: '',
  action: '',
  search: '',
  startDate: '',
  endDate: '',
};

export default function ActivityLogsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const limit = 25;

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    return params;
  }, [filters, page]);

  const { data, isLoading, isFetching } = useQuery<PaginatedAuditLogs>({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => api.get('/audit-logs', { params: queryParams }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['audit-log-categories'],
    queryFn: () => api.get('/audit-logs/categories').then((r) => r.data),
  });

  const { data: stats } = useQuery<AuditLogStats>({
    queryKey: ['audit-log-stats'],
    queryFn: () => api.get('/audit-logs/stats').then((r) => r.data),
  });

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasActiveFilters =
    filters.module || filters.action || filters.search || filters.startDate || filters.endDate;

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const statCards = [
    { label: 'Total events', value: stats?.total ?? 0, color: 'from-brand-500 to-brand-600' },
    { label: 'Logins', value: stats?.byAction?.LOGIN ?? 0, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Created', value: stats?.byAction?.CREATE ?? 0, color: 'from-blue-500 to-blue-600' },
    { label: 'Updated', value: stats?.byAction?.UPDATE ?? 0, color: 'from-amber-500 to-amber-600' },
    { label: 'Deleted', value: stats?.byAction?.DELETE ?? 0, color: 'from-rose-500 to-rose-600' },
  ];

  return (
    <>
      <Header
        title="Activity Logs"
        subtitle="System-wide audit trail of every action across the platform"
      />
      <div className="page-container">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((s) => (
              <div
                key={s.label}
                className={`rounded-xl bg-gradient-to-br ${s.color} p-3 text-white shadow-sm`}
              >
                <p className="text-2xl font-bold leading-none">{s.value}</p>
                <p className="mt-1 text-[11px] font-medium text-white/80">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter size={15} /> Filters
                {hasActiveFilters && (
                  <button
                    onClick={reset}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => update({ search: e.target.value })}
                  placeholder="Search category, action, IP or reference…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {filters.search && (
                  <button
                    onClick={() => update({ search: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Category */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Category</label>
                  <select
                    value={filters.module}
                    onChange={(e) => update({ module: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Action</label>
                  <select
                    value={filters.action}
                    onChange={(e) => update({ action: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">All actions</option>
                    {ACTION_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date from */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">From</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || undefined}
                    onChange={(e) => update({ startDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Date to */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">To</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    onChange={(e) => update({ endDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results header */}
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-sm text-gray-500">
              <Activity size={14} />
              {total} event{total === 1 ? '' : 's'}
              {isFetching && !isLoading && (
                <span className="ml-1 h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              )}
            </p>
          </div>

          {/* Timeline */}
          <ActivityTimeline
            logs={logs}
            loading={isLoading}
            showActor
            emptyLabel={hasActiveFilters ? 'No activity matches these filters' : 'No activity recorded yet'}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={15} className="mr-1" /> Prev
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={15} className="ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
