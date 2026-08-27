'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from '@/components/data-collection/school-selector';
import { Award, Plus, Edit2, Trash2, X, Save, User } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { DcAlumni } from '@/types';

const emptyForm = {
  alumniName: '', graduationYear: new Date().getFullYear(), currentOccupation: '',
  higherEducation: '', institution: '', contactPhone: '', contactEmail: '',
  achievements: '', isActive: true, remarks: '',
};

export default function AlumniPage() {
  const [schoolId, setSchoolId] = useState('');
  const [alumni, setAlumni] = useState<DcAlumni[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAlumni = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/data-collection/alumni/school/${schoolId}`);
      setAlumni(data || []);
    } catch { setAlumni([]); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchAlumni(); }, [fetchAlumni]);

  const openCreate = () => { setForm({ ...emptyForm }); setEditing(null); setModal(true); };
  const openEdit = (a: DcAlumni) => {
    setForm({
      alumniName: a.alumniName || '', graduationYear: a.graduationYear || new Date().getFullYear(),
      currentOccupation: a.currentOccupation || '', higherEducation: a.higherEducation || '',
      institution: a.institution || '', contactPhone: a.contactPhone || '',
      contactEmail: a.contactEmail || '', achievements: a.achievements || '',
      isActive: a.isActive ?? true, remarks: a.remarks || '',
    });
    setEditing(a.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.alumniName.trim()) return alert('Name is required');
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/data-collection/alumni/${editing}`, form);
      } else {
        await api.post('/data-collection/alumni', { ...form, schoolId });
      }
      setModal(false);
      fetchAlumni();
    } catch (e) { alert(getErrorMessage(e, 'Error')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alumni record?')) return;
    try { await api.delete(`/data-collection/alumni/${id}`); fetchAlumni(); } catch { }
  };

  const filtered = alumni.filter((a) =>
    a.alumniName.toLowerCase().includes(search.toLowerCase()) ||
    (a.currentOccupation || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Alumni Information" subtitle="Manage alumni records for your schools" />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <SchoolSelector value={schoolId} onChange={(id) => setSchoolId(id)} className="mb-6" />

        {!schoolId ? (
          <Card><CardContent className="py-16 text-center"><Award size={48} className="mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Select a school to manage alumni.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2"><Award size={18} className="text-amber-500" />Alumni Records <Badge variant="info" className="ml-1">{alumni.length}</Badge></CardTitle>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alumni..." className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-full sm:w-48" />
                  <Button onClick={openCreate} className="shrink-0"><Plus size={16} className="mr-1.5" />Add Alumni</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <User size={40} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500">No alumni records yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((a) => (
                    <div key={a.id} className="group relative rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-amber-300 hover:shadow-md">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold text-sm">
                            {a.alumniName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{a.alumniName}</p>
                            <p className="text-xs text-gray-500">Batch {a.graduationYear}</p>
                          </div>
                        </div>
                        <Badge variant={a.isActive ? 'success' : 'default'} className="text-xs">{a.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      {a.currentOccupation && <p className="text-xs text-gray-600 mb-1">💼 {a.currentOccupation}</p>}
                      {a.higherEducation && <p className="text-xs text-gray-600 mb-1">🎓 {a.higherEducation}</p>}
                      {a.institution && <p className="text-xs text-gray-600 mb-1">🏛️ {a.institution}</p>}
                      {a.achievements && <p className="text-xs text-gray-600 mb-1">🏆 {a.achievements}</p>}
                      <div className="mt-3 flex gap-2 border-t pt-2">
                        <button onClick={() => openEdit(a)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={12} />Edit</button>
                        <button onClick={() => handleDelete(a.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={12} />Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editing ? 'Edit Alumni' : 'Add Alumni'}</h3>
                <button onClick={() => setModal(false)} className="rounded-full p-1 hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                  <input type="text" value={form.alumniName} onChange={(e) => setForm({ ...form, alumniName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Graduation Year</label>
                    <input type="number" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Current Occupation</label>
                    <input type="text" value={form.currentOccupation} onChange={(e) => setForm({ ...form, currentOccupation: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Higher Education</label>
                    <input type="text" value={form.higherEducation} onChange={(e) => setForm({ ...form, higherEducation: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Institution</label>
                    <input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Contact Phone</label>
                    <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Contact Email</label>
                    <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Achievements</label>
                  <textarea rows={2} value={form.achievements} onChange={(e) => setForm({ ...form, achievements: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                  <textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-700">Active Alumni</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
                <Button onClick={handleSave} loading={saving}><Save size={16} className="mr-1.5" />{editing ? 'Update' : 'Add'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
