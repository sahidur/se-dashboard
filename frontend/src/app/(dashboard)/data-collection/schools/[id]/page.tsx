'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  School,
  Building2,
  Users,
  GraduationCap,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
  MapPin,
  CalendarDays,
  UserCircle,
  ShieldCheck,
  ShieldX,
  BookOpen,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcDashboard } from '@/types';

// Each card is a group that links to a sub-page with its own form-cards.
// `trackKeys` lists EVERY child form inside the group (matching the sub-page
// form lists); all totals and submitted counts are derived from these keys so
// the numbers can never drift from what users see inside each section.
const CARD_CONFIG = [
  {
    key: 'infrastructure',
    label: 'Infrastructure & Classroom',
    icon: Building2,
    href: (id: string) => `/data-collection/schools/${id}/infrastructure`,
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    trackKeys: ['infrastructure', 'classroomStatus'],
  },
  {
    key: 'studentsInfo',
    label: 'Students Information',
    icon: Users,
    href: (id: string) => `/data-collection/schools/${id}/students`,
    color: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    trackKeys: ['studentsInfo'],
  },
  {
    key: 'teachersInfo',
    label: "Teachers' Information",
    icon: GraduationCap,
    href: (id: string) => `/data-collection/schools/${id}/teachers`,
    color: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    trackKeys: ['teachersInfo', 'teachersDev'],
  },
  // 'Revenue & Fee Structure' card removed — the five revenue forms are
  // retired from school data entry (see HIDDEN_FORM_CATEGORY_KEYS in
  // form-catalog.tsx). Dashboards read the finance modules instead.
  {
    key: 'performance',
    label: 'Pedagogical Performance',
    icon: TrendingUp,
    href: (id: string) => `/data-collection/schools/${id}/performance`,
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    trackKeys: [
      'pedagogicalAchievements',
      'cocurricular',
      'studentsPerformance',
      'studentPerformance',
      'activityParticipation',
      'eventParticipation',
    ],
  },
  {
    key: 'alumni',
    label: 'Alumni Information',
    icon: Award,
    href: (id: string) => `/data-collection/schools/${id}/alumni`,
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    trackKeys: ['alumni'],
  },
];

// Total = every tracked child form across all groups (12 today), NOT the
// number of group cards.
const TOTAL_FORMS = CARD_CONFIG.reduce((sum, cfg) => sum + cfg.trackKeys.length, 0);

