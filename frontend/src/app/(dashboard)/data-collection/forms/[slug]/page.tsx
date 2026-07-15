'use client';

import { useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react';
import { InfrastructureStatusForm } from '@/components/data-collection/infrastructure-status-form';
import { ClassroomStatusForm } from '@/components/data-collection/classroom-status-form';
import { StudentsInfoForm } from '@/components/data-collection/students-info-form';
import { TeachersInfoForm } from '@/components/data-collection/teachers-info-form';
import { TeachersDevForm } from '@/components/data-collection/teachers-dev-form';
import { FeeStructureForm } from '@/components/data-collection/fee-structure-form';
import { RevenueTotalForm } from '@/components/data-collection/revenue-total-form';
import { RevenueMonthlyForm } from '@/components/data-collection/revenue-monthly-form';
import { AlumniForm } from '@/components/data-collection/alumni-form';
import { PedagogicalAchievementsForm } from '@/components/data-collection/pedagogical-achievements-form';
import { CocurricularForm } from '@/components/data-collection/cocurricular-form';
import { StudentsPerformanceForm } from '@/components/data-collection/students-performance-form';
import { ActivityParticipationForm } from '@/components/data-collection/activity-participation-form';
import { EventParticipationForm } from '@/components/data-collection/event-participation-form';

/* ─────────────── Form Configurations (Demo) ─────────────── */

interface DemoField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date';
  placeholder?: string;
  options?: string[];
  colSpan?: number; // 1 or 2 (2 = full width)
}

interface FormConfig {
  title: string;
  description: string;
  color: string;
  sections: {
    heading: string;
    fields: DemoField[];
  }[];
}

