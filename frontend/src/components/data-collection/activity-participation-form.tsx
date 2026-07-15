'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Library, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
  UploadCloud, Image as ImageIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { DcSchool, DcActivityParticipation } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const ITEMS = ['Corner Activity', 'Club Activity', 'Library Activity', 'Lab Activity'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GRADES = [
  'Play & Learn', 'Nursery', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10',
];

interface FormState {
  item: string;
  month: string;
  grade: string;
  activityName: string;
  photoUrl: string;
  photoKey: string;
  conductedCount: string;
}

const BLANK: FormState = {
  item: '', month: '', grade: '', activityName: '', photoUrl: '', photoKey: '', conductedCount: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function ActivityParticipationForm({ schoolId }: Props) {
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

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId]);

  const loadRecords = () => {
    api.get(`/data-collection/activity-participation/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  };

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const monthDisabled = !form.item;
  const gradeDisabled = !form.item || !form.month;
  const fieldsDisabled = !form.item || !form.month || !form.grade;

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
      item: rec.item, month: rec.month, grade: rec.grade,
      activityName: rec.activityName ?? '',
      photoUrl: rec.photoUrl ?? '', photoKey: rec.photoKey ?? '',
      conductedCount: String(rec.conductedCount ?? ''),
    });
    setEditingId(rec.id);
    setError('');
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
    if (!form.month) { setError('Please select a month.'); return; }
    if (!form.grade) { setError('Please select a grade.'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        schoolId,
        item: form.item,
        month: form.month,
        grade: form.grade,
        activityName: form.activityName || undefined,
        photoUrl: form.photoUrl || undefined,
        photoKey: form.photoKey || undefined,
        conductedCount: form.conductedCount !== '' ? Number(form.conductedCount) : 0,
      };
      await api.post('/data-collection/activity-participation', payload);
      showToast('success', `Activity data for ${form.month} / ${form.grade} saved.`);
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

  const groupedByItem = ITEMS.map((it) => ({
    item: it,
    rows: records.filter((r) => r.item === it),
  })).filter((g) => g.rows.length > 0);

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

      <div ref={formRef}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-amber-500" />
              {editingId ? 'Edit Activity Record' : 'Add Activity Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Select an item, month and grade, then record the activity details.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Item <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.item}
                    onChange={(e) => { set('item', e.target.value); set('month', ''); set('grade', ''); }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  >
                    <option value="">Select item…</option>
                    {ITEMS.map((it) => <option key={it} value={it}>{it}</option>)}
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
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
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

                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">Photo</Label>
                  {form.photoUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                      {brokenPhotoIds.has('preview') ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gray-100 text-gray-400">
                          <ImageIcon size={18} />
                        </div>
                      ) : (
                        <img
                          src={form.photoUrl}
                          alt="Activity"
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
                  <AlertCircle size={12} /> Please select an item, month and grade to enable input fields.
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving || fieldsDisabled || uploading} className="gap-2">
                  <Save size={15} />
                  {saving ? 'Saving…' : editingId ? 'Update Record' : 'Save Record'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {groupedByItem.map(({ item, rows }) => (
        <Card key={item} className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              {item}
              <Badge variant="default">{rows.length} record{rows.length > 1 ? 's' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Month</th>
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Grade</th>
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Activity/Books</th>
                    <th className="py-2 pr-3 text-center text-gray-500 uppercase tracking-wider font-semibold">Photo</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Conducted</th>
                    <th className="py-2 text-right text-gray-500 uppercase tracking-wider font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3 text-gray-700">{rec.month}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="default" className="text-amber-700 border-amber-200 bg-amber-50 font-medium">
                          {rec.grade}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700 max-w-[220px] truncate">{rec.activityName || '—'}</td>
                      <td className="py-2.5 pr-3 text-center">
                        {rec.photoUrl && !brokenPhotoIds.has(rec.id) ? (
                          <img
                            src={rec.photoUrl}
                            alt=""
                            className="inline-block h-8 w-8 rounded object-cover"
                            onError={() => setBrokenPhotoIds((prev) => new Set(prev).add(rec.id))}
                          />
                        ) : rec.photoUrl ? (
                          <ImageIcon size={16} className="inline-block text-gray-300" />
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-700 font-medium">{rec.conductedCount}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(rec)} className="h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(rec.id)} className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
