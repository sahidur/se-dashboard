import { ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Stored asset references (profile pictures, answer files, attachments) are
 * later rendered as href/src. Only same-origin paths ("/api/...") and plain
 * http(s) URLs are accepted, so `javascript:`, `data:`, `vbscript:` or
 * protocol-relative `//host` values can never be persisted (OWASP A03/A05
 * stored XSS defence-in-depth; the frontend also filters on render).
 */
export function isSafeAssetUrl(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function IsSafeAssetUrl(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isSafeAssetUrl',
      target: object.constructor,
      propertyName: propertyName as string,
      options: { message: `${String(propertyName)} must be an http(s) or same-origin URL`, ...options },
      validator: { validate: isSafeAssetUrl },
    });
}
