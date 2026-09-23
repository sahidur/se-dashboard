'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  HandCoins,
  Printer,
  BadgeCheck,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  MonthSelect,
  formatBDT,
  monthName,
  feeStatusBadge,
} from '@/components/fee/filters';

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string; isActive: boolean }[];
}

interface CollectionRow {
  student: {
    id: string;
    admissionNumber: string;
    name: string;
    rollNumber: number | null;
    className: string | null;
    sectionName: string | null;
  };
  currentFee: {
    id: string;
    baseAmount: number;
    discountAmount: number;
    payableAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
    breakdown: { feeHeadId: string; feeHeadName: string; base: number; discount: number; payable: number }[];
  } | null;
  previousDue: number;
  totalDue: number;
}

interface HeadDue {
  feeHeadId: string;
  feeHeadName: string;
  payable: number;
  paid: number;
  due: number;
}

interface PaymentAllocation {
  feeHeadId: string;
  feeHeadName: string;
  amount: number;
}

interface ReceiptData {
  receipt: {
    receiptNumber: string;
    amount: string;
    status: string;
    student: { name: string; admissionNumber: string; school?: { name: string }; schoolClass?: { name: string }; section?: { name: string } };
  };
  payment: { amount: string; paymentMethod: string; paymentDate: string; transactionRef: string | null; allocations?: PaymentAllocation[] };
  fee: { month: number; payableAmount: string; paidAmount: string; baseAmount: string; discountAmount: string };
}

