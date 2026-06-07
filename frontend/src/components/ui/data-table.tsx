'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onSearch?: (query: string) => void;
  searchValue?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  actions,
  searchable = false,
  searchPlaceholder = 'Search...',
  pagination,
  onSearch,
  searchValue,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const search = searchValue !== undefined ? searchValue : internalSearch;
  const setSearch = onSearch || setInternalSearch;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredData = useMemo(() => {
    if (onSearch || !search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = item[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search, onSearch, columns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ChevronsUpDown size={14} className="ml-1 text-gray-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="ml-1 text-brand-500" />
    ) : (
      <ChevronDown size={14} className="ml-1 text-brand-500" />
    );
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm shadow-sm transition-all placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
            <p className="text-sm text-gray-400 animate-pulse">Loading data...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/50">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500',
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
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (actions ? 1 : 0)}
                      className="px-5 py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <Search size={20} className="text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                        <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className="border-b border-gray-50 transition-colors duration-150 hover:bg-brand-50/30 even:bg-gray-50/30"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-5 py-3.5 text-sm text-gray-700',
                            col.className,
                          )}
                        >
                          {col.render ? col.render(item) : item[col.key]}
                        </td>
                      ))}
                      {actions && (
                        <td className="px-5 py-3.5 text-right text-sm">
                          {actions(item)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3">
              <p className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{pagination.page}</span> of{' '}
                <span className="font-semibold text-gray-700">{pagination.totalPages}</span>
                {pagination.total > 0 && (
                  <span className="ml-1">({pagination.total} total)</span>
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => pagination.onPageChange(pageNum)}
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                        pagination.page === pageNum
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
