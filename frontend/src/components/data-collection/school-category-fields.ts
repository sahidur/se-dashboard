/**
 * School-category-driven fee field configuration shared by the Revenue &
 * Fee Structure forms (Fee Structure, Revenue Total, Revenue Monthly).
 *
 * The field list per school category mirrors the fee structure logic: each
 * category exposes only the fee fields that apply to it. Unknown or missing
 * categories fall back to the full field list.
 */

export type FeeKey =
  | 'admissionFee'
  | 'tuitionFee'
  | 'sessionFee'
  | 'assessmentFee'
  | 'sportsFee'
  | 'syllabusFee'
  | 'admissionForm'
  | 'testimonialFee'
  | 'othersFee'
  | 'transportFee'
  | 'exerciseBookFee'
  | 'labLibraryFee'
  | 'projectClubFee'
  | 'sscRegistrationFee'
  | 'boatFee'
  | 'terminalAssessment1Fee'
  | 'terminalAssessment2Fee'
  | 'formativeAssessmentFee'
  | 'classroomLibraryFee'
  | 'eventFee'
  | 'playActivityFee';

export interface FeeFieldDef {
  label: string;
  hint?: string;
}

export const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  brac_academy: 'BRAC Academy',
  brac_primary: 'BRAC Primary',
  brac_secondary: 'BRAC Secondary',
};

export const FEE_FIELD_DEFS: Record<FeeKey, FeeFieldDef> = {
  admissionFee:            { label: 'Admission Fee' },
  tuitionFee:              { label: 'Tuition Fee' },
  sessionFee:              { label: 'Session Fee' },
  assessmentFee:           { label: 'Assessment Fee' },
  sportsFee:               { label: 'Sports Fee' },
  syllabusFee:             { label: 'Syllabus Fee' },
  admissionForm:           { label: 'Admission Form Fee' },
  testimonialFee:          { label: 'Testimonial Fee' },
  othersFee:               { label: 'Diary, Badge, ID card, Syllabus, Tie fee' },
  transportFee:            { label: 'Transport Fee' },
  exerciseBookFee:         { label: 'Exercise Book Fee' },
  labLibraryFee:           { label: 'Lab / Library Fee' },
  projectClubFee:          { label: 'Project/ Club Activity Fee' },
  sscRegistrationFee:      { label: 'SSC Registration Fee' },
  boatFee:                 { label: 'Boat Fee' },
  terminalAssessment1Fee:  { label: 'Terminal Assessment Fee 1' },
  terminalAssessment2Fee:  { label: 'Terminal Assessment Fee 2' },
  formativeAssessmentFee:  { label: 'Formative Assessment Fee' },
  classroomLibraryFee:     { label: 'Classroom Library Fee' },
  eventFee:                { label: 'Event Fee' },
  playActivityFee:         { label: 'Play Based Activity Material Fee' },
};

/** All fee keys in canonical display order (fallback for unknown categories). */
export const ALL_FEE_KEYS: FeeKey[] = [
  'admissionFee', 'tuitionFee', 'sessionFee', 'assessmentFee', 'sportsFee',
  'syllabusFee', 'admissionForm', 'testimonialFee', 'othersFee', 'transportFee',
  'exerciseBookFee', 'labLibraryFee', 'projectClubFee', 'sscRegistrationFee',
  'boatFee', 'terminalAssessment1Fee', 'terminalAssessment2Fee',
  'formativeAssessmentFee', 'classroomLibraryFee', 'eventFee', 'playActivityFee',
];

/* Field list per school category; unknown/missing category falls back to all fields. */
export const FEE_FIELDS_BY_CATEGORY: Record<string, FeeKey[]> = {
  brac_primary: [
    'admissionFee', 'sessionFee', 'tuitionFee', 'assessmentFee', 'sportsFee',
    'admissionForm', 'exerciseBookFee', 'testimonialFee', 'othersFee',
  ],
  brac_secondary: [
    'tuitionFee', 'admissionFee', 'sessionFee', 'assessmentFee',
    'labLibraryFee', 'projectClubFee', 'sportsFee', 'sscRegistrationFee',
    'admissionForm', 'boatFee', 'testimonialFee', 'othersFee',
  ],
  brac_academy: [
    'admissionFee', 'tuitionFee', 'sessionFee', 'assessmentFee', 'sportsFee',
    'syllabusFee', 'admissionForm', 'testimonialFee', 'othersFee', 'transportFee',
    'terminalAssessment1Fee', 'terminalAssessment2Fee', 'formativeAssessmentFee',
    'classroomLibraryFee', 'eventFee', 'playActivityFee',
  ],
};

export function getFeeKeysForCategory(category?: string | null): FeeKey[] {
  return FEE_FIELDS_BY_CATEGORY[category ?? ''] ?? ALL_FEE_KEYS;
}

/**
 * Field defs for a school category. Optionally restrict to a subset of keys
 * (e.g. the columns that exist on the yearly revenue-total tables) — the
 * category ordering is preserved and subset keys never add fields back.
 */
export function getFeeFieldsForCategory(
  category?: string | null,
  allowedKeys?: FeeKey[],
): { key: FeeKey; label: string; hint?: string }[] {
  const keys = getFeeKeysForCategory(category);
  const filtered = allowedKeys ? keys.filter((k) => allowedKeys.includes(k)) : keys;
  return filtered.map((key) => ({ key, ...FEE_FIELD_DEFS[key] }));
}