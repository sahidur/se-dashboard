'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Plus, Edit, Trash2, CalendarRange } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';

interface YearRow {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'closed', label: 'Closed' },
];

const statusBadge = (status: string) =>
  status === 'active' ? 'bg-green-100 text-green-800' : status === 'closed' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-800';

export default function AcademicYearsPage() {
  const [rows, setRows] = useState<YearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', status: 'inactive' });
  const [saving, setSaving] = useState(false);

  const fetchRows = async () => {
    try {
      const { data } = await api.get('/academic-years');
      setRows(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: String(new Date().getFullYear() + 1), startDate: '', endDate: '', status: 'inactive' });
    setShowModal(true);
  };

  const openEdit = (row: YearRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      status: row.status,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Year name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        status: form.status,
      };
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;
      if (editingId) {
        await api.patch(`/academic-years/${editingId}`, payload);
      } else {
        await api.post('/academic-years', payload);
      }
      setShowModal(false);
      fetchRows();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save academic year'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: YearRow) => {
    if (!confirm(`Delete academic year ${row.name}?`)) return;
    try {
      await api.delete(`/academic-years/${row.id}`);
      fetchRows();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete academic year'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Academic Years"
        subtitle="Normally one academic year is active at a time"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Add Year
          </Button>
        }
      />
      <div className="page-container">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CalendarRange size={48} className="mb-3" />
            <p className="text-lg font-medium">No academic years yet</p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus size={14} className="mr-1" /> Create First Year
            </Button>
          </div>
        ) : (
          <div className=" space-y-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-500">
                      {row.startDate ? row.startDate.slice(0, 10) : '—'} to {row.endDate ? row.endDate.slice(0, 10) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                    <button onClick={() => openEdit(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
                      <Edit size={15} />
                    </button>
                    <button onClick={() => handleDelete(row)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Academic Year' : 'Add Academic Year'}>
        <div className="space-y-3">
          <Input label="Year Name *" placeholder="e.g. 2027" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
            <select
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </Modal>
    </>
  );
}
