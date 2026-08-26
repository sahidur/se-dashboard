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
  const { pastYears = 60, futureYears = 20 } = options ?? {};
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y <= current + futureYears; y++) years.push(y);
  for (let y = current - 1; y >= current - pastYears; y--) years.push(y);
  return years;
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