export default function SchoolDashboardPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DcDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/data-collection/schools/${id}/dashboard`)
      .then(({ data }) => setDashboard(data))
      .catch(() => router.push('/data-collection/schools'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <>
        <Header title="School Data" />
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      </>
    );
  }

  if (!dashboard) return null;

  const school = dashboard.school;
  const forms = dashboard.forms;
  // Count submissions over the same tracked child-form keys that define the
  // total, so the fraction always stays within 0..TOTAL_FORMS.
  const isSubmitted = (key: string) => !!forms[key as keyof typeof forms]?.submitted;
  const totalForms = TOTAL_FORMS;
  const totalSubmitted = CARD_CONFIG.reduce(
    (sum, cfg) => sum + cfg.trackKeys.filter(isSubmitted).length,
    0,
  );

  const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
    brac_academy: 'BRAC Academy',
    brac_primary: 'BRAC Primary',
    brac_secondary: 'BRAC Secondary',
  };
  const SCHOOL_TYPE_LABELS: Record<string, string> = {
    plain_land: 'Plain Land',
    haor: 'Haor',
  };

  const createdByName = school.createdBy
    ? `${school.createdBy.firstName} ${school.createdBy.lastName}`
    : null;
  const createdDate = new Date(school.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <>
      <Header
        title={school.name}
        subtitle="Data Collection Status"
        actions={
          <Button variant="outline" onClick={() => router.push('/data-collection/schools')}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back to Schools</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        {/* School Summary Card */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-0">
            {/* Header row */}
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
                  <School size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{school.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {school.schoolCategory && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        <BookOpen size={11} />
                        {SCHOOL_CATEGORY_LABELS[school.schoolCategory] || school.schoolCategory}
                      </span>
                    )}
                    {school.schoolType && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                        {SCHOOL_TYPE_LABELS[school.schoolType] || school.schoolType}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{school.code}</span>
                  </div>
                </div>
              </div>
              {/* Progress ring */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-2xl font-bold text-brand-600">{totalSubmitted}<span className="text-base font-normal text-gray-400">/{totalForms}</span></p>
                  <p className="text-xs text-gray-500">Forms Submitted</p>
                </div>
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#D10074" strokeWidth="3"
                      strokeDasharray={`${(totalSubmitted / totalForms) * 100} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-600">
                    {Math.round((totalSubmitted / totalForms) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {/* Location */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <MapPin size={12} /> Location
                </div>
                <p className="text-sm font-medium text-gray-800 leading-snug">
                  {[school.upazila, school.district, school.division].filter(Boolean).join(', ') || <span className="text-gray-400 font-normal">—</span>}
                </p>
              </div>

              {/* Established Year */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <CalendarDays size={12} /> Established
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {school.establishedYear || <span className="text-gray-400 font-normal">—</span>}
                </p>
              </div>

              {/* Gov Approval */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  {school.governmentApproval ? <ShieldCheck size={12} className="text-green-500" /> : <ShieldX size={12} className="text-red-400" />}
                  Gov. Approved
                </div>
                <p className={`text-sm font-semibold ${school.governmentApproval === true ? 'text-green-600' : school.governmentApproval === false ? 'text-red-500' : 'text-gray-400 font-normal'}`}>
                  {school.governmentApproval === true ? 'Yes' : school.governmentApproval === false ? 'No' : '—'}
                </p>
              </div>

              {/* Teachers */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <GraduationCap size={12} /> Teachers
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {school.totalTeachers ?? <span className="text-gray-400 font-normal">—</span>}
                </p>
              </div>

              {/* Students */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Users size={12} /> Students
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {school.totalStudents ?? <span className="text-gray-400 font-normal">—</span>}
                </p>
              </div>

              {/* Created By / When */}
              <div className="flex flex-col gap-0.5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <UserCircle size={12} /> Created By
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {createdByName || <span className="text-gray-400 font-normal">—</span>}
                </p>
                <p className="text-xs text-gray-400">{createdDate}</p>
              </div>
            </div>

            {/* Grade Coverage */}
            {school.gradeCoverage && (
              <div className="border-t border-gray-100 px-4 py-3">
                <span className="text-xs font-medium text-gray-400">Grade Coverage: </span>
                <span className="text-sm text-gray-700">{school.gradeCoverage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CARD_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            const schoolId = id as string;

            // Progress = how many of this group's child forms are submitted
            const doneCount = cfg.trackKeys.filter(isSubmitted).length;
            const totalCount = cfg.trackKeys.length;
            const allDone = totalCount > 0 && doneCount === totalCount;
            const remaining = totalCount - doneCount;

            return (
              <Link key={cfg.key} href={cfg.href(schoolId)} className="group block">
                <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  allDone ? 'ring-2 ring-green-200' : 'ring-1 ring-gray-100'
                }`}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${cfg.bg}`}>
                        <Icon size={22} className={cfg.text} />
                      </div>
                      {allDone ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 size={12} /> All Completed
                        </Badge>
                      ) : doneCount > 0 ? (
                        <Badge variant="warning" className="gap-1">
                          <AlertCircle size={12} /> {doneCount}/{totalCount} Done
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <XCircle size={12} /> Pending
                        </Badge>
                      )}
                    </div>
                    <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                      {cfg.label}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {allDone
                        ? `All ${totalCount} form${totalCount > 1 ? 's' : ''} submitted`
                        : `${doneCount} of ${totalCount} form${totalCount > 1 ? 's' : ''} completed · ${remaining} remaining`}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          allDone ? 'bg-green-500' : cfg.text.replace('text-', 'bg-')
                        }`}
                        style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                      View Forms <ChevronRight size={14} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
