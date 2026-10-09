// Menu paths of the Customers & Support module. Permissions are checked
// against these menu rows, so keep them in sync with prisma/seed/navigation.ts.
export const CUSTOMER_PATHS = {
  dashboard: "/customers/dashboard",
  database: "/customers/database",
  leads: "/customers/leads",
  b2b: "/customers/b2b",
  leadReports: "/customers/lead-reports",
  csWorkspace: "/customers/cs-workspace",
  announcements: "/customers/announcements",
  portalPreview: "/customers/portal-preview",
} as const;
