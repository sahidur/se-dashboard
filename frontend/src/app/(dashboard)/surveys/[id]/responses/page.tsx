'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Download,
  Eye,
  Calendar,
  Users,
  Filter,
} from 'lucide-react';
import { formatDate, formatDateTime, FIELD_TYPE_LABELS } from '@/lib/utils';
import api, { getErrorMessage } from '@/lib/api';
import type { Survey, SurveyResponse as SurveyResponseType } from '@/types';

export default function SurveyResponsesPage() {
  const { id } = useParams();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponseType[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedResponse, setSelectedResponse] =
    useState<SurveyResponseType | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const fetchSurvey = useCallback(async () => {
    try {
      const { data } = await api.get(`/surveys/${id}`);
      setSurvey(data);
    } catch {
      router.push('/surveys');
    }
  }, [id, router]);

  // Filters are passed as arguments (rather than read from state) so this stays
  // referentially stable and only the effect watching them refetches.
  const fetchResponses = useCallback(
    async (page = 1, startDate = '', endDate = '') => {
      try {
        const params: Record<string, string | number> = { page, limit: 20 };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const { data } = await api.get(`/surveys/${id}/responses`, { params });
        setResponses(data.data || []);
        setTotalResponses(data.meta?.total || 0);
      } catch {
        /* empty */
      }
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    fetchSurvey().finally(() => setLoading(false));
  }, [fetchSurvey]);

  useEffect(() => {
    fetchResponses(currentPage, startDateFilter, endDateFilter);
  }, [currentPage, startDateFilter, endDateFilter, fetchResponses]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const response = await api.get(`/surveys/${id}/responses/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `survey-responses-${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to export CSV'));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalResponses / 20);

  if (loading || !survey) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header
        title={`Responses: ${survey.title}`}
        subtitle={`${totalResponses} total responses`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/surveys/${id}`)}
            >
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            {totalResponses > 0 && (
              <Button
                size="sm"
                onClick={handleExportCsv}
                loading={exporting}
              >
                <Download size={16} className="mr-1" /> Export CSV
              </Button>
            )}
          </div>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Users className="text-brand-500" size={24} />
                <div>
                  <p className="text-xl font-bold">{totalResponses}</p>
                  <p className="text-xs text-gray-500">Total Responses</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Calendar className="text-accent-blue" size={24} />
                <div>
                  <p className="text-sm font-medium">
                    {survey.startDate
                      ? formatDate(survey.startDate)
                      : 'Not set'}
                  </p>
                  <p className="text-xs text-gray-500">Start Date</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Badge
                  variant={
                    survey.status === 'published'
                      ? 'success'
                      : survey.status === 'closed'
                      ? 'warning'
                      : 'default'
                  }
                >
                  {survey.status.toUpperCase()}
                </Badge>
                <p className="mt-1 text-xs text-gray-500">Survey Status</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Filter size={16} className="text-gray-400" />
                  Filter by date:
                </span>
                <Input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-40"
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-40"
                  placeholder="To"
                />
                {(startDateFilter || endDateFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDateFilter('');
                      setEndDateFilter('');
                      setCurrentPage(1);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Responses List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Responses</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No responses yet
                </p>
              ) : (
                <div className="space-y-2">
                  {responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {resp.respondent
                            ? `${resp.respondent.firstName} ${resp.respondent.lastName}`
                            : 'Anonymous'}
                        </p>
                        <p className="break-all text-xs text-gray-400">
                          {resp.respondent?.email && (
                            <span className="mr-3">
                              {resp.respondent.email}
                            </span>
                          )}
                          Submitted{' '}
                          {formatDateTime(
                            resp.submittedAt || resp.createdAt,
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={resp.isComplete ? 'success' : 'warning'}
                        >
                          {resp.isComplete ? 'Complete' : 'Partial'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedResponse(resp);
                            setShowResponseModal(true);
                          }}
                        >
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
                      <p className="text-sm text-gray-500">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(totalPages, p + 1),
                            )
                          }
                          disabled={currentPage >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Response Detail Modal */}
      <Modal
        isOpen={showResponseModal}
        onClose={() => setShowResponseModal(false)}
        title="Response Details"
        size="lg"
      >
        {selectedResponse && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm">
                <strong>Respondent:</strong>{' '}
                {selectedResponse.respondent
                  ? `${selectedResponse.respondent.firstName} ${selectedResponse.respondent.lastName}`
                  : 'Anonymous'}
              </p>
              {selectedResponse.respondent?.email && (
                <p className="text-sm">
                  <strong>Email:</strong> {selectedResponse.respondent.email}
                </p>
              )}
              <p className="text-sm">
                <strong>Submitted:</strong>{' '}
                {formatDateTime(
                  selectedResponse.submittedAt ||
                    selectedResponse.createdAt,
                )}
              </p>
              <p className="text-sm">
                <strong>Status:</strong>{' '}
                {selectedResponse.isComplete ? 'Complete' : 'Partial'}
              </p>
            </div>
            <div className="space-y-3">
              {selectedResponse.answers?.map((answer) => {
                const field = survey?.fields?.find(
                  (f) => f.id === answer.fieldId,
                );
                return (
                  <div key={answer.id} className="border-b pb-2">
                    <p className="text-xs font-medium text-gray-500">
                      {field?.label || `Field ${answer.fieldId}`}
                      {field && (
                        <span className="ml-2 text-gray-400">
                          ({FIELD_TYPE_LABELS[field.fieldType] ||
                            field.fieldType})
                        </span>
                      )}
                    </p>
                    <p className="text-sm mt-0.5">
                      {answer.textValue ||
                        (answer.numberValue !== undefined &&
                        answer.numberValue !== null
                          ? String(answer.numberValue)
                          : '') ||
                        (answer.booleanValue !== undefined
                          ? answer.booleanValue
                            ? 'Yes'
                            : 'No'
                          : '') ||
                        (answer.jsonValue
                          ? JSON.stringify(answer.jsonValue, null, 2)
                          : '') ||
                        answer.fileUrl ||
                        '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
