// Menu paths of the Telecaller module. Permissions are checked against these menu rows, so keep them in sync with
// prisma/seed/navigation.ts. (Leads lives in CUSTOMER_PATHS.leads, which points here.)
export const TELECALLER_PATHS = {
  dashboard: "/telecaller/dashboard",
  leads: "/telecaller/leads",
  branchCalls: "/telecaller/branch-calls",
  servicePrices: "/telecaller/service-prices",
  incentives: "/telecaller/incentives",
} as const;
