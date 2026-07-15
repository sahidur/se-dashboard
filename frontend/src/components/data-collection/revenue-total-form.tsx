'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, CheckCircle2, AlertCircle, Banknote, School,
  MapPin, Users, RefreshCw, X, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { DcSchool, DcRevenueTotalRecord } from '@/types';

/* ─── Constants ──────────────────────────────────────────── */

const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

const FEE_ROWS: { key: string; label: string; hint?: string }[] = [
  { key: 'admissionFee',  label: 'Admission Fee' },
  { key: 'sessionFee',    label: 'Session Fee' },
  { key: 'assessmentFee', label: 'Assessment Fee' },
  { key: 'sportsFee',     label: 'Sports Fee' },
  { key: 'syllabusFee',   label: 'Syllabus Fee' },
  { key: 'testimonialFee',label: 'Testimonial Fee' },
  { key: 'othersFee',     label: 'Others Fee', hint: 'Badge, Tie, Diary, ID card, Shoulder' },
  { key: 'transportFee',  label: 'Transport Fee' },
];

type RevenueFormState = {
  totalStudentsTarget: number;
} & Record<string, number>;

function buildBlank(): RevenueFormState {
  const f: RevenueFormState = { totalStudentsTarget: 0 };
  FEE_ROWS.forEach(({ key }) => {
    f[`${key}Target`] = 0;
    f[`${key}Achievement`] = 0;
  });
  return f;
}

function calcPct(target: number, achievement: number): string {
  if (!target) return '—';
  return (Math.min((achievement / target) * 100, 9999.99)).toFixed(1) + '%';
}

interface Props { schoolId: string; mode: 'budget' | 'actual' }

/* ─── Component ─────────────────────────────────────────── */

export function RevenueTotalForm({ schoolId, mode }: Props) {
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [form, setForm] = useState<RevenueFormState>(buildBlank());
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [record, setRecord] = useState<DcRevenueTotalRecord | null>(null);

  const endpoint = mode === 'budget' ? '/data-collection/revenue/budget/total' : '/data-collection/revenue/actual/total';
  const getEndpoint = `${endpoint}/school/${schoolId}`;
  const accentColor = mode === 'budget' ? 'orange' : 'yellow';
  const accentClasses = mode === 'budget'
    ? { bar: 'from-orange-500 to-orange-600', btn: 'bg-orange-600 hover:bg-orange-700', badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-300' }
    : { bar: 'from-yellow-500 to-yellow-600', btn: 'bg-yellow-600 hover:bg-yellow-700', badge: 'bg-yellow-100 text-yellow-700', ring: 'ring-yellow-300' };

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

  const loadRecord = useCallback(async () => {
    try {
      const { data } = await api.get<DcRevenueTotalRecord>(getEndpoint);
      if (data) {
        const f = buildBlank();
        f.totalStudentsTarget = Number(data.totalStudentsTarget) || 0;
        FEE_ROWS.forEach(({ key }) => {
          f[`${key}Target`] = Number((data as unknown as Record<string, number>)[`${key}Target`]) || 0;
          f[`${key}Achievement`] = Number((data as unknown as Record<string, number>)[`${key}Achievement`]) || 0;
        });
        setForm(f);
        setRecord(data);
        setIsEditing(true);
      }
    } catch { /* no data yet */ }
  }, [getEndpoint]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  const setField = (k: string, v: number) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<DcRevenueTotalRecord>(endpoint, { schoolId, ...form });
      setRecord(data);
      setIsEditing(true);
      showToast('success', `Revenue ${mode === 'budget' ? 'budget' : 'actual'} data saved successfully!`);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const msg = anyErr?.response?.data?.message ?? 'Failed to save.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (n: number) => new Intl.NumberFormat('en-BD').format(Number(n) || 0);
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  if (!school) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className={`h-12 w-12 animate-spin rounded-full border-4 border-${accentColor}-200 border-t-${accentColor}-600`} />
      </div>
    );
  }

  const totalTarget = FEE_ROWS.reduce((s, { key }) => s + (form[`${key}Target`] || 0), 0);
  const totalAchievement = FEE_ROWS.reduce((s, { key }) => s + (form[`${key}Achievement`] || 0), 0);

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex min-w-[280px] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-2 fade-in duration-300 ${
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="flex-1 text-sm font-medium">{toast.msg}</p>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* ── School Info ── */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accentClasses.bar} text-white shadow-md`}>
              <Banknote size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{school.name}</h2>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><School size={12} /> {school.code}</span>
                {school.district && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {school.district}</span>}
              </div>
            </div>
            <Badge variant={isEditing ? 'success' : 'default'} className="gap-1">
              {isEditing ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {isEditing ? 'Data Saved' : 'Not Submitted'}
            </Badge>
          </div>
          {isEditing && record && (
            <p className="mt-3 text-xs text-gray-400">
              Last updated: {formatDateTime(record.updatedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold text-gray-800">
              Revenue Collection — {mode === 'budget' ? 'Budget' : 'Actual Student'} (Yearly)
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">
              Enter yearly targets first. After year-end, fill in achievements — the system will auto-calculate % collection.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Total students */}
            <div className="max-w-xs">
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">Total Students (Yearly Target)</Label>
              <Input
                type="number"
                min={0}
                value={form.totalStudentsTarget}
                onChange={(e) => setField('totalStudentsTarget', Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            {/* Fee rows */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-48">Fee Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Revenue Target (Yearly) — BDT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Revenue Achievement (Yearly) — BDT</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 w-28">% Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {FEE_ROWS.map(({ key, label, hint }, idx) => {
                    const target = form[`${key}Target`] || 0;
                    const achievement = form[`${key}Achievement`] || 0;
                    const pct = target > 0 ? (achievement / target) * 100 : 0;
                    const pctLabel = calcPct(target, achievement);
                    const pctColor = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : target > 0 ? 'text-red-500' : 'text-gray-400';
                    return (
                      <tr key={key} className={idx % 2 === 0 ? 'bg-white' : `bg-${accentColor}-50/20`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-sm">{label}</p>
                          {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            value={form[`${key}Target`]}
                            onChange={(e) => setField(`${key}Target`, Number(e.target.value) || 0)}
                            placeholder="BDT"
                            className="max-w-[180px]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            value={form[`${key}Achievement`]}
                            onChange={(e) => setField(`${key}Achievement`, Number(e.target.value) || 0)}
                            placeholder="BDT"
                            className="max-w-[180px]"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="space-y-1">
                            <p className={`text-sm font-bold ${pctColor}`}>{pctLabel}</p>
                            {target > 0 && (
                              <div className="h-1.5 w-full rounded-full bg-gray-100">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 border-${accentColor}-200 bg-${accentColor}-50/40 font-bold`}>
                    <td className="px-4 py-3 text-sm text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(totalTarget)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">{formatAmount(totalAchievement)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${
                        totalTarget > 0 && (totalAchievement / totalTarget) >= 1 ? 'text-emerald-600' :
                        totalTarget > 0 && (totalAchievement / totalTarget) >= 0.7 ? 'text-amber-600' :
                        totalTarget > 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {calcPct(totalTarget, totalAchievement)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving} className={`gap-2 text-white ${accentClasses.btn}`}>
                {saving ? <><RefreshCw size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> {isEditing ? 'Update' : 'Save'} Revenue Data</>}
              </Button>
              {isEditing && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <TrendingUp size={14} />
                  Overall {calcPct(totalTarget, totalAchievement)} achieved
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
