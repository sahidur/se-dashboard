'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import {
  Library, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
  UploadCloud, Image as ImageIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { useFormDraft } from '@/hooks/use-form-draft';
import { getGradeDisplayName } from '@/components/data-collection/student-performance-catalog';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { buildYearOptions, resolveAssetUrl, isValidAcademicYear } from '@/lib/utils';
import type { DcSchool, DcActivityParticipation } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const ITEMS = [
  'Corner activity',
  'Language & Literacy club',
  'Nature & Environment club',
  'Music club',
  'Creative club',
  'Science & Technology club',
  'Science lab',
  'ICT lab',
  'Agriculture lab',
  'Use of library',
];

const YEARS = buildYearOptions();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GRADES = [
  'Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10',
];

interface FormState {
  item: string;
  year: string;
  month: string;
  grade: string;
  activityName: string;
  photoUrl: string;
  photoKey: string;
  conductedCount: string;
  participationRate: string;
}

const BLANK: FormState = {
  item: '', year: '', month: '', grade: '', activityName: '', photoUrl: '', photoKey: '', conductedCount: '', participationRate: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function ActivityParticipationForm({ schoolId }: Props) {
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcActivityParticipation[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draft = useFormDraft<FormState>('activity-participation-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  // Memoized so its identity is stable across renders (prevents repeated effects).
  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/activity-participation/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId, loadRecords]);

  // Overlay the user's private draft (an in-progress unsubmitted new entry).
  useEffect(() => {
    if (draftAppliedRef.current) return;
    (async () => {
      const d = await draft.loadDraft();
      if (d) {
        draftAppliedRef.current = true;
        setForm(d);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveDraft = async () => {
    await draft.saveDraft(form);
  };

  const handleClearDraft = async () => {
    await draft.clearDraft();
    setForm(BLANK);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const yearDisabled = !form.item;
  const monthDisabled = !form.item || !form.year;
  const gradeDisabled = !form.item || !form.year || !form.month;
  const fieldsDisabled = !form.item || !form.year || !form.month || !form.grade;

  const resetForm = () => {
    setForm(BLANK);
    setEditingId(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/files/upload?folder=activity-participation', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set('photoUrl', data.url);
      set('photoKey', data.key);
      setBrokenPhotoIds((prev) => { const next = new Set(prev); next.delete('preview'); return next; });
      showToast('success', 'Photo uploaded.');
    } catch {
      showToast('error', 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    set('photoUrl', '');
    set('photoKey', '');
    setBrokenPhotoIds((prev) => { const next = new Set(prev); next.delete('preview'); return next; });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (rec: DcActivityParticipation) => {
    setForm({
      item: rec.item, year: rec.year ? String(rec.year) : '', month: rec.month, grade: rec.grade,
      activityName: rec.activityName ?? '',
      photoUrl: rec.photoUrl ?? '', photoKey: rec.photoKey ?? '',
      conductedCount: String(rec.conductedCount ?? ''),
      participationRate: rec.participationRate != null ? String(rec.participationRate) : '',
    });
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this activity participation record?')) return;
    try {
      await api.delete(`/data-collection/activity-participation/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch {
      showToast('error', 'Failed to delete record.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.item) { setError('Please select an item.'); return; }
    if (!form.year) { setError('Please select a year.'); return; }
    if (!isValidAcademicYear(form.year)) { setError('Please select a valid academic year (1970-2100).'); return; }
    if (!form.month) { setError('Please select a month.'); return; }
    if (!form.grade) { setError('Please select a grade.'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        schoolId,
        item: form.item,
        year: Number(form.year),
        month: form.month,
        grade: form.grade,
        activityName: form.activityName || undefined,
        photoUrl: form.photoUrl || undefined,
        photoKey: form.photoKey || undefined,
        conductedCount: form.conductedCount !== '' ? Number(form.conductedCount) : 0,
        participationRate: form.participationRate !== '' ? Number(form.participationRate) : undefined,
      };
      await api.post('/data-collection/activity-participation', payload);
      showToast('success', `Activity data for ${form.month} ${form.year} / ${form.grade} saved.`);
      await draft.clearDraft();
      resetForm();
      loadRecords();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      showToast('error', Array.isArray(msg) ? msg[0] : (msg || 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
    brac_academy: 'BRAC Academy', brac_primary: 'BRAC Primary', brac_secondary: 'BRAC Secondary',
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {school && (
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow">
                <Library size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{school.name}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><School size={12} />{school.code}</span>
                  {school.address && <span className="flex items-center gap-1"><MapPin size={12} />{school.address}</span>}
                  {school.schoolCategory && (
                    <Badge variant="default" className="text-xs">
                      {SCHOOL_CATEGORY_LABELS[school.schoolCategory] ?? school.schoolCategory}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <FormTabs active={tab} onChange={setTab} dataCount={records.length} />

      <div ref={formRef}>
        {tab === 'entry' && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-amber-500" />
              {editingId ? 'Edit Activity Record' : 'Add Activity Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Select an item, year, month and grade, then record the activity details.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Item <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.item}
                    onChange={(e) => { set('item', e.target.value); set('year', ''); set('month', ''); set('grade', ''); }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  >
                    <option value="">Select item…</option>
                    {ITEMS.map((it) => <option key={it} value={it}>{it}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Year <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.year}
                    onChange={(e) => { set('year', e.target.value); set('month', ''); set('grade', ''); }}
                    disabled={yearDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select year…</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Month <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.month}
                    onChange={(e) => { set('month', e.target.value); set('grade', ''); }}
                    disabled={monthDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select month…</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                    disabled={gradeDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select grade…</option>
                    {GRADES.map((g) => <option key={g} value={g}>{getGradeDisplayName(g, school?.schoolCategory)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Name of Activity / Books
                  </Label>
                  <textarea
                    value={form.activityName}
                    onChange={(e) => set('activityName', e.target.value)}
                    disabled={fieldsDisabled}
                    rows={3}
                    placeholder="Describe the activity or list the books used…"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    How Many Times Conducted
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={fieldsDisabled}
                    value={form.conductedCount}
                    onChange={(e) => set('conductedCount', e.target.value)}
                    placeholder="0"
                    className="disabled:opacity-50 mb-4"
                  />

                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    % of Students Participated
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    disabled={fieldsDisabled}
                    value={form.participationRate}
                    onChange={(e) => set('participationRate', e.target.value)}
                    placeholder="0"
                    className="disabled:opacity-50 mb-4"
                  />

                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">Photo</Label>
                  {form.photoUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                      {brokenPhotoIds.has('preview') ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gray-100 text-gray-400">
                          <ImageIcon size={18} />
                        </div>
                      ) : (
                        <NextImage
                          src={resolveAssetUrl(form.photoUrl)}
                          alt="Activity"
                          width={56}
                          height={56}
                          unoptimized
                          className="h-14 w-14 rounded-md object-cover"
                          onError={() => setBrokenPhotoIds((prev) => new Set(prev).add('preview'))}
                        />
                      )}
                      <span className="flex-1 truncate text-xs text-gray-500">Photo uploaded</span>
                      <Button type="button" size="sm" variant="ghost" onClick={removePhoto} className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 cursor-pointer hover:bg-gray-50 ${fieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {uploading ? <UploadCloud size={16} className="animate-pulse" /> : <ImageIcon size={16} />}
                      {uploading ? 'Uploading…' : 'Upload photo'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        disabled={fieldsDisabled || uploading}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {fieldsDisabled && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle size={12} /> Please select an item, year, month and grade to enable input fields.
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                {editingId ? (
                  <>
                    <Button type="submit" disabled={saving || fieldsDisabled || uploading} className="gap-2">
                      <Save size={15} />
                      {saving ? 'Saving…' : 'Update Record'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  </>
                ) : (
                  <div className="w-full">
                    <DraftActionBar
                      hasDraft={draft.hasDraft}
                      draftSavedAt={draft.draftSavedAt}
                      submitting={saving}
                      onSaveDraft={handleSaveDraft}
                      onClearDraft={handleClearDraft}
                      submitLabel="Save Record"
                      submittingLabel="Saving…"
                      disabled={fieldsDisabled || uploading}
                    />
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>

      {tab === 'data' && (
        records.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-14 text-gray-400">
              <Library size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No activity participation records yet.</p>
              <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add the first record.</p>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={[
              { key: 'item', header: 'Item', className: 'font-medium text-gray-700' },
              { key: 'year', header: 'Year' },
              { key: 'month', header: 'Month' },
              {
                key: 'grade',
                header: 'Grade',
                render: (rec) => (
                  <Badge variant="default" className="text-amber-700 border-amber-200 bg-amber-50 font-medium">
                    {getGradeDisplayName(rec.grade, school?.schoolCategory)}
                  </Badge>
                ),
              },
              { key: 'activityName', header: 'Activity/Books', className: 'max-w-[220px] truncate' },
              {
                key: 'photoUrl',
                header: 'Photo',
                className: 'text-center',
                render: (rec) => (
                  rec.photoUrl && !brokenPhotoIds.has(rec.id) ? (
                    <NextImage
                      src={resolveAssetUrl(rec.photoUrl)}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="inline-block h-8 w-8 rounded object-cover"
                      onError={() => setBrokenPhotoIds((prev) => new Set(prev).add(rec.id))}
                    />
                  ) : rec.photoUrl ? (
                    <ImageIcon size={16} className="inline-block text-gray-300" />
                  ) : <span className="text-gray-400">—</span>
                ),
              },
              { key: 'conductedCount', header: 'Conducted', className: 'text-right font-medium text-gray-700' },
            ]}
            data={records}
            searchable
            searchPlaceholder="Search records..."
            title="Activity Participation Records"
            emptyMessage="No activity participation records yet."
            emptyIcon={<Library size={40} className="mb-3 opacity-20" />}
            actions={(rec) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={!canEditSubmitted} onClick={() => handleEdit(rec)} title={canEditSubmitted ? undefined : 'You do not have permission to edit submitted data'} className="h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(rec.id)} className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 size={12} />
                </Button>
              </div>
            )}
          />
        )
      )}
    </div>
  );
}
