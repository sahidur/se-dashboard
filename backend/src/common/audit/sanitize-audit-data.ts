const SENSITIVE_KEY = /password|token|secret|api_?key|private_?key|authorization|cookie|credential|^pin$|^otp$|recovery_?code/i;

/** Never persist credentials, including those inside JSON columns or arrays. */
export function sanitizeAuditData(data: unknown): Record<string, any> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const seen = new WeakSet<object>();

  const sanitize = (value: any, nested = false): any => {
    if (value === null || value === undefined || typeof value !== 'object') return value ?? null;
    if (value instanceof Date) return value;
    // Keep the prior snapshot format for related entities: only their ID.
    if (nested && !Array.isArray(value) && 'id' in value) return { id: value.id };
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      const result = value.map((item) =>
        item && typeof item === 'object' && 'id' in item ? item.id : sanitize(item, true),
      );
      seen.delete(value);
      return result;
    }
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? '***' : sanitize(item, true);
    }
    seen.delete(value);
    return result;
  };

  const result = sanitize(data);
  return Object.keys(result).length ? result : undefined;
}
