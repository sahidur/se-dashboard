'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  School, Users, GraduationCap, MapPin, Phone, Mail,
  Building2, Award, TrendingUp, Wallet, Search, RefreshCw,
  CalendarDays, ShieldCheck, ShieldX, BookOpen, Filter, ChevronRight,
  ArrowLeft, Layers, X,
} from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────── */

interface SchoolListItem {
  id: string;
  name: string;
  code: string;
  address?: string;
  district?: string;
  division?: string;
  upazila?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  establishedYear?: number;
  schoolType?: string;
  schoolCategory?: string;
  governmentApproval?: boolean;
  totalTeachers?: number;
  totalStudents?: number;
  gradeCoverage?: string;
}

interface InfraData {
  campusStatus?: string;
  buildingStatus?: string;
  roomHeadTeachers: number; roomTeachers: number; roomClassroom: number;
  roomPlayroom: number; roomLibrary: number; roomLab: number;
  roomStoreroom: number; roomKitchen: number; roomSickbay: number;
  roomOthers: number; roomTotal: number;
  washroomMale: number; washroomFemale: number;
  hasHandWashPoint: boolean; hasPlayground: boolean; hasSchoolGarden: boolean;
  infraRenovationRequired: boolean;
  digitallyEquippedClassrooms: number; floorSittingClassrooms: number;
  classroomsWithWhiteboard: number; classroomsWithBlackboard: number;
  classroomNewFurniture: boolean; classroomRenovationRequired: boolean;
}

interface StudentRow {
  id: string; grade: string; month: string;
  boys: number; girls: number; total: number;
  personsWithDisability: number; ethnic: number;
}

interface TeacherRow {
  id: string; name: string; designation?: string; gender?: string;
  educationalQualification?: string; experienceYears?: number; subjectExpertise?: string;
}

interface FeeRow {
  id: string; month: string; grade: string;
  admissionFee: number; tuitionFee: number; sessionFee: number;
  assessmentFee: number; sportsFee: number; othersFee: number; transportFee: number;
}

interface PedagAchievementRow {
  id: string; year: number;
  kgScholarship: number; primaryScholarship: number; jrScholarship: number;
  sscScholarship: number; othersScholarship: number;
}

interface AlumniRow {
  id: string; alumniName: string; graduationYear?: number;
  currentOccupation?: string; higherEducation?: string;
  institution?: string; contactPhone?: string;
}

interface SchoolProfile {
  school: SchoolListItem;
  infrastructure: InfraData | null;
  students: StudentRow[];
  studentTotals: { boys: number; girls: number; pwd: number; ethnic: number; total: number };
  teachers: TeacherRow[];
  teacherTotals: { male: number; female: number; total: number };
  feeStructures: FeeRow[];
  revenueBudgetTotal: Record<string, any> | null;
  revenueActualTotal: Record<string, any> | null;
  pedagogicalAchievements: PedagAchievementRow[];
  performance: Record<string, any> | null;
  alumni: AlumniRow[];
  meta: { categoriesWithData: number; totalCategories: number };
}

/* ─── Constants / helpers ───────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
};

const TYPE_LABELS: Record<string, string> = {
  plain_land: 'Plain Land',
  haor: 'Haor',
};

const GRADE_LABELS: Record<string, string> = {
  play_learn: 'Play & Learn', nursery: 'Nursery',
  g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3', g4: 'Grade 4', g5: 'Grade 5',
  Play: 'Play',
};
const gradeLabel = (g: string) => GRADE_LABELS[g] ?? g;

const GRADE_ORDER = ['play_learn', 'nursery', 'g1', 'g2', 'g3', 'g4', 'g5',
  'Play', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
const sortByGrade = <T extends { grade: string }>(rows: T[]) =>
  [...rows].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a.grade); const ib = GRADE_ORDER.indexOf(b.grade);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

const categoryLabel = (c?: string) => (c ? CATEGORY_LABELS[c] ?? c : '—');
const typeLabel = (t?: string) => (t ? TYPE_LABELS[t] ?? t : '—');

const fmtTaka = (n: number) =>
  n >= 10_000_000 ? `৳${(n / 10_000_000).toFixed(2)} Cr` :
  n >= 100_000 ? `৳${(n / 100_000).toFixed(1)} L` :
  n >= 1_000 ? `৳${(n / 1_000).toFixed(1)}K` : `৳${n}`;

const yn = (b?: boolean | null) => (b == null ? '—' : b ? 'Yes' : 'No');

/* ─── Placeholder grade (until a real rating system exists) ─
   Derived from how many of the 6 form categories carry data. */
