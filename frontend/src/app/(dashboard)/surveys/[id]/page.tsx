'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Calendar,
  Users,
  ClipboardList,
  Eye,
  Edit,
  Trash2,
  Copy,
  Layers,
  AlertTriangle,
  BarChart3,
  Plus,
  X,
  Clock,
  Link as LinkIcon,
  CheckSquare,
  History,
  FileText,
} from 'lucide-react';
import { formatDate, formatDateTime, FIELD_TYPE_LABELS } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type {
  Survey,
  SurveyAssignment,
  SurveyStatusLog,
  Role,
  User as UserType,
} from '@/types';

type DetailTab = 'overview' | 'assignments' | 'history' | 'responses';

export default function SurveyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { hasPermission } = useAuthStore();
  const canDeleteSurvey = hasPermission('surveys', 'delete');

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [totalResponses, setTotalResponses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Assignment modal - supports multi-select
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState<'user' | 'role'>('user');
  const [assignSearch, setAssignSearch] = useState('');
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  // Status logs
  const [statusLogs, setStatusLogs] = useState<SurveyStatusLog[]>([]);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    variant: 'danger' | 'warning' | 'info';
  }>({
    open: false,
    title: '',
    message: '',
    action: async () => {},
    variant: 'info',
  });

  const fetchSurvey = useCallback(async () => {
    try {
      const { data } = await api.get(`/surveys/${id}`);
      setSurvey(data);
    } catch {
      router.push('/surveys');
    }
  }, [id, router]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/surveys/${id}/stats`);
      setTotalResponses(data.totalResponses);
    } catch {
      /* empty */
    }
  }, [id]);

  const fetchStatusLogs = useCallback(async () => {
    try {
      const { data } = await api.get(`/surveys/${id}/status-logs`);
      setStatusLogs(data);
    } catch {
      /* empty */
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSurvey(), fetchStats(), fetchStatusLogs()]).finally(() =>
      setLoading(false),
    );
  }, [fetchSurvey, fetchStats, fetchStatusLogs]);

  const fetchUsersAndRoles = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users?limit=200'),
        api.get('/roles'),
      ]);
      setUsersList(usersRes.data.data || usersRes.data);
      setRolesList(rolesRes.data.data || rolesRes.data);
    } catch {
      /* empty */
    }
  };

  const statusColor = {
    draft: 'default' as const,
    published: 'success' as const,
    closed: 'warning' as const,
    archived: 'default' as const,
  };

  const handleStatusChange = (newStatus: string) => {
    const labels: Record<string, string> = {
      published: 'Publish',
      closed: 'Close',
      archived: 'Archive',
    };
    setConfirmModal({
      open: true,
      title: `${labels[newStatus]} Survey`,
      message: `Are you sure you want to ${labels[newStatus].toLowerCase()} "${survey?.title}"?${
        newStatus === 'published'
          ? ' Fields cannot be edited after publishing.'
          : newStatus === 'closed'
            ? ' The survey will stop accepting responses.'
            : ''
      }`,
      action: async () => {
        await api.patch(`/surveys/${id}/status`, { status: newStatus });
        fetchSurvey();
        fetchStatusLogs();
      },
      variant: newStatus === 'closed' ? 'warning' : 'info',
    });
  };

  const handleDelete = () => {
    if (survey?.wasPublished) {
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
      message: `Are you sure you want to delete "${survey?.title}"? This cannot be undone.`,
      action: async () => {
        await api.delete(`/surveys/${id}`);
        router.push('/surveys');
      },
      variant: 'danger',
    });
  };

  const handleCopy = () => {
    setConfirmModal({
      open: true,
      title: 'Duplicate Survey',
      message: `Create a copy of "${survey?.title}" as a new draft?`,
      action: async () => {
        const { data } = await api.post(`/surveys/${id}/copy`);
        router.push(`/surveys/${data.id}`);
      },
      variant: 'info',
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

  // Assignment handlers - NOW SUPPORTS MULTI-SELECT
  const openAssignModal = () => {
    fetchUsersAndRoles();
    setAssignType('user');
    setSelectedUserIds([]);
    setSelectedRoleIds([]);
    setAssignSearch('');
    setShowAssignModal(true);
  };

  const toggleUserId = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid],
    );
  };

  const toggleRoleId = (rid: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(rid) ? prev.filter((i) => i !== rid) : [...prev, rid],
    );
  };

  const handleAddAssignment = async () => {
    setAssignSaving(true);
    try {
      const assignments: Array<{ userId?: string; roleId?: string }> = [];

      if (assignType === 'user') {
        if (selectedUserIds.length === 0) {
          alert('Please select at least one user');
          setAssignSaving(false);
          return;
        }
        selectedUserIds.forEach((uid) => assignments.push({ userId: uid }));
      } else {
        if (selectedRoleIds.length === 0) {
          alert('Please select at least one role');
          setAssignSaving(false);
          return;
        }
        selectedRoleIds.forEach((rid) => assignments.push({ roleId: rid }));
      }

      if (assignments.length === 1) {
        await api.post(`/surveys/${id}/assignments`, assignments[0]);
      } else {
        await api.post(`/surveys/${id}/assignments/bulk`, { assignments });
      }

      fetchSurvey();
      setShowAssignModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add assignment');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await api.delete(`/surveys/assignments/${assignmentId}`);
      fetchSurvey();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to remove assignment');
    }
  };

  if (loading || !survey) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const tabs: { key: DetailTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: Eye },
    {
      key: 'assignments',
      label: 'Assignments',
      icon: Users,
      count: survey.assignments?.length || 0,
    },
    {
      key: 'history',
      label: 'Status History',
      icon: History,
      count: statusLogs.length,
    },
    {
      key: 'responses',
      label: 'Responses',
      icon: FileText,
      count: totalResponses,
    },
  ];

  return (
    <>
      <Header
        title={survey.title}
        subtitle={`Category: ${survey.category || 'N/A'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/surveys')}
              className="gap-1.5 border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> Back
            </Button>
            {survey.status === 'draft' && (
              <Link href={`/surveys/${id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit size={16} className="mr-1" /> Edit
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy size={16} className="mr-1" /> Duplicate
            </Button>
            {getNextStatus(survey.status) && (
              <Button
                size="sm"
                onClick={() =>
                  handleStatusChange(getNextStatus(survey.status)!)
                }
              >
                {getNextStatusLabel(survey.status)}
              </Button>
            )}
            {(!survey.wasPublished || canDeleteSurvey) && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 size={16} className="mr-1" /> Delete
              </Button>
            )}
          </div>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Tab Navigation */}
          <div className="flex overflow-x-auto border-b border-gray-200 -mx-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-5 sm:gap-2 ${
                  activeTab === tab.key
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activeTab === tab.key
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ========== OVERVIEW TAB ========== */}
          {activeTab === 'overview' && (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Badge variant={statusColor[survey.status]}>
                      {survey.status.toUpperCase()}
                    </Badge>
                    <p className="mt-1 text-xs text-gray-500">Status</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <ClipboardList className="text-brand-500" size={24} />
                    <div>
                      <p className="text-xl font-bold">
                        {survey.fields?.length || 0}
                      </p>
                      <p className="text-xs text-gray-500">Fields</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Layers className="text-accent-blue" size={24} />
                    <div>
                      <p className="text-xl font-bold">
                        {survey.sections?.length || 0}
                      </p>
                      <p className="text-xs text-gray-500">Sections</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Users className="text-brand-500" size={24} />
                    <div>
                      <p className="text-xl font-bold">{totalResponses}</p>
                      <p className="text-xs text-gray-500">Responses</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Linked Entity Info */}
              {survey.linkedEntityType === 'school_record' && (
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <LinkIcon className="text-accent-blue" size={20} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        School-Linked Survey
                      </p>
                      <p className="text-xs text-gray-500">
                        Respondents must select a school record before filling
                        this survey.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {survey.createsSchoolRecord && (
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Plus className="text-accent-lime" size={20} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Creates School Records
                      </p>
                      <p className="text-xs text-gray-500">
                        Completing this survey creates a school record for the
                        respondent.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Calendar className="text-accent-lime" size={24} />
                    <div>
                      <p className="text-sm font-medium">
                        {survey.startDate
                          ? formatDate(survey.startDate)
                          : 'Not set'}
                      </p>
                      <p className="text-xs text-gray-500">Start Date</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Calendar className="text-accent-crimson" size={24} />
                    <div>
                      <p className="text-sm font-medium">
                        {survey.endDate
                          ? formatDate(survey.endDate)
                          : 'Not set'}
                      </p>
                      <p className="text-xs text-gray-500">End Date</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Description */}
              {survey.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      {survey.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Sections & Fields */}
              {survey.sections && survey.sections.length > 0 ? (
                survey.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <Card key={section.id}>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Layers size={18} className="text-brand-500" />
                          <CardTitle>{section.title}</CardTitle>
                        </div>
                        {section.description && (
                          <p className="text-sm text-gray-500">
                            {section.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {section.fields
                            ?.sort((a, b) => a.order - b.order)
                            .map((field, i) => (
                              <div
                                key={field.id}
                                className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-xs font-medium text-gray-400">
                                      {i + 1}.
                                    </span>
                                    <span className="break-words text-sm font-medium">
                                      {field.label}
                                    </span>
                                    {field.isRequired && (
                                      <span className="text-xs text-red-500">
                                        *
                                      </span>
                                    )}
                                  </div>
                                  {field.helpText && (
                                    <p className="mt-0.5 text-xs text-gray-400">
                                      {field.helpText}
                                    </p>
                                  )}
                                  {field.options &&
                                    field.options.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {field.options.map(
                                          (opt: string, idx: number) => (
                                            <span
                                              key={idx}
                                              className="rounded bg-gray-200 px-1.5 py-0.5 text-xs"
                                            >
                                              {opt}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </div>
                                <Badge variant="info" className="shrink-0">
                                  {FIELD_TYPE_LABELS[field.fieldType] ||
                                    field.fieldType}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Survey Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {survey.fields
                        ?.sort((a, b) => a.order - b.order)
                        .map((field, i) => (
                          <div
                            key={field.id}
                            className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-xs font-medium text-gray-400">
                                  {i + 1}.
                                </span>
                                <span className="break-words text-sm font-medium">
                                  {field.label}
                                </span>
                                {field.isRequired && (
                                  <span className="text-xs text-red-500">
                                    *
                                  </span>
                                )}
                              </div>
                              {field.helpText && (
                                <p className="mt-0.5 text-xs text-gray-400">
                                  {field.helpText}
                                </p>
                              )}
                              {field.options &&
                                field.options.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {field.options.map(
                                      (opt: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="rounded bg-gray-200 px-1.5 py-0.5 text-xs"
                                        >
                                          {opt}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                            <Badge variant="info" className="shrink-0">
                              {FIELD_TYPE_LABELS[field.fieldType] ||
                                field.fieldType}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ========== ASSIGNMENTS TAB ========== */}
          {activeTab === 'assignments' && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Users size={18} className="text-brand-500" />
                    Survey Assignments
                  </CardTitle>
                  <Button size="sm" onClick={openAssignModal}>
                    <Plus size={14} className="mr-1" /> Assign Users / Roles
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Assign multiple users or roles at once. Assigned users can fill
                  this survey from their Assigned Surveys page.
                </p>
              </CardHeader>
              <CardContent>
                {!survey.assignments || survey.assignments.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users
                      size={40}
                      className="mx-auto mb-2 text-gray-300"
                    />
                    <p className="text-sm text-gray-400">
                      No assignments yet. Assign users or roles to this survey.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {survey.assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                              a.user
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-purple-100 text-purple-600'
                            }`}
                          >
                            {a.user
                              ? `${a.user.firstName?.[0]}${a.user.lastName?.[0]}`
                              : a.role?.name?.[0]}
                          </div>
                          <div className="text-sm">
                            {a.user && (
                              <p className="font-medium">
                                {a.user.firstName} {a.user.lastName}
                              </p>
                            )}
                            {a.role && (
                              <p className="font-medium">
                                Role: {a.role.name}
                              </p>
                            )}
                            {a.school && (
                              <p className="text-xs text-gray-400">
                                School: {a.school.name}
                              </p>
                            )}
                            {a.excludeUserIds &&
                              a.excludeUserIds.length > 0 && (
                                <p className="text-xs text-gray-400">
                                  Excluding {a.excludeUserIds.length} users
                                </p>
                              )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove assignment"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ========== STATUS HISTORY TAB ========== */}
          {activeTab === 'history' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History size={18} className="text-gray-500" />
                  Status Change History
                </CardTitle>
                <p className="text-xs text-gray-400 mt-1">
                  Complete timeline of all status transitions for this survey.
                </p>
              </CardHeader>
              <CardContent>
                {statusLogs.length === 0 && !survey ? (
                  <div className="py-8 text-center">
                    <Clock size={40} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">No status changes recorded yet.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Status changes will appear here when the survey status is updated (e.g., Draft → Published).
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 sm:pl-8">
                    {/* Continuous timeline line */}
                    <div className="absolute left-[11px] sm:left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-300 via-gray-200 to-gray-100" />

                    <div className="space-y-6">
                      {/* Status change entries (newest first) */}
                      {statusLogs.map((log, idx) => {
                        const statusBadgeVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
                          draft: 'default',
                          published: 'success',
                          closed: 'warning',
                          archived: 'info',
                        };
                        return (
                          <div key={log.id} className="relative">
                            {/* Timeline dot */}
                            <div
                              className={`absolute -left-6 sm:-left-8 top-3 z-10 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full ring-4 ring-white ${
                                idx === 0
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-200'
                                  : 'bg-gray-300 text-white'
                              }`}
                            >
                              <Clock size={10} />
                            </div>
                            {/* Content card */}
                            <div className={`rounded-xl border p-3 sm:p-4 transition-colors ${
                              idx === 0
                                ? 'border-brand-200 bg-brand-50/30 shadow-sm'
                                : 'border-gray-100 bg-white hover:bg-gray-50/50'
                            }`}>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <Badge variant={statusBadgeVariant[log.fromStatus] || 'default'}>
                                    {log.fromStatus.toUpperCase()}
                                  </Badge>
                                  <span className="text-gray-400 text-sm">→</span>
                                  <Badge variant={statusBadgeVariant[log.toStatus] || 'default'}>
                                    {log.toStatus.toUpperCase()}
                                  </Badge>
                                  {idx === 0 && (
                                    <span className="ml-1 inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                                      LATEST
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 tabular-nums">
                                  {formatDateTime(log.changedAt)}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                                <Users size={12} className="shrink-0" />
                                <span>
                                  Changed by{' '}
                                  <span className="font-medium text-gray-700">
                                    {log.changedBy
                                      ? `${log.changedBy.firstName} ${log.changedBy.lastName}`
                                      : 'Unknown'}
                                  </span>
                                </span>
                              </div>
                              {log.reason && (
                                <p className="mt-1.5 text-xs text-gray-500 italic">
                                  Reason: {log.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Survey Created entry (always last) */}
                      {survey && (
                        <div className="relative">
                          <div className="absolute -left-6 sm:-left-8 top-3 z-10 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-green-400 text-white ring-4 ring-white">
                            <Plus size={10} />
                          </div>
                          <div className="rounded-xl border border-green-100 bg-green-50/30 p-3 sm:p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="success">CREATED</Badge>
                                <span className="text-sm font-medium text-gray-700">
                                  Survey Created
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 tabular-nums">
                                {formatDateTime(survey.createdAt)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                              <Users size={12} className="shrink-0" />
                              <span>
                                Created by{' '}
                                <span className="font-medium text-gray-700">
                                  {survey.createdBy
                                    ? `${survey.createdBy.firstName} ${survey.createdBy.lastName}`
                                    : 'Unknown'}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ========== RESPONSES TAB ========== */}
          {activeTab === 'responses' && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-brand-500" />
                    Survey Responses
                  </CardTitle>
                  <Link href={`/surveys/${id}/responses`}>
                    <Button variant="outline" size="sm">
                      <Eye size={14} className="mr-1" /> View All & Export
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center">
                  <BarChart3
                    size={40}
                    className="mx-auto mb-2 text-gray-300"
                  />
                  <p className="text-2xl font-bold text-gray-900">
                    {totalResponses}
                  </p>
                  <p className="text-sm text-gray-500">
                    Total completed responses
                  </p>
                  <div className="mt-4">
                    <Link href={`/surveys/${id}/responses`}>
                      <Button size="sm">
                        <Eye size={14} className="mr-1" /> View Responses
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Assignment Modal - Multi-Select */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Survey"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Assignment Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAssignType('user');
                  setSelectedRoleIds([]);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  assignType === 'user'
                    ? 'bg-brand-50 text-brand-600 border border-brand-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                Specific Users
              </button>
              <button
                onClick={() => {
                  setAssignType('role');
                  setSelectedUserIds([]);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  assignType === 'role'
                    ? 'bg-brand-50 text-brand-600 border border-brand-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                By Roles
              </button>
            </div>
          </div>

          {assignType === 'user' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Select Users{' '}
                <span className="text-xs text-gray-400">
                  (multi-select — {selectedUserIds.length} selected)
                </span>
              </label>
              <Input
                placeholder="Search users..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {usersList
                  .filter(
                    (u) =>
                      !assignSearch ||
                      `${u.firstName} ${u.lastName} ${u.email}`
                        .toLowerCase()
                        .includes(assignSearch.toLowerCase()),
                  )
                  .map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                          isSelected ? 'bg-brand-50' : ''
                        }`}
                        onClick={() => toggleUserId(u.id)}
                      >
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                            isSelected
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <CheckSquare size={12} />}
                        </div>
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                          {u.firstName?.[0]}
                          {u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {assignType === 'role' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Select Roles{' '}
                <span className="text-xs text-gray-400">
                  (multi-select — {selectedRoleIds.length} selected)
                </span>
              </label>
              <div className="space-y-2">
                {rolesList.map((r) => {
                  const isSelected = selectedRoleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                        isSelected
                          ? 'border-brand-300 bg-brand-50 text-brand-600'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleRoleId(r.id)}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <CheckSquare size={12} />}
                      </div>
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddAssignment} loading={assignSaving}>
              Add{' '}
              {assignType === 'user'
                ? `${selectedUserIds.length} User(s)`
                : `${selectedRoleIds.length} Role(s)`}
            </Button>
          </div>
        </div>
      </Modal>

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
            {confirmModal.title !== 'Cannot Delete' && (
              <Button
                size="sm"
                variant={
                  confirmModal.variant === 'danger' ? 'destructive' : 'default'
                }
                onClick={confirmAction}
              >
                Confirm
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
