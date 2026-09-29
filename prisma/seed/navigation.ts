// Module map from the blueprint §4. Icons are lucide names in kebab-case.
// `roles` = privileges that can view (ADMIN is super-admin and sees everything anyway).
// `readOnly` = privileges that can view but not create/edit.
// `approve` = privileges that get canApprove on that item.

export const PRIVILEGES = [
  { code: "ADMIN", name: "Admin / Owner", isSuperAdmin: true, isBranchBound: false, homePath: "/dashboard/owner" },
  { code: "BRANCH_MANAGER", name: "Branch Manager", isSuperAdmin: false, isBranchBound: true, homePath: "/dashboard" },
  { code: "SALES", name: "Sales", isSuperAdmin: false, isBranchBound: true, homePath: "/dashboard" },
  { code: "PURCHASE_MANAGER", name: "Purchase Manager", isSuperAdmin: false, isBranchBound: false, homePath: "/inventory/stock" },
  { code: "CUSTOMER_SUCCESS", name: "Customer Success", isSuperAdmin: false, isBranchBound: false, homePath: "/cs/amount-verification" },
  { code: "CHIP_COORDINATOR", name: "Chip Level Coordinator", isSuperAdmin: false, isBranchBound: true, homePath: "/lab/inbound" },
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
  roles?: PrivilegeCode[]; // defaults to the module's roles
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
    code: "dashboard",
    title: "Dashboard",
    icon: "layout-dashboard",
    path: "/dashboard",
    roles: EVERYONE,
    entries: [
      { title: "Branch dashboard", path: "/dashboard", icon: "gauge" },
      { title: "Owner dashboard", path: "/dashboard/owner", icon: "crown", roles: [] },
      { title: "My approvals", path: "/dashboard/approvals", icon: "check-check", roles: [BM] },
    ],
  },
  {
    code: "service",
    title: "Service",
    icon: "wrench",
    path: "/service",
    roles: [SALES, BM, CS],
    readOnly: [CS],
    entries: [
      {
        group: "Intake",
        items: [
          { title: "New case", path: "/service/new", icon: "file-plus", roles: [SALES, BM] },
          { title: "Walk-in / Pickup / On-site", path: "/service/intake", icon: "truck", roles: [SALES, BM] },
        ],
      },
      {
        group: "Cases",
        items: [
          { title: "All cases", path: "/service/cases", icon: "list" },
          { title: "Pending approval", path: "/service/pending-approval", icon: "clock" },
          { title: "Awaiting stock", path: "/service/awaiting-stock", icon: "package-search" },
          { title: "In QC", path: "/service/in-qc", icon: "clipboard-check" },
          { title: "Ready for delivery", path: "/service/ready-for-delivery", icon: "package-check" },
        ],
      },
      {
        group: "Follow-up",
        items: [
          { title: "Uncollected devices", path: "/service/uncollected", icon: "laptop" },
          { title: "Cancellations", path: "/service/cancellations", icon: "circle-x" },
        ],
      },
    ],
  },
  {
    code: "lab",
    title: "Chip-Level Lab",
    icon: "cpu",
    path: "/lab",
    roles: [CHIP],
    entries: [
      {
        group: "Jobs",
        items: [
          { title: "Inbound", path: "/lab/inbound", icon: "inbox" },
          { title: "In repair", path: "/lab/in-repair", icon: "hammer" },
          { title: "Outbound dispatch", path: "/lab/dispatch", icon: "send" },
        ],
      },
      {
        group: "Commercial",
        items: [
          { title: "Rate card", path: "/lab/rate-card", icon: "receipt", approve: [CHIP] },
          { title: "Lab P&L", path: "/lab/pnl", icon: "trending-up" },
        ],
      },
      { group: "Performance", items: [{ title: "Lab TAT", path: "/lab/tat", icon: "timer" }] },
    ],
  },
  {
    code: "inventory",
    title: "Inventory",
    icon: "package",
    path: "/inventory",
    roles: [PM, BM],
    entries: [
      {
        group: "Stock",
        items: [
          { title: "Branch stock", path: "/inventory/stock", icon: "boxes" },
          { title: "Unit lookup", path: "/inventory/units", icon: "scan-barcode" },
          { title: "Valuation", path: "/inventory/valuation", icon: "indian-rupee" },
        ],
      },
      {
        group: "Purchasing",
        items: [
          { title: "Purchase requests", path: "/inventory/purchase-requests", icon: "shopping-cart", approve: [PM] },
          { title: "Receive stock", path: "/inventory/receive", icon: "package-plus" },
        ],
      },
      {
        group: "Movement",
        items: [
          { title: "Transfers", path: "/inventory/transfers", icon: "arrow-left-right", approve: [PM] },
          { title: "Reservations", path: "/inventory/reservations", icon: "bookmark" },
        ],
      },
      { group: "Control", items: [{ title: "Stock audits", path: "/inventory/audits", icon: "clipboard-list" }] },
    ],
  },
  {
    code: "catalog",
    title: "Catalog",
    icon: "tags",
    path: "/catalog",
    roles: EVERYONE,
    readOnly: [BM, SALES, CS, CHIP],
    entries: [
      { title: "Items & services", path: "/catalog/items", icon: "list" },
      { title: "Minimum selling price", path: "/catalog/msp", icon: "badge-indian-rupee" },
      { title: "Announcements", path: "/catalog/announcements", icon: "megaphone" },
    ],
  },
  {
    code: "sales",
    title: "Sales",
    icon: "shopping-bag",
    path: "/sales",
    roles: [SALES, BM],
    entries: [
      {
        group: "Counter",
        items: [
          { title: "New sale", path: "/sales/new", icon: "circle-plus" },
          { title: "Sales list", path: "/sales/list", icon: "list" },
        ],
      },
      {
        group: "Refurbished",
        items: [
          { title: "Units", path: "/sales/refurb-units", icon: "laptop" },
          { title: "Warranty tracker", path: "/sales/warranty", icon: "shield" },
        ],
      },
      {
        group: "Buyback",
        items: [
          { title: "Buy-ins", path: "/sales/buy-ins", icon: "hand-coins" },
          { title: "Refurb pipeline", path: "/sales/refurb-pipeline", icon: "workflow" },
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
      {
        group: "Daybook",
        items: [
          { title: "Cash book", path: "/finance/cash-book", icon: "book-open" },
          { title: "Expenses", path: "/finance/expenses", icon: "receipt" },
          { title: "Day close", path: "/finance/day-close", icon: "lock" },
        ],
      },
      {
        group: "Payments",
        items: [
          { title: "Receipts", path: "/finance/receipts", icon: "receipt-indian-rupee" },
          { title: "Refunds", path: "/finance/refunds", icon: "undo-2" },
          { title: "Adjustments", path: "/finance/adjustments", icon: "sliders-horizontal" },
        ],
      },
      {
        group: "Approvals",
        items: [
          { title: "Price overrides", path: "/finance/approvals/price-overrides", icon: "badge-percent", approve: [BM] },
          { title: "Discounts", path: "/finance/approvals/discounts", icon: "percent", approve: [BM] },
          { title: "Refund approvals", path: "/finance/approvals/refunds", icon: "circle-check", approve: [BM] },
        ],
      },
      { group: "Export", items: [{ title: "Zoho export", path: "/finance/zoho-export", icon: "file-spreadsheet" }] },
    ],
  },
  {
    code: "customers",
    title: "Customers",
    icon: "users",
    path: "/customers",
    roles: [SALES, BM, CS],
    entries: [
      { title: "Customer database", path: "/customers/list", icon: "contact" },
      { title: "Companies (B2B)", path: "/customers/companies", icon: "building-2" },
      { title: "Enquiry log", path: "/customers/enquiries", icon: "message-square" },
      { title: "Memberships", path: "/customers/memberships", icon: "id-card" },
      { title: "Import", path: "/customers/import", icon: "upload", roles: [BM] },
    ],
  },
  {
    code: "cs",
    title: "Customer Success",
    icon: "headset",
    path: "/cs",
    roles: [CS],
    entries: [
      {
        group: "Queues",
        items: [
          { title: "Amount verification", path: "/cs/amount-verification", icon: "scale" },
          { title: "Feedback", path: "/cs/feedback", icon: "star" },
          { title: "Membership due", path: "/cs/membership-due", icon: "calendar-clock" },
        ],
      },
      { title: "Portal preview", path: "/cs/portal-preview", icon: "smartphone" },
      { title: "WhatsApp log", path: "/cs/whatsapp-log", icon: "message-circle" },
    ],
  },
  {
    code: "reports",
    title: "Reports",
    icon: "chart-column",
    path: "/reports",
    roles: [BM],
    entries: [
      {
        group: "Daily",
        items: [
          { title: "Closing cash", path: "/reports/closing-cash", icon: "banknote" },
          { title: "Daily activity", path: "/reports/daily-activity", icon: "activity" },
        ],
      },
      {
        group: "Operations",
        items: [
          { title: "Aging", path: "/reports/aging", icon: "hourglass" },
          { title: "Engineer performance", path: "/reports/engineer-performance", icon: "user-check" },
          { title: "TAT", path: "/reports/tat", icon: "timer" },
        ],
      },
      {
        group: "Money",
        items: [
          { title: "P&L (incl. lab)", path: "/reports/pnl", icon: "trending-up" },
          { title: "Refunds", path: "/reports/refunds", icon: "undo-2" },
        ],
      },
      {
        group: "Growth",
        items: [
          { title: "Marketing attribution", path: "/reports/marketing", icon: "target" },
          { title: "Membership", path: "/reports/membership", icon: "id-card" },
          { title: "Stock", path: "/reports/stock", icon: "boxes" },
        ],
      },
    ],
  },
  {
    code: "agents",
    title: "AI Agents",
    icon: "bot",
    path: "/agents",
    roles: [],
    entries: [
      { title: "The Seven", path: "/agents/roster", icon: "users-round" },
      { title: "Run history", path: "/agents/runs", icon: "history" },
      { title: "Prompt versions", path: "/agents/prompts", icon: "file-code" },
      { title: "Kiran chat", path: "/agents/kiran", icon: "sparkles", roles: [BM] },
    ],
  },
  {
    code: "admin",
    title: "Master Settings",
    icon: "shield-check",
    path: "/admin",
    roles: [],
    entries: [
      {
        group: "Master Settings",
        items: [
          { title: "Company", path: "/admin/companies", icon: "building-2" },
          { title: "Branch", path: "/admin/branches", icon: "store" },
          { title: "Domain", path: "/admin/domains", icon: "network" },
          { title: "Privilege", path: "/admin/privileges", icon: "key-round" },
          { title: "Users", path: "/admin/users", icon: "users" },
          { title: "Modules", path: "/admin/modules", icon: "layout-grid" },
          { title: "Engineers", path: "/admin/engineers", icon: "hard-hat" },
        ],
      },
      {
        group: "Rules CRM",
        items: [
          { title: "TAT standards", path: "/admin/tat", icon: "timer" },
          { title: "Discount caps", path: "/admin/discount-caps", icon: "percent" },
          { title: "GST", path: "/admin/gst", icon: "landmark" },
        ],
      },
      {
        group: "Channels",
        items: [
          { title: "WhatsApp templates", path: "/admin/whatsapp-templates", icon: "message-circle" },
          { title: "Telegram", path: "/admin/telegram", icon: "send" },
        ],
      },
      {
        group: "Security",
        items: [
          { title: "Blocked IP", path: "/admin/security/blocked-ips", icon: "shield-ban" },
          { title: "User Activity Log", path: "/admin/security/activity-log", icon: "list-checks" },
          { title: "Audit log", path: "/admin/audit-log", icon: "scroll-text" },
        ],
      },
    ],
  },
  {
    code: "settings",
    title: "Settings",
    icon: "settings",
    path: "/settings",
    roles: EVERYONE,
    entries: [
      { title: "Profile", path: "/settings/profile", icon: "user" },
      { title: "Appearance", path: "/settings/appearance", icon: "palette" },
      { title: "Password & security", path: "/settings/security", icon: "key-round" },
      { title: "Notifications", path: "/settings/notifications", icon: "bell" },
      { title: "Sessions", path: "/settings/sessions", icon: "monitor-smartphone" },
    ],
  },
];

// ─── Organisation seed ───────────────────────────────────────────────────────

export const COMPANY = { code: "NTL", name: "Norona Tech LLP", email: "info@laptopclinic.in" };

export const BRANCHES = [
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
  { username: "admin", firstName: "Arun", lastName: "Owner", mobile: "9000000001", privilege: "ADMIN", branch: null, domain: "MANAGEMENT", department: "Management", defaultModule: "dashboard" },
  { username: "bm.edp", firstName: "Bindu", lastName: "Manager", mobile: "9000000002", privilege: BM, branch: "EDP", domain: "MANAGEMENT", department: "Management", defaultModule: "dashboard" },
  { username: "sales.edp", firstName: "Sanjay", lastName: "Sales", mobile: "9000000003", privilege: SALES, branch: "EDP", domain: "SALES", department: "Sales Team", defaultModule: "service" },
  { username: "purchase", firstName: "Priya", lastName: "Purchase", mobile: "9000000004", privilege: PM, branch: null, domain: "OPERATIONS", department: "Purchase", defaultModule: "inventory" },
  { username: "cs", firstName: "Chitra", lastName: "Success", mobile: "9000000005", privilege: CS, branch: null, domain: "OPERATIONS", department: "Customer Success", defaultModule: "cs" },
  { username: "chip", firstName: "Kiran", lastName: "Chip", mobile: "9000000006", privilege: CHIP, branch: "LAB", domain: "SERVICE", department: "Chip-Level Lab", defaultModule: "lab" },
];
