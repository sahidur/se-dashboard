'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, User } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select, useAcademicYears, monthName, formatBDT, feeStatusBadge } from '@/components/fee/filters';

interface StudentDetail {
  id: string;
  admissionNumber: string;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  address: string | null;
  status: string;
  rollNumber: number | null;
  admissionDate: string | null;
  school: { id: string; name: string } | null;
  schoolClass: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  academicYear: { id: string; name: string } | null;
}

interface FeeSummary {
  baseAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  dueAmount: number;
  months: {
    id: string;
    month: number;
    baseAmount: number;
    discountAmount: number;
    payableAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
  }[];
}

interface DiscountRow {
  id: string;
  feeHead: { id: string; name: string } | null;
  type: string;
  value: string;
  isRecurring: boolean;
  effectiveFromMonth: number | null;
  effectiveToMonth: number | null;
  reason: string | null;
  isActive: boolean;
  academicYear: { id: string; name: string } | null;
}

const emptyDiscount = {
  academicYearId: '',
  feeHeadId: '',
  type: 'percentage',
  value: '',
  isRecurring: 'true',
  effectiveFromMonth: '',
  effectiveToMonth: '',
  reason: '',
};

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data: years = [] } = useAcademicYears();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [feeHeads, setFeeHeads] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyDiscount });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, sum, d, heads] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/fee-collection/students/${id}/fee-summary`).catch(() => ({ data: null })),
        api.get(`/student-discounts/student/${id}`).catch(() => ({ data: [] })),
        api.get('/fee-heads').catch(() => ({ data: [] })),
      ]);
      setStudent(s.data);
      setSummary(sum.data);
      setDiscounts(d.data);
      setFeeHeads(heads.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyDiscount,
      academicYearId: student?.academicYear?.id ?? years[0]?.id ?? '',
    });
    setShowModal(true);
  };

  const openEdit = (d: DiscountRow) => {
    setEditingId(d.id);
    setForm({
      academicYearId: d.academicYear?.id ?? '',
      feeHeadId: d.feeHead?.id ?? '',
      type: d.type,
      value: String(parseFloat(d.value)),
      isRecurring: d.isRecurring ? 'true' : 'false',
      effectiveFromMonth: d.effectiveFromMonth ? String(d.effectiveFromMonth) : '',
      effectiveToMonth: d.effectiveToMonth ? String(d.effectiveToMonth) : '',
      reason: d.reason ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.value || parseFloat(form.value) <= 0) {
      alert('Enter a valid discount value');
      return;
    }
    if (!form.academicYearId) {
      alert('Select an academic year');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        academicYearId: form.academicYearId,
        feeHeadId: form.feeHeadId || undefined,
        type: form.type,
        value: parseFloat(form.value),
        isRecurring: form.isRecurring === 'true',
        reason: form.reason || undefined,
      };
      if (form.isRecurring === 'false') {
        if (form.effectiveFromMonth) payload.effectiveFromMonth = parseInt(form.effectiveFromMonth, 10);
        if (form.effectiveToMonth) payload.effectiveToMonth = parseInt(form.effectiveToMonth, 10);
      }
      if (editingId) {
        await api.patch(`/student-discounts/${editingId}`, payload);
      } else {
        await api.post('/student-discounts', { ...payload, studentId: id });
      }
      setShowModal(false);
      load();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save discount'));
    } finally {
      setSaving(false);
    }
  };

  const removeDiscount = async (d: DiscountRow) => {
    if (!confirm('Remove this discount?')) return;
    try {
      await api.delete(`/student-discounts/${d.id}`);
      load();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to remove discount'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!student) {
    return (
      <>
        <Header title="Student Profile" />
        <div className="page-container">
          <p className="py-16 text-center text-gray-400">Student not found</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={student.name}
        subtitle={`${student.admissionNumber} — ${student.school?.name ?? ''}`}
        actions={
          <Button size="sm" variant="outline" onClick={() => router.push('/students')}>
            Back to list
          </Button>
        }
      />
      <div className="page-container space-y-4">
        {/* Basic + academic info */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <User size={16} /> Basic Information
              </h3>
              <dl className="space-y-2 text-sm">
                {[
                  ['Student ID', student.admissionNumber],
                  ['Name', student.name],
                  ['Date of Birth', student.dateOfBirth?.slice(0, 10) ?? '-'],
                  ['Gender', student.gender ?? '-'],
                  ['Guardian', student.guardianName ?? '-'],
                  ['Phone', student.guardianPhone ?? '-'],
                  ['Address', student.address ?? '-'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-right font-medium text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Academic Information</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ['Academic Year', student.academicYear?.name ?? '-'],
                  ['Class', student.schoolClass?.name ?? '-'],
                  ['Section', student.section?.name ?? '-'],
                  ['Roll Number', student.rollNumber ?? '-'],
                  ['Admission Date', student.admissionDate?.slice(0, 10) ?? '-'],
                  ['Status', student.status],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-right font-medium capitalize text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Fee summary */}
        {summary && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Fee Summary</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Base Fee', summary.baseAmount],
                  ['Total Discount', summary.discountAmount],
                  ['Total Payable', summary.payableAmount],
                  ['Total Paid', summary.paidAmount],
                  ['Total Due', summary.dueAmount],
                ].map(([label, value], i) => (
                  <div key={label as string} className={`rounded-lg p-3 ${i === 4 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-lg font-bold ${i === 4 ? 'text-red-700' : 'text-gray-900'}`}>
                      BDT {formatBDT(value as number)}
                    </p>
                  </div>
                ))}
              </div>

              {summary.months.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="modern-table">
                    <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Month</th>
                        <th className="px-3 py-2">Base Fee</th>
                        <th className="px-3 py-2">Discount</th>
                        <th className="px-3 py-2">Payable</th>
                        <th className="px-3 py-2">Paid</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary.months.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">{monthName(m.month)}</td>
                          <td className="px-3 py-2">{formatBDT(m.baseAmount)}</td>
                          <td className="px-3 py-2">{formatBDT(m.discountAmount)}</td>
                          <td className="px-3 py-2">{formatBDT(m.payableAmount)}</td>
                          <td className="px-3 py-2">{formatBDT(m.paidAmount)}</td>
                          <td className="px-3 py-2">{formatBDT(m.dueAmount)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${feeStatusBadge(m.status)}`}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Discounts */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Student Discounts</h3>
              <Button size="sm" onClick={openCreate}>
                <Plus size={14} className="mr-1" /> Add Discount
              </Button>
            </div>
            {discounts.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No discounts assigned</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="modern-table">
                  <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Year</th>
                      <th className="px-3 py-2">Scope</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {discounts.map((d) => (
                      <tr key={d.id} className={d.isActive ? '' : 'opacity-50'}>
                        <td className="px-3 py-2">{d.academicYear?.name ?? '-'}</td>
                        <td className="px-3 py-2">{d.feeHead?.name ?? 'Total eligible fee'}</td>
                        <td className="px-3 py-2 capitalize">{d.type}</td>
                        <td className="px-3 py-2">{d.type === 'percentage' ? `${parseFloat(d.value)}%` : formatBDT(d.value)}</td>
                        <td className="px-3 py-2">
                          {d.isRecurring
                            ? 'Recurring (every month)'
                            : `${d.effectiveFromMonth ?? 1}–${d.effectiveToMonth ?? 12}`}
                        </td>
                        <td className="px-3 py-2">{d.reason ?? '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(d)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => removeDiscount(d)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Discount modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Discount' : 'Add Discount'}>
        <div className="space-y-3">
          <Select
            label="Academic Year *"
            value={form.academicYearId}
            onChange={(v) => setForm({ ...form, academicYearId: v })}
            placeholder="Select year"
            options={years.map((y) => ({ value: y.id, label: y.name }))}
          />
          <Select
            label="Scope"
            value={form.feeHeadId}
            onChange={(v) => setForm({ ...form, feeHeadId: v })}
            placeholder="Total eligible fee"
            options={feeHeads.map((h) => ({ value: h.id, label: h.name }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Discount Type"
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={[
                { value: 'percentage', label: 'Percentage (%)' },
                { value: 'fixed', label: 'Fixed Amount (BDT)' },
              ]}
            />
            <Input
              label={form.type === 'percentage' ? 'Discount (%)' : 'Discount (BDT)'}
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <Select
            label="Apply"
            value={form.isRecurring}
            onChange={(v) => setForm({ ...form, isRecurring: v })}
            options={[
              { value: 'true', label: 'Recurring (every month)' },
              { value: 'false', label: 'One-time (month range)' },
            ]}
          />
          {form.isRecurring === 'false' && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="From Month"
                value={form.effectiveFromMonth}
                onChange={(v) => setForm({ ...form, effectiveFromMonth: v })}
                placeholder="January (default)"
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
              />
              <Select
                label="To Month"
                value={form.effectiveToMonth}
                onChange={(v) => setForm({ ...form, effectiveToMonth: v })}
                placeholder="December (default)"
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
              />
            </div>
          )}
          <Input label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Discount'}</Button>
        </div>
      </Modal>
    </>
  );
}
