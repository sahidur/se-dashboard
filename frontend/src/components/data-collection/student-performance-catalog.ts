import { BookOpenCheck, Baby, Blocks, ClipboardList, NotebookPen, ScrollText, type LucideIcon } from 'lucide-react';

/**
 * Student Performance (BA / BPS / BSS) — Pedagogical Performance.
 *
 * Transcribed from "Student Performance.xlsx". Six sub-forms across three
 * sections; they share one backend table (`dc_student_performance`) and one
 * generic React form driven by these definitions.
 */

export type StudentPerformanceFormKey = 'ba-1' | 'ba-2' | 'ba-3' | 'bps-1' | 'bps-2' | 'bss-1';

export interface PerfScale {
  /** Column label; also the key used inside the stored `values` object. */
  label: string;
  /** Tailwind classes for the column header tint. */
  tone: string;
}

export interface PerfRow {
  code: string;
  label: string;
  domain?: string;
}

export interface StudentPerformanceFormDef {
  key: StudentPerformanceFormKey;
  /** Route slug under /data-collection/forms/. */
  slug: string;
  sectionKey: 'ba' | 'bps' | 'bss';
  formNo: number;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Grade options. A single entry means the grade is fixed by the form. */
  grades: string[];
  /** Column header above the indicator/subject list. */
  rowHeader: string;
  /** Renders the extra "Domain" column and groups rows by it. */
  grouped?: boolean;
  periodLabel: string;
  appearedLabel: string;
  scale: PerfScale[];
}

export interface StudentPerformanceSection {
  key: 'ba' | 'bps' | 'bss';
  label: string;
  short: string;
  description: string;
  color: string;
  bg: string;
  text: string;
  ring: string;
}

export const EVALUATION_PERIODS = ['Half-yearly', 'Annual'];

const FOUR_POINT: PerfScale[] = [
  { label: 'Excellent', tone: 'bg-emerald-50 text-emerald-700' },
  { label: 'Good', tone: 'bg-sky-50 text-sky-700' },
  { label: 'Satisfactory', tone: 'bg-amber-50 text-amber-700' },
  { label: 'Need Improvement', tone: 'bg-rose-50 text-rose-700' },
];

const THREE_POINT: PerfScale[] = [
  { label: 'Best', tone: 'bg-emerald-50 text-emerald-700' },
  { label: 'Satisfactory', tone: 'bg-amber-50 text-amber-700' },
  { label: 'Need Improvement', tone: 'bg-rose-50 text-rose-700' },
];

const LETTER_GRADES: PerfScale[] = [
  { label: 'A+', tone: 'bg-emerald-50 text-emerald-700' },
  { label: 'A', tone: 'bg-teal-50 text-teal-700' },
  { label: 'A-', tone: 'bg-sky-50 text-sky-700' },
  { label: 'B', tone: 'bg-indigo-50 text-indigo-700' },
  { label: 'C', tone: 'bg-amber-50 text-amber-700' },
  { label: 'D', tone: 'bg-orange-50 text-orange-700' },
  { label: 'F', tone: 'bg-rose-50 text-rose-700' },
];

const numbered = (labels: string[]): PerfRow[] =>
  labels.map((label, i) => ({ code: String(i + 1), label }));

const subjects = (labels: string[]): PerfRow[] =>
  labels.map((label, i) => ({ code: `s${i + 1}`, label }));

const grouped = (entries: [string, string[]][]): PerfRow[] => {
  const rows: PerfRow[] = [];
  let n = 0;
  for (const [domain, labels] of entries) {
    for (const label of labels) {
      n += 1;
      rows.push({ code: String(n), label, domain });
    }
  }
  return rows;
};

/* ─── Row definitions ────────────────────────────────────── */

const BA_1_ROWS = numbered([
  'Joyfully participates in play and activities in daily basis',
  'Interacts with friends and peers',
  'Identifies and names Bangla and English alphabet per the lesson plan',
  'Curious (asks questions about various topics to know the reasons)',
  'Makes different things with clay/block/paper/dry leaf according to the lesson plan',
  'Expresses own opinion and emotions',
  'Identifies and counts the numbers per the lesson plan',
  'Understands and follows commands, requests, and instructions',
  'Recites or performs Bangla/English rhymes per the lesson plan',
  'Conscious about safe living (protecting oneself from unknown danger, commuting safely on roads)',
  'Traces letters and numbers as per the lesson plans',
  'Understands and practices a healthy lifestyle (staying clean/hygienic, eating healthy food, washing hands, brushing teeth)',
  'Sings and dances as per the lesson plan',
  'Respectful/empathetic/compassionate/kind towards others',
  'Draws and colours pictures as per the lesson plan',
]);

