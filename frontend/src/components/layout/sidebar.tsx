'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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
  Database,
  BarChart3,
  BookOpen,
  Activity,
  MessageSquareText,
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
    'School Monitoring': true,
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
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
          active
            ? 'bg-brand-50 text-brand-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          collapsed && 'justify-center px-2',
          depth > 0 && !collapsed && 'ml-4 pl-5 border-l-2 border-gray-200',
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon size={18} />
        {!collapsed && <span>{item.label}</span>}
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
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
            hasActiveChild
              ? 'text-brand-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          )}
        >
          <group.icon size={18} />
          <span className="flex-1 text-left">{group.label}</span>
          {expanded ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5">
            {visibleChildren.map((child) => renderNavItem(child, 1))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              SE
            </div>
            <span className="text-lg font-bold text-gray-900">BEP-SE</span>
          </Link>
        )}
        {/* Desktop collapse button */}
        <button
          onClick={() => onToggleCollapsed?.()}
          className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:block"
        >
          {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navigation
          .filter((entry) => canAccess(entry))
          .map((entry) =>
            isNavGroup(entry)
              ? renderNavGroup(entry)
              : renderNavItem(entry as NavItem),
          )}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-gray-200 p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        )}
        <button
          onClick={() => logoutAndRedirect()}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut size={20} />
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar (drawer) */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 lg:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
