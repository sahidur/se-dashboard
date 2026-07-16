'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { GeoLocationSelect } from '@/components/forms/geo-location-select';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import { PasskeyManager } from '@/components/users/passkey-manager';
import {
  ActivityFilterBar,
  EMPTY_ACTIVITY_FILTERS,
  resolveDateRange,
  type ActivityFilterState,
} from '@/components/activity/activity-filters';
import {
  Activity,
  Briefcase,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Hash,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  School,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { formatDate, getInitials, resolveAssetUrl } from '@/lib/utils';
import api from '@/lib/api';
import type { GeoLocation, PaginatedAuditLogs, User } from '@/types';
import { USER_DESIGNATIONS } from '@/types';

type Tab = 'overview' | 'schools' | 'activity' | 'security' | 'passkeys';

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

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // Always fetch the freshest copy of "me" — the auth-store snapshot is only
  // as fresh as the last login/manual update, and previously the profile
  // page never refetched it (showing stale data + missing PIN/designation/
  // base/geo-location fields that were added later).
  const { data: me } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/users/me').then((r) => r.data),
    initialData: user ?? undefined,
  });

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    pin: '',
    designation: '',
    base: '',
    geoLocationId: null as string | null,
  });
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setProfile({
      firstName: me?.firstName || '',
      lastName: me?.lastName || '',
      email: me?.email || '',
      phone: me?.phone || '',
      pin: me?.pin != null ? String(me.pin) : '',
      designation: me?.designation || '',
      base: me?.base || '',
      geoLocationId: me?.geoLocationId || null,
    });
    setEditing(true);
  };

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

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
    if (filters.search) params.search = filters.search;
    const { startDate, endDate } = resolveDateRange(filters);
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [filters, page]);

  const { data: activity, isLoading: activityLoading } = useQuery<PaginatedAuditLogs>({
    queryKey: ['my-activity', activityParams],
    queryFn: () => api.get('/audit-logs/me', { params: activityParams }).then((r) => r.data),
    enabled: tab === 'activity',
    placeholderData: keepPreviousData,
  });

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const payload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        pin: profile.pin ? Number(profile.pin) : undefined,
        designation: profile.designation || undefined,
        base: profile.base || undefined,
        geoLocationId: profile.geoLocationId || undefined,
      };
      const { data } = await api.patch('/users/me/profile', payload);
      updateUser(data);
      setEditing(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      setChangingPassword(true);
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      alert('Password changed successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { data: updated } = await api.patch('/users/me/profile', { profilePicture: data.url });
      updateUser(updated);
    } catch {
      alert('Failed to upload image');
    }
  };

  const displayUser = me ?? user;
  const totalPages = activity?.totalPages ?? 1;
  const total = activity?.total ?? 0;

  return (
    <>
      <Header title="Profile" subtitle="Manage your account settings" />
      <div className="page-container">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Hero Banner + Avatar */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-lg">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white" />
            </div>
            <div className="relative flex flex-col items-center gap-4 p-6 pb-5 sm:flex-row sm:items-end sm:gap-6 sm:p-8 sm:pb-6">
              <div className="relative group">
                {displayUser?.profilePicture ? (
                  <img
                    src={resolveAssetUrl(displayUser.profilePicture)}
                    alt={`${displayUser.firstName} ${displayUser.lastName}`}
                    className="h-24 w-24 rounded-2xl border-4 border-white/30 object-cover shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white/30 bg-white/20 text-2xl font-bold text-white shadow-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                    {getInitials(displayUser?.firstName || '', displayUser?.lastName || '')}
                  </div>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-2 -right-2 rounded-full bg-white p-2 text-brand-600 shadow-lg transition-transform duration-200 hover:scale-110"
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="pb-1 text-center sm:text-left">
                <h2 className="text-2xl font-bold text-white">
                  {displayUser?.firstName} {displayUser?.lastName}
                </h2>
                <p className="mt-0.5 text-sm text-white/70">{displayUser?.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {displayUser?.roles?.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
                    >
                      <Shield size={10} />
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-t-xl border-b border-gray-200 bg-white px-2 shadow-sm">
            {(['overview', 'schools', 'activity', 'security', 'passkeys'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-b-2 border-brand-600 text-brand-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'overview' && <UserIcon size={14} />}
                {t === 'schools' && <School size={14} />}
                {t === 'activity' && <Activity size={14} />}
                {t === 'security' && <Lock size={14} />}
                {t === 'passkeys' && <Fingerprint size={14} />}
                {t === 'schools' ? 'Assigned Schools' : t === 'security' ? 'Password Reset' : t}
              </button>
            ))}
          </div>

          {/* Overview */}
          {tab === 'overview' && (
            <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Personal Information</h3>
                    <p className="text-xs text-gray-500">
                      {editing ? 'Update your details below' : 'Your account details'}
                    </p>
                  </div>
                </div>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil size={13} className="mr-1.5" /> Edit
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    <X size={13} className="mr-1.5" /> Cancel
                  </Button>
                )}
              </div>

              {!editing ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoRow icon={Mail} label="Email" value={displayUser?.email || '—'} />
                  <InfoRow icon={Phone} label="Phone" value={displayUser?.phone || '—'} />
                  <InfoRow
                    icon={Hash}
                    label="PIN"
                    value={displayUser?.pin != null ? String(displayUser.pin) : '—'}
                  />
                  <InfoRow icon={Briefcase} label="Designation" value={displayUser?.designation || '—'} />
                  <InfoRow icon={Building2} label="Base" value={displayUser?.base || '—'} />
                  <InfoRow
                    icon={MapPin}
                    label="Geo Location"
                    value={geoLocationBreadcrumb(displayUser?.geoLocation) || '—'}
                  />
                  <InfoRow
                    icon={UserIcon}
                    label="Member since"
                    value={displayUser?.createdAt ? formatDate(displayUser.createdAt) : '—'}
                  />
                  <InfoRow
                    icon={Activity}
                    label="Last login"
                    value={displayUser?.lastLoginAt ? formatDate(displayUser.lastLoginAt) : '—'}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="First Name"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    />
                    <Input
                      label="Last Name"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                    <Input
                      label="Phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="PIN"
                      type="number"
                      value={profile.pin}
                      onChange={(e) => setProfile({ ...profile, pin: e.target.value })}
                    />
                    <Select
                      label="Designation"
                      value={profile.designation}
                      onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                      placeholder="Select designation"
                      options={USER_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Base"
                      value={profile.base}
                      onChange={(e) => setProfile({ ...profile, base: e.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Geo Location
                      </label>
                      <GeoLocationSelect
                        value={profile.geoLocationId}
                        onChange={(id) => setProfile({ ...profile, geoLocationId: id })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateProfile} loading={saving}>
                      <Save size={14} className="mr-1.5" /> Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assigned Schools */}
          {tab === 'schools' && (
            <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <School size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Assigned Schools</h3>
                    <p className="text-xs text-gray-500">
                      {(displayUser?.schools?.length ?? 0)} school
                      {(displayUser?.schools?.length ?? 0) === 1 ? '' : 's'} assigned
                    </p>
                  </div>
                </div>
              </div>

              {(displayUser?.schools?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-gray-400">
                  <School size={28} className="mb-2 opacity-60" />
                  <p className="text-sm">No schools assigned yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(displayUser?.schools ?? []).map((school) => (
                    <div key={school.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-900">{school.name}</p>
                        <p className="text-xs text-gray-500">Code: {school.code || '—'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium text-gray-700">Location:</span>{' '}
                          {[school.upazila, school.district, school.division]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium text-gray-700">Address:</span>{' '}
                          {school.address || '—'}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium text-gray-700">Phone:</span> {school.phone || '—'}
                        </p>
                        <p className="truncate text-xs text-gray-600">
                          <span className="font-medium text-gray-700">Email:</span> {school.email || '—'}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium text-gray-700">Principal:</span>{' '}
                          {school.principalName || '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity */}
          {tab === 'activity' && (
            <div className="animate-fadeIn space-y-4">
              <ActivityFilterBar filters={filters} onChange={updateFilters} onReset={resetFilters} />

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">My Activity</h3>
                      <p className="text-xs text-gray-500">
                        {total} event{total === 1 ? '' : 's'} found
                      </p>
                    </div>
                  </div>
                </div>
                <ActivityTimeline
                  logs={activity?.data ?? []}
                  loading={activityLoading}
                  emptyLabel="No activity matches these filters"
                />

                {totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-3 border-t border-gray-100 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={15} className="mr-1" /> Prev
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
                      Next <ChevronRight size={15} className="ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security / Password Reset */}
          {tab === 'security' && (
            <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Security</h3>
                  <p className="text-xs text-gray-500">Update your password to keep your account secure</p>
                </div>
              </div>
              <div className="max-w-md space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                />
                <div className="flex justify-end pt-2">
                  <Button onClick={handleChangePassword} loading={changingPassword}>
                    <Lock size={14} className="mr-1.5" /> Update Password
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Passkeys */}
          {tab === 'passkeys' && (
            <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <PasskeyManager />
            </div>
          )}
        </div>
      </div>
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
