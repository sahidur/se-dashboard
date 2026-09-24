'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { buildYearOptions, orderYearOptions } from '@/lib/utils';

/**
 * Academic-year options for the data-collection forms.
 *
 * Sourced from the academic years defined under Fee Collection
 * (fee-management › academic-years). Falls back to the generated
 * current-year-first list while loading or when none exist yet.
 *
 * One shared react-query cache entry — every form using this hook hits the
 * endpoint only once per stale window.
 */
export function useAcademicYearOptions(): number[] {
  const { data } = useQuery<number[]>({
    queryKey: ['academic-year-options'],
    queryFn: () =>
      api
        .get('/academic-years')
        .then((r) => {
          const rows = Array.isArray(r.data) ? r.data : [];
          const years = [
            ...new Set(
              rows
                .map((y: { name?: string }) => Number(String(y?.name ?? '').trim()))
                .filter((n: number) => Number.isInteger(n) && n >= 1970 && n <= 2100),
            ),
          ] as number[];
          return orderYearOptions(years);
        }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return data ?? buildYearOptions();
}
