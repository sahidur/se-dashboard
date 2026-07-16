'use client';

import { useRef, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { GeoLocationSelect } from '@/components/forms/geo-location-select';
import { UserProfileModal } from '@/components/users/user-profile-modal';
import { formatDate, resolveAssetUrl } from '@/lib/utils';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Mail,
  Phone,
  UserCheck,
  UserX,
  KeyRound,
  Copy,
  Check,
  Filter,
  Upload,
  ImageOff,
  Power,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { User, Role, GeoLocation, PaginatedResponse } from '@/types';
import { USER_DESIGNATIONS } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function UsersPage() {
  const { hasPermission } = useAuthStore();
  const canResetPassword = hasPermission('users', 'update');
  const queryClient = useQueryClient();

  // Filters
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [page, setPage] = useState(1);

  const { data: usersData, isLoading: loading } = useQuery({
    queryKey: ['users', page, searchName, searchPhone, searchEmail],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (searchName) params.set('searchName', searchName);
      if (searchPhone) params.set('searchPhone', searchPhone);
      if (searchEmail) params.set('searchEmail', searchEmail);
      const { data } = await api.get<PaginatedResponse<User>>(`/users?${params}`);
      return data;
    },
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get<Role[]>('/roles').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const users: User[] = usersData?.data || [];
  const meta = usersData?.meta || { total: 0, totalPages: 0 };

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roleIds: [] as string[],
    pin: '',
    designation: '',
    base: '',
    geoLocationId: null as string | null,
    profilePicture: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset password modal
  const [resetModal, setResetModal] = useState<{ open: boolean; userId: string; userName: string }>({
    open: false,
    userId: '',
    userName: '',
  });
  const [resetLoading, setResetLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Status (active/deactivate) confirmation modal
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    nextActive: boolean;
  }>({ open: false, userId: '', userName: '', nextActive: true });
  const [statusSaving, setStatusSaving] = useState(false);

  // User profile view modal
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      roleIds: [],
      pin: '',
      designation: '',
      base: '',
      geoLocationId: null,
      profilePicture: '',
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      phone: user.phone || '',
      roleIds: user.roles?.map((r) => r.id) || [],
      pin: user.pin != null ? String(user.pin) : '',
      designation: user.designation || '',
      base: user.base || '',
      geoLocationId: user.geoLocationId || null,
      profilePicture: user.profilePicture || '',
    });
    setShowModal(true);
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Only JPG and PNG images are supported');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      setUploadingPicture(true);
      const uploadData = new FormData();
      uploadData.append('file', file);
      const { data } = await api.post('/files/upload?folder=profile-pictures', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData((prev) => ({ ...prev, profilePicture: data.url }));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: Record<string, any> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        roleIds: formData.roleIds,
        pin: formData.pin ? Number(formData.pin) : undefined,
        designation: formData.designation || undefined,
        base: formData.base || undefined,
        geoLocationId: formData.geoLocationId || undefined,
        profilePicture: formData.profilePicture || undefined,
      };
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', { ...payload, password: formData.password });
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const openStatusConfirm = (user: User) => {
    setStatusConfirm({
      open: true,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      nextActive: !user.isActive,
    });
  };

  const handleConfirmStatus = async () => {
    try {
      setStatusSaving(true);
      await api.patch(`/users/${statusConfirm.userId}/status`, { isActive: statusConfirm.nextActive });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setStatusConfirm({ open: false, userId: '', userName: '', nextActive: true });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const openResetModal = (user: User) => {
    setNewPassword('');
    setCopied(false);
    setResetModal({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}` });
  };

  const handleResetPassword = async () => {
    try {
      setResetLoading(true);
      const { data } = await api.post(`/users/${resetModal.userId}/reset-password`);
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

  const activeCount = users.filter((u) => u.isActive).length;
  const hasFilters = searchName || searchPhone || searchEmail;

  const clearFilters = () => {
    setSearchName('');
    setSearchPhone('');
    setSearchEmail('');
    setPage(1);
  };

  return (
    <>
      <Header
        title="User Management"
        subtitle={`${meta.total} users registered`}
        actions={
          <Button onClick={openCreateModal} size="sm">
            <Plus size={16} className="mr-1" /> Add User
          </Button>
        }
      />
      <div className="page-container">
        {/* Stats Bar */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-lg animate-fadeIn">
          <div className="relative px-4 py-4 sm:px-6 sm:py-5">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white" />
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Users size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white sm:text-2xl">{meta.total} Users</h2>
                  <p className="text-xs text-white/70">Manage all platform users</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-green-200">
                    <UserCheck size={14} />
                    <span className="text-xl font-bold text-white">{activeCount}</span>
                  </div>
                  <p className="text-xs text-white/60">Active</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-red-200">
                    <UserX size={14} />
                    <span className="text-xl font-bold text-white">{users.length - activeCount}</span>
                  </div>
                  <p className="text-xs text-white/60">Inactive</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => { setSearchName(e.target.value); setPage(1); }}
                  placeholder="Search by name..."
                  className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Phone</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => { setSearchPhone(e.target.value); setPage(1); }}
                  placeholder="Search by phone..."
                  className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchEmail}
                  onChange={(e) => { setSearchEmail(e.target.value); setPage(1); }}
                  placeholder="Search by email..."
                  className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Filter size={13} className="mr-1 inline" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-fadeIn">
            <Users size={48} className="mb-3 opacity-50" />
            <p className="text-lg font-medium text-gray-500">No users found</p>
            <p className="text-sm">Try adjusting your filters or add a new user.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Email</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Phone</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Roles</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user, idx) => (
                    <tr
                      key={user.id}
                      className="group cursor-pointer transition-colors hover:bg-gray-50/60"
                      onClick={() => setProfileUser(user)}
                    >
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {(page - 1) * 20 + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.profilePicture ? (
                            <img
                              src={resolveAssetUrl(user.profilePicture)}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
                              {user.firstName[0]}{user.lastName[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="truncate text-xs text-gray-500 md:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                        {user.email}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 lg:table-cell">
                        {user.phone || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.slice(0, 2).map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                            >
                              <Shield size={8} />
                              {role.name}
                            </span>
                          ))}
                          {user.roles && user.roles.length > 2 && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              +{user.roles.length - 2}
                            </span>
                          )}
                          {(!user.roles || user.roles.length === 0) && (
                            <span className="text-[10px] text-gray-400 italic">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusConfirm(user);
                          }}
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${user.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                        >
                          <Power size={9} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-500 xl:table-cell">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canResetPassword && (
                            <button
                              onClick={() => openResetModal(user)}
                              className="rounded-lg p-1.5 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100"
                              title="Reset password"
                            >
                              <KeyRound size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(user)}
                            className="rounded-lg p-1.5 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                            title="Edit user"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="rounded-lg p-1.5 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
              <span className="font-semibold text-gray-900">{meta.totalPages}</span>
              <span className="ml-2 text-gray-400">({meta.total} total)</span>
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                let p: number;
                if (meta.totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= meta.totalPages - 2) p = meta.totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[36px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      page === p ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Create User'}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {formData.profilePicture ? (
              <img
                src={resolveAssetUrl(formData.profilePicture)}
                alt="Profile"
                className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm border border-gray-200"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-gray-300">
                <ImageOff size={20} />
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleProfilePictureChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={uploadingPicture}
              >
                <Upload size={13} className="mr-1.5" /> Upload Photo
              </Button>
              <p className="mt-1 text-[11px] text-gray-400">JPG or PNG only (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          {!editingUser && (
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="PIN"
              type="number"
              min={1}
              step={1}
              value={formData.pin}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || Number(v) > 0) setFormData({ ...formData, pin: v });
              }}
              placeholder="Positive number only"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Designation"
              placeholder="Select designation"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              options={USER_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            />
            <Input
              label="Base"
              value={formData.base}
              onChange={(e) => setFormData({ ...formData, base: e.target.value })}
              placeholder="e.g. Dhaka Regional Office"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Geo Location</label>
            <GeoLocationSelect
              value={formData.geoLocationId}
              onChange={(geoLocationId) => setFormData({ ...formData, geoLocationId })}
            />
          </div>

          <Select
            label="Role"
            placeholder="Select a role"
            value={formData.roleIds[0] || ''}
            onChange={(e) => setFormData({ ...formData, roleIds: e.target.value ? [e.target.value] : [] })}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModal.open}
        onClose={() => setResetModal({ open: false, userId: '', userName: '' })}
        title="Reset Password"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reset password for <span className="font-semibold text-gray-900">{resetModal.userName}</span>?
            A new random password will be generated.
          </p>

          {newPassword ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-xs font-medium text-green-700">New password generated:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-mono font-semibold text-gray-900 border border-green-200 select-all">
                  {newPassword}
                </code>
                <button
                  onClick={handleCopyPassword}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-green-200 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-green-600">
                Share this password with the user securely. It cannot be retrieved later.
              </p>
            </div>
          ) : (
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setResetModal({ open: false, userId: '', userName: '' })}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} loading={resetLoading}>
                <KeyRound size={14} className="mr-1.5" />
                Generate New Password
              </Button>
            </div>
          )}

          {newPassword && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setResetModal({ open: false, userId: '', userName: '' })}>
                Done
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Activate/Deactivate Confirmation Modal */}
      <Modal
        isOpen={statusConfirm.open}
        onClose={() => setStatusConfirm({ open: false, userId: '', userName: '', nextActive: true })}
        title={statusConfirm.nextActive ? 'Activate User' : 'Deactivate User'}
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to{' '}
            <span className="font-semibold text-gray-900">{statusConfirm.nextActive ? 'activate' : 'deactivate'}</span>{' '}
            <span className="font-semibold text-gray-900">{statusConfirm.userName}</span>?
            {!statusConfirm.nextActive && ' They will no longer be able to log in.'}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setStatusConfirm({ open: false, userId: '', userName: '', nextActive: true })}
            >
              Cancel
            </Button>
            <Button
              variant={statusConfirm.nextActive ? 'default' : 'destructive'}
              onClick={handleConfirmStatus}
              loading={statusSaving}
            >
              {statusConfirm.nextActive ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        onEdit={(u) => {
          setProfileUser(null);
          openEditModal(u);
        }}
      />
    </>
  );
}
