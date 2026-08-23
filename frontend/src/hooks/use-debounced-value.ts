'use client';

import { useEffect, useState } from 'react';

/**
 * Delays propagating a rapidly-changing value (typically a search input) so
 * anything keyed on it — a react-query `queryKey`, a `useCallback` fetcher —
 * fires one request after the user stops typing instead of one per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
