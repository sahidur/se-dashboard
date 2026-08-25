'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AssignSchoolsModal } from './assign-schools-modal';
import { formatDate, resolveAssetUrl } from '@/lib/utils';
import {
  Mail,
  Phone,
  Shield,
  MapPin,
  Briefcase,
  Hash,
  Building2,
  School as SchoolIcon,
  Plus,
  X,
  KeyRound,
  Copy,
  Check,
  UserCheck,
  UserX,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import {
  ActivityFilterBar,
  EMPTY_ACTIVITY_FILTERS,
  resolveDateRange,
  type ActivityFilterState,
} from '@/components/activity/activity-filters';
import type { GeoLocation, PaginatedAuditLogs, School, User } from '@/types';

const ACTIVITY_LIMIT = 10;

function geoLocationBreadcrumb(loc?: GeoLocation | null): string {
  if (!loc) return '';
  const parts: string[] = [loc.name];
  let cur = loc.parent;
  let guard = 0;
  while (cur && guard < 5) {
    parts.unshift(cur.name);
    cur = cur.parent;
    guard++;
  }
  return parts.join(' › ');
}

type Tab = 'overview' | 'schools' | 'activity';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  /** Called when the admin wants to edit this user's core info (opens the parent's edit form). */
  onEdit?: (user: User) => void;
}

