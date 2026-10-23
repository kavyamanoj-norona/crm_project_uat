// Menu paths of the Inventory module. Permissions are checked against these
// menu rows, so keep them in sync with prisma/seed/navigation.ts.
export const INVENTORY_PATHS = {
  dashboard: "/inventory/dashboard",
  stock: "/inventory/stock",
  purchasing: "/inventory/purchasing",
  stockRequests: "/inventory/stock-requests",
  billing: "/inventory/billing",
  items: "/inventory/items",
  categories: "/inventory/categories",
  suppliers: "/inventory/suppliers",
  warranties: "/inventory/warranties",
  vendorReplacements: "/inventory/vendor-replacements",
  configuration: "/inventory/configuration",
} as const;
