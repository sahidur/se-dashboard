/**
 * Canonical grade vocabularies used across the data-collection tables.
 *
 * Historical/seeded rows stored plain numbers ("1".."10"), while each form
 * writes one of three spellings. Every comparison in the app must happen on a
 * single canonical value per table, otherwise previously submitted data never
 * matches the selected Year/Month/Grade and appears "missing":
 *
 *  - slug  : play_learn | nursery | g1..g12   → dc_students_info (+ generic viewer)
 *  - label : Play & Learn | Nursery | Grade 1.. → dc_fee_structure, dc_cocurricular
 *  - short : Play & Learn | Nursery | G1..G10  → dc_students_performance,
 *                                                dc_activity_participation
 */
export type GradeStyle = 'slug' | 'label' | 'short';

/** Normalizes any known spelling ("1", "g1", "G1", "Grade 1", "Play World", …). */
export function normalizeGradeValue(raw: unknown, style: GradeStyle): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^nursery$/i.test(s)) return style === 'slug' ? 'nursery' : 'Nursery';
  if (/^play[\s_&-]*(learn|world)?$/i.test(s)) return style === 'slug' ? 'play_learn' : 'Play & Learn';
  const m = s.match(/^(?:g|grade)?[\s_.-]*(\d{1,2})$/i);
  if (m) {
    const n = Math.min(Math.max(Number(m[1]), 0), 12);
    return style === 'slug' ? `g${n}` : style === 'label' ? `Grade ${n}` : `G${n}`;
  }
  return s;
}

/** Equivalence-class key so mixed spellings can be compared safely. */
export function gradeKey(raw: unknown): string {
  const norm = normalizeGradeValue(raw, 'slug');
  if (norm === 'play_learn') return 'g00-play';
  if (norm === 'nursery') return 'g00-nur';
  const m = norm.match(/^g(\d{1,2})$/);
  if (m) return `g${String(Number(m[1])).padStart(2, '0')}`;
  return String(raw ?? '').toLowerCase();
}

export function gradeEquals(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return gradeKey(a) === gradeKey(b);
}

/** Human label from any stored spelling; BRAC Academy renames "Play & Learn". */
export function displayGradeLabel(
  raw: unknown,
  schoolCategory?: string | null,
): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const norm = normalizeGradeValue(s, 'slug');
  const base =
    norm === 'play_learn'
      ? 'Play & Learn'
      : norm === 'nursery'
        ? 'Nursery'
        : /^g(\d{1,2})$/.test(norm)
          ? `Grade ${norm.slice(1)}`
          : s;
  if (schoolCategory === 'brac_academy' && base === 'Play & Learn') return 'Play World';
  return base;
}
