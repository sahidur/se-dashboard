'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Users,
  Eye,
  Edit,
  GraduationCap,
  ArrowRightLeft,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import { Select, useSchools, useAcademicYears } from '@/components/fee/filters';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'dropout', label: 'Dropout' },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    transferred: 'bg-blue-100 text-blue-800',
    withdrawn: 'bg-red-100 text-red-800',
    graduated: 'bg-purple-100 text-purple-800',
    dropout: 'bg-orange-100 text-orange-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
};

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string; isActive: boolean }[];
}

interface StudentRow {
  id: string;
  admissionNumber: string;
  name: string;
  guardianName: string | null;
  guardianPhone: string | null;
  rollNumber: number | null;
  status: string;
  schoolClass: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
}

const emptyForm = {
  name: '',
  dateOfBirth: '',
  gender: '',
  guardianName: '',
  guardianPhone: '',
  address: '',
  classId: '',
  sectionId: '',
  rollNumber: '',
  admissionDate: '',
  status: 'active',
  referenceNumber: '',
  birthCertificateId: '',
  religion: '',
  languageSpoken: '',
  isPwd: '',
  motherName: '',
  motherDob: '',
  motherNid: '',
  motherEducation: '',
  motherOccupation: '',
  motherIncome: '',
  fatherName: '',
  fatherDob: '',
  fatherNid: '',
  fatherEducation: '',
  fatherOccupation: '',
  fatherIncome: '',
  parentsIncome: '',
  involveWithBracService: '',
  isOrphan: '',
  attendedBracOtherService: '',
  participateWithOtherNgo: '',
  waiverPercent: '',
  bkashNumber: '',
};

const RELIGIONS = ['Islam', 'Hinduism', 'Buddhism', 'Christianity', 'Other'];
const LANGUAGES = ['Bangla', 'English', 'Bangla & English', 'Garo', 'Chakma', 'Other'];
const EDUCATION_LEVELS = [
  'No education', 'Primary (1-5)', 'Secondary (6-10)', 'SSC', 'HSC',
  'Bachelor', 'Master', 'Above Masters', 'Other',
];
const OCCUPATIONS = [
  'Housewife', 'Farmer', 'Day laborer', 'Garment worker', 'Teacher', 'Business',
  'Service (private)', 'Service (government)', 'Driver', 'Tailor', 'Unemployed', 'Other',
];