type GradeName = 'Green' | 'Yellow' | 'Orange';
interface GradeStyle {
  panel: string; glow: string; text: string; ring: string; sub: string;
}
const GRADE_STYLES: Record<GradeName, GradeStyle> = {
  Green: {
    panel: 'bg-gradient-to-br from-green-100 via-emerald-50 to-green-100',
    glow: 'bg-green-300/40', text: 'text-green-600', ring: 'ring-green-200', sub: 'text-green-500',
  },
  Yellow: {
    panel: 'bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-100',
    glow: 'bg-yellow-300/40', text: 'text-yellow-600', ring: 'ring-yellow-200', sub: 'text-yellow-500',
  },
  Orange: {
    panel: 'bg-gradient-to-br from-orange-100 via-orange-50 to-amber-100',
    glow: 'bg-orange-300/40', text: 'text-orange-600', ring: 'ring-orange-200', sub: 'text-orange-500',
  },
};
const computeGrade = (withData: number, total: number): GradeName => {
  const pct = total > 0 ? withData / total : 0;
  if (pct >= 0.67) return 'Green';
  if (pct >= 0.34) return 'Yellow';
  return 'Orange';
};

/* ─── Grade badge (animated faded background) ───────────── */

function GradeBadge({ grade, withData, total }: { grade: GradeName; withData: number; total: number }) {
  const s = GRADE_STYLES[grade];
  return (
    <div className={`relative flex h-full min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl ring-1 ${s.ring} ${s.panel} p-6`}>
      {/* animated faded shade */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full ${s.glow} blur-2xl animate-pulse`} />
      <div className={`pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full ${s.glow} blur-2xl animate-pulse [animation-delay:700ms]`} />
      <div className="relative flex flex-col items-center text-center">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${s.sub}`}>Grade</span>
        <span className={`mt-1 text-5xl font-black tracking-tight ${s.text} drop-shadow-sm`}>{grade}</span>
        <span className="mt-3 text-[11px] font-medium text-gray-500">
          {withData}/{total} categories reported
        </span>
      </div>
    </div>
  );
}

/* ─── Generic table (matches Programme Overview breakdown) ─ */

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: any, idx: number) => React.ReactNode;
}

