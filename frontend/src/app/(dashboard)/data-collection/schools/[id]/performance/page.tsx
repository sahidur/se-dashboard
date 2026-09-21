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
  Trophy,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronRight,
  GraduationCap,
  ClipboardCheck,
  Library,
  Award,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcDashboard } from '@/types';

interface SubForm {
  key: string;
  slug: string;
  /** When set, the card links to this sub-route instead of /data-collection/forms/<slug>. */
  href?: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  text: string;
  trackKey: string;
}

const SUB_FORMS: SubForm[] = [
  {
    key: 'pedagogical-achievements',
    slug: 'pedagogical-achievements',
    label: "School's Pedagogical Achievements",
    description: 'Annual scholarship recipients by category with unique approach details',
    icon: Trophy,
    color: 'from-indigo-500 to-indigo-600',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    trackKey: 'pedagogicalAchievements',
  },
  {
    key: 'co-curricular',
    slug: 'co-curricular-activities',
    label: 'Participation in Co-curricular Activities',
    description: 'Monthly participation % by grade for song, dance, debate, sports and more',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    trackKey: 'cocurricular',
  },
  {
    key: 'students-performance',
    slug: 'students-performance',
    label: "Students' Academic Performance",
    description: 'Exam-wise grade-A to F results, student counts and progress indicators',
    icon: GraduationCap,
    color: 'from-teal-500 to-teal-600',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    trackKey: 'studentsPerformance',
  },
  {
    key: 'student-performance',
    slug: 'student-performance',
    href: 'student-performance',
    label: 'Student Performance',
    description: "Indicator and subject-wise performance for BA, BPS and BSS \u2014 6 forms",
    icon: ClipboardCheck,
    color: 'from-cyan-500 to-cyan-600',
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    trackKey: 'studentPerformance',
  },
  {
    key: 'activity-participation',
    slug: 'activity-participation',
    label: "Students' Participation Activities",
    description: 'Monthly activity participation by grade with photo evidence',
    icon: Library,
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    trackKey: 'activityParticipation',
  },
  {
    key: 'event-participation',
    slug: 'event-participation',
    label: "School's Participation in Different Events",
    description: 'Events, award levels and number of students awarded',
    icon: Award,
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    trackKey: 'eventParticipation',
  },

];

export default function PerformanceSubPage() {
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
        <Header title="Pedagogical Performance" />
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      </>
    );
  }

  if (!dashboard) return null;

  const school = dashboard.school;
  const forms = dashboard.forms;
  const doneCount = SUB_FORMS.filter((sf) => sf.trackKey && forms[sf.trackKey as keyof typeof forms]?.submitted).length;
  const allDone = doneCount >= SUB_FORMS.length;

  return (
    <>
      <Header
        title="Pedagogical Performance"
        subtitle={school.name}
        actions={
          <Button variant="outline" onClick={() => router.push(`/data-collection/schools/${id}`)}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg">
                  <Trophy size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pedagogical Performance Forms</h2>
                  <p className="text-sm text-gray-500">{school.name} &bull; {school.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                  <p className={`text-2xl font-bold ${allDone ? 'text-green-600' : 'text-indigo-600'}`}>{doneCount}</p>
                  <p className="text-xs text-gray-500">of {SUB_FORMS.length} Submitted</p>
                </div>
                {allDone ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 size={24} className="text-green-600" />
                  </div>
                ) : (
                  <div className="h-10 w-10">
                    <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                        strokeDasharray={`${(doneCount / SUB_FORMS.length) * 100} 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            {allDone && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 border border-green-200">
                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700">All forms have been submitted!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUB_FORMS.map((sf) => {
            const submitted = sf.trackKey ? forms[sf.trackKey as keyof typeof forms]?.submitted : false;
            const Icon = sf.icon;
            return (
              <Link key={sf.key} href={sf.href ? `/data-collection/schools/${id}/performance/${sf.href}` : `/data-collection/forms/${sf.slug}?school=${id}`} className="group block">
                <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${submitted ? 'ring-2 ring-green-200' : 'ring-1 ring-gray-100'}`}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${sf.bg}`}><Icon size={22} className={sf.text} /></div>
                      {submitted ? (
                        <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Submitted</Badge>
                      ) : (
                        <Badge variant="default" className="gap-1"><XCircle size={12} /> Pending</Badge>
                      )}
                    </div>
                    <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{sf.label}</h3>
                    <p className="text-xs text-gray-400">{sf.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                      {submitted ? 'View / Update' : 'Fill Form'} <ChevronRight size={14} />
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
