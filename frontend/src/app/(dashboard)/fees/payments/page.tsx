'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Receipt, Printer, Ban, RotateCcw, ReceiptText, Calendar, BadgeCheck } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select,
  useSchools,
  MonthSelect,
  monthName,
  formatBDT,
} from '@/components/fee/filters';

const PAGE_SIZE = 50;

interface PaymentAllocation {
  feeHeadId: string;
  feeHeadName: string;
  amount: number;
}

interface PaymentRow {
  id: string;
  amount: string;
  paymentMethod: string;
  transactionRef: string | null;
  bankName: string | null;
  paymentDate: string;
  status: string;
  cancelReason: string | null;
  allocations: PaymentAllocation[] | null;
  student: { id: string; name: string; admissionNumber: string };
  studentFee: { month: number; payableAmount: string; paidAmount: string };
  collectedBy: { firstName: string; lastName: string };
}

interface ReceiptData {
  receipt: {
    receiptNumber: string;
    amount: string;
    status: string;
    issuedAt?: string;
    student: {
      name: string;
      admissionNumber: string;
      school?: { name: string };
      schoolClass?: { name: string };
      section?: { name: string };
      academicYear?: { name: string };
    };
  };
  payment: { amount: string; paymentMethod: string; paymentDate: string; transactionRef: string | null; status: string; allocations?: PaymentAllocation[] | null };
  fee: { month: number; baseAmount: string; discountAmount: string; payableAmount: string; paidAmount: string };
}

/* Payment-method chip colours — static classes so Tailwind can resolve them */
const METHOD_BADGE: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  bank: 'bg-blue-50 text-blue-700 ring-blue-200',
  mfs: 'bg-violet-50 text-violet-700 ring-violet-200',
  card: 'bg-amber-50 text-amber-700 ring-amber-200',
  other: 'bg-gray-50 text-gray-600 ring-gray-200',
};

