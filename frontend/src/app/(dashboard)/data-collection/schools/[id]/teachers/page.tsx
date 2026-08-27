'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Users, BookOpen, CheckCircle2, AlertCircle,
  XCircle, ChevronRight, TableProperties, X, RefreshCw,
  TrendingUp, GraduationCap,
} from 'lucide-react';
import api from '@/lib/api';
import type { DcDashboard, DcTeacherIndividual, DcTeachersDevelopment } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function TeachersSubPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DcDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIndividual, setShowIndividual] = useState(false);
  const [individualRecords, setIndividualRecords] = useState<DcTeacherIndividual[]>([]);
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [devRecords, setDevRecords] = useState<DcTeachersDevelopment[]>([]);
  const [loadingDev, setLoadingDev] = useState(false);

  useEffect(() => {
    api.get(`/data-collection/schools/${id}/dashboard`)
      .then(({ data }) => setDashboard(data))
      .catch(() => router.push('/data-collection/schools'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadIndividual = useCallback(async () => {
    setLoadingIndividual(true);
    try {
      const { data } = await api.get<DcTeacherIndividual[]>(
        `/data-collection/teachers/individual/school/${id}`,
      );
      setIndividualRecords(data);
    } catch { setIndividualRecords([]); }
    finally { setLoadingIndividual(false); }
  }, [id]);

  const loadDev = useCallback(async () => {
    setLoadingDev(true);
    try {
      const { data } = await api.get<DcTeachersDevelopment[]>(
        `/data-collection/teachers/development/school/${id}`,
      );
      setDevRecords(data);
    } catch { setDevRecords([]); }
    finally { setLoadingDev(false); }
  }, [id]);

  const handleToggleIndividual = () => {
    if (!showIndividual) loadIndividual();
    setShowIndividual((p) => !p);
  };
  const handleToggleDev = () => {
    if (!showDev) loadDev();
    setShowDev((p) => !p);
  };

  if (loading) {
    return (
      <>
        <Header title="Teachers Information" />
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        </div>
      </>
    );
  }
  if (!dashboard) return null;

  const school = dashboard.school;
  const forms = dashboard.forms;
  const teacherCount = forms.teachersInfo?.count ?? 0;
  const devCount     = forms.teachersDev?.count ?? 0;
  const doneCount = (teacherCount > 0 ? 1 : 0) + (devCount > 0 ? 1 : 0);
  const allDone = doneCount >= 2;

  const fmtList = (raw?: string) =>
    raw ? raw.split(',').map((s) => s.trim()).filter(Boolean).join(' • ') : '—';

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  return (
    <>
      <Header
        title="Teachers Information"
        subtitle={school.name}
        actions={
          <Button variant="outline" onClick={() => router.push(`/data-collection/schools/${id}`)}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* Summary Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-700 text-white shadow-lg">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Teachers Information Forms</h2>
                  <p className="text-sm text-gray-500">
                    {school.name} &bull; <span className="font-mono text-xs text-gray-400">{school.code}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                    <p className={`text-2xl font-bold ${teacherCount > 0 ? 'text-pink-600' : 'text-gray-400'}`}>{teacherCount}</p>
                    <p className="text-xs text-gray-500">Teachers Added</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-2 text-center">
                    <p className={`text-2xl font-bold ${devCount > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{devCount}</p>
                    <p className="text-xs text-gray-500">Dev. Months</p>
                  </div>
                </div>
                {allDone ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 size={24} className="text-green-600" />
                  </div>
                ) : (
                  <div className="h-10 w-10">
                    <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ec4899" strokeWidth="3"
                        strokeDasharray={`${(doneCount / 2) * 100} 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">

          {/* Teachers' Information card */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Link href={`/data-collection/forms/teachers-information?school=${id}`} className="group flex-1 block">
              <Card className={`relative h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${teacherCount > 0 ? 'ring-2 ring-pink-200' : 'ring-1 ring-gray-100'}`}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50">
                      <Users size={22} className="text-pink-600" />
                    </div>
                    {teacherCount > 0 ? (
                      <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> {teacherCount} Entries</Badge>
                    ) : (
                      <Badge variant="default" className="gap-1"><XCircle size={12} /> No entries yet</Badge>
                    )}
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Teachers&apos; Information</h3>
                  <p className="text-xs text-gray-400">Individual teacher records — designation, qualification, experience, subjects &amp; training</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-pink-600 opacity-0 transition-opacity group-hover:opacity-100">
                    {teacherCount > 0 ? 'Add More / View' : 'Add Teachers'} <ChevronRight size={14} />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <button
              type="button"
              onClick={handleToggleIndividual}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 font-semibold text-sm transition-all duration-200 sm:min-w-[160px] ${
                showIndividual
                  ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-pink-300 hover:bg-pink-50/40 hover:text-pink-600'
              }`}
            >
              {showIndividual ? <><X size={16} /> Hide</> : <><TableProperties size={16} /> View Responses</>}
            </button>
          </div>

          {showIndividual && (
            <Card className="overflow-hidden border-0 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Users size={18} className="shrink-0 text-pink-600" />
                  <h3 className="font-semibold text-gray-800">Teacher Records</h3>
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">{individualRecords.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={loadIndividual} disabled={loadingIndividual} className="gap-1.5 text-xs">
                  <RefreshCw size={13} className={loadingIndividual ? 'animate-spin' : ''} /> Refresh
                </Button>
              </div>
              {loadingIndividual ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
                </div>
              ) : individualRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Users size={36} className="mb-3 opacity-30" />
                  <p className="text-sm">No teacher records yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Designation</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Gender</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Qualification</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Exp. (Yrs)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Subjects</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Training</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className="flex items-center justify-end gap-1"><TrendingUp size={12} /> Score</span>
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Added At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {individualRecords.map((r, idx) => (
                        <tr key={r.id} className={`transition-colors hover:brightness-95 ${idx % 2 === 0 ? 'bg-white' : 'bg-pink-50/30'}`}>
                          <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.name}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.designation === 'Head Teacher' ? 'bg-purple-100 text-purple-700' :
                              r.designation === 'Assistant Teacher' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{r.designation}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.gender === 'Male' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'
                            }`}>{r.gender}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.educationalQualification}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-700">{Number(r.experienceYears).toFixed(1)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{fmtList(r.subjectExpertise)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{fmtList(r.trainingReceived)}</td>
                          <td className="px-4 py-3 text-right">
                            {r.assessmentScore != null ? (
                              <span className={`font-semibold text-sm ${
                                Number(r.assessmentScore) >= 80 ? 'text-emerald-600' :
                                Number(r.assessmentScore) >= 60 ? 'text-amber-600' : 'text-red-600'
                              }`}>{Number(r.assessmentScore).toFixed(0)}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Teachers' Development card */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Link href={`/data-collection/forms/teachers-development?school=${id}`} className="group flex-1 block">
              <Card className={`relative h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${devCount > 0 ? 'ring-2 ring-rose-200' : 'ring-1 ring-gray-100'}`}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
                      <BookOpen size={22} className="text-rose-600" />
                    </div>
                    {devCount > 0 ? (
                      <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> {devCount} month{devCount > 1 ? 's' : ''} recorded</Badge>
                    ) : (
                      <Badge variant="default" className="gap-1"><XCircle size={12} /> No entries yet</Badge>
                    )}
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Teachers&apos; Development</h3>
                  <p className="text-xs text-gray-400">Monthly training stats — online/offline refreshers, forums and training programs</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-rose-600 opacity-0 transition-opacity group-hover:opacity-100">
                    {devCount > 0 ? 'Update / Add Month' : 'Add Development Data'} <ChevronRight size={14} />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <button
              type="button"
              onClick={handleToggleDev}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 font-semibold text-sm transition-all duration-200 sm:min-w-[160px] ${
                showDev
                  ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-rose-300 hover:bg-rose-50/40 hover:text-rose-600'
              }`}
            >
              {showDev ? <><X size={16} /> Hide</> : <><TableProperties size={16} /> View Responses</>}
            </button>
          </div>

          {showDev && (
            <Card className="overflow-hidden border-0 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <BookOpen size={18} className="shrink-0 text-rose-600" />
                  <h3 className="font-semibold text-gray-800">Development Records</h3>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{devRecords.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={loadDev} disabled={loadingDev} className="gap-1.5 text-xs">
                  <RefreshCw size={13} className={loadingDev ? 'animate-spin' : ''} /> Refresh
                </Button>
              </div>
              {loadingDev ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
                </div>
              ) : devRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BookOpen size={36} className="mb-3 opacity-30" />
                  <p className="text-sm">No development records yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Month</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Online Ref.</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Offline Ref.</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Dev. Forum</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Basic Train.</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Subject Train.</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Leadership</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Others</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Updated At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {devRecords.map((r, idx) => {
                        const total = r.onlineRefresher + r.offlineRefresher + r.developmentForum +
                          r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others;
                        return (
                          <tr key={r.id} className={`transition-colors hover:brightness-95 ${idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30'}`}>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">{r.month}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.onlineRefresher}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.offlineRefresher}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.developmentForum}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.basicTraining}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.subjectBasedTraining}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.leadershipTraining}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{r.others}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-700 text-sm">{total}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {devRecords.length > 1 && (
                      <tfoot>
                        <tr className="border-t-2 border-rose-200 bg-rose-50/50">
                          <td className="px-4 py-3 text-xs font-bold text-rose-700">Totals</td>
                          {(['onlineRefresher','offlineRefresher','developmentForum','basicTraining','subjectBasedTraining','leadershipTraining','others'] as const).map((k) => (
                            <td key={String(k)} className="px-4 py-3 text-right font-bold text-gray-700">
                              {devRecords.reduce((s, r) => s + Number(r[k] ?? 0), 0)}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            {devRecords.reduce((s, r) =>
                              s + r.onlineRefresher + r.offlineRefresher + r.developmentForum +
                              r.basicTraining + r.subjectBasedTraining + r.leadershipTraining + r.others, 0)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
              {devRecords.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap gap-2">
                  {MONTHS.filter((m) => devRecords.some((r) => r.month === m)).map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">
                      {m} <CheckCircle2 size={11} className="text-emerald-500" />
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
