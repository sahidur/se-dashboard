'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, ChevronRight, GraduationCap, XCircle } from 'lucide-react';
import {
  STUDENT_PERFORMANCE_SECTIONS,
  getSectionForms,
} from '@/components/data-collection/student-performance-catalog';
import api from '@/lib/api';
import type { DcSchool, DcStudentPerformance } from '@/types';

export default function StudentPerformanceHubPage() {
  const { id } = useParams();
  const router = useRouter();
  const [school, setSchool] = useState<DcSchool | null>(null);
  const [records, setRecords] = useState<DcStudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/data-collection/schools/${id}`).then(({ data }) => data as DcSchool),
      api.get(`/data-collection/student-performance/school/${id}`)
        .then(({ data }) => data as DcStudentPerformance[])
        .catch(() => [] as DcStudentPerformance[]),
    ])
      .then(([s, recs]) => {
        if (cancelled) return;
        setSchool(s);
        setRecords(recs);
      })
      .catch(() => { if (!cancelled) router.push('/data-collection/schools'); })
      // Never gate this on `cancelled`: React re-runs the effect (StrictMode
      // remount, or a dependency change) and the cleanup from the first run
      // would otherwise leave the page spinning forever.
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [id, router]);

  const countFor = (formKey: string) => records.filter((r) => r.formKey === formKey).length;
  const totalForms = STUDENT_PERFORMANCE_SECTIONS.reduce((n, s) => n + getSectionForms(s.key).length, 0);
  const doneForms = STUDENT_PERFORMANCE_SECTIONS
    .flatMap((s) => getSectionForms(s.key))
    .filter((f) => countFor(f.key) > 0).length;

  if (loading) {
    return (
      <>
        <Header title="Student Performance" />
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Student Performance"
        subtitle={school?.name}
        actions={
          <Button variant="outline" onClick={() => router.push(`/data-collection/schools/${id}/performance`)}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back to Pedagogical Performance</span>
            <span className="sm:hidden">Back</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Student Performance</h2>
                  <p className="text-sm text-gray-500">
                    {school ? `${school.name} • ${school.code}` : '—'}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                <p className={`text-2xl font-bold ${doneForms >= totalForms ? 'text-green-600' : 'text-teal-600'}`}>
                  {doneForms}
                </p>
                <p className="text-xs text-gray-500">of {totalForms} Forms Started</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {STUDENT_PERFORMANCE_SECTIONS.map((section) => {
            const forms = getSectionForms(section.key);
            return (
              <section key={section.key}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex h-7 items-center rounded-lg bg-gradient-to-br ${section.color} px-2.5 text-xs font-bold text-white shadow-sm`}>
                    {section.short}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                  <Badge variant="default" className="text-xs">
                    {forms.length} form{forms.length > 1 ? 's' : ''}
                  </Badge>
                  <p className="w-full text-xs text-gray-400 sm:w-auto sm:border-l sm:border-gray-200 sm:pl-2">
                    {section.description}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {forms.map((form) => {
                    const count = countFor(form.key);
                    const Icon = form.icon;
                    return (
                      <Link
                        key={form.key}
                        href={`/data-collection/forms/${form.slug}?school=${id}`}
                        className="group block"
                      >
                        <Card className={`relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${count > 0 ? 'ring-2 ring-green-200' : 'ring-1 ring-gray-100'}`}>
                          <CardContent className="flex h-full flex-col p-5">
                            <div className="mb-3 flex items-start justify-between">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${section.bg}`}>
                                <Icon size={22} className={section.text} />
                              </div>
                              {count > 0 ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle2 size={12} /> {count} record{count > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="default" className="gap-1"><XCircle size={12} /> Pending</Badge>
                              )}
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Form {form.formNo}
                            </p>
                            <h4 className="mb-1 font-semibold text-gray-900 transition-colors group-hover:text-brand-600">
                              {form.label}
                            </h4>
                            <p className="text-xs text-gray-400">{form.description}</p>
                            <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                              {count > 0 ? 'View / Update' : 'Fill Form'} <ChevronRight size={14} />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
