'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ClipboardCheck, Download } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select, useSchools, MonthSelect, monthName, formatBDT } from '@/components/fee/filters';

const PAGE_SIZE = 50;

interface HeadLine {
  feeHeadName: string;
  payable: number;
  paid: number;
  due: number;
}

interface AdjustmentRow {
  id: string;
  schoolName?: string | null;
  studentName: string | null;
  admissionNumber: string | null;
  month: number;
  kind:
    | 'pre_admission_payment'
    | 'inapplicable_head_payment'
    | 'inapplicable_head_due'
    | 'post_dropout_payment';
  amount: number;
  details: { reason?: string; heads?: HeadLine[] };
  status: string;
  resolutionNote: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<AdjustmentRow['kind'], string> = {
  pre_admission_payment: 'Paid before admission month',
  inapplicable_head_payment: 'Paid for a head that does not apply',
  inapplicable_head_due: 'Unpaid head that does not apply',
  post_dropout_payment: 'Paid after dropout month',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  refunded: 'bg-emerald-100 text-emerald-800',
  applied_manually: 'bg-sky-100 text-sky-800',
  waived: 'bg-violet-100 text-violet-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

interface MigrationFile {
  name: string;
  size: number;
  modifiedAt: string;
}

const RESOLUTIONS = [
  { value: 'refunded', label: 'Refunded to guardian' },
  { value: 'applied_manually', label: 'Applied to another due manually' },
  { value: 'waived', label: 'Waived / written off' },
];

export default function FeeAdjustmentsPage() {
  const { data: schools = [] } = useSchools();
  const [schoolId, setSchoolId] = useState('');
  const [status, setStatus] = useState('open');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [target, setTarget] = useState<AdjustmentRow | null>(null);
  const [resolution, setResolution] = useState('refunded');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Empty = all schools (admins). Non-admins must pick one of their schools.
  const activeSchoolId = schoolId;

  // TEMPORARY: review files written by the fee migration (admins only; the
  // list stays empty for everyone else).
  const [files, setFiles] = useState<MigrationFile[]>([]);
  useEffect(() => {
    void Promise.resolve()
      .then(() => api.get('/fee-collection/migration-reports'))
      .then(({ data }) => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]));
  }, []);

  const downloadFile = async (name: string) => {
    try {
      const { data } = await api.get(`/fee-collection/migration-reports/${encodeURIComponent(name)}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(getErrorMessage(error, 'Download failed'));
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (activeSchoolId) params.set('schoolId', activeSchoolId);
      if (status) params.set('status', status);
      const { data } = await api.get(`/fee-collection/adjustments?${params.toString()}`);
      const items: AdjustmentRow[] = data.items ?? [];
      setRows(month ? items.filter((r) => String(r.month) === month) : items);
      setTotal(data.total ?? 0);
    } catch (error) {
      setRows([]);
      setLoadError(getErrorMessage(error, 'Could not load adjustments'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Deferred to a microtask so the loader's setState is not synchronous
    // within the effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(fetchRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchoolId, status, month, page]);

  const openResolve = (row: AdjustmentRow) => {
    setTarget(row);
    setResolution('refunded');
    setNote('');
  };

  const handleResolve = async () => {
    if (!target) return;
    if (!note.trim()) {
      alert('Please add a note (for example the voucher or receipt reference)');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/fee-collection/adjustments/${target.id}/resolve`, {
        status: resolution,
        note: note.trim(),
      });
      setTarget(null);
      fetchRows();
    } catch (error) {
      alert(getErrorMessage(error, 'Could not save the resolution'));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Header
        title="Fee Adjustments"
        subtitle="Money collected for months or heads that no longer apply after an admission-date change - decide how each is settled"
      />
      <div className="page-container space-y-4">
        {files.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-800">Fee migration review files</h3>
              <p className="mb-3 text-xs text-gray-400">
                Admin only, temporary. Contains student names - do not share.
              </p>
              <ul className="divide-y divide-gray-100">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-mono text-xs text-gray-700">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                      <Button size="sm" variant="outline" onClick={() => downloadFile(f.name)} className="gap-1.5">
                        <Download size={13} /> Download
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="School"
                value={activeSchoolId}
                onChange={(v) => {
                  setSchoolId(v);
                  setPage(1);
                }}
                placeholder="All schools"
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                placeholder="All"
                options={[
                  { value: 'open', label: 'Open (needs review)' },
                  { value: 'refunded', label: 'Refunded' },
                  { value: 'applied_manually', label: 'Applied manually' },
                  { value: 'waived', label: 'Waived' },
                  { value: 'dismissed', label: 'Dismissed (no longer applies)' },
                ]}
              />
              <MonthSelect value={month} onChange={setMonth} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ClipboardCheck size={15} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Adjustments</h3>
              <p className="text-xs text-gray-400">
                {loading ? 'Loading…' : `${total.toLocaleString()} record(s)`}
              </p>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table text-sm">
                <thead className="border-b bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">School</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 font-semibold">Issue</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                        Loading…
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-sm text-red-600">
                        {loadError}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                        Nothing to review
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="hover:bg-indigo-50/50">
                        <td className="px-4 py-3 text-xs text-gray-600">{r.schoolName ?? '-'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{r.studentName ?? '-'}</p>
                          <p className="font-mono text-[11px] text-gray-400">{r.admissionNumber}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          {monthName(r.month)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <p className="font-medium text-gray-700">{KIND_LABEL[r.kind] ?? r.kind}</p>
                          {r.details?.reason && <p className="text-gray-400">{r.details.reason}</p>}
                          {(r.details?.heads ?? []).map((h) => (
                            <p key={h.feeHeadName} className="text-gray-400">
                              {h.feeHeadName}: paid ৳{formatBDT(h.paid)}, due ৳{formatBDT(h.due)}
                            </p>
                          ))}
                          {r.resolutionNote && (
                            <p className="mt-1 text-gray-500">Note: {r.resolutionNote}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                          ৳{formatBDT(r.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                              STATUS_BADGE[r.status] ?? STATUS_BADGE.dismissed
                            }`}
                          >
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => openResolve(r)}>
                              Resolve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title="Resolve Adjustment">
        <p className="mb-3 text-sm text-gray-600">
          <strong>{target?.studentName}</strong> - {target && monthName(target.month)} - ৳
          {target && formatBDT(target.amount)}. Payments and receipts are not changed by this action; it
          only records how Finance settled the amount. It is saved in the audit trail.
        </p>
        <div className="space-y-3">
          <Select
            label="Resolution"
            value={resolution}
            onChange={setResolution}
            options={RESOLUTIONS}
          />
          <Input
            label="Note * (voucher / receipt reference)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
