'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore, logoutAndRedirect } from '@/store/auth-store';
import { Bell, User, LogOut } from 'lucide-react';
import { getInitials, resolveAssetUrl } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logoutAndRedirect();
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-[64px] items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-0 sm:h-16">
      <div className="min-w-0 mr-3">
        <h1 className="text-lg font-bold text-gray-900 sm:text-xl truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 sm:text-sm truncate">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {actions}
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Bell size={20} />
        </button>
        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100"
          >
            {user?.profilePicture ? (
              <Image
                src={resolveAssetUrl(user.profilePicture)}
                alt="Profile"
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-200"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 ring-2 ring-gray-200">
                {user ? getInitials(user.firstName, user.lastName) : '?'}
              </div>
            )}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              {/* Menu items */}
              <Link
                href="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={16} className="text-gray-400" />
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
