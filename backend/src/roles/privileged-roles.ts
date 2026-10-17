/**
 * Role names that confer global-admin power wherever they are checked by name
 * (SchoolScopeGuard, GlobalAdminGuard, isAdminRole helpers, school grants).
 * Kept in a standalone module to avoid a roles <-> users import cycle.
 */
export const PRIVILEGED_ROLE_NAMES: readonly string[] = ['Super Admin', 'Admin'];

/**
 * Permission resources that wildcard (resource-less) grants do NOT cover and
 * that therefore can only be delegated by someone holding the exact grant.
 * Must stay in sync with HT_LEADERSHIP_RESOURCE (ht-leadership.guard.ts).
 */
export const EXCLUSIVE_RESOURCES: readonly string[] = ['ht-leadership'];
