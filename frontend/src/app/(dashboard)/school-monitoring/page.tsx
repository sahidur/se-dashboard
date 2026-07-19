'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, School, ClipboardCheck, ArrowRight, MapPin, ClipboardList, History, ChevronDown, Check,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { MONITORING_FORM_LIST, totalIndicators } from '@/components/school-monitoring/form-catalog';
import type { DcSchool } from '@/types';
import type { MonitoringFormType as FT } from '@/components/school-monitoring/form-catalog';

const FORM_ACCENT: Record<string, { soft: string; text: string }> = {
  combined: { soft: 'bg-indigo-50 text-indigo-600', text: 'text-indigo-600' },
  quality: { soft: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600' },
  operations: { soft: 'bg-amber-50 text-amber-600', text: 'text-amber-600' },
};

export default function SchoolMonitoringPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<DcSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<DcSchool | null>(null);
  const [selectedForm, setSelectedForm] = useState<FT | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<DcSchool[]>('/data-collection/schools')
      .then(({ data }) => setSchools(data))
      .catch(() => setSchools([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) =>
      [s.name, s.code, s.division, s.district, s.upazila]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [schools, search]);

  const canStart = selectedSchool && selectedForm;

  const start = () => {
    if (!canStart) return;
    router.push(`/school-monitoring/fill?schoolId=${selectedSchool!.id}&form=${selectedForm}`);
  };

  const schoolLocation = (s: DcSchool) =>
    [s.upazila, s.district, s.division].filter(Boolean).join(', ') || s.code || '';

  return (
    <div>
      <Header
        title="School Monitoring"
        subtitle="Record your observation of an assigned school"
        actions={
          <Link href="/school-monitoring/feedback">
            <Button variant="outline">
              <History className="mr-1.5 h-4 w-4" /> Submitted Feedback
            </Button>
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {/* Step 1 — school */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
            <h2 className="text-sm font-semibold text-gray-900">Select an assigned school</h2>
          </div>

          <div ref={dropdownRef} className="relative max-w-xl">
            <button
              type="button"
              disabled={loading}
              onClick={() => { setOpen((o) => !o); setSearch(''); }}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors',
                open ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-300 hover:border-gray-400',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn('rounded-lg p-2', selectedSchool ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500')}>
                  <School className="h-4 w-4" />
                </span>
                {selectedSchool ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{selectedSchool.name}</span>
                    <span className="flex items-center gap-1 truncate text-xs text-gray-500">
                      <MapPin className="h-3 w-3" /> {schoolLocation(selectedSchool)}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">{loading ? 'Loading your schools…' : 'Search and select a school…'}</span>
                )}
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg animate-fadeIn">
                <div className="relative border-b border-gray-100 p-2">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    autoFocus
                    className="pl-9"
                    placeholder="Search by name, code or location…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                      {schools.length === 0 ? 'No schools are assigned to you yet.' : 'No schools match your search.'}
                    </p>
                  ) : (
                    filtered.map((s) => {
                      const active = selectedSchool?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedSchool(s); setOpen(false); }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            active ? 'bg-brand-50' : 'hover:bg-gray-50',
                          )}
                        >
                          <span className={cn('rounded-lg p-1.5', active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500')}>
                            <School className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{s.name}</span>
                            <span className="flex items-center gap-1 truncate text-xs text-gray-500">
                              <MapPin className="h-3 w-3" /> {schoolLocation(s)}
                            </span>
                          </span>
                          {active && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2 — category */}
        <section className={cn('transition-opacity', !selectedSchool && 'pointer-events-none opacity-50')}>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
            <h2 className="text-sm font-semibold text-gray-900">Choose a monitoring category</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {MONITORING_FORM_LIST.map((f) => {
              const active = selectedForm === f.type;
              const accent = FORM_ACCENT[f.type];
              return (
                <button
                  key={f.type}
                  type="button"
                  onClick={() => setSelectedForm(f.type)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-all',
                    active ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className={cn('mb-2 inline-flex rounded-lg p-2', accent.soft)}>
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">{f.shortTitle}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-gray-500">{f.description}</p>
                  <p className={cn('mt-2 text-xs font-medium', accent.text)}>
                    {f.sections.length} sections · {totalIndicators(f)} indicators
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Start */}
        <div className="flex items-center justify-end gap-3">
          {selectedSchool && selectedForm && (
            <Link
              href={`/school-monitoring/feedback?schoolId=${selectedSchool.id}&formType=${selectedForm}`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              View existing feedback for this school
            </Link>
          )}
          <Button size="lg" disabled={!canStart} onClick={start}>
            <ClipboardList className="mr-1.5 h-4 w-4" />
            Start observation
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
