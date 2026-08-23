'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2, PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DraftActionBar } from '@/components/data-collection/draft-action-bar';
import { FormTabs } from '@/components/data-collection/form-tabs';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcSchool, DcEventParticipation } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const YEARS = buildYearOptions();

const EVENT_NAMES = [
  'Sports Competition', 'Cultural Competition', 'Science Fair',
  'Debate Competition', 'Quiz Competition', 'Art Competition', 'Others',
];

const AWARD_LEVELS = ['Upazila', 'Zila', 'National'];

interface FormState {
  academicYear: string;
  eventName: string;
  awardLevel: string;
  maleAwarded: string;
  femaleAwarded: string;
  othersAwarded: string;
}

const BLANK: FormState = {
  academicYear: '', eventName: '', awardLevel: '', maleAwarded: '', femaleAwarded: '', othersAwarded: '',
};

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function EventParticipationForm({ schoolId }: Props) {
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcEventParticipation[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<FormState>('event-participation-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
  }, [schoolId]);

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/event-participation/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

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
  };

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const totalPreview =
    (Number(form.maleAwarded) || 0) + (Number(form.femaleAwarded) || 0) + (Number(form.othersAwarded) || 0);

  const fieldsDisabled = !form.academicYear;

  const resetForm = () => {
    setForm(BLANK);
    setEditingId(null);
    setError('');
  };

  const handleEdit = (rec: DcEventParticipation) => {
    setForm({
      academicYear: rec.academicYear ? String(rec.academicYear) : '',
      eventName: rec.eventName,
      awardLevel: rec.awardLevel,
      maleAwarded: String(rec.maleAwarded ?? ''),
      femaleAwarded: String(rec.femaleAwarded ?? ''),
      othersAwarded: String(rec.othersAwarded ?? ''),
    });
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event participation record?')) return;
    try {
      await api.delete(`/data-collection/event-participation/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch {
      showToast('error', 'Failed to delete record.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.academicYear) { setError('Please select an academic year.'); return; }
    if (!form.eventName) { setError('Please select an event name.'); return; }
    if (!form.awardLevel) { setError('Please select an award level.'); return; }

    setSaving(true);
    try {
      const payload = {
        schoolId,
        academicYear: Number(form.academicYear),
        eventName: form.eventName,
        awardLevel: form.awardLevel,
        maleAwarded: form.maleAwarded !== '' ? Number(form.maleAwarded) : 0,
        femaleAwarded: form.femaleAwarded !== '' ? Number(form.femaleAwarded) : 0,
        othersAwarded: form.othersAwarded !== '' ? Number(form.othersAwarded) : 0,
      };
      if (editingId) {
        await api.patch(`/data-collection/event-participation/${editingId}`, payload);
        showToast('success', 'Event participation record updated.');
      } else {
        await api.post('/data-collection/event-participation', payload);
        showToast('success', 'Event participation record saved.');
      }
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow">
                <Award size={22} />
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
              <PlusCircle size={18} className="text-rose-500" />
              {editingId ? 'Edit Event Participation Record' : 'Add Event Participation Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Record events the school participated in and the awards achieved.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => { set('academicYear', e.target.value); set('eventName', ''); set('awardLevel', ''); }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400"
                  >
                    <option value="">Select academic year…</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Name of Event <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.eventName}
                    onChange={(e) => set('eventName', e.target.value)}
                    disabled={fieldsDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select event…</option>
                    {EVENT_NAMES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Award Achieved <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={form.awardLevel}
                    onChange={(e) => set('awardLevel', e.target.value)}
                    disabled={fieldsDisabled}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select level…</option>
                    {AWARD_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-gray-700">No. of Students Awarded</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label className="mb-1 block text-xs text-gray-500">Male</Label>
                    <Input type="number" min={0} disabled={fieldsDisabled} value={form.maleAwarded} onChange={(e) => set('maleAwarded', e.target.value)} placeholder="0" className="h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-gray-500">Female</Label>
                    <Input type="number" min={0} disabled={fieldsDisabled} value={form.femaleAwarded} onChange={(e) => set('femaleAwarded', e.target.value)} placeholder="0" className="h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-gray-500">Others</Label>
                    <Input type="number" min={0} disabled={fieldsDisabled} value={form.othersAwarded} onChange={(e) => set('othersAwarded', e.target.value)} placeholder="0" className="h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-gray-500">Total</Label>
                    <div className="flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                      {totalPreview}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                {editingId ? (
                  <>
                    <Button type="submit" disabled={saving || fieldsDisabled} className="gap-2">
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
                      disabled={fieldsDisabled}
                    />
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>

      {tab === 'data' && records.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              Event Participation Records
              <Badge variant="default">{records.length} record{records.length > 1 ? 's' : ''}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Academic Year</th>
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Event</th>
                    <th className="py-2 pr-3 text-left text-gray-500 uppercase tracking-wider font-semibold">Award Level</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Male</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Female</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Others</th>
                    <th className="py-2 pr-3 text-right text-gray-500 uppercase tracking-wider font-semibold">Total</th>
                    <th className="py-2 text-right text-gray-500 uppercase tracking-wider font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3 text-gray-700 font-medium">{rec.academicYear ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-gray-700">{rec.eventName}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="default" className="text-rose-700 border-rose-200 bg-rose-50 font-medium">
                          {rec.awardLevel}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-700">{rec.maleAwarded}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-700">{rec.femaleAwarded}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-700">{rec.othersAwarded}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-900 font-semibold">{rec.totalAwarded}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" disabled={!canEditSubmitted} onClick={() => handleEdit(rec)} title={canEditSubmitted ? undefined : 'You do not have permission to edit submitted data'} className="h-6 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed">
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
      )}

      {tab === 'data' && records.length === 0 && (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-14 text-gray-400">
            <Award size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No event participation records yet.</p>
            <p className="text-xs mt-1 opacity-70">Use the Fill Form tab to add the first record.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
