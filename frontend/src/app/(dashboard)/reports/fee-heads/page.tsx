'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Tag } from 'lucide-react';
import api from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  MonthSelect,
  formatBDT,
} from '@/components/fee/filters';

interface HeadReportRow {
  name: string;
  base: number;
  discount: number;
  payable: number;
  collected: number;
  due: number;
}

export default function FeeHeadReportPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [month, setMonth] = useState('');
  const [rows, setRows] = useState<HeadReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

  useEffect(() => {
    if (!activeSchoolId || !activeYearId) return;
    const params = new URLSearchParams({ schoolId: activeSchoolId, academicYearId: activeYearId });
    if (month) params.set('month', month);
    api
      .get(`/finance-reports/fee-heads?${params.toString()}`)
      .then(({ data }) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        setRows([]);
        setLoading(false);
      });
  }, [activeSchoolId, activeYearId, month]);

  return (
    <>
      <Header title="Fee Head Report" subtitle="Generated vs collected per fee type" />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Academic Year" value={activeYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            <MonthSelect value={month} onChange={setMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Fee Head</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Payable</th>
                    <th className="px-4 py-3">Collected</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <Tag size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-400">No data — generate fees first</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3">{formatBDT(r.base)}</td>
                        <td className="px-4 py-3">{formatBDT(r.discount)}</td>
                        <td className="px-4 py-3">{formatBDT(r.payable)}</td>
                        <td className="px-4 py-3 text-green-700">{formatBDT(r.collected)}</td>
                        <td className="px-4 py-3 font-semibold text-red-600">{formatBDT(r.due)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <p className="mt-2 text-xs text-gray-500">
          Collected amounts are allocated across fee heads proportionally, because payments are recorded per month.
        </p>
      </div>
    </>
  );
}
