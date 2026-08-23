'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ChevronLeft, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { MonitoringWizard } from '@/components/school-monitoring/monitoring-wizard';
import { fullName } from '@/components/school-monitoring/submission-view';
import { getMonitoringForm } from '@/components/school-monitoring/form-catalog';
import type { DcSchool, MonitoringSubmission } from '@/types';

export default function MonitoringFillPage() {
  const router = useRouter();
  const params = useSearchParams();
  const schoolId = params.get('schoolId') || '';
  const formType = params.get('form') || '';

  const form = useMemo(() => getMonitoringForm(formType), [formType]);
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [history, setHistory] = useState<MonitoringSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    api.get<DcSchool>(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    api.get<MonitoringSubmission[]>(`/school-monitoring/school/${schoolId}?formType=${formType}`)
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [schoolId, formType]);

  if (!schoolId || !form) {
    return (
      <div>
        <Header title="School Monitoring" />
        <div className="p-6 text-center text-sm text-gray-500">
          Invalid monitoring form.{' '}
          <Link href="/school-monitoring" className="text-brand-600 hover:underline">Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={form.shortTitle}
        subtitle={school?.name}
        actions={
          <Link href="/school-monitoring">
            <Button variant="outline"><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
          </Link>
        }
      />

      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_320px] sm:p-6">
        {/* Wizard */}
        <div>
          <MonitoringWizard
            form={form}
            schoolId={schoolId}
            schoolName={school?.name}
            onSubmitted={(sub) => router.push(`/school-monitoring/feedback/${sub.id}`)}
            onCancel={() => router.push('/school-monitoring')}
          />
        </div>

        {/* Others' feedback */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-gray-900">Previous feedback</h3>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{history.length}</span>
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-gray-400">Loading…</p>
            ) : history.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                No feedback yet for this form. You&apos;ll be the first.
              </div>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {history.map((h, idx) => {
                  const counts = { yes: 0, no: 0, na: 0 };
                  h.answers?.forEach((a) => { if (a.result in counts) counts[a.result as 'yes' | 'no' | 'na']++; });
                  return (
                    <Link
                      key={h.id}
                      href={`/school-monitoring/feedback/${h.id}`}
                      className={cn(
                        'block rounded-xl border p-3 transition-colors hover:bg-gray-50',
                        idx === 0 ? 'border-brand-200 bg-brand-50/40' : 'border-gray-200',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-gray-800">{fullName(h.submittedBy)}</span>
                        {idx === 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Latest</span>}
                      </div>
                      <p className="text-xs text-gray-400">{formatRelativeTime(h.createdAt)}</p>
                      <div className="mt-1.5 flex gap-1.5 text-[11px]">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{counts.yes} Yes</span>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{counts.no} No</span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{counts.na} N/A</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
