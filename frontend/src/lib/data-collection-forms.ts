/**
 * Per-form permission resources for the `data-collection` module.
 *
 * Each entry mirrors the backend `@Permissions({ module: 'data-collection',
 * ..., resource })` annotations on the data-collection controller. A role may
 * hold either a wildcard grant (no resource — covers every form) or
 * form-scoped grants for individual entries below.
 */

export interface DcFormResource {
  /** Resource key sent to the API and stored on the permission row. */
  resource: string;
  label: string;
  group: string;
  description?: string;
}

export const DC_FORM_RESOURCES: DcFormResource[] = [
  {
    resource: 'basic-info',
    label: 'Basic Information',
    group: 'School Setup',
    description: 'Founding info, recognition details and school profile basics',
  },
  {
    resource: 'infrastructure',
    label: 'Infrastructure Status',
    group: 'Infrastructure & Classroom',
    description: 'Campus, buildings, rooms, washrooms, playground and renovation needs',
  },
  {
    resource: 'students',
    label: "Students' Information",
    group: 'Students',
    description: 'Monthly enrollment, attendance and demographic data per grade',
  },
  {
    resource: 'teachers',
    label: "Teachers' Information",
    group: 'Teachers',
    description: 'Aggregate teacher counts by designation and gender',
  },
  {
    resource: 'teachers-individual',
    label: 'Individual Teacher Records',
    group: 'Teachers',
    description: 'Per-teacher name, designation, gender, qualification and experience',
  },
  {
    resource: 'teachers-development',
    label: "Teachers' Development",
    group: 'Teachers',
    description: 'Monthly training, workshops and professional development records',
  },
  {
    resource: 'fee-structure',
    label: 'Fee Structure',
    group: 'Revenue & Fees',
    description: 'Monthly fee data per grade: tuition, session, sports, transport and more',
  },
  {
    resource: 'revenue-budget-total',
    label: 'Planned Revenue - Total',
    group: 'Revenue & Fees',
    description: 'Yearly budget targets and achievements per fee category',
  },
  {
    resource: 'revenue-budget-monthly',
    label: 'Planned Revenue - Monthly',
    group: 'Revenue & Fees',
    description: 'Monthly fee-wise revenue budget tracking with % collection achieved',
  },
  {
    resource: 'revenue-actual-total',
    label: 'Actual Revenue - Total',
    group: 'Revenue & Fees',
    description: 'Yearly actual student revenue targets and achievements per category',
  },
  {
    resource: 'revenue-actual-monthly',
    label: 'Actual Revenue - Monthly',
    group: 'Revenue & Fees',
    description: 'Monthly actual student revenue tracking with % collection achieved',
  },
  {
    resource: 'alumni',
    label: 'Alumni Information',
    group: 'Alumni',
    description: 'Notable alumni, current occupations, education and contributions',
  },
  {
    resource: 'pedagogical-achievements',
    label: "School's Pedagogical Achievements",
    group: 'Performance',
    description: 'Annual scholarship recipients by category',
  },
  {
    resource: 'cocurricular',
    label: 'Co-curricular Activities',
    group: 'Performance',
    description: 'Monthly participation % by grade for song, dance, debate, sports and more',
  },
  {
    resource: 'students-performance',
    label: "Students' Academic Performance",
    group: 'Performance',
    description: 'Exam-wise grade A–F results and student counts',
  },
  {
    resource: 'student-performance',
    label: 'Student Performance (BA/BPS/BSS)',
    group: 'Performance',
    description: 'All BA / BPS / BSS indicator sub-forms share this switch',
  },
  {
    resource: 'activity-participation',
    label: 'Corner/Club/Library/Lab Participation',
    group: 'Participation',
    description: 'Monthly activity participation by grade with photo evidence',
  },
  {
    resource: 'event-participation',
    label: 'Event Participation',
    group: 'Participation',
    description: 'Events, award levels and number of students awarded',
  },
];

/** Legacy/aggregate forms kept for completeness. */
const EXTRA_FORMS: DcFormResource[] = [
  {
    resource: 'revenue',
    label: 'Revenue (legacy)',
    group: 'Other',
    description: 'Older combined revenue endpoint still used by some pages',
  },
  {
    resource: 'performance',
    label: 'Performance (legacy)',
    group: 'Other',
    description: 'Older combined performance endpoint still used by some pages',
  },
];

export const ALL_DC_FORM_RESOURCES: DcFormResource[] = [
  ...DC_FORM_RESOURCES,
  ...EXTRA_FORMS,
];

/** Forms grouped by their display group, preserving order. */
export function groupDcFormResources(): Record<string, DcFormResource[]> {
  const out: Record<string, DcFormResource[]> = {};
  for (const f of ALL_DC_FORM_RESOURCES) {
    (out[f.group] ||= []).push(f);
  }
  return out;
}

/**
 * Maps a form-catalog API endpoint (e.g. 'teachers/individual' or
 * 'revenue/budget/total') to its permission resource key
 * ('teachers-individual' / 'revenue-budget-total').
 */
export function endpointToResource(endpoint: string): string {
  if (endpoint.startsWith('student-performance')) return 'student-performance';
  return endpoint.replace(/\//g, '-');
}
