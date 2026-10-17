'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown, ChevronRight, Wallet, BarChart3, HandCoins, Receipt,
  FileSpreadsheet, Tag, CalendarRange, AlertTriangle, BookOpen, Target,
  FileText, ClipboardCheck, type LucideIcon,
} from 'lucide-react';
import { FORM_CATEGORIES, type FormCatalogItem, type FormCategory } from './form-catalog';
import { SECTION_BY_SCHOOL_CATEGORY, getFormDisplayLabel, getStudentPerformanceForm } from './student-performance-catalog';
import { useAuthStore } from '@/store/auth-store';
import { endpointToResource } from '@/lib/data-collection-forms';

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
 * Deep links into the finance modules, shown in the same parent → child
 * ribbon style as the form categories. Unlike form categories these point
 * at the dedicated Fee Collection / Finance Report pages (shared nav
 * definition mirrors the sidebar) instead of the per-school form viewer.
 */
interface MenuChildLink {
  label: string;
  href: string;
  icon: LucideIcon;
  module: string | string[]; // permission module(s) to check (array = OR)
}

interface MenuLinkCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string; // gradient classes for the icon chip
  ring: string;
  children: MenuChildLink[];
}

const LINK_CATEGORIES: MenuLinkCategory[] = [
  {
    key: 'fee-collection',
    label: 'Fee Collection',
    icon: Wallet,
    color: 'from-amber-500 to-amber-600',
    ring: 'ring-amber-100',
    children: [
      { label: 'Monthly Collection', href: '/fees/collection', icon: HandCoins, module: 'fee-collection' },
      { label: 'Payment History', href: '/fees/payments', icon: Receipt, module: 'fee-collection' },
      { label: 'Fee Adjustments', href: '/fees/adjustments', icon: ClipboardCheck, module: 'fee-collection' },
      { label: 'Fee Structure', href: '/fees/structure', icon: FileSpreadsheet, module: ['fee-collection', 'fee-management'] },
      { label: 'Fee Heads', href: '/fees/fee-heads', icon: Tag, module: ['fee-collection', 'fee-management'] },
      { label: 'Academic Years', href: '/fees/academic-years', icon: CalendarRange, module: ['fee-collection', 'fee-management'] },
    ],
  },
  {
    key: 'finance-reports',
    label: 'Finance Reports',
    icon: BarChart3,
    color: 'from-sky-500 to-sky-600',
    ring: 'ring-sky-100',
    children: [
      { label: 'Collection Report', href: '/reports/collection', icon: BarChart3, module: 'finance-reports' },
      { label: 'Due Report', href: '/reports/dues', icon: AlertTriangle, module: 'finance-reports' },
      { label: 'Class/Section-wise Collection', href: '/reports/class-wise', icon: BookOpen, module: 'finance-reports' },
      { label: 'Fee Head Report', href: '/reports/fee-heads', icon: Tag, module: 'finance-reports' },
      { label: 'Actual Target vs Actual Collected', href: '/reports/revenue', icon: Wallet, module: 'finance-reports' },
      { label: 'Planned Revenue Target', href: '/reports/planned-revenue', icon: Target, module: 'finance-reports' },
      { label: 'Student Fee Ledger', href: '/reports/student-ledger', icon: FileText, module: 'finance-reports' },
    ],
  },
];

/** Child link of a link category — same row style as FormLink. */
function NavLinkRow({ label, href, icon: Icon, onNavigate }: { label: string; href: string; icon: LucideIcon; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-2.5 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
      onClick={onNavigate}
    >
      <Icon size={14} className="mt-0.5 shrink-0 text-gray-400 group-hover:text-indigo-500" />
      <span className="flex-1 break-words font-medium leading-snug">{label}</span>
      <ChevronRight size={13} className="mt-0.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-indigo-500" />
    </Link>
  );
}

/** Hover-intent delays for the ribbon menu: a quick diagonal pass over a
 * neighbouring pill must not steal the open dropdown, and the dropdown must
 * not vanish while the pointer travels the (bridged) gap toward its items. */
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 300;

/**
 * Compact single-row ribbon menu shown on the School Information detail
 * page. Each form category is a small pill sitting side-by-side, separated
 * by a subtle shaded divider — hovering (or clicking, for touch/keyboard)
 * a pill drops its child forms down below; clicking a child form navigates
 * to its dedicated data-viewer page (search + CSV/Excel export).
 */
