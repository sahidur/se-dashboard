'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronLeft, School, Calendar, User as UserIcon, Clock, Pencil, Trash2,
  History, AlertTriangle, GraduationCap,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDateTimeBd, formatDate, formatRelativeTime, cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { SubmissionView, fullName } from '@/components/school-monitoring/submission-view';
import { MonitoringWizard } from '@/components/school-monitoring/monitoring-wizard';
import { getMonitoringForm } from '@/components/school-monitoring/form-catalog';
import type { MonitoringSubmission } from '@/types';

export default function MonitoringDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('school-monitoring-edit', 'update');
  const canDelete = hasPermission('school-monitoring-edit', 'delete');

  const [submission, setSubmission] = useState<MonitoringSubmission | null>(null);
  const [history, setHistory] = useState<MonitoringSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MonitoringSubmission>(`/school-monitoring/${id}`);
      setSubmission(data);
      const { data: hist } = await api.get<MonitoringSubmission[]>(
        `/school-monitoring/school/${data.schoolId}?formType=${data.formType}`,
      );
      setHistory(hist);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!submission) return;
    setDeleting(true);
    try {
      await api.delete(`/school-monitoring/${submission.id}`);
      router.push('/school-monitoring/feedback');
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (<div><Header title="Monitoring Feedback" /><div className="p-16 text-center text-sm text-gray-400">Loading…</div></div>);
  }
  if (notFound || !submission) {
    return (
      <div>
        <Header title="Monitoring Feedback" />
        <div className="p-16 text-center text-sm text-gray-500">
          Feedback not found or access denied.{' '}
          <Link href="/school-monitoring/feedback" className="text-brand-600 hover:underline">Back to list</Link>
        </div>
      </div>
    );
  }

  const form = getMonitoringForm(submission.formType);
  const isLatest = history[0]?.id === submission.id;

  if (editing) {
    return (
      <div>
        <Header title="Edit feedback" subtitle={submission.school?.name} />
        <div className="p-4 sm:p-6">
          {form && (
            <MonitoringWizard
              form={form}
              schoolId={submission.schoolId}
              schoolName={submission.school?.name}
              existing={submission}
              onSubmitted={(updated) => { setSubmission(updated); setEditing(false); load(); }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={form?.shortTitle || 'Monitoring Feedback'}
        subtitle={submission.school?.name}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/school-monitoring/feedback">
              <Button variant="outline" size="sm" className="h-9"><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
            </Link>
            {canEdit && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="destructive" size="sm" className="h-9" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        }
      />

      {/* min-w-0 on both grid tracks lets wide tables scroll inside their
          card instead of blowing the grid past the mobile viewport. */}
      <div className="grid gap-6 p-4 lg:grid-cols-[1fr_300px] sm:p-6">
        <div className="min-w-0 space-y-5">
          {/* Meta card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Meta icon={School} label="School" value={submission.school?.name || '—'} />
              <Meta icon={UserIcon} label="Observer" value={submission.observerName || fullName(submission.submittedBy)} />
              {submission.teacherName && <Meta icon={UserIcon} label="Teacher" value={submission.teacherName} />}
              <Meta icon={Calendar} label="Observed on" value={submission.observationDate ? formatDate(submission.observationDate) : '—'} />
              {submission.className && <Meta icon={GraduationCap} label="Grade(s)" value={submission.className} />}
              <Meta icon={Clock} label="Submitted" value={formatDateTimeBd(submission.createdAt)} />
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {getInitials(submission.submittedBy?.firstName || '?', submission.submittedBy?.lastName || '')}
              </div>
              <p className="text-xs text-gray-500">
                Submitted by <span className="font-medium text-gray-700">{fullName(submission.submittedBy)}</span>
                {submission.updatedAt !== submission.createdAt && ` · edited ${formatRelativeTime(submission.updatedAt)}`}
              </p>
              {isLatest && <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Latest</span>}
            </div>
          </div>

          <SubmissionView submission={submission} />
        </div>

        {/* History timeline */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-gray-900">Feedback history</h3>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{history.length}</span>
            </div>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              {history.map((h, idx) => {
                const active = h.id === submission.id;
                return (
                  <Link
                    key={h.id}
                    href={`/school-monitoring/feedback/${h.id}`}
                    className={cn(
                      'block rounded-xl border p-3 transition-colors',
                      active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-gray-800">{fullName(h.submittedBy)}</span>
                      {idx === 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Latest</span>}
                    </div>
                    <p className="text-xs text-gray-400">{formatRelativeTime(h.createdAt)}</p>
                    <p className="text-[11px] text-gray-400">{formatDateTimeBd(h.createdAt)}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete feedback" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>This will remove this monitoring feedback from the list. This action cannot be undone from the app.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={deleting} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="break-words text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
