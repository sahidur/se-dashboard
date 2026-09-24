/** Do not allow the credentialed API client to follow caller-supplied origins. */
export function isApiRequestUrl(url: string, baseURL: string, requestBaseURL?: string): boolean {
  if (requestBaseURL !== undefined && requestBaseURL !== baseURL) return false;
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return false;
  if (/(?:^|\/)(?:\.|%2e){2}(?:\/|\?|#|$)/i.test(url)) return false;
  try {
    const base = new URL(baseURL);
    const prefix = base.pathname.replace(/\/$/, '');
    // Axios combines baseURL + a leading-slash path (unlike URL(url, base)).
    const target = new URL(`${prefix}/${url.slice(1)}`, base.origin);
    return target.origin === base.origin &&
      (target.pathname === prefix || target.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

/** Remove offline draft copies written by older versions without touching other users' keys. */
export function clearLegacyDrafts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, userId: string): void {
  const prefix = `dc-draft:${userId}:`;
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) storage.removeItem(key);
  }
}

/** Spreadsheet applications may interpret even quoted CSV or HTML cells as formulas. */
export function safeSpreadsheetCell(value: string): string {
  return (/^\s*[-=+@]/.test(value) || /^[\t\r\n]/.test(value)) && !/^-\d+(\.\d+)?$/.test(value)
    ? `'${value}` : value;
}

export function escapeCsvCell(value: string): string {
  const safe = safeSpreadsheetCell(value);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
