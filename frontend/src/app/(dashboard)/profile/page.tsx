'use client';

import { useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Save, Lock, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const { data } = await api.patch('/users/profile', profile);
      updateUser(data);
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
      await api.patch('/users/profile', { profilePicture: data.url });
      updateUser({ ...user!, profilePicture: data.url });
    } catch {
      alert('Failed to upload image');
    }
  };

  return (
    <>
      <Header title="Profile" subtitle="Manage your account settings" />
      <div className="page-container">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Hero Banner + Avatar */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-lg">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white" />
            </div>
            <div className="relative flex flex-col items-center gap-4 p-6 pb-5 sm:flex-row sm:items-end sm:gap-6 sm:p-8 sm:pb-6">
              <div className="relative group">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="h-24 w-24 rounded-2xl border-4 border-white/30 object-cover shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white/30 bg-white/20 text-2xl font-bold text-white shadow-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                    {getInitials(user?.firstName || '', user?.lastName || '')}
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
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="mt-0.5 text-sm text-white/70">{user?.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {user?.roles?.map((role) => (
                    <span
                      key={role.id}
                      className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Card */}
          <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Personal Information</h3>
                <p className="text-xs text-gray-500">Update your name, email and contact details</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                />
                <Input
                  label="Last Name"
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                />
                <Input
                  label="Phone"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleUpdateProfile} loading={saving}>
                  <Save size={14} className="mr-1.5" /> Save Changes
                </Button>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="animate-fadeIn rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md" style={{ animationDelay: '100ms' }}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Security</h3>
                <p className="text-xs text-gray-500">Update your password to keep your account secure</p>
              </div>
            </div>
            <div className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    currentPassword: e.target.value,
                  })
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      newPassword: e.target.value,
                    })
                  }
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  loading={changingPassword}
                >
                  <Lock size={14} className="mr-1.5" /> Update Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
