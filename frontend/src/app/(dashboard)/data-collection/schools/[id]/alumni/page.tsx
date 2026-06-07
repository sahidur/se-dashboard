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
  UserCheck,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcDashboard } from '@/types';

const SUB_FORMS = [
  {
    key: 'alumni-information',
    slug: 'alumni-information',
    label: 'Alumni Information',
    description: 'Notable alumni, current occupations, education progression and contributions',
    icon: UserCheck,
    color: 'from-slate-500 to-slate-600',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    trackKey: 'alumni',
  },
];

export default function AlumniSubPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DcDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/data-collection/schools/${id}/dashboard`)
      .then(({ data }) => setDashboard(data))
      .catch(() => router.push('/data-collection/schools'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <Header title="Alumni Information" />
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
        title="Alumni Information"
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
          <div className="h-2 bg-gradient-to-r from-slate-500 to-slate-600" />
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg">
                  <UserCheck size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Alumni Information Forms</h2>
                  <p className="text-sm text-gray-500">{school.name} &bull; {school.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                  <p className={`text-2xl font-bold ${allDone ? 'text-green-600' : 'text-slate-600'}`}>{doneCount}</p>
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
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#64748b" strokeWidth="3"
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
              <Link key={sf.key} href={`/data-collection/forms/${sf.slug}?school=${id}`} className="group block">
                <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${submitted ? 'ring-2 ring-green-200' : 'ring-1 ring-gray-100'}`}>
                  <div className={`h-1.5 bg-gradient-to-r ${sf.color}`} />
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
