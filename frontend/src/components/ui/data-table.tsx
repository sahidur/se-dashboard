'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  hidden?: boolean;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  actions?: (item: T) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  title?: string;
  titleIcon?: React.ReactNode;
  badge?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  actions,
  searchable = false,
  searchPlaceholder = 'Search...',
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  title,
  titleIcon,
  badge,
  onRefresh,
  refreshing = false,
  onRowClick,
  rowClassName,
  footer,
  headerExtra,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const visibleColumns = useMemo(() => columns.filter((c) => !c.hidden), [columns]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    // Search across ALL columns (including hidden ones) — restricting the
    // match to visible columns made records appear "missing" from search.
    return data.filter((item) =>
      Object.entries(item).some(([, val]) => {
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ChevronsUpDown size={14} className="ml-1 shrink-0 text-gray-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="ml-1 shrink-0 text-brand-500" />
    ) : (
      <ChevronDown size={14} className="ml-1 shrink-0 text-brand-500" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      {(title || searchable || onRefresh) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {titleIcon && <span className="shrink-0 text-brand-600">{titleIcon}</span>}
            {title && <h3 className="text-sm font-semibold text-gray-800 truncate">{title}</h3>}
            {badge}
            {headerExtra}
          </div>
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs shadow-sm transition-all placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-48"
                />
              </div>
            )}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="gap-1.5 h-8 text-xs">
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
            <p className="text-xs text-gray-400">Loading...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/50">
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap',
                        col.sortable !== false && 'cursor-pointer select-none hover:text-gray-700',
                        col.className,
                      )}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                    >
                      <span className="flex items-center">
                        {col.header}
                        {col.sortable !== false && <SortIcon colKey={col.key} />}
                      </span>
                    </th>
                  ))}
                  {actions && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {emptyIcon || (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                            <Search size={18} className="text-gray-400" />
                          </div>
                        )}
                        <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, index) => (
                    <tr
                      key={item.id || index}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        'border-b border-gray-50 transition-colors duration-150',
                        onRowClick && 'cursor-pointer',
                        'hover:bg-brand-50/30 even:bg-gray-50/30',
                        rowClassName?.(item),
                      )}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn('px-4 py-3 text-sm text-gray-700', col.className)}
                        >
                          {col.render ? col.render(item) : item[col.key]}
                        </td>
                      ))}
                      {actions && (
                        <td className="px-4 py-3 text-right text-sm">
                          {actions(item)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: pagination + page size */}
          {sortedData.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{sortedData.length}</span> record{sortedData.length !== 1 ? 's' : ''}
                </p>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (safePage <= 3) {
                      pageNum = i + 1;
                    } else if (safePage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = safePage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-1 text-xs font-medium transition-colors',
                          safePage === pageNum
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {footer && <div className="border-t border-gray-100">{footer}</div>}
        </div>
      )}
    </div>
  );
}