export default function MonthlyCollectionPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();

  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [collectTarget, setCollectTarget] = useState<CollectionRow | null>(null);
  const [headDues, setHeadDues] = useState<HeadDue[]>([]);
  const [headAllocs, setHeadAllocs] = useState<Record<string, { checked: boolean; amount: string }>>({});
  const [loadingDues, setLoadingDues] = useState(false);
  const [collectForm, setCollectForm] = useState({
    paymentMethod: 'cash',
    transactionRef: '',
    bankName: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [collecting, setCollecting] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [feeHeadInfo, setFeeHeadInfo] = useState<Record<string, { installmentAllowed: boolean; feeSchedule: string }>>({});

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

  useEffect(() => {
    api
      .get('/fee-heads?activeOnly=true')
      .then(({ data }) => {
        const next: Record<string, { installmentAllowed: boolean; feeSchedule: string }> = {};
        for (const h of data) next[h.id] = { installmentAllowed: !!h.installmentAllowed, feeSchedule: h.feeSchedule ?? 'monthly' };
        setFeeHeadInfo(next);
      })
      .catch(() => setFeeHeadInfo({}));
  }, []);

  // Reset class/section when the school changes (render-time adjustment)
  const [lastSchool, setLastSchool] = useState(activeSchoolId);
  if (lastSchool !== activeSchoolId) {
    setLastSchool(activeSchoolId);
    setClassId('');
    setSectionId('');
  }

  useEffect(() => {
    if (!activeSchoolId) return;
    api
      .get(`/students/classes?schoolId=${activeSchoolId}&activeOnly=true`)
      .then(({ data }) => setClasses(data))
      .catch(() => setClasses([]));
  }, [activeSchoolId]);

  const loadCollection = async () => {
    if (!activeSchoolId || !activeYearId || !classId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ schoolId: activeSchoolId, academicYearId: activeYearId, month, classId });
      if (sectionId) params.set('sectionId', sectionId);
      const { data } = await api.get(`/fee-collection/monthly?${params.toString()}`);
      setRows(data);
    } catch (error) {
      setRows([]);
      setMessage(getErrorMessage(error, 'Failed to load collection list'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchoolId, activeYearId, month, classId, sectionId]);

  const sectionOptions = useMemo(() => {
    const cls = classes.find((c) => c.id === classId);
    return (cls?.sections ?? []).map((s) => ({ value: s.id, label: s.name }));
  }, [classes, classId]);

  const openCollect = async (row: CollectionRow) => {
    setCollectTarget(row);
    setHeadDues([]);
    setHeadAllocs({});
    setCollectForm({
      paymentMethod: 'cash',
      transactionRef: '',
      bankName: '',
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    if (!row.currentFee || !activeYearId) return;
    setLoadingDues(true);
    try {
      const { data } = await api.get(
        `/fee-collection/students/${row.student.id}/dues-by-head?academicYearId=${activeYearId}`,
      );
      const monthEntry = (data.months ?? []).find((m: { id: string }) => m.id === row.currentFee?.id);
      const dues: HeadDue[] = monthEntry?.heads ?? [];
      setHeadDues(dues);
      const allocs: Record<string, { checked: boolean; amount: string }> = {};
      for (const h of dues) allocs[h.feeHeadId] = { checked: true, amount: String(h.due) };
      setHeadAllocs(allocs);
    } catch {
      // fallback: distribute the month's remaining due proportionally
      const payableTotal = row.currentFee.breakdown.reduce((s, b) => s + b.payable, 0);
      const allocs: Record<string, { checked: boolean; amount: string }> = {};
      for (const b of row.currentFee.breakdown) {
        const share = payableTotal > 0 ? b.payable / payableTotal : 0;
        allocs[b.feeHeadId] = {
          checked: true,
          amount: String(Math.round(row.currentFee.dueAmount * share * 100) / 100),
        };
      }
      setHeadAllocs(allocs);
    } finally {
      setLoadingDues(false);
    }
  };

  const updateAlloc = (headId: string, patch: { checked?: boolean; amount?: string }) => {
    setHeadAllocs((prev) => ({
      ...prev,
      [headId]: { checked: patch.checked ?? prev[headId]?.checked ?? false, amount: patch.amount ?? prev[headId]?.amount ?? '0' },
    }));
  };

  const selectedAllocations = useMemo(
    () =>
      headDues
        .filter((h) => headAllocs[h.feeHeadId]?.checked)
        .map((h) => ({
          feeHeadId: h.feeHeadId,
          feeHeadName: h.feeHeadName,
          amount: Math.round((parseFloat(headAllocs[h.feeHeadId]?.amount ?? '0') || 0) * 100) / 100,
        }))
        .filter((a) => a.amount > 0),
    [headDues, headAllocs],
  );

  const allocTotal = useMemo(
    () => Math.round(selectedAllocations.reduce((s, a) => s + a.amount, 0) * 100) / 100,
    [selectedAllocations],
  );

  const handleCollect = async () => {
    if (!collectTarget?.currentFee) return;
    if (selectedAllocations.length === 0 || allocTotal <= 0) {
      alert('Select at least one fee head to pay');
      return;
    }
    for (const a of selectedAllocations) {
      const head = headDues.find((h) => h.feeHeadId === a.feeHeadId);
      if (!head) continue;
      if (!feeHeadInfo[a.feeHeadId]?.installmentAllowed && head.due - a.amount > 0.009) {
        alert(`"${head.feeHeadName}" does not accept installments — the full ${formatBDT(head.due)} is required`);
        return;
      }
    }
    setCollecting(true);
    try {
      const { data } = await api.post('/fee-collection/payments', {
        studentFeeId: collectTarget.currentFee.id,
        amount: allocTotal,
        allocations: selectedAllocations.map((a) => ({ feeHeadId: a.feeHeadId, amount: a.amount })),
        paymentMethod: collectForm.paymentMethod,
        transactionRef: collectForm.transactionRef || undefined,
        bankName: collectForm.bankName || undefined,
        paymentDate: collectForm.paymentDate,
      });
      setReceipt({
        receipt: data.receipt,
        payment: data.payment,
        fee: data.fee,
      });
      setCollectTarget(null);
      loadCollection();
    } catch (error) {
      alert(getErrorMessage(error, 'Payment failed'));
    } finally {
      setCollecting(false);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.base += r.currentFee?.baseAmount ?? 0;
        acc.discount += r.currentFee?.discountAmount ?? 0;
        acc.payable += r.currentFee?.payableAmount ?? 0;
        acc.paid += r.currentFee?.paidAmount ?? 0;
        acc.due += r.currentFee?.dueAmount ?? 0;
        acc.prev += r.previousDue;
        return acc;
      },
      { base: 0, discount: 0, payable: 0, paid: 0, due: 0, prev: 0 },
    );
  }, [rows]);

  return (
    <>
      <Header
        title="Monthly Collection"
        subtitle="Generate fees and collect monthly payments"
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!activeSchoolId || !activeYearId}
            onClick={async () => {
              try {
                const { data } = await api.post('/fee-collection/generate', {
                  schoolId: activeSchoolId,
                  academicYearId: activeYearId,
                  month: parseInt(month, 10),
                  classId: classId || undefined,
                });
                setMessage(`Generated ${data.created} fee record(s) (${data.skipped} already existed).`);
                loadCollection();
              } catch (error) {
                alert(getErrorMessage(error, 'Fee generation failed'));
              }
            }}
          >
            Generate / Refresh Fees
          </Button>
        }
      />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Academic Year" value={activeYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            <MonthSelect value={month} onChange={setMonth} />
            <Select
              label="Class"
              value={classId}
              onChange={(v) => {
                setClassId(v);
                setSectionId('');
              }}
              placeholder="Select class"
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select label="Section" value={sectionId} onChange={setSectionId} placeholder="All sections" options={sectionOptions} />
          </CardContent>
        </Card>

        {message && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>}

        {!classId ? (
          <p className="py-12 text-center text-sm text-gray-400">Select a class to list students</p>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="modern-table">
                  <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Base</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Payable</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Current Due</th>
                      <th className="px-4 py-3">Previous Due</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No students — add students or generate fees</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{row.student.name}</p>
                            <p className="text-xs text-gray-400">
                              {row.student.admissionNumber}
                              {row.student.rollNumber != null ? ` · Roll ${row.student.rollNumber}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3">{row.currentFee ? formatBDT(row.currentFee.baseAmount) : '-'}</td>
                          <td className="px-4 py-3">{row.currentFee ? formatBDT(row.currentFee.discountAmount) : '-'}</td>
                          <td className="px-4 py-3">{row.currentFee ? formatBDT(row.currentFee.payableAmount) : '-'}</td>
                          <td className="px-4 py-3">{row.currentFee ? formatBDT(row.currentFee.paidAmount) : '-'}</td>
                          <td className={`px-4 py-3 font-medium ${row.currentFee && row.currentFee.dueAmount > 0 ? 'text-red-600' : ''}`}>
                            {row.currentFee ? formatBDT(row.currentFee.dueAmount) : '-'}
                          </td>
                          <td className={`px-4 py-3 ${row.previousDue > 0 ? 'font-medium text-orange-600' : ''}`}>
                            {formatBDT(row.previousDue)}
                          </td>
                          <td className="px-4 py-3">
                            {row.currentFee && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${feeStatusBadge(row.currentFee.status)}`}>
                                {row.currentFee.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.currentFee && row.currentFee.dueAmount > 0 && (
                              <Button size="sm" onClick={() => openCollect(row)}>
                                <HandCoins size={14} className="mr-1" /> Collect
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot className="border-t bg-gray-50 text-sm font-semibold">
                      <tr>
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2">{formatBDT(totals.base)}</td>
                        <td className="px-4 py-2">{formatBDT(totals.discount)}</td>
                        <td className="px-4 py-2">{formatBDT(totals.payable)}</td>
                        <td className="px-4 py-2">{formatBDT(totals.paid)}</td>
                        <td className="px-4 py-2">{formatBDT(totals.due)}</td>
                        <td className="px-4 py-2">{formatBDT(totals.prev)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Collect payment modal */}
      <Modal isOpen={!!collectTarget} onClose={() => setCollectTarget(null)} title="Collect Payment" size="lg">
        {collectTarget && (
          <>
            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-gray-900">
                {collectTarget.student.name} ({collectTarget.student.admissionNumber})
              </p>
              <p className="text-gray-500">
                {collectTarget.student.className} · Section {collectTarget.student.sectionName ?? '-'} ·{' '}
                {monthName(parseInt(month, 10))}
              </p>
              {collectTarget.currentFee && (
                <div className="mt-3">
                  {loadingDues ? (
                    <p className="py-2 text-xs text-gray-400">Loading head-wise dues…</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-left text-gray-500">
                        <tr>
                          <th className="py-1">Pay</th>
                          <th className="py-1">Fee Head</th>
                          <th className="py-1">Payable</th>
                          <th className="py-1">Paid</th>
                          <th className="py-1">Due</th>
                          <th className="py-1">Amount Now</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headDues.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-2 text-gray-400">
                              This month has no head-wise due left.
                            </td>
                          </tr>
                        ) : (
                          headDues.map((h) => {
                            const alloc = headAllocs[h.feeHeadId];
                            const installment = feeHeadInfo[h.feeHeadId]?.installmentAllowed ?? false;
                            const schedule = feeHeadInfo[h.feeHeadId]?.feeSchedule ?? 'monthly';
                            return (
                              <tr key={h.feeHeadId}>
                                <td className="py-1">
                                  <input
                                    type="checkbox"
                                    checked={alloc?.checked ?? false}
                                    onChange={(e) =>
                                      updateAlloc(h.feeHeadId, { checked: e.target.checked, amount: String(h.due) })
                                    }
                                  />
                                </td>
                                <td className="py-1">
                                  {h.feeHeadName}
                                  <span className="ml-1 text-gray-400">
                                    {schedule === 'yearly'
                                      ? '(yearly)'
                                      : schedule === 'half_yearly'
                                        ? '(half-yearly)'
                                        : installment
                                          ? '(installment ok)'
                                          : ''}
                                  </span>
                                </td>
                                <td className="py-1">{formatBDT(h.payable)}</td>
                                <td className="py-1">{formatBDT(h.paid)}</td>
                                <td className="py-1 font-medium">{formatBDT(h.due)}</td>
                                <td className="py-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={alloc?.amount ?? ''}
                                    disabled={!alloc?.checked}
                                    onChange={(e) => updateAlloc(h.feeHeadId, { amount: e.target.value })}
                                    className={`h-7 w-24 rounded border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-gray-50 disabled:text-gray-400 ${
                                      installment ? '' : 'bg-gray-50'
                                    }`}
                                    title={installment ? 'Installment accepted — partial amount allowed' : 'Paid in full (no installments)'}
                                  />
                                  {!installment && <span className="ml-1 text-gray-400">full</span>}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                  {headDues.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-3 text-xs">
                        <button
                          type="button"
                          className="text-amber-600 hover:underline"
                          onClick={() =>
                            setHeadAllocs(
                              Object.fromEntries(headDues.map((h) => [h.feeHeadId, { checked: true, amount: String(h.due) }])),
                            )
                          }
                        >
                          Pay All Heads
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:underline"
                          onClick={() => setHeadAllocs({})}
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-sm">
                        Total to pay: <strong className="text-gray-900">BDT {formatBDT(allocTotal)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Previous due ({formatBDT(collectTarget.previousDue)}) belongs to earlier months — select that month in the
                filter and collect it from its own row.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Payment Method"
                value={collectForm.paymentMethod}
                onChange={(v) => setCollectForm({ ...collectForm, paymentMethod: v })}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank' },
                  { value: 'mfs', label: 'Mobile Financial Service' },
                  { value: 'card', label: 'Card' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              {collectForm.paymentMethod !== 'cash' && (
                <>
                  <Input label="Transaction / Reference" value={collectForm.transactionRef} onChange={(e) => setCollectForm({ ...collectForm, transactionRef: e.target.value })} />
                  <Input label="Bank / MFS Name" value={collectForm.bankName} onChange={(e) => setCollectForm({ ...collectForm, bankName: e.target.value })} />
                </>
              )}
              <Input label="Payment Date" type="date" value={collectForm.paymentDate} onChange={(e) => setCollectForm({ ...collectForm, paymentDate: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCollectTarget(null)}>Cancel</Button>
              <Button onClick={handleCollect} disabled={collecting}>
                <HandCoins size={14} className="mr-1" /> {collecting ? 'Processing…' : 'Collect Payment'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Receipt modal */}
      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Payment Receipt" size="md">
        {receipt && (
          <div id="receipt-print" className="text-sm">
            <div className="mb-3 text-center">
              <p className="text-lg font-bold text-gray-900">{receipt.receipt.student.school?.name ?? 'School'}</p>
              <p className="text-xs text-gray-500">Money Receipt</p>
            </div>
            <dl className="space-y-1.5 border-y py-3">
              {[
                ['Receipt No', receipt.receipt.receiptNumber],
                ['Payment Date', new Date(receipt.payment.paymentDate).toLocaleDateString()],
                ['Student', `${receipt.receipt.student.name} (${receipt.receipt.student.admissionNumber})`],
                ['Class', `${receipt.receipt.student.schoolClass?.name ?? '-'} · Section ${receipt.receipt.student.section?.name ?? '-'}`],
                ['Fee Month', monthName(receipt.fee.month)],
                ['Base Fee', `BDT ${formatBDT(receipt.fee.baseAmount)}`],
                ['Discount', `BDT ${formatBDT(receipt.fee.discountAmount)}`],
                ['Payable', `BDT ${formatBDT(receipt.fee.payableAmount)}`],
                ['Amount Paid', `BDT ${formatBDT(receipt.payment.amount)}`],
                ...(receipt.payment.allocations ?? []).map(
                  (a) => [`Paid — ${a.feeHeadName}`, `BDT ${formatBDT(a.amount)}`] as [string, string],
                ),
                ['Remaining Due', `BDT ${formatBDT(Math.max(0, parseFloat(receipt.fee.payableAmount) - parseFloat(receipt.fee.paidAmount)))}`],
                ['Payment Method', receipt.payment.paymentMethod.toUpperCase()],
                ...(receipt.payment.transactionRef ? [['Reference', receipt.payment.transactionRef]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1 text-green-700">
              <BadgeCheck size={16} /> Payment recorded successfully
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" /> Print
              </Button>
              <Button onClick={() => setReceipt(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