const FORM_CONFIGS: Record<string, FormConfig> = {
  /* ── Infrastructure & Classroom ── */
  'infrastructure-classroom-status': {
    title: 'Infrastructure & Classroom Status',
    description: 'Building condition, facilities, safety measures and classroom infrastructure',
    color: 'from-emerald-500 to-emerald-600',
    sections: [
      {
        heading: 'Building Information',
        fields: [
          { name: 'buildingType', label: 'Building Type', type: 'select', options: ['Pucca', 'Semi-Pucca', 'Tin-Shed', 'Mixed'] },
          { name: 'totalFloors', label: 'Total Floors', type: 'number', placeholder: 'e.g. 3' },
          { name: 'buildingCondition', label: 'Building Condition', type: 'select', options: ['Excellent', 'Good', 'Average', 'Poor', 'Dilapidated'] },
          { name: 'constructionYear', label: 'Construction Year', type: 'number', placeholder: 'e.g. 2010' },
          { name: 'totalRooms', label: 'Total Rooms', type: 'number', placeholder: 'e.g. 15' },
          { name: 'totalClassrooms', label: 'Total Classrooms', type: 'number', placeholder: 'e.g. 10' },
        ],
      },
      {
        heading: 'Facilities',
        fields: [
          { name: 'hasBoundaryWall', label: 'Boundary Wall', type: 'select', options: ['Yes - Pucca', 'Yes - Temporary', 'No'] },
          { name: 'toiletsBoys', label: 'Toilets (Boys)', type: 'number', placeholder: '0' },
          { name: 'toiletsGirls', label: 'Toilets (Girls)', type: 'number', placeholder: '0' },
          { name: 'toiletsTeachers', label: 'Toilets (Teachers)', type: 'number', placeholder: '0' },
          { name: 'drinkingWater', label: 'Drinking Water Source', type: 'select', options: ['Tube Well', 'Supply Water', 'Filter', 'None'] },
          { name: 'hasElectricity', label: 'Electricity Available', type: 'select', options: ['Yes', 'No'] },
          { name: 'hasRamp', label: 'Ramp for Disabled', type: 'select', options: ['Yes', 'No'] },
          { name: 'hasFireSafety', label: 'Fire Safety Equipment', type: 'select', options: ['Yes', 'No'] },
        ],
      },
    ],
  },

  'classroom-status': {
    title: 'Classroom Status',
    description: 'Smart classroom facilities, furniture and technology infrastructure',
    color: 'from-cyan-500 to-cyan-600',
    sections: [
      {
        heading: 'Classroom Facilities',
        fields: [
          { name: 'smartClassrooms', label: 'No. of Smart Classrooms', type: 'number', placeholder: '0' },
          { name: 'projectorsAvailable', label: 'Projectors Available', type: 'number', placeholder: '0' },
          { name: 'hasMultimedia', label: 'Multimedia Setup', type: 'select', options: ['Yes', 'No'] },
          { name: 'internetConnected', label: 'Internet Connected Rooms', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Furniture & Condition',
        fields: [
          { name: 'totalBenches', label: 'Total Benches', type: 'number', placeholder: '0' },
          { name: 'usableBenches', label: 'Usable Benches', type: 'number', placeholder: '0' },
          { name: 'totalChairs', label: 'Total Chairs', type: 'number', placeholder: '0' },
          { name: 'usableChairs', label: 'Usable Chairs', type: 'number', placeholder: '0' },
          { name: 'whiteboards', label: 'Whiteboards', type: 'number', placeholder: '0' },
          { name: 'blackboards', label: 'Blackboards', type: 'number', placeholder: '0' },
          { name: 'furnitureCondition', label: 'Overall Furniture Condition', type: 'select', options: ['Excellent', 'Good', 'Average', 'Poor'] },
          { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Any additional classroom remarks...', colSpan: 2 },
        ],
      },
    ],
  },

  /* ── Students ── */
  'students-information': {
    title: "Students' Information",
    description: 'Student enrollment, attendance and demographic data',
    color: 'from-violet-500 to-violet-600',
    sections: [
      {
        heading: 'Enrollment Data',
        fields: [
          { name: 'totalStudents', label: 'Total Students', type: 'number', placeholder: '0' },
          { name: 'totalBoys', label: 'Total Boys', type: 'number', placeholder: '0' },
          { name: 'totalGirls', label: 'Total Girls', type: 'number', placeholder: '0' },
          { name: 'newAdmissions', label: 'New Admissions (This Year)', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Attendance & Retention',
        fields: [
          { name: 'avgAttendance', label: 'Average Attendance (%)', type: 'number', placeholder: '0' },
          { name: 'dropoutRate', label: 'Dropout Rate (%)', type: 'number', placeholder: '0' },
          { name: 'retentionRate', label: 'Retention Rate (%)', type: 'number', placeholder: '0' },
          { name: 'specialNeeds', label: 'Special Needs Students', type: 'number', placeholder: '0' },
          { name: 'scholarshipRecipients', label: 'Scholarship Recipients', type: 'number', placeholder: '0' },
          { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Additional student information...', colSpan: 2 },
        ],
      },
    ],
  },

  /* ── Teachers ── */
  'teachers-information': {
    title: "Teachers' Information",
    description: 'Teacher demographics, qualifications and assignment details',
    color: 'from-pink-500 to-pink-600',
    sections: [
      {
        heading: 'Teacher Demographics',
        fields: [
          { name: 'totalTeachers', label: 'Total Teachers', type: 'number', placeholder: '0' },
          { name: 'maleTeachers', label: 'Male Teachers', type: 'number', placeholder: '0' },
          { name: 'femaleTeachers', label: 'Female Teachers', type: 'number', placeholder: '0' },
          { name: 'avgExperience', label: 'Average Experience (Years)', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Qualifications',
        fields: [
          { name: 'withMasters', label: 'With Masters Degree', type: 'number', placeholder: '0' },
          { name: 'withBachelors', label: 'With Bachelors Degree', type: 'number', placeholder: '0' },
          { name: 'withBEd', label: 'With B.Ed', type: 'number', placeholder: '0' },
          { name: 'withMEd', label: 'With M.Ed', type: 'number', placeholder: '0' },
          { name: 'trainedTeachers', label: 'Trained Teachers', type: 'number', placeholder: '0' },
          { name: 'untrainedTeachers', label: 'Untrained Teachers', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },

  'teachers-development': {
    title: "Teachers' Development",
    description: 'Training programs, certifications and professional development',
    color: 'from-rose-500 to-rose-600',
    sections: [
      {
        heading: 'Training Information',
        fields: [
          { name: 'pedagogyTraining', label: 'Pedagogy Training Received', type: 'number', placeholder: '0' },
          { name: 'ictTraining', label: 'ICT Training Received', type: 'number', placeholder: '0' },
          { name: 'subjectTraining', label: 'Subject-specific Training', type: 'number', placeholder: '0' },
          { name: 'leadershipTraining', label: 'Leadership Training', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Professional Development',
        fields: [
          { name: 'workshopsAttended', label: 'Workshops Attended (This Year)', type: 'number', placeholder: '0' },
          { name: 'seminarsAttended', label: 'Seminars Attended', type: 'number', placeholder: '0' },
          { name: 'researchPublished', label: 'Research Papers Published', type: 'number', placeholder: '0' },
          { name: 'onlineCoursesCompleted', label: 'Online Courses Completed', type: 'number', placeholder: '0' },
          { name: 'developmentPlan', label: 'Professional Development Plan', type: 'textarea', placeholder: 'Describe upcoming development plans...', colSpan: 2 },
        ],
      },
    ],
  },

  /* ── Revenue & Fee Structure ── */
  'fee-structure-primary': {
    title: 'Fee Structure (Primary)',
    description: 'Monthly tuition, session charges and exam fees',
    color: 'from-amber-500 to-amber-600',
    sections: [
      {
        heading: 'Monthly Fees',
        fields: [
          { name: 'tuitionFee', label: 'Monthly Tuition Fee (BDT)', type: 'number', placeholder: '0' },
          { name: 'developmentFee', label: 'Development Fee (BDT)', type: 'number', placeholder: '0' },
          { name: 'tiffinFee', label: 'Tiffin Fee (BDT)', type: 'number', placeholder: '0' },
          { name: 'transportFee', label: 'Transport Fee (BDT)', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Annual / Session Charges',
        fields: [
          { name: 'admissionFee', label: 'Admission Fee (BDT)', type: 'number', placeholder: '0' },
          { name: 'sessionCharge', label: 'Session Charge (BDT)', type: 'number', placeholder: '0' },
          { name: 'examFee', label: 'Exam Fee (BDT)', type: 'number', placeholder: '0' },
          { name: 'annualFund', label: 'Annual Fund (BDT)', type: 'number', placeholder: '0' },
          { name: 'otherCharges', label: 'Other Charges (BDT)', type: 'number', placeholder: '0' },
          { name: 'feeRemarks', label: 'Remarks', type: 'textarea', placeholder: 'Additional fee details...', colSpan: 2 },
        ],
      },
    ],
  },

  'revenue-budget': {
    title: 'Revenue Collection as per the Budget',
    description: 'Budgeted income targets across fee categories',
    color: 'from-orange-500 to-orange-600',
    sections: [
      {
        heading: 'Budgeted Revenue',
        fields: [
          { name: 'budgetYear', label: 'Budget Year', type: 'text', placeholder: 'e.g. 2024-2025' },
          { name: 'tuitionBudget', label: 'Tuition Revenue Budget (BDT)', type: 'number', placeholder: '0' },
          { name: 'examFeeBudget', label: 'Exam Fee Budget (BDT)', type: 'number', placeholder: '0' },
          { name: 'admissionBudget', label: 'Admission Fee Budget (BDT)', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Collection vs Target',
        fields: [
          { name: 'totalBudgetTarget', label: 'Total Budget Target (BDT)', type: 'number', placeholder: '0' },
          { name: 'totalCollected', label: 'Total Collected (BDT)', type: 'number', placeholder: '0' },
          { name: 'collectionRate', label: 'Collection Rate (%)', type: 'number', placeholder: '0' },
          { name: 'outstandingAmount', label: 'Outstanding Amount (BDT)', type: 'number', placeholder: '0' },
          { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Budget notes...', colSpan: 2 },
        ],
      },
    ],
  },

  'revenue-actual': {
    title: 'Revenue Collection as per Actual Student',
    description: 'Actual revenue collected per student against planned targets',
    color: 'from-yellow-500 to-yellow-600',
    sections: [
      {
        heading: 'Actual Collection Data',
        fields: [
          { name: 'totalEnrolled', label: 'Total Students Enrolled', type: 'number', placeholder: '0' },
          { name: 'totalPayingStudents', label: 'Total Paying Students', type: 'number', placeholder: '0' },
          { name: 'freeStudents', label: 'Free / Waiver Students', type: 'number', placeholder: '0' },
          { name: 'avgFeePerStudent', label: 'Avg. Fee Per Student (BDT)', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Revenue Breakdown',
        fields: [
          { name: 'actualTuitionRevenue', label: 'Actual Tuition Revenue (BDT)', type: 'number', placeholder: '0' },
          { name: 'actualExamRevenue', label: 'Actual Exam Revenue (BDT)', type: 'number', placeholder: '0' },
          { name: 'actualOtherRevenue', label: 'Actual Other Revenue (BDT)', type: 'number', placeholder: '0' },
          { name: 'totalActualRevenue', label: 'Total Actual Revenue (BDT)', type: 'number', placeholder: '0' },
          { name: 'defaulterCount', label: 'No. of Defaulting Students', type: 'number', placeholder: '0' },
          { name: 'defaulterAmount', label: 'Defaulter Amount (BDT)', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },

  /* ── Pedagogical Performance ── */
  'pedagogical-achievements': {
    title: "School's Pedagogical Achievements",
    description: 'Academic results, pass rates and merit achievements',
    color: 'from-indigo-500 to-indigo-600',
    sections: [
      {
        heading: 'Board Exam Results',
        fields: [
          { name: 'examYear', label: 'Exam Year', type: 'text', placeholder: 'e.g. 2024' },
          { name: 'totalAppeared', label: 'Total Students Appeared', type: 'number', placeholder: '0' },
          { name: 'totalPassed', label: 'Total Students Passed', type: 'number', placeholder: '0' },
          { name: 'passRate', label: 'Pass Rate (%)', type: 'number', placeholder: '0' },
          { name: 'gpaFive', label: 'GPA 5.0 Count', type: 'number', placeholder: '0' },
          { name: 'gpaFour', label: 'GPA 4.0+ Count', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Scholarship & Merits',
        fields: [
          { name: 'scholarshipWinners', label: 'Scholarship Winners', type: 'number', placeholder: '0' },
          { name: 'boardStandholders', label: 'Board Stand Holders', type: 'number', placeholder: '0' },
          { name: 'olympiadParticipants', label: 'Olympiad Participants', type: 'number', placeholder: '0' },
          { name: 'olympiadWinners', label: 'Olympiad Winners', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },

  'co-curricular-activities': {
    title: 'Participation in Co-curricular Activities',
    description: 'Sports, cultural events, competitions and extracurricular achievements',
    color: 'from-purple-500 to-purple-600',
    sections: [
      {
        heading: 'Sports Activities',
        fields: [
          { name: 'sportsParticipants', label: 'Total Sports Participants', type: 'number', placeholder: '0' },
          { name: 'districtSports', label: 'District Level Participation', type: 'number', placeholder: '0' },
          { name: 'nationalSports', label: 'National Level Participation', type: 'number', placeholder: '0' },
          { name: 'sportsMedals', label: 'Medals Won', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Cultural & Academic Activities',
        fields: [
          { name: 'debateParticipation', label: 'Debate Competitions', type: 'number', placeholder: '0' },
          { name: 'scienceFair', label: 'Science Fair Projects', type: 'number', placeholder: '0' },
          { name: 'culturalEvents', label: 'Cultural Events Participated', type: 'number', placeholder: '0' },
          { name: 'quizCompetitions', label: 'Quiz Competitions', type: 'number', placeholder: '0' },
          { name: 'artCompetitions', label: 'Art & Drawing Competitions', type: 'number', placeholder: '0' },
          { name: 'musicEvents', label: 'Music & Recitation Events', type: 'number', placeholder: '0' },
        ],
      },
    ],
  },

  /* ── Alumni ── */
  'alumni-information': {
    title: 'Alumni Information',
    description: 'Notable alumni, education progression and current occupations',
    color: 'from-slate-500 to-slate-600',
    sections: [
      {
        heading: 'Alumni Statistics',
        fields: [
          { name: 'totalAlumni', label: 'Total Registered Alumni', type: 'number', placeholder: '0' },
          { name: 'alumniInHigherEd', label: 'In Higher Education', type: 'number', placeholder: '0' },
          { name: 'alumniEmployed', label: 'Employed', type: 'number', placeholder: '0' },
          { name: 'alumniAbroad', label: 'Abroad', type: 'number', placeholder: '0' },
        ],
      },
      {
        heading: 'Notable Alumni & Contributions',
        fields: [
          { name: 'notableAlumniCount', label: 'Notable Alumni Count', type: 'number', placeholder: '0' },
          { name: 'alumniDonations', label: 'Donations Received (BDT)', type: 'number', placeholder: '0' },
          { name: 'alumniEventsHeld', label: 'Alumni Events Held', type: 'number', placeholder: '0' },
          { name: 'hasAlumniAssociation', label: 'Alumni Association', type: 'select', options: ['Active', 'Inactive', 'None'] },
          { name: 'notableAlumniDetails', label: 'Notable Alumni Details', type: 'textarea', placeholder: 'List notable alumni and their achievements...', colSpan: 2 },
        ],
      },
    ],
  },
};

/* ─────────────── Component ─────────────── */

export default function DemoFormPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const schoolId = searchParams.get('school');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Custom real forms ── */
  if (slug === 'infrastructure-classroom-status') {
    return (
      <>
        <Header
          title="Infrastructure Status"
          subtitle="Campus, building, rooms & facilities"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <InfrastructureStatusForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'classroom-status') {
    return (
      <>
        <Header
          title="Classroom Status"
          subtitle="Digital equipment, seating & classroom features"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <ClassroomStatusForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'students-information') {
    return (
      <>
        <Header
          title="Students' Information"
          subtitle="Monthly enrollment by grade"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <StudentsInfoForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'teachers-information') {
    return (
      <>
        <Header
          title="Teachers' Information"
          subtitle="Individual teacher records"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <TeachersInfoForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'teachers-development') {
    return (
      <>
        <Header
          title="Teachers' Development"
          subtitle="Monthly training & development data"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <TeachersDevForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'fee-structure-primary') {
    return (
      <>
        <Header
          title="Fee Structure (Primary)"
          subtitle="Monthly fee structure per grade"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <FeeStructureForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'revenue-budget-total') {
    return (
      <>
        <Header
          title="Revenue Collection as per Budget — Total"
          subtitle="Yearly budget targets and achievements per fee category"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <RevenueTotalForm schoolId={schoolId ?? ''} mode="budget" />
        </div>
      </>
    );
  }

  if (slug === 'revenue-budget-monthly') {
    return (
      <>
        <Header
          title="Revenue Collection as per Budget — Monthly"
          subtitle="Monthly tuition fee budget and collection tracking"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <RevenueMonthlyForm schoolId={schoolId ?? ''} mode="budget" />
        </div>
      </>
    );
  }

  if (slug === 'revenue-actual-total') {
    return (
      <>
        <Header
          title="Revenue Collection as per Actual Student — Total"
          subtitle="Yearly actual student revenue targets and achievements"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <RevenueTotalForm schoolId={schoolId ?? ''} mode="actual" />
        </div>
      </>
    );
  }

  if (slug === 'revenue-actual-monthly') {
    return (
      <>
        <Header
          title="Revenue Collection as per Actual Student — Monthly"
          subtitle="Monthly actual student revenue tracking"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <RevenueMonthlyForm schoolId={schoolId ?? ''} mode="actual" />
        </div>
      </>
    );
  }

  if (slug === 'alumni-information') {
    return (
      <>
        <Header
          title="Alumni Information"
          subtitle="School alumni records"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <AlumniForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'pedagogical-achievements') {
    return (
      <>
        <Header
          title="School's Pedagogical Achievements"
          subtitle="Annual scholarship and achievement records"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <PedagogicalAchievementsForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'co-curricular-activities') {
    return (
      <>
        <Header
          title="Participation in Co-curricular Activities"
          subtitle="Monthly activity participation by grade"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <CocurricularForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'students-performance') {
    return (
      <>
        <Header
          title="Students' Performance"
          subtitle="Exam-wise grade results and progress indicators"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <StudentsPerformanceForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'activity-participation') {
    return (
      <>
        <Header
          title="Students' Participation in Corner/Club/Library/Lab Activities"
          subtitle="Monthly activity participation by grade with photo evidence"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <ActivityParticipationForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  if (slug === 'event-participation') {
    return (
      <>
        <Header
          title="School's Participation in Different Events"
          subtitle="Events, award levels and students awarded"
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          }
        />
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <EventParticipationForm schoolId={schoolId ?? ''} />
        </div>
      </>
    );
  }

  /* ── Generic demo form (all other slugs) ── */
  const config = FORM_CONFIGS[slug as string];

  if (!config) {
    return (
      <>
        <Header title="Form Not Found" />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-gray-500">The requested form could not be found.</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft size={16} className="mr-1.5" /> Go Back
          </Button>
        </div>
      </>
    );
  }

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Simulate API call (demo mode)
    await new Promise((r) => setTimeout(r, 1200));
    setSaving(false);
    setSubmitted(true);
  };

  return (
    <>
      <Header
        title={config.title}
        subtitle="Demo Form — Content will be updated later"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Color bar header */}
        <div className={`mb-6 rounded-xl bg-gradient-to-r ${config.color} p-6 text-white shadow-lg`}>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="mt-1 text-sm text-white/80">{config.description}</p>
          {schoolId && (
            <p className="mt-2 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium inline-block">
              School ID: {schoolId}
            </p>
          )}
        </div>

        {submitted ? (
          <Card className="text-center py-16">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Form Submitted Successfully!</h2>
              <p className="text-gray-500 max-w-md">
                This is a demo submission. When real form content is added, the data will be saved to the database.
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => { setSubmitted(false); setFormData({}); }}>
                  Fill Again
                </Button>
                <Button onClick={() => router.back()}>
                  Back to Forms
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {config.sections.map((section, sIdx) => (
              <Card key={sIdx}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{section.heading}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                        <Label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-gray-700">
                          {field.label}
                        </Label>
                        {field.type === 'select' ? (
                          <select
                            id={field.name}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            id={field.name}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                          />
                        ) : (
                          <Input
                            id={field.name}
                            type={field.type}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-end gap-3 pb-8">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-1.5" />
                    Submit Form
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
