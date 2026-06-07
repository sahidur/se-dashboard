'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  GraduationCap,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import type { School, Student, Teacher } from '@/types';

export default function SchoolDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>(
    'students',
  );

  // Student modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '',
    studentId: '',
    class: '',
    section: '',
    gender: 'male',
    dateOfBirth: '',
    guardianName: '',
    guardianPhone: '',
  });
  const [savingStudent, setSavingStudent] = useState(false);

  // Teacher modal
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    employeeId: '',
    subject: '',
    designation: '',
    phone: '',
    email: '',
    joiningDate: '',
  });
  const [savingTeacher, setSavingTeacher] = useState(false);

  const fetchSchool = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/schools/${id}`);
      setSchool(data);
    } catch {
      router.push('/schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchool();
  }, [id]);

  const handleAddStudent = async () => {
    try {
      setSavingStudent(true);
      await api.post(`/schools/${id}/students`, studentForm);
      setShowStudentModal(false);
      setStudentForm({
        name: '',
        studentId: '',
        class: '',
        section: '',
        gender: 'male',
        dateOfBirth: '',
        guardianName: '',
        guardianPhone: '',
      });
      fetchSchool();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add student');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleAddTeacher = async () => {
    try {
      setSavingTeacher(true);
      await api.post(`/schools/${id}/teachers`, teacherForm);
      setShowTeacherModal(false);
      setTeacherForm({
        name: '',
        employeeId: '',
        subject: '',
        designation: '',
        phone: '',
        email: '',
        joiningDate: '',
      });
      fetchSchool();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add teacher');
    } finally {
      setSavingTeacher(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Remove this student?')) return;
    await api.delete(`/schools/${id}/students/${studentId}`);
    fetchSchool();
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Remove this teacher?')) return;
    await api.delete(`/schools/${id}/teachers/${teacherId}`);
    fetchSchool();
  };

  if (loading || !school) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const studentColumns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'studentId' as const, header: 'ID' },
    { key: 'class' as const, header: 'Class' },
    { key: 'section' as const, header: 'Section' },
    { key: 'gender' as const, header: 'Gender' },
  ];

  const teacherColumns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'employeeId' as const, header: 'Emp. ID' },
    { key: 'subject' as const, header: 'Subject' },
    { key: 'designation' as const, header: 'Designation' },
    { key: 'phone' as const, header: 'Phone' },
  ];

  return (
    <>
      <Header
        title={school.name}
        subtitle={school.code ? `Code: ${school.code}` : undefined}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/schools')}
          >
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
        }
      />
      <div className="page-container">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-brand-50 p-2">
                    <MapPin className="text-brand-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-sm font-medium">
                      {[school.upazila, school.district, school.division]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <Users className="text-green-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Students</p>
                    <p className="text-xl font-bold">
                      {school.students?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <GraduationCap className="text-blue-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Teachers</p>
                    <p className="text-xl font-bold">
                      {school.teachers?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          {(school.principalName || school.phone || school.email) && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {school.principalName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User size={14} className="text-gray-400" />
                      {school.principalName}
                    </div>
                  )}
                  {school.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-gray-400" />
                      {school.phone}
                    </div>
                  )}
                  {school.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-gray-400" />
                      {school.email}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Students / Teachers Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 border-b">
                  <button
                    onClick={() => setActiveTab('students')}
                    className={`pb-2 text-sm font-medium ${
                      activeTab === 'students'
                        ? 'border-b-2 border-brand-500 text-brand-600'
                        : 'text-gray-500'
                    }`}
                  >
                    Students ({school.students?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('teachers')}
                    className={`pb-2 text-sm font-medium ${
                      activeTab === 'teachers'
                        ? 'border-b-2 border-brand-500 text-brand-600'
                        : 'text-gray-500'
                    }`}
                  >
                    Teachers ({school.teachers?.length || 0})
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    activeTab === 'students'
                      ? setShowStudentModal(true)
                      : setShowTeacherModal(true)
                  }
                >
                  <Plus size={14} className="mr-1" /> Add{' '}
                  {activeTab === 'students' ? 'Student' : 'Teacher'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'students' ? (
                <DataTable
                  columns={studentColumns}
                  data={school.students || []}
                  actions={(student: Student) => (
                    <button
                      onClick={() => handleDeleteStudent(student.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                />
              ) : (
                <DataTable
                  columns={teacherColumns}
                  data={school.teachers || []}
                  actions={(teacher: Teacher) => (
                    <button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Student Modal */}
      <Modal
        isOpen={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        title="Add Student"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={studentForm.name}
              onChange={(e) =>
                setStudentForm({ ...studentForm, name: e.target.value })
              }
            />
            <Input
              label="Student ID"
              value={studentForm.studentId}
              onChange={(e) =>
                setStudentForm({ ...studentForm, studentId: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Class"
              value={studentForm.class}
              onChange={(e) =>
                setStudentForm({ ...studentForm, class: e.target.value })
              }
            />
            <Input
              label="Section"
              value={studentForm.section}
              onChange={(e) =>
                setStudentForm({ ...studentForm, section: e.target.value })
              }
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                value={studentForm.gender}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, gender: e.target.value })
                }
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={studentForm.dateOfBirth}
              onChange={(e) =>
                setStudentForm({ ...studentForm, dateOfBirth: e.target.value })
              }
            />
            <Input
              label="Guardian Name"
              value={studentForm.guardianName}
              onChange={(e) =>
                setStudentForm({
                  ...studentForm,
                  guardianName: e.target.value,
                })
              }
            />
            <Input
              label="Guardian Phone"
              value={studentForm.guardianPhone}
              onChange={(e) =>
                setStudentForm({
                  ...studentForm,
                  guardianPhone: e.target.value,
                })
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowStudentModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddStudent} loading={savingStudent}>
              Add Student
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Teacher Modal */}
      <Modal
        isOpen={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
        title="Add Teacher"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={teacherForm.name}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, name: e.target.value })
              }
            />
            <Input
              label="Employee ID"
              value={teacherForm.employeeId}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, employeeId: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Subject"
              value={teacherForm.subject}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, subject: e.target.value })
              }
            />
            <Input
              label="Designation"
              value={teacherForm.designation}
              onChange={(e) =>
                setTeacherForm({
                  ...teacherForm,
                  designation: e.target.value,
                })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Phone"
              value={teacherForm.phone}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, phone: e.target.value })
              }
            />
            <Input
              label="Email"
              type="email"
              value={teacherForm.email}
              onChange={(e) =>
                setTeacherForm({ ...teacherForm, email: e.target.value })
              }
            />
            <Input
              label="Joining Date"
              type="date"
              value={teacherForm.joiningDate}
              onChange={(e) =>
                setTeacherForm({
                  ...teacherForm,
                  joiningDate: e.target.value,
                })
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowTeacherModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddTeacher} loading={savingTeacher}>
              Add Teacher
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
