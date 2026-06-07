'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  School, Users, GraduationCap, MapPin, Phone, Mail, ChevronDown,
  BookOpen, Building2, Award, ClipboardList, TrendingUp, Search,
  DollarSign, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────── */

interface SchoolOption {
  id: string;
  name: string;
  code: string;
  schoolCategory?: string;
}

interface SchoolProfile {
  school: {
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
  };
  basicInfo?: Record<string, any> | null;
  infrastructure?: Record<string, any> | null;
  teachers: {
    total: number;
    male: number;
    female: number;
    list: Array<{
      id: string;
      name: string;
      designation?: string;
      gender?: string;
      educationalQualification?: string;
      experienceYears?: number;
      subjectExpertise?: string;
      trainingReceived?: boolean;
    }>;
  };
  students: {
    total: number;
    boys: number;
    girls: number;
    pwd: number;
    ethnic: number;
    byGrade: Record<string, { boys: number; girls: number; total: number; pwd: number; ethnic: number }>;
  };
  revenue: {
    budgetTotal?: Record<string, any> | null;
    actualTotal?: Record<string, any> | null;
  };
  alumni: Array<{
    id: string;
    alumniName: string;
    graduationYear?: number;
    currentOccupation?: string;
    institution?: string;
    contactPhone?: string;
  }>;
  pedagogicalAchievements: Array<{
    id: string;
    year: number;
    kgScholarship?: number;
    primaryScholarship?: number;
    jrScholarship?: number;
    sscScholarship?: number;
    othersScholarship?: number;
  }>;
}

/* ─── Helpers ───────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
  brac_academy: 'BRAC Academy',
};

const GRADE_ORDER = ['Play', 'Nursery', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

const sortGrades = (grades: string[]) =>
  grades.sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a);
    const ib = GRADE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

const fmtTaka = (n: number) =>
  n >= 10_000_000 ? `৳${(n / 10_000_000).toFixed(2)} Cr` :
  n >= 100_000 ? `৳${(n / 100_000).toFixed(1)} L` :
  n >= 1_000 ? `৳${(n / 1_000).toFixed(1)}K` : `৳${n}`;

const pct = (a: number, b: number) => (b > 0 ? Math.min(((a / b) * 100).toFixed(1), '100') : '0');

/* ─── Custom tooltip ───────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-700">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Section Card ─────────────────────────────────────── */

