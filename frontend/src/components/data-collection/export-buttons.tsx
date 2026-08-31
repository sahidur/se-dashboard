'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

/**
 * Shared confidential-data export helpers used by every data-collection
 * form's View Data tab (and the generic viewers).
 *
 * Every generated file starts with a strict confidentiality disclaimer:
 * the data is protected, internal-use only, and must not be shared without
 * written programme approval.
 */

export const EXPORT_DISCLAIMER_TITLE =
  'CONFIDENTIAL — RESTRICTED INTERNAL USE ONLY';

export const EXPORT_DISCLAIMER_LINES = [
  'This document contains protected programme data.',
  'For authorised internal users only. Do not share, copy, forward, publish or distribute — in whole or in part — without written approval from the Programme.',
  'Any unauthorised disclosure, reproduction or use of this data is strictly prohibited and may result in disciplinary and legal action.',
];

/* ─── Download plumbing ─────────────────────────────────── */

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
const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v);
};

/* ─── Payload ───────────────────────────────────────────── */

export interface ExportPayload {
  /** Filename stem (without extension). */
  filename: string;
  /**
   * Column headers. MUST be exactly aligned with `rows` — every row must
   * have the same number of cells as there are headers (no automatic
   * index column is added; include it explicitly in both when wanted).
   */
  headers: string[];
  /** One row of values per data record, matching `headers` cell-for-cell. */
  rows: (string | number | null | undefined)[][];
}

/** Disclaimer + generation metadata rows placed at the very start of the file. */
function disclaimerRows(): string[][] {
  const { user } = useAuthStore.getState();
  const downloadedBy = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const meta = [
    `Generated on: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    downloadedBy ? `Downloaded by: ${downloadedBy}` : 'Downloaded by: authorised internal user',
  ].join(' | ');
  return [
    [EXPORT_DISCLAIMER_TITLE],
    ...EXPORT_DISCLAIMER_LINES.map((l) => [l]),
    [meta],
    [''],
  ];
}

export function buildCsv(payload: ExportPayload): string {
  const lines = disclaimerRows().map((r) => r.map(escapeCsv).join(','));
  lines.push(payload.headers.map(escapeCsv).join(','));
  payload.rows.forEach((row) => lines.push(row.map((v) => escapeCsv(cellText(v))).join(',')));
  return '\uFEFF' + lines.join('\n');
}

export function buildExcelHtml(payload: ExportPayload): string {
  const cols = Math.max(1, payload.headers.length);
  const banner = (text: string, style: string) =>
    `<tr><td colspan="${cols}" style="${style}">${escapeHtml(text)}</td></tr>`;
  const head = `<tr>${payload.headers
    .map((h) => `<th style="background:#e5e7eb;color:#374151;font-weight:bold;text-align:left">${escapeHtml(h)}</th>`)
    .join('')}</tr>`;
  const body = payload.rows
    .map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(cellText(v))}</td>`).join('')}</tr>`)
    .join('');
  const disclaimer =
    banner(EXPORT_DISCLAIMER_TITLE, 'background:#7f1d1d;color:#ffffff;font-size:12pt;font-weight:bold;text-align:center')
    + EXPORT_DISCLAIMER_LINES.map((l) =>
      banner(l, 'background:#fef2f2;color:#7f1d1d;font-size:9pt'),
    ).join('');

  const { user } = useAuthStore.getState();
  const downloadedBy = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const meta = banner(
    `Generated on: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      + (downloadedBy ? ` | Downloaded by: ${downloadedBy}` : ''),
    'background:#f9fafb;color:#374151;font-size:9pt;font-style:italic',
  );

  return (
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>`
    + `<body><table border="1">`
    + `${disclaimer}${meta}${head}${body}`
    + `</table></body></html>`
  );
}

/** Public wrapper for triggering a file download of pre-built content. */
export function downloadContent(content: string, mime: string, filename: string) {
  triggerDownload(content, mime, filename);
}

export function downloadCsv(payload: ExportPayload) {
  triggerDownload(buildCsv(payload), 'text/csv;charset=utf-8;', `${payload.filename}.csv`);
}

export function downloadExcel(payload: ExportPayload) {
  triggerDownload(
    buildExcelHtml(payload),
    'application/vnd.ms-excel;charset=utf-8;',
    `${payload.filename}.xls`,
  );
}

/* ─── Buttons ───────────────────────────────────────────── */

export function ExportButtons({
  payload,
  size = 'sm',
  className = '',
}: {
  payload: ExportPayload;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const empty = payload.rows.length === 0;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size={size}
        onClick={() => downloadCsv(payload)}
        disabled={empty}
        className="gap-1.5"
        title="Download as CSV"
      >
        <Download size={size === 'sm' ? 13 : 14} /> CSV
      </Button>
      <Button
        variant="outline"
        size={size}
        onClick={() => downloadExcel(payload)}
        disabled={empty}
        className="gap-1.5"
        title="Download as Excel"
      >
        <FileSpreadsheet size={size === 'sm' ? 13 : 14} /> Excel
      </Button>
    </div>
  );
}

/* ─── Convenience: export straight from a DataTable column list ── */

/**
 * Build an ExportPayload from a DataTable column list. Raw record values are
 * used (renders are display-only), with optional per-key formatting.
 */
export function exportPayloadFromColumns<T extends Record<string, any>>(
  columns: { key: string; header: string; hidden?: boolean }[],
  data: T[],
  filename: string,
  format?: Record<string, (v: any, item: T) => string | number | null | undefined>,
): ExportPayload {
  const visible = columns.filter((c) => !c.hidden);
  return {
    filename,
    // Header and row cells are aligned 1:1 — the '#' index column is added to
    // BOTH so they can never drift out of sync.
    headers: ['#', ...visible.map((c) => c.header)],
    rows: data.map((item, i) => [
      i + 1,
      ...visible.map((c) => {
        if (format?.[c.key]) return format[c.key](item[c.key], item);
        const v = item[c.key];
        if (v === null || v === undefined) return '';
        return typeof v === 'object' ? JSON.stringify(v) : v;
      }),
    ]),
  };
}
