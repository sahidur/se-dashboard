'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  ChevronRight,
  TableProperties,
  X,
  RefreshCw,
  Users,
  TrendingDown,
  TrendingUp,
  Activity,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcDashboard, DcStudentsInfo } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GRADE_LABELS: Record<string, string> = {
  play_learn: 'Play & Learn',
  nursery: 'Nursery',
  g1: 'Grade 1',
  g2: 'Grade 2',
  g3: 'Grade 3',
  g4: 'Grade 4',
  g5: 'Grade 5',
  g6: 'Grade 6',
  g7: 'Grade 7',
  g8: 'Grade 8',
  g9: 'Grade 9',
  g10: 'Grade 10',
};

const SUB_FORMS = [
  {
    key: 'students-information',
    slug: 'students-information',
    label: "Students' Information",
    description: 'Monthly enrollment, attendance, dropout and demographic data per grade',
    icon: GraduationCap,
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    trackKey: 'studentsInfo',
  },
];

export default function StudentsSubPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard]     = useState<DcDashboard | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showResponses, setShowResponses] = useState(false);
  const [responses, setResponses]     = useState<DcStudentsInfo[]>([]);
  const [loadingResp, setLoadingResp] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    api.get(`/data-collection/schools/${id}/dashboard`)
      .then(({ data }) => setDashboard(data))
      .catch(() => router.push('/data-collection/schools'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const loadResponses = useCallback(async () => {
    setLoadingResp(true);
    try {
      const { data } = await api.get<DcStudentsInfo[]>(
        `/data-collection/students/school/${id}`,
      );
      setResponses(data);
    } catch {
      setResponses([]);
    } finally {
      setLoadingResp(false);
    }
  }, [id]);

  const handleToggleResponses = () => {
    if (!showResponses) loadResponses();
    setShowResponses((p) => !p);
  };

  if (loading) {
    return (
      <>
        <Header title="Students Information" />
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      </>
    );
  }

  if (!dashboard) return null;

  const school = dashboard.school;
  const forms  = dashboard.forms;
  const count  = forms.studentsInfo?.count ?? 0;

  // Entries are keyed by academic year × month × grade, so completeness is
  // measured per academic year: 12 months × 12 grades.
  const ENTRIES_PER_YEAR = MONTHS.length * Object.keys(GRADE_LABELS).length;
  const years = [...new Set(responses.map((r) => Number(r.academicYear)))].sort((a, b) => b - a);
  const yearScoped = filterYear
    ? responses.filter((r) => Number(r.academicYear) === Number(filterYear))
    : responses;
  const allDone = years.length > 0 && years.every(
    (y) => responses.filter((r) => Number(r.academicYear) === y).length >= ENTRIES_PER_YEAR,
  );

  // Sort filtered by academic year (newest first), then chronological month
  const filtered = (filterMonth
    ? yearScoped.filter((r) => r.month === filterMonth)
    : [...yearScoped]
  ).sort((a, b) => {
    const yDiff = Number(b.academicYear) - Number(a.academicYear);
    if (yDiff !== 0) return yDiff;
    const mDiff = MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month);
    if (mDiff !== 0) return mDiff;
    const GRADE_ORDER = ['play_learn','nursery','g1','g2','g3','g4','g5','g6','g7','g8','g9','g10'];
    return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
  });

  // Group by month for the table (chronological)
  const monthsPresent = [...new Set(yearScoped.map((r) => r.month))].sort(
    (a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b),
  );

  // Format timestamp as "Jun 3, 2026 09:30 AM"
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // Alternating light background per month group
  const uniqueMonthsSorted = [...new Set(filtered.map((r) => r.month))].sort(
    (a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b),
  );
  const monthBgMap: Record<string, string> = {};
  uniqueMonthsSorted.forEach((m, i) => {
    monthBgMap[m] = i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40';
  });

  return (
    <>
      <Header
        title="Students Information"
        subtitle={school.name}
        actions={
          <Button variant="outline" onClick={() => router.push(`/data-collection/schools/${id}`)}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Summary Card ── */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Students Information</h2>
                  <p className="text-sm text-gray-500">
                    {school.name} &bull; <span className="font-mono text-xs text-gray-400">{school.code}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                  <p className={`text-2xl font-bold ${count > 0 ? 'text-violet-600' : 'text-gray-400'}`}>{count}</p>
                  <p className="text-xs text-gray-500">
                    {years.length > 1 ? `entries across ${years.length} years` : `of ${ENTRIES_PER_YEAR} entries`}
                  </p>
                </div>
                {allDone ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 size={24} className="text-green-600" />
                  </div>
                ) : (
                  <div className="h-10 w-10">
                    <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7c3aed" strokeWidth="3"
                        strokeDasharray={`${Math.min(100, (count / (ENTRIES_PER_YEAR * Math.max(years.length, 1))) * 100)} 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Form Card ── */}
        <div className="grid gap-4">
          {SUB_FORMS.map((sf) => {
            const submitted = forms.studentsInfo?.submitted ?? false;
            const Icon = sf.icon;
            return (
              <div key={sf.key} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                {/* Form link card */}
                <Link href={`/data-collection/forms/${sf.slug}?school=${id}`} className="group flex-1 block">
                  <Card className={`relative h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${submitted ? 'ring-2 ring-violet-200' : 'ring-1 ring-gray-100'}`}>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${sf.bg}`}>
                          <Icon size={22} className={sf.text} />
                        </div>
                        {submitted ? (
                          <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> {count} entries</Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">No entries yet</Badge>
                        )}
                      </div>
                      <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">{sf.label}</h3>
                      <p className="text-xs text-gray-400">{sf.description}</p>
                      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Add / Update Entries <ChevronRight size={14} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Responses button */}
                <button
                  type="button"
                  onClick={handleToggleResponses}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 font-semibold text-sm transition-all duration-200 sm:min-w-[160px] ${
                    showResponses
                      ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-600'
                  }`}
                >
                  {showResponses ? (
                    <><X size={16} /> Hide Responses</>
                  ) : (
                    <><TableProperties size={16} /> View Responses</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Responses Table ── */}
        {showResponses && (
          <Card className="overflow-hidden border-0 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <TableProperties size={18} className="shrink-0 text-violet-600" />
                <h3 className="font-semibold text-gray-800">Submitted Responses</h3>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{responses.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Academic year filter */}
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="">All Years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {/* Month filter */}
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="">All Months</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadResponses}
                  disabled={loadingResp}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw size={13} className={loadingResp ? 'animate-spin' : ''} />
                  Refresh
                </Button>
              </div>
            </div>

            {loadingResp ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Users size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No entries found{filterMonth ? ` for ${filterMonth}` : ''}.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70">
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Year</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Month</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Grade</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Boys</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Girls</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">PwD</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Ethnic</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span className="flex items-center justify-end gap-1"><TrendingUp size={12} /> Attend.</span>
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span className="flex items-center justify-end gap-1"><TrendingDown size={12} /> Dropout</span>
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Replaced</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Retention</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span className="flex items-center justify-end gap-1"><Activity size={12} /> Remedial</span>
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted By</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((r) => (
                      <tr key={r.id} className={`transition-colors hover:brightness-95 ${monthBgMap[r.month] ?? 'bg-white'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.academicYear}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">{r.month}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {GRADE_LABELS[r.grade] ?? r.grade}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{r.boys}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-pink-600">{r.girls}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-700 text-sm">{r.total}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.personsWithDisability}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.ethnic}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${Number(r.attendanceRate) >= 80 ? 'text-emerald-600' : Number(r.attendanceRate) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {Number(r.attendanceRate).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${Number(r.dropoutRate) <= 5 ? 'text-emerald-600' : Number(r.dropoutRate) <= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                            {Number(r.dropoutRate).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(r.replacedStudentsRate ?? 0).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(r.retentionRate ?? 0).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.remedialSupport}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {r.createdBy
                            ? `${r.createdBy.firstName} ${r.createdBy.lastName}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {r.createdAt ? formatDateTime(r.createdAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals footer — only meaningful for a single year + month,
                      otherwise the same pupils would be summed once per month. */}
                  {filterMonth && filterYear && filtered.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-violet-200 bg-violet-50/50">
                        <td className="px-4 py-3 text-xs font-bold text-violet-700" colSpan={3}>
                          {filterYear} &bull; {filterMonth} Total
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700">
                          {filtered.reduce((s, r) => s + r.boys, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-pink-600">
                          {filtered.reduce((s, r) => s + r.girls, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-700">
                          {filtered.reduce((s, r) => s + r.total, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-600">
                          {filtered.reduce((s, r) => s + r.personsWithDisability, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-600">
                          {filtered.reduce((s, r) => s + r.ethnic, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {filtered.length > 0
                            ? (filtered.reduce((s, r) => s + Number(r.attendanceRate), 0) / filtered.length).toFixed(1)
                            : '0.0'}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600">
                          {filtered.length > 0
                            ? (filtered.reduce((s, r) => s + Number(r.dropoutRate), 0) / filtered.length).toFixed(1)
                            : '0.0'}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-600">
                          {filtered.length > 0
                            ? (filtered.reduce((s, r) => s + Number(r.replacedStudentsRate ?? 0), 0) / filtered.length).toFixed(1)
                            : '0.0'}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-600">
                          {filtered.length > 0
                            ? (filtered.reduce((s, r) => s + Number(r.retentionRate ?? 0), 0) / filtered.length).toFixed(1)
                            : '0.0'}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-600">
                          {filtered.reduce((s, r) => s + r.remedialSupport, 0)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
                </div>

                {/* Month chips legend when showing all */}
                {!filterMonth && monthsPresent.length > 1 && (
                  <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2">
                    {monthsPresent.map((m) => {
                      const mCount = yearScoped.filter((r) => r.month === m).length;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFilterMonth(m)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                        >
                          {m}
                          <span className="rounded-full bg-violet-200 px-1.5 py-0.5 text-[10px] font-bold">{mCount}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}



