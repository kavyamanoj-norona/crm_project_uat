// Menu paths of the Customers & Support module. Permissions are checked
// against these menu rows, so keep them in sync with prisma/seed/navigation.ts.
export const CUSTOMER_PATHS = {
  dashboard: "/customers/dashboard",
  database: "/customers/database",
  csWorkspace: "/customers/cs-workspace",
  announcements: "/customers/announcements",
  portalPreview: "/customers/portal-preview",
} as const;
