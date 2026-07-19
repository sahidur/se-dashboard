'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, Send, Trash2, FileClock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

interface DraftActionBarProps {
  hasDraft: boolean;
  draftSavedAt: string | null;
  /** True while the real Submit request is in flight. */
  submitting?: boolean;
  onSaveDraft: () => void | Promise<void>;
  onClearDraft: () => void | Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  saveDraftLabel?: string;
  /** Disable everything except the draft actions (e.g. missing prerequisite). */
  disabled?: boolean;
}

/**
 * Shared action bar for data-collection forms that support private drafts.
 *
 * - "Save as Draft" saves the current field values to the server, privately
 *   for this user (visible again even from a different device), no backend
 *   submit/logs.
 * - "Clear Draft" discards the saved draft.
 * - "Submit Data" is a real form submit (type="submit") that runs the form's
 *   normal backend save, which is the only action that creates upload logs and
 *   feeds dashboards / programme-overview calculations.
 *
 * Both draft actions show a success/error popup on completion.
 */
export function DraftActionBar({
  hasDraft,
  draftSavedAt,
  submitting = false,
  onSaveDraft,
  onClearDraft,
  submitLabel = 'Submit Data',
  submittingLabel = 'Submitting...',
  saveDraftLabel = 'Save as Draft',
  disabled = false,
}: DraftActionBarProps) {
  const [savingDraft, setSavingDraft] = useState(false);
  const [clearingDraft, setClearingDraft] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await onSaveDraft();
      showToast('success', 'Draft saved successfully.');
    } catch {
      showToast('error', 'Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleClearDraft = async () => {
    setClearingDraft(true);
    try {
      await onClearDraft();
      showToast('success', 'Draft cleared successfully.');
    } catch {
      showToast('error', 'Failed to clear draft. Please try again.');
    } finally {
      setClearingDraft(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {hasDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <FileClock size={16} className="shrink-0" />
          <span>
            Draft saved{draftSavedAt ? ` ${formatRelativeTime(draftSavedAt)}` : ''} &mdash; only
            visible to you, saved to your account so it's available on any device. Not submitted yet.
          </span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {hasDraft && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearDraft}
            disabled={submitting || savingDraft || clearingDraft}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={16} className="mr-1.5" />
            {clearingDraft ? 'Clearing...' : 'Clear Draft Data'}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={submitting || disabled || savingDraft || clearingDraft}
        >
          <Save size={16} className="mr-1.5" />
          {savingDraft ? 'Saving...' : saveDraftLabel}
        </Button>

        <Button type="submit" loading={submitting} disabled={disabled}>
          {!submitting && <Send size={16} className="mr-1.5" />}
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
