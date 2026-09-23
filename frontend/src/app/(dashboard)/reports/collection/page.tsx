'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
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

interface CollectionSummary {
  baseAmount: number;
  discountAmount: number;
  payableAmount: number;
  collected: number;
  outstanding: number;
  studentCount: number;
}

export default function CollectionReportPage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [month, setMonth] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';

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
    const params = new URLSearchParams({ schoolId: activeSchoolId, academicYearId: activeYearId });
    if (month) params.set('month', month);
    if (classId) params.set('classId', classId);
    if (sectionId) params.set('sectionId', sectionId);
    api
      .get(`/finance-reports/collection?${params.toString()}`)
      .then(({ data }) => {
        setSummary(data);
        setLoading(false);
      })
      .catch(() => {
        setSummary(null);
        setLoading(false);
      });
  }, [activeSchoolId, activeYearId, month, classId, sectionId]);

  return (
    <>
      <Header title="Collection Report" subtitle="Generated vs collected fees with filters" />
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
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : !summary ? (
          <div className="py-16 text-center text-gray-400">
            <BarChart3 size={48} className="mx-auto mb-3" />
            <p>No data</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              { label: 'Total Base Fee', value: summary.baseAmount, color: 'text-blue-700 bg-gradient-to-br from-blue-50 to-blue-100/60' },
              { label: 'Total Discount', value: summary.discountAmount, color: 'text-purple-700 bg-gradient-to-br from-purple-50 to-purple-100/60' },
              { label: 'Total Payable', value: summary.payableAmount, color: 'text-indigo-700 bg-gradient-to-br from-indigo-50 to-indigo-100/60' },
              { label: 'Total Collection', value: summary.collected, color: 'text-green-700 bg-gradient-to-br from-green-50 to-green-100/60' },
              { label: 'Total Outstanding', value: summary.outstanding, color: 'text-red-700 bg-gradient-to-br from-red-50 to-red-100/60' },
            ].map((c, i) => (
              <div
                key={c.label}
                className={`rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1 ${c.color}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <p className="text-xs font-medium uppercase tracking-wide">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">BDT {formatBDT(c.value)}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-5 text-gray-700 transition-transform duration-300 hover:-translate-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Students covered</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{summary.studentCount}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