export function CategoryMenu({ schoolId, schoolName, schoolCode, schoolCategory }: CategoryMenuProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRowRef = useRef<HTMLDivElement>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  // Hide forms this role cannot read (form-scoped grants; wildcard passes all).
  const canReadForm = (form: FormCatalogItem) =>
    hasPermission('data-collection', 'read', endpointToResource(form.endpoint));

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

  // Drop categories whose every form is hidden for this role.
  const visibleCategories = categories
    .map((cat) => ({ ...cat, forms: cat.forms.filter(canReadForm) }))
    .filter((cat) => cat.forms.length > 0);

  // Finance-module link categories: visible only when the role can read at
  // least one of the destinations (array = OR, same rule as the sidebar).
  const canReadModule = (m: string | string[]) => {
    const modules = Array.isArray(m) ? m : [m];
    return modules.some((mod) => hasPermission(mod, 'read'));
  };
  const visibleLinkCategories = LINK_CATEGORIES.map((cat) => ({
    ...cat,
    children: cat.children.filter((c) => canReadModule(c.module)),
  })).filter((cat) => cat.children.length > 0);

  const clearTimers = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => clearTimers, []);

  /** Pointer entered a pill: switch/open after a short intent delay. */
  const handleParentEnter = (key: string) => {
    clearTimers();
    if (openKey === key) return;
    openTimer.current = setTimeout(() => setOpenKey(key), OPEN_DELAY_MS);
  };

  /** Pointer entered the open panel: cancel any pending open/close. */
  const handlePanelEnter = () => clearTimers();

  /** Pointer left the pill/panel: close after a grace period. */
  const handleLeave = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS);
  };

  /** Click or keyboard toggle — always overrides pending hover timers. */
  const togglePanel = (key: string) => {
    clearTimers();
    setOpenKey((prev) => (prev === key ? null : key));
  };

  // Close on outside click or Escape — hover intent alone leaves the panel
  // dangling after the user clicks elsewhere on the page.
  useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRowRef.current && !menuRowRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openKey]);

  const qs = new URLSearchParams();
  if (schoolName) qs.set('schoolName', schoolName);
  if (schoolCode) qs.set('schoolCode', schoolCode);
  const query = qs.toString() ? `?${qs.toString()}` : '';

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="px-3 pb-4 pt-4">
        <div
          ref={menuRowRef}
          className="flex flex-wrap items-stretch rounded-xl border border-gray-100 bg-gray-50/60 sm:divide-x sm:divide-gray-100"
        >
          {visibleCategories.map((cat) => {
            const CatIcon = cat.icon;
            const expanded = openKey === cat.key;
            return (
              <div
                key={cat.key}
                className="relative"
                onMouseEnter={() => handleParentEnter(cat.key)}
                onMouseLeave={handleLeave}
              >
                <button
                  type="button"
                  onClick={() => togglePanel(cat.key)}
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

                {/* Hover/click dropdown with child forms. The pt wrapper keeps
                    the panel hover-contiguous with the pill (no dead gap). */}
                {expanded && (
                  <div
                    onMouseEnter={handlePanelEnter}
                    onMouseLeave={handleLeave}
                    className="absolute left-0 top-full z-20 pt-2 max-sm:static"
                  >
                    <div className={`max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg ring-1 sm:w-96 ${cat.ring} max-sm:w-full`}>
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
                  </div>
                )}
              </div>
            );
          })}
          {visibleLinkCategories.map((cat) => {
            const CatIcon = cat.icon;
            const expanded = openKey === cat.key;
            return (
              <div
                key={cat.key}
                className="relative"
                onMouseEnter={() => handleParentEnter(cat.key)}
                onMouseLeave={handleLeave}
              >
                <button
                  type="button"
                  onClick={() => togglePanel(cat.key)}
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

                {/* Hover/click dropdown with the module's pages. The pt wrapper
                    keeps the panel hover-contiguous with the pill (no dead gap). */}
                {expanded && (
                  <div
                    onMouseEnter={handlePanelEnter}
                    onMouseLeave={handleLeave}
                    className="absolute left-0 top-full z-20 pt-2 max-sm:static"
                  >
                    <div className={`max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg ring-1 sm:w-96 ${cat.ring} max-sm:w-full`}>
                      <div className="flex flex-col divide-y divide-gray-50 py-1">
                        {cat.children.map((child) => (
                          <NavLinkRow
                            key={child.href}
                            label={child.label}
                            href={child.href}
                            icon={child.icon}
                            onNavigate={() => setOpenKey(null)}
                          />
                        ))}
                      </div>
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
