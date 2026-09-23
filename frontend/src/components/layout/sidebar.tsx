'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore, logoutAndRedirect } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';
import {
  Users,
  Shield,
  ClipboardList,
  ClipboardCheck,
  School,
  MapPin,
  User,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  Tag,
  Settings,
  Briefcase,
  Trash2,
  X,
  Plus,
  Database,
  BarChart3,
  BookOpen,
  Activity,
  MessageSquareText,
  Wallet,
  FileSpreadsheet,
  HandCoins,
  Receipt,
  CalendarRange,
  AlertTriangle,
  FileText,
  Target,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module?: string | string[]; // permission module(s) to check (array = OR)
  exact?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  module?: string | string[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

const navigation: NavEntry[] = [
  {
    label: 'Programme Overview',
    href: '/data-collection/programme-overview',
    icon: BarChart3,
    module: ['data-collection', 'programme-overview'],
  },
  {
    label: 'School Wise Information',
    href: '/data-collection/school-information',
    icon: BookOpen,
    module: ['data-collection', 'school-information'],
  },
  // Data Collection group
  {
    label: 'Data Collection',
    icon: Database,
    module: 'data-collection',
    children: [
      {
        label: 'My Schools',
        href: '/data-collection/schools',
        icon: School,
        module: 'data-collection',
      },
    ],
  },
  // School Setup group
  {
    label: 'School Setup',
    icon: School,
    module: 'data-collection',
    children: [
      {
        label: 'Create School',
        href: '/school-setup/schools',
        icon: Plus,
        module: 'data-collection',
      },
    ],
  },
  // Student Management group
  {
    label: 'Student Management',
    icon: Users,
    module: 'student-management',
    children: [
      {
        label: 'Student List',
        href: '/students',
        icon: Users,
        module: 'student-management',
        exact: true,
      },
      {
        label: 'Classes & Sections',
        href: '/students/classes',
        icon: BookOpen,
        module: 'student-management',
      },
    ],
  },
  // Fee Collection group
  {
    label: 'Fee Collection',
    icon: Wallet,
    module: ['fee-collection', 'fee-management'],
    children: [
      {
        label: 'Monthly Collection',
        href: '/fees/collection',
        icon: HandCoins,
        module: 'fee-collection',
      },
      {
        label: 'Payment History',
        href: '/fees/payments',
        icon: Receipt,
        module: 'fee-collection',
      },
      {
        label: 'Fee Structure',
        href: '/fees/structure',
        icon: FileSpreadsheet,
        module: ['fee-collection', 'fee-management'],
      },
      {
        label: 'Fee Heads',
        href: '/fees/fee-heads',
        icon: Tag,
        module: ['fee-collection', 'fee-management'],
      },
      {
        label: 'Academic Years',
        href: '/fees/academic-years',
        icon: CalendarRange,
        module: ['fee-collection', 'fee-management'],
      },
    ],
  },
  // Finance Reports group
  {
    label: 'Finance Reports',
    icon: BarChart3,
    module: 'finance-reports',
    children: [
      {
        label: 'Collection Report',
        href: '/reports/collection',
        icon: BarChart3,
        module: 'finance-reports',
      },
      {
        label: 'Due Report',
        href: '/reports/dues',
        icon: AlertTriangle,
        module: 'finance-reports',
      },
      {
        label: 'Class/Section-wise Collection',
        href: '/reports/class-wise',
        icon: BookOpen,
        module: 'finance-reports',
      },
      {
        label: 'Fee Head Report',
        href: '/reports/fee-heads',
        icon: Tag,
        module: 'finance-reports',
      },
      {
        label: 'Actual Target vs Actual Collected',
        href: '/reports/revenue',
        icon: Wallet,
        module: 'finance-reports',
      },
      {
        label: 'Planned Revenue Target',
        href: '/reports/planned-revenue',
        icon: Target,
        module: 'finance-reports',
      },
      {
        label: 'Student Fee Ledger',
        href: '/reports/student-ledger',
        icon: FileText,
        module: 'finance-reports',
      },
    ],
  },
  // School Monitoring group
  {
    label: 'School Monitoring',
    icon: ClipboardCheck,
    module: 'school-monitoring',
    children: [
      {
        label: 'New Observation',
        href: '/school-monitoring',
        icon: ClipboardList,
        module: 'school-monitoring',
        exact: true,
      },
      {
        label: 'Submitted Feedback',
        href: '/school-monitoring/feedback',
        icon: MessageSquareText,
        module: 'school-monitoring',
      },
    ],
  },
  {
    label: 'User',
    href: '/users',
    icon: Users,
    module: 'users',
  },
  {
    label: 'Role',
    href: '/roles',
    icon: Shield,
    module: 'roles',
  },
  {
    label: 'Survey',
    href: '/surveys',
    icon: ClipboardList,
    module: 'surveys',
    exact: false,
  },
  {
    label: 'Assigned Survey',
    href: '/surveys/assigned',
    icon: ClipboardCheck,
    module: 'assigned-surveys',
  },
  {
    label: 'My Profile',
    href: '/profile',
    icon: User,
  },
  // Admin Tools group
  {
    label: 'Admin Tools',
    icon: Settings,
    module: 'admin-tools',
    children: [
      {
        label: 'Categories',
        href: '/categories',
        icon: Tag,
        module: 'categories',
      },
      {
        label: 'Geo Locations',
        href: '/geo-locations',
        icon: MapPin,
        module: 'geo-locations',
      },
      {
        label: 'User Designations',
        href: '/user-designations',
        icon: Briefcase,
        module: 'user-designations',
      },
      {
        label: 'Activity Logs',
        href: '/activity-logs',
        icon: Activity,
        module: ['admin-tools', 'activity-logs'],
      },
      {
        label: 'Recycle Bin',
        href: '/recycle-bin',
        icon: Trash2,
        module: 'recycle-bin',
      },
    ],
  },
];

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { user, hasAnyRole, hasPermission } = useAuthStore();
  // Drawer open state lives in the shared UI store: the trigger button is
  // rendered by the page Header (aligned with the profile icon), while the
  // drawer/overlay are rendered here.
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Admin Tools': true,
    'Data Collection': true,
    'School Setup': true,
    'Student Management': true,
    'Fee Collection': true,
    'Finance Reports': true,
  });

  // Close mobile sidebar on route change. Adjusting the state during render
  // (React's documented pattern) instead of in an effect avoids an extra render
  // pass with the drawer still open over the newly navigated page.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [setMobileOpen]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const canAccess = (item: { module?: string | string[] }) => {
    // Items without a module restriction are visible to all authenticated users
    if (!item.module) return true;
    // Super Admin always sees everything
    if (hasAnyRole('Super Admin')) return true;
    // Every other item is purely permission-driven via Role Management.
    // An array means OR — any one granted module unlocks the item.
    const modules = Array.isArray(item.module) ? item.module : [item.module];
    return modules.some((m) => hasPermission(m, 'read'));
  };

  const isActive = (href: string) =>
    pathname === href ||
    (pathname.startsWith(href + '/') &&
      !navigation
        .filter((e): e is NavItem => !isNavGroup(e))
        .some(
          (other) =>
            other.href !== href &&
            other.href.startsWith(href + '/') &&
            (pathname === other.href ||
              pathname.startsWith(other.href + '/')),
        ));

  const renderNavItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.href);
    if (depth > 0 && !collapsed) {
      // Child link inside a group: sits on the group's vertical guide rail
      // with a pill-style active state, clearly nested under its parent.
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'group flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
            active
              ? 'bg-brand-50 font-semibold text-brand-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          )}
          title={item.label}
        >
          <item.icon
            size={16}
            className={cn(
              'mt-0.5 shrink-0 transition-colors',
              active ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600',
            )}
          />
          <span className="min-w-0 flex-1 break-words leading-snug">{item.label}</span>
        </Link>
      );
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98]',
          active
            ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon size={18} className={cn('mt-0.5 shrink-0', active && 'drop-shadow-sm')} />
        {!collapsed && <span className="min-w-0 break-words leading-snug">{item.label}</span>}
      </Link>
    );
  };

  const renderNavGroup = (group: NavGroup) => {
    const visibleChildren = group.children.filter(canAccess);
    if (visibleChildren.length === 0) return null;
    const expanded = expandedGroups[group.label] ?? false;
    const hasActiveChild = visibleChildren.some((c) => isActive(c.href));

    if (collapsed) {
      return visibleChildren.map((child) => renderNavItem(child));
    }

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150',
            hasActiveChild
              ? 'text-brand-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          )}
        >
          {/* Icon chip: tinted when the group holds the active page */}
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
              hasActiveChild
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-500',
            )}
          >
            <group.icon size={16} />
          </span>
          <span className="min-w-0 flex-1 break-words text-left text-sm font-semibold leading-snug tracking-tight">
            {group.label}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              'shrink-0 transition-transform duration-300',
              hasActiveChild ? 'text-brand-500' : 'text-gray-400',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
        </button>
        {expanded && (
          <div className="animate-fadeIn">
            {/* Vertical guide rail ties the children visually to the parent */}
            <div className="relative ml-[22px] border-l-2 border-gray-100 pl-2.5">
              {visibleChildren.map((child) => renderNavItem(child, 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-600/30">
              SE
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              SE<span className="text-brand-600">360</span>
            </span>
          </Link>
        )}
        {/* Desktop collapse button */}
        <button
          onClick={() => onToggleCollapsed?.()}
          className="hidden rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:block"
        >
          {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        {navigation
          .filter((entry) => canAccess(entry))
          .map((entry) =>
            isNavGroup(entry)
              ? renderNavGroup(entry)
              : renderNavItem(entry as NavItem),
          )}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && user && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-600 to-gray-800 text-xs font-bold text-white">
              {getInitials(user.firstName ?? '', user.lastName ?? '')}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logoutAndRedirect()}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98]',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fadeIn bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar (drawer) */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-gray-100 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-gray-100 bg-white transition-all duration-300 ease-out lg:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
