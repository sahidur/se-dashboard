'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FORM_CATEGORIES } from './form-catalog';

interface CategoryMenuProps {
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
}

/**
 * Compact single-row ribbon menu shown on the School Information detail
 * page. Each form category is a small pill sitting side-by-side, separated
 * by a subtle shaded divider — hovering (or clicking, for touch/keyboard)
 * a pill drops its child forms down below; clicking a child form navigates
 * to its dedicated data-viewer page (search + CSV/Excel export).
 */
export function CategoryMenu({ schoolId, schoolName, schoolCode }: CategoryMenuProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenKey(null), 150);
  };

  const qs = new URLSearchParams();
  if (schoolName) qs.set('schoolName', schoolName);
  if (schoolCode) qs.set('schoolCode', schoolCode);
  const query = qs.toString() ? `?${qs.toString()}` : '';

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="px-3 pb-4 pt-4">
        <div className="flex flex-wrap items-stretch divide-x divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/60">
          {FORM_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const expanded = openKey === cat.key;
            return (
              <div
                key={cat.key}
                className="relative"
                onMouseEnter={() => { cancelClose(); setOpenKey(cat.key); }}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  onClick={() => setOpenKey(expanded ? null : cat.key)}
                  aria-expanded={expanded}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors first:rounded-l-xl last:rounded-r-xl ${
                    expanded ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${cat.color}`}>
                    <CatIcon size={11} className="text-white" />
                  </span>
                  {cat.label}
                  <ChevronDown
                    size={12}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180 text-indigo-500' : ''}`}
                  />
                </button>

                {/* Hover/click dropdown with child forms */}
                {expanded && (
                  <div
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className={`absolute left-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ${cat.ring}`}
                  >
                    <div className="flex flex-col divide-y divide-gray-50 py-1">
                      {cat.forms.map((form) => {
                        const FormIcon = form.icon;
                        return (
                          <Link
                            key={form.key}
                            href={`/data-collection/school-information/${schoolId}/${form.key}${query}`}
                            className="group flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                            onClick={() => setOpenKey(null)}
                          >
                            <FormIcon size={14} className="shrink-0 text-gray-400 group-hover:text-indigo-500" />
                            <span className="flex-1 truncate font-medium">{form.label}</span>
                            <ChevronRight size={13} className="shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-indigo-500" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
