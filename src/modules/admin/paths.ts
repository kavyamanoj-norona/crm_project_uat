// Menu paths of the Master Settings module. Permissions are checked against
// these menu rows (sub-pages inherit from the deepest matching menu item), so
// keep them in sync with prisma/seed/navigation.ts.
export const ADMIN_PATHS = {
  users: "/admin/users",
  companies: "/admin/companies",
  // Tabs inside Company — covered by the Company menu permission.
  branches: "/admin/companies/branches",
  domains: "/admin/companies/domains",
  departments: "/admin/companies/departments",
  privileges: "/admin/privileges",
  modules: "/admin/modules",
  rules: "/admin/rules",
  items: "/admin/manage/items",
  blockedIps: "/admin/security/blocked-ips",
  activityLog: "/admin/security/activity-log",
} as const;
