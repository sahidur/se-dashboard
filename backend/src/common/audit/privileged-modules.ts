/**
 * Entity modules whose audit entries are sensitive (they expose exactly how
 * the platform's privilege model is configured). Only Super Admins may see
 * these categories in any activity-log viewer.
 *
 * Lives in its own module so services that cannot import AuditService
 * (circular dependency: AuditService -> UsersService) can still reuse it.
 */
export const PRIVILEGED_AUDIT_MODULES = ['Role', 'Permission'];