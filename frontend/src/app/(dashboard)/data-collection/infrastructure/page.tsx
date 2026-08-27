'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { Building2, Save, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { DcInfrastructure } from '@/types';

export default function InfrastructurePage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [existing, setExisting] = useState<DcInfrastructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    totalBuildings: 0, buildingCondition: '', totalClassrooms: 0, usableClassrooms: 0,
    hasSmartClassroom: false, smartClassroomCount: 0, totalToilets: 0, boysToilets: 0,
    girlsToilets: 0, hasRamp: false, hasBoundaryWall: false, hasFireSafety: false,
    furnitureCondition: '', hasProjector: false, projectorCount: 0, remarks: '',
  });

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    api.get(`/data-collection/infrastructure/school/${schoolId}`)
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            totalBuildings: data.totalBuildings || 0, buildingCondition: data.buildingCondition || '',
            totalClassrooms: data.totalClassrooms || 0, usableClassrooms: data.usableClassrooms || 0,
            hasSmartClassroom: data.hasSmartClassroom || false, smartClassroomCount: data.smartClassroomCount || 0,
            totalToilets: data.totalToilets || 0, boysToilets: data.boysToilets || 0,
            girlsToilets: data.girlsToilets || 0, hasRamp: data.hasRamp || false,
            hasBoundaryWall: data.hasBoundaryWall || false, hasFireSafety: data.hasFireSafety || false,
            furnitureCondition: data.furnitureCondition || '', hasProjector: data.hasProjector || false,
            projectorCount: data.projectorCount || 0, remarks: data.remarks || '',
          });
        } else {
          setExisting(null);
        }
      })
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSubmit = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      await api.post('/data-collection/infrastructure', { ...form, schoolId });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const { data } = await api.get(`/data-collection/infrastructure/school/${schoolId}`);
      if (data) setExisting(data);
    } catch (e) {
      alert(getErrorMessage(e, 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  const numField = (label: string, key: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input type="number" min="0" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );

  const toggleBtn = (key: string, label: string, emoji: string) => (
    <button type="button" onClick={() => setForm((f: any) => ({ ...f, [key]: !f[key] }))}
      className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm transition-all ${(form as any)[key] ? 'border-green-400 bg-green-50 text-green-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
      <span className="text-lg">{emoji}</span><span className="font-medium">{label}</span>
    </button>
  );

  return (
    <>
      <Header title="Infrastructure & Classroom" subtitle="Infrastructure and classroom status form" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />
        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><Building2 size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to fill infrastructure data.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Building2 size={18} className="text-emerald-500" />Infrastructure Form</CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Buildings */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {numField('Total Buildings', 'totalBuildings')}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Building Condition</label>
                  <select value={form.buildingCondition} onChange={(e) => setForm({ ...form, buildingCondition: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Select...</option>
                    <option value="good">Good</option><option value="average">Average</option>
                    <option value="poor">Poor</option><option value="critical">Critical</option>
                  </select>
                </div>
                {numField('Total Classrooms', 'totalClassrooms')}
                {numField('Usable Classrooms', 'usableClassrooms')}
              </div>

              {/* Toilets */}
              <div className="grid gap-4 sm:grid-cols-3">
                {numField('Total Toilets', 'totalToilets')}
                {numField('Boys Toilets', 'boysToilets')}
                {numField('Girls Toilets', 'girlsToilets')}
              </div>

              {/* Smart Classroom + Projectors */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {numField('Smart Classrooms', 'smartClassroomCount')}
                {numField('Projectors', 'projectorCount')}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Furniture Condition</label>
                  <select value={form.furnitureCondition} onChange={(e) => setForm({ ...form, furnitureCondition: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Select...</option>
                    <option value="good">Good</option><option value="average">Average</option><option value="poor">Poor</option>
                  </select>
                </div>
              </div>

              {/* Toggle facilities */}
              <div>
                <h4 className="mb-3 font-medium text-gray-800">Facilities</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {toggleBtn('hasSmartClassroom', 'Smart Classroom', '🖥️')}
                  {toggleBtn('hasProjector', 'Projector', '📽️')}
                  {toggleBtn('hasRamp', 'Wheelchair Ramp', '♿')}
                  {toggleBtn('hasBoundaryWall', 'Boundary Wall', '🧱')}
                  {toggleBtn('hasFireSafety', 'Fire Safety', '🧯')}
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
