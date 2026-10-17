import { createHash, timingSafeEqual } from 'crypto';

/**
 * Refresh-token digests (OWASP A04/A07).
 *
 * bcrypt silently truncates its input at 72 bytes. Every HS256 JWT begins with
 * the same base64url header and then `{"sub":"<user uuid>...`, so the first 72
 * bytes of all refresh tokens for one user are identical — a bcrypt hash of
 * one token matched EVERY other token of that user, defeating rotation, reuse
 * detection and revocation. Refresh tokens are high-entropy server-issued
 * secrets, so a fast full-length SHA-256 digest is the right primitive (no
 * password stretching needed), compared in constant time.
 */
const PREFIX = 'sha256:';

export function hashRefreshToken(token: string): string {
  return PREFIX + createHash('sha256').update(token, 'utf8').digest('hex');
}

export function refreshTokenMatches(
  token: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  if (!token || !stored || !stored.startsWith(PREFIX)) {
    // Legacy bcrypt digests are deliberately rejected (they are the vulnerable
    // format); affected sessions simply sign in again once.
    return false;
  }
  const expected = Buffer.from(stored.slice(PREFIX.length), 'hex');
  const actual = createHash('sha256').update(token, 'utf8').digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
