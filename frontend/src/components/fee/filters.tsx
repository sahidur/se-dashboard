'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Select as UISelect } from '@/components/ui/select';

// Value-based wrapper around the native Select: onChange receives the
// selected value string instead of the raw change event.
export function Select({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
}) {
  return (
    <UISelect
      id={id}
      label={label}
      className={className}
      value={value}
      options={options}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const monthName = (m: number) =>
  MONTHS.find((x) => x.value === m)?.label ?? String(m);

export function formatBDT(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export interface SchoolOption {
  id: string;
  name: string;
  schoolCategory?: string | null;
}

export function useSchools() {
  return useQuery<SchoolOption[]>({
    queryKey: ['dc-schools-minimal'],
    queryFn: () => api.get('/data-collection/schools').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export interface AcademicYearOption {
  id: string;
  name: string;
  status: string;
}

export function useAcademicYears(activeOnly = false) {
  return useQuery<AcademicYearOption[]>({
    queryKey: ['academic-years', activeOnly],
    queryFn: () =>
      api
        .get(`/academic-years${activeOnly ? '?activeOnly=true' : ''}`)
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function SchoolSelect({
  schools,
  value,
  onChange,
  label = 'School',
  allowEmpty = false,
}: {
  schools: SchoolOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      placeholder={allowEmpty ? 'All schools' : 'Select school'}
      options={schools.map((s) => ({ value: s.id, label: s.name }))}
    />
  );
}

export function YearSelect({
  years,
  value,
  onChange,
  label = 'Academic Year',
}: {
  years: AcademicYearOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      placeholder="Select year"
      options={years.map((y) => ({
        value: y.id,
        label: `${y.name}${y.status === 'active' ? ' (active)' : ''}`,
      }))}
    />
  );
}

export function MonthSelect({
  value,
  onChange,
  label = 'Month',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={MONTHS.map((m) => ({ value: String(m.value), label: m.label }))}
    />
  );
}

export const feeStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    due: 'bg-red-100 text-red-800',
    overpaid: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-gray-200 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
};
