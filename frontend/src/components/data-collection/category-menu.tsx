'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FORM_CATEGORIES, type FormCatalogItem, type FormCategory } from './form-catalog';
import { SECTION_BY_SCHOOL_CATEGORY, getFormDisplayLabel, getStudentPerformanceForm } from './student-performance-catalog';

interface CategoryMenuProps {
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
  schoolCategory?: string;
}

/** Consecutive forms sharing a `group` are collapsed into one parent entry. */
function groupForms(forms: FormCatalogItem[]): { group?: string; forms: FormCatalogItem[] }[] {
  const entries: { group?: string; forms: FormCatalogItem[] }[] = [];
  for (const form of forms) {
    const last = entries[entries.length - 1];
    if (form.group && last?.group === form.group) last.forms.push(form);
    else entries.push({ group: form.group, forms: [form] });
  }
  return entries;
}

function FormLink({ form, href, onNavigate, schoolCategory }: { form: FormCatalogItem; href: string; onNavigate: () => void; schoolCategory?: string }) {
  const FormIcon = form.icon;
  // For student performance forms, use dynamic label based on school category
  const displayLabel = form.key.startsWith('student-performance-')
    ? (() => {
        const perfKey = form.key.replace('student-performance-', '');
        const perfDef = getStudentPerformanceForm(perfKey);
        return perfDef ? getFormDisplayLabel(perfDef, schoolCategory) : form.label;
      })()
    : form.label;
  return (
    <Link
      href={href}
      className="group flex items-start gap-2.5 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
      onClick={onNavigate}
    >
      <FormIcon size={14} className="mt-0.5 shrink-0 text-gray-400 group-hover:text-indigo-500" />
      <span className="flex-1 break-words font-medium leading-snug">{displayLabel}</span>
      <ChevronRight size={13} className="mt-0.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-indigo-500" />
    </Link>
  );
}

/**
 * Compact single-row ribbon menu shown on the School Information detail
 * page. Each form category is a small pill sitting side-by-side, separated
 * by a subtle shaded divider — hovering (or clicking, for touch/keyboard)
 * a pill drops its child forms down below; clicking a child form navigates
 * to its dedicated data-viewer page (search + CSV/Excel export).
 */
export function CategoryMenu({ schoolId, schoolName, schoolCode, schoolCategory }: CategoryMenuProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories: FormCategory[] = schoolCategory
    ? FORM_CATEGORIES.map((cat) => {
        if (cat.key !== 'performance') return cat;
        const sectionKey = SECTION_BY_SCHOOL_CATEGORY[schoolCategory];
        if (!sectionKey) return cat;
        return {
          ...cat,
          forms: cat.forms.filter((f) => {
            if (!f.group) return true;
            return f.group === `Students' Performance (${sectionKey.toUpperCase()})`;
          }),
        };
      })
    : FORM_CATEGORIES;

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
        <div className="flex flex-wrap items-stretch rounded-xl border border-gray-100 bg-gray-50/60 sm:divide-x sm:divide-gray-100">
          {categories.map((cat) => {
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
                    className={`absolute left-0 top-full z-20 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg ring-1 sm:w-96 ${cat.ring} max-sm:static max-sm:mt-2 max-sm:w-full`}
                  >
                    <div className="flex flex-col divide-y divide-gray-50 py-1">
                      {groupForms(cat.forms).map((entry) =>
                        entry.group ? (
                          <div key={entry.group} className="py-1">
                            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                              {entry.group}
                            </p>
                            <div className="ml-4 border-l border-dashed border-gray-200">
                              {entry.forms.map((form) => (
                                <FormLink
                                  key={form.key}
                                  form={form}
                                  href={`/data-collection/school-information/${schoolId}/${form.key}${query}`}
                                  onNavigate={() => setOpenKey(null)}
                                  schoolCategory={schoolCategory}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <FormLink
                            key={entry.forms[0].key}
                            form={entry.forms[0]}
                            href={`/data-collection/school-information/${schoolId}/${entry.forms[0].key}${query}`}
                            onNavigate={() => setOpenKey(null)}
                            schoolCategory={schoolCategory}
                          />
                        ),
                      )}
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