function CategoryTable({
  title, icon: Icon, accent, count, columns, rows, footer, emptyText,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  count?: number;
  columns: Col[];
  rows: any[];
  footer?: React.ReactNode[] | null;
  emptyText: string;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <CardHeader className="px-5 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon size={15} className="text-gray-500" />
          {title}
          {count != null && <Badge variant="default" className="ml-1">{count}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-gray-100 bg-gray-50">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 first:pl-5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.id ?? idx} className="transition-colors hover:bg-indigo-50/30">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`py-3 px-3 first:pl-5 ${c.align === 'right' ? 'text-right text-gray-700' : 'text-left text-gray-700'}`}
                      >
                        {c.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {footer && (
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr className="font-semibold text-gray-800">
                    {footer.map((cell, i) => (
                      <td
                        key={i}
                        className={`py-3 px-3 first:pl-5 ${columns[i]?.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Filter select ─────────────────────────────────────── */

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */

export default function SchoolInformationPage() {
  const [schools, setSchools] = useState<SchoolListItem[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  const [search, setSearch] = useState('');
  const [fCategory, setFCategory] = useState('all');
  const [fType, setFType] = useState('all');
  const [fDivision, setFDivision] = useState('all');
  const [fDistrict, setFDistrict] = useState('all');
  const [fUpazila, setFUpazila] = useState('all');
  const [fApproval, setFApproval] = useState('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Preselect from URL (?school=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('school');
    if (p) setSelectedId(p);
  }, []);

  useEffect(() => {
    api.get('/data-collection/schools')
      .then(({ data }) => setSchools(data?.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSchools(false));
  }, []);

  const loadProfile = useCallback((id: string) => {
    setLoadingProfile(true);
    setProfile(null);
    api.get(`/data-collection/schools/${id}/profile`)
      .then(({ data }) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    if (selectedId) loadProfile(selectedId);
  }, [selectedId, loadProfile]);

  /* ── Filter option lists (derived from data) ── */
  const categoryOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.schoolCategory).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Categories' },
      ...[...set].map((v) => ({ value: v, label: categoryLabel(v) }))];
  }, [schools]);

  const typeOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.schoolType).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Types' },
      ...[...set].map((v) => ({ value: v, label: typeLabel(v) }))];
  }, [schools]);

  const divisionOptions = useMemo(() => {
    const set = new Set(schools.map((s) => s.division).filter(Boolean) as string[]);
    return [{ value: 'all', label: 'All Divisions' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools]);

  const districtOptions = useMemo(() => {
    const set = new Set(
      schools
        .filter((s) => fDivision === 'all' || s.division === fDivision)
        .map((s) => s.district).filter(Boolean) as string[],
    );
    return [{ value: 'all', label: 'All Districts' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools, fDivision]);

  const upazilaOptions = useMemo(() => {
    const set = new Set(
      schools
        .filter((s) => (fDivision === 'all' || s.division === fDivision) && (fDistrict === 'all' || s.district === fDistrict))
        .map((s) => s.upazila).filter(Boolean) as string[],
    );
    return [{ value: 'all', label: 'All Thanas' },
      ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [schools, fDivision, fDistrict]);

  const filteredSchools = useMemo(() => schools.filter((s) => {
    if (search && !(`${s.name} ${s.code}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fCategory !== 'all' && s.schoolCategory !== fCategory) return false;
    if (fType !== 'all' && s.schoolType !== fType) return false;
    if (fDivision !== 'all' && s.division !== fDivision) return false;
    if (fDistrict !== 'all' && s.district !== fDistrict) return false;
    if (fUpazila !== 'all' && s.upazila !== fUpazila) return false;
    if (fApproval === 'yes' && s.governmentApproval !== true) return false;
    if (fApproval === 'no' && s.governmentApproval === true) return false;
    return true;
  }), [schools, search, fCategory, fType, fDivision, fDistrict, fUpazila, fApproval]);

  const anyFilter = fCategory !== 'all' || fType !== 'all' || fDivision !== 'all' ||
    fDistrict !== 'all' || fUpazila !== 'all' || fApproval !== 'all' || !!search;

  const clearFilters = () => {
    setSearch(''); setFCategory('all'); setFType('all');
    setFDivision('all'); setFDistrict('all'); setFUpazila('all'); setFApproval('all');
  };

  /* ── Detail view ── */
  if (selectedId) {
    return (
      <>
        <Header title="School Information" subtitle="Detailed school profile" />
        <div className="space-y-5 p-4 sm:p-6">
          <Button
            variant="outline" size="sm"
            onClick={() => { setSelectedId(null); setProfile(null); }}
            className="gap-1.5"
          >
            <ArrowLeft size={14} /> Back to list
          </Button>

          {loadingProfile && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-gray-400">Loading school profile…</p>
              </div>
            </div>
          )}

          {profile && !loadingProfile && <ProfileDetail profile={profile} onReload={() => loadProfile(selectedId)} />}
        </div>
      </>
    );
  }

  /* ── List + filters view ── */
  return (
    <>
      <Header title="School Information" subtitle="Filter and select a school to view its full profile" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pb-2 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter size={15} className="text-gray-500" /> Filters
              </CardTitle>
              {anyFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-gray-400 hover:text-gray-700">
                  <X size={12} /> Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <FilterSelect label="School Category" value={fCategory} onChange={setFCategory} options={categoryOptions} />
              <FilterSelect label="Type of School" value={fType} onChange={setFType} options={typeOptions} />
              <FilterSelect label="Division" value={fDivision} onChange={(v) => { setFDivision(v); setFDistrict('all'); setFUpazila('all'); }} options={divisionOptions} />
              <FilterSelect label="District" value={fDistrict} onChange={(v) => { setFDistrict(v); setFUpazila('all'); }} options={districtOptions} />
              <FilterSelect label="Thana / Upazila" value={fUpazila} onChange={setFUpazila} options={upazilaOptions} />
              <FilterSelect label="Govt. Approval" value={fApproval} onChange={setFApproval} options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Approved' },
                { value: 'no', label: 'Not Approved' },
              ]} />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Search</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or code…"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{filteredSchools.length}</span> school{filteredSchools.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {loadingSchools ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <BookOpen size={28} className="text-indigo-400" />
            </div>
            <p className="font-medium text-gray-500">No schools match your filters</p>
            {anyFilter && (
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSchools.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow">
                    <School size={20} className="text-white" />
                  </div>
                  {s.governmentApproval === true && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <ShieldCheck size={10} /> Approved
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">{s.name}</h3>
                <p className="font-mono text-xs text-gray-400">{s.code}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.schoolCategory && (
                    <Badge className="border-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">{categoryLabel(s.schoolCategory)}</Badge>
                  )}
                  {s.schoolType && (
                    <Badge variant="default">{typeLabel(s.schoolType)}</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <MapPin size={11} />
                  <span className="truncate">{[s.upazila, s.district, s.division].filter(Boolean).join(', ') || 'Location not set'}</span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                  View profile <ChevronRight size={13} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Profile detail (header + grade + 6 tables) ────────── */

function ProfileDetail({ profile, onReload }: { profile: SchoolProfile; onReload: () => void }) {
  const { school } = profile;
  const grade = computeGrade(profile.meta.categoriesWithData, profile.meta.totalCategories);

  const totalTeachers = school.totalTeachers ?? profile.teacherTotals.total;
  const totalStudents = school.totalStudents ?? profile.studentTotals.total;

  const headerFields = [
    { label: 'Type of School', value: typeLabel(school.schoolType), icon: Layers },
    { label: 'Establishment Year', value: school.establishedYear ?? '—', icon: CalendarDays },
    { label: 'Division', value: school.division ?? '—', icon: MapPin },
    { label: 'District', value: school.district ?? '—', icon: MapPin },
    { label: 'Thana', value: school.upazila ?? '—', icon: MapPin },
    { label: 'Govt. Approval', value: yn(school.governmentApproval), icon: school.governmentApproval ? ShieldCheck : ShieldX },
    { label: 'Total Teachers', value: totalTeachers, icon: GraduationCap },
    { label: 'Total Students', value: totalStudents, icon: Users },
    { label: 'Grade Coverage', value: school.gradeCoverage ?? '—', icon: BookOpen },
  ];

  /* ── Table column defs ── */
  const studentRows = sortByGrade(profile.students);
  const feeRows = sortByGrade(profile.feeStructures);

  const infraRows = profile.infrastructure ? [
    { id: 'campus', label: 'Campus Status', value: profile.infrastructure.campusStatus || '—' },
    { id: 'rht', label: 'Head Teacher Rooms', value: profile.infrastructure.roomHeadTeachers },
    { id: 'rt', label: 'Teacher Rooms', value: profile.infrastructure.roomTeachers },
    { id: 'rc', label: 'Classrooms', value: profile.infrastructure.roomClassroom },
    { id: 'rp', label: 'Playrooms', value: profile.infrastructure.roomPlayroom },
    { id: 'rl', label: 'Library Rooms', value: profile.infrastructure.roomLibrary },
    { id: 'rlab', label: 'Lab Rooms', value: profile.infrastructure.roomLab },
    { id: 'rs', label: 'Storerooms', value: profile.infrastructure.roomStoreroom },
    { id: 'rk', label: 'Kitchens', value: profile.infrastructure.roomKitchen },
    { id: 'rsb', label: 'Sickbays', value: profile.infrastructure.roomSickbay },
    { id: 'ro', label: 'Other Rooms', value: profile.infrastructure.roomOthers },
    { id: 'rtot', label: 'Total Rooms', value: profile.infrastructure.roomTotal },
    { id: 'wm', label: 'Washrooms (Male)', value: profile.infrastructure.washroomMale },
    { id: 'wf', label: 'Washrooms (Female)', value: profile.infrastructure.washroomFemale },
    { id: 'dec', label: 'Digitally Equipped Classrooms', value: profile.infrastructure.digitallyEquippedClassrooms },
    { id: 'fsc', label: 'Floor-sitting Classrooms', value: profile.infrastructure.floorSittingClassrooms },
    { id: 'cwb', label: 'Classrooms w/ Whiteboard', value: profile.infrastructure.classroomsWithWhiteboard },
    { id: 'cbb', label: 'Classrooms w/ Blackboard', value: profile.infrastructure.classroomsWithBlackboard },
    { id: 'hwp', label: 'Hand Wash Point', value: yn(profile.infrastructure.hasHandWashPoint) },
    { id: 'pg', label: 'Playground', value: yn(profile.infrastructure.hasPlayground) },
    { id: 'sg', label: 'School Garden', value: yn(profile.infrastructure.hasSchoolGarden) },
    { id: 'nf', label: 'New Furniture Needed', value: yn(profile.infrastructure.classroomNewFurniture) },
    { id: 'rr', label: 'Renovation Required', value: yn(profile.infrastructure.infraRenovationRequired || profile.infrastructure.classroomRenovationRequired) },
  ] : [];

  const st = profile.studentTotals;
  const tt = profile.teacherTotals;

  const pedagTotal = (r: PedagAchievementRow) =>
    (r.kgScholarship ?? 0) + (r.primaryScholarship ?? 0) + (r.jrScholarship ?? 0) +
    (r.sscScholarship ?? 0) + (r.othersScholarship ?? 0);

  return (
    <div className="space-y-5">
      {/* Header + Grade */}
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <School size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{school.name}</h2>
                    <p className="mt-0.5 font-mono text-sm text-gray-500">{school.code}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {school.schoolCategory && (
                      <Badge className="border-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">{categoryLabel(school.schoolCategory)}</Badge>
                    )}
                    {school.governmentApproval && (
                      <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100">Govt. Approved</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={onReload} className="gap-1 text-xs text-gray-400 hover:text-gray-700">
                      <RefreshCw size={12} /> Reload
                    </Button>
                  </div>
                </div>

                {/* contact line */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {school.address && (
                    <span className="flex items-center gap-1"><MapPin size={11} />{school.address}</span>
                  )}
                  {school.phone && <span className="flex items-center gap-1"><Phone size={11} />{school.phone}</span>}
                  {school.email && <span className="flex items-center gap-1"><Mail size={11} />{school.email}</span>}
                  {school.principalName && <span className="flex items-center gap-1"><Users size={11} />Principal: <strong>{school.principalName}</strong></span>}
                </div>
              </div>
            </div>

            {/* field grid */}
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              {headerFields.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      <Icon size={12} /> {f.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{f.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Grade */}
        <GradeBadge grade={grade} withData={profile.meta.categoriesWithData} total={profile.meta.totalCategories} />
      </div>


    </div>
  );
}
