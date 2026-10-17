// The navigation seed: 6 modules, their sidebar menus and who can see them.
// Icons are lucide names in kebab-case (https://lucide.dev/icons).
//
// `roles`    = privileges that can view (ADMIN is super-admin and sees everything anyway).
//              On an item it overrides the module's list.
// `readOnly` = privileges that can view but not create/edit.
// `approve`  = privileges that get canApprove on that item.

export const PRIVILEGES = [
  { code: "ADMIN", name: "Admin / Owner", isSuperAdmin: true, isBranchBound: false, homePath: "/company/owner-dashboard" },
  { code: "BRANCH_MANAGER", name: "Branch Manager", isSuperAdmin: false, isBranchBound: true, homePath: "/service/dashboard" },
  { code: "SALES", name: "Sales", isSuperAdmin: false, isBranchBound: true, homePath: "/service/dashboard" },
  { code: "PURCHASE_MANAGER", name: "Purchase Manager", isSuperAdmin: false, isBranchBound: false, homePath: "/inventory/dashboard" },
  { code: "CUSTOMER_SUCCESS", name: "Customer Success", isSuperAdmin: false, isBranchBound: false, homePath: "/customers/cs-workspace" },
  { code: "CHIP_COORDINATOR", name: "Chip Level Coordinator", isSuperAdmin: false, isBranchBound: true, homePath: "/service/lab" },
] as const;

export type PrivilegeCode = (typeof PRIVILEGES)[number]["code"];

const BM = "BRANCH_MANAGER";
const SALES = "SALES";
const PM = "PURCHASE_MANAGER";
const CS = "CUSTOMER_SUCCESS";
const CHIP = "CHIP_COORDINATOR";
const EVERYONE: PrivilegeCode[] = [BM, SALES, PM, CS, CHIP];

export type ItemDef = {
  title: string;
  path: string;
  icon: string;
  roles?: PrivilegeCode[];
  /** Privileges that can view this item but not create/edit (overrides the module's readOnly list). */
  readOnly?: PrivilegeCode[];
  approve?: PrivilegeCode[];
};
export type GroupDef = { group: string; icon?: string; items: ItemDef[] };
export type ModuleDef = {
  code: string;
  title: string;
  icon: string;
  path: string;
  roles: PrivilegeCode[];
  readOnly?: PrivilegeCode[];
  entries: (ItemDef | GroupDef)[];
};