export function UserProfileModal({ isOpen, onClose, user, onEdit }: UserProfileModalProps) {
  const { hasPermission } = useAuthStore();
  const canResetPassword = hasPermission('users', 'update');
  const canViewActivity = hasPermission('admin-tools', 'read');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const userId = user?.id;

  const { data: schools = [], refetch: refetchSchools } = useQuery<School[]>({
    queryKey: ['user-schools', userId],
    queryFn: () => api.get<School[]>(`/users/${userId}/schools`).then((r) => r.data),
    enabled: isOpen && !!userId && tab === 'schools',
  });

  // ── Activity filters + pagination ──────────────────────────────────────
  const [filters, setFilters] = useState<ActivityFilterState>(EMPTY_ACTIVITY_FILTERS);
  const [page, setPage] = useState(1);

  const updateFilters = (patch: Partial<ActivityFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_ACTIVITY_FILTERS);
    setPage(1);
  };

  const activityParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit: ACTIVITY_LIMIT };
    if (filters.action) params.action = filters.action;
    if (filters.module) params.module = filters.module;
    if (filters.search) params.search = filters.search;
    const { startDate, endDate } = resolveDateRange(filters);
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [filters, page]);

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['audit-log-categories'],
    queryFn: () => api.get<string[]>('/audit-logs/categories').then((r) => r.data),
    enabled: isOpen && canViewActivity && tab === 'activity',
  });

  const { data: activity, isLoading: activityLoading } = useQuery<PaginatedAuditLogs>({
    queryKey: ['user-activity', userId, activityParams],
    queryFn: () =>
      api
        .get<PaginatedAuditLogs>(`/audit-logs/user/${userId}`, { params: activityParams })
        .then((r) => r.data),
    enabled: isOpen && !!userId && tab === 'activity',
    placeholderData: keepPreviousData,
  });

  if (!user) return null;

  const handleClose = () => {
    setTab('overview');
    setNewPassword('');
    setCopied(false);
    setFilters(EMPTY_ACTIVITY_FILTERS);
    setPage(1);
    onClose();
  };

  const totalPages = activity?.totalPages ?? 1;
  const totalEvents = activity?.total ?? 0;

  const handleRemoveSchool = async (schoolId: string) => {
    if (!confirm('Remove this school from the user\'s access list?')) return;
    await api.delete(`/users/${userId}/schools/${schoolId}`);
    refetchSchools();
  };

  const handleResetPassword = async () => {
    try {
      setResetLoading(true);
      const { data } = await api.post(`/users/${userId}/reset-password`);
      setNewPassword(data.newPassword);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="lg">
        <div className="-m-5 sm:-m-6">
          {/* Header banner */}
          <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-6">
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {onEdit && (
                <button
                  onClick={() => onEdit(user)}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20 hover:text-white"
                  title="Edit user"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-4">
              {user.profilePicture ? (
                <Image
                  src={resolveAssetUrl(user.profilePicture)}
                  alt={`${user.firstName} ${user.lastName}`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/40 object-cover shadow-md"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/20 text-xl font-bold text-white shadow-md backdrop-blur-sm">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white sm:text-xl">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="truncate text-sm text-white/80">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      user.isActive ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'
                    }`}
                  >
                    {user.isActive ? <UserCheck size={10} /> : <UserX size={10} />}
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {user.roles?.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white"
                    >
                      <Shield size={9} />
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 pt-3">
            {(['overview', 'schools', 'activity'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-b-2 border-brand-600 text-brand-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'schools' ? 'Assigned Schools' : t}
              </button>
            ))}
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoRow icon={Mail} label="Email" value={user.email} />
                  <InfoRow icon={Phone} label="Phone" value={user.phone || '—'} />
                  <InfoRow icon={Hash} label="PIN" value={user.pin != null ? String(user.pin) : '—'} />
                  <InfoRow icon={Briefcase} label="Designation" value={user.designation || '—'} />
                  <InfoRow icon={Building2} label="Base" value={user.base || '—'} />
                  <InfoRow
                    icon={MapPin}
                    label="Geo Location"
                    value={geoLocationBreadcrumb(user.geoLocation) || '—'}
                  />
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-medium text-gray-500">Member since</p>
                  <p className="text-sm text-gray-800">{formatDate(user.createdAt)}</p>
                  {user.lastLoginAt && (
                    <>
                      <p className="mb-1 mt-3 text-xs font-medium text-gray-500">Last login</p>
                      <p className="text-sm text-gray-800">{formatDate(user.lastLoginAt)}</p>
                    </>
                  )}
                </div>

                {canResetPassword && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Change Password</p>
                        <p className="text-xs text-amber-700">Generate a new random password for this user.</p>
                      </div>
                      {!newPassword && (
                        <Button size="sm" variant="outline" onClick={handleResetPassword} loading={resetLoading}>
                          <KeyRound size={13} className="mr-1.5" /> Reset
                        </Button>
                      )}
                    </div>
                    {newPassword && (
                      <div className="mt-3 flex items-center gap-2">
                        <code className="min-w-0 flex-1 select-all truncate rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-mono font-semibold text-gray-900">
                          {newPassword}
                        </code>
                        <button
                          onClick={handleCopyPassword}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            copied ? 'bg-green-600 text-white' : 'border border-amber-200 bg-white text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'schools' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{schools.length} school(s) accessible</p>
                  <Button size="sm" onClick={() => setShowAssignModal(true)}>
                    <Plus size={14} className="mr-1" /> Add School
                  </Button>
                </div>
                {schools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <SchoolIcon size={28} className="mb-2 opacity-50" />
                    <p className="text-sm">No schools assigned yet</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {schools.map((school) => (
                      <li key={school.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{school.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {school.code} · {[school.upazila, school.district, school.division].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveSchool(school.id)}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Remove access"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div className="space-y-4">
                <ActivityFilterBar
                  filters={filters}
                  onChange={updateFilters}
                  onReset={resetFilters}
                  categories={categories}
                  showModule
                />
                <p className="text-xs text-gray-500">
                  {totalEvents} event{totalEvents === 1 ? '' : 's'} found
                </p>
                <ActivityTimeline
                  logs={activity?.data ?? []}
                  loading={activityLoading}
                  emptyLabel="No activity matches these filters"
                />
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-gray-100 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} className="mr-1" /> Prev
                    </Button>
                    <span className="text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <AssignSchoolsModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        userId={user.id}
        existingSchoolIds={schools.map((s) => s.id)}
        onSaved={() => {
          refetchSchools();
          queryClient.invalidateQueries({ queryKey: ['user-schools', userId] });
        }}
      />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
