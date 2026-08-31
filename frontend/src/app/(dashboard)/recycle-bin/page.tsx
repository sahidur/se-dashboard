'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api, { getErrorMessage } from '@/lib/api';
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
  GraduationCap,
  Presentation,
  Trophy,
  Activity,
  BarChart3,
  PieChart,
  CalendarCheck,
  Medal,
  Banknote,
  HardHat,
  Wallet,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecycleBinItem {
  id: string;
  entityType: string;
  displayName: string;
  deletedAt: string;
  createdAt: string;
  [key: string]: unknown;
}

interface RecycleBinData {
  surveys: RecycleBinItem[];
  users: RecycleBinItem[];
  categories: RecycleBinItem[];
  schoolRecords: RecycleBinItem[];
  schools: RecycleBinItem[];
  geoLocations: RecycleBinItem[];
  [key: string]: RecycleBinItem[] | undefined;
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
  'dc-alumni': { label: 'Alumni', icon: GraduationCap, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  'dc-teacher-individual': { label: 'Teacher Individual', icon: Presentation, color: 'text-sky-600', bgColor: 'bg-sky-50' },
  'dc-pedagogical-achievement': { label: 'Pedagogical Achievement', icon: Trophy, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
  'dc-cocurricular': { label: 'Co-Curricular', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  'dc-students-performance': { label: 'Students Performance', icon: BarChart3, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  'dc-student-performance': { label: 'Student Performance', icon: PieChart, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  'dc-activity-participation': { label: 'Activity Participation', icon: CalendarCheck, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  'dc-event-participation': { label: 'Event Participation', icon: Medal, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'dc-fee-structure': { label: 'Fee Structure', icon: Banknote, color: 'text-lime-600', bgColor: 'bg-lime-50' },
  'dc-infrastructure': { label: 'Infrastructure & Classroom', icon: HardHat, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  'dc-students-info': { label: 'Students Information', icon: GraduationCap, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  'dc-teachers-development': { label: 'Teachers Development', icon: Presentation, color: 'text-rose-600', bgColor: 'bg-rose-50' },
  'dc-revenue-budget-total': { label: 'Planned Revenue (Total)', icon: Wallet, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  'dc-revenue-budget-monthly': { label: 'Planned Revenue (Monthly)', icon: CalendarDays, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'dc-revenue-actual-total': { label: 'Actual Revenue (Total)', icon: Wallet, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  'dc-revenue-actual-monthly': { label: 'Actual Revenue (Monthly)', icon: CalendarDays, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
};

const DC_ENTITY_TYPES = [
  'dc-alumni',
  'dc-teacher-individual',
  'dc-pedagogical-achievement',
  'dc-cocurricular',
  'dc-students-performance',
  'dc-student-performance',
  'dc-activity-participation',
  'dc-event-participation',
  'dc-fee-structure',
  'dc-infrastructure',
  'dc-students-info',
  'dc-teachers-development',
  'dc-revenue-budget-total',
  'dc-revenue-budget-monthly',
  'dc-revenue-actual-total',
  'dc-revenue-actual-monthly',
] as const;

const ITEM_META_KEYS = [
  'id',
  'entityType',
  'displayName',
  'deletedAt',
  'createdAt',
  'updatedAt',
];

const txt = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
};

const firstTxt = (...values: unknown[]): string => {
  for (const value of values) {
    const s = txt(value);
    if (s) return s;
  }
  return '';
};

const joinTxt = (...values: unknown[]): string =>
  values
    .map((value) => txt(value))
    .filter(Boolean)
    .join(' • ');

const shortId = (id?: unknown): string =>
  txt(id) ? `#${txt(id).slice(0, 8)}` : '#item';

const yearLabel = (item: RecycleBinItem): string => {
  const year = txt(item.academicYear);
  return year ? `Year ${year}` : '';
};

const genericFallback = (item: RecycleBinItem): string => {
  const values = Object.entries(item)
    .filter(
      ([key, value]) =>
        !ITEM_META_KEYS.includes(key) &&
        (typeof value === 'string' || typeof value === 'number'),
    )
    .map(([, value]) => txt(value))
    .filter(Boolean)
    .slice(0, 4);
  return values.join(' • ') || shortId(item.id);
};

const getItemLabels = (
  entityType: string,
  item: RecycleBinItem,
): { title: string; meta: string } => {
  const baseMeta = () => joinTxt(yearLabel(item), item.month, item.grade);

  switch (entityType) {
    case 'dc-alumni': {
      const completionYear = firstTxt(item.passingYear, item.completionYear);
      return {
        title:
          firstTxt(item.name, item.studentName, item.fullName) ||
          genericFallback(item),
        meta: joinTxt(
          completionYear ? `Class of ${completionYear}` : '',
          item.grade,
          item.occupation,
        ),
      };
    }
    case 'dc-teacher-individual':
      return {
        title:
          firstTxt(item.teacherName, item.staffName, item.name) ||
          genericFallback(item),
        meta: joinTxt(baseMeta(), item.subject, item.designation),
      };
    case 'dc-pedagogical-achievement':
      return {
        title:
          firstTxt(item.achievementName, item.title, item.name) ||
          genericFallback(item),
        meta: joinTxt(baseMeta(), item.awardLevel, item.category),
      };
    case 'dc-cocurricular':
      return {
        title:
          firstTxt(item.itemName, item.activityName, item.name, item.title) ||
          genericFallback(item),
        meta: baseMeta(),
      };
    case 'dc-students-performance':
    case 'dc-student-performance': {
      const totalMarks = txt(item.totalMarks);
      const scored = firstTxt(item.obtainedMarks, item.marksObtained);
      return {
        title:
          firstTxt(
            item.examName,
            item.formKey,
            item.particulars,
            item.title,
            item.name,
          ) || genericFallback(item),
        meta: joinTxt(
          baseMeta(),
          totalMarks ? `Total ${totalMarks}` : '',
          scored ? `Scored ${scored}` : '',
        ),
      };
    }
    case 'dc-activity-participation':
      return {
        title:
          firstTxt(
            item.cornersActivityName,
            item.activityName,
            item.name,
            item.title,
          ) || genericFallback(item),
        meta: joinTxt(baseMeta(), item.participants, item.totalParticipants),
      };
    case 'dc-event-participation':
      return {
        title:
          firstTxt(item.eventName, item.eventTitle, item.name, item.title) ||
          genericFallback(item),
        meta: joinTxt(item.awardLevel, baseMeta()),
      };
    case 'dc-fee-structure': {
      const tuition = txt(item.tuitionFee);
      const total = txt(item.total);
      return {
        title:
          firstTxt(item.feeName, item.name, item.title) ||
          joinTxt(item.grade, item.month, yearLabel(item)) ||
          genericFallback(item),
        meta: joinTxt(
          baseMeta(),
          tuition ? `Tuition ${tuition}` : '',
          total ? `Total ${total}` : '',
        ),
      };
    }
    case 'dc-infrastructure':
      return {
        title:
          firstTxt(item.campusStatus) || 'Infrastructure & Classroom record',
        meta: joinTxt(baseMeta(), item.roomTotal ? `Total Rooms ${item.roomTotal}` : ''),
      };
    case 'dc-students-info':
      return {
        title: firstTxt(item.grade) || 'Students Information record',
        meta: joinTxt(baseMeta(), item.total ? `Total ${item.total}` : ''),
      };
    case 'dc-teachers-development':
      return {
        title: firstTxt(item.month) || 'Development record',
        meta: baseMeta(),
      };
    case 'dc-revenue-budget-total':
      return { title: 'Planned Revenue Collection (Total)', meta: baseMeta() };
    case 'dc-revenue-budget-monthly':
      return {
        title: firstTxt(item.month) || 'Planned Revenue Collection (Monthly)',
        meta: joinTxt(baseMeta(), item.collectionPct ? `${item.collectionPct}% collected` : ''),
      };
    case 'dc-revenue-actual-total':
      return { title: 'Actual Revenue Collection (Total)', meta: baseMeta() };
    case 'dc-revenue-actual-monthly':
      return {
        title: firstTxt(item.month) || 'Actual Revenue Collection (Monthly)',
        meta: joinTxt(baseMeta(), item.collectionPct ? `${item.collectionPct}% collected` : ''),
      };
    default:
      return {
        title: txt(item.displayName) || genericFallback(item),
        meta: '',
      };
  }
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
    } catch (err) {
      alert(getErrorMessage(err, 'Restore failed'));
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
    } catch (err) {
      alert(getErrorMessage(err, 'Permanent delete failed'));
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const getAllItems = (): RecycleBinItem[] => {
    if (!data) return [];
    return Object.values(data).flatMap((items) => items ?? []);
  };

  const getFilteredItems = (): RecycleBinItem[] => {
    let items = getAllItems();
    if (activeTab !== 'all') {
      items = items.filter((item) => item.entityType === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item) => {
        const labels = getItemLabels(item.entityType, item);
        return (
          item.displayName.toLowerCase().includes(q) ||
          labels.title.toLowerCase().includes(q) ||
          labels.meta.toLowerCase().includes(q)
        );
      });
    }
    return items.sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
    );
  };

  const totalCount = getAllItems().length;
  const filteredItems = getFilteredItems();

  const countByType: Record<string, number> = {};
  getAllItems().forEach((item) => {
    countByType[item.entityType] = (countByType[item.entityType] || 0) + 1;
  });

  const tabs = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'survey', label: 'Surveys', count: countByType['survey'] || 0 },
    { key: 'user', label: 'Users', count: countByType['user'] || 0 },
    {
      key: 'category',
      label: 'Categories',
      count: countByType['category'] || 0,
    },
    {
      key: 'school-record',
      label: 'School Records',
      count: countByType['school-record'] || 0,
    },
    { key: 'school', label: 'Schools', count: countByType['school'] || 0 },
    {
      key: 'geo-location',
      label: 'Locations',
      count: countByType['geo-location'] || 0,
    },
    ...DC_ENTITY_TYPES.map((key) => ({
      key,
      label: entityConfig[key].label,
      count: countByType[key] || 0,
    })),
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
            const labels = getItemLabels(item.entityType, item);
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
                      {labels.title}
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
                      {labels.meta && <span>{labels.meta}</span>}
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
                        name: labels.title,
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
                        name: labels.title,
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
