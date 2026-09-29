// Menu paths of the Master Settings module. Permissions are checked against
// these menu rows, so keep them in sync with prisma/seed/navigation.ts.
export const ADMIN_PATHS = {
  companies: "/admin/companies",
  branches: "/admin/branches",
  domains: "/admin/domains",
  privileges: "/admin/privileges",
  users: "/admin/users",
  modules: "/admin/modules",
  blockedIps: "/admin/security/blocked-ips",
  activityLog: "/admin/security/activity-log",
} as const;
