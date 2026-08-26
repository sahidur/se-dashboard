'use client';

import { History, MessageSquareQuote } from 'lucide-react';
import { cn, formatDateTimeBd, formatRelativeTime } from '@/lib/utils';
import { ResultPill } from './submission-view';
import type { MonitoringQuestionFeedback } from '@/types';

const AVATAR_STYLES = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function avatarStyle(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

interface Props {
  /** Entries for the current question code, newest submission first. */
  entries?: MonitoringQuestionFeedback[];
  loading?: boolean;
  className?: string;
}

/**
 * Timeline "tree" of everything previously submitted against one indicator:
 * who submitted it, their Yes/No/N-A rating, their comment and when — newest
 * first — so the current observer can build on what was already reported.
 */
export function QuestionFeedbackTimeline({ entries, loading, className }: Props) {
  const list = entries ?? [];

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <History className="h-4 w-4 shrink-0 text-brand-600" />
        <h3 className="text-sm font-semibold text-gray-900">Previous feedback</h3>
        {!loading && (
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {list.length} {list.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <MessageSquareQuote className="mx-auto mb-2 h-7 w-7 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No previous feedback here yet</p>
          <p className="mt-1 text-xs text-gray-400">You&apos;ll be the first to answer this question.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 overflow-y-auto p-4 pt-4 max-h-[52vh] lg:max-h-[calc(100vh-13rem)]">
          {/* vertical line joining every node */}
          <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-brand-300 via-gray-200 to-transparent" />
          {list.map((e, idx) => {
            const name = e.submittedByName || e.observerName || 'Unknown';
            return (
              <li
                key={`${e.submissionId}-${e.code}-${idx}`}
                className="relative flex gap-3"
                style={{ animation: `timelineIn 0.3s ease-out ${Math.min(idx * 0.06, 0.6)}s both` }}
              >
                <span
                  className={cn(
                    'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white',
                    avatarStyle(e.submittedById || name),
                  )}
                  title={name}
                >
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-gray-200 bg-gray-50/70 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-semibold text-gray-800">{name}</span>
                    {idx === 0 && (
                      <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                        Latest
                      </span>
                    )}
                    <ResultPill result={e.result} />
                    <time
                      className="ml-auto shrink-0 text-right text-xs text-gray-400"
                      dateTime={e.submittedAt}
                      title={formatDateTimeBd(e.submittedAt)}
                    >
                      <span className="block">{formatRelativeTime(e.submittedAt)}</span>
                      <span className="block text-[11px]">{formatDateTimeBd(e.submittedAt)}</span>
                    </time>
                  </div>
                  {e.comment?.trim() && (
                    <p className="mt-1.5 break-words border-l-2 border-brand-200 pl-2 text-sm italic leading-snug text-gray-600">
                      &ldquo;{e.comment.trim()}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
