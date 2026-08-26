'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search, ChevronLeft, ChevronRight, Plus, FileText, GraduationCap,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatDateTimeBd, formatRelativeTime, cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fullName } from '@/components/school-monitoring/submission-view';
import { MONITORING_FORM_LIST, getMonitoringForm } from '@/components/school-monitoring/form-catalog';
import type { PaginatedMonitoring, MonitoringSubmission } from '@/types';

const FORM_BADGE: Record<string, string> = {
  combined: 'bg-indigo-100 text-indigo-700',
  quality: 'bg-emerald-100 text-emerald-700',
  operations: 'bg-amber-100 text-amber-700',
};

const RESULT_FILTERS = [
  { value: 'yes', label: 'Mostly Yes / Satisfied' },
  { value: 'no', label: 'Mostly No / Not Satisfied' },
  { value: 'na', label: 'Mostly Not Applicable' },
];

const counts = (s: MonitoringSubmission) => {
  const c = { yes: 0, no: 0, na: 0 };
  s.answers?.forEach((a) => { if (a.result in c) c[a.result as 'yes' | 'no' | 'na']++; });
  return c;
};

const dominant = (s: MonitoringSubmission): 'yes' | 'no' | 'na' | '' => {
  const c = counts(s);
  const max = Math.max(c.yes, c.no, c.na);
  if (max === 0) return '';
  if (c.yes === max) return 'yes';
  if (c.no === max) return 'no';
  return 'na';
};

export default function MonitoringFeedbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<MonitoringSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [formType, setFormType] = useState(params.get('formType') || '');
  const [resultFilter, setResultFilter] = useState('');
  const schoolId = params.get('schoolId') || '';

  // The input stays instant; only the fetch waits for the user to pause.
  const debouncedSearch = useDebouncedValue(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) q.set('search', debouncedSearch);
      if (formType) q.set('formType', formType);
      if (schoolId) q.set('schoolId', schoolId);
      const { data } = await api.get<PaginatedMonitoring>(`/school-monitoring?${q.toString()}`);
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, formType, schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [debouncedSearch, formType]);

  const displayed = useMemo(
    () => (resultFilter ? items.filter((s) => dominant(s) === resultFilter) : items),
    [items, resultFilter],
  );

  return (
    <div>
      <Header
        title="Monitoring Feedback"
        subtitle="Submitted school observation feedback across your schools"
        actions={
          <Link href="/school-monitoring">
            <Button><Plus className="mr-1.5 h-4 w-4" /> New Observation</Button>
          </Link>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by school, observer, teacher or remarks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm:w-52">
            <Select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              placeholder="All categories"
              options={MONITORING_FORM_LIST.map((f) => ({ value: f.type, label: f.shortTitle }))}
            />
          </div>
          <div className="sm:w-52">
            <Select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              placeholder="All results"
              options={RESULT_FILTERS}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {resultFilter ? `${displayed.length} of ${total}` : total} submission{(resultFilter ? displayed.length : total) === 1 ? '' : 's'}
        </p>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading feedback…</div>
        ) : displayed.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-gray-500">
            <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            No monitoring feedback found.
          </CardContent></Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">School</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Observer</th>
                    <th className="px-4 py-3 font-semibold">Teacher</th>
                    <th className="px-4 py-3 font-semibold">Grade(s)</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Results</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.map((s) => {
                    const form = getMonitoringForm(s.formType);
                    const c = counts(s);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => router.push(`/school-monitoring/feedback/${s.id}`)}
                        className="cursor-pointer transition-colors hover:bg-indigo-50/40"
                      >
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="block whitespace-normal break-words font-medium text-gray-900">{s.school?.name || 'School'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', FORM_BADGE[s.formType] || 'bg-gray-100 text-gray-600')}>
                            {form?.shortTitle || s.formType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{s.observerName || fullName(s.submittedBy)}</td>
                        <td className="px-4 py-3 text-gray-700">{s.teacherName || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {s.className ? (
                            <span className="inline-flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> {s.className}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {s.observationDate ? formatDate(s.observationDate) : formatDate(s.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="flex gap-1 text-[11px]">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{c.yes} Y</span>
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{c.no} N</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{c.na} N/A</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400" title={formatDateTimeBd(s.createdAt)}>{formatRelativeTime(s.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
