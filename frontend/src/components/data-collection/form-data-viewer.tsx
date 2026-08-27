'use client';

import { Fragment, useMemo, useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarRange, CheckCircle2, Download, FileSpreadsheet,
  LayoutGrid, ListChecks, Rows3, RotateCcw, Search, XCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { resolveAssetUrl } from '@/lib/utils';
import type { FormCatalogItem, FormCategory } from './form-catalog';

/* ─── Column handling ───────────────────────────────────── */

const HIDDEN_KEYS = new Set([
  'id', 'schoolId', 'createdById', 'createdBy', 'updatedById', 'updatedBy',
  'deletedAt', 'updatedAt', 'userId', 'photoKey', 'school',
]);

const LABEL_OVERRIDES: Record<string, string> = {
  createdAt: 'Submitted On',
  pwd: 'PWD',
  personsWithDisability: 'Persons With Disability',
  academicYear: 'Academic Year',
  gradeAPlus: 'Grade A+',
  gradeAMinus: 'Grade A-',
  photoUrl: 'Photo',
  isActive: 'Active',
  collectionPct: '% Collection',
  roomHeadTeachers: "Head Teachers' Room",
  roomTeachers: "Teachers' Room",
  roomClassroom: 'Classrooms',
  roomPlayroom: 'Playrooms',
  roomLibrary: 'Libraries',
  roomLab: 'Labs',
  roomStoreroom: 'Storerooms',
  roomKitchen: 'Kitchens',
  roomSickbay: 'Sickbays',
  roomOthers: 'Other Rooms',
  roomTotal: 'Total Rooms',
  washroomMale: 'Washrooms (Male)',
  washroomFemale: 'Washrooms (Female)',
};

/** Keys that identify a record — pinned first in tables, shown as chips on cards. */
const DIMENSION_KEYS = [
  'academicYear', 'year', 'month', 'grade', 'examName', 'evaluationPeriod',
  'item', 'eventName', 'name', 'alumniName',
];

/** Dimension keys offered as dropdown filters when they hold more than one value. */
const FILTER_KEYS = ['academicYear', 'year', 'month', 'grade', 'item', 'examName', 'awardLevel'];

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Grades are stored as slugs — mirror the labels used by the entry forms. */
const GRADE_LABELS: Record<string, string> = {
  play_learn: 'Play & Learn', nursery: 'Nursery',
  g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3', g4: 'Grade 4', g5: 'Grade 5',
  g6: 'Grade 6', g7: 'Grade 7', g8: 'Grade 8', g9: 'Grade 9', g10: 'Grade 10',
};
const GRADE_ORDER = Object.keys(GRADE_LABELS);

type FieldKind = 'boolean' | 'date' | 'percent' | 'currency' | 'year' | 'number' | 'image' | 'list' | 'text';

function humanizeKey(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  // `hasPlayground` / `isActive` read better without the predicate prefix.
  const base = key.replace(/^(has|is)([A-Z])/, '$2');
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const isIsoDateString = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(v);

const isImageUrl = (v: unknown) =>
  typeof v === 'string' && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(v);

/** Decimal columns come back from Postgres as strings — coerce before doing maths. */
function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtNumber = (n: number) => round2(n).toLocaleString('en-IN');
const fmtTaka = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;

function classifyField(key: string, values: unknown[]): FieldKind {
  const sample = values.find((v) => v !== null && v !== undefined && v !== '');
  if (typeof sample === 'boolean') return 'boolean';
  if (key === 'createdAt' || key === 'updatedAt' || (isIsoDateString(sample) && /date|at$/i.test(key))) return 'date';
  if (isImageUrl(sample) || /photo|image|url$/i.test(key)) return 'image';

  const numeric = values.some((v) => asNumber(v) !== null);
  if (numeric) {
    if (key === 'year' || /(^|[a-z])Year$/.test(key)) return 'year';
    if (/(rate|pct|percent)/i.test(key)) return 'percent';
    if (/year|count|students|teachers|rooms?|male|female|others?Awarded|total(?!.*(fee|revenue))/i.test(key)
      && !/(fee|revenue|amount|budget|salary|expenditure|income|grant|donation)/i.test(key)) return 'number';
    if (/(fee|revenue|amount|budget|salary|expenditure|income|grant|donation|dues)/i.test(key)) return 'currency';
    return 'number';
  }

  if (typeof sample === 'string' && sample.trim().startsWith('[')) return 'list';
  return 'text';
}

function parseList(v: unknown): string[] | null {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return null;
    }
  }
  return null;
}

