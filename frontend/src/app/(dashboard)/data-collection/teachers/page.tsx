'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { GraduationCap, Save, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { DcTeachersInfo } from '@/types';

export default function TeachersInfoPage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [existing, setExisting] = useState<DcTeachersInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    totalTeachersMale: 0, totalTeachersFemale: 0, permanentTeachers: 0,
    contractTeachers: 0, trainedTeachers: 0, untrainedTeachers: 0,
    avgExperienceYears: 0, teacherStudentRatio: '', vacantPositions: 0,
    teachersWithBEd: 0, teachersWithMEd: 0, remarks: '',
  });

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    api.get(`/data-collection/teachers/school/${schoolId}`)
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            totalTeachersMale: data.totalTeachersMale || 0, totalTeachersFemale: data.totalTeachersFemale || 0,
            permanentTeachers: data.permanentTeachers || 0, contractTeachers: data.contractTeachers || 0,
            trainedTeachers: data.trainedTeachers || 0, untrainedTeachers: data.untrainedTeachers || 0,
            avgExperienceYears: data.avgExperienceYears || 0, teacherStudentRatio: data.teacherStudentRatio || '',
            vacantPositions: data.vacantPositions || 0, teachersWithBEd: data.teachersWithBEd || 0,
            teachersWithMEd: data.teachersWithMEd || 0, remarks: data.remarks || '',
          });
        } else setExisting(null);
      })
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSubmit = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      await api.post('/data-collection/teachers', { ...form, schoolId });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      const { data } = await api.get(`/data-collection/teachers/school/${schoolId}`);
      if (data) setExisting(data);
    } catch (e) { alert(getErrorMessage(e, 'Error')); } finally { setSaving(false); }
  };

  const numField = (label: string, key: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input type="number" min="0" step="0.1" value={(form as any)[key]}
        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );

  const totalTeachers = form.totalTeachersMale + form.totalTeachersFemale;

  return (
    <>
      <Header title="Teachers Information" subtitle="Record teacher statistics for your school" />
      <div className="p-4 sm:p-6 lg:p-8">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />
        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><GraduationCap size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to fill teachers data.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><GraduationCap size={18} className="text-orange-500" />Teachers Information</CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="rounded-xl bg-orange-50 p-4 flex flex-wrap items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{totalTeachers}</p>
                  <p className="text-xs text-orange-500">Total Teachers</p>
                </div>
                <div className="h-8 w-px bg-orange-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-blue-600">{form.totalTeachersMale}</p>
                  <p className="text-xs text-gray-500">Male</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-pink-600">{form.totalTeachersFemale}</p>
                  <p className="text-xs text-gray-500">Female</p>
                </div>
                <div className="h-8 w-px bg-orange-200" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-600">{form.trainedTeachers}</p>
                  <p className="text-xs text-gray-500">Trained</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-red-500">{form.vacantPositions}</p>
                  <p className="text-xs text-gray-500">Vacant</p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">👨‍🏫 Teacher Count</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numField('Male Teachers', 'totalTeachersMale')}
                  {numField('Female Teachers', 'totalTeachersFemale')}
                  {numField('Permanent', 'permanentTeachers')}
                  {numField('Contractual', 'contractTeachers')}
                  {numField('Trained', 'trainedTeachers')}
                  {numField('Untrained', 'untrainedTeachers')}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">📋 Qualifications & Experience</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numField('Teachers with B.Ed', 'teachersWithBEd')}
                  {numField('Teachers with M.Ed', 'teachersWithMEd')}
                  {numField('Avg Experience (years)', 'avgExperienceYears')}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Teacher-Student Ratio</label>
                    <input type="text" value={form.teacherStudentRatio} onChange={(e) => setForm({ ...form, teacherStudentRatio: e.target.value })} placeholder="e.g. 1:30" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  {numField('Vacant Positions', 'vacantPositions')}
                </div>
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
