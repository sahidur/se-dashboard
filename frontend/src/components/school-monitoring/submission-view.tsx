'use client';

import { useState } from 'react';
import { Check, X, MinusCircle, FileText, Download, Calendar, User as UserIcon, ImageOff } from 'lucide-react';
import { cn, resolveAssetUrl } from '@/lib/utils';
import { getMonitoringForm } from './form-catalog';
import type { MonitoringAttachment, MonitoringResult, MonitoringSubmission } from '@/types';

const RESULT_META: Record<Exclude<MonitoringResult, ''>, { label: string; icon: React.ElementType; cls: string }> = {
  yes: { label: 'Yes', icon: Check, cls: 'bg-emerald-100 text-emerald-700' },
  no: { label: 'No', icon: X, cls: 'bg-red-100 text-red-700' },
  na: { label: 'N/A', icon: MinusCircle, cls: 'bg-gray-100 text-gray-600' },
};

export function ResultPill({ result }: { result: MonitoringResult }) {
  if (!result) return <span className="text-xs text-gray-300">—</span>;
  const m = RESULT_META[result];
  const Icon = m.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', m.cls)}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

export function fullName(u?: MonitoringSubmission['submittedBy']): string {
  if (!u) return 'Unknown';
  return `${u.firstName} ${u.lastName}`.trim() || u.email;
}

const isImg = (a: MonitoringAttachment) =>
  a.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name);

/**
 * A stored attachment can be unreachable when the record was created against a
 * different deployment: uploads live on the API server's local disk (unless S3
 * is configured) while the database is shared, so the row can outlive the file.
 * Show that explicitly rather than a broken image linking to a raw 404 payload.
 */
function AttachmentTile({ attachment }: { attachment: MonitoringAttachment }) {
  const [failed, setFailed] = useState(false);
  const href = resolveAssetUrl(attachment.url);

  if (failed) {
    return (
      <div
        className="flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2 text-center"
        title={attachment.name}
      >
        <ImageOff className="h-6 w-6 text-amber-500" />
        <span className="mt-1 line-clamp-1 text-xs font-medium text-amber-800">{attachment.name}</span>
        <span className="text-[11px] text-amber-700">File unavailable on this server</span>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-xl border border-gray-200"
    >
      {isImg(attachment) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={attachment.name}
          className="h-28 w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center bg-gray-50 p-2 text-center">
          <FileText className="h-8 w-8 text-gray-400" />
          <span className="mt-1 line-clamp-2 text-xs text-gray-600">{attachment.name}</span>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Download className="h-5 w-5 text-white" />
      </div>
    </a>
  );
}

export function SubmissionView({ submission }: { submission: MonitoringSubmission }) {
  const form = getMonitoringForm(submission.formType);
  const answerMap = new Map(submission.answers?.map((a) => [a.code, a]) ?? []);

  const counts = { yes: 0, no: 0, na: 0 };
  submission.answers?.forEach((a) => {
    if (a.result && a.result in counts) counts[a.result as 'yes' | 'no' | 'na']++;
  });

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryStat label="Yes / Satisfied" shortLabel="Yes" value={counts.yes} cls="text-emerald-600" />
        <SummaryStat label="No / Not Satisfied" shortLabel="No" value={counts.no} cls="text-red-600" />
        <SummaryStat label="Not Applicable" shortLabel="N/A" value={counts.na} cls="text-gray-500" />
      </div>

      {submission.generalRemarks && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">General remarks</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{submission.generalRemarks}</p>
        </div>
      )}

      {/* Sections */}
      {form?.sections.map((sec) => (
        <div key={sec.number} className="overflow-hidden rounded-xl border border-gray-200">
          <div className="bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">
            {sec.number}. {sec.title}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="w-14 px-3 py-2">Sl.</th>
                  <th className="px-3 py-2">Indicator</th>
                  <th className="w-24 px-3 py-2">Result</th>
                  <th className="px-3 py-2">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sec.indicators.map((ind) => {
                  const a = answerMap.get(ind.code);
                  return (
                    <tr key={ind.code} className="hover:bg-indigo-50/30">
                      <td className="px-3 py-2 font-medium text-brand-600">{ind.code}</td>
                      <td className="px-3 py-2 text-gray-800">{ind.text}</td>
                      <td className="px-3 py-2"><ResultPill result={a?.result ?? ''} /></td>
                      <td className="px-3 py-2 break-words text-gray-500">{a?.comment || <span className="text-gray-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Attachments */}
      {submission.attachments?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-800">Attachments ({submission.attachments.length})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {submission.attachments.map((a) => (
              <AttachmentTile key={a.key} attachment={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, shortLabel, value, cls }: { label: string; shortLabel?: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
      <p className={cn('text-2xl font-bold', cls)}>{value}</p>
      <p className="text-xs text-gray-500">
        {shortLabel && <span className="sm:hidden">{shortLabel}</span>}
        <span className={cn(shortLabel && 'hidden sm:inline')}>{label}</span>
      </p>
    </div>
  );
}
