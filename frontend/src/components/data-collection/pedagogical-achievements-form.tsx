'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2,
  ChevronDown, PlusCircle,
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
import { buildYearOptions, isValidAcademicYear } from '@/lib/utils';
import api, { getErrorMessage } from '@/lib/api';
import type { DcSchool } from '@/types';

/* ─── Types ──────────────────────────────────────────────── */

interface AchievementRecord {
  id: string;
  year: number;
  kgParticipated: number;
  kgScholarship: number;
  primaryParticipated: number;
  primaryScholarship: number;
  jrParticipated: number;
  jrScholarship: number;
  sscParticipated: number;
  sscScholarship: number;
  sscAPlus: number;
  othersParticipated: number;
  othersScholarship: number;
  talentGrantParticipated: number;
  talentGrantAwarded: number;
  createdAt: string;
}

interface FormState {
  year: string;
  kgParticipated: string;
  kgScholarship: string;
  primaryParticipated: string;
  primaryScholarship: string;
  jrParticipated: string;
  jrScholarship: string;
  sscParticipated: string;
  sscScholarship: string;
  sscAPlus: string;
  othersParticipated: string;
  othersScholarship: string;
  talentGrantParticipated: string;
  talentGrantAwarded: string;
}

const BLANK: FormState = {
  year: '',
  kgParticipated: '', kgScholarship: '',
  primaryParticipated: '', primaryScholarship: '',
  jrParticipated: '', jrScholarship: '',
  sscParticipated: '', sscScholarship: '', sscAPlus: '',
  othersParticipated: '', othersScholarship: '',
  talentGrantParticipated: '', talentGrantAwarded: '',
};

/* ─── Year options: current year first, then upcoming, then past ── */
const ALL_YEARS = buildYearOptions();

