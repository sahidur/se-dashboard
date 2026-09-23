'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import api from '@/lib/api';
import { Select,
  useSchools,
  useAcademicYears,
  MonthSelect,
  formatBDT,
} from '@/components/fee/filters';

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

interface ClassRowReport {
  classId: string;
  sectionId?: string;
  className?: string;
  key?: string;
  students: number;
  payable: number;
  collected: number;
  due: number;
}

export default function ClassWiseReportPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [month, setMonth] = useState('');
  const [mode, setMode] = useState<'class' | 'section'>('class');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [rows, setRows] = useState<ClassRowReport[]>([]);
  const [loading, setLoading] = useState(false);

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

  useEffect(() => {
    if (!activeSchoolId) return;
    api
      .get(`/students/classes?schoolId=${activeSchoolId}&activeOnly=true`)
      .then(({ data }) => setClasses(data))
      .catch(() => setClasses([]));
  }, [activeSchoolId]);

  useEffect(() => {
    if (!activeSchoolId || !activeYearId) return;
    const endpoint = mode === 'class' ? 'class-wise' : 'section-wise';
    const params = new URLSearchParams({ schoolId: activeSchoolId, academicYearId: activeYearId });
    if (month) params.set('month', month);
    api
      .get(`/finance-reports/${endpoint}?${params.toString()}`)
      .then(({ data }) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        setRows([]);
        setLoading(false);
      });
  }, [activeSchoolId, activeYearId, month, mode]);

  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <Header title="Class/Section-wise Collection" subtitle="Payable, collected and due grouped by class or section" />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <Select label="School" value={activeSchoolId} onChange={setSchoolId} placeholder="Select school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Academic Year" value={activeYearId} onChange={setAcademicYearId} placeholder="Select year" options={years.map((y) => ({ value: y.id, label: y.name }))} />
            <MonthSelect value={month} onChange={setMonth} />
            <div className="flex items-end">
              <div className="flex w-full rounded-lg border border-gray-300 p-1">
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'class' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
                  onClick={() => setMode('class')}
                >
                  By Class
                </button>
                <button
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'section' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
                  onClick={() => setMode('section')}
                >
                  By Section
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">{mode === 'class' ? 'Class' : 'Class'}</th>
                    {mode === 'section' && <th className="px-4 py-3">Section</th>}
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Payable</th>
                    <th className="px-4 py-3">Collected</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={mode === 'class' ? 5 : 6} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={mode === 'class' ? 5 : 6} className="px-4 py-16 text-center">
                        <BookOpen size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-400">No data — generate fees first</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.key ?? r.classId ?? i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {mode === 'class' ? r.className ?? r.classId : classNameOf(r.classId)}
                        </td>
                        {mode === 'section' && (
                          <td className="px-4 py-3">
                            {(classes.find((c) => c.id === r.classId)?.sections ?? []).find((s) => s.id === r.sectionId)?.name ?? '-'}
                          </td>
                        )}
                        <td className="px-4 py-3">{r.students}</td>
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
      </div>
    </>
  );
}
