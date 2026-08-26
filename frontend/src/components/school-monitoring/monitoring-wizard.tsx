'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Check, X, MinusCircle,
  UploadCloud, FileText, Trash2, Send, AlertCircle, ClipboardCheck,
  ChevronDown, GraduationCap, ImageOff, History, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { cn, resolveAssetUrl } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import {
  MonitoringFormDef, totalIndicators, MONITORING_GRADES,
} from './form-catalog';
import { QuestionFeedbackTimeline } from './question-feedback-timeline';
import type {
  MonitoringAnswer, MonitoringAttachment, MonitoringQuestionFeedback,
  MonitoringResult, MonitoringSubmission,
} from '@/types';

/**
 * Uploads live on the API server's local disk (unless S3 is configured) while
 * the database is shared, so a stored attachment can be missing on the machine
 * that serves it. Surface that instead of rendering a broken image.
 */
function AttachmentThumb({ attachment, isImage }: { attachment: MonitoringAttachment; isImage: boolean }) {
  const [failed, setFailed] = useState(false);

  if (isImage && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolveAssetUrl(attachment.url)}
        alt={attachment.name}
        className="h-28 w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  if (failed) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center bg-amber-50 p-2 text-center">
        <ImageOff className="h-7 w-7 text-amber-500" />
        <span className="mt-1 line-clamp-1 text-xs font-medium text-amber-800">{attachment.name}</span>
        <span className="text-[11px] text-amber-700">File unavailable on this server</span>
      </div>
    );
  }

  return (
    <div className="flex h-28 w-full flex-col items-center justify-center bg-gray-50 p-2 text-center">
      <FileText className="h-8 w-8 text-gray-400" />
      <span className="mt-1 line-clamp-2 text-xs text-gray-600">{attachment.name}</span>
    </div>
  );
}

interface Props {
  form: MonitoringFormDef;
  schoolId: string;
  schoolName?: string;
  /** Pass an existing submission to edit it instead of creating a new one. */
  existing?: MonitoringSubmission;
  onSubmitted: (submission: MonitoringSubmission) => void;
  onCancel?: () => void;
}

const RESULT_OPTIONS: {
  value: Exclude<MonitoringResult, ''>;
  label: string;
  shortLabel: string;
  subLabel: string;
  icon: React.ElementType;
  selected: string;
  badge: string;
}[] = [
  {
    value: 'yes', label: 'Yes / Satisfied', shortLabel: 'Yes', subLabel: 'Satisfied',
    icon: Check, selected: 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm', badge: 'bg-emerald-500',
  },
  {
    value: 'no', label: 'No / Not Satisfied', shortLabel: 'No', subLabel: 'Not satisfied',
    icon: X, selected: 'border-red-500 bg-red-50 text-red-700 shadow-sm', badge: 'bg-red-500',
  },
  {
    value: 'na', label: 'Not Applicable', shortLabel: 'N/A', subLabel: 'Not applicable',
    icon: MinusCircle, selected: 'border-gray-400 bg-gray-100 text-gray-600 shadow-sm', badge: 'bg-gray-500',
  },
];

/** A "No / Not Satisfied" rating must be justified with a comment of at least this length. */
const MIN_NO_COMMENT_LENGTH = 50;

const needsComment = (a?: { result: MonitoringResult; comment: string }) =>
  a?.result === 'no' && a.comment.trim().length < MIN_NO_COMMENT_LENGTH;

