'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ClipboardCheck,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { Survey } from '@/types';

export default function AssignedSurveysPage() {
  const router = useRouter();
  const { hasAnyRole, hasPermission } = useAuthStore();
  const canAccessSurveyManagement =
    hasAnyRole('Super Admin', 'Admin', 'Survey Creator') ||
    hasPermission('surveys', 'read');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get('/surveys/assigned');
        const all = Array.isArray(data) ? data : data.data || [];
        // Only show published surveys that haven't expired
        setSurveys(
          all.filter(
            (s: Survey) =>
              s.status === 'published' &&
              (!s.endDate || new Date(s.endDate) >= new Date()),
          ),
        );
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    };
    fetchAssigned();
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'published':
        return 'success';
      case 'closed':
        return 'warning';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Assigned Surveys"
        subtitle="Surveys assigned to you"
        actions={
          canAccessSurveyManagement ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/surveys')}
            >
              <ArrowLeft size={16} className="mr-1" /> All Surveys
            </Button>
          ) : undefined
        }
      />
      <div className="page-container">
        {surveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ClipboardCheck size={48} className="mb-3" />
            <p className="text-lg font-medium">No assigned surveys</p>
            <p className="text-sm">
              Surveys assigned to you will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.map((survey) => (
              <Card
                key={survey.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/surveys/${survey.id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {survey.title}
                      </h3>
                      <Badge variant={statusColor(survey.status) as any}>
                        {survey.status.toUpperCase()}
                      </Badge>
                    </div>
                    {survey.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-1">
                        {survey.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      {survey.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(survey.startDate)}
                          {survey.endDate && ` — ${formatDate(survey.endDate)}`}
                        </span>
                      )}
                      <span>
                        {survey.fields?.length || 0} fields
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {survey.status === 'published' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/surveys/${survey.id}/fill`);
                        }}
                      >
                        <ClipboardCheck size={16} className="mr-1" /> Fill Survey
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
