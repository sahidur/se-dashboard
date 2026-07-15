'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  AlertTriangle,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { FIELD_TYPE_LABELS } from '@/lib/utils';
import api from '@/lib/api';
import type { FieldType, LinkedEntityType, SurveyCategory } from '@/types';

interface FormField {
  label: string;
  fieldName: string;
  fieldType: FieldType;
  isRequired: boolean;
  options: string[];
  placeholder: string;
  helpText: string;
  order: number;
  allowedFileTypes: string;
  maxFileSize: number;
}

interface FormSection {
  title: string;
  description: string;
  order: number;
  fields: FormField[];
}

const defaultField: FormField = {
  label: '',
  fieldName: '',
  fieldType: 'short_text',
  isRequired: false,
  options: [],
  placeholder: '',
  helpText: '',
  order: 0,
  allowedFileTypes: '',
  maxFileSize: 5242880,
};

const fieldTypesNeedingOptions: FieldType[] = [
  'single_choice',
  'multiple_choice',
  'dropdown',
  'single_select_searchable',
  'multi_select_searchable',
];

export default function CreateSurveyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<SurveyCategory[]>([]);

  useEffect(() => {
    api.get('/surveys/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);
  const [survey, setSurvey] = useState({
    title: '',
    description: '',
    category: '',
    startDate: '',
    endDate: '',
    linkedEntityType: 'none' as LinkedEntityType,
    createsSchoolRecord: false,
  });
  const [sections, setSections] = useState<FormSection[]>([
    {
      title: 'Section 1',
      description: '',
      order: 0,
      fields: [{ ...defaultField }],
    },
  ]);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: '', message: '', action: () => {} });

  // Section operations
  const addSection = () => {
    setSections([
      ...sections,
      {
        title: `Section ${sections.length + 1}`,
        description: '',
        order: sections.length,
        fields: [{ ...defaultField }],
      },
    ]);
  };

  const removeSection = (sIdx: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== sIdx));
  };

  const updateSection = (sIdx: number, updates: Partial<FormSection>) => {
    setSections(
      sections.map((s, i) => (i === sIdx ? { ...s, ...updates } : s)),
    );
  };

  const moveSection = (sIdx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? sIdx - 1 : sIdx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const newSections = [...sections];
    [newSections[sIdx], newSections[newIdx]] = [
      newSections[newIdx],
      newSections[sIdx],
    ];
    setSections(newSections.map((s, i) => ({ ...s, order: i })));
  };

  // Field operations within a section
  const addField = (sIdx: number) => {
    const newSections = [...sections];
    newSections[sIdx].fields.push({
      ...defaultField,
      order: newSections[sIdx].fields.length,
    });
    setSections(newSections);
  };

  const removeField = (sIdx: number, fIdx: number) => {
    const newSections = [...sections];
    newSections[sIdx].fields = newSections[sIdx].fields.filter(
      (_, i) => i !== fIdx,
    );
    setSections(newSections);
  };

  const updateField = (
    sIdx: number,
    fIdx: number,
    updates: Partial<FormField>,
  ) => {
    const newSections = [...sections];
    newSections[sIdx].fields[fIdx] = {
      ...newSections[sIdx].fields[fIdx],
      ...updates,
    };
    setSections(newSections);
  };

  const moveField = (
    sIdx: number,
    fIdx: number,
    direction: 'up' | 'down',
  ) => {
    const newIdx = direction === 'up' ? fIdx - 1 : fIdx + 1;
    const fields = [...sections[sIdx].fields];
    if (newIdx < 0 || newIdx >= fields.length) return;
    [fields[fIdx], fields[newIdx]] = [fields[newIdx], fields[fIdx]];
    const newSections = [...sections];
    newSections[sIdx].fields = fields.map((f, i) => ({ ...f, order: i }));
    setSections(newSections);
  };

  const addOption = (sIdx: number, fIdx: number) => {
    const field = sections[sIdx].fields[fIdx];
    updateField(sIdx, fIdx, { options: [...field.options, ''] });
  };

  const updateOption = (
    sIdx: number,
    fIdx: number,
    optIdx: number,
    value: string,
  ) => {
    const field = sections[sIdx].fields[fIdx];
    const newOptions = [...field.options];
    newOptions[optIdx] = value;
    updateField(sIdx, fIdx, { options: newOptions });
  };

  const removeOption = (sIdx: number, fIdx: number, optIdx: number) => {
    const field = sections[sIdx].fields[fIdx];
    updateField(sIdx, fIdx, {
      options: field.options.filter((_, i) => i !== optIdx),
    });
  };

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    if (!survey.title || !survey.category) {
      alert('Please fill in the title and category');
      return;
    }

    const hasEmptyFields = sections.some((s) =>
      s.fields.some((f) => !f.label),
    );
    if (hasEmptyFields) {
      alert('All fields must have a label');
      return;
    }

    if (status === 'published') {
      setConfirmModal({
        open: true,
        title: 'Publish Survey',
        message:
          'Once published, survey fields cannot be edited. Are you sure you want to publish?',
        action: () => doSave('published'),
      });
      return;
    }

    doSave(status);
  };

  const doSave = async (status: 'draft' | 'published') => {
    try {
      setSaving(true);
      setConfirmModal((prev) => ({ ...prev, open: false }));

      const payload = {
        ...survey,
        status,
        startDate: survey.startDate || undefined,
        endDate: survey.endDate || undefined,
        sections: sections.map((s, sIdx) => ({
          title: s.title,
          description: s.description || undefined,
          order: sIdx,
          fields: s.fields.map((f, fIdx) => ({
            ...f,
            order: fIdx,
            fieldName: f.fieldName || undefined,
            options:
              f.options.length > 0 ? f.options.filter(Boolean) : undefined,
            allowedFileTypes: f.allowedFileTypes || undefined,
            maxFileSize: f.maxFileSize || undefined,
          })),
        })),
      };
      const { data } = await api.post('/surveys', payload);
      router.push(`/surveys/${data.id}`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create survey');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Create Survey"
        subtitle="Design a new survey with sections and fields"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/surveys')}
              className="gap-1.5"
            >
              <ArrowLeft size={16} /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('draft')}
              loading={saving}
            >
              <Save size={16} className="mr-1" /> Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave('published')}
              loading={saving}
            >
              Publish
            </Button>
          </div>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Survey Details */}
          <Card>
            <CardHeader>
              <CardTitle>Survey Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Title"
                placeholder="Enter survey title"
                value={survey.title}
                onChange={(e) =>
                  setSurvey({ ...survey, title: e.target.value })
                }
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  placeholder="Describe the purpose of this survey"
                  value={survey.description}
                  onChange={(e) =>
                    setSurvey({ ...survey, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={survey.category}
                    onChange={(e) => setSurvey({ ...survey, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Start Date"
                  type="date"
                  value={survey.startDate}
                  onChange={(e) =>
                    setSurvey({ ...survey, startDate: e.target.value })
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={survey.endDate}
                  onChange={(e) =>
                    setSurvey({ ...survey, endDate: e.target.value })
                  }
                />
              </div>

              {/* School-Linked Survey Settings */}
              <div className="border-t pt-4 mt-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Linked Entity Type
                </label>
                <select
                  value={survey.linkedEntityType}
                  onChange={(e) =>
                    setSurvey({
                      ...survey,
                      linkedEntityType: e.target.value as LinkedEntityType,
                      createsSchoolRecord:
                        e.target.value === 'none'
                          ? false
                          : survey.createsSchoolRecord,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="none">None</option>
                  <option value="school_record">School Record</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Link this survey to an entity type. School-linked surveys require respondents to select a school record.
                </p>
              </div>

              {survey.linkedEntityType === 'school_record' && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <input
                    type="checkbox"
                    id="createsSchoolRecord"
                    checked={survey.createsSchoolRecord}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        createsSchoolRecord: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label
                    htmlFor="createsSchoolRecord"
                    className="text-sm text-gray-700"
                  >
                    <span className="font-medium">This survey creates school records.</span>{' '}
                    When checked, each response will create a new school record that other surveys can link to.
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sections */}
          {sections.map((section, sIdx) => (
            <Card key={sIdx}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Layers size={18} className="text-brand-500" />
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        updateSection(sIdx, { title: e.target.value })
                      }
                      placeholder="Section Title"
                      className="text-lg font-semibold bg-transparent border-none outline-none flex-1 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sections.length - 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(sIdx)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={section.description}
                  onChange={(e) =>
                    updateSection(sIdx, { description: e.target.value })
                  }
                  placeholder="Section description (optional)"
                  className="text-sm text-gray-500 bg-transparent border-none outline-none w-full focus:ring-0 mt-1"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {section.fields.map((field, fIdx) => (
                  <div
                    key={fIdx}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical
                          size={16}
                          className="cursor-grab text-gray-400"
                        />
                        <span className="text-sm font-medium text-gray-500">
                          Q{fIdx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveField(sIdx, fIdx, 'up')}
                          disabled={fIdx === 0}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveField(sIdx, fIdx, 'down')}
                          disabled={fIdx === section.fields.length - 1}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => removeField(sIdx, fIdx)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Label"
                          placeholder="Question text"
                          value={field.label}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              label: e.target.value,
                            })
                          }
                        />
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Field Type
                          </label>
                          <select
                            value={field.fieldType}
                            onChange={(e) =>
                              updateField(sIdx, fIdx, {
                                fieldType: e.target.value as FieldType,
                              })
                            }
                            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            {Object.entries(FIELD_TYPE_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Placeholder"
                          placeholder="Input placeholder text"
                          value={field.placeholder}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              placeholder: e.target.value,
                            })
                          }
                        />
                        <Input
                          label="Help Text"
                          placeholder="Helper text for the user"
                          value={field.helpText}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              helpText: e.target.value,
                            })
                          }
                        />
                      </div>
                      <Input
                        label="Field Name (unique slug for analytics)"
                        placeholder="e.g., school_dropout_count"
                        value={field.fieldName}
                        onChange={(e) =>
                          updateField(sIdx, fIdx, {
                            fieldName: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, '_')
                              .replace(/_+/g, '_'),
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) =>
                            updateField(sIdx, fIdx, {
                              isRequired: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        Required field
                      </label>

                      {/* Options for choice fields */}
                      {fieldTypesNeedingOptions.includes(field.fieldType) && (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Options
                          </label>
                          {field.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="mb-2 flex items-center gap-2"
                            >
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                  updateOption(
                                    sIdx,
                                    fIdx,
                                    optIdx,
                                    e.target.value,
                                  )
                                }
                                placeholder={`Option ${optIdx + 1}`}
                                className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none"
                              />
                              <button
                                onClick={() =>
                                  removeOption(sIdx, fIdx, optIdx)
                                }
                                className="text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(sIdx, fIdx)}
                          >
                            <Plus size={14} className="mr-1" /> Add Option
                          </Button>
                        </div>
                      )}

                      {/* File upload settings */}
                      {field.fieldType === 'file_upload' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label="Allowed File Types"
                            placeholder="image/*,.pdf,.doc"
                            value={field.allowedFileTypes}
                            onChange={(e) =>
                              updateField(sIdx, fIdx, {
                                allowedFileTypes: e.target.value,
                              })
                            }
                          />
                          <Input
                            label="Max File Size (bytes)"
                            type="number"
                            value={field.maxFileSize}
                            onChange={(e) =>
                              updateField(sIdx, fIdx, {
                                maxFileSize: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => addField(sIdx)}
                >
                  <Plus size={16} className="mr-2" /> Add Field
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Add Section Button */}
          <Button
            variant="outline"
            className="w-full border-dashed border-2"
            onClick={addSection}
          >
            <Layers size={16} className="mr-2" /> Add Section
          </Button>
        </div>
      </div>

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={confirmModal.open}
        onClose={() =>
          setConfirmModal((prev) => ({ ...prev, open: false }))
        }
        title={confirmModal.title}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <AlertTriangle size={20} />
            </div>
            <p className="text-sm text-gray-600">{confirmModal.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirmModal((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button size="sm" onClick={confirmModal.action}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
