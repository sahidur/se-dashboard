'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, School, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import type { DcSchool } from '@/types';

interface SchoolSelectorProps {
  value: string;
  onChange: (schoolId: string, school?: DcSchool) => void;
  className?: string;
}

export function SchoolSelector({ value, onChange, className = '' }: SchoolSelectorProps) {
  const [schools, setSchools] = useState<DcSchool[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/data-collection/schools')
      .then(({ data }) => setSchools(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = schools.find((s) => s.id === value);
  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        Select School <span className="text-red-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-left transition-all hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <div className="flex min-w-0 items-center gap-2">
          <School size={18} className="shrink-0 text-brand-500" />
          {selected ? (
            <span className="min-w-0 truncate font-medium text-gray-900">
              {selected.name}{' '}
              <span className="text-xs text-gray-400">({selected.code})</span>
            </span>
          ) : (
            <span className="text-gray-400">
              {loading ? 'Loading schools...' : 'Choose a school...'}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="sticky top-0 border-b bg-white p-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">
                {schools.length === 0 ? 'No schools created yet. Create one first!' : 'No matching schools.'}
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id, s);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    value === s.id
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    value === s.id ? 'bg-brand-100' : 'bg-gray-100'
                  }`}>
                    <School size={14} className={value === s.id ? 'text-brand-600' : 'text-gray-500'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.code} • {s.district || 'No district'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