const AVATAR_TONES = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PaymentHistoryPage() {
  const { data: schools = [] } = useSchools();
  const [schoolId, setSchoolId] = useState('');
  const [month, setMonth] = useState('');
  const [method, setMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState('');

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Derived default: first school (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');

  const fetchPayments = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId: activeSchoolId, page: String(page), limit: String(PAGE_SIZE) });
      if (month) params.set('month', month);
      if (method) params.set('paymentMethod', method);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (studentId) params.set('studentId', studentId);
      const { data } = await api.get(`/fee-collection/payments?${params.toString()}`);
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchoolId, month, method, dateFrom, dateTo, studentId, page]);

  const searchStudents = async (search: string) => {
    if (!search || search.length < 2) {
      setStudentId('');
      return;
    }
    try {
      const { data } = await api.get(`/students?schoolId=${activeSchoolId}&search=${encodeURIComponent(search)}&limit=1`);
      const first = data.items?.[0];
      setStudentId(first?.id ?? '');
      if (!first) alert('No student found matching that name/ID');
    } catch {
      /* ignore */
    }
  };

  const resetFilters = () => {
    setMonth('');
    setMethod('');
    setDateFrom('');
    setDateTo('');
    setStudentSearch('');
    setStudentId('');
    setPage(1);
  };

  const showReceipt = async (paymentId: string) => {
    try {
      const { data } = await api.get(`/fee-collection/payments/${paymentId}/receipt`);
      setReceipt(data);
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to load receipt'));
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) {
      alert('A cancellation reason is required');
      return;
    }
    try {
      await api.post(`/fee-collection/payments/${cancelTarget.id}/cancel`, { reason: cancelReason.trim() });
      setCancelTarget(null);
      setCancelReason('');
      fetchPayments();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to cancel payment'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(month || method || dateFrom || dateTo || studentId || studentSearch);

  return (
    <>
      {/* Print-only receipt: everything else on the page is hidden when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
          #receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
          }
          @page { margin: 12mm; }
        }
      `}</style>

      <Header title="Payment History" subtitle="All payments — receipts can be reprinted, payments never deleted" />
      <div className="page-container space-y-4">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
              <MonthSelect value={month} onChange={setMonth} />
              <Select
                label="Method"
                value={method}
                onChange={setMethod}
                placeholder="All methods"
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank' },
                  { value: 'mfs', label: 'MFS' },
                  { value: 'card', label: 'Card' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Input label="From Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input label="To Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Input
                label="Student (name / ID)"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onBlur={(e) => searchStudents(e.target.value)}
              />
            </div>
            {hasFilters && (
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={resetFilters} className="gap-1.5">
                  <RotateCcw size={13} /> Reset filters
                </Button>
                <span className="text-xs text-gray-400">Filters are applied automatically</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments table */}
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ReceiptText size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Payments</h3>
                <p className="text-xs text-gray-400">
                  {loading ? 'Loading…' : `${total.toLocaleString()} payment(s) recorded`}
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table text-sm">
                <thead className="border-b bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Collected By</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <Receipt size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-400">No payments found</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => (
                      <tr key={p.id} className={`group transition-colors hover:bg-indigo-50/50 ${p.status !== 'completed' ? 'bg-gray-50/60' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-300" />
                            {formatDate(p.paymentDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${AVATAR_TONES[(p.student?.name?.length ?? 0) % AVATAR_TONES.length]}`}>
                              {initials(p.student?.name ?? '')}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-800">{p.student?.name}</p>
                              <p className="font-mono text-[11px] text-gray-400">{p.student?.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{monthName(p.studentFee?.month)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold tabular-nums text-gray-900">৳{formatBDT(p.amount)}</span>
                          {(p.allocations?.length ?? 0) > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-gray-400">
                              {(p.allocations ?? []).map((a) => (
                                <li key={a.feeHeadId} className="flex justify-between gap-3">
                                  <span className="max-w-[140px] truncate">{a.feeHeadName}</span>
                                  <span className="shrink-0 tabular-nums">{formatBDT(a.amount)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-gray-400">full month</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${METHOD_BADGE[p.paymentMethod] ?? METHOD_BADGE.other}`}>
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.transactionRef ?? '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          {p.collectedBy ? `${p.collectedBy.firstName} ${p.collectedBy.lastName}` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            p.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                          }`}>
                            {p.status === 'completed' ? <BadgeCheck size={11} /> : null}
                            {p.status}
                          </span>
                          {p.cancelReason && <p className="mt-1 max-w-[160px] truncate text-[11px] text-gray-400" title={p.cancelReason ?? ''}>{p.cancelReason}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => showReceipt(p.id)}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                              title="View / reprint receipt"
                            >
                              <Printer size={15} />
                            </button>
                            {p.status === 'completed' && (
                              <button
                                onClick={() => {
                                  setCancelTarget(p);
                                  setCancelReason('');
                                }}
                                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                title="Cancel payment"
                              >
                                <Ban size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-3 text-sm">
                <span className="text-gray-500">{total.toLocaleString()} payment(s) — page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt reprint */}
      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Receipt (Reprint)" size="md">
        {receipt && (
          <div id="receipt-print-area" className="text-sm">
            {/* Money-receipt layout */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="border-b border-dashed border-gray-200 pb-3 text-center">
                <p className="text-base font-bold uppercase tracking-wide text-gray-900">
                  {receipt.receipt.student.school?.name ?? 'School'}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Money Receipt</p>
                {receipt.receipt.status === 'cancelled' && (
                  <p className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">CANCELLED</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-xs">
                <p className="text-gray-500">Receipt No</p>
                <p className="text-right font-mono font-semibold text-gray-900">{receipt.receipt.receiptNumber}</p>
                <p className="text-gray-500">Payment Date</p>
                <p className="text-right text-gray-900">{formatDate(receipt.payment.paymentDate)}</p>
                <p className="text-gray-500">Student</p>
                <p className="text-right font-medium text-gray-900">
                  {receipt.receipt.student.name}
                  <span className="ml-1 font-mono text-xs text-gray-400">({receipt.receipt.student.admissionNumber})</span>
                </p>
                <p className="text-gray-500">Class / Section</p>
                <p className="text-right text-gray-900">
                  {receipt.receipt.student.schoolClass?.name ?? '-'} · {receipt.receipt.student.section?.name ?? '-'}
                </p>
                <p className="text-gray-500">Fee Month</p>
                <p className="text-right text-gray-900">{monthName(receipt.fee.month)}</p>
              </div>

              {/* Fee breakdown table */}
              <table className="w-full border-t border-b border-gray-100 text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-gray-400">
                    <th className="py-1.5 font-semibold">Description</th>
                    <th className="py-1.5 text-right font-semibold">BDT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr>
                    <td className="py-1 text-gray-600">Base fee</td>
                    <td className="py-1 text-right tabular-nums text-gray-700">{formatBDT(receipt.fee.baseAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-600">Discount</td>
                    <td className="py-1 text-right tabular-nums text-gray-700">−{formatBDT(receipt.fee.discountAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-700">Payable</td>
                    <td className="py-1 text-right font-medium tabular-nums text-gray-800">{formatBDT(receipt.fee.payableAmount)}</td>
                  </tr>
                  {(receipt.payment.allocations ?? []).map((a) => (
                    <tr key={a.feeHeadId}>
                      <td className="py-1 pl-4 text-gray-500">Paid — {a.feeHeadName}</td>
                      <td className="py-1 text-right tabular-nums text-gray-600">{formatBDT(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Amount Paid</span>
                <span className="text-lg font-bold tabular-nums text-emerald-800">৳{formatBDT(receipt.payment.amount)}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <p className="text-gray-500">Remaining Due</p>
                <p className="text-right font-semibold tabular-nums text-gray-900">
                  ৳{formatBDT(Math.max(0, parseFloat(receipt.fee.payableAmount) - parseFloat(receipt.fee.paidAmount)))}
                </p>
                <p className="text-gray-500">Payment Method</p>
                <p className="text-right font-medium capitalize text-gray-900">{receipt.payment.paymentMethod}</p>
                {receipt.payment.transactionRef && (
                  <>
                    <p className="text-gray-500">Reference</p>
                    <p className="text-right font-mono text-gray-900">{receipt.payment.transactionRef}</p>
                  </>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between pt-2">
                <p className="text-[10px] text-gray-400">Reprinting does not create a new payment.</p>
                <div className="text-center">
                  <div className="mt-4 w-36 border-t border-gray-400 pt-0.5 text-[10px] text-gray-500">Authorized Signature</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" /> Print
              </Button>
              <Button onClick={() => setReceipt(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel payment */}
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Payment">
        <p className="mb-3 text-sm text-gray-600">
          Cancel the payment of <strong>BDT {cancelTarget && formatBDT(cancelTarget.amount)}</strong> by{' '}
          {cancelTarget?.student?.name}? The receipt is voided and the paid amount is rolled back. This is recorded
          in the audit trail — payments are never deleted.
        </p>
        <Input label="Reason *" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep Payment</Button>
          <Button onClick={handleCancel} className="bg-red-600">Cancel Payment</Button>
        </div>
      </Modal>
    </>
  );
}