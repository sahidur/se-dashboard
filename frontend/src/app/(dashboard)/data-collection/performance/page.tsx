'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { TrendingUp, Save, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcPerformance } from '@/types';

const YEAR_OPTIONS = buildYearOptions();

const EMPTY_FORM = {
  avgPassRate: 0, avgGpa: 0, boardExamPassRate: 0, boardExamAvgGpa: 0,
  extracurricularActivities: '', sportsAchievements: '', culturalActivities: '',
  scienceFairParticipation: 0, debateCompetitions: 0, totalAwards: 0,
  teachingMethodology: '', remarks: '',
};

export default function PerformancePage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [existing, setExisting] = useState<DcPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (!schoolId || !academicYear) return;
    setLoading(true);
    api.get(`/data-collection/performance/school/${schoolId}`, { params: { academicYear } })
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            avgPassRate: data.avgPassRate || 0,
            avgGpa: data.avgGpa || 0, boardExamPassRate: data.boardExamPassRate || 0,
            boardExamAvgGpa: data.boardExamAvgGpa || 0,
            extracurricularActivities: data.extracurricularActivities || '',
            sportsAchievements: data.sportsAchievements || '',
            culturalActivities: data.culturalActivities || '',
            scienceFairParticipation: data.scienceFairParticipation || 0,
            debateCompetitions: data.debateCompetitions || 0,
            totalAwards: data.totalAwards || 0,
            teachingMethodology: data.teachingMethodology || '',
            remarks: data.remarks || '',
          });
        } else {
          setExisting(null);
          setForm({ ...EMPTY_FORM });
        }
      })
      .catch(() => { setExisting(null); setForm({ ...EMPTY_FORM }); })
      .finally(() => setLoading(false));
  }, [schoolId, academicYear]);

  const handleSubmit = async () => {
    if (!schoolId || !academicYear) return;
    setSaving(true);
    try {
      await api.post('/data-collection/performance', { ...form, schoolId, academicYear: Number(academicYear) });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      const { data } = await api.get(`/data-collection/performance/school/${schoolId}`, { params: { academicYear } });
      if (data) setExisting(data);
    } catch (e: any) { alert(e?.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const numField = (label: string, key: string, step = '1') => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input type="number" min="0" step={step} value={(form as any)[key]}
        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );

  const textArea = (label: string, key: string, placeholder: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <textarea rows={2} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );

  return (
    <>
      <Header title="Pedagogical Performance" subtitle="Academic performance and achievements" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />
        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><TrendingUp size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to fill performance data.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><TrendingUp size={18} className="text-rose-500" />Performance Data</CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{form.avgPassRate}%</p>
                  <p className="text-xs text-blue-500">Pass Rate</p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{form.avgGpa}</p>
                  <p className="text-xs text-green-500">Avg GPA</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600">{form.boardExamPassRate}%</p>
                  <p className="text-xs text-purple-500">Board Pass %</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{form.totalAwards}</p>
                  <p className="text-xs text-amber-500">Awards</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">📊 Academic Results</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {numField('Average Pass Rate (%)', 'avgPassRate', '0.01')}
                  {numField('Average GPA', 'avgGpa', '0.01')}
                  {numField('Board Exam Pass Rate (%)', 'boardExamPassRate', '0.01')}
                  {numField('Board Exam Avg GPA', 'boardExamAvgGpa', '0.01')}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">🏆 Activities & Achievements</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  {numField('Science Fair Participation', 'scienceFairParticipation')}
                  {numField('Debate Competitions', 'debateCompetitions')}
                  {numField('Total Awards', 'totalAwards')}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {textArea('Extracurricular Activities', 'extracurricularActivities', 'List activities...')}
                {textArea('Sports Achievements', 'sportsAchievements', 'Sports achievements...')}
                {textArea('Cultural Activities', 'culturalActivities', 'Cultural programs...')}
                {textArea('Teaching Methodology', 'teachingMethodology', 'Methodology used...')}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                <textarea rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4">
                {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 size={16} /> Saved!</span>}
                <Button onClick={handleSubmit} loading={saving} className="min-w-[140px]"><Save size={16} className="mr-1.5" />{existing ? 'Update' : 'Submit'}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
