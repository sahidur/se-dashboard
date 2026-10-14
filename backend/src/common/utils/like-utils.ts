/**
 * Escape LIKE/ILIKE metacharacters so user-supplied search input is matched
 * literally instead of altering the pattern's semantics.
 *
 * PostgreSQL uses backslash as the default LIKE escape character, so
 * escaping `\`, `%` and `_` is sufficient. Values remain fully parameterized
 * (this is NOT about SQL injection) — it only stops a search for e.g. `%` or
 * `a_` from broadening into a wildcard scan.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Wrap a user search term as a contains-pattern with metacharacters escaped. */
export function likeContains(value: string): string {
  return `%${escapeLike(value)}%`;
}