export default function StudentsPage() {
  const router = useRouter();
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();

  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [promoteModal, setPromoteModal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [promoteForm, setPromoteForm] = useState({
    targetClassId: '',
    targetSectionId: '',
    targetAcademicYearId: '',
  });

  const [transferStudent, setTransferStudent] = useState<StudentRow | null>(null);
  const [transferForm, setTransferForm] = useState({ targetSchoolId: '' });

  // Derived default: first school (no setState inside effects)
  const activeSchoolId = schoolId || (schools[0]?.id ?? '');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset class/section when the school changes (render-time adjustment)
  const [lastSchool, setLastSchool] = useState(activeSchoolId);
  if (lastSchool !== activeSchoolId) {
    setLastSchool(activeSchoolId);
    setClassId('');
    setSectionId('');
  }

  useEffect(() => {
    if (!activeSchoolId) return;
    api
      .get(`/students/classes?schoolId=${activeSchoolId}&activeOnly=true`)
      .then(({ data }) => setClasses(data))
      .catch(() => setClasses([]));
  }, [activeSchoolId]);

  const fetchStudents = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        schoolId: activeSchoolId,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (classId) params.set('classId', classId);
      if (sectionId) params.set('sectionId', sectionId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (status) params.set('status', status);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const { data } = await api.get(`/students?${params.toString()}`);
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchoolId, classId, sectionId, academicYearId, status, debouncedSearch, page]);

  const sectionOptions = useMemo(() => {
    const cls = classes.find((c) => c.id === classId);
    return (cls?.sections ?? [])
      .filter((s) => s.isActive || s.id === form.sectionId)
      .map((s) => ({ value: s.id, label: s.name }));
  }, [classes, classId, form.sectionId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (row: StudentRow) => {
    setEditingId(row.id);
    setForm({
      ...emptyForm,
      name: row.name,
      guardianName: row.guardianName ?? '',
      guardianPhone: row.guardianPhone ?? '',
      classId: row.schoolClass?.id ?? '',
      sectionId: row.section?.id ?? '',
      rollNumber: row.rollNumber != null ? String(row.rollNumber) : '',
      status: row.status,
    });
    // Load full profile for edit
    api.get(`/students/${row.id}`).then(({ data }) => {
      setForm({
        ...emptyForm,
        name: data.name ?? '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
        gender: data.gender ?? '',
        guardianName: data.guardianName ?? '',
        guardianPhone: data.guardianPhone ?? '',
        address: data.address ?? '',
        classId: data.classId ?? '',
        sectionId: data.sectionId ?? '',
        rollNumber: data.rollNumber != null ? String(data.rollNumber) : '',
        admissionDate: data.admissionDate ? data.admissionDate.slice(0, 10) : '',
        status: data.status ?? 'active',
        referenceNumber: data.referenceNumber ?? '',
        birthCertificateId: data.birthCertificateId ?? '',
        religion: data.religion ?? '',
        languageSpoken: data.languageSpoken ?? '',
        isPwd: data.isPwd == null ? '' : data.isPwd ? 'true' : 'false',
        motherName: data.motherName ?? '',
        motherDob: data.motherDob ? data.motherDob.slice(0, 10) : '',
        motherNid: data.motherNid ?? '',
        motherEducation: data.motherEducation ?? '',
        motherOccupation: data.motherOccupation ?? '',
        motherIncome: data.motherIncome ?? '',
        fatherName: data.fatherName ?? '',
        fatherDob: data.fatherDob ? data.fatherDob.slice(0, 10) : '',
        fatherNid: data.fatherNid ?? '',
        fatherEducation: data.fatherEducation ?? '',
        fatherOccupation: data.fatherOccupation ?? '',
        fatherIncome: data.fatherIncome ?? '',
        parentsIncome: data.parentsIncome ?? '',
        involveWithBracService: data.involveWithBracService == null ? '' : data.involveWithBracService ? 'true' : 'false',
        isOrphan: data.isOrphan == null ? '' : data.isOrphan ? 'true' : 'false',
        attendedBracOtherService: data.attendedBracOtherService == null ? '' : data.attendedBracOtherService ? 'true' : 'false',
        participateWithOtherNgo: data.participateWithOtherNgo == null ? '' : data.participateWithOtherNgo ? 'true' : 'false',
        waiverPercent: data.waiverPercent ?? '',
        bkashNumber: data.bkashNumber ?? '',
      });
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Student name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        address: form.address || undefined,
        classId: form.classId || undefined,
        sectionId: form.sectionId || undefined,
        rollNumber: form.rollNumber ? parseInt(form.rollNumber, 10) : undefined,
        status: form.status,
        referenceNumber: form.referenceNumber || undefined,
        birthCertificateId: form.birthCertificateId || undefined,
        religion: form.religion || undefined,
        languageSpoken: form.languageSpoken || undefined,
        motherName: form.motherName || undefined,
        motherNid: form.motherNid || undefined,
        motherEducation: form.motherEducation || undefined,
        motherOccupation: form.motherOccupation || undefined,
        motherIncome: form.motherIncome || undefined,
        fatherName: form.fatherName || undefined,
        fatherNid: form.fatherNid || undefined,
        fatherEducation: form.fatherEducation || undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        fatherIncome: form.fatherIncome || undefined,
        parentsIncome: form.parentsIncome || undefined,
        waiverPercent: form.waiverPercent || undefined,
        bkashNumber: form.bkashNumber || undefined,
        isPwd: form.isPwd === '' ? undefined : form.isPwd === 'true',
        involveWithBracService: form.involveWithBracService === '' ? undefined : form.involveWithBracService === 'true',
        isOrphan: form.isOrphan === '' ? undefined : form.isOrphan === 'true',
        attendedBracOtherService: form.attendedBracOtherService === '' ? undefined : form.attendedBracOtherService === 'true',
        participateWithOtherNgo: form.participateWithOtherNgo === '' ? undefined : form.participateWithOtherNgo === 'true',
      };
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.motherDob) payload.motherDob = form.motherDob;
      if (form.fatherDob) payload.fatherDob = form.fatherDob;
      if (form.gender) payload.gender = form.gender;
      if (form.admissionDate) payload.admissionDate = form.admissionDate;
      if (academicYearId) payload.academicYearId = academicYearId;

      if (editingId) {
        await api.patch(`/students/${editingId}`, payload);
      } else {
        await api.post('/students', { ...payload, schoolId: activeSchoolId });
      }
      setShowModal(false);
      fetchStudents();
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save student'));
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    if (selected.length === 0 || !promoteForm.targetClassId || !promoteForm.targetSectionId || !promoteForm.targetAcademicYearId) {
      alert('Select students and the target class, section and academic year');
      return;
    }
    try {
      await api.post('/students/promote', {
        studentIds: selected,
        ...promoteForm,
      });
      setPromoteModal(false);
      setSelected([]);
      fetchStudents();
    } catch (error) {
      alert(getErrorMessage(error, 'Promotion failed'));
    }
  };

  const handleTransfer = async () => {
    if (!transferStudent || !transferForm.targetSchoolId) return;
    try {
      await api.post(`/students/${transferStudent.id}/transfer`, {
        targetSchoolId: transferForm.targetSchoolId,
      });
      setTransferStudent(null);
      setTransferForm({ targetSchoolId: '' });
      fetchStudents();
    } catch (error) {
      alert(getErrorMessage(error, 'Transfer failed'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const promoteTargets = classes.find((c) => c.id === promoteForm.targetClassId);

  return (
    <>
      <Header
        title="Student List"
        subtitle="Search, filter and manage students of your schools"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPromoteModal(true)}>
              <GraduationCap size={16} className="mr-1" /> Promote
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} className="mr-1" /> Add Student
            </Button>
          </div>
        }
      />
      <div className="page-container">
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <Select
              label="School"
              value={activeSchoolId}
              onChange={(v) => setSchoolId(v)}
              options={schools.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Select school"
            />
            <Select
              label="Class"
              value={classId}
              onChange={(v) => {
                setClassId(v);
                setSectionId('');
              }}
              placeholder="All classes"
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Section"
              value={sectionId}
              onChange={(v) => setSectionId(v)}
              placeholder="All sections"
              options={sectionOptions.length > 0 || !classId
                ? [{ value: '', label: 'All sections' }, ...sectionOptions]
                : []}
            />
            <Select
              label="Academic Year"
              value={academicYearId}
              onChange={(v) => setAcademicYearId(v)}
              placeholder="All years"
              options={years.map((y) => ({ value: y.id, label: y.name }))}
            />
            <Select
              label="Status"
              value={status}
              onChange={(v) => setStatus(v)}
              options={STATUS_OPTIONS}
            />
            <div className="flex items-end">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Search name / guardian / ID"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="modern-table">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3"><input
                      type="checkbox"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    /></th>
                    <th className="px-4 py-3">Admission No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Roll</th>
                    <th className="px-4 py-3">Guardian</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center">
                        <Users size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-400">No students found</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => router.push(`/students/${row.id}`)}
                        className="group cursor-pointer transition-colors hover:bg-indigo-50/60"
                        title="Open student profile"
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{row.admissionNumber}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 transition-colors group-hover:text-indigo-700">{row.name}</td>
                        <td className="px-4 py-3">{row.schoolClass?.name ?? '-'}</td>
                        <td className="px-4 py-3">{row.section?.name ?? '-'}</td>
                        <td className="px-4 py-3">{row.rollNumber ?? '-'}</td>
                        <td className="px-4 py-3">{row.guardianName ?? '-'}</td>
                        <td className="px-4 py-3">{row.guardianPhone ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Link
                              href={`/students/${row.id}`}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600"
                              title="View profile"
                            >
                              <Eye size={16} />
                            </Link>
                            <button
                              onClick={() => openEdit(row)}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setTransferStudent(row);
                                setTransferForm({ targetSchoolId: '' });
                              }}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                              title="Transfer"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <span className="text-gray-500">
                  {total} student(s) — page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit student */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Student' : 'Add Student'}
        size="lg"
      >
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {/* ── Basic Information ── */}
          <section>
            <h4 className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              Basic Information
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <Input label="Roll No" type="number" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
              <Input label="Reference Number" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
              <Select
                label="Gender"
                value={form.gender}
                onChange={(v) => setForm({ ...form, gender: v })}
                placeholder="Select gender"
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              <Input label="Birth Certificate Id" value={form.birthCertificateId} onChange={(e) => setForm({ ...form, birthCertificateId: e.target.value })} />
              <Select
                label="Religion"
                value={form.religion}
                onChange={(v) => setForm({ ...form, religion: v })}
                placeholder="Select religion"
                options={RELIGIONS.map((r) => ({ value: r, label: r }))}
              />
              <Select
                label="Language Spoken"
                value={form.languageSpoken}
                onChange={(v) => setForm({ ...form, languageSpoken: v })}
                placeholder="Select language"
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
              <Select
                label="Class"
                value={form.classId}
                onChange={(v) => setForm({ ...form, classId: v, sectionId: '' })}
                placeholder="Select class"
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Section"
                value={form.sectionId}
                onChange={(v) => setForm({ ...form, sectionId: v })}
                placeholder="Select section"
                options={sectionOptions}
              />
              <Select
                label="Is PWD (Yes/No)"
                value={form.isPwd}
                onChange={(v) => setForm({ ...form, isPwd: v })}
                placeholder="Select"
                options={YES_NO_OPTIONS}
              />
              <Input label="Admission Date" type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
              <Select
                label="Status"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={STATUS_OPTIONS.filter((o) => o.value !== '')}
              />
              <div className="sm:col-span-2">
                <Input label="Residential Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
          </section>

          {/* ── Mother ── */}
          <section>
            <h4 className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              Mother
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Mother Name" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
              <Input label="Mother DOB" type="date" value={form.motherDob} onChange={(e) => setForm({ ...form, motherDob: e.target.value })} />
              <Input label="Mother NID" value={form.motherNid} onChange={(e) => setForm({ ...form, motherNid: e.target.value })} />
              <Select
                label="Mother Educational Attainment"
                value={form.motherEducation}
                onChange={(v) => setForm({ ...form, motherEducation: v })}
                placeholder="Select attainment"
                options={EDUCATION_LEVELS.map((l) => ({ value: l, label: l }))}
              />
              <Select
                label="Mother Occupation"
                value={form.motherOccupation}
                onChange={(v) => setForm({ ...form, motherOccupation: v })}
                placeholder="Select occupation"
                options={OCCUPATIONS.map((l) => ({ value: l, label: l }))}
              />
              <Input label="Mother Income (monthly, BDT)" type="number" min="0" value={form.motherIncome} onChange={(e) => setForm({ ...form, motherIncome: e.target.value })} />
            </div>
          </section>

          {/* ── Father ── */}
          <section>
            <h4 className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              Father
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Father Name" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
              <Input label="Father DOB" type="date" value={form.fatherDob} onChange={(e) => setForm({ ...form, fatherDob: e.target.value })} />
              <Input label="Father NID" value={form.fatherNid} onChange={(e) => setForm({ ...form, fatherNid: e.target.value })} />
              <Select
                label="Father Educational Attainment"
                value={form.fatherEducation}
                onChange={(v) => setForm({ ...form, fatherEducation: v })}
                placeholder="Select attainment"
                options={EDUCATION_LEVELS.map((l) => ({ value: l, label: l }))}
              />
              <Select
                label="Father Occupation"
                value={form.fatherOccupation}
                onChange={(v) => setForm({ ...form, fatherOccupation: v })}
                placeholder="Select occupation"
                options={OCCUPATIONS.map((l) => ({ value: l, label: l }))}
              />
              <Input label="Father Income (monthly, BDT)" type="number" min="0" value={form.fatherIncome} onChange={(e) => setForm({ ...form, fatherIncome: e.target.value })} />
            </div>
          </section>

          {/* ── Guardian, Contact & Finance ── */}
          <section>
            <h4 className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              Guardian, Contact &amp; Finance
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Parents Income (monthly, BDT)" type="number" min="0" value={form.parentsIncome} onChange={(e) => setForm({ ...form, parentsIncome: e.target.value })} />
              <Input label="Guardian Mobile No" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
              <Input label="bKash Number" placeholder="01XXXXXXXXX" value={form.bkashNumber} onChange={(e) => setForm({ ...form, bkashNumber: e.target.value })} />
              <Input label="Waiver %" type="number" min="0" max="100" value={form.waiverPercent} onChange={(e) => setForm({ ...form, waiverPercent: e.target.value })} />
              <div className="sm:col-span-2">
                <Input label="Guardian Name" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
              </div>
            </div>
          </section>

          {/* ── BRAC Services ── */}
          <section>
            <h4 className="mb-2 border-b border-gray-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              BRAC Services &amp; Household Status
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Involve With BRAC Service (Yes/No)"
                value={form.involveWithBracService}
                onChange={(v) => setForm({ ...form, involveWithBracService: v })}
                placeholder="Select"
                options={YES_NO_OPTIONS}
              />
              <Select
                label="Is Orphan (Yes/No)"
                value={form.isOrphan}
                onChange={(v) => setForm({ ...form, isOrphan: v })}
                placeholder="Select"
                options={YES_NO_OPTIONS}
              />
              <Select
                label="Attended BRAC Other Service (Yes/No)"
                value={form.attendedBracOtherService}
                onChange={(v) => setForm({ ...form, attendedBracOtherService: v })}
                placeholder="Select"
                options={YES_NO_OPTIONS}
              />
              <Select
                label="Participate With Other NGO (Yes/No)"
                value={form.participateWithOtherNgo}
                onChange={(v) => setForm({ ...form, participateWithOtherNgo: v })}
                placeholder="Select"
                options={YES_NO_OPTIONS}
              />
            </div>
          </section>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Student'}</Button>
        </div>
      </Modal>

      {/* Promote */}
      <Modal isOpen={promoteModal} onClose={() => setPromoteModal(false)} title="Promote Students" size="lg">
        <p className="mb-3 text-sm text-gray-600">
          {selected.length} student(s) selected. Choose the target class, section and academic year.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Target Class"
            value={promoteForm.targetClassId}
            onChange={(v) => setPromoteForm({ ...promoteForm, targetClassId: v, targetSectionId: '' })}
            placeholder="Select class"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Target Section"
            value={promoteForm.targetSectionId}
            onChange={(v) => setPromoteForm({ ...promoteForm, targetSectionId: v })}
            placeholder="Select section"
            options={(promoteTargets?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="Target Academic Year"
            value={promoteForm.targetAcademicYearId}
            onChange={(v) => setPromoteForm({ ...promoteForm, targetAcademicYearId: v })}
            placeholder="Select year"
            options={years.map((y) => ({ value: y.id, label: y.name }))}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPromoteModal(false)}>Cancel</Button>
          <Button onClick={handlePromote}>Promote {selected.length} Student(s)</Button>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal isOpen={!!transferStudent} onClose={() => setTransferStudent(null)} title="Transfer Student">
        <p className="mb-3 text-sm text-gray-600">
          Transfer <strong>{transferStudent?.name}</strong> ({transferStudent?.admissionNumber}) to another school.
          Fee history remains preserved.
        </p>
        <Select
          label="Target School"
          value={transferForm.targetSchoolId}
          onChange={(v) => setTransferForm({ targetSchoolId: v })}
          placeholder="Select school"
          options={schools.filter((s) => s.id !== activeSchoolId).map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTransferStudent(null)}>Cancel</Button>
          <Button onClick={handleTransfer}>Transfer</Button>
        </div>
      </Modal>
    </>
  );
}
