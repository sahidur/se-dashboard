'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { MonitoringWizard } from '@/components/school-monitoring/monitoring-wizard';
import { getMonitoringForm } from '@/components/school-monitoring/form-catalog';
import type { DcSchool } from '@/types';

export default function MonitoringFillPage() {
  const router = useRouter();
  const params = useSearchParams();
  const schoolId = params.get('schoolId') || '';
  const formType = params.get('form') || '';

  const form = useMemo(() => getMonitoringForm(formType), [formType]);
  const [school, setSchool] = useState<DcSchool | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api.get<DcSchool>(`/data-collection/schools/${schoolId}`).then(({ data }) => setSchool(data)).catch(() => {});
  }, [schoolId]);

  if (!schoolId || !form) {
    return (
      <div>
        <Header title="School Monitoring" />
        <div className="p-6 text-center text-sm text-gray-500">
          Invalid monitoring form.{' '}
          <Link href="/school-monitoring" className="text-brand-600 hover:underline">Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={form.shortTitle}
        subtitle={school?.name}
        actions={
          <Link href="/school-monitoring">
            <Button variant="outline"><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
          </Link>
        }
      />

      <div className="p-4 sm:p-6">
        <MonitoringWizard
          form={form}
          schoolId={schoolId}
          schoolName={school?.name}
          onSubmitted={(sub) => router.push(`/school-monitoring/feedback/${sub.id}`)}
          onCancel={() => router.push('/school-monitoring')}
        />
      </div>
    </div>
  );
}