const BA_2_ROWS = numbered([
  'Can read and write Bangla and English alphabets as per the lesson plan',
  'Tells, recites, or acts on the selected English rhymes/poems as per the lesson plan',
  'Counts and writes numbers as per the lesson plan',
  'Performs addition and subtraction as per the lesson plan',
  'Interested in arts and crafts',
  'Interested in cultural activities (storytelling, acting, rhymes, poetry, singing, and dancing)',
  'Curious (asks questions about various topics to know the reasons)',
  'Caring about protecting the school and classroom environment',
  'Joyfully interacts with friends and peers',
  'Spontaneously participates in discussions regarding lessons and other topics, and understands and follows commands, requests, and instructions',
  'Self-aware and dignified (e.g., fulfills personal responsibilities, keeps promises, shows a sense of self-respect and dignity in behavior, etc.)',
  'Respectful/empathetic/compassionate/kind towards others',
  'Knows about and practices a healthy lifestyle (e.g., maintaining cleanliness, washing hands with soap when necessary, brushing teeth, etc.)',
  'Conscious about living a safe and risk-free life (knows about hazardous objects and sources of danger and informs the teacher)',
]);

const BA_3_ROWS = subjects([
  'Bangla',
  'English',
  'Primary Mathematics',
  'Social Science and Primary Science',
  'Religion and Moral Education',
  'Bangladesh and Global Studies',
  'Arts and Crafts',
  'World Studies',
  'Story Time',
]);

const BPS_1_ROWS = grouped([
  ['Physical Development & Motor Skills', [
    'Participates in play and learning activities.',
    'Holds a pencil correctly, draws, colours, and completes simple puzzles.',
  ]],
  ['Language & Communication', [
    'Understands and follows instructions, requests, and directions.',
    'Recognises and names Bangla and English letters according to the lesson plan.',
    'Expresses ideas and feelings.',
  ]],
  ['Social, Emotional & Moral Development', [
    'Shows respect, empathy, and kindness.',
    'Interacts positively with peers.',
  ]],
  ['Mathematics & Logical Thinking', [
    'Recognises numbers and counts according to the lesson plan.',
  ]],
  ['Creativity & Aesthetic Expression', [
    'Creates art and craft work according to the lesson plan.',
    'Participates in cultural activities.',
  ]],
  ['Environment & Climate Awareness', [
    'Maintains personal and environmental cleanliness.',
  ]],
  ['Science & Technology', [
    'Shows curiosity about science and technology.',
  ]],
  ['Health, Hygiene & Safety', [
    'Practises healthy habits.',
    'Demonstrates awareness of safe and risk-free practices in daily life.',
  ]],
]);

const BPS_2_ROWS = subjects([
  'Bangla',
  'English',
  'Mathematics',
  'My World',
  'Rhymes and Stories',
  'Arts and Crafts',
  'Science',
  'BGS',
  'World Studies',
  'Religion and Moral Education',
]);

const BSS_1_ROWS = subjects([
  'Bangla 1st Paper',
  'Bangla 2nd Paper',
  'English 1st Paper',
  'English 2nd Paper',
  'Mathematics',
  'Information and Communication Technology',
  'Physics / History of Bangladesh and World Civilisation',
  'Religion',
  'Chemistry / Geography and Environment',
  'Biology / Civics and Citizenship / Economics',
  'Higher Mathematics / Agriculture Studies',
  'Bangladesh and Global Studies / General Science',
  'Science',
]);

/* ─── Sections ───────────────────────────────────────────── */

export const STUDENT_PERFORMANCE_SECTIONS: StudentPerformanceSection[] = [
  {
    key: 'ba',
    label: "Students' Performance (BA)",
    short: 'BA',
    description: 'BRAC Academy — Play & Learn, Nursery and Grade 1–5 evaluations',
    color: 'from-teal-500 to-teal-600',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    ring: 'ring-teal-100',
  },
  {
    key: 'bps',
    label: "Students' Performance (BPS)",
    short: 'BPS',
    description: 'BRAC Primary School — domain-wise Play & Learn and subject-wise Nursery to Grade 5',
    color: 'from-indigo-500 to-indigo-600',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    ring: 'ring-indigo-100',
  },
  {
    key: 'bss',
    label: "Students' Performance (BSS)",
    short: 'BSS',
    description: 'BRAC Secondary School — subject-wise Grade 6–10 and SSC results',
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    ring: 'ring-rose-100',
  },
];

/**
 * A school only sees the performance section matching its own category:
 * BRAC Academy -> BA, BRAC Primary -> BPS, BRAC Secondary -> BSS.
 */
export const SECTION_BY_SCHOOL_CATEGORY: Record<string, StudentPerformanceSection['key']> = {
  brac_academy: 'ba',
  brac_primary: 'bps',
  brac_secondary: 'bss',
};

/** Sections applicable to the given school category (empty when unknown/missing). */
export function getSectionsForSchoolCategory(category?: string | null): StudentPerformanceSection[] {
  const key = category ? SECTION_BY_SCHOOL_CATEGORY[category] : undefined;
  return key ? STUDENT_PERFORMANCE_SECTIONS.filter((s) => s.key === key) : [];
}

/* ─── Forms ──────────────────────────────────────────────── */

