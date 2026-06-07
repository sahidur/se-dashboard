'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import {
  Users,
  ClipboardList,
  School,
  FileText,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import api from '@/lib/api';
import { useQueries } from '@tanstack/react-query';

export default function DashboardPage() {
  const { user, hasAnyRole } = useAuthStore();
  const isAdmin = hasAnyRole('Super Admin', 'Admin');

  const results = useQueries({
    queries: [
      {
        queryKey: ['stats-users'],
        queryFn: () => api.get('/users?limit=1').then((r) => r.data.meta.total as number),
        enabled: isAdmin,
      },
      {
        queryKey: ['stats-surveys'],
        queryFn: () =>
          api.get('/surveys?limit=1').then((r) => r.data.meta.total as number),
      },
      {
        queryKey: ['stats-schools'],
        queryFn: () =>
          api.get('/schools?limit=1').then((r) => r.data.meta.total as number),
      },
    ],
  });

  const loading = results.some((r) => r.isLoading);
  const stats = {
    totalUsers: results[0].data,
    totalSurveys: results[1].data,
    totalSchools: results[2].data,
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers ?? '—',
      icon: Users,
      color: 'text-blue-600 bg-blue-100',
      show: hasAnyRole('Super Admin', 'Admin'),
    },
    {
      title: 'Total Surveys',
      value: stats.totalSurveys ?? '—',
      icon: ClipboardList,
      color: 'text-purple-600 bg-purple-100',
      show: true,
    },
    {
      title: 'Total Schools',
      value: stats.totalSchools ?? '—',
      icon: School,
      color: 'text-green-600 bg-green-100',
      show: true,
    },
    {
      title: 'Total Responses',
      value: stats.totalResponses ?? '—',
      icon: FileText,
      color: 'text-orange-600 bg-orange-100',
      show: hasAnyRole('Super Admin', 'Admin', 'Survey Creator'),
    },
  ].filter((c) => c.show);

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Welcome back, ${user?.firstName || 'User'}!`}
      />
      <div className="page-container">
        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="flex items-center gap-4 p-6">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                >
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? (
                      <span className="inline-block h-7 w-12 animate-pulse rounded bg-gray-200" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-brand-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hasAnyRole('Super Admin', 'Admin', 'Survey Creator') && (
                  <a
                    href="/surveys/create"
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                  >
                    <ClipboardList size={20} className="text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Create New Survey
                      </p>
                      <p className="text-xs text-gray-500">
                        Design and publish a new survey
                      </p>
                    </div>
                  </a>
                )}
                {hasAnyRole('Super Admin', 'Admin') && (
                  <a
                    href="/users"
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                  >
                    <Users size={20} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Manage Users
                      </p>
                      <p className="text-xs text-gray-500">
                        Add or modify user accounts
                      </p>
                    </div>
                  </a>
                )}
                {hasAnyRole('Super Admin', 'Admin', 'School Admin') && (
                  <a
                    href="/schools"
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                  >
                    <School size={20} className="text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        View Schools
                      </p>
                      <p className="text-xs text-gray-500">
                        Browse and manage school data
                      </p>
                    </div>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} className="text-brand-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                Activity feed will appear here
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
