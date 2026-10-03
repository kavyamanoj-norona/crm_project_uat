// Menu paths of the Service module. Permissions are checked against these menu
// rows (sub-pages inherit from the deepest matching item), so keep them in
// sync with prisma/seed/navigation.ts.
export const SERVICE_PATHS = {
  dashboard: "/service/dashboard",
  cases: "/service/cases",
  newCase: "/service/new",
  uncollected: "/service/uncollected",
  lab: "/service/lab",
  items: "/service/items",
} as const;
