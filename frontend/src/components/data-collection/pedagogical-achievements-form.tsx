'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Trophy, School, MapPin, Save, Trash2, AlertCircle, CheckCircle2,
  ChevronDown, PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { DcSchool } from '@/types';

/* ─── Types ──────────────────────────────────────────────── */

interface AchievementRecord {
  id: string;
  year: number;
  kgScholarship: number;
  kgUniqueApproach: string;
  primaryScholarship: number;
  primaryUniqueApproach: string;
  jrScholarship: number;
  jrUniqueApproach: string;
  sscScholarship: number;
  sscUniqueApproach: string;
  othersScholarship: number;
  othersUniqueApproach: string;
  createdAt: string;
}

interface FormState {
  year: string;
  kgScholarship: string;
  kgUniqueApproach: string;
  primaryScholarship: string;
  primaryUniqueApproach: string;
  jrScholarship: string;
  jrUniqueApproach: string;
  sscScholarship: string;
  sscUniqueApproach: string;
  othersScholarship: string;
  othersUniqueApproach: string;
}

const BLANK: FormState = {
  year: '',
  kgScholarship: '', kgUniqueApproach: '',
  primaryScholarship: '', primaryUniqueApproach: '',
  jrScholarship: '', jrUniqueApproach: '',
  sscScholarship: '', sscUniqueApproach: '',
  othersScholarship: '', othersUniqueApproach: '',
};

/* ─── Year options: 1990 → 3000 ─────────────────────────── */
const ALL_YEARS: number[] = [];
for (let y = 3000; y >= 1990; y--) ALL_YEARS.push(y);

/* ─── Scholarship segments ───────────────────────────────── */
const SEGMENTS = [
  { key: 'kg',      countKey: 'kgScholarship',       approachKey: 'kgUniqueApproach',       label: 'KG Scholarship' },
  { key: 'primary', countKey: 'primaryScholarship',   approachKey: 'primaryUniqueApproach',   label: 'Primary Scholarship' },
  { key: 'jr',      countKey: 'jrScholarship',        approachKey: 'jrUniqueApproach',        label: 'Jr. Scholarship' },
  { key: 'ssc',     countKey: 'sscScholarship',       approachKey: 'sscUniqueApproach',       label: 'SSC' },
  { key: 'others',  countKey: 'othersScholarship',    approachKey: 'othersUniqueApproach',    label: 'Others' },
] as const;

interface Props { schoolId: string }

/* ─── Component ─────────────────────────────────────────── */

export function PedagogicalAchievementsForm({ schoolId }: Props) {
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<AchievementRecord[]>([]);
  const [form, setForm] = useState<FormState>(BLANK);
  const [yearSearch, setYearSearch] = useState('');
  const [yearOpen, setYearOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const yearDropRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
    loadRecords();
  }, [schoolId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (yearDropRef.current && !yearDropRef.current.contains(e.target as Node)) setYearOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadRecords = () => {
    api.get(`/data-collection/pedagogical-achievements/school/${schoolId}`)
      .then(({ data }) => setRecords(data))
      .catch(() => {});
  };

  const filteredYears = yearSearch
    ? ALL_YEARS.filter((y) => String(y).includes(yearSearch))
    : ALL_YEARS;

  const set = (key: keyof FormState, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const resetForm = () => {
    setForm(BLANK);
    setYearSearch('');
    setEditingId(null);
    setError('');
  };

  const handleEdit = (rec: AchievementRecord) => {
    setForm({
      year: String(rec.year),
      kgScholarship: String(rec.kgScholarship || ''),
      kgUniqueApproach: rec.kgUniqueApproach || '',
      primaryScholarship: String(rec.primaryScholarship || ''),
      primaryUniqueApproach: rec.primaryUniqueApproach || '',
      jrScholarship: String(rec.jrScholarship || ''),
      jrUniqueApproach: rec.jrUniqueApproach || '',
      sscScholarship: String(rec.sscScholarship || ''),
      sscUniqueApproach: rec.sscUniqueApproach || '',
      othersScholarship: String(rec.othersScholarship || ''),
      othersUniqueApproach: rec.othersUniqueApproach || '',
    });
    setYearSearch('');
    setEditingId(rec.id);
    setError('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this achievement record?')) return;
    try {
      await api.delete(`/data-collection/pedagogical-achievements/${id}`);
      showToast('success', 'Record deleted.');
      loadRecords();
    } catch {
      showToast('error', 'Failed to delete record.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.year) { setError('Please select a year.'); return; }

    setSaving(true);
    try {
      await api.post('/data-collection/pedagogical-achievements', {
        schoolId,
        year: Number(form.year),
        kgScholarship: form.kgScholarship ? Number(form.kgScholarship) : 0,
        kgUniqueApproach: form.kgUniqueApproach || undefined,
        primaryScholarship: form.primaryScholarship ? Number(form.primaryScholarship) : 0,
        primaryUniqueApproach: form.primaryUniqueApproach || undefined,
        jrScholarship: form.jrScholarship ? Number(form.jrScholarship) : 0,
        jrUniqueApproach: form.jrUniqueApproach || undefined,
        sscScholarship: form.sscScholarship ? Number(form.sscScholarship) : 0,
        sscUniqueApproach: form.sscUniqueApproach || undefined,
        othersScholarship: form.othersScholarship ? Number(form.othersScholarship) : 0,
        othersUniqueApproach: form.othersUniqueApproach || undefined,
      });
      showToast('success', `Achievement data for ${form.year} saved.`);
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
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-indigo-700" />
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

      {/* Entry Form */}
      <div ref={formRef}>
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-400 to-purple-500" />
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
                              onClick={() => { set('year', String(y)); setYearOpen(false); setYearSearch(''); }}
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
              </div>

              {/* Scholarship Segments */}
              <div className="space-y-5">
                <p className="text-sm font-medium text-gray-700">Number of Students Awarded in Scholarship</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SEGMENTS.map(({ key, countKey, approachKey, label }) => (
                    <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-400" />
                        <span className="text-sm font-semibold text-gray-800">{label}</span>
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">No. of Students</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form[countKey as keyof FormState]}
                          onChange={(e) => set(countKey as keyof FormState, e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">Unique Approach</Label>
                        <textarea
                          rows={2}
                          value={form[approachKey as keyof FormState]}
                          onChange={(e) => set(approachKey as keyof FormState, e.target.value)}
                          placeholder="Describe unique approach…"
                          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                      </div>
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
                <Button type="submit" disabled={saving} className="gap-2">
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

      {/* Records Table */}
      {records.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-300 to-purple-400" />
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-base font-semibold text-gray-800">
              Recorded Achievements
              <Badge variant="default" className="ml-2">{records.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">KG</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jr.</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">SSC</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Others</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((rec, idx) => {
                    const total = rec.kgScholarship + rec.primaryScholarship + rec.jrScholarship + rec.sscScholarship + rec.othersScholarship;
                    return (
                      <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 text-gray-400">{idx + 1}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="default" className="font-mono text-indigo-700 border-indigo-200 bg-indigo-50">
                            {rec.year}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-700">{rec.kgScholarship}</td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-700">{rec.primaryScholarship}</td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-700">{rec.jrScholarship}</td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-700">{rec.sscScholarship}</td>
                        <td className="py-3 pr-4 text-right font-medium text-gray-700">{rec.othersScholarship}</td>
                        <td className="py-3 pr-4 text-right">
                          <Badge variant="default" className="font-semibold">{total}</Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(rec)} className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(rec.id)} className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
