'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Save, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { useSchools, useAcademicYears, formatBDT } from '@/components/fee/filters';

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

interface FeeHeadRow {
  id: string;
  name: string;
  isActive: boolean;
  category?: string | null;
  feeSchedule?: 'yearly' | 'half_yearly' | 'monthly';
}

// Yearly heads are charged only in January, half-yearly heads only in July.
const scheduleMonths = (schedule: string | undefined): number[] => {
  if (schedule === 'yearly') return [1];
  if (schedule === 'half_yearly') return [7];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
};

const scheduleLabel = (schedule: string | undefined): string | null => {
  if (schedule === 'yearly') return 'Yearly · Jan only';
  if (schedule === 'half_yearly') return 'Half-yearly · Jul only';
  return null;
};

interface FeeStructureRow {
  id: string;
  month: number;
  amount: string;
  feeHead: { id: string; name: string };
}

const MONTHS = [
  { value: 1, label: 'Jan', full: 'January' },
  { value: 2, label: 'Feb', full: 'February' },
  { value: 3, label: 'Mar', full: 'March' },
  { value: 4, label: 'Apr', full: 'April' },
  { value: 5, label: 'May', full: 'May' },
  { value: 6, label: 'Jun', full: 'June' },
  { value: 7, label: 'Jul', full: 'July' },
  { value: 8, label: 'Aug', full: 'August' },
  { value: 9, label: 'Sep', full: 'September' },
  { value: 10, label: 'Oct', full: 'October' },
  { value: 11, label: 'Nov', full: 'November' },
  { value: 12, label: 'Dec', full: 'December' },
];

const selectClass =
  'w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300';