export const MODULES: ModuleDef[] = [
  {
    code: "service",
    title: "Service",
    icon: "wrench",
    path: "/service",
    roles: [SALES, BM, CS],
    readOnly: [CS],
    entries: [
      { title: "Dashboard", path: "/service/dashboard", icon: "layout-dashboard", roles: [SALES, BM, CS, CHIP] },
      { title: "Cases", path: "/service/cases", icon: "list" },
      { title: "New Case (Intake)", path: "/service/new", icon: "file-plus", roles: [SALES, BM] },
      { title: "Chip-Level Lab", path: "/service/lab", icon: "cpu", roles: [CHIP, BM], approve: [CHIP] },
      { title: "Uncollected Devices", path: "/service/uncollected", icon: "laptop" },
      {
        group: "Analytics",
        icon: "bar-chart-2",
        items: [
          { title: "Ageing Analysis", path: "/service/ageing", icon: "clock-alert", roles: [SALES, BM] },
        ],
      },
      {
        group: "Manage",
        icon: "boxes",
        items: [
          { title: "Vendors", path: "/service/lab/vendors", icon: "users", roles: [CHIP], approve: [CHIP] },
          { title: "QC Checklist", path: "/service/qc-checklist", icon: "clipboard-check", roles: [CHIP], approve: [CHIP] },
          { title: "TAT Configuration", path: "/service/tat-config", icon: "timer", roles: [] }, // Admin only
        ],
      },
    ],
  },
  {
    code: "sales",
    title: "Sales",
    icon: "shopping-bag",
    path: "/sales",
    roles: [SALES, BM],
    entries: [
      { title: "Dashboard", path: "/sales/dashboard", icon: "layout-dashboard" },
      { title: "Direct Sales", path: "/sales/direct", icon: "tag" },
      {
        group: "Manage",
        icon: "sliders-horizontal",
        items: [
          { title: "Sales Target", path: "/sales/target", icon: "target", roles: [] }, // Admin only
        ],
      },
    ],
  },
  {
    code: "finance",
    title: "Finance",
    icon: "wallet",
    path: "/finance",
    roles: [BM],
    entries: [
      // The one Finance screen branches use: their day's takings and expenses. Everything else here is Admin only.
      { title: "Daybook & Expenses", path: "/finance/daybook", icon: "book-open", roles: [BM], approve: [BM] },
      {
        group: "Sales & Receipts",
        icon: "receipt",
        items: [
          { title: "Invoices", path: "/finance/invoices", icon: "file-text", roles: [] },
          { title: "Receipts", path: "/finance/receipts", icon: "receipt", roles: [] },
          { title: "Credit Notes", path: "/finance/credit-notes", icon: "file-minus", roles: [] },
          { title: "Customer Dues", path: "/finance/pending-dues", icon: "clock", roles: [] },
        ],
      },
      {
        group: "Purchases & Payables",
        icon: "shopping-cart",
        items: [{ title: "Payables", path: "/finance/payables", icon: "wallet", roles: [] }], // Head Office (admin) only
      },
      {
        group: "Expenses & Banking",
        icon: "landmark",
        items: [
          { title: "Expenses", path: "/finance/expenses", icon: "wallet", roles: [] },
          { title: "Cash & Bank", path: "/finance/cash-bank", icon: "banknote", roles: [] },
        ],
      },
      {
        group: "Accounting",
        icon: "book",
        items: [
          { title: "Journal Entries", path: "/finance/journal", icon: "book-open", roles: [], readOnly: [BM] },
          { title: "Ledger", path: "/finance/ledger", icon: "book", roles: [] },
          { title: "Chart of Accounts", path: "/finance/accounts", icon: "list-tree", roles: [], readOnly: [BM] },
          { title: "Trial Balance", path: "/finance/trial-balance", icon: "scale", roles: [] },
          { title: "Reconciliation", path: "/finance/reconciliation", icon: "check-check", roles: [] }, // Head Office (admin) only
        ],
      },
      {
        group: "Reports",
        icon: "bar-chart-2",
        items: [
          { title: "Profit & Loss", path: "/finance/reports/profit-loss", icon: "trending-up", roles: [] },
          { title: "Balance Sheet", path: "/finance/reports/balance-sheet", icon: "scale", roles: [] },
          { title: "Income & Expense", path: "/finance/reports/income-expense", icon: "area-chart", roles: [] },
        ],
      },
    ],
  },
  {
    code: "inventory",
    title: "Inventory",
    icon: "package",
    path: "/inventory",
    roles: [PM, BM],
    entries: [
      { title: "Dashboard", path: "/inventory/dashboard", icon: "layout-dashboard" },
      { title: "Stock", path: "/inventory/stock", icon: "boxes", approve: [PM] },
      { title: "Purchasing", path: "/inventory/purchasing", icon: "shopping-cart", roles: [PM, BM, CHIP], approve: [PM] },
      { title: "Billing", path: "/inventory/billing", icon: "receipt", approve: [PM] },
      { title: "Vendor Replacements", path: "/inventory/vendor-replacements", icon: "repeat", roles: [PM] },
      {
        group: "Manage",
        icon: "boxes",
        items: [
          // The one item catalog. Everyone can look items up; only the Purchase Manager (and admins) add or change them.
          { title: "Items", path: "/inventory/items", icon: "package", roles: EVERYONE, readOnly: [BM, SALES, CS, CHIP] },
          { title: "Suppliers", path: "/inventory/suppliers", icon: "truck", approve: [PM] },
          // Reusable warranty periods for purchase bills: Admin and the Purchase Manager.
          { title: "Manage Warranty", path: "/inventory/warranties", icon: "shield-check", roles: [PM] },
          // USID numbering and GST rates: Admin (sees everything) and the Purchase Manager only.
          { title: "Configuration", path: "/inventory/configuration", icon: "settings", roles: [PM] },
        ],
      },
    ],
  },
  {
    code: "customers",
    title: "Customers & Support",
    icon: "headset",
    path: "/customers",
    roles: [SALES, BM, CS],
    entries: [
      { title: "Dashboard", path: "/customers/dashboard", icon: "layout-dashboard" },
      { title: "Leads", path: "/customers/leads", icon: "user-plus" },
      { title: "Lead Reports", path: "/customers/lead-reports", icon: "trending-up" },
      { title: "Customer Database", path: "/customers/database", icon: "contact" },
      { title: "CS Workspace", path: "/customers/cs-workspace", icon: "inbox", roles: [CS] },
      { title: "Announcements", path: "/customers/announcements", icon: "megaphone", roles: EVERYONE },
      { title: "Portal Preview", path: "/customers/portal-preview", icon: "smartphone", roles: [CS] },
      {
        group: "Manage",
        icon: "boxes",
        items: [{ title: "B2B Accounts", path: "/customers/b2b", icon: "building-2" }],
      },
    ],
  },
  {
    code: "company",
    title: "Company",
    icon: "building-2",
    path: "/company",
    roles: [], // Owner / Admin only
    entries: [
      { title: "Owner Dashboard", path: "/company/owner-dashboard", icon: "crown" },
      { title: 'AI Agents — "The Seven"', path: "/company/agents", icon: "bot" },
      { title: "Audit Log", path: "/company/audit-log", icon: "scroll-text" },
    ],
  },
  {
    code: "admin",
    title: "Master Settings",
    icon: "shield-check",
    path: "/admin",
    roles: [], // Admin only
    entries: [
      { title: "Users", path: "/admin/users", icon: "users" },
      { title: "Company", path: "/admin/companies", icon: "building" },
      { title: "Privilege", path: "/admin/privileges", icon: "key-round" },
      { title: "Modules", path: "/admin/modules", icon: "layout-grid" },
      { title: "Rules", path: "/admin/rules", icon: "sliders-horizontal" },
      {
        group: "Security",
        icon: "lock",
        items: [
          { title: "Block List", path: "/admin/security/blocked-ips", icon: "shield-ban" },
          { title: "User Activity", path: "/admin/security/activity-log", icon: "list-checks" },
        ],
      },
    ],
  },
];