function Section({ title, icon: Icon, gradient, children }: {
  title: string; icon: React.ElementType; gradient: string; children: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className={`h-1 ${gradient}`} />
      <CardHeader className="px-5 pt-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon size={15} className="text-gray-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

/* ─── Info Row ─────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value == null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="min-w-[160px] text-xs text-gray-400 font-medium shrink-0">{label}</span>
      <span className="text-xs text-gray-700 font-medium">{display}</span>
    </div>
  );
}

/* ─── Revenue Row ──────────────────────────────────────── */

function RevRow({ label, target, achievement }: { label: string; target: number; achievement: number }) {
  const p = Number(pct(achievement, target));
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <div className="flex gap-4">
          <span className="text-gray-400">Target: <strong className="text-gray-700">{fmtTaka(target)}</strong></span>
          <span className="text-gray-400">Achieved: <strong className={p >= 80 ? 'text-green-600' : p >= 50 ? 'text-amber-500' : 'text-red-500'}>{fmtTaka(achievement)}</strong></span>
          <Badge variant="outline" className={`text-[10px] ${p >= 80 ? 'border-green-200 text-green-700 bg-green-50' : p >= 50 ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
            {p}%
          </Badge>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${p >= 80 ? 'bg-green-500' : p >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
    </div>
  );
}

const REV_FIELDS: { key: string; label: string }[] = [
  { key: 'admissionFee', label: 'Admission Fee' },
  { key: 'sessionFee', label: 'Session Fee' },
  { key: 'assessmentFee', label: 'Assessment Fee' },
  { key: 'sportsFee', label: 'Sports Fee' },
  { key: 'syllabusFee', label: 'Syllabus Fee' },
  { key: 'testimonialFee', label: 'Testimonial Fee' },
  { key: 'othersFee', label: 'Others Fee' },
  { key: 'transportFee', label: 'Transport Fee' },
];

/* ─── Main Page ─────────────────────────────────────────── */

export default function SchoolInformationPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Load school list
  useEffect(() => {
    api.get('/data-collection/schools').then(({ data }) => {
      setSchools(data?.data ?? data ?? []);
    }).catch(() => {}).finally(() => setLoadingSchools(false));
  }, []);

  // Load profile when school selected
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

  const filteredSchools = schools.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedSchool = schools.find((s) => s.id === selectedId);

  /* Derived chart data */
  const studentGradeData = profile
    ? sortGrades(Object.keys(profile.students.byGrade)).map((g) => ({
        name: g,
        boys: profile.students.byGrade[g].boys,
        girls: profile.students.byGrade[g].girls,
        total: profile.students.byGrade[g].total,
      }))
    : [];

  const teacherPieData = profile
    ? [
        { name: 'Male', value: profile.teachers.male, fill: '#6366f1' },
        { name: 'Female', value: profile.teachers.female, fill: '#ec4899' },
      ]
    : [];

  const sumRevField = (obj: Record<string, any> | null | undefined, suffix: string) =>
    REV_FIELDS.reduce((acc, f) => acc + parseFloat(String(obj?.[`${f.key}${suffix}`] ?? 0)), 0);

  return (
    <>
      <Header title="School Information" subtitle="Detailed profile view for individual schools" />

      <div className="space-y-6 p-4 sm:p-6">
        {/* School Selector */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Search size={14} />
              Select a School
            </p>
            <div className="relative max-w-lg">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              >
                <span className={selectedSchool ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                  {selectedSchool ? `${selectedSchool.name} (${selectedSchool.code})` : 'Choose a school…'}
                </span>
                <ChevronDown size={15} className="text-gray-400 shrink-0" />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-gray-100 bg-white shadow-xl">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name or code…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {loadingSchools ? (
                      <p className="py-4 text-center text-xs text-gray-400">Loading…</p>
                    ) : filteredSchools.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">No schools found.</p>
                    ) : (
                      filteredSchools.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedId(s.id); setDropdownOpen(false); setSearch(''); }}
                          className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-50 ${selectedId === s.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                        >
                          <School size={13} className="mt-0.5 shrink-0 text-gray-400" />
                          <div>
                            <p className="font-medium leading-tight">{s.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{s.code}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadProfile(selectedId)}
                className="mt-2 gap-1.5 text-xs text-gray-400 hover:text-gray-700"
              >
                <RefreshCw size={12} />
                Reload
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Loading state */}
        {loadingProfile && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-sm text-gray-400">Loading school profile…</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedId && !loadingProfile && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <BookOpen size={28} className="text-indigo-400" />
            </div>
            <p className="text-gray-500 font-medium">Select a school to view its full profile</p>
            <p className="text-xs text-gray-400 max-w-xs">Choose a school from the dropdown above to see detailed information including teachers, students, revenue, and more.</p>
          </div>
        )}

        {profile && !loadingProfile && (
          <div className="space-y-5">
            {/* School Header Card */}
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                      <School size={26} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{profile.school.name}</h2>
                      <p className="text-sm font-mono text-gray-500 mt-0.5">{profile.school.code}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.school.schoolCategory && (
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0">
                            {CATEGORY_LABELS[profile.school.schoolCategory] ?? profile.school.schoolCategory}
                          </Badge>
                        )}
                        {profile.school.schoolType && (
                          <Badge variant="outline">{profile.school.schoolType}</Badge>
                        )}
                        {profile.school.governmentApproval && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Govt. Approved</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-gray-500">
                    {profile.school.address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span>{[profile.school.address, profile.school.upazila, profile.school.district, profile.school.division].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {profile.school.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} />
                        <span>{profile.school.phone}</span>
                      </div>
                    )}
                    {profile.school.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} />
                        <span>{profile.school.email}</span>
                      </div>
                    )}
                    {profile.school.principalName && (
                      <div className="flex items-center gap-1.5">
                        <Users size={12} />
                        <span>Principal: <strong>{profile.school.principalName}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats quick row */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {[
                { label: 'Teachers', value: profile.teachers.total, icon: Users, color: 'bg-purple-50 text-purple-600' },
                { label: 'Students', value: profile.students.total, icon: GraduationCap, color: 'bg-blue-50 text-blue-600' },
                { label: 'PWD', value: profile.students.pwd, icon: Users, color: 'bg-amber-50 text-amber-600' },
                { label: 'Ethnic', value: profile.students.ethnic, icon: Users, color: 'bg-green-50 text-green-600' },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                      <stat.icon size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className="text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Teachers section */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Teachers" icon={Users} gradient="bg-gradient-to-r from-purple-400 to-purple-600">
                <div className="mb-4 flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-700">{profile.teachers.male}</p>
                    <p className="text-xs text-gray-400">Male</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-pink-600">{profile.teachers.female}</p>
                    <p className="text-xs text-gray-400">Female</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{profile.teachers.total}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                </div>

                {teacherPieData.some((d) => d.value > 0) && (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={teacherPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        {teacherPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {profile.teachers.list.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-2 text-left font-semibold text-gray-500">Name</th>
                          <th className="pb-2 text-left font-semibold text-gray-500">Designation</th>
                          <th className="pb-2 text-left font-semibold text-gray-500">Gender</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">Exp.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {profile.teachers.list.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="py-2 font-medium text-gray-800">{t.name}</td>
                            <td className="py-2 text-gray-500">{t.designation ?? '—'}</td>
                            <td className="py-2">
                              <Badge variant="outline" className={t.gender === 'Male' ? 'border-indigo-200 text-indigo-600' : 'border-pink-200 text-pink-600'}>
                                {t.gender ?? '—'}
                              </Badge>
                            </td>
                            <td className="py-2 text-right text-gray-500">{t.experienceYears != null ? `${t.experienceYears}y` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Students by grade */}
              <Section title="Students by Grade" icon={GraduationCap} gradient="bg-gradient-to-r from-blue-400 to-blue-600">
                <div className="mb-3 flex gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{profile.students.boys}</p>
                    <p className="text-xs text-gray-400">Boys</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-pink-600">{profile.students.girls}</p>
                    <p className="text-xs text-gray-400">Girls</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{profile.students.total}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                </div>

                {studentGradeData.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={studentGradeData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="boys" name="Boys" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="girls" name="Girls" fill="#f472b6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {Object.keys(profile.students.byGrade).length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-2 text-left font-semibold text-gray-500">Grade</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">Boys</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">Girls</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">PWD</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">Ethnic</th>
                          <th className="pb-2 text-right font-semibold text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sortGrades(Object.keys(profile.students.byGrade)).map((grade) => {
                          const row = profile.students.byGrade[grade];
                          return (
                            <tr key={grade} className="hover:bg-gray-50">
                              <td className="py-1.5 font-medium text-gray-700">{grade}</td>
                              <td className="py-1.5 text-right text-blue-700">{row.boys}</td>
                              <td className="py-1.5 text-right text-pink-600">{row.girls}</td>
                              <td className="py-1.5 text-right text-amber-600">{row.pwd}</td>
                              <td className="py-1.5 text-right text-green-600">{row.ethnic}</td>
                              <td className="py-1.5 text-right font-semibold text-gray-800">{row.total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {/* Revenue section */}
            <Section title="Revenue" icon={DollarSign} gradient="bg-gradient-to-r from-emerald-400 to-emerald-600">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Budget Estimates</p>
                  {REV_FIELDS.map((f) => {
                    const target = parseFloat(String(profile.revenue.budgetTotal?.[`${f.key}Target`] ?? 0));
                    const ach = parseFloat(String(profile.revenue.budgetTotal?.[`${f.key}Achievement`] ?? 0));
                    if (!target && !ach) return null;
                    return <RevRow key={f.key} label={f.label} target={target} achievement={ach} />;
                  })}
                  {!profile.revenue.budgetTotal && (
                    <p className="text-xs text-gray-400 italic">No budget data recorded.</p>
                  )}
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actual Collection</p>
                  {REV_FIELDS.map((f) => {
                    const target = parseFloat(String(profile.revenue.actualTotal?.[`${f.key}Target`] ?? 0));
                    const ach = parseFloat(String(profile.revenue.actualTotal?.[`${f.key}Achievement`] ?? 0));
                    if (!target && !ach) return null;
                    return <RevRow key={f.key} label={f.label} target={target} achievement={ach} />;
                  })}
                  {!profile.revenue.actualTotal && (
                    <p className="text-xs text-gray-400 italic">No actual collection data recorded.</p>
                  )}
                </div>
              </div>

              {/* Summary progress bar */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Budget Achievement', target: sumRevField(profile.revenue.budgetTotal, 'Target'), ach: sumRevField(profile.revenue.budgetTotal, 'Achievement'), color: 'emerald' },
                  { label: 'Actual Achievement', target: sumRevField(profile.revenue.actualTotal, 'Target'), ach: sumRevField(profile.revenue.actualTotal, 'Achievement'), color: 'teal' },
                ].map((item) => {
                  const p = Number(pct(item.ach, item.target));
                  return (
                    <div key={item.label} className="rounded-xl bg-gray-50 p-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{item.label}</span>
                        <span className="font-bold text-gray-800">{p}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200">
                        <div className={`h-2 rounded-full bg-${item.color}-500 transition-all duration-700`} style={{ width: `${Math.min(p, 100)}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-400">
                        <span>Achieved: {fmtTaka(item.ach)}</span>
                        <span>Target: {fmtTaka(item.target)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Alumni */}
            {profile.alumni.length > 0 && (
              <Section title={`Alumni (${profile.alumni.length})`} icon={Award} gradient="bg-gradient-to-r from-indigo-400 to-indigo-600">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-semibold text-gray-500">#</th>
                        <th className="pb-2 text-left font-semibold text-gray-500">Name</th>
                        <th className="pb-2 text-left font-semibold text-gray-500">Grad. Year</th>
                        <th className="pb-2 text-left font-semibold text-gray-500">Occupation</th>
                        <th className="pb-2 text-left font-semibold text-gray-500">Institution</th>
                        <th className="pb-2 text-left font-semibold text-gray-500">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {profile.alumni.map((a, idx) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="py-2 text-gray-400">{idx + 1}</td>
                          <td className="py-2 font-medium text-gray-800">{a.alumniName}</td>
                          <td className="py-2">
                            {a.graduationYear ? (
                              <Badge variant="outline" className="font-mono">{a.graduationYear}</Badge>
                            ) : '—'}
                          </td>
                          <td className="py-2 text-gray-600">{a.currentOccupation ?? '—'}</td>
                          <td className="py-2 text-gray-600">{a.institution ?? '—'}</td>
                          <td className="py-2 text-gray-500">{a.contactPhone ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Pedagogical achievements */}
            {profile.pedagogicalAchievements.length > 0 && (
              <Section title={`Pedagogical Achievements (${profile.pedagogicalAchievements.length} years)`} icon={ClipboardList} gradient="bg-gradient-to-r from-violet-400 to-violet-600">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-semibold text-gray-500">Year</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">KG</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">Primary</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">Junior</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">SSC</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">Others</th>
                        <th className="pb-2 text-right font-semibold text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {profile.pedagogicalAchievements.map((pa) => {
                        const total = (pa.kgScholarship ?? 0) + (pa.primaryScholarship ?? 0) +
                          (pa.jrScholarship ?? 0) + (pa.sscScholarship ?? 0) + (pa.othersScholarship ?? 0);
                        return (
                          <tr key={pa.id} className="hover:bg-gray-50">
                            <td className="py-2"><Badge variant="outline" className="font-mono">{pa.year}</Badge></td>
                            <td className="py-2 text-right text-gray-700">{pa.kgScholarship ?? 0}</td>
                            <td className="py-2 text-right text-gray-700">{pa.primaryScholarship ?? 0}</td>
                            <td className="py-2 text-right text-gray-700">{pa.jrScholarship ?? 0}</td>
                            <td className="py-2 text-right text-gray-700">{pa.sscScholarship ?? 0}</td>
                            <td className="py-2 text-right text-gray-700">{pa.othersScholarship ?? 0}</td>
                            <td className="py-2 text-right font-bold text-violet-700">{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Basic info and infrastructure side by side */}
            <div className="grid gap-5 lg:grid-cols-2">
              {profile.basicInfo && (
                <Section title="Basic Information" icon={Building2} gradient="bg-gradient-to-r from-sky-400 to-sky-600">
                  {Object.entries(profile.basicInfo)
                    .filter(([k]) => !['id', 'schoolId', 'createdById', 'createdAt', 'updatedAt'].includes(k))
                    .map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} value={v as any} />
                    ))}
                </Section>
              )}
              {profile.infrastructure && (
                <Section title="Infrastructure" icon={Building2} gradient="bg-gradient-to-r from-orange-400 to-orange-600">
                  {Object.entries(profile.infrastructure)
                    .filter(([k]) => !['id', 'schoolId', 'createdById', 'createdAt', 'updatedAt'].includes(k))
                    .map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} value={v as any} />
                    ))}
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
