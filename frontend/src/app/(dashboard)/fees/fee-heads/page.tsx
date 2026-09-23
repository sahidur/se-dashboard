'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Edit,
  Trash2,
  Tag,
  GraduationCap,
  BookOpen,
  School,
  Search,
  Layers,
  Inbox,
  CalendarClock,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';

interface HeadRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  category: string | null;
  feeSchedule: 'yearly' | 'half_yearly' | 'monthly';
  installmentAllowed: boolean;
}

const FEE_SCHEDULES = [
  { value: 'yearly', label: 'Yearly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const feeScheduleLabel = (value: string | null) =>
  FEE_SCHEDULES.find((s) => s.value === value)?.label ?? 'Monthly';

const CATEGORY_META = [
  {
    value: 'brac_academy',
    label: 'BRAC Academy',
    icon: GraduationCap,
    accentBorder: 'border-violet-400',
    softBg: 'bg-violet-50',
    chipBg: 'bg-violet-100',
    accentText: 'text-violet-600',
    dot: 'bg-violet-500',
  },
  {
    value: 'brac_primary',
    label: 'BRAC Primary',
    icon: BookOpen,
    accentBorder: 'border-emerald-400',
    softBg: 'bg-emerald-50',
    chipBg: 'bg-emerald-100',
    accentText: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  {
    value: 'brac_secondary',
    label: 'BRAC Secondary',
    icon: School,
    accentBorder: 'border-sky-400',
    softBg: 'bg-sky-50',
    chipBg: 'bg-sky-100',
    accentText: 'text-sky-600',
    dot: 'bg-sky-500',
  },
] as const;

const categoryLabel = (value: string | null) =>
  CATEGORY_META.find((c) => c.value === value)?.label ?? 'Uncategorized';

export default function FeeHeadsPage() {
  const [rows, setRows] = useState<HeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'brac_academy',
    isActive: true,
    feeSchedule: 'monthly' as HeadRow['feeSchedule'],
    installmentAllowed: false,
  });
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRows = async () => {
    try {
      const { data } = await api.get('/fee-heads');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, HeadRow[]>();
    for (const row of filtered) {
      const key = row.category ?? 'uncategorized';
      const list = byCategory.get(key) ?? [];
      list.push(row);
      byCategory.set(key, list);
    }
    return byCategory;
  }, [filtered]);

  const openCreate = (category?: string) => {
    setEditingId(null);
    setForm({
      name: '',
      description: '',
      category: category ?? 'brac_academy',
      isActive: true,
      feeSchedule: 'monthly',
      installmentAllowed: false,
    });
    setCategoryLocked(Boolean(category));
    setShowModal(true);
  };

  const openEdit = (row: HeadRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description ?? '',
      category: row.category ?? '',
      isActive: row.isActive,
      feeSchedule: row.feeSchedule ?? 'monthly',
      installmentAllowed: Boolean(row.installmentAllowed),
    });
    setCategoryLocked(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Fee head name is required');
      return;
    }
    if (!form.category) {
      alert('Please choose a category');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/fee-heads/${editingId}`, form);
      } else {
        await api.post('/fee-heads', form);
      }
      setShowModal(false);
      fetchRows();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save fee head'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: HeadRow) => {
    if (!confirm(`Delete fee head "${row.name}" from ${categoryLabel(row.category)}?`))
      return;
    try {
      await api.delete(`/fee-heads/${row.id}`);
      fetchRows();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete fee head'));
    }
  };

  const renderHeadCard = (row: HeadRow) => (
    <div
      key={row.id}
      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              row.isActive ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
          <span className="min-w-0 break-words leading-snug font-semibold text-gray-900">
            {row.name}
          </span>
        </div>
        {row.description && (
          <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-500">
            {row.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            <CalendarClock size={11} />
            {feeScheduleLabel(row.feeSchedule)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              row.installmentAllowed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Layers size={11} />
            Installment: {row.installmentAllowed ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => openEdit(row)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Edit"
        >
          <Edit size={15} />
        </button>
        <button
          onClick={() => handleDelete(row)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );

  const renderCategorySection = (meta: (typeof CATEGORY_META)[number]) => {
    const heads = grouped.get(meta.value) ?? [];
    const Icon = meta.icon;
    return (
      <section
        key={meta.value}
        className="stagger-item overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      >
        {/* Light header */}
        <div
          className={`flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3.5 sm:px-5`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.chipBg} ${meta.accentText}`}
            >
              <Icon size={20} />
            </span>
            <h2 className="truncate text-base font-bold text-gray-900">{meta.label}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-block ${meta.softBg} ${meta.accentText}`}
            >
              {heads.length} head{heads.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => openCreate(meta.value)}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.03] hover:shadow-sm active:scale-95 border-gray-200 bg-white ${meta.accentText} hover:bg-gray-50`}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Heads list */}
        <div className="p-3 sm:p-4">
          {heads.length === 0 ? (
            <button
              onClick={() => openCreate(meta.value)}
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <Inbox size={28} className="mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No fee heads yet</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Click to add the first {meta.label} fee head
              </p>
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {heads.map(renderHeadCard)}
            </div>
          )}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const uncategorized = grouped.get('uncategorized') ?? [];

  return (
    <>
      <Header
        title="Fee Heads"
        subtitle="Fee types scoped per school category and used in class fee structures"
        actions={
          <Button size="sm" onClick={() => openCreate()}>
            <Plus size={16} className="mr-1" /> Add Fee Head
          </Button>
        }
      />
      <div className="page-container">
        {/* Search */}
        <div className="relative mb-5 max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fee heads…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {filtered.length === 0 && rows.length > 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-gray-400">
            <Search size={40} className="mb-2" />
            <p className="text-sm">No fee heads match “{search}”</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {CATEGORY_META.map(renderCategorySection)}
          </div>
        )}

        {/* Legacy heads without a category */}
        {uncategorized.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                <Layers size={18} />
              </span>
              <h2 className="text-base font-bold text-gray-900">Uncategorized</h2>
            </div>
            <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
              {uncategorized.map(renderHeadCard)}
            </div>
          </section>
        )}

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Tag size={48} className="mb-3" />
            <p className="text-lg font-medium">No fee heads yet</p>
            <p className="text-sm">
              Add fee heads under each category — e.g. Tuition Fee, Exam Fee, Library Fee
            </p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Fee Head' : 'Add Fee Head'}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CATEGORY_META.map((c) => {
                const selected = form.category === c.value;
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    type="button"
                    disabled={Boolean(editingId)}
                    onClick={() => setForm({ ...form, category: c.value })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                      selected
                        ? `border-gray-300 ${c.softBg} ${c.accentText} font-semibold shadow-sm`
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    } ${editingId ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    <Icon size={16} className={selected ? 'text-white' : c.accentText} />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            label="Name *"
            placeholder="e.g. Tuition Fee"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Fee Schedule
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FEE_SCHEDULES.map((s) => {
                const selected = form.feeSchedule === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({ ...form, feeSchedule: s.value })}
                    className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                      selected
                        ? 'border-brand-400 bg-brand-50 font-semibold text-brand-600 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Installment Accepted
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((val) => {
                const selected = form.installmentAllowed === val;
                return (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm({ ...form, installmentAllowed: val })}
                    className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                      selected
                        ? val
                          ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-700 shadow-sm'
                          : 'border-gray-300 bg-gray-50 font-semibold text-gray-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                );
              })}
            </div>
            {form.installmentAllowed && (
              <p className="mt-1 text-xs text-gray-500">
                Students can pay this head line in installments.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>
    </>
  );
}