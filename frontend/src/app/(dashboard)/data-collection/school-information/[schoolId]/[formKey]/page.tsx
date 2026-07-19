'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileSpreadsheet, Search, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { findFormByKey } from '@/components/data-collection/form-catalog';

/* ─── Column key handling ───────────────────────────────── */

const HIDDEN_KEYS = new Set([
  'id', 'schoolId', 'createdById', 'createdBy', 'deletedAt', 'updatedAt', 'userId',
]);

const LABEL_OVERRIDES: Record<string, string> = {
  createdAt: 'Submitted On',
  pwd: 'PWD',
  personsWithDisability: 'PWD',
};

function humanizeKey(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isIsoDateString(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v);
}

function isImageUrl(v: unknown): boolean {
  return typeof v === 'string' && /^https?:\/\//.test(v) && /\.(png|jpe?g|gif|webp)$/i.test(v);
}

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (isIsoDateString(v)) {
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

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

const escapeCsv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─── Page ───────────────────────────────────────────────── */

export default function FormDataViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const schoolId = String(params?.schoolId ?? '');
  const formKey = String(params?.formKey ?? '');
  const schoolName = searchParams.get('schoolName') ?? '';
  const schoolCode = searchParams.get('schoolCode') ?? '';

  // NOTE: findFormByKey() returns a brand-new object literal on every call, so it
  // must be memoized on the primitive `formKey` — otherwise `found` gets a new
  // reference every render, which recreates `load` (useCallback depended on
  // `found`) and re-triggers the `useEffect` below on every render, causing an
  // infinite "loading" loop.
  const found = useMemo(() => findFormByKey(formKey), [formKey]);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    if (!found) return;
    setLoading(true);
    setError(null);
    api.get(`/data-collection/${found.form.endpoint}/school/${schoolId}`)
      .then(({ data }) => {
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        setRows(arr);
      })
      .catch(() => setError('Failed to load submitted data for this form.'))
      .finally(() => setLoading(false));
  }, [found, schoolId]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (!HIDDEN_KEYS.has(k)) keys.add(k); }));
    return [...keys];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => formatCellValue(r[c]).toLowerCase().includes(q)),
    );
  }, [rows, columns, search]);

  if (!found) {
    return (
      <>
        <Header title="Submitted Data" />
        <div className="p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-gray-500">Unknown form “{formKey}”.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push(`/data-collection/school-information?school=${schoolId}`)}>
                Back to School Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const { category, form } = found;
  const fileBase = `${schoolCode || schoolId}-${form.key}`;
  const headers = ['#', ...columns.map(humanizeKey)];

  const exportCsv = () => {
    const lines = [headers.map(escapeCsv).join(',')];
    filtered.forEach((r, i) => {
      lines.push([String(i + 1), ...columns.map((c) => escapeCsv(formatCellValue(r[c])))].join(','));
    });
    triggerDownload('\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8;', `${fileBase}.csv`);
  };

  const exportExcel = () => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const body = filtered
      .map((r, i) => {
        const cells = [String(i + 1), ...columns.map((c) => formatCellValue(r[c]))]
          .map((v) => `<td>${escapeHtml(v)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    const html =
      `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>` +
      `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    triggerDownload(html, 'application/vnd.ms-excel;charset=utf-8;', `${fileBase}.xls`);
  };

  return (
    <>
      <Header
        title={form.label}
        subtitle={[schoolName, category.label].filter(Boolean).join(' • ')}
        actions={
          <Button
            variant="outline" size="sm"
            onClick={() => router.push(`/data-collection/school-information?school=${schoolId}`)}
            className="gap-2"
          >
            <ArrowLeft size={14} /> Back to Profile
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        <p className="text-sm text-gray-500">{form.description}</p>

        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Submitted Records
                <Badge variant="default" className="ml-2">{filtered.length}</Badge>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search records…"
                    className="w-full rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:w-64"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length} className="gap-1.5">
                  <Download size={14} /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length} className="gap-1.5">
                  <FileSpreadsheet size={14} /> Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                  <FileSpreadsheet size={24} className="text-red-400" />
                </div>
                <p className="text-sm font-medium text-red-500">{error}</p>
                <Button variant="outline" size="sm" onClick={load}>Retry</Button>
              </div>
            ) : columns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
                  <Search size={24} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">No data found</p>
                <p className="text-sm text-gray-400">No records have been submitted for this form yet.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
                  <Search size={24} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">No data found</p>
                <p className="text-sm text-gray-400">No records match your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-gray-100 bg-gray-50">
                    <tr>
                      <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                      {columns.map((c) => (
                        <th key={c} className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {humanizeKey(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((row, idx) => (
                      <tr key={(row.id as string) ?? idx} className="transition-colors hover:bg-indigo-50/30">
                        <td className="py-3 pl-5 pr-3 text-gray-400">{idx + 1}</td>
                        {columns.map((c) => (
                          <td key={c} className="py-3 px-3 text-gray-700">
                            {isImageUrl(row[c]) ? (
                              <a
                                href={row[c] as string}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                              >
                                <ImageIcon size={13} /> View
                              </a>
                            ) : (
                              formatCellValue(row[c])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