/* ─── Scholarship segments ───────────────────────────────── */
const SEGMENTS = [
  { key: 'talentGrant', participatedKey: 'talentGrantParticipated', awardedKey: 'talentGrantAwarded', label: 'Sir Fazle Hasan Abed Talent Grants' },
  { key: 'kg',      participatedKey: 'kgParticipated',      awardedKey: 'kgScholarship',      label: 'KG Scholarship' },
  { key: 'primary', participatedKey: 'primaryParticipated', awardedKey: 'primaryScholarship', label: 'Primary Scholarship' },
  { key: 'jr',      participatedKey: 'jrParticipated',      awardedKey: 'jrScholarship',      label: 'Jr. Scholarship' },
  { key: 'ssc',     participatedKey: 'sscParticipated',     awardedKey: 'sscScholarship',     label: 'SSC' },
  { key: 'others',  participatedKey: 'othersParticipated',  awardedKey: 'othersScholarship',  label: 'Others' },
] as const;

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function PedagogicalAchievementsForm({ schoolId }: Props) {
  const canEditSubmitted = useAuthStore((s) => s.hasPermission('data-collection-edit', 'update'));
  const canDeleteSubmitted = useAuthStore((s) => s.hasPermission('data-collection', 'delete', 'pedagogical-achievements'));
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<AchievementRecord[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [yearSearch, setYearSearch] = useState('');
  const [yearOpen, setYearOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** id of the record matching the selected year (existing data loaded) */
  const [existingMatch, setExistingMatch] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const yearDropRef = useRef<HTMLDivElement>(null);
  const draft = useFormDraft<FormState>('pedagogical-achievements-entry', schoolId);
  const draftAppliedRef = useRef(false);
  const [tab, setTab] = useState<'entry' | 'data'>('entry');

  // Memoized so it can safely appear in dependency arrays (a fresh identity
  // every render here once caused an infinite GET loop + error-toast storm).
  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadRecords = useCallback(() => {
    api.get(`/data-collection/pedagogical-achievements/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => showToast('error', 'Failed to load achievement records'));
  }, [schoolId, showToast]);

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`)
      .then(({ data }) => setSchool(data))
      .catch(() => showToast('error', 'Failed to load school data'));
    loadRecords();
  }, [schoolId, loadRecords, showToast]);

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
    setYearSearch('');
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (yearDropRef.current && !yearDropRef.current.contains(e.target as Node)) setYearOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredYears = yearSearch
    ? ALL_YEARS.filter((y) => String(y).includes(yearSearch))
    : ALL_YEARS;

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  /**
   * Populate the entry form from an already-submitted record when the user
   * selects an Academic Year. Previously submitted values must appear instead
   * of blank inputs; POST upserts on (schoolId, year), so submitting updates.
   */
  const handleYearSelect = (year: number) => {
    const match = records.find((r) => Number(r.year) === Number(year));
    if (match) {
      setForm({
        year: String(match.year),
        kgParticipated: String(match.kgParticipated ?? ''),
        kgScholarship: String(match.kgScholarship ?? ''),
        primaryParticipated: String(match.primaryParticipated ?? ''),
        primaryScholarship: String(match.primaryScholarship ?? ''),
        jrParticipated: String(match.jrParticipated ?? ''),
        jrScholarship: String(match.jrScholarship ?? ''),
        sscParticipated: String(match.sscParticipated ?? ''),
        sscScholarship: String(match.sscScholarship ?? ''),
        sscAPlus: String(match.sscAPlus ?? ''),
        othersParticipated: String(match.othersParticipated ?? ''),
        othersScholarship: String(match.othersScholarship ?? ''),
        talentGrantParticipated: String(match.talentGrantParticipated ?? ''),
        talentGrantAwarded: String(match.talentGrantAwarded ?? ''),
      });
      setExistingMatch(match.id);
    } else {
      setForm({ ...BLANK, year: String(year) });
      setExistingMatch(null);
    }
  };

  const resetForm = () => {
    setForm(BLANK);
    setYearSearch('');
    setEditingId(null);
    setExistingMatch(null);
    setError('');
  };

  const handleEdit = (rec: AchievementRecord) => {
    setForm({
      year: String(rec.year),
      kgParticipated: String(rec.kgParticipated || ''),
      kgScholarship: String(rec.kgScholarship || ''),
      primaryParticipated: String(rec.primaryParticipated || ''),
      primaryScholarship: String(rec.primaryScholarship || ''),
      jrParticipated: String(rec.jrParticipated || ''),
      jrScholarship: String(rec.jrScholarship || ''),
      sscParticipated: String(rec.sscParticipated || ''),
      sscScholarship: String(rec.sscScholarship || ''),
      sscAPlus: String(rec.sscAPlus || ''),
      othersParticipated: String(rec.othersParticipated || ''),
      othersScholarship: String(rec.othersScholarship || ''),
      talentGrantParticipated: String(rec.talentGrantParticipated || ''),
      talentGrantAwarded: String(rec.talentGrantAwarded || ''),
    });
    setYearSearch('');
    setEditingId(rec.id);
    setError('');
    setTab('entry');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this achievement record?')) return;
    try {
      await api.delete(`/data-collection/pedagogical-achievements/${id}`);
      showToast('success', 'Record deleted and moved to recycle bin.');
      loadRecords();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to delete record.'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.year) { setError('Please select a year.'); return; }
    if (!isValidAcademicYear(form.year)) { setError('Please select a valid academic year (1970-2100).'); return; }

    setSaving(true);
    try {
      await api.post('/data-collection/pedagogical-achievements', {
        schoolId,
        year: Number(form.year),
        kgParticipated: form.kgParticipated ? Number(form.kgParticipated) : 0,
        kgScholarship: form.kgScholarship ? Number(form.kgScholarship) : 0,
        primaryParticipated: form.primaryParticipated ? Number(form.primaryParticipated) : 0,
        primaryScholarship: form.primaryScholarship ? Number(form.primaryScholarship) : 0,
        jrParticipated: form.jrParticipated ? Number(form.jrParticipated) : 0,
        jrScholarship: form.jrScholarship ? Number(form.jrScholarship) : 0,
        sscParticipated: form.sscParticipated ? Number(form.sscParticipated) : 0,
        sscScholarship: form.sscScholarship ? Number(form.sscScholarship) : 0,
        sscAPlus: form.sscAPlus ? Number(form.sscAPlus) : 0,
        othersParticipated: form.othersParticipated ? Number(form.othersParticipated) : 0,
        othersScholarship: form.othersScholarship ? Number(form.othersScholarship) : 0,
        talentGrantParticipated: form.talentGrantParticipated ? Number(form.talentGrantParticipated) : 0,
        talentGrantAwarded: form.talentGrantAwarded ? Number(form.talentGrantAwarded) : 0,
      });
      showToast('success', `Achievement data for ${form.year} saved.`);
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

  const achievementColumns: TableColumn<AchievementRecord>[] = [
    { key: 'year', header: 'Year', sortable: true, render: (rec) => (
      <Badge variant="default" className="font-mono text-indigo-700 border-indigo-200 bg-indigo-50">{rec.year}</Badge>
    )},
    { key: 'talentGrantAwarded', header: 'Talent Grants', className: 'text-right', render: (rec) => (
      <span className="font-medium">{rec.talentGrantAwarded}<span className="text-xs font-normal text-gray-400"> / {rec.talentGrantParticipated ?? 0}</span></span>
    )},
    { key: 'kgScholarship', header: 'KG', className: 'text-right', render: (rec) => (
      <span className="font-medium">{rec.kgScholarship}<span className="text-xs font-normal text-gray-400"> / {rec.kgParticipated ?? 0}</span></span>
    )},
    { key: 'primaryScholarship', header: 'Primary', className: 'text-right', render: (rec) => (
      <span className="font-medium">{rec.primaryScholarship}<span className="text-xs font-normal text-gray-400"> / {rec.primaryParticipated ?? 0}</span></span>
    )},
    { key: 'jrScholarship', header: 'Jr.', className: 'text-right', render: (rec) => (
      <span className="font-medium">{rec.jrScholarship}<span className="text-xs font-normal text-gray-400"> / {rec.jrParticipated ?? 0}</span></span>
    )},
    ...(school?.schoolCategory !== 'brac_academy' ? [{
      key: 'sscScholarship' as const, header: 'SSC', className: 'text-right', render: (rec: AchievementRecord) => (
        <span className="font-medium">
          {rec.sscScholarship}<span className="text-xs font-normal text-gray-400"> / {rec.sscParticipated ?? 0}</span>
          <span className="ml-1.5 text-xs font-normal text-indigo-500">A+ {rec.sscAPlus ?? 0}</span>
        </span>
      ),
    }] : []),
    { key: 'othersScholarship', header: 'Others', className: 'text-right', render: (rec) => (
      <span className="font-medium">{rec.othersScholarship}<span className="text-xs font-normal text-gray-400"> / {rec.othersParticipated ?? 0}</span></span>
    )},
    { key: 'total', header: 'Total', className: 'text-right', render: (rec) => {
      const total = rec.kgScholarship + rec.primaryScholarship + rec.jrScholarship + rec.sscScholarship + rec.othersScholarship + rec.talentGrantAwarded;
      return <Badge variant="default" className="font-semibold">{total}</Badge>;
    }},
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* School Info */}
      {school && (
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow">
                <Trophy size={22} />
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

      {/* Entry Form */}
      {tab === 'entry' && (
      <div ref={formRef}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <PlusCircle size={18} className="text-indigo-500" />
              {editingId ? 'Edit Achievement Record' : 'Add Achievement Record'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter the number of students awarded in each scholarship category for the selected year.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Year selector */}
              <div className="max-w-xs">
                <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <div className="relative" ref={yearDropRef}>
                  <button
                    type="button"
                    onClick={() => setYearOpen((v) => !v)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm
                      bg-white text-left shadow-sm transition focus:outline-none
                      ${form.year ? 'border-indigo-400 text-gray-900' : 'border-gray-300 text-gray-400'}`}
                  >
                    <span>{form.year || 'Select year…'}</span>
                    <ChevronDown size={16} className={`transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {yearOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="p-2">
                        <input
                          autoFocus
                          type="text"
                          value={yearSearch}
                          onChange={(e) => setYearSearch(e.target.value)}
                          placeholder="Search year…"
                          className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                        {filteredYears.slice(0, 100).map((y) => (
                          <li key={y}>
                            <button
                              type="button"
                              onClick={() => { handleYearSelect(y); setYearOpen(false); setYearSearch(''); setError(''); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition
                                ${form.year === String(y) ? 'bg-indigo-100 font-semibold text-indigo-700' : 'text-gray-700'}`}
                            >
                              {y}
                            </button>
                          </li>
                        ))}
                        {filteredYears.length === 0 && (
                          <li className="px-3 py-3 text-sm text-gray-400 text-center">No results</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                {existingMatch && !editingId && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700">
                    Existing record for {form.year} loaded — submitting will update it.
                  </div>
                )}
              </div>

              {/* Scholarship Segments */}
              <div className="space-y-5">
                <p className="text-sm font-medium text-gray-700">Number of Students Participated &amp; Awarded in Scholarship</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SEGMENTS
                    .filter(({ key }) => key !== 'ssc' || school?.schoolCategory !== 'brac_academy')
                    .map(({ key, participatedKey, awardedKey, label }) => (
                    <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-400" />
                        <span className="text-sm font-semibold text-gray-800">{label}</span>
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">Number of Students Participated</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form[participatedKey]}
                          onChange={(e) => set(participatedKey, e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">Number of Students Awarded</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form[awardedKey]}
                          onChange={(e) => set(awardedKey, e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm"
                        />
                      </div>
                      {key === 'ssc' && (
                        <div>
                          <Label className="mb-1 block text-xs text-gray-500">Number of Students Obtained A+</Label>
                          <Input
                            type="number"
                            min={0}
                            value={form.sscAPlus}
                            onChange={(e) => set('sscAPlus', e.target.value)}
                            placeholder="0"
                            className="h-9 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
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
                    <Button type="submit" disabled={saving} className="gap-2">
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
                    />
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      )}

      {tab === 'data' && (
        <DataTable<AchievementRecord>
          columns={achievementColumns}
          data={records}
          searchable
          searchPlaceholder="Search by year..."
          title="Recorded Achievements"
          titleIcon={<Trophy size={18} />}
          badge={<Badge variant="default" className="ml-2">{records.length}</Badge>}
          headerExtra={
            <ExportButtons
              payload={exportPayloadFromColumns(achievementColumns, records, 'pedagogical-achievements', {
                kgScholarship: (v, rec) => `${Number(v)} of ${Number((rec as any).kgParticipated ?? 0)}`,
                primaryScholarship: (v, rec) => `${Number(v)} of ${Number((rec as any).primaryParticipated ?? 0)}`,
                jrScholarship: (v, rec) => `${Number(v)} of ${Number((rec as any).jrParticipated ?? 0)}`,
                sscScholarship: (v, rec) => `${Number(v)} of ${Number((rec as any).sscParticipated ?? 0)} (A+ ${Number((rec as any).sscAPlus ?? 0)})`,
                othersScholarship: (v, rec) => `${Number(v)} of ${Number((rec as any).othersParticipated ?? 0)}`,
                talentGrantAwarded: (v, rec) => `${Number(v)} of ${Number((rec as any).talentGrantParticipated ?? 0)}`,
                total: (_v, rec) =>
                  Number(rec.kgScholarship) + Number(rec.primaryScholarship) + Number(rec.jrScholarship)
                  + Number(rec.sscScholarship) + Number(rec.othersScholarship) + Number(rec.talentGrantAwarded),
              })}
            />
          }
          emptyMessage="No achievement records yet."
          emptyIcon={<Trophy size={40} className="mb-3 opacity-20" />}
          actions={(rec) => (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!canEditSubmitted) { showToast('error', 'You do not have permission to edit submitted data'); return; }
                  handleEdit(rec);
                }}
                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!canDeleteSubmitted) { showToast('error', 'You do not have permission to delete submitted data'); return; }
                  handleDelete(rec.id);
                }}
                className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          )}
        />
      )}
    </div>
  );
}
