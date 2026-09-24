'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, UserCheck, School,
  MapPin, Users, RefreshCw, X, Plus, Trash2, ChevronDown,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { ExportButtons, exportPayloadFromColumns } from '@/components/data-collection/export-buttons';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
import { isValidAcademicYear } from '@/lib/utils';
import { useAcademicYearOptions } from '@/hooks/use-academic-year-options';
import type { DcSchool, DcAlumni } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

const OCCUPATION_OPTIONS = [
  'Teacher',
  'Engineer',
  'BCS Cadre',
  'Doctor',
  'Agriculturist',
  'Others',
];


interface AlumniFormState {
  academicYear: string;
  alumniName: string;
  graduationYear: number | '';
  presentAddress: string;
  currentOccupation: string;
  occupationOther: string;
  institution: string;
  contactPhone: string;
  contactEmail: string;
}

const BLANK_FORM: AlumniFormState = {
  academicYear: '',
  alumniName: '',
  graduationYear: '',
  presentAddress: '',
  currentOccupation: '',
  occupationOther: '',
  institution: '',
  contactPhone: '',
  contactEmail: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function AlumniForm({ schoolId }: Props) {
  const YEAR_OPTIONS = useAcademicYearOptions();
  const router = useRouter();
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'alumni'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<AlumniFormState>(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AlumniFormState, string>>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [records, setRecords] = useState<DcAlumni[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<AlumniFormState>('alumni-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`)
      .then(({ data }) => setSchool(data))
      .catch(() => router.push('/data-collection/schools'));
  }, [schoolId, router]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const { data } = await api.get<DcAlumni[]>(`/data-collection/alumni/school/${schoolId}`);
      setRecords(data);
    } catch {
      showToast('error', 'Failed to load alumni records');
      setRecords([]);
    } finally { setLoadingRecords(false); }
  }, [schoolId, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Overlay the user's private draft (an in-progress unsubmitted new entry),
  // if any, once the existing records have loaded.
  useEffect(() => {
    if (loadingRecords || draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        setForm(d);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRecords]);

  const handleSaveDraft = async () => {
    await draft.saveDraft(form);
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(BLANK_FORM);
  };

  const setField = <K extends keyof AlumniFormState>(key: K, value: AlumniFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof AlumniFormState, string>> = {};
    if (!form.academicYear) errs.academicYear = 'Please select an academic year.';
    if (!form.alumniName.trim()) errs.alumniName = 'Name is required.';
    if (form.contactPhone && !/^\+?[\d\s\-()]{6,20}$/.test(form.contactPhone)) errs.contactPhone = 'Invalid phone number.';
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) errs.contactEmail = 'Invalid email address.';
    if (form.currentOccupation === 'Others' && !form.occupationOther.trim()) errs.occupationOther = 'Please specify occupation.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setForm(BLANK_FORM);
    setEditingId(null);
    setError('');
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.academicYear) {
      setError('Please select an academic year.');
      setFieldErrors((prev) => ({ ...prev, academicYear: 'Please select an academic year.' }));
      return;
    }
    if (!isValidAcademicYear(form.academicYear)) {
      setError('Please select a valid academic year (1970-2100).');
      setFieldErrors((prev) => ({ ...prev, academicYear: 'Invalid year' }));
      return;
    }
    if (!validate()) return;
    setSaving(true);
    setError('');

    const finalOccupation = form.currentOccupation === 'Others'
      ? form.occupationOther.trim()
      : form.currentOccupation;

    const payload = {
      schoolId,
      academicYear: Number(form.academicYear),
      alumniName: form.alumniName.trim(),
      graduationYear: form.graduationYear !== '' ? Number(form.graduationYear) : undefined,
      presentAddress: form.presentAddress.trim() || undefined,
      currentOccupation: finalOccupation || undefined,
      institution: form.institution.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
    };

    try {
      if (editingId) {
        await api.patch(`/data-collection/alumni/${editingId}`, payload);
        showToast('success', 'Alumni record updated successfully!');
      } else {
        await api.post('/data-collection/alumni', payload);
        showToast('success', 'Alumni record added successfully!');
      }
      await draft.clearDraft();
      resetForm();
      await loadRecords();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: DcAlumni) => {
    const knownOccupations = OCCUPATION_OPTIONS.filter((o) => o !== 'Others');
    const isKnown = knownOccupations.includes(record.currentOccupation ?? '');
    setForm({
      academicYear: record.academicYear ? String(record.academicYear) : '',
      alumniName: record.alumniName,
      graduationYear: record.graduationYear ?? '',
      presentAddress: record.presentAddress ?? '',
      currentOccupation: isKnown ? (record.currentOccupation ?? '') : record.currentOccupation ? 'Others' : '',
      occupationOther: isKnown ? '' : (record.currentOccupation ?? ''),
      institution: record.institution ?? '',
      contactPhone: record.contactPhone ?? '',
      contactEmail: record.contactEmail ?? '',
    });
    setEditingId(record.id);
    setError('');
    setFieldErrors({});
    setTab('entry');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alumni record? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/data-collection/alumni/${id}`);
      showToast('success', 'Alumni record deleted and moved to recycle bin.');
      await loadRecords();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to delete record.'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const alumniColumns: TableColumn<DcAlumni>[] = [
    { key: 'academicYear', header: 'Academic Year', sortable: true },
    { key: 'alumniName', header: 'Name', sortable: true, render: (r) => <span className="font-semibold text-gray-800 whitespace-nowrap">{r.alumniName}</span> },
    { key: 'graduationYear', header: 'Passing Year', render: (r) => (
      r.graduationYear ? (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{r.graduationYear}</span>
      ) : <span className="text-gray-300">—</span>
    )},
    { key: 'presentAddress', header: 'Present Address', render: (r) => <p className="line-clamp-2 text-xs max-w-[160px]">{r.presentAddress || <span className="text-gray-300">—</span>}</p> },
    { key: 'currentOccupation', header: 'Occupation', render: (r) => (
      r.currentOccupation ? (
        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap">{r.currentOccupation}</span>
      ) : <span className="text-gray-300">—</span>
    )},
    { key: 'institution', header: 'Institute', render: (r) => <p className="truncate text-xs max-w-[150px]">{r.institution || <span className="text-gray-300">—</span>}</p> },
    { key: 'contactPhone', header: 'Mobile', render: (r) => <span className="text-xs font-mono">{r.contactPhone || <span className="text-gray-300">—</span>}</span> },
    { key: 'contactEmail', header: 'Email', render: (r) => <p className="truncate text-xs max-w-[140px]">{r.contactEmail || <span className="text-gray-300">—</span>}</p> },
    { key: 'createdAt', header: 'Added', render: (r) => <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(r.createdAt)}</span> },
  ];

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex min-w-[280px] max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="flex-1 text-sm font-medium">{toast.msg}</p>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── School Info Card ── */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
              <UserCheck size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {school.code}</span>
                {school.district && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {school.district}</span>}
                {school.schoolCategory && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users size={12} /> {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                  </span>
                )}
              </div>
            </div>
            <Badge variant={records.length > 0 ? 'success' : 'default'} className="gap-1 shrink-0">
              {records.length > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {records.length} Alumni
            </Badge>
          </div>
        </CardContent>
      </Card>

      <FormTabs active={tab} onChange={setTab} dataCount={records.length} />

      {/* ── Entry Form ── */}
      {tab === 'entry' && (
      <div ref={formRef}>
        <form onSubmit={handleSubmit}>
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-800">
                    {editingId ? 'Edit Alumni Record' : 'Add New Alumni'}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">
                    You can add alumni records at any time in any quantity.
                  </p>
                </div>
                {editingId && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-xs text-gray-500">
                    <X size={13} /> Cancel Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Row 1: Academic Year + Name + Passing Year */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      value={form.academicYear}
                      onChange={(e) => setField('academicYear', e.target.value)}
                      className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${fieldErrors.academicYear ? 'border-red-400' : 'border-gray-200'}`}
                    >
                      <option value="">Select academic year...</option>
                      {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                  </div>
                  {fieldErrors.academicYear && <p className="mt-1 text-xs text-red-500">{fieldErrors.academicYear}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                    Name of Student <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.alumniName}
                    onChange={(e) => setField('alumniName', e.target.value)}
                    placeholder="Full name"
                    className={fieldErrors.alumniName ? 'border-red-400 focus:ring-red-300' : ''}
                  />
                  {fieldErrors.alumniName && <p className="mt-1 text-xs text-red-500">{fieldErrors.alumniName}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Passing Year from School</Label>
                  <div className="relative">
                    <select
                      value={form.graduationYear}
                      onChange={(e) => setField('graduationYear', e.target.value ? Number(e.target.value) : '')}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="">Select year...</option>
                      {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Row 2: Present Address */}
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">Present Address</Label>
                <Input
                  value={form.presentAddress}
                  onChange={(e) => setField('presentAddress', e.target.value)}
                  placeholder="Current residential address"
                />
              </div>

              {/* Row 3: Occupation */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Present Occupation</Label>
                  <div className="relative">
                    <select
                      value={form.currentOccupation}
                      onChange={(e) => setField('currentOccupation', e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="">Select occupation...</option>
                      {OCCUPATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
                  </div>
                </div>
                {form.currentOccupation === 'Others' && (
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                      Specify Occupation <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.occupationOther}
                      onChange={(e) => setField('occupationOther', e.target.value)}
                      placeholder="e.g. Business, Artist, Journalist..."
                      className={fieldErrors.occupationOther ? 'border-red-400 focus:ring-red-300' : ''}
                      autoFocus
                    />
                    {fieldErrors.occupationOther && <p className="mt-1 text-xs text-red-500">{fieldErrors.occupationOther}</p>}
                  </div>
                )}
              </div>

              {/* Row 4: Institute */}
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-gray-600">Institute Name</Label>
                <Input
                  value={form.institution}
                  onChange={(e) => setField('institution', e.target.value)}
                  placeholder="Current workplace or educational institute"
                />
              </div>

              {/* Row 5: Phone + Email */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Mobile No.</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => setField('contactPhone', e.target.value)}
                    placeholder="e.g. 01700000000"
                    className={fieldErrors.contactPhone ? 'border-red-400 focus:ring-red-300' : ''}
                  />
                  {fieldErrors.contactPhone && <p className="mt-1 text-xs text-red-500">{fieldErrors.contactPhone}</p>}
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Email (optional)</Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setField('contactEmail', e.target.value)}
                    placeholder="alumni@example.com"
                    className={fieldErrors.contactEmail ? 'border-red-400 focus:ring-red-300' : ''}
                  />
                  {fieldErrors.contactEmail && <p className="mt-1 text-xs text-red-500">{fieldErrors.contactEmail}</p>}
                </div>
              </div>

              {/* Submit */}
              {editingId ? (
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="gap-2 bg-slate-600 hover:bg-slate-700 text-white"
                  >
                    {saving
                      ? <><RefreshCw size={15} className="animate-spin" /> Saving...</>
                      : <><Save size={15} /> Update Record</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="gap-1.5 text-xs">
                    <X size={13} /> Cancel
                  </Button>
                </div>
              ) : (
                <div className="pt-2 border-t border-gray-100">
                  <DraftActionBar
                    hasDraft={draft.hasDraft}
                    draftSavedAt={draft.draftSavedAt}
                    submitting={saving}
                    onSaveDraft={handleSaveDraft}
                    onClearDraft={handleClearDraft}
                    submitLabel="Add Alumni"
                    submittingLabel="Saving..."
                  />
                  {!editingId && records.length > 0 && (
                    <span className="mt-2 block text-xs text-gray-400">
                      {records.length} alumni record{records.length !== 1 ? 's' : ''} submitted
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </div>
      )}

      {/* ── Records Table ── */}
      {tab === 'data' && (
      <DataTable<DcAlumni>
        columns={alumniColumns}
        data={records}
        loading={loadingRecords}
        searchable
        searchPlaceholder="Search by name, occupation..."
        title="Alumni Records"
        titleIcon={<UserCheck size={18} />}
        badge={<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{records.length}</span>}
        emptyMessage="No alumni records yet."
        emptyIcon={<UserCheck size={40} className="mb-3 opacity-20" />}
        onRefresh={loadRecords}
        refreshing={loadingRecords}
        headerExtra={
          <ExportButtons
            payload={exportPayloadFromColumns(
              alumniColumns,
              records,
              'alumni-information',
              {
                createdAt: (v) =>
                  v ? new Date(String(v)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
              },
            )}
          />
        }
        actions={(r) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!canEditSubmitted) { showToast('error', 'You do not have permission to edit submitted data'); return; }
                handleEdit(r);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canDeleteSubmitted) { showToast('error', 'You do not have permission to delete submitted data'); return; }
                handleDelete(r.id);
              }}
              disabled={deletingId === r.id}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-red-400 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete"
            >
              {deletingId === r.id
                ? <RefreshCw size={12} className="animate-spin" />
                : <Trash2 size={12} />}
            </button>
          </div>
        )}
      />
      )}
    </div>
  );
}
