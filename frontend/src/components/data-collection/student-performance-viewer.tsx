'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarRange, Download, FileSpreadsheet, ListChecks, RotateCcw, Search, Users,
} from 'lucide-react';
import api from '@/lib/api';
import {
  EVALUATION_PERIODS,
  getSection,
  getStudentPerformanceForm,
  getStudentPerformanceRows,
  getGradeDisplayName,
  type StudentPerformanceFormKey,
} from './student-performance-catalog';
import type { DcStudentPerformance } from '@/types';

/* ─── Export helpers ────────────────────────────────────── */

function triggerDownload(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSV formula-injection defence: spreadsheet apps execute cells starting
// with = + - @ or tab/CR as formulas (=WEBSERVICE(...) can exfiltrate data).
// Prefix them so they are treated as text; genuine negative numbers pass.
const sanitizeCsvCell = (v: string): string => {
  if (/^[-=+@\t\r]/.test(v) && !/^-\d+(\.\d+)?$/.test(v)) return `'${v}`;
  return v;
};
const escapeCsv = (v: string) => {
  const safe = sanitizeCsvCell(v);
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ─── Component ─────────────────────────────────────────── */

interface Props {
  schoolId: string;
  formKey: StudentPerformanceFormKey;
  /** Filename stem for the CSV/Excel exports. */
  fileBase: string;
  /** School category for dynamic label display (e.g., 'brac_academy' shows "Play World" instead of "Play & Learn"). */
  schoolCategory?: string | null;
}

/**
 * Read-only view of submitted Student Performance (BA/BPS/BSS) records.
 *
 * The generic form-data viewer flattens the jsonb `rows` into one very wide
 * row per record, which is unreadable for these matrix forms — this renders
 * each submission the same way the entry form does (indicator/subject rows ×
 * scale columns), with academic year / grade / period filters and CSV/Excel
 * export of either the filtered set or every record.
 */
export function StudentPerformanceViewer({ schoolId, formKey, fileBase, schoolCategory }: Props) {
  const def = getStudentPerformanceForm(formKey)!;
  const section = getSection(def.sectionKey)!;
  const rowDefs = useMemo(() => getStudentPerformanceRows(formKey), [formKey]);

  const {
    data: records = [],
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['student-performance-view', schoolId, formKey],
    queryFn: () =>
      api
        .get(`/data-collection/student-performance/school/${schoolId}`, { params: { formKey } })
        .then(({ data }) => (Array.isArray(data) ? data : []) as DcStudentPerformance[]),
  });

  const [year, setYear] = useState('');
  const [grade, setGrade] = useState('');
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');

  const years = useMemo(
    () => [...new Set(records.map((r) => r.academicYear))].sort((a, b) => b - a),
    [records],
  );
  const grades = useMemo(() => {
    const present = new Set(records.map((r) => r.grade));
    const ordered = def.grades.filter((g) => present.has(g));
    const extra = [...present].filter((g) => !def.grades.includes(g)).sort();
    return [...ordered, ...extra];
  }, [records, def.grades]);
  const periods = useMemo(() => {
    const present = new Set(records.map((r) => r.evaluationPeriod));
    const ordered = EVALUATION_PERIODS.filter((p) => present.has(p));
    const extra = [...present].filter((p) => !EVALUATION_PERIODS.includes(p)).sort();
    return [...ordered, ...extra];
  }, [records]);

  const gradeIndex = (g: string) => {
    const i = def.grades.indexOf(g);
    return i === -1 ? 99 : i;
  };

  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          b.academicYear - a.academicYear
          || gradeIndex(a.grade) - gradeIndex(b.grade)
          || a.evaluationPeriod.localeCompare(b.evaluationPeriod),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, def.grades],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((r) => {
      if (year && String(r.academicYear) !== year) return false;
      if (grade && r.grade !== grade) return false;
      if (period && r.evaluationPeriod !== period) return false;
      if (q && ![String(r.academicYear), r.grade, r.evaluationPeriod].some((v) => v.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [sorted, year, grade, period, search]);

  const hasFilters = !!(year || grade || period || search.trim());
  const exportRecords = scope === 'all' || !hasFilters ? sorted : filtered;

  const resetFilters = () => {
    setYear('');
    setGrade('');
    setPeriod('');
    setSearch('');
  };

  /* ── Export ── */

  const exportHeaders = [
    'Academic Year', 'Grade', def.periodLabel, 'Number of Students', def.appearedLabel,
    ...(def.grouped ? ['Domain'] : []),
    def.rowHeader,
    ...def.scale.map((s) => s.label),
    'Total',
  ];

  const exportRows = (): string[][] =>
    exportRecords.flatMap((rec) => {
      const byCode = new Map((rec.rows ?? []).map((r) => [r.code, r]));
      return rowDefs.map((r) => {
        const values = byCode.get(r.code)?.values ?? {};
        const cells = def.scale.map((s) => Number(values[s.label]) || 0);
        const total = cells.reduce((sum, v) => sum + v, 0);
        return [
          String(rec.academicYear),
          rec.grade,
          rec.evaluationPeriod,
          String(rec.numberOfStudents ?? 0),
          rec.appearedPercent != null ? String(rec.appearedPercent) : '',
          ...(def.grouped ? [r.domain ?? ''] : []),
          r.label,
          ...cells.map((v) => String(round2(v))),
          String(round2(total)),
        ];
      });
    });

  const exportCsv = () => {
    const lines = [exportHeaders.map(escapeCsv).join(',')];
    exportRows().forEach((cells) => lines.push(cells.map(escapeCsv).join(',')));
    triggerDownload('\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8;', `${fileBase}-${scope}.csv`);
  };

  const exportExcel = () => {
    const head = exportHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const body = exportRows()
      .map((cells) => `<tr>${cells.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
      .join('');
    const html =
      `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>`
      + `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    triggerDownload(html, 'application/vnd.ms-excel;charset=utf-8;', `${fileBase}-${scope}.xls`);
  };

  /* ── Render ── */

  const selectClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 sm:w-auto';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <FileSpreadsheet size={24} className="text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-500">Failed to load submitted data for this form.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
            <ListChecks size={24} className="text-gray-300" />
          </div>
          <p className="font-medium text-gray-500">No data found</p>
          <p className="text-sm text-gray-400">No records have been submitted for this form yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Filters + export ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Academic Year</label>
              <div className="relative">
                <CalendarRange size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={year} onChange={(e) => setYear(e.target.value)} className={`${selectClass} pl-8`}>
                  <option value="">All years</option>
                  {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Grade</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectClass}>
                <option value="">All grades</option>
                {grades.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, schoolCategory)}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{def.periodLabel}</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectClass}>
                <option value="">All periods</option>
                {periods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Year, grade or period…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 sm:w-56"
                />
              </div>
            </div>

            {hasFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
                <RotateCcw size={14} /> Reset
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of {records.length} submitted
              {records.length === 1 ? ' record' : ' records'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'filtered' | 'all')}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="filtered">Filtered data ({filtered.length})</option>
                <option value="all">All data ({records.length})</option>
              </select>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!exportRecords.length} className="gap-1.5">
                <Download size={14} /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={!exportRecords.length} className="gap-1.5">
                <FileSpreadsheet size={14} /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Records ── */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <Search size={24} className="text-gray-300" />
            </div>
            <p className="font-medium text-gray-500">No data found</p>
            <p className="text-sm text-gray-400">No records match the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((rec) => {
          const byCode = new Map((rec.rows ?? []).map((r) => [r.code, r]));
          const cellValue = (code: string, scale: string) => {
            const raw = byCode.get(code)?.values?.[scale];
            return raw === undefined || raw === null ? null : Number(raw);
          };
          const rowTotal = (code: string) =>
            def.scale.reduce((sum, s) => sum + (cellValue(code, s.label) ?? 0), 0);

          return (
            <Card key={rec.id} className="overflow-hidden border-0 shadow-sm">
              <CardHeader className="px-4 pb-3 pt-4 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className={`inline-flex h-6 items-center rounded-md bg-gradient-to-br ${section.color} px-2 text-[11px] font-bold text-white`}>
                      {rec.academicYear}
                    </span>
                    {getGradeDisplayName(rec.grade, schoolCategory)}
                    <span className="text-gray-300">•</span>
                    <span className="font-normal text-gray-500">{rec.evaluationPeriod}</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <Badge variant="default" className="gap-1">
                      <Users size={12} /> {rec.numberOfStudents ?? 0} students
                    </Badge>
                    {rec.appearedPercent != null && (
                      <Badge variant="default">{def.appearedLabel}: {round2(Number(rec.appearedPercent))}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {/* Desktop / tablet: matrix table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-y border-gray-100 bg-gray-50">
                      <tr>
                        <th className="w-10 py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                        {def.grouped && (
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Domain</th>
                        )}
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{def.rowHeader}</th>
                        {def.scale.map((s) => (
                          <th key={s.label} className={`px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider ${s.tone}`}>
                            {s.label}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rowDefs.map((r, i) => {
                        const total = rowTotal(r.code);
                        const showDomain = def.grouped && (i === 0 || rowDefs[i - 1].domain !== r.domain);
                        const span = def.grouped ? rowDefs.filter((x) => x.domain === r.domain).length : 1;
                        return (
                          <tr key={r.code} className="transition-colors hover:bg-indigo-50/30">
                            <td className="py-2.5 pl-5 pr-3 align-top text-xs text-gray-400">{i + 1}</td>
                            {def.grouped && showDomain && (
                              <td rowSpan={span} className="border-r border-gray-100 bg-gray-50/50 px-3 py-2.5 align-top text-xs font-medium text-gray-600">
                                {r.domain}
                              </td>
                            )}
                            <td className="px-3 py-2.5 align-top text-sm text-gray-700">{r.label}</td>
                            {def.scale.map((s) => {
                              const v = cellValue(r.code, s.label);
                              return (
                                <td key={s.label} className="px-2 py-2.5 text-center align-top text-sm tabular-nums text-gray-700">
                                  {v === null || v === 0 ? <span className="text-gray-300">—</span> : round2(v)}
                                </td>
                              );
                            })}
                            <td className={`px-3 py-2.5 pr-5 text-right align-top text-xs font-semibold tabular-nums ${
                              total === 0 ? 'text-gray-300' : rec.appearedPercent != null && total === Number(rec.appearedPercent) ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {total ? round2(total) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: stacked cards */}
                <div className="space-y-3 p-4 md:hidden">
                  {rowDefs.map((r, i) => {
                    const total = rowTotal(r.code);
                    return (
                      <div key={r.code} className="rounded-xl border border-gray-200 p-3">
                        {r.domain && (
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{r.domain}</p>
                        )}
                        <p className="mb-2.5 text-sm font-medium text-gray-700">
                          <span className="mr-1 text-gray-400">{i + 1}.</span>{r.label}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {def.scale.map((s) => {
                              const v = cellValue(r.code, s.label);
                              return (
                                <div key={s.label} className="rounded-lg border border-gray-100 p-2 text-center">
                                  <p className={`mb-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</p>
                                  <p className="text-sm font-semibold tabular-nums text-gray-700">
                                    {v === null || v === 0 ? <span className="text-gray-300">—</span> : round2(v)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <p className={`mt-2 text-right text-xs font-semibold tabular-nums ${
                            total === 0 ? 'text-gray-300' : rec.appearedPercent != null && total === Number(rec.appearedPercent) ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            Total: {total ? round2(total) : '—'}
                          </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
