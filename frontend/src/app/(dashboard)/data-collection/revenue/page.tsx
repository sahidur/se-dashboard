'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { Wallet, Save, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import type { DcRevenue } from '@/types';

export default function RevenuePage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [existing, setExisting] = useState<DcRevenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    academicYear: '', monthlyTuitionFee: 0, admissionFee: 0, examFee: 0,
    totalAnnualRevenue: 0, governmentGrant: 0, donationsReceived: 0, otherIncome: 0,
    totalExpenditure: 0, salaryExpenditure: 0, maintenanceExpenditure: 0,
    pendingFeeAmount: 0, feeCollectionRate: 0, remarks: '',
  });

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    api.get(`/data-collection/revenue/school/${schoolId}`)
      .then(({ data }) => {
        if (data) {
          setExisting(data);
          setForm({
            academicYear: data.academicYear || '', monthlyTuitionFee: data.monthlyTuitionFee || 0,
            admissionFee: data.admissionFee || 0, examFee: data.examFee || 0,
            totalAnnualRevenue: data.totalAnnualRevenue || 0, governmentGrant: data.governmentGrant || 0,
            donationsReceived: data.donationsReceived || 0, otherIncome: data.otherIncome || 0,
            totalExpenditure: data.totalExpenditure || 0, salaryExpenditure: data.salaryExpenditure || 0,
            maintenanceExpenditure: data.maintenanceExpenditure || 0, pendingFeeAmount: data.pendingFeeAmount || 0,
            feeCollectionRate: data.feeCollectionRate || 0, remarks: data.remarks || '',
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
      await api.post('/data-collection/revenue', { ...form, schoolId });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      const { data } = await api.get(`/data-collection/revenue/school/${schoolId}`);
      if (data) setExisting(data);
    } catch (e: any) { alert(e?.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const moneyField = (label: string, key: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
        <input type="number" min="0" step="0.01" value={(form as any)[key]}
          onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
          className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      </div>
    </div>
  );

  const surplus = form.totalAnnualRevenue - form.totalExpenditure;

  return (
    <>
      <Header title="Revenue & Fee Structure" subtitle="Financial data collection for your school" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />
        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><Wallet size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to fill revenue data.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Wallet size={18} className="text-teal-500" />Revenue & Fee Structure</CardTitle>
                {existing && <Badge variant="success">Previously Submitted</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="rounded-xl bg-teal-50 p-4 flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-teal-500 mb-0.5">Revenue</p>
                  <p className="text-xl font-bold text-teal-700">৳ {form.totalAnnualRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-red-400 mb-0.5">Expenditure</p>
                  <p className="text-xl font-bold text-red-600">৳ {form.totalExpenditure.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Surplus/Deficit</p>
                  <p className={`text-xl font-bold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {surplus >= 0 ? '+' : ''}৳ {surplus.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Collection Rate</p>
                  <p className="text-xl font-bold text-blue-600">{form.feeCollectionRate}%</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Academic Year</label>
                  <input type="text" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="2025-2026" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fee Collection Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.feeCollectionRate} onChange={(e) => setForm({ ...form, feeCollectionRate: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">💰 Fee Structure</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  {moneyField('Monthly Tuition Fee', 'monthlyTuitionFee')}
                  {moneyField('Admission Fee', 'admissionFee')}
                  {moneyField('Exam Fee', 'examFee')}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">📈 Income</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {moneyField('Total Annual Revenue', 'totalAnnualRevenue')}
                  {moneyField('Government Grant', 'governmentGrant')}
                  {moneyField('Donations', 'donationsReceived')}
                  {moneyField('Other Income', 'otherIncome')}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-800">📉 Expenditure</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {moneyField('Total Expenditure', 'totalExpenditure')}
                  {moneyField('Salary', 'salaryExpenditure')}
                  {moneyField('Maintenance', 'maintenanceExpenditure')}
                  {moneyField('Pending Fees', 'pendingFeeAmount')}
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
