'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileText, Search } from 'lucide-react';
import api from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  monthName,
  formatBDT,
  feeStatusBadge,
} from '@/components/fee/filters';

interface LedgerRow {
  id: string;
  academicYear?: string;
  month: number;
  baseAmount: number;
  discountAmount: number;
  payableAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  breakdown: { feeHeadId: string; feeHeadName: string; base: number; discount: number; payable: number }[];
}

interface StudentHit {
  id: string;
  name: string;
  admissionNumber: string;
}

export default function StudentLedgerPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId && schools.length > 0) setSchoolId(schools[0].id);
  }, [schools, schoolId]);
  useEffect(() => {
    if (!academicYearId && years.length > 0) {
      const active = years.find((y) => y.status === 'active');
      setAcademicYearId((active ?? years[0]).id);
    }
  }, [years, academicYearId]);

  useEffect(() => {
    if (!schoolId || search.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get(`/students?schoolId=${schoolId}&search=${encodeURIComponent(search.trim())}&limit=5`)
        .then(({ data }) => setHits(data.items ?? []))
        .catch(() => setHits([]));
    }, 400);
    return () => clearTimeout(t);
  }, [search, schoolId]);

  const selectStudent = async (s: StudentHit) => {
    setStudent(s);
    setHits([]);
    setSearch(s.name);
    setLoading(true);
    try {
      const { data } = await api.get(`/finance-reports/students/${s.id}/ledger`);
      setLedger(data);
    } catch {
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="Student Fee Ledger" subtitle="Complete month-wise fee history of a student" />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <Select label="School" value={schoolId} onChange={(v) => { setSchoolId(v); setStudent(null); setLedger([]); setSearch(''); }} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Academic Year" value={academicYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <Input
                  className="pl-9"
                  label="Find Student"
                  placeholder="Search by name / ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {hits.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => selectStudent(h)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium">{h.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{h.admissionNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!student ? (
          <div className="py-16 text-center text-gray-400">
            <FileText size={48} className="mx-auto mb-3" />
            <p>Search and select a student to view the ledger</p>
          </div>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-3">
                <p className="font-semibold text-gray-900">{student.name}</p>
                <p className="text-xs text-gray-500">{student.admissionNumber}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="modern-table">
                  <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Base</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Payable</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledger.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No fee records</td></tr>
                    ) : (
                      ledger.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{r.academicYear ?? '-'}</td>
                          <td className="px-4 py-3">{monthName(r.month)}</td>
                          <td className="px-4 py-3">{formatBDT(r.baseAmount)}</td>
                          <td className="px-4 py-3">{formatBDT(r.discountAmount)}</td>
                          <td className="px-4 py-3">{formatBDT(r.payableAmount)}</td>
                          <td className="px-4 py-3">{formatBDT(r.paidAmount)}</td>
                          <td className={`px-4 py-3 ${r.dueAmount > 0 ? 'font-semibold text-red-600' : ''}`}>{formatBDT(r.dueAmount)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${feeStatusBadge(r.status)}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
