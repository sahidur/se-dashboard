'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Check, X, MinusCircle,
  UploadCloud, FileText, Image as ImageIcon, Trash2, Send, AlertCircle, ClipboardCheck,
  ChevronDown, GraduationCap, ImageOff,
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
import type {
  MonitoringAnswer, MonitoringAttachment, MonitoringResult, MonitoringSubmission,
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

const RESULT_OPTIONS: { value: MonitoringResult; label: string; icon: React.ElementType; active: string; ring: string }[] = [
  { value: 'yes', label: 'Yes / Satisfied', icon: Check, active: 'bg-emerald-600 text-white border-emerald-600', ring: 'hover:border-emerald-400' },
  { value: 'no', label: 'No / Not Satisfied', icon: X, active: 'bg-red-600 text-white border-red-600', ring: 'hover:border-red-400' },
  { value: 'na', label: 'Not Applicable', icon: MinusCircle, active: 'bg-gray-500 text-white border-gray-500', ring: 'hover:border-gray-400' },
];

/** A "No / Not Satisfied" rating must be justified with a comment of at least this length. */
const MIN_NO_COMMENT_LENGTH = 50;

const needsComment = (a?: { result: MonitoringResult; comment: string }) =>
  a?.result === 'no' && a.comment.trim().length < MIN_NO_COMMENT_LENGTH;

export function MonitoringWizard({ form, schoolId, schoolName, existing, onSubmitted, onCancel }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Steps: 0 = header details, 1..N = sections, N+1 = attachments & remarks, N+2 = review
  const sectionCount = form.sections.length;
  const HEADER_STEP = 0;
  const FIRST_SECTION_STEP = 1;
  const ATTACH_STEP = sectionCount + 1;
  const REVIEW_STEP = sectionCount + 2;
  const TOTAL_STEPS = REVIEW_STEP + 1;

  const [step, setStep] = useState(HEADER_STEP);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
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

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const goTo = (target: number) => {
    setDirection(target > step ? 'fwd' : 'back');
    setStep(target);
    setError('');
    setTimeout(scrollTop, 0);
  };
  const currentSection = step >= FIRST_SECTION_STEP && step <= sectionCount
    ? form.sections[step - FIRST_SECTION_STEP]
    : null;

  const sectionMissingComments = (secIdx: number) =>
    form.sections[secIdx].indicators
      .filter((ind) => needsComment(answers[ind.code]))
      .map((ind) => ind.code);

  const next = () => {
    if (currentSection) {
      const missing = sectionMissingComments(step - FIRST_SECTION_STEP);
      if (missing.length) {
        setError(
          `Section ${currentSection.number}: a comment of at least ${MIN_NO_COMMENT_LENGTH} characters is required for every "No / Not Satisfied" answer (${missing.join(', ')}).`,
        );
        return;
      }
    }
    if (step < REVIEW_STEP) goTo(step + 1);
  };
  const prev = () => step > HEADER_STEP && goTo(step - 1);

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
      const firstIdx = form.sections.findIndex((sec) =>
        sec.indicators.some((ind) => missingComments.includes(ind.code)),
      );
      if (firstIdx >= 0) goTo(FIRST_SECTION_STEP + firstIdx);
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
      onSubmitted(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  const progressPct = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  const isImg = (a: MonitoringAttachment) =>
    a.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name);

  return (
    <div ref={topRef} className="mx-auto max-w-3xl">
      {/* Progress header */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {form.shortTitle}
            </p>
            <h2 className="text-lg font-bold text-gray-900">{schoolName || 'School Monitoring'}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{answeredCount}<span className="text-base font-medium text-gray-400">/{total}</span></p>
            <p className="text-xs text-gray-500">indicators rated</p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Step chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StepChip label="Details" active={step === HEADER_STEP} done={step > HEADER_STEP} onClick={() => goTo(HEADER_STEP)} />
          {form.sections.map((sec, i) => (
            <StepChip
              key={sec.number}
              label={sec.number}
              title={sec.title}
              active={step === FIRST_SECTION_STEP + i}
              done={step > FIRST_SECTION_STEP + i && sectionAnswered(i)}
              onClick={() => goTo(FIRST_SECTION_STEP + i)}
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

      {/* Animated step content */}
      <div
        key={step}
        className={cn(
          'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6',
          direction === 'fwd' ? 'animate-slideUp' : 'animate-fadeIn',
        )}
      >
        {/* ── Header details ── */}
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
            </div>
          </div>
        )}

        {/* ── Section indicators ── */}
        {currentSection && (
          <div className="space-y-4">
            <StepTitle
              icon={ClipboardCheck}
              title={`${currentSection.number}. ${currentSection.title}`}
              subtitle={`Section ${currentSection.number} of ${sectionCount} · ${currentSection.indicators.length} indicators`}
            />
            <div className="space-y-3">
              {currentSection.indicators.map((ind, idx) => {
                const a = answers[ind.code];
                const commentRequired = a.result === 'no';
                const shortBy = MIN_NO_COMMENT_LENGTH - a.comment.trim().length;
                const commentInvalid = commentRequired && shortBy > 0;
                return (
                  <div
                    key={ind.code}
                    className="rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300"
                    style={{ animation: `fadeIn 0.3s ease-out ${idx * 0.03}s both` }}
                  >
                    <div className="flex gap-2">
                      <span className="shrink-0 text-sm font-bold text-brand-600">{ind.code}</span>
                      <p className="text-sm text-gray-800">{ind.text}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {RESULT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const selected = a.result === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setResult(ind.code, opt.value)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                              selected ? opt.active : cn('border-gray-200 bg-white text-gray-600', opt.ring),
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={a.comment}
                      onChange={(e) => setComment(ind.code, e.target.value)}
                      placeholder={commentRequired ? `Explain why (required, minimum ${MIN_NO_COMMENT_LENGTH} characters)` : 'Add a comment (optional)'}
                      aria-invalid={commentInvalid}
                      className={cn(
                        'mt-2.5 w-full rounded-lg border px-3 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2',
                        commentInvalid
                          ? 'border-red-300 bg-red-50/60 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-gray-200 bg-gray-50/50 focus:border-brand-500 focus:ring-brand-500/20',
                      )}
                    />
                    {commentRequired && (
                      <p className={cn('mt-1 text-xs', commentInvalid ? 'text-red-600' : 'text-emerald-600')}>
                        {commentInvalid
                          ? `Comment is mandatory for "No / Not Satisfied" — ${shortBy} more character${shortBy === 1 ? '' : 's'} needed.`
                          : 'Comment meets the minimum length.'}
                      </p>
                    )}
                  </div>
                );
              })}
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
                    onClick={() => goTo(FIRST_SECTION_STEP + i)}
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

      {/* Navigation */}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {step > HEADER_STEP ? (
            <Button type="button" variant="outline" onClick={prev} className="w-full sm:w-auto">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          ) : (
            onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            )
          )}
        </div>
        <div>
          {step < REVIEW_STEP ? (
            <Button type="button" onClick={next}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} loading={submitting}>
              <Send className="mr-1.5 h-4 w-4" />
              {existing ? 'Update feedback' : 'Submit feedback'}
            </Button>
          )}
        </div>
      </div>
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
