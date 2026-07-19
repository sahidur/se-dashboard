import {
  Building2, Users, GraduationCap, Wallet, TrendingUp, Award,
  HardHat, UserSquare2, CalendarClock, Receipt, Banknote, Calculator,
  CalendarDays, Trophy, Sparkles, Library, UserCheck, type LucideIcon,
} from 'lucide-react';

/**
 * Central catalog of every submitted data-collection form, grouped into the
 * same parent categories used across the school dashboard (schools/[id]/page.tsx
 * CARD_CONFIG + its sub-pages). Used to render the "Submitted Form Data" menu
 * on the School Information detail page and to drive the generic form-data
 * viewer at school-information/[schoolId]/[formKey].
 */

export interface FormCatalogItem {
  /** Unique slug used in the viewer route + as the API path segment (before `/school/:id`). */
  key: string;
  endpoint: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** True when the backend returns a single object (or null) instead of an array. */
  single?: boolean;
}

export interface FormCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string; // gradient classes, e.g. "from-emerald-500 to-emerald-600"
  bg: string;
  text: string;
  ring: string;
  forms: FormCatalogItem[];
}

export const FORM_CATEGORIES: FormCategory[] = [
  {
    key: 'infrastructure',
    label: 'Infrastructure & Classroom Status',
    icon: Building2,
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    ring: 'ring-emerald-100',
    forms: [
      {
        key: 'infrastructure-status',
        endpoint: 'infrastructure',
        label: 'Infrastructure Status',
        description: 'Campus, buildings, rooms, washrooms, playground and renovation needs',
        icon: HardHat,
        single: true,
      },
    ],
  },
  {
    key: 'students',
    label: 'Students Information',
    icon: Users,
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    ring: 'ring-violet-100',
    forms: [
      {
        key: 'students-information',
        endpoint: 'students',
        label: "Students' Information",
        description: 'Monthly enrollment, attendance and demographic data per grade',
        icon: GraduationCap,
      },
    ],
  },
  {
    key: 'teachers',
    label: "Teachers' Information",
    icon: GraduationCap,
    color: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    ring: 'ring-orange-100',
    forms: [
      {
        key: 'teacher-individuals',
        endpoint: 'teachers/individual',
        label: 'Individual Teacher Records',
        description: 'Per-teacher name, designation, gender, qualification and experience',
        icon: UserSquare2,
      },
      {
        key: 'teachers-development',
        endpoint: 'teachers/development',
        label: "Teachers' Development",
        description: 'Monthly training, workshops and professional development records',
        icon: CalendarClock,
      },
    ],
  },
  {
    key: 'revenue',
    label: 'Revenue & Fee Structure',
    icon: Wallet,
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    ring: 'ring-amber-100',
    forms: [
      {
        key: 'fee-structure',
        endpoint: 'fee-structure',
        label: 'Fee Structure (Primary)',
        description: 'Monthly fee data per grade: tuition, session, sports, transport and more',
        icon: Receipt,
      },
      {
        key: 'revenue-budget-total',
        endpoint: 'revenue/budget/total',
        label: 'Revenue (Budget) — Total',
        description: 'Yearly budget targets and achievements per fee category',
        icon: Banknote,
        single: true,
      },
      {
        key: 'revenue-budget-monthly',
        endpoint: 'revenue/budget/monthly',
        label: 'Revenue (Budget) — Monthly',
        description: 'Monthly tuition fee budget tracking with % collection achieved',
        icon: CalendarDays,
      },
      {
        key: 'revenue-actual-total',
        endpoint: 'revenue/actual/total',
        label: 'Revenue (Actual) — Total',
        description: 'Yearly actual student revenue targets and achievements per category',
        icon: TrendingUp,
        single: true,
      },
      {
        key: 'revenue-actual-monthly',
        endpoint: 'revenue/actual/monthly',
        label: 'Revenue (Actual) — Monthly',
        description: 'Monthly actual student revenue tracking with % collection achieved',
        icon: Calculator,
      },
    ],
  },
  {
    key: 'performance',
    label: 'Pedagogical Performance',
    icon: TrendingUp,
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    ring: 'ring-rose-100',
    forms: [
      {
        key: 'pedagogical-achievements',
        endpoint: 'pedagogical-achievements',
        label: "School's Pedagogical Achievements",
        description: 'Annual scholarship recipients by category',
        icon: Trophy,
      },
      {
        key: 'co-curricular-activities',
        endpoint: 'cocurricular',
        label: 'Co-curricular Activities',
        description: 'Monthly participation % by grade for song, dance, debate, sports and more',
        icon: Sparkles,
      },
      {
        key: 'students-performance',
        endpoint: 'students-performance',
        label: "Students' Performance",
        description: 'Exam-wise grade A–F results and student counts',
        icon: GraduationCap,
      },
      {
        key: 'activity-participation',
        endpoint: 'activity-participation',
        label: 'Corner/Club/Library/Lab Participation',
        description: 'Monthly activity participation by grade with photo evidence',
        icon: Library,
      },
      {
        key: 'event-participation',
        endpoint: 'event-participation',
        label: 'Event Participation',
        description: 'Events, award levels and number of students awarded',
        icon: Award,
      },
    ],
  },
  {
    key: 'alumni',
    label: 'Alumni Information',
    icon: UserCheck,
    color: 'from-slate-500 to-slate-600',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    ring: 'ring-slate-100',
    forms: [
      {
        key: 'alumni-information',
        endpoint: 'alumni',
        label: 'Alumni Information',
        description: 'Notable alumni, current occupations, education and contributions',
        icon: UserCheck,
      },
    ],
  },
];

export function findFormByKey(formKey: string): { category: FormCategory; form: FormCatalogItem } | null {
  for (const category of FORM_CATEGORIES) {
    const form = category.forms.find((f) => f.key === formKey);
    if (form) return { category, form };
  }
  return null;
}