export const STUDENT_PERFORMANCE_FORMS: StudentPerformanceFormDef[] = [
  {
    key: 'ba-1',
    slug: 'student-performance-ba-1',
    sectionKey: 'ba',
    formNo: 1,
    label: 'Play & Learn — Indicator-wise Performance',
    description: '15 developmental indicators rated Excellent to Need Improvement',
    icon: Blocks,
    grades: ['Play & Learn'],
    rowHeader: 'Indicators',
    periodLabel: 'Evaluation Period',
    appearedLabel: 'Students appeared in the Evaluation (Number)',
    scale: FOUR_POINT,
  },
  {
    key: 'ba-2',
    slug: 'student-performance-ba-2',
    sectionKey: 'ba',
    formNo: 2,
    label: 'Nursery — Indicator-wise Performance',
    description: '14 learning and behaviour indicators rated Excellent to Need Improvement',
    icon: Baby,
    grades: ['Nursery'],
    rowHeader: 'Indicators',
    periodLabel: 'Evaluation Period',
    appearedLabel: 'Students appeared in the Evaluation (Number)',
    scale: FOUR_POINT,
  },
  {
    key: 'ba-3',
    slug: 'student-performance-ba-3',
    sectionKey: 'ba',
    formNo: 3,
    label: 'Grade 1–5 — Subject-wise Performance',
    description: '9 subjects rated Excellent to Need Improvement',
    icon: BookOpenCheck,
    grades: ['G1', 'G2', 'G3', 'G4', 'G5'],
    rowHeader: 'Subjects',
    periodLabel: 'Assessment Period',
    appearedLabel: 'Students appeared in the exam (Number)',
    scale: FOUR_POINT,
  },
  {
    key: 'bps-1',
    slug: 'student-performance-bps-1',
    sectionKey: 'bps',
    formNo: 1,
    label: 'Play & Learn — Domain-wise Performance',
    description: '14 indicators across 8 development domains rated Best to Need Improvement',
    icon: ClipboardList,
    grades: ['Play & Learn'],
    rowHeader: 'Indicators',
    grouped: true,
    periodLabel: 'Evaluation Period',
    appearedLabel: 'Students appeared in the Evaluation (Number)',
    scale: THREE_POINT,
  },
  {
    key: 'bps-2',
    slug: 'student-performance-bps-2',
    sectionKey: 'bps',
    formNo: 2,
    label: 'Nursery & Grade 1–5 — Subject-wise Results',
    description: '10 subjects with A+ to F grade distribution',
    icon: NotebookPen,
    grades: ['Nursery', 'G1', 'G2', 'G3', 'G4', 'G5'],
    rowHeader: 'Subjects',
    periodLabel: 'Assessment Period',
    appearedLabel: 'Students appeared in the exam (Number)',
    scale: LETTER_GRADES,
  },
  {
    key: 'bss-1',
    slug: 'student-performance-bss-1',
    sectionKey: 'bss',
    formNo: 1,
    label: 'Grade 6–10 & SSC — Subject-wise Results',
    description: '13 subjects with A+ to F grade distribution',
    icon: ScrollText,
    grades: ['G6', 'G7', 'G8', 'G9', 'G10', 'SSC'],
    rowHeader: 'Subjects',
    periodLabel: 'Assessment Period',
    appearedLabel: 'Students appeared in the exam (Number)',
    scale: LETTER_GRADES,
  },
];

const ROWS_BY_KEY: Record<StudentPerformanceFormKey, PerfRow[]> = {
  'ba-1': BA_1_ROWS,
  'ba-2': BA_2_ROWS,
  'ba-3': BA_3_ROWS,
  'bps-1': BPS_1_ROWS,
  'bps-2': BPS_2_ROWS,
  'bss-1': BSS_1_ROWS,
};

export function getStudentPerformanceForm(key: string): StudentPerformanceFormDef | undefined {
  return STUDENT_PERFORMANCE_FORMS.find((f) => f.key === key);
}

export function getStudentPerformanceRows(key: StudentPerformanceFormKey): PerfRow[] {
  return ROWS_BY_KEY[key];
}

export function getSection(key: string): StudentPerformanceSection | undefined {
  return STUDENT_PERFORMANCE_SECTIONS.find((s) => s.key === key);
}

export function getSectionForms(key: string): StudentPerformanceFormDef[] {
  return STUDENT_PERFORMANCE_FORMS.filter((f) => f.sectionKey === key);
}

/** Replace "Play & Learn" with "Play World" for BRAC Academy schools. */
export function getGradeDisplayName(value: string, schoolCategory?: string | null): string {
  if (schoolCategory === 'brac_academy' && value === 'Play & Learn') return 'Play World';
  return value;
}

/** Get display label for a student-performance form, replacing "Play & Learn" with "Play World" for BRAC Academy. */
export function getFormDisplayLabel(form: StudentPerformanceFormDef, schoolCategory?: string | null): string {
  if (schoolCategory === 'brac_academy') {
    return form.label.replace('Play & Learn', 'Play World');
  }
  return form.label;
}
