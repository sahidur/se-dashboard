'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { FileText, Save, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { buildYearOptions } from '@/lib/utils';
import type { DcBasicInfo } from '@/types';

const YEAR_OPTIONS = buildYearOptions();

const EMPTY_FORM = {
  schoolCategory: '',
  mediumOfInstruction: '',
  shiftSystem: '',
  hasPlayground: false,
  hasLibrary: false,
  hasComputerLab: false,
  hasScienceLab: false,
  hasElectricity: false,
  hasInternet: false,
  hasDrinkingWater: false,
  hasSanitaryFacilities: false,
  totalClassrooms: 0,
  operationalClassrooms: 0,
  additionalNotes: '',
};

export default function BasicInfoPage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [existing, setExisting] = useState<DcBasicInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (!schoolId || !academicYear) return;
    setLoading(true);
    api.get(`/data-collection/basic-info/school/${schoolId}`, { params: { academicYear } })
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            schoolCategory: data.schoolCategory || '',
            mediumOfInstruction: data.mediumOfInstruction || '',
            shiftSystem: data.shiftSystem || '',
            hasPlayground: data.hasPlayground || false,
            hasLibrary: data.hasLibrary || false,
            hasComputerLab: data.hasComputerLab || false,
            hasScienceLab: data.hasScienceLab || false,
            hasElectricity: data.hasElectricity || false,
            hasInternet: data.hasInternet || false,
            hasDrinkingWater: data.hasDrinkingWater || false,
            hasSanitaryFacilities: data.hasSanitaryFacilities || false,
            totalClassrooms: data.totalClassrooms || 0,
            operationalClassrooms: data.operationalClassrooms || 0,
            additionalNotes: data.additionalNotes || '',
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
      await api.post('/data-collection/basic-info', { ...form, schoolId, academicYear: Number(academicYear) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh data
      const { data } = await api.get(`/data-collection/basic-info/school/${schoolId}`, { params: { academicYear } });
      if (data) setExisting(data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error saving data');
    } finally {
      setSaving(false);
    }
  };

  const toggleBool = (key: string) => setForm((f: any) => ({ ...f, [key]: !f[key] }));

  const facilities = [
    { key: 'hasPlayground', label: 'Playground', emoji: '⚽' },
    { key: 'hasLibrary', label: 'Library', emoji: '📚' },
    { key: 'hasComputerLab', label: 'Computer Lab', emoji: '💻' },
    { key: 'hasScienceLab', label: 'Science Lab', emoji: '🔬' },
    { key: 'hasElectricity', label: 'Electricity', emoji: '⚡' },
    { key: 'hasInternet', label: 'Internet', emoji: '🌐' },
    { key: 'hasDrinkingWater', label: 'Drinking Water', emoji: '💧' },
    { key: 'hasSanitaryFacilities', label: 'Sanitary Facilities', emoji: '🚻' },
  ];

  return (
    <>
      <Header title="Basic Information" subtitle="School-wise basic information form" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />

        {!schoolId ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Select a school to fill or view basic information.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={18} className="text-blue-500" />
                  Basic Information Form
                </CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Academic Details */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">School Category</label>
                  <select value={form.schoolCategory} onChange={(e) => setForm({ ...form, schoolCategory: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Select...</option>
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                    <option value="co_education">Co-Education</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Medium of Instruction</label>
                  <select value={form.mediumOfInstruction} onChange={(e) => setForm({ ...form, mediumOfInstruction: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Select...</option>
                    <option value="bangla">Bangla</option>
                    <option value="english">English</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shift System</label>
                  <select value={form.shiftSystem} onChange={(e) => setForm({ ...form, shiftSystem: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Select...</option>
                    <option value="single">Single Shift</option>
                    <option value="double">Double Shift</option>
                  </select>
                </div>
              </div>

              {/* Facilities */}
              <div>
                <h4 className="mb-3 font-medium text-gray-800">Available Facilities</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {facilities.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleBool(f.key)}
                      className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm transition-all ${
                        (form as any)[f.key]
                          ? 'border-green-400 bg-green-50 text-green-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{f.emoji}</span>
                      <span className="font-medium">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Classrooms */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Total Classrooms</label>
                  <input type="number" min="0" value={form.totalClassrooms} onChange={(e) => setForm({ ...form, totalClassrooms: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Operational Classrooms</label>
                  <input type="number" min="0" value={form.operationalClassrooms} onChange={(e) => setForm({ ...form, operationalClassrooms: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Additional Notes</label>
                <textarea rows={3} value={form.additionalNotes} onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })} placeholder="Any additional information..." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 border-t pt-4">
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-green-600 animate-in fade-in">
                    <CheckCircle2 size={16} /> Saved successfully!
                  </span>
                )}
                <Button onClick={handleSubmit} loading={saving} className="min-w-[140px]">
                  <Save size={16} className="mr-1.5" />
                  {existing ? 'Update' : 'Submit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