// ─── Organisation seed ───────────────────────────────────────────────────────

export const COMPANY = { code: "NTL", name: "Norona Tech LLP", email: "info@laptopclinic.in" };

export const BRANCHES = [
  { code: "HO", name: "Head Office", isVirtual: true }, // holds purchased stock until it is allocated to a branch case
  { code: "EDP", name: "Edappally", isVirtual: false },
  { code: "LAB", name: "Chip-Level Lab", isVirtual: true },
];

export const DOMAINS = [
  { code: "MANAGEMENT", name: "Management", departments: ["Management"] },
  { code: "SERVICE", name: "Service", departments: ["Front Desk", "Engineering", "Chip-Level Lab"] },
  { code: "SALES", name: "Sales", departments: ["Sales Team"] },
  { code: "OPERATIONS", name: "Operations", departments: ["Purchase", "Customer Success"] },
];

type DemoUser = {
  username: string;
  firstName: string;
  lastName: string;
  mobile: string;
  privilege: PrivilegeCode;
  branch: string | null; // branch code; null = all branches
  domain: string;
  department: string;
  defaultModule: string; // module code
};

export const DEMO_USERS: DemoUser[] = [
  { username: "admin", firstName: "Admin", lastName: "Owner", mobile: "9000000001", privilege: "ADMIN", branch: null, domain: "MANAGEMENT", department: "Management", defaultModule: "company" },
  { username: "bm.edp", firstName: "Bindu", lastName: "Manager", mobile: "9000000002", privilege: BM, branch: "EDP", domain: "MANAGEMENT", department: "Management", defaultModule: "service" },
  { username: "sales.edp", firstName: "Sanjay", lastName: "Sales", mobile: "9000000003", privilege: SALES, branch: "EDP", domain: "SALES", department: "Sales Team", defaultModule: "service" },
  { username: "purchase", firstName: "Priya", lastName: "Purchase", mobile: "9000000004", privilege: PM, branch: null, domain: "OPERATIONS", department: "Purchase", defaultModule: "inventory" },
  { username: "cs", firstName: "Chitra", lastName: "Success", mobile: "9000000005", privilege: CS, branch: null, domain: "OPERATIONS", department: "Customer Success", defaultModule: "customers" },
  { username: "chip", firstName: "Kiran", lastName: "Chip", mobile: "9000000006", privilege: CHIP, branch: "LAB", domain: "SERVICE", department: "Chip-Level Lab", defaultModule: "service" },
];
