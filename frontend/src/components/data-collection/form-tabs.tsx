'use client';

import { PencilLine, TableProperties } from 'lucide-react';

interface FormTabsProps {
  active: 'entry' | 'data';
  onChange: (tab: 'entry' | 'data') => void;
  entryLabel?: string;
  dataLabel?: string;
  /** Optional count badge shown on the "data" tab (e.g. number of submitted records). */
  dataCount?: number;
  className?: string;
}

/**
 * Shared 2-tab switcher used by every data-collection form component to
 * separate "fill in / add new data" from "view already submitted data".
 * Keeps both panels mounted-state simple: the parent form conditionally
 * renders each panel based on `active`.
 */
export function FormTabs({
  active,
  onChange,
  entryLabel = 'Fill Form',
  dataLabel = 'View Submitted Data',
  dataCount,
  className = '',
}: FormTabsProps) {
  return (
    <div className={`flex gap-1 rounded-xl bg-gray-100 p-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('entry')}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
          active === 'entry'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <PencilLine size={15} />
        {entryLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('data')}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
          active === 'data'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <TableProperties size={15} />
        {dataLabel}
        {dataCount !== undefined && dataCount > 0 && (
          <span className="ml-0.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
            {dataCount}
          </span>
        )}
      </button>
    </div>
  );
}
