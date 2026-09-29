// Module map from the blueprint §4. Icons are lucide names in kebab-case.
// `roles` = who can view (ADMIN is super-admin and sees everything anyway).
// `readOnly` = roles that can view but not create/edit.
// `approve` = roles that get canApprove on that item.

export const ROLES = [
  { code: "ADMIN", name: "Admin / Owner", isSuperAdmin: true, homePath: "/dashboard/owner" },
  { code: "BRANCH_MANAGER", name: "Branch Manager", isSuperAdmin: false, homePath: "/dashboard" },
  { code: "SALES", name: "Sales", isSuperAdmin: false, homePath: "/dashboard" },
  { code: "PURCHASE_MANAGER", name: "Purchase Manager", isSuperAdmin: false, homePath: "/inventory/stock" },
  { code: "CUSTOMER_SUCCESS", name: "Customer Success", isSuperAdmin: false, homePath: "/cs/amount-verification" },
  { code: "CHIP_COORDINATOR", name: "Chip Level Coordinator", isSuperAdmin: false, homePath: "/lab/inbound" },
] as const;

export type RoleCode = (typeof ROLES)[number]["code"];

const BM = "BRANCH_MANAGER";
const SALES = "SALES";
const PM = "PURCHASE_MANAGER";
const CS = "CUSTOMER_SUCCESS";
const CHIP = "CHIP_COORDINATOR";
const EVERYONE: RoleCode[] = [BM, SALES, PM, CS, CHIP];

export type ItemDef = {
  title: string;
  path: string;
  icon: string;
  roles?: RoleCode[]; // defaults to the module's roles
  approve?: RoleCode[];
};
export type GroupDef = { group: string; icon?: string; items: ItemDef[] };
export type ModuleDef = {
  code: string;
  title: string;
  icon: string;
  path: string;
  roles: RoleCode[];
  readOnly?: RoleCode[];
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
        group: "Organisation",
        items: [
          { title: "Branches", path: "/admin/branches", icon: "store" },
          { title: "Users", path: "/admin/users", icon: "users" },
          { title: "Roles & permissions", path: "/admin/roles", icon: "key-round" },
          { title: "Engineers", path: "/admin/engineers", icon: "hard-hat" },
        ],
      },
      {
        group: "Rules",
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
      { group: "Governance", items: [{ title: "Audit log", path: "/admin/audit-log", icon: "scroll-text" }] },
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

export const DEMO_USERS: { username: string; name: string; email: string; role: RoleCode }[] = [
  { username: "admin", name: "Arun Owner", email: "admin@laptopclinic.local", role: "ADMIN" },
  { username: "bm.edp", name: "Bindu Manager", email: "bm.edp@laptopclinic.local", role: BM },
  { username: "sales.edp", name: "Sanjay Sales", email: "sales.edp@laptopclinic.local", role: SALES },
  { username: "purchase", name: "Priya Purchase", email: "purchase@laptopclinic.local", role: PM },
  { username: "cs", name: "Chitra Success", email: "cs@laptopclinic.local", role: CS },
  { username: "chip", name: "Kiran Chip", email: "chip@laptopclinic.local", role: CHIP },
];
