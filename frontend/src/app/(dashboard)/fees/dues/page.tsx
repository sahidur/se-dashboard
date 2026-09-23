'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { AlertTriangle } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  MonthSelect,
  formatBDT,
  monthName,
} from '@/components/fee/filters';

interface DueRow {
  studentId: string;
  admissionNumber: string;
  name: string;
  className: string;
  sectionName: string;
  payable: number;
  paid: number;
  due: number;
  months: { month: number; due: number; status: string }[];
}

interface HeadDue {
  feeHeadId: string;
  feeHeadName: string;
  payable: number;
  paid: number;
  due: number;
}

interface DuesByHeadMonth {
  id: string;
  month: number;
  heads: HeadDue[];
  payable: number;
  paid: number;
  due: number;
  status: string;
}

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

export default function DuesPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [month, setMonth] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [rows, setRows] = useState<DueRow[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);

  const [detailTarget, setDetailTarget] = useState<DueRow | null>(null);
  const [detailMonths, setDetailMonths] = useState<DuesByHeadMonth[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

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

  useEffect(() => {
    if (!activeSchoolId || !activeYearId) return;
    api
      .get(
        `/finance-reports/dues?schoolId=${activeSchoolId}&academicYearId=${activeYearId}` +
          (classId ? `&classId=${classId}` : '') +
          (sectionId ? `&sectionId=${sectionId}` : ''),
      )
      .then(({ data }) => {
        setRows(data.rows ?? []);
        setTotalDue(data.totalDue ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setRows([]);
        setLoading(false);
      });
  }, [activeSchoolId, activeYearId, classId, sectionId]);

  const openDetail = async (row: DueRow) => {
    setDetailTarget(row);
    setDetailMonths([]);
    setDetailError('');
    setDetailLoading(true);
    try {
      const { data } = await api.get(
        `/fee-collection/students/${row.studentId}/dues-by-head?academicYearId=${activeYearId}`,
      );
      setDetailMonths(data.months ?? []);
    } catch (error) {
      setDetailMonths([]);
      setDetailError(getErrorMessage(error, 'Failed to load head-wise dues'));
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleRows = month ? rows.filter((r) => r.months.some((m) => m.month === parseInt(month, 10))) : rows;

  return (
    <>
      <Header title="Dues" subtitle="Outstanding fees — the origin month of each due is preserved" />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Academic Year" value={activeYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            <Select
              label="Class"
              value={classId}
              onChange={(v) => {
                setClassId(v);
                setSectionId('');
              }}
              placeholder="All classes"
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Section"
              value={sectionId}
              onChange={setSectionId}
              placeholder="All sections"
              options={(classes.find((c) => c.id === classId)?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
            <MonthSelect value={month} onChange={setMonth} />
          </CardContent>
        </Card>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 shadow-sm ring-1 ring-red-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-red-500">Total outstanding</p>
              <p className="text-xl font-bold tracking-tight text-red-700 sm:text-2xl">BDT {formatBDT(totalDue)}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-red-600 ring-1 ring-red-100">
            {visibleRows.length} student(s) with dues
          </span>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Payable</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Due Months</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <AlertTriangle size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-400">No dues — all clear</p>
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((r) => (
                      <tr
                        key={r.studentId}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => openDetail(r)}
                        title="Click to see head-wise dues"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/students/${r.studentId}`}
                            className="font-medium text-brand-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.name}
                          </Link>
                          <p className="text-xs text-gray-400">{r.admissionNumber}</p>
                        </td>
                        <td className="px-4 py-3">{r.className}</td>
                        <td className="px-4 py-3">{r.sectionName || '-'}</td>
                        <td className="px-4 py-3">{formatBDT(r.payable)}</td>
                        <td className="px-4 py-3">{formatBDT(r.paid)}</td>
                        <td className="px-4 py-3 font-semibold text-red-600">{formatBDT(r.due)}</td>
                        <td className="px-4 py-3 text-xs">
                          {r.months
                            .slice()
                            .sort((a, b) => a.month - b.month)
                            .map((m) => `${monthName(m.month)}: ${formatBDT(m.due)}`)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Head-wise dues detail modal */}
      <Modal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={`Head-wise dues — ${detailTarget?.name ?? ''}`}
        size="lg"
      >
        {detailTarget && (
          <div>
            <p className="mb-3 text-sm text-gray-500">
              {detailTarget.admissionNumber} · {detailTarget.className}
              {detailTarget.sectionName ? ` · Section ${detailTarget.sectionName}` : ''} — all fee heads with an
              outstanding balance, month by month.
            </p>
            {detailLoading ? (
              <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
            ) : detailError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{detailError}</p>
            ) : detailMonths.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No dues found</p>
            ) : (
              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {detailMonths.map((m) => (
                  <div key={m.id} className="rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-gray-800">{monthName(m.month)}</span>
                      <span className="text-red-600">
                        Due: <strong>BDT {formatBDT(m.due)}</strong>
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="text-left text-gray-500">
                        <tr>
                          <th className="px-3 py-1.5">Fee Head</th>
                          <th className="px-3 py-1.5">Payable</th>
                          <th className="px-3 py-1.5">Paid</th>
                          <th className="px-3 py-1.5">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {m.heads.map((h) => (
                          <tr key={h.feeHeadId}>
                            <td className="px-3 py-1.5">{h.feeHeadName}</td>
                            <td className="px-3 py-1.5">{formatBDT(h.payable)}</td>
                            <td className="px-3 py-1.5">{formatBDT(h.paid)}</td>
                            <td className="px-3 py-1.5 font-medium text-red-600">{formatBDT(h.due)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div className="flex justify-end gap-6 border-t pt-3 text-sm font-semibold">
                  <span className="text-gray-500">Payable: {formatBDT(detailMonths.reduce((s, m) => s + m.payable, 0))}</span>
                  <span className="text-gray-500">Paid: {formatBDT(detailMonths.reduce((s, m) => s + m.paid, 0))}</span>
                  <span className="text-red-600">Due: {formatBDT(detailMonths.reduce((s, m) => s + m.due, 0))}</span>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDetailTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