export function MonitoringWizard({ form, schoolId, schoolName, existing, onSubmitted, onCancel }: Props) {
  const user = useAuthStore((s) => s.user);

  // Steps: 0 = header details, 1..N = one question per step, N+1 = attachments
  // & remarks, N+2 = review. Questions are asked one at a time; while a
  // question is on screen its past-feedback timeline sits beside it.
  const flatQuestions = useMemo(
    () => form.sections.flatMap((sec) => sec.indicators.map((ind) => ({ ind, sec }))),
    [form],
  );
  const questionCount = flatQuestions.length;
  const HEADER_STEP = 0;
  const FIRST_QUESTION_STEP = 1;
  const ATTACH_STEP = questionCount + 1;
  const REVIEW_STEP = questionCount + 2;
  const TOTAL_STEPS = REVIEW_STEP + 1;

  const [step, setStep] = useState(HEADER_STEP);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successSub, setSuccessSub] = useState<MonitoringSubmission | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Header fields
  const [observerName, setObserverName] = useState(
    existing?.observerName ?? (user ? `${user.firstName} ${user.lastName}` : ''),
  );
  const [teacherName, setTeacherName] = useState(existing?.teacherName ?? '');
  const [observationDate, setObservationDate] = useState(
    existing?.observationDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [grades, setGrades] = useState<string[]>(
    existing?.className ? existing.className.split(',').map((g) => g.trim()).filter(Boolean) : [],
  );
  const [generalRemarks, setGeneralRemarks] = useState(existing?.generalRemarks ?? '');
  const [attachments, setAttachments] = useState<MonitoringAttachment[]>(existing?.attachments ?? []);

  // Answers keyed by indicator code
  const [answers, setAnswers] = useState<Record<string, { result: MonitoringResult; comment: string }>>(() => {
    const init: Record<string, { result: MonitoringResult; comment: string }> = {};
    form.sections.forEach((sec) =>
      sec.indicators.forEach((ind) => {
        const found = existing?.answers?.find((a) => a.code === ind.code);
        init[ind.code] = { result: found?.result ?? '', comment: found?.comment ?? '' };
      }),
    );
    return init;
  });

  // ── Previous-feedback timeline data (one call for every indicator) ──────
  const [feedbackMap, setFeedbackMap] = useState<Record<string, MonitoringQuestionFeedback[]>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  useEffect(() => {
    if (!schoolId || questionCount === 0) return;
    let cancelled = false;
    setFeedbackLoading(true);
    api
      .get<MonitoringQuestionFeedback[]>(`/school-monitoring/school/${schoolId}/question-feedback`, {
        params: {
          formType: form.type,
          codes: flatQuestions.map((q) => q.ind.code).join(','),
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, MonitoringQuestionFeedback[]> = {};
        for (const entry of data) {
          // While editing, the submission's own old answers aren't "history".
          if (existing && entry.submissionId === existing.id) continue;
          (map[entry.code] ??= []).push(entry);
        }
        setFeedbackMap(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, form.type, flatQuestions, questionCount, existing]);

  const total = totalIndicators(form);
  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.result).length,
    [answers],
  );

  const setResult = (code: string, result: MonitoringResult) =>
    setAnswers((prev) => ({ ...prev, [code]: { ...prev[code], result: prev[code].result === result ? '' : result } }));
  const setComment = (code: string, comment: string) =>
    setAnswers((prev) => ({ ...prev, [code]: { ...prev[code], comment } }));

  const missingComments = useMemo(
    () => Object.entries(answers).filter(([, a]) => needsComment(a)).map(([code]) => code),
    [answers],
  );

  /** Step of the first indicator of each section (for chips & review jumps). */
  const sectionStartStep = useMemo(() => {
    const starts = new Map<string, number>();
    let s = FIRST_QUESTION_STEP;
    for (const sec of form.sections) {
      starts.set(sec.number, s);
      s += sec.indicators.length;
    }
    return starts;
  }, [form]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const goTo = (target: number) => {
    setDirection(target > step ? 'fwd' : 'back');
    setStep(target);
    setError('');
    setTimeout(scrollTop, 0);
  };

  const isQuestionStep = step >= FIRST_QUESTION_STEP && step <= questionCount;
  const currentQuestion = isQuestionStep ? flatQuestions[step - FIRST_QUESTION_STEP] : null;

  const next = () => {
    if (currentQuestion && needsComment(answers[currentQuestion.ind.code])) {
      setError(
        `A comment of at least ${MIN_NO_COMMENT_LENGTH} characters is required when rating "No / Not Satisfied" (indicator ${currentQuestion.ind.code}).`,
      );
      return;
    }
    if (step < REVIEW_STEP) goTo(step + 1);
  };
  const prev = () => step > HEADER_STEP && goTo(step - 1);

  const sectionMissingComments = (secIdx: number) =>
    form.sections[secIdx].indicators
      .filter((ind) => needsComment(answers[ind.code]))
      .map((ind) => ind.code);

  const sectionAnswered = (secIdx: number) => {
    const sec = form.sections[secIdx];
    return sec.indicators.every((ind) => answers[ind.code].result) && sectionMissingComments(secIdx).length === 0;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const { data } = await api.post('/files/upload?folder=school-monitoring', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments((prev) => [...prev, { url: data.url, key: data.key, name: file.name, type: file.type }]);
      }
    } catch {
      setError('Failed to upload one or more files. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (key: string) =>
    setAttachments((prev) => prev.filter((a) => a.key !== key));

  const handleSubmit = async () => {
    if (missingComments.length) {
      const firstMissingIdx = flatQuestions.findIndex((q) => needsComment(answers[q.ind.code]));
      if (firstMissingIdx >= 0) goTo(FIRST_QUESTION_STEP + firstMissingIdx);
      setError(
        `A comment of at least ${MIN_NO_COMMENT_LENGTH} characters is required for every "No / Not Satisfied" answer (${missingComments.join(', ')}).`,
      );
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      schoolId,
      formType: form.type,
      observerName: observerName || undefined,
      teacherName: form.hasTeacher ? teacherName || undefined : undefined,
      observationDate: observationDate || undefined,
      className: form.hasClass ? (grades.length ? grades.join(', ') : undefined) : undefined,
      generalRemarks: generalRemarks || undefined,
      attachments,
      answers: form.sections.flatMap((sec) =>
        sec.indicators.map<MonitoringAnswer>((ind) => ({
          code: ind.code,
          section: sec.number,
          result: answers[ind.code].result,
          comment: answers[ind.code].comment || undefined,
        })),
      ),
    };
    try {
      const { data } = existing
        ? await api.patch<MonitoringSubmission>(`/school-monitoring/${existing.id}`, payload)
        : await api.post<MonitoringSubmission>('/school-monitoring', payload);
      setSuccessSub(data);
      setTimeout(() => onSubmitted(data), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  const answeredPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const currentAnswer = currentQuestion ? answers[currentQuestion.ind.code] : null;
  const currentEntries = currentQuestion ? feedbackMap[currentQuestion.ind.code] : undefined;
  const currentEntryCount = currentEntries?.length ?? 0;
  const commentLen = currentAnswer ? currentAnswer.comment.trim().length : 0;
  const commentShortBy = MIN_NO_COMMENT_LENGTH - commentLen;
  const commentInvalid = currentAnswer?.result === 'no' && commentShortBy > 0;

  const isImg = (a: MonitoringAttachment) =>
    a.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name);

  const cardAnim = direction === 'fwd' ? 'animate-slideInRight' : 'animate-slideInLeft';
  const cardCls =
    'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6';

  // Back / Next controls rendered right after the active card (question,
  // details, attachments or review) so they are always immediately reachable.
  const nav = (
    <div className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {step > HEADER_STEP ? (
          <Button type="button" variant="outline" onClick={prev} className="w-full min-h-10 sm:w-auto">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} className="w-full min-h-10 sm:w-auto">Cancel</Button>
          )
        )}
      </div>
      <div>
        {step < REVIEW_STEP ? (
          <Button type="button" onClick={next} className="w-full sm:w-auto">
            {step === ATTACH_STEP - 1 ? 'Add files & remarks' : step === ATTACH_STEP ? 'Review & finish' : 'Next'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} loading={submitting} className="w-full sm:w-auto">
            <Send className="mr-1.5 h-4 w-4" />
            {existing ? 'Update feedback' : 'Submit feedback'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={topRef} className="relative mx-auto w-full max-w-6xl">
      {/* Submit-success overlay */}
      {successSub && (
        <div className="animate-fadeIn absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <svg className="h-20 w-20 drop-shadow-sm" viewBox="0 0 52 52" aria-hidden>
              <circle className="success-check-circle" cx="26" cy="26" r="24" fill="none" />
              <path className="success-check-mark" fill="none" d="M14.5 27l8 8 15-16.5" />
            </svg>
            <p className="mt-4 text-base font-bold text-gray-900">
              {existing ? 'Feedback updated!' : 'Feedback submitted!'}
            </p>
            <p className="mt-1 text-sm text-gray-500">Taking you to the submitted feedback…</p>
          </div>
        </div>
      )}

      {/* Progress header */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {form.shortTitle}
            </p>
            <h2 className="truncate text-lg font-bold text-gray-900">{schoolName || 'School Monitoring'}</h2>
          </div>
          <div className="text-right">
            <p key={answeredCount} className="animate-popIn text-2xl font-bold text-gray-900">
              {answeredCount}<span className="text-base font-medium text-gray-400">/{total}</span>
            </p>
            <p className="text-xs text-gray-500">
              {isQuestionStep ? `question ${Math.min(step, questionCount)} of ${questionCount}` : 'indicators rated'}
            </p>
          </div>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700 ease-out"
            style={{ width: `${answeredPct}%` }}
          >
            {answeredPct > 0 && answeredPct < 100 && (
              <span className="progress-bar-shimmer absolute inset-0" />
            )}
          </div>
        </div>
        {/* Section chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StepChip label="Details" active={step === HEADER_STEP} done={step > HEADER_STEP} onClick={() => goTo(HEADER_STEP)} />
          {form.sections.map((sec, i) => (
            <StepChip
              key={sec.number}
              label={sec.number}
              title={sec.title}
              active={!!currentQuestion && currentQuestion.sec.number === sec.number}
              done={step > (sectionStartStep.get(sec.number) ?? 0) && sectionAnswered(i)}
              onClick={() => goTo(sectionStartStep.get(sec.number) ?? FIRST_QUESTION_STEP)}
            />
          ))}
          <StepChip label="Files" active={step === ATTACH_STEP} done={step > ATTACH_STEP} onClick={() => goTo(ATTACH_STEP)} />
          <StepChip label="Review" active={step === REVIEW_STEP} done={false} onClick={() => goTo(REVIEW_STEP)} />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 animate-shake">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── One question at a time, with its feedback timeline beside it ── */}
      {currentQuestion ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div key={step} className={cn(cardCls, cardAnim)}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <span className="inline-flex max-w-[70%] items-center truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentQuestion.sec.number}. {currentQuestion.sec.title}</span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-gray-400">
                  Question {step} of {questionCount}
                </span>
              </div>

              <p className="mt-4 text-lg font-semibold leading-relaxed text-gray-900">
                <span className="mr-2 font-bold text-brand-600">{currentQuestion.ind.code}</span>
                {currentQuestion.ind.text}
              </p>

              {/* Result cards */}
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {RESULT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = currentAnswer!.result === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setResult(currentQuestion.ind.code, opt.value)}
                      className={cn(
                        'relative flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-3.5 transition-all duration-200 active:scale-[0.97] sm:py-4',
                        selected ? opt.selected : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      {selected && (
                        <span
                          className={cn(
                            'absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white animate-popIn',
                            opt.badge,
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', !selected && 'text-gray-400')} />
                      <span className="text-sm font-bold sm:text-base">{opt.shortLabel}</span>
                      <span className="hidden text-[11px] font-medium opacity-70 sm:block">{opt.subLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Comment */}
              <textarea
                value={currentAnswer!.comment}
                onChange={(e) => setComment(currentQuestion.ind.code, e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={
                  currentAnswer!.result === 'no'
                    ? `Explain why you rated "No" — required, minimum ${MIN_NO_COMMENT_LENGTH} characters…`
                    : 'Add a comment to give context (optional)…'
                }
                className={cn(
                  'mt-4 w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2',
                  commentInvalid
                    ? 'border-red-300 bg-red-50/60 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-200 bg-gray-50/50 focus:border-brand-500 focus:bg-white focus:ring-brand-500/20',
                )}
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                {currentAnswer!.result === 'no' ? (
                  <p className={cn('text-xs font-medium', commentInvalid ? 'text-red-600' : 'text-emerald-600')}>
                    {commentInvalid
                      ? `Comment required for "No" — ${commentShortBy} more character${commentShortBy === 1 ? '' : 's'} needed.`
                      : 'Comment meets the minimum length.'}
                  </p>
                ) : (
                  <span />
                )}
                <span className="ml-auto text-xs tabular-nums text-gray-400">
                  {currentAnswer!.comment.length}/2000
                </span>
              </div>
            </div>

            {/* Back / Next right under the question */}
            {nav}

            {/* Timeline — collapsible on mobile */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileHistoryOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4 text-brand-600" />
                  Previous feedback for this question
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {currentEntryCount}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform duration-300', mobileHistoryOpen && 'rotate-180')} />
                </span>
              </button>
              {mobileHistoryOpen && (
                <div className="animate-slideUp mt-2">
                  <QuestionFeedbackTimeline entries={currentEntries} loading={feedbackLoading} />
                </div>
              )}
            </div>
          </div>

          {/* Timeline — persistent side tree on desktop */}
          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <QuestionFeedbackTimeline entries={currentEntries} loading={feedbackLoading} />
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-800">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Build on what colleagues already observed — agree, clarify or add fresh evidence rather than repeating.</span>
            </div>
          </aside>
        </div>
      ) : (
        /* ── Details / attachments / review steps ── */
        <>
          <div key={step} className={cn(cardCls, 'mx-auto max-w-3xl', cardAnim)}>          {/* ── Header details ── */}
          {step === HEADER_STEP && (
            <div className="space-y-5">
              <StepTitle icon={ClipboardCheck} title="Observation details" subtitle="Basic information about this observation visit" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="observer">Observer&apos;s name</Label>
                  <Input id="observer" value={observerName} onChange={(e) => setObserverName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <Label htmlFor="date">Observation date</Label>
                  <Input id="date" type="date" value={observationDate} onChange={(e) => setObservationDate(e.target.value)} />
                </div>
                {form.hasTeacher && (
                  <div>
                    <Label htmlFor="teacher">Teacher&apos;s name</Label>
                    <Input id="teacher" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Name of the observed teacher" />
                  </div>
                )}
                {form.hasClass && (
                  <div className={cn(form.hasTeacher ? '' : 'sm:col-span-2')}>
                    <Label>Grade(s) observed</Label>
                    <GradeMultiSelect value={grades} onChange={setGrades} />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
                <p className="font-medium">{form.title}</p>
                <p className="mt-1 text-brand-700/80">{form.description}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-brand-700">
                  <Lightbulb className="h-3.5 w-3.5" />
                  You&apos;ll answer {total} questions one at a time, with previous feedback shown alongside.
                </p>
              </div>
            </div>
          )}

          {/* ── Attachments & remarks ── */}
          {step === ATTACH_STEP && (
            <div className="space-y-5">
              <StepTitle icon={UploadCloud} title="Photos & documents" subtitle="Attach supporting photos or files from your visit (optional)" />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/30"
              >
                <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700">Drag & drop files here, or</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <p className="mt-2 text-xs text-gray-400">Images, PDF, Word, Excel · up to 10MB each</p>
              </div>

              {attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attachments.map((a) => (
                    <div key={a.key} className="group relative overflow-hidden rounded-xl border border-gray-200">
                      <AttachmentThumb attachment={a} isImage={isImg(a)} />
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.key)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label htmlFor="remarks">General remarks</Label>
                <textarea
                  id="remarks"
                  value={generalRemarks}
                  onChange={(e) => setGeneralRemarks(e.target.value)}
                  rows={4}
                  placeholder="Overall summary, key findings or recommendations…"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          )}

          {/* ── Review ── */}
          {step === REVIEW_STEP && (
            <div className="space-y-5">
              <StepTitle icon={CheckCircle2} title="Review & submit" subtitle="Check your observation before submitting. Once submitted, it cannot be edited unless you have edit permission." />
              <div className="grid gap-3 sm:grid-cols-3">
                <ReviewStat label="Rated" value={`${answeredCount}/${total}`} />
                <ReviewStat label="Attachments" value={String(attachments.length)} />
                <ReviewStat label="Date" value={observationDate} />
              </div>
              {answeredCount < total && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{total - answeredCount} indicator(s) are still unrated. You can submit anyway, or go back to complete them.</span>
                </div>
              )}
              {missingComments.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {missingComments.length} &quot;No / Not Satisfied&quot; answer(s) need a comment of at least {MIN_NO_COMMENT_LENGTH} characters
                    before you can submit: {missingComments.join(', ')}.
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {form.sections.map((sec, i) => {
                  const yes = sec.indicators.filter((ind) => answers[ind.code].result === 'yes').length;
                  const no = sec.indicators.filter((ind) => answers[ind.code].result === 'no').length;
                  const na = sec.indicators.filter((ind) => answers[ind.code].result === 'na').length;
                  return (
                    <button
                      key={sec.number}
                      type="button"
                      onClick={() => goTo(sectionStartStep.get(sec.number) ?? FIRST_QUESTION_STEP)}
                      className="flex w-full flex-col items-start gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 break-words text-sm font-medium text-gray-800">{sec.number}. {sec.title}</span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{yes} Yes</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{no} No</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{na} N/A</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Back / Next right under the card */}
          {nav}
        </>
      )}
    </div>
  );
}

function StepChip({ label, title, active, done, onClick }: { label: string; title?: string; active: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : done
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
      )}
    >
      {done && !active ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {label}
    </button>
  );
}

function StepTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
      <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function GradeMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (grade: string) =>
    onChange(value.includes(grade) ? value.filter((g) => g !== grade) : [...value, grade]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <span className={cn('flex flex-1 flex-wrap items-center gap-1', value.length === 0 && 'text-gray-400')}>
          <GraduationCap className="h-4 w-4 shrink-0 text-gray-400" />
          {value.length === 0 ? (
            'Select grade(s)…'
          ) : (
            value.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                {g}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggle(g); }}
                  className="hover:text-brand-900"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown className={cn('ml-1 h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg animate-fadeIn">
          {MONITORING_GRADES.map((g) => {
            const selected = value.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggle(g.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selected ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded border',
                  selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300',
                )}>
                  {selected && <Check className="h-3 w-3" />}
                </span>
                {g.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