export default function FeeStructurePage() {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();

  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHeadRow[]>([]);

  // amounts[feeHeadId] = string — one entry grid shared by all selected months
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [existing, setExisting] = useState<Record<number, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Derived defaults (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');
  const activeYearId =
    (academicYearId || (years.find((y) => y.status === 'active') ?? years[0])?.id) ?? '';
  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  // Only the selected school's category fee heads apply to its fee structure
  const visibleFeeHeads = useMemo(
    () =>
      feeHeads.filter(
        (h) => !h.category || !activeSchool?.schoolCategory || h.category === activeSchool.schoolCategory,
      ),
    [feeHeads, activeSchool],
  );

  // Reset class when the school changes (render-time adjustment)
  const [lastSchool, setLastSchool] = useState(activeSchoolId);
  if (lastSchool !== activeSchoolId) {
    setLastSchool(activeSchoolId);
    setClassId('');
  }

  useEffect(() => {
    if (!activeSchoolId) return;
    api
      .get(`/students/classes?schoolId=${activeSchoolId}&activeOnly=true`)
      .then(({ data }) => setClasses(data))
      .catch(() => setClasses([]));
  }, [activeSchoolId]);

  useEffect(() => {
    api
      .get('/fee-heads?activeOnly=true')
      .then(({ data }) => setFeeHeads(data))
      .catch(() => setFeeHeads([]));
  }, []);

  useEffect(() => {
    if (!activeSchoolId || !activeYearId || !classId) {
      setExisting({});
      return;
    }
    api
      .get(`/fee-structures?schoolId=${activeSchoolId}&academicYearId=${activeYearId}&classId=${classId}`)
      .then(({ data }: { data: FeeStructureRow[] }) => {
        const next: Record<number, Record<string, number>> = {};
        for (const row of data) {
          next[row.month] = next[row.month] ?? {};
          next[row.month][row.feeHead.id] = parseFloat(row.amount);
        }
        setExisting(next);
      })
      .catch(() => setExisting({}));
  }, [activeSchoolId, activeYearId, classId]);

  // Single selected month with saved data → load it into the entry grid for editing
  useEffect(() => {
    if (selectedMonths.length !== 1) return;
    const monthData = existing[selectedMonths[0]];
    if (!monthData) {
      setAmounts({});
      return;
    }
    const next: Record<string, string> = {};
    for (const h of visibleFeeHeads) {
      next[h.id] = monthData[h.id] !== undefined ? String(monthData[h.id]) : '';
    }
    setAmounts(next);
  }, [selectedMonths, existing, visibleFeeHeads]);

  const hasData = (m: number) => Object.keys(existing[m] ?? {}).length > 0;
  const editingExisting =
    selectedMonths.length === 1 &&
    selectedMonths.some((m) => Object.keys(existing[m] ?? {}).length > 0);

  const setValue = (headId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [headId]: value }));
  };

  const toggleMonth = (m: number) => {
    setSuccess('');
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );
  };

  const monthTotal = visibleFeeHeads.reduce(
    (sum, h) => sum + (parseFloat(amounts[h.id] ?? '0') || 0),
    0,
  );

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!activeYearId) { setError('Select an academic year first.'); return; }
    if (!classId) { setError('Select a class first.'); return; }
    if (selectedMonths.length === 0) { setError('Select at least one month.'); return; }

    const allLines = visibleFeeHeads
      .map((h) => ({ feeHeadId: h.id, amount: parseFloat(amounts[h.id] ?? '0') || 0, schedule: h.feeSchedule }))
      .filter((l) => l.amount > 0);

    // a yearly/half-yearly amount is only valid when its charging month is selected
    const yearly = allLines.find((l) => l.schedule === 'yearly');
    if (yearly && !selectedMonths.includes(1)) {
      setError('A yearly fee head has an amount — select January so it is charged there (yearly heads apply only in January).');
      return;
    }
    const halfYearly = allLines.find((l) => l.schedule === 'half_yearly');
    if (halfYearly && !selectedMonths.includes(7)) {
      setError('A half-yearly fee head has an amount — select July so it is charged there (half-yearly heads apply only in July).');
      return;
    }

    setSaving(true);
    try {
      for (const month of selectedMonths) {
        // schedule enforcement: yearly heads only reach January, half-yearly only July
        const lines = allLines
          .filter((l) => scheduleMonths(l.schedule).includes(month))
          .map(({ feeHeadId, amount }) => ({ feeHeadId, amount }));
        await api.post('/fee-structures', {
          schoolId: activeSchoolId,
          academicYearId: activeYearId,
          classId,
          month,
          lines,
        });
      }
      // refresh saved data for the saved months
      const { data } = await api.get(
        `/fee-structures?schoolId=${activeSchoolId}&academicYearId=${activeYearId}&classId=${classId}`,
      );
      const next: Record<number, Record<string, number>> = { ...existing };
      for (const row of data as FeeStructureRow[]) {
        next[row.month] = next[row.month] ?? {};
        next[row.month][row.feeHead.id] = parseFloat(row.amount);
      }
      setExisting(next);
      setSuccess(
        `Fee structure saved for ${selectedMonths
          .map((m) => MONTHS.find((x) => x.value === m)?.full)
          .filter(Boolean)
          .join(', ')}.`,
      );
      if (selectedMonths.length === 1) {
        const monthData: Record<string, string> = {};
        for (const row of data as FeeStructureRow[]) {
          if (row.month === selectedMonths[0]) monthData[row.feeHead.id] = String(parseFloat(row.amount));
        }
        setAmounts(monthData);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save fee structure'));
    } finally {
      setSaving(false);
    }
  };

  const yearName = years.find((y) => y.id === activeYearId)?.name ?? '';

  return (
    <>
      <Header
        title="Fee Structure"
        subtitle="Monthly fee structure per class and fee head — all sections inherit the same fee"
      />
      <div className="page-container space-y-5">
        {/* ── Selection card (School / Year / Class) ── */}
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">School</Label>
              <div className="relative">
                <select value={activeSchoolId} onChange={(e) => setSchoolId(e.target.value)} className={selectClass}>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-gray-400" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">Academic Year</Label>
              <div className="relative">
                <select value={activeYearId} onChange={(e) => setAcademicYearId(e.target.value)} className={selectClass}>
                  <option value="">Choose an academic year...</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-gray-400" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-600">Select Class</Label>
              <div className="relative">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectClass}>
                  <option value="">Choose a class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {visibleFeeHeads.length === 0 && activeSchoolId ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <p className="text-sm text-amber-700">
              No fee heads configured for this school&apos;s category. Create fee heads first under Fee Collection → Fee Heads.
            </p>
          </div>
        ) : null}

        {!classId || visibleFeeHeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 text-gray-400 shadow-sm">
            <FileSpreadsheet size={48} className="mb-3" />
            <p>Select a class to configure the monthly fee grid</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Card className="overflow-hidden border-0 shadow-sm">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold text-gray-800">Fee Structure Entry</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={16} className="shrink-0 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-700">{success}</p>
                  </div>
                )}

                {/* Academic Year */}
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                    Academic Year <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative max-w-xs">
                    <select
                      value={activeYearId}
                      onChange={(e) => setAcademicYearId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Choose an academic year...</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-gray-400" />
                  </div>
                </div>

                {/* Month multi-select pills */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">
                      Select Months <span className="text-red-500">*</span>
                      <span className="ml-2 font-normal text-gray-400">({selectedMonths.length} selected)</span>
                    </Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMonths(MONTHS.map((m) => m.value))}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button type="button" onClick={() => setSelectedMonths([])} className="text-xs text-gray-400 hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MONTHS.map((m) => {
                      const selected = selectedMonths.includes(m.value);
                      const done = hasData(m.value);
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => toggleMonth(m.value)}
                          className={`relative rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            selected
                              ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'
                          }`}
                        >
                          {m.label}
                          {done && (
                            <span
                              className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                                selected ? 'bg-emerald-300' : 'bg-emerald-500'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Green dot = data already saved for that month. Selecting multiple months saves the same fee amounts for all.
                  </p>
                </div>

                {/* Amounts */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {visibleFeeHeads.map((h) => {
                    const sched = scheduleLabel(h.feeSchedule);
                    return (
                      <div key={h.id}>
                        <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                          {h.name}
                          {sched && <span className="ml-1 font-normal text-amber-600">({sched})</span>}
                        </Label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amounts[h.id] ?? ''}
                            onChange={(e) => setValue(h.id, e.target.value)}
                            placeholder="BDT"
                            disabled={!activeYearId || selectedMonths.length === 0}
                            className="h-10 w-full rounded-lg border border-gray-300 pr-12 pl-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                          />
                          <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-gray-400">BDT</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-500">
                    Base total per month:{' '}
                    <strong className="text-gray-900">BDT {formatBDT(monthTotal)}</strong>
                  </p>
                  <div className="flex items-center gap-3">
                    {editingExisting && (
                      <p className="text-xs font-medium text-amber-600">
                        Editing existing data for{' '}
                        {selectedMonths.map((m) => MONTHS.find((x) => x.value === m)?.full).join(', ')} {yearName}
                      </p>
                    )}
                    <Button type="submit" disabled={saving || !classId || selectedMonths.length === 0}>
                      {saving ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-1.5" />
                          Save Fee Structure
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
              <FileSpreadsheet size={13} className="mt-0.5 shrink-0" />
              Leave a fee head as 0/empty to not charge it. Yearly heads are charged only in January and half-yearly heads
              only in July — their amount is saved to that month automatically. Historical student fees already generated
              are never changed.
            </p>
          </form>
        )}
      </div>
    </>
  );
}