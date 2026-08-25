'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { findFormByKey } from '@/components/data-collection/form-catalog';
import { FormDataViewer } from '@/components/data-collection/form-data-viewer';
import { StudentPerformanceViewer } from '@/components/data-collection/student-performance-viewer';
import { getStudentPerformanceForm, getFormDisplayLabel, type StudentPerformanceFormKey } from '@/components/data-collection/student-performance-catalog';
import api from '@/lib/api';
import type { DcSchool } from '@/types';

/* ─── Page ───────────────────────────────────────────────── */

export default function FormDataViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const schoolId = String(params?.schoolId ?? '');
  const formKey = String(params?.formKey ?? '');
  const schoolName = searchParams.get('schoolName') ?? '';
  const schoolCode = searchParams.get('schoolCode') ?? '';

  const [school, setSchool] = useState<DcSchool | null>(null);

  useEffect(() => {
    if (schoolId) {
      api.get(`/data-collection/schools/${schoolId}`)
        .then(({ data }) => setSchool(data))
        .catch(() => {});
    }
  }, [schoolId]);

  // NOTE: findFormByKey() returns a brand-new object literal on every call, so it
  // must be memoized on the primitive `formKey` — otherwise `found` gets a new
  // reference every render, which would make it an unstable dependency below.
  const found = useMemo(() => findFormByKey(formKey), [formKey]);

  // Student Performance (BA/BPS/BSS) stores its indicator grid as jsonb, which
  // the generic flat table renders as one unreadable ultra-wide row per record.
  const studentPerfKey = formKey.startsWith('student-performance-')
    ? (formKey.slice('student-performance-'.length) as StudentPerformanceFormKey)
    : null;
  const isStudentPerf = !!(studentPerfKey && getStudentPerformanceForm(studentPerfKey));

  if (!found) {
    return (
      <>
        <Header title="Submitted Data" />
        <div className="p-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-gray-500">Unknown form “{formKey}”.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push(`/data-collection/school-information?school=${schoolId}`)}>
                Back to School Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const { category, form } = found;
  const fileBase = `${schoolCode || schoolId}-${form.key}`;
  const CategoryIcon = category.icon;
  const FormIcon = form.icon;

  // For student performance forms, use dynamic label based on school category
  const displayLabel = isStudentPerf && studentPerfKey
    ? getFormDisplayLabel(getStudentPerformanceForm(studentPerfKey)!, school?.schoolCategory)
    : form.label;

  const backButton = (
    <Button
      variant="outline" size="sm"
      onClick={() => router.push(`/data-collection/school-information?school=${schoolId}`)}
      className="gap-2"
    >
      <ArrowLeft size={14} /> Back to Profile
    </Button>
  );

  return (
    <>
      <Header
        title={form.group ? `${form.group} — ${displayLabel}` : displayLabel}
        subtitle={[schoolName, category.label].filter(Boolean).join(' • ')}
        actions={backButton}
      />

      <div className="space-y-5 p-4 sm:p-6">
        {/* ── Form banner ── */}
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className={`h-1 bg-gradient-to-r ${category.color}`} />
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${category.bg} ring-1 ${category.ring}`}>
              <FormIcon size={22} className={category.text} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{displayLabel}</h2>
                <span className={`inline-flex items-center gap-1 rounded-full ${category.bg} px-2 py-0.5 text-[11px] font-medium ${category.text}`}>
                  <CategoryIcon size={11} /> {category.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{form.description}</p>
            </div>
          </CardContent>
        </Card>

        {isStudentPerf ? (
          <StudentPerformanceViewer
            schoolId={schoolId}
            formKey={studentPerfKey as StudentPerformanceFormKey}
            fileBase={fileBase}
            schoolCategory={school?.schoolCategory}
          />
        ) : (
          <FormDataViewer schoolId={schoolId} category={category} form={form} fileBase={fileBase} />
        )}
      </div>
    </>
  );
}
