// Menu paths of the Inventory module. Permissions are checked against these
// menu rows, so keep them in sync with prisma/seed/navigation.ts.
export const INVENTORY_PATHS = {
  dashboard: "/inventory/dashboard",
  stock: "/inventory/stock",
  purchasing: "/inventory/purchasing",
  billing: "/inventory/billing",
  catalog: "/inventory/catalog",
  suppliers: "/inventory/suppliers",
} as const;