/** Plain-text rendering used by search matching and the CSV/Excel exports. */
function formatValue(v: unknown, kind: FieldKind, key?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (key === 'grade' && typeof v === 'string' && GRADE_LABELS[v]) return GRADE_LABELS[v];
  if (kind === 'boolean') return v ? 'Yes' : 'No';
  if (kind === 'date') {
    const d = new Date(String(v));
    return isNaN(d.getTime())
      ? String(v)
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (kind === 'list') return (parseList(v) ?? [String(v)]).join(', ');
  const n = asNumber(v);
  if (n !== null) {
    if (kind === 'year') return String(Math.round(n));
    if (kind === 'percent') return `${round2(n)}%`;
    if (kind === 'currency') return fmtTaka(n);
    if (kind === 'number') return fmtNumber(n);
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

/* ─── Small presentational pieces ───────────────────────── */

function BoolPill({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 size={12} /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
      <XCircle size={12} /> No
    </span>
  );
}

function PercentValue({ value, align = 'left' }: { value: number; align?: 'left' | 'right' }) {
  const pct = Math.min(100, Math.max(0, value));
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
      <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">{round2(value)}%</span>
    </div>
  );
}

function PhotoValue({ url }: { url: string }) {
  const src = resolveAssetUrl(url);
  return (
    <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-600 hover:underline">
      <Image src={src} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />
      <span className="text-xs font-medium">View</span>
    </a>
  );
}

function CellValue({ value, kind, fieldKey }: { value: unknown; kind: FieldKind; fieldKey?: string }) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-300">—</span>;
  if (kind === 'boolean') return <BoolPill value={!!value} />;
  if (kind === 'image') return <PhotoValue url={String(value)} />;
  if (kind === 'list') {
    const items = parseList(value);
    if (!items?.length) return <span className="text-gray-300">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{item}</span>
        ))}
      </div>
    );
  }
  const n = asNumber(value);
  if (kind === 'percent' && n !== null) return <PercentValue value={n} />;
  return <span className={kind === 'currency' || kind === 'number' ? 'tabular-nums' : ''}>{formatValue(value, kind, fieldKey)}</span>;
}

/* ─── Component ─────────────────────────────────────────── */

type Row = Record<string, unknown>;

interface Props {
  schoolId: string;
  category: FormCategory;
  form: FormCatalogItem;
  /** Filename stem for the CSV/Excel exports. */
  fileBase: string;
}

/**
 * Read-only viewer for any submitted data-collection form.
 *
 * The API returns raw entity rows whose shape differs per form, so fields are
 * classified at runtime (currency / percent / boolean / photo / list …) and
 * rendered either as a scannable grouped table or as record cards that mirror
 * the layout of the original entry form.
 */
