'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { Users, Save, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import type { DcStudentsInfo } from '@/types';

export default function StudentsInfoPage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [existing, setExisting] = useState<DcStudentsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    academicYear: '', totalStudentsBoys: 0, totalStudentsGirls: 0,
    newAdmissionsBoys: 0, newAdmissionsGirls: 0, dropoutsBoys: 0, dropoutsGirls: 0,
    attendanceRateBoys: 0, attendanceRateGirls: 0, scholarshipRecipients: 0,
    specialNeedsStudents: 0, transportUsers: 0, remarks: '',
  });

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    api.get(`/data-collection/students/school/${schoolId}`)
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            academicYear: data.academicYear || '', totalStudentsBoys: data.totalStudentsBoys || 0,
            totalStudentsGirls: data.totalStudentsGirls || 0, newAdmissionsBoys: data.newAdmissionsBoys || 0,
            newAdmissionsGirls: data.newAdmissionsGirls || 0, dropoutsBoys: data.dropoutsBoys || 0,
            dropoutsGirls: data.dropoutsGirls || 0, attendanceRateBoys: data.attendanceRateBoys || 0,
            attendanceRateGirls: data.attendanceRateGirls || 0, scholarshipRecipients: data.scholarshipRecipients || 0,
            specialNeedsStudents: data.specialNeedsStudents || 0, transportUsers: data.transportUsers || 0,
            remarks: data.remarks || '',
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
      await api.post('/data-collection/students', { ...form, schoolId });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      const { data } = await api.get(`/data-collection/students/school/${schoolId}`);
      if (data) setExisting(data);
    } catch (e: any) { alert(e?.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const numField = (label: string, key: string, suffix?: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input type="number" min="0" step={suffix ? '0.01' : '1'} value={(form as any)[key]}
          onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );

  const totalStudents = form.totalStudentsBoys + form.totalStudentsGirls;

  return (
    <>
      <Header title="Students Information" subtitle="Record student statistics for your school" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />
        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><Users size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to fill students information.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Users size={18} className="text-purple-500" />Students Information</CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Academic Year</label>
                  <input type="text" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="2025-2026" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="sm:col-span-2 rounded-xl bg-purple-50 p-4 flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{totalStudents}</p>
                    <p className="text-xs text-purple-500">Total Students</p>
                  </div>
                  <div className="h-8 w-px bg-purple-200" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-blue-600">{form.totalStudentsBoys}</p>
                    <p className="text-xs text-gray-500">Boys</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-pink-600">{form.totalStudentsGirls}</p>
                    <p className="text-xs text-gray-500">Girls</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">👦 Boys & 👧 Girls Statistics</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numField('Total Boys', 'totalStudentsBoys')}
                  {numField('Total Girls', 'totalStudentsGirls')}
                  {numField('New Admissions (Boys)', 'newAdmissionsBoys')}
                  {numField('New Admissions (Girls)', 'newAdmissionsGirls')}
                  {numField('Dropouts (Boys)', 'dropoutsBoys')}
                  {numField('Dropouts (Girls)', 'dropoutsGirls')}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">📊 Attendance & Others</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numField('Attendance Rate Boys', 'attendanceRateBoys', '%')}
                  {numField('Attendance Rate Girls', 'attendanceRateGirls', '%')}
                  {numField('Scholarship Recipients', 'scholarshipRecipients')}
                  {numField('Special Needs Students', 'specialNeedsStudents')}
                  {numField('Transport Users', 'transportUsers')}
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
