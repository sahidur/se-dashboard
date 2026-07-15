'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Save,
  Send,
  Layers,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  FileIcon,
  Building2,
  MapPin,
  Search,
  School,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import type { Survey, SurveyField, SurveySection, SurveyAnswer, GeoLocation, SchoolRecord } from '@/types';

interface FieldAnswer {
  fieldId: string;
  textValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  jsonValue?: any;
  fileUrl?: string;
}

// ---------- File Upload Component ----------
function FileUploader({
  field,
  value,
  onChange,
  error,
}: {
  field: SurveyField;
  value: string;
  onChange: (url: string) => void;
  error?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  const maxSize = field.maxFileSize || 200 * 1024 * 1024; // 200MB default
  const allowed = field.allowedFileTypes || '*';

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      alert(`File too large. Maximum size: ${(maxSize / 1048576).toFixed(0)}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/files/upload?folder=survey-uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      onChange(data.url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to upload file');
      setFileName('');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <FileIcon size={20} className="text-green-600" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-green-800">
              {fileName || 'Uploaded file'}
            </p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 underline"
            >
              View file
            </a>
          </div>
          <button
            onClick={() => { onChange(''); setFileName(''); }}
            className="rounded-full p-1 text-green-600 hover:bg-green-100"
          >
            <X size={16} />
          </button>
        </div>
      ) : uploading ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <span className="text-sm text-brand-700">Uploading {fileName}...</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-brand-500">{progress}%</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-colors ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50'
          }`}
        >
          <Upload size={28} className={error ? 'text-red-400' : 'text-gray-400'} />
          <p className="text-sm font-medium text-gray-600">
            Click to upload a file
          </p>
          <p className="text-xs text-gray-400">
            {allowed !== '*' ? `Allowed: ${allowed}` : 'All file types accepted'}
            {' · '}Max {(maxSize / 1048576).toFixed(0)}MB
          </p>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={allowed !== '*' ? allowed : undefined}
        className="hidden"
        onChange={handleUpload}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

// ---------- Cascading Address Component ----------
function CascadingAddress({
  value,
  onChange,
  error,
}: {
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const [divisions, setDivisions] = useState<GeoLocation[]>([]);
  const [districts, setDistricts] = useState<GeoLocation[]>([]);
  const [thanas, setThanas] = useState<GeoLocation[]>([]);
  const [areas, setAreas] = useState<GeoLocation[]>([]);

  const addr = value || { division: '', district: '', thana: '', area: '', details: '' };

  useEffect(() => {
    api.get('/geo-locations/divisions').then(({ data }) => setDivisions(data)).catch(() => {});
  }, []);

  const handleChange = async (level: string, id: string) => {
    const newAddr = { ...addr };
    if (level === 'division') {
      const div = divisions.find((d) => d.id === id);
      newAddr.division = id;
      newAddr.divisionName = div?.name || '';
      newAddr.district = '';
      newAddr.districtName = '';
      newAddr.thana = '';
      newAddr.thanaName = '';
      newAddr.area = '';
      newAddr.areaName = '';
      setDistricts([]);
      setThanas([]);
      setAreas([]);
      if (id) {
        const { data } = await api.get(`/geo-locations/${id}/children`);
        setDistricts(data);
      }
    } else if (level === 'district') {
      const dist = districts.find((d) => d.id === id);
      newAddr.district = id;
      newAddr.districtName = dist?.name || '';
      newAddr.thana = '';
      newAddr.thanaName = '';
      newAddr.area = '';
      newAddr.areaName = '';
      setThanas([]);
      setAreas([]);
      if (id) {
        const { data } = await api.get(`/geo-locations/${id}/children`);
        setThanas(data);
      }
    } else if (level === 'thana') {
      const th = thanas.find((d) => d.id === id);
      newAddr.thana = id;
      newAddr.thanaName = th?.name || '';
      newAddr.area = '';
      newAddr.areaName = '';
      setAreas([]);
      if (id) {
        const { data } = await api.get(`/geo-locations/${id}/children`);
        setAreas(data);
      }
    } else if (level === 'area') {
      const ar = areas.find((d) => d.id === id);
      newAddr.area = id;
      newAddr.areaName = ar?.name || '';
    }
    onChange(newAddr);
  };

  const selectClass = `w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
    error ? 'border-red-300 bg-red-50' : 'border-gray-300'
  }`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Division</label>
          <select value={addr.division || ''} onChange={(e) => handleChange('division', e.target.value)} className={selectClass}>
            <option value="">Select Division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">District</label>
          <select value={addr.district || ''} onChange={(e) => handleChange('district', e.target.value)} disabled={!addr.division} className={selectClass}>
            <option value="">Select District</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Thana</label>
          <select value={addr.thana || ''} onChange={(e) => handleChange('thana', e.target.value)} disabled={!addr.district} className={selectClass}>
            <option value="">Select Thana</option>
            {thanas.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Area</label>
          <select value={addr.area || ''} onChange={(e) => handleChange('area', e.target.value)} disabled={!addr.thana} className={selectClass}>
            <option value="">Select Area</option>
            {areas.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Address Details</label>
        <textarea
          placeholder="House no, road, street..."
          value={addr.details || ''}
          onChange={(e) => onChange({ ...addr, details: e.target.value })}
          rows={2}
          className={selectClass}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

export default function FillSurveyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, FieldAnswer>>({});
  const [draftResponseId, setDraftResponseId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // School record selection for school-linked surveys
  const [mySchoolRecords, setMySchoolRecords] = useState<SchoolRecord[]>([]);
  const [selectedSchoolRecordId, setSelectedSchoolRecordId] = useState<string | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');

  // Derived: does this survey require school selection?
  const requiresSchool = survey?.linkedEntityType === 'school_record' && !survey?.createsSchoolRecord;
  const schoolSelected = !!selectedSchoolRecordId;
  const selectedSchoolRecord = mySchoolRecords.find((r) => r.id === selectedSchoolRecordId);
  const filteredSchoolRecords = mySchoolRecords.filter((r) =>
    r.name.toLowerCase().includes(schoolSearch.toLowerCase()),
  );

  useEffect(() => {
    const fetchSurveyAndDraft = async () => {
      try {
        const [surveyRes, draftRes] = await Promise.all([
          api.get(`/surveys/${id}`),
          api.get(`/surveys/${id}/draft`).catch(() => ({ data: { draft: null } })),
        ]);
        const surveyData = surveyRes.data;
        setSurvey(surveyData);

        // If school-linked, fetch user's school records
        if (surveyData.linkedEntityType === 'school_record') {
          try {
            const { data: records } = await api.get('/surveys/school-records/my');
            setMySchoolRecords(records);
          } catch {
            // No school records available
          }
        }

        // Load draft answers if they exist
        const draft = draftRes.data;
        if (draft && draft.id) {
          setDraftResponseId(draft.id);
          if (draft.schoolRecordId) {
            setSelectedSchoolRecordId(draft.schoolRecordId);
          }
          const draftAnswers: Record<string, FieldAnswer> = {};
          (draft.answers || []).forEach((a: SurveyAnswer) => {
            draftAnswers[a.fieldId || a.field?.id] = {
              fieldId: a.fieldId || a.field?.id,
              textValue: a.textValue,
              numberValue: a.numberValue,
              booleanValue: a.booleanValue,
              jsonValue: a.jsonValue,
              fileUrl: a.fileUrl,
            };
          });
          setAnswers(draftAnswers);
        }
      } catch {
        router.push('/surveys/assigned');
      } finally {
        setLoading(false);
      }
    };
    fetchSurveyAndDraft();
  }, [id]);

  const getAllFields = useCallback((): SurveyField[] => {
    if (!survey) return [];
    if (survey.sections && survey.sections.length > 0) {
      return survey.sections
        .sort((a, b) => a.order - b.order)
        .flatMap((s) => (s.fields || []).sort((a, b) => a.order - b.order));
    }
    return (survey.fields || []).sort((a, b) => a.order - b.order);
  }, [survey]);

  const updateAnswer = (fieldId: string, value: Partial<FieldAnswer>) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], fieldId, ...value },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    const allFields = getAllFields();
    for (const field of allFields) {
      if (field.isRequired) {
        const answer = answers[field.id];
        if (!answer) {
          newErrors[field.id] = 'This field is required';
          continue;
        }
        const hasValue =
          (answer.textValue && answer.textValue.trim()) ||
          answer.numberValue !== undefined && answer.numberValue !== null ||
          answer.booleanValue !== undefined ||
          answer.jsonValue !== undefined ||
          answer.fileUrl;
        if (!hasValue) {
          newErrors[field.id] = 'This field is required';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = (isDraft: boolean) => {
    const allFields = getAllFields();
    const answerList = allFields
      .filter((f) => answers[f.id])
      .map((f) => answers[f.id]);

    return {
      surveyId: id as string,
      answers: answerList,
      isDraft,
      ...(draftResponseId && { responseId: draftResponseId }),
      ...(selectedSchoolRecordId && { schoolRecordId: selectedSchoolRecordId }),
    };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildPayload(true);
      const { data } = await api.post('/surveys/responses', payload);
      setDraftResponseId(data.id);
      alert('Draft saved successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Validate school record selection first
    if (requiresSchool && !selectedSchoolRecordId) {
      alert('Please select a school record before submitting');
      return;
    }
    if (!validateFields()) {
      alert('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(false);
      await api.post('/surveys/responses', payload);
      setSubmitted(true);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: SurveyField) => {
    const answer = answers[field.id] || {};
    const error = errors[field.id];

    const wrapperClass = `space-y-1.5 ${error ? 'animate-shake' : ''}`;

    const label = (
      <label className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.isRequired && <span className="ml-1 text-red-500">*</span>}
        {field.helpText && (
          <span className="ml-2 text-xs font-normal text-gray-400">
            {field.helpText}
          </span>
        )}
      </label>
    );

    const errorMsg = error && (
      <p className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle size={12} /> {error}
      </p>
    );

    const inputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
      error ? 'border-red-300 bg-red-50' : 'border-gray-300'
    }`;

    switch (field.fieldType) {
      case 'short_text':
      case 'email':
      case 'phone':
        return (
          <div className={wrapperClass}>
            {label}
            <input
              type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
              placeholder={field.placeholder || ''}
              value={answer.textValue || ''}
              onChange={(e) => updateAnswer(field.id, { textValue: e.target.value })}
              className={inputClass}
            />
            {errorMsg}
          </div>
        );

      case 'long_text':
        return (
          <div className={wrapperClass}>
            {label}
            <textarea
              placeholder={field.placeholder || ''}
              value={answer.textValue || ''}
              onChange={(e) => updateAnswer(field.id, { textValue: e.target.value })}
              rows={4}
              className={inputClass}
            />
            {errorMsg}
          </div>
        );

      case 'address':
        return (
          <div className={wrapperClass}>
            {label}
            <CascadingAddress
              value={answer.jsonValue}
              onChange={(val) => updateAnswer(field.id, { jsonValue: val })}
              error={error}
            />
          </div>
        );

      case 'number':
        return (
          <div className={wrapperClass}>
            {label}
            <input
              type="number"
              placeholder={field.placeholder || ''}
              value={answer.numberValue ?? ''}
              onChange={(e) =>
                updateAnswer(field.id, {
                  numberValue: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={inputClass}
            />
            {errorMsg}
          </div>
        );

      case 'date':
        return (
          <div className={wrapperClass}>
            {label}
            <input
              type="date"
              value={answer.textValue || ''}
              onChange={(e) => updateAnswer(field.id, { textValue: e.target.value })}
              className={inputClass}
            />
            {errorMsg}
          </div>
        );

      case 'true_false':
        return (
          <div className={wrapperClass}>
            {label}
            <div className="flex gap-4">
              {['Yes', 'No'].map((opt) => {
                const val = opt === 'Yes';
                return (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      answer.booleanValue === val
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`field-${field.id}`}
                      checked={answer.booleanValue === val}
                      onChange={() => updateAnswer(field.id, { booleanValue: val })}
                      className="sr-only"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
            {errorMsg}
          </div>
        );

      case 'single_choice':
        return (
          <div className={wrapperClass}>
            {label}
            <div className="space-y-2">
              {(field.options || []).map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    answer.textValue === opt
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`field-${field.id}`}
                    checked={answer.textValue === opt}
                    onChange={() => updateAnswer(field.id, { textValue: opt })}
                    className="accent-brand-500"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {errorMsg}
          </div>
        );

      case 'multiple_choice':
        const selectedOptions: string[] = answer.jsonValue || [];
        return (
          <div className={wrapperClass}>
            {label}
            <div className="space-y-2">
              {(field.options || []).map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    selectedOptions.includes(opt)
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(opt)}
                    onChange={(e) => {
                      const newVal = e.target.checked
                        ? [...selectedOptions, opt]
                        : selectedOptions.filter((o) => o !== opt);
                      updateAnswer(field.id, { jsonValue: newVal });
                    }}
                    className="accent-brand-500"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {errorMsg}
          </div>
        );

      case 'dropdown':
      case 'single_select_searchable':
        return (
          <div className={wrapperClass}>
            {label}
            <select
              value={answer.textValue || ''}
              onChange={(e) => updateAnswer(field.id, { textValue: e.target.value })}
              className={inputClass}
            >
              <option value="">Select an option</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {errorMsg}
          </div>
        );

      case 'multi_select_searchable':
        const multiSelected: string[] = answer.jsonValue || [];
        return (
          <div className={wrapperClass}>
            {label}
            <div className="flex flex-wrap gap-1 mb-2">
              {multiSelected.map((opt) => (
                <Badge key={opt} variant="info" className="gap-1">
                  {opt}
                  <button
                    onClick={() =>
                      updateAnswer(field.id, {
                        jsonValue: multiSelected.filter((o) => o !== opt),
                      })
                    }
                    className="ml-1 text-xs"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !multiSelected.includes(e.target.value)) {
                  updateAnswer(field.id, {
                    jsonValue: [...multiSelected, e.target.value],
                  });
                }
              }}
              className={inputClass}
            >
              <option value="">Add option...</option>
              {(field.options || [])
                .filter((opt) => !multiSelected.includes(opt))
                .map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            {errorMsg}
          </div>
        );

      case 'location':
        const locValue = answer.jsonValue || { lat: '', lng: '' };
        return (
          <div className={wrapperClass}>
            {label}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={locValue.lat || ''}
                onChange={(e) =>
                  updateAnswer(field.id, {
                    jsonValue: { ...locValue, lat: e.target.value },
                  })
                }
                className={inputClass}
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={locValue.lng || ''}
                onChange={(e) =>
                  updateAnswer(field.id, {
                    jsonValue: { ...locValue, lng: e.target.value },
                  })
                }
                className={inputClass}
              />
            </div>
            {errorMsg}
          </div>
        );

      case 'file_upload':
        return (
          <div className={wrapperClass}>
            {label}
            <FileUploader
              field={field}
              value={answer.fileUrl || ''}
              onChange={(url) => updateAnswer(field.id, { fileUrl: url })}
              error={error}
            />
          </div>
        );

      default:
        return (
          <div className={wrapperClass}>
            {label}
            <input
              type="text"
              placeholder={field.placeholder || ''}
              value={answer.textValue || ''}
              onChange={(e) => updateAnswer(field.id, { textValue: e.target.value })}
              className={inputClass}
            />
            {errorMsg}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        <Header title="Survey Submitted" subtitle={survey?.title || ''} />
        <div className="page-container">
          <div className="mx-auto max-w-xl py-16 text-center">
            <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Thank you!
            </h2>
            <p className="text-gray-500 mb-6">
              Your response has been submitted successfully.
            </p>
            <Button onClick={() => router.push('/surveys/assigned')}>
              <ArrowLeft size={16} className="mr-1" /> Back to Assigned Surveys
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (!survey) return null;

  const hasSections = survey.sections && survey.sections.length > 0;

  return (
    <>
      <Header
        title={survey.title}
        subtitle={survey.description || 'Fill in the survey'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/surveys/assigned')}
              className="gap-1.5 border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              loading={saving}
            >
              <Save size={16} className="mr-1" /> <span className="hidden sm:inline">Save Draft</span>
            </Button>
            <Button size="sm" onClick={handleSubmit} loading={submitting}>
              <Send size={16} className="mr-1" /> Submit
            </Button>
          </div>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-3xl space-y-6">
          {draftResponseId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <Save size={16} />
              You have a saved draft. Continue where you left off.
            </div>
          )}

          {/* School Record Selection for school-linked surveys */}
          {requiresSchool && (
            <div className="animate-fadeIn">
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <Building2 size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Select School</h3>
                      <p className="text-xs text-white/70">
                        Choose a school record to link with this survey response
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  {selectedSchoolRecord ? (
                    /* ─── Selected School Confirmation ─── */
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 rounded-xl border-2 border-green-200 bg-green-50 p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                          <CheckCircle2 size={24} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-green-900 text-lg">{selectedSchoolRecord.name}</p>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            {selectedSchoolRecord.school && (
                              <div className="flex items-center gap-1.5 text-green-700">
                                <School size={14} />
                                <span>School: {selectedSchoolRecord.school.name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-green-700">
                              <Info size={14} />
                              <span>ID: {selectedSchoolRecord.id.slice(0, 8)}...</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-green-700">
                              <Building2 size={14} />
                              <span>Created: {new Date(selectedSchoolRecord.createdAt).toLocaleDateString()}</span>
                            </div>
                            {selectedSchoolRecord.metadata && Object.keys(selectedSchoolRecord.metadata).length > 0 && (
                              <>
                                {Object.entries(selectedSchoolRecord.metadata).slice(0, 3).map(([key, val]) => (
                                  <div key={key} className="flex items-center gap-1.5 text-green-700">
                                    <Info size={14} />
                                    <span className="capitalize">{key}: {String(val)}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSchoolRecordId(null);
                          setSchoolSearch('');
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                      >
                        Change school record
                      </button>
                    </div>
                  ) : (
                    /* ─── School Search & Selection ─── */
                    <div className="space-y-3">
                      {mySchoolRecords.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-gray-400">
                          <Building2 size={40} className="mb-2 opacity-50" />
                          <p className="font-medium text-gray-500">No school records found</p>
                          <p className="text-sm">You need to create a school record first.</p>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={schoolSearch}
                              onChange={(e) => setSchoolSearch(e.target.value)}
                              placeholder="Search school records..."
                              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto">
                            {filteredSchoolRecords.map((record) => (
                              <button
                                key={record.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSchoolRecordId(record.id);
                                  setSchoolSearch('');
                                }}
                                className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm"
                              >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                                  <Building2 size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900">{record.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {record.school ? `${record.school.name} · ` : ''}
                                    Created {new Date(record.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </button>
                            ))}
                            {filteredSchoolRecords.length === 0 && schoolSearch && (
                              <p className="py-4 text-center text-sm text-gray-400">
                                No records match &quot;{schoolSearch}&quot;
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Warning: must select school before filling */}
              {!schoolSelected && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertCircle size={16} className="shrink-0" />
                  Please select a school record above before filling in the survey.
                </div>
              )}
            </div>
          )}

          {/* Form content — disabled overlay if school required but not selected */}
          <div className={requiresSchool && !schoolSelected ? 'pointer-events-none opacity-40 select-none' : ''}>
          {hasSections ? (
            survey.sections!
              .sort((a, b) => a.order - b.order)
              .map((section, sIdx) => (
                <Card key={section.id} className="mb-6">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Layers size={18} className="text-brand-500" />
                      <CardTitle>
                        {section.title}
                      </CardTitle>
                    </div>
                    {section.description && (
                      <p className="text-sm text-gray-500">
                        {section.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {(section.fields || [])
                        .sort((a, b) => a.order - b.order)
                        .map((field) => (
                          <div key={field.id}>{renderField(field)}</div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Survey Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {(survey.fields || [])
                    .sort((a, b) => a.order - b.order)
                    .map((field) => (
                      <div key={field.id}>{renderField(field)}</div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bottom Actions */}
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 mt-6 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              loading={saving}
              disabled={requiresSchool && !schoolSelected}
              className="w-full sm:w-auto"
            >
              <Save size={16} className="mr-1" /> Save as Draft
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={requiresSchool && !schoolSelected}
              className="w-full sm:w-auto"
            >
              <Send size={16} className="mr-1" /> Submit Response
            </Button>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
