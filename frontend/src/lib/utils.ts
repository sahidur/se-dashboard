import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeCardClassName(className?: string) {
  if (!className) {
    return '';
  }

  return className
    .split(/\s+/)
    .filter((token) => token && !/^border-(l|r|t|b)(-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(token))
    .join(' ');
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Exact timestamp rendered in Bangladesh Standard Time (UTC/GMT+6) with a
 * 12-hour AM/PM clock, e.g. "Aug 26, 2026, 9:45 AM".
 */
export function formatDateTimeBd(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Year options ordered current year first, then upcoming years, then past years. */
export function buildYearOptions(options?: {
  pastYears?: number;
  futureYears?: number;
}): number[] {
  const { pastYears = 20, futureYears = 5 } = options ?? {};
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y <= current + futureYears; y++) years.push(y);
  for (let y = current - 1; y >= current - pastYears; y--) years.push(y);
  return years;
}

/** Sort arbitrary years in the same order as buildYearOptions: current first, then upcoming, then past. */
export function orderYearOptions(years: number[]): number[] {
  const current = new Date().getFullYear();
  const present = [...new Set(years)];
  const cur = present.includes(current) ? [current] : [];
  const future = present.filter((y) => y > current).sort((a, b) => a - b);
  const past = present.filter((y) => y < current).sort((a, b) => b - a);
  return [...cur, ...future, ...past];
}

/** Validate that a year string is a valid 4-digit year within the allowed range. */
export function isValidAcademicYear(year: string): boolean {
  const n = Number(year);
  if (!Number.isInteger(n) || n < 1970 || n > 2100) return false;
  return true;
}

/* ─── Grade normalization ──────────────────────────────────────
 * Stored grades use several vocabularies across the module:
 *   slug   : play_learn | nursery | g1..g12   (students info + generic viewer)
 *   label  : Play & Learn | Nursery | Grade N (fee structure, co-curricular)
 *   short  : Play & Learn | Nursery | GN      (students performance, activities)
 * Compare grades via gradeKey/gradeEquals so mixed spellings still match;
 * render with displayGradeLabel for consistent output.
 */

/** Equivalence-class key ("1", "g1", "Grade 1", "G1" → "g01"). */
export function gradeKey(raw?: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^nursery$/i.test(s)) return 'nur';
  if (/^play[\s_&-]*(learn|world)?$/i.test(s)) return 'play';
  const m = s.match(/^(?:g|grade)?[\s_.-]*(\d{1,2})$/i);
  if (m) return `g${String(Number(m[1])).padStart(2, '0')}`;
  return s.toLowerCase();
}

export function gradeEquals(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return gradeKey(a) === gradeKey(b);
}

/** Numeric grade index for sorting (Play/Nursery first); NaN when unknown. */
export function gradeSortIndex(raw?: string | null): number {
  const k = gradeKey(raw);
  if (k === 'play') return -2;
  if (k === 'nur') return -1;
  const m = k.match(/^g(\d{2})$/);
  return m ? Number(m[1]) : Number.NaN;
}

/** Human label from any stored spelling; BRAC Academy renames "Play & Learn". */
export function displayGradeLabel(
  raw?: string | null,
  schoolCategory?: string | null,
): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const k = gradeKey(s);
  const base =
    k === 'play' ? 'Play & Learn'
    : k === 'nur' ? 'Nursery'
    : /^g\d{2}$/.test(k) ? `Grade ${Number(k.slice(1))}`
    : s;
  if (schoolCategory === 'brac_academy' && base === 'Play & Learn') return 'Play World';
  return base;
}

/**
 * Resolve a stored file/image URL into one the browser can actually load.
 *
 * Locally-stored uploads are saved with a relative path (e.g. `/api/uploads/..`)
 * so they are domain-agnostic. This prefixes them with the API origin. It also
 * rewrites legacy absolute `http://localhost:PORT/uploads/..` URLs (persisted
 * before this fix) to the current API origin, while leaving remote absolute
 * URLs (e.g. S3 / DigitalOcean Spaces) untouched.
 */
export function resolveAssetUrl(raw?: string | null): string {
  if (!raw) return '';

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const origin = apiBase.replace(/\/api\/?$/, '');

  // Absolute URL
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      // Legacy local-storage URLs pointed at localhost — repoint to API origin.
      if (
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
        u.pathname.includes('/uploads/')
      ) {
        const key = u.pathname.slice(
          u.pathname.indexOf('/uploads/') + '/uploads/'.length,
        );
        return `${origin}/api/uploads/${key}`;
      }
      return raw; // remote (S3/Spaces) or already-correct absolute URL
    } catch {
      return raw;
    }
  }

  // Relative path — normalise legacy `/uploads/..` to `/api/uploads/..`
  let path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.startsWith('/uploads/')) path = `/api${path}`;
  return `${origin}${path}`;
}

/** Human-friendly "time ago" label (e.g. "3 min ago", "2 days ago"). */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.round(month / 12);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

/** A calendar-day label used to group timeline entries. */
export function formatDayLabel(date: string | Date): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Best-effort parse of a User-Agent string into browser / OS / device. */
export function parseUserAgent(ua?: string): {
  browser: string;
  os: string;
  device: 'Mobile' | 'Tablet' | 'Desktop';
} {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };

  let browser = 'Unknown';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';

  let os = 'Unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let device: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
  if (/ipad|tablet/i.test(ua)) device = 'Tablet';
  else if (/mobi|iphone|android.*mobile/i.test(ua)) device = 'Mobile';

  return { browser, os, device };
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  dropdown: 'Dropdown',
  number: 'Number',
  single_select_searchable: 'Searchable Dropdown',
  multi_select_searchable: 'Multi-Select Searchable',
  true_false: 'Yes / No',
  location: 'Location',
  file_upload: 'File Upload',
  date: 'Date',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
};
