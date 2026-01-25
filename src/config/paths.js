// Centralized Firestore/Data paths for multi-tenant SaaS readiness
export const PATHS = {
  SOCIETIES: 'societies',
  CONFERENCES: 'conferences',
  MEMBERS: 'members',
  VERIFICATION_CODES: 'verification_codes',
  ADMIN_EMAILS: 'admins',
  AUDIT_LOGS: 'audit_logs',
  PLATFORM_SETTINGS: 'platform_settings',
  // Nested/temporal paths can be composed at runtime using PATHS constants
};
export default PATHS;