export function FormDataViewer({ schoolId, category, form, fileBase }: Props) {
  const {
    data: rows = [],
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dc-form-data', form.endpoint, schoolId],
    queryFn: () =>
      api
        .get(`/data-collection/${form.endpoint}/school/${schoolId}`)
        .then(({ data }) => (Array.isArray(data) ? data : data ? [data] : []) as Row[]),
  });

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [view, setView] = useState<'auto' | 'table' | 'cards'>('auto');
  const [visible, setVisible] = useState(12);

  /* ── Derived column metadata ── */

  const columns = useMemo(() => {
    const keys: string[] = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => {
      if (!HIDDEN_KEYS.has(k) && !keys.includes(k)) keys.push(k);
    }));
    const dims = DIMENSION_KEYS.filter((k) => keys.includes(k));
    return [...dims, ...keys.filter((k) => !dims.includes(k) && k !== 'createdAt'), ...keys.filter((k) => k === 'createdAt')];
  }, [rows]);

  const kinds = useMemo(() => {
    const map: Record<string, FieldKind> = {};
    columns.forEach((c) => { map[c] = classifyField(c, rows.map((r) => r[c])); });
    return map;
  }, [columns, rows]);

  const dimensions = useMemo(() => columns.filter((c) => DIMENSION_KEYS.includes(c)), [columns]);

  /** Fee categories that have both a target and an achievement column. */
  const pairs = useMemo(
    () =>
      columns
        .filter((c) => /Target$/.test(c) && columns.includes(c.replace(/Target$/, 'Achievement')))
        .map((c) => ({ base: c.replace(/Target$/, ''), target: c, achievement: c.replace(/Target$/, 'Achievement') })),
    [columns],
  );
  const paired = pairs.length >= 2;
  const pairedKeys = useMemo(
    () => new Set(paired ? pairs.flatMap((p) => [p.target, p.achievement]) : []),
    [paired, pairs],
  );

  const filterOptions = useMemo(() => {
    const out: { key: string; values: string[] }[] = [];
    FILTER_KEYS.filter((k) => columns.includes(k)).forEach((key) => {
      const values = [...new Set(rows.map((r) => (r[key] == null ? '' : String(r[key]))).filter(Boolean))];
      if (key === 'month') values.sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
      else if (key === 'grade') values.sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
      else values.sort((a, b) => (asNumber(b) ?? 0) - (asNumber(a) ?? 0) || a.localeCompare(b));
      if (values.length > 1) out.push({ key, values });
    });
    return out;
  }, [columns, rows]);

  /* ── Filtering ── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      for (const [key, value] of Object.entries(filters)) {
        if (value && String(r[key] ?? '') !== value) return false;
      }
      if (!q) return true;
      return columns.some((c) => formatValue(r[c], kinds[c], c).toLowerCase().includes(q));
    });
  }, [rows, filters, search, columns, kinds]);

  const activeFilters = Object.values(filters).filter(Boolean).length + (search.trim() ? 1 : 0);
  const resetFilters = () => { setFilters({}); setSearch(''); };

  /* ── Summary chips ── */

  const summary = useMemo(() => {
    const out: { label: string; value: string }[] = [
      { label: rows.length === 1 ? 'Record' : 'Records', value: String(rows.length) },
    ];
    ['academicYear', 'year', 'month', 'grade'].forEach((key) => {
      if (!columns.includes(key)) return;
      const distinct = new Set(rows.map((r) => String(r[key] ?? '')).filter(Boolean));
      if (!distinct.size) return;
      out.push({
        label: distinct.size === 1 ? humanizeKey(key) : `${humanizeKey(key)}s`,
        value: distinct.size === 1 ? [...distinct][0] : `${distinct.size}`,
      });
    });
    return out;
  }, [rows, columns]);

  /* ── Export ── */

  const exportColumns = columns;
  const exportHeaders = ['#', ...exportColumns.map(humanizeKey)];
  const exportBody = () =>
    filtered.map((r, i) => [String(i + 1), ...exportColumns.map((c) => formatValue(r[c], kinds[c], c))]);

  const exportCsv = () => {
    const lines = [exportHeaders.map(escapeCsv).join(',')];
    exportBody().forEach((cells) => lines.push(cells.map(escapeCsv).join(',')));
    triggerDownload('\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8;', `${fileBase}.csv`);
  };

  const exportExcel = () => {
    const head = exportHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const body = exportBody()
      .map((cells) => `<tr>${cells.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
      .join('');
    const html =
      `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>`
      + `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    triggerDownload(html, 'application/vnd.ms-excel;charset=utf-8;', `${fileBase}.xls`);
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

  if (rows.length === 0 || columns.length === 0) {
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

  // Wide, single-record or paired forms read far better as cards than as one
  // endlessly-scrolling table row.
  const autoCards = !!form.single || rows.length <= 2 || paired || columns.length > 14;
  const asCards = view === 'auto' ? autoCards : view === 'cards';

  return (
    <div className="space-y-5">
      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className={`border-0 shadow-sm ring-1 ${category.ring}`}>
            <CardContent className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${category.text}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters + export ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            {filterOptions.map(({ key, values }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-500">{humanizeKey(key)}</label>
                <div className="relative">
                  {(key === 'academicYear' || key === 'year') && (
                    <CalendarRange size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <select
                    value={filters[key] ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setVisible(12); }}
                    className={`${selectClass} ${key === 'academicYear' || key === 'year' ? 'pl-8' : ''}`}
                  >
                    <option value="">All {humanizeKey(key).toLowerCase()}s</option>
                    {values.map((v) => (
                      <option key={v} value={v}>{key === 'grade' ? GRADE_LABELS[v] ?? v : v}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisible(12); }}
                  placeholder="Search records…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 sm:w-56"
                />
              </div>
            </div>

            {activeFilters > 0 && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
                <RotateCcw size={14} /> Reset
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of {rows.length}
              {rows.length === 1 ? ' record' : ' records'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('cards')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    asCards ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutGrid size={13} /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setView('table')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    !asCards ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Rows3 size={13} /> Table
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length} className="gap-1.5">
                <Download size={14} /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length} className="gap-1.5">
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
      ) : asCards ? (
        <>
          <div className="space-y-4">
            {filtered.slice(0, visible).map((row, idx) => (
              <RecordCard
                key={(row.id as string) ?? idx}
                row={row}
                index={idx}
                columns={columns}
                kinds={kinds}
                dimensions={dimensions}
                pairs={paired ? pairs : []}
                pairedKeys={pairedKeys}
                category={category}
              />
            ))}
          </div>
          {filtered.length > visible && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + 12)}>
                Show more ({filtered.length - visible} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <RecordTable filtered={filtered} columns={columns} kinds={kinds} dimensions={dimensions} />
      )}
    </div>
  );
}

/* ─── Card view ─────────────────────────────────────────── */

interface Pair { base: string; target: string; achievement: string }

function RecordCard({
  row, index, columns, kinds, dimensions, pairs, pairedKeys, category,
}: {
  row: Row;
  index: number;
  columns: string[];
  kinds: Record<string, FieldKind>;
  dimensions: string[];
  pairs: Pair[];
  pairedKeys: Set<string>;
  category: FormCategory;
}) {
  const chips = dimensions.filter((d) => row[d] !== null && row[d] !== undefined && row[d] !== '');
  const fields = columns.filter(
    (c) => !dimensions.includes(c) && c !== 'createdAt' && !pairedKeys.has(c),
  );
  const submitted = row.createdAt ? formatValue(row.createdAt, 'date') : null;

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardHeader className="border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
            <span className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-gradient-to-br ${category.color} px-1.5 text-[11px] font-bold text-white`}>
              {index + 1}
            </span>
            {chips.length > 0 ? (
              chips.map((c, i) => (
                <Fragment key={c}>
                  {i > 0 && <span className="text-gray-300">•</span>}
                  <span className={i === 0 ? 'text-gray-800' : 'font-normal text-gray-500'}>
                    {formatValue(row[c], kinds[c], c)}
                  </span>
                </Fragment>
              ))
            ) : (
              <span className="text-gray-800">Submitted record</span>
            )}
          </CardTitle>
          {submitted && <Badge variant="default" className="w-fit">Submitted {submitted}</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {pairs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Target</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Collected</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Collection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pairs.map((p) => {
                  const target = asNumber(row[p.target]) ?? 0;
                  const achieved = asNumber(row[p.achievement]) ?? 0;
                  const pct = target > 0 ? (achieved / target) * 100 : 0;
                  return (
                    <tr key={p.base} className="transition-colors hover:bg-indigo-50/30">
                      <td className="px-3 py-2.5 text-gray-700">{humanizeKey(p.base)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtTaka(target)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900">{fmtTaka(achieved)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {target > 0 ? <PercentValue value={pct} align="right" /> : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-gray-100 bg-gray-50">
                {(() => {
                  const target = pairs.reduce((s, p) => s + (asNumber(row[p.target]) ?? 0), 0);
                  const achieved = pairs.reduce((s, p) => s + (asNumber(row[p.achievement]) ?? 0), 0);
                  return (
                    <tr className="text-sm font-semibold text-gray-800">
                      <td className="px-3 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtTaka(target)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtTaka(achieved)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {target > 0 ? <PercentValue value={(achieved / target) * 100} align="right" /> : '—'}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        )}

        {fields.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((c) => (
              <div key={c} className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{humanizeKey(c)}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-800 break-words">
                  <CellValue value={row[c]} kind={kinds[c]} fieldKey={c} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Table view ────────────────────────────────────────── */

function RecordTable({
  filtered, columns, kinds, dimensions,
}: {
  filtered: Row[];
  columns: string[];
  kinds: Record<string, FieldKind>;
  dimensions: string[];
}) {
  const groupKey = dimensions.includes('academicYear') ? 'academicYear' : dimensions.includes('year') ? 'year' : null;

  const groups = useMemo(() => {
    if (!groupKey) return [{ label: '', rows: filtered }];
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      const k = String(r[groupKey] ?? '—');
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return [...map.entries()].map(([label, rows]) => ({ label, rows }));
  }, [filtered, groupKey]);

  const totals = useMemo(() => {
    const out: Record<string, number | null> = {};
    columns.forEach((c) => {
      const kind = kinds[c];
      if (kind !== 'number' && kind !== 'currency' && kind !== 'percent') { out[c] = null; return; }
      if (/year/i.test(c)) { out[c] = null; return; }
      const nums = filtered.map((r) => asNumber(r[c])).filter((n): n is number => n !== null);
      if (!nums.length) { out[c] = null; return; }
      out[c] = kind === 'percent'
        ? nums.reduce((s, n) => s + n, 0) / nums.length
        : nums.reduce((s, n) => s + n, 0);
    });
    return out;
  }, [filtered, columns, kinds]);

  const isRight = (c: string) => ['number', 'currency', 'percent'].includes(kinds[c]) && !DIMENSION_KEYS.includes(c);
  const showTotals = filtered.length > 1 && Object.values(totals).some((v) => v !== null);

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="w-10 py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
                      isRight(c) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {humanizeKey(c)}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group, gi) => (
              <tbody key={group.label || gi} className="divide-y divide-gray-50">
                {groups.length > 1 && (
                  <tr className="bg-indigo-50/40">
                    <td colSpan={columns.length + 1} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                      {humanizeKey(groupKey!)} {group.label}
                      <span className="ml-2 font-normal text-indigo-400">
                        {group.rows.length} {group.rows.length === 1 ? 'record' : 'records'}
                      </span>
                    </td>
                  </tr>
                )}
                {group.rows.map((row, idx) => (
                  <tr key={(row.id as string) ?? `${gi}-${idx}`} className="transition-colors hover:bg-indigo-50/30">
                    <td className="py-3 pl-5 pr-3 align-top text-xs text-gray-400">{idx + 1}</td>
                    {columns.map((c) => (
                      <td
                        key={c}
                        className={`px-3 py-3 align-top text-gray-700 ${isRight(c) ? 'text-right' : ''} ${
                          DIMENSION_KEYS.includes(c) ? 'whitespace-nowrap font-medium text-gray-900' : ''
                        }`}
                      >
                        {kinds[c] === 'percent' && asNumber(row[c]) !== null ? (
                          <PercentValue value={asNumber(row[c])!} align="right" />
                        ) : (
                          <CellValue value={row[c]} kind={kinds[c]} fieldKey={c} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
            {showTotals && (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr className="text-sm font-semibold text-gray-800">
                  <td className="whitespace-nowrap py-3 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total</td>
                  {columns.map((c) => (
                    <td key={c} className={`px-3 py-3 ${isRight(c) ? 'text-right tabular-nums' : ''}`}>
                      {totals[c] === null ? '' : formatValue(totals[c], kinds[c], c)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
