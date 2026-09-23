'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, BookOpen, Layers, Check, X } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { useSchools } from '@/components/fee/filters';

// Predefined class list offered in the Add Class modal (in display order;
// the index doubles as the ordering sequence).
const PREDEFINED_CLASSES = [
  'Play World',
  'Play & Learn',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
];

interface SectionRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface ClassRow {
  id: string;
  name: string;
  sequence: number | null;
  isActive: boolean;
  sections: SectionRow[];
}

export default function ClassesPage() {
  const { data: schools = [] } = useSchools();
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [classModal, setClassModal] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ name: '', sequence: '' });
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>([]);

  const [sectionModal, setSectionModal] = useState(false);
  const [sectionClassId, setSectionClassId] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');

  useEffect(() => {
    if (!schoolId && schools.length > 0) setSchoolId(schools[0].id);
  }, [schools, schoolId]);

  const fetchClasses = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/students/classes?schoolId=${schoolId}`);
      setClasses(data);
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const saveClass = async () => {
    if (editingClassId) {
      if (!classForm.name.trim()) return alert('Class name is required');
      try {
        const payload: Record<string, unknown> = { name: classForm.name.trim() };
        if (classForm.sequence) payload.sequence = parseInt(classForm.sequence, 10);
        await api.patch(`/students/classes/${editingClassId}`, payload);
        setClassModal(false);
        fetchClasses();
      } catch (error) {
        alert(getErrorMessage(error, 'Failed to save class'));
      }
      return;
    }

    // Create mode: bulk-create every predefined class picked in the list
    if (selectedPredefined.length === 0) return alert('Select at least one class');
    const failures: string[] = [];
    const ordered = PREDEFINED_CLASSES.filter((name) => selectedPredefined.includes(name));
    for (const name of ordered) {
      try {
        await api.post('/students/classes', {
          name,
          schoolId,
          sequence: PREDEFINED_CLASSES.indexOf(name),
        });
      } catch (error) {
        const msg = getErrorMessage(error, `Failed to create ${name}`);
        if (!msg.toLowerCase().includes('already exists')) failures.push(`${name}: ${msg}`);
      }
    }
    if (failures.length > 0) {
      alert(`Some classes could not be created:\n${failures.join('\n')}`);
    }
    setClassModal(false);
    fetchClasses();
  };

  const deleteClass = async (cls: ClassRow) => {
    if (!confirm(`Delete class "${cls.name}"?`)) return;
    try {
      await api.delete(`/students/classes/${cls.id}`);
      fetchClasses();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete class'));
    }
  };

  const existingNames = classes.map((c) => c.name);

  const saveSection = async () => {
    if (!sectionName.trim()) return alert('Section name is required');
    try {
      if (editingSectionId) {
        await api.patch(`/students/sections/${editingSectionId}`, { name: sectionName.trim() });
      } else {
        await api.post('/students/sections', { classId: sectionClassId, name: sectionName.trim() });
      }
      setSectionModal(false);
      fetchClasses();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save section'));
    }
  };

  const deleteSection = async (section: SectionRow) => {
    if (!confirm(`Delete section "${section.name}"?`)) return;
    try {
      await api.delete(`/students/sections/${section.id}`);
      fetchClasses();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete section'));
    }
  };

  return (
    <>
      <Header
        title="Classes & Sections"
        subtitle="Sections organize students — the standard fee is defined at class level"
        actions={
          <Button size="sm" onClick={() => {
            setEditingClassId(null);
            setClassForm({ name: '', sequence: '' });
            setSelectedPredefined([]);
            setClassModal(true);
          }}>
            <Plus size={16} className="mr-1" /> Add Class
          </Button>
        }
      />
      <div className="page-container">
        <div className="mb-4 max-w-md">
          <select
            className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">Select school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <BookOpen size={48} className="mb-3" />
            <p className="text-lg font-medium">No classes yet</p>
            <p className="text-sm">Create classes first, then add sections under each class.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {classes.map((cls) => (
              <Card key={cls.id}>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      {!cls.isActive && <Badge className="mt-1 bg-gray-100 text-gray-500">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingClassId(cls.id);
                          setClassForm({ name: cls.name, sequence: cls.sequence != null ? String(cls.sequence) : '' });
                          setClassModal(true);
                        }}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Edit size={16} />
                      </button>
                      <button onClick={() => deleteClass(cls)} className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {cls.sections.map((s) => (
                      <span
                        key={s.id}
                        className="group flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm"
                      >
                        Section {s.name}
                        <button
                          onClick={() => {
                            setSectionClassId(cls.id);
                            setEditingSectionId(s.id);
                            setSectionName(s.name);
                            setSectionModal(true);
                          }}
                          className="text-gray-400 hover:text-brand-600"
                        >
                          <Edit size={12} />
                        </button>
                        <button onClick={() => deleteSection(s)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        setSectionClassId(cls.id);
                        setEditingSectionId(null);
                        setSectionName('');
                        setSectionModal(true);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600"
                    >
                      <Plus size={12} /> Section
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={classModal}
        onClose={() => setClassModal(false)}
        title={editingClassId ? 'Edit Class' : 'Add Class'}
      >
        {editingClassId ? (
          <>
            <Input
              label="Class Name *"
              placeholder="e.g. Class 5"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
            />
            <div className="mt-3">
              <Input
                label="Sequence (optional)"
                type="number"
                value={classForm.sequence}
                onChange={(e) => setClassForm({ ...classForm, sequence: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Select Classes <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({selectedPredefined.length} selected)
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPredefined(existingNames)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPredefined([])}
                  className="text-xs text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {PREDEFINED_CLASSES.map((name) => {
                const alreadyExists = existingNames.includes(name);
                const selected = selectedPredefined.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={alreadyExists}
                    onClick={() =>
                      setSelectedPredefined((prev) =>
                        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                      )
                    }
                    className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-all ${
                      alreadyExists
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                        : selected
                          ? 'border-brand-400 bg-brand-50 font-semibold text-brand-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="min-w-0 break-words leading-snug">{name}</span>
                    {alreadyExists ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Added
                      </span>
                    ) : selected ? (
                      <Check size={15} className="shrink-0 text-brand-600" />
                    ) : (
                      <X size={15} className="shrink-0 text-gray-300" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Classes marked <span className="font-medium text-gray-500">Added</span> already exist for this school and
              will be skipped.
            </p>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setClassModal(false)}>Cancel</Button>
          <Button onClick={saveClass}>
            {editingClassId ? 'Save' : `Create${selectedPredefined.length > 0 ? ` (${selectedPredefined.length})` : ''}`}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={sectionModal} onClose={() => setSectionModal(false)} title={editingSectionId ? 'Edit Section' : 'Add Section'}>
        <Input label="Section Name *" placeholder="e.g. A" value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSectionModal(false)}>Cancel</Button>
          <Button onClick={saveSection}>Save</Button>
        </div>
      </Modal>
    </>
  );
}
