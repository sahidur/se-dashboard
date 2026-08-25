'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Copy,
  LayoutGrid,
  List,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { Survey, PaginatedResponse } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  published: 'success',
  closed: 'warning',
  archived: 'error',
};

const statusTabs = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Closed', value: 'closed' },
  { label: 'Archived', value: 'archived' },
];

export default function SurveysPage() {
  const { hasPermission } = useAuthStore();
  const canSeeAllStatuses = hasPermission('surveys', 'update');
  const canDeleteSurvey = hasPermission('surveys', 'delete');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const { data: surveysData, isLoading: loading } = useQuery({
    queryKey: ['surveys', page, search, statusFilter, canSeeAllStatuses],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        ...(search && { search }),
        ...(canSeeAllStatuses
          ? (statusFilter ? { status: statusFilter } : {})
          : { status: 'published' }),
      });
      const { data } = await api.get<PaginatedResponse<Survey>>(`/surveys?${params}`);
      return data;
    },
  });

  const surveys: Survey[] = surveysData?.data || [];
  const meta = surveysData?.meta || { total: 0, totalPages: 0 };

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    variant: 'danger' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', action: async () => {}, variant: 'danger' });

  const handleDelete = (survey: Survey) => {
    if (survey.wasPublished) {
      setConfirmModal({
        open: true,
        title: 'Cannot Delete',
        message: 'This survey was published and can never be deleted.',
        action: async () => {},
        variant: 'warning',
      });
      return;
    }
    setConfirmModal({
      open: true,
      title: 'Delete Survey',
      message: `Are you sure you want to delete "${survey.title}"? This action cannot be undone.`,
      action: async () => {
        await api.delete(`/surveys/${survey.id}`);
        queryClient.invalidateQueries({ queryKey: ['surveys'] });
      },
      variant: 'danger',
    });
  };

  const handleCopy = (survey: Survey) => {
    setConfirmModal({
      open: true,
      title: 'Duplicate Survey',
      message: `Create a copy of "${survey.title}"? The copy will be created as a draft.`,
      action: async () => {
        await api.post(`/surveys/${survey.id}/copy`);
        queryClient.invalidateQueries({ queryKey: ['surveys'] });
      },
      variant: 'info',
    });
  };

  const handleStatusChange = (survey: Survey, newStatus: string) => {
    const statusLabels: Record<string, string> = {
      published: 'Publish',
      closed: 'Close',
      archived: 'Archive',
    };
    setConfirmModal({
      open: true,
      title: `${statusLabels[newStatus]} Survey`,
      message: `Are you sure you want to ${statusLabels[newStatus].toLowerCase()} "${survey.title}"?${
        newStatus === 'published'
          ? ' Once published, fields cannot be edited.'
          : newStatus === 'closed'
          ? ' The survey will stop accepting responses.'
          : ''
      }`,
      action: async () => {
        await api.patch(`/surveys/${survey.id}/status`, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ['surveys'] });
      },
      variant: newStatus === 'closed' ? 'warning' : 'info',
    });
  };

  const confirmAction = async () => {
    try {
      await confirmModal.action();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Operation failed');
    }
    setConfirmModal((prev) => ({ ...prev, open: false }));
  };

  const getNextStatus = (status: string) => {
    const transitions: Record<string, string> = {
      draft: 'published',
      published: 'closed',
      closed: 'archived',
    };
    return transitions[status];
  };

  const getNextStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Publish',
      published: 'Close',
      closed: 'Archive',
    };
    return labels[status];
  };

  return (
    <>
      <Header
        title="Survey Management"
        subtitle={`${meta.total} surveys total`}
        actions={
          <Link href="/surveys/create">
            <Button size="sm">
              <Plus size={16} className="mr-1" /> Create Survey
            </Button>
          </Link>
        }
      />
      <div className="page-container">
        {/* Filters and View Toggle */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="relative flex-1 min-w-0 sm:max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search surveys..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="flex rounded-lg border border-gray-300 bg-white self-start">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-l-lg p-2.5 ${
                  viewMode === 'grid'
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-r-lg border-l border-gray-300 p-2.5 ${
                  viewMode === 'list'
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Status Tabs — only admins can filter by status */}
          {canSeeAllStatuses && (
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 -mx-1 px-1">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPage(1);
                  }}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    statusFilter === tab.value
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : surveys.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-400">
            <p className="text-lg">No surveys found</p>
            <Link href="/surveys/create">
              <Button className="mt-4" size="sm">
                Create your first survey
              </Button>
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">
                        {survey.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {survey.category}
                      </p>
                    </div>
                    <Badge variant={statusVariant[survey.status]}>
                      {survey.status}
                    </Badge>
                  </div>
                  {survey.description && (
                    <p className="mb-3 text-sm text-gray-500 line-clamp-2">
                      {survey.description}
                    </p>
                  )}
                  <div className="mb-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>{survey.fields?.length || 0} fields</span>
                    {survey.sections && survey.sections.length > 0 && (
                      <span>{survey.sections.length} sections</span>
                    )}
                    <span>Created {formatDate(survey.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/surveys/${survey.id}`} className="min-w-[72px] flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                    </Link>
                    {survey.status === 'draft' && (
                      <Link href={`/surveys/${survey.id}/edit`}>
                        <button className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-brand-50 hover:text-brand-600">
                          <Edit size={14} />
                        </button>
                      </Link>
                    )}
                    <button
                      onClick={() => handleCopy(survey)}
                      className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    {getNextStatus(survey.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleStatusChange(survey, getNextStatus(survey.status)!)
                        }
                      >
                        {getNextStatusLabel(survey.status)}
                      </Button>
                    )}
                    {/* Delete: visible to all before publish, only Super Admin with delete perm after publish */}
                    {(!survey.wasPublished || canDeleteSurvey) && (
                      <button
                        onClick={() => handleDelete(survey)}
                        className={`rounded-lg border border-gray-200 p-2 ${
                          survey.wasPublished
                            ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                            : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title={survey.wasPublished ? 'Delete (Super Admin)' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {surveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {survey.title}
                      </h3>
                      <Badge variant={statusVariant[survey.status]}>
                        {survey.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400 sm:gap-4">
                      <span>{survey.category}</span>
                      <span>{survey.fields?.length || 0} fields</span>
                      {survey.sections && survey.sections.length > 0 && (
                        <span>{survey.sections.length} sections</span>
                      )}
                      <span>Created {formatDate(survey.createdAt)}</span>
                      {survey.createdBy && (
                        <span>
                          by {survey.createdBy.firstName}{' '}
                          {survey.createdBy.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/surveys/${survey.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                    </Link>
                    {survey.status === 'draft' && (
                      <Link href={`/surveys/${survey.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit size={14} className="mr-1" /> Edit
                        </Button>
                      </Link>
                    )}
                    <button
                      onClick={() => handleCopy(survey)}
                      className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    {getNextStatus(survey.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleStatusChange(survey, getNextStatus(survey.status)!)
                        }
                      >
                        {getNextStatusLabel(survey.status)}
                      </Button>
                    )}
                    {(!survey.wasPublished || canDeleteSurvey) && (
                      <button
                        onClick={() => handleDelete(survey)}
                        className={`rounded-lg border border-gray-200 p-2 ${
                          survey.wasPublished
                            ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                            : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                        }`}
                        title={survey.wasPublished ? 'Delete (Super Admin)' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm text-gray-500">
              Page {page} of {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-full p-2 ${
                confirmModal.variant === 'danger'
                  ? 'bg-red-100 text-red-600'
                  : confirmModal.variant === 'warning'
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <p className="text-sm text-gray-600">{confirmModal.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirmModal((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            {confirmModal.variant !== 'warning' ||
            confirmModal.title !== 'Cannot Delete' ? (
              <Button
                size="sm"
                variant={
                  confirmModal.variant === 'danger' ? 'destructive' : 'default'
                }
                onClick={confirmAction}
              >
                Confirm
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
