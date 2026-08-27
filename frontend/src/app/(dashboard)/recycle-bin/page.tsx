'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Package,
  Users,
  ClipboardList,
  Tag,
  School,
  MapPin,
  ArrowLeft,
  RefreshCw,
  Search,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecycleBinItem {
  id: string;
  entityType: string;
  displayName: string;
  deletedAt: string;
  createdAt: string;
  [key: string]: any;
}

interface RecycleBinData {
  surveys: RecycleBinItem[];
  users: RecycleBinItem[];
  categories: RecycleBinItem[];
  schoolRecords: RecycleBinItem[];
  schools: RecycleBinItem[];
  geoLocations: RecycleBinItem[];
}

const entityConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  survey: { label: 'Surveys', icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  user: { label: 'Users', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  category: { label: 'Categories', icon: Tag, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'school-record': { label: 'School Records', icon: School, color: 'text-green-600', bgColor: 'bg-green-50' },
  school: { label: 'Schools', icon: School, color: 'text-teal-600', bgColor: 'bg-teal-50' },
  'geo-location': { label: 'Geo Locations', icon: MapPin, color: 'text-rose-600', bgColor: 'bg-rose-50' },
};

export default function RecycleBinPage() {
  const router = useRouter();
  const { hasPermission } = useAuthStore();
  const [data, setData] = useState<RecycleBinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'restore' | 'delete';
    entityType: string;
    id: string;
    name: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/recycle-bin');
      setData(res.data);
    } catch {
      // Error handled by empty data state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission('recycle-bin', 'read')) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [fetchData, hasPermission, router]);

  const handleRestore = async (entityType: string, id: string) => {
    setActionLoading(`restore-${id}`);
    try {
      await api.patch(`/recycle-bin/${entityType}/${id}/restore`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Restore failed');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handlePermanentDelete = async (entityType: string, id: string) => {
    setActionLoading(`delete-${id}`);
    try {
      await api.delete(`/recycle-bin/${entityType}/${id}`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Permanent delete failed');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const getAllItems = (): RecycleBinItem[] => {
    if (!data) return [];
    return [
      ...data.surveys,
      ...data.users,
      ...data.categories,
      ...data.schoolRecords,
      ...data.schools,
      ...data.geoLocations,
    ];
  };

  const getFilteredItems = (): RecycleBinItem[] => {
    let items = getAllItems();
    if (activeTab !== 'all') {
      items = items.filter((item) => item.entityType === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        item.displayName.toLowerCase().includes(q),
      );
    }
    return items.sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
    );
  };

  const totalCount = getAllItems().length;
  const filteredItems = getFilteredItems();

  const tabs = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'survey', label: 'Surveys', count: data?.surveys?.length || 0 },
    { key: 'user', label: 'Users', count: data?.users?.length || 0 },
    { key: 'category', label: 'Categories', count: data?.categories?.length || 0 },
    { key: 'school-record', label: 'School Records', count: data?.schoolRecords?.length || 0 },
    { key: 'school', label: 'Schools', count: data?.schools?.length || 0 },
    { key: 'geo-location', label: 'Locations', count: data?.geoLocations?.length || 0 },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  confirmAction.type === 'delete'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600',
                )}
              >
                {confirmAction.type === 'delete' ? (
                  <AlertTriangle size={20} />
                ) : (
                  <RotateCcw size={20} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmAction.type === 'delete'
                    ? 'Permanently Delete'
                    : 'Restore Item'}
                </h3>
                <p className="text-sm text-gray-500">
                  {confirmAction.type === 'delete'
                    ? 'This action cannot be undone.'
                    : 'Item will be restored to its original location.'}
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-700">
              Are you sure you want to{' '}
              {confirmAction.type === 'delete'
                ? 'permanently delete'
                : 'restore'}{' '}
              <strong>{confirmAction.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmAction.type === 'delete'
                    ? handlePermanentDelete(
                        confirmAction.entityType,
                        confirmAction.id,
                      )
                    : handleRestore(confirmAction.entityType, confirmAction.id)
                }
                disabled={actionLoading !== null}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white',
                  confirmAction.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700',
                  actionLoading && 'opacity-50',
                )}
              >
                {actionLoading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {confirmAction.type === 'delete'
                  ? 'Delete Forever'
                  : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
            <p className="mt-1 text-sm text-gray-500">
              {totalCount} deleted {totalCount === 1 ? 'item' : 'items'} — Review and restore or permanently remove
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.key === 'all' || t.count > 0)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deleted items..."
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16">
          <Package size={48} className="mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-500">
            Recycle bin is empty
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            Deleted items will appear here for review
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const config = entityConfig[item.entityType] || {
              label: item.entityType,
              icon: Package,
              color: 'text-gray-600',
              bgColor: 'bg-gray-50',
            };
            const Icon = config.icon;
            return (
              <div
                key={`${item.entityType}-${item.id}`}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      config.bgColor,
                      config.color,
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.displayName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-medium',
                          config.bgColor,
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                      <span>
                        Deleted{' '}
                        {new Date(item.deletedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: 'restore',
                        entityType: item.entityType,
                        id: item.id,
                        name: item.displayName,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    <RotateCcw size={13} />
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: 'delete',
                        entityType: item.entityType,
                        id: item.id,
                        name: item.displayName,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
